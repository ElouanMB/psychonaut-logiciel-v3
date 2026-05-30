use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::{Manager, State};

#[derive(Serialize, Deserialize, Clone, Debug)]
struct RenduItem {
    id: String,
    title: String,
    date: String,
    status: String,
    substance: String,
    content: String,
    #[serde(rename = "analysisId")]
    analysis_id: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
struct DraftItem {
    id: String,
    title: String,
    date: String,
    content: String,
}

struct DbState(Mutex<Connection>);

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn load_data(state: State<'_, DbState>) -> Result<serde_json::Value, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare("SELECT id, title, date, status, substance, content, analysis_id FROM rendus")
        .map_err(|e| e.to_string())?;
    let rendus_iter = stmt
        .query_map([], |row| {
            Ok(RenduItem {
                id: row.get(0)?,
                title: row.get(1)?,
                date: row.get(2)?,
                status: row.get(3)?,
                substance: row.get(4)?,
                content: row.get(5)?,
                analysis_id: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut rendus = Vec::new();
    for r in rendus_iter {
        rendus.push(r.map_err(|e| e.to_string())?);
    }

    let mut stmt = conn
        .prepare("SELECT id, title, date, content FROM drafts")
        .map_err(|e| e.to_string())?;
    let drafts_iter = stmt
        .query_map([], |row| {
            Ok(DraftItem {
                id: row.get(0)?,
                title: row.get(1)?,
                date: row.get(2)?,
                content: row.get(3)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut drafts = Vec::new();
    for d in drafts_iter {
        drafts.push(d.map_err(|e| e.to_string())?);
    }

    Ok(serde_json::json!({
        "rendus": rendus,
        "drafts": drafts
    }))
}

#[tauri::command]
fn save_rendu(state: State<'_, DbState>, item: RenduItem) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO rendus (id, title, date, status, substance, content, analysis_id)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
         ON CONFLICT(id) DO UPDATE SET
            title=excluded.title,
            date=excluded.date,
            status=excluded.status,
            substance=excluded.substance,
            content=excluded.content,
            analysis_id=excluded.analysis_id",
        params![
            item.id,
            item.title,
            item.date,
            item.status,
            item.substance,
            item.content,
            item.analysis_id
        ],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn save_draft(state: State<'_, DbState>, item: DraftItem) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO drafts (id, title, date, content)
         VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT(id) DO UPDATE SET
            title=excluded.title,
            date=excluded.date,
            content=excluded.content",
        params![item.id, item.title, item.date, item.content],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn delete_rendu(state: State<'_, DbState>, id: String) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM rendus WHERE id = ?1", [id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn delete_draft(state: State<'_, DbState>, id: String) -> Result<(), String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM drafts WHERE id = ?1", [id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

/// Ouvre l'URL du forum dans le navigateur par défaut du système.
/// Utilise tauri-plugin-opener de façon asynchrone pour éviter tout blocage de l'UI.
#[tauri::command]
fn publish_to_forum(_app_handle: tauri::AppHandle, url: String) -> Result<(), String> {
    tauri_plugin_opener::open_url(url, None::<&str>).map_err(|e| e.to_string())
}

fn get_gemini_key() -> String {
    let encrypted: [u8; 39] = [
        49, 58, 3, 2, 59, 22, 47, 8, 2, 14, 36, 69, 1, 78, 17, 87, 31, 6, 47, 4, 23, 26, 52, 48,
        46, 13, 26, 24, 42, 89, 72, 52, 8, 41, 13, 45, 22, 8, 36,
    ];
    let mask = b"psychonaut";
    let mut decrypted = Vec::new();
    for (i, &byte) in encrypted.iter().enumerate() {
        decrypted.push(byte ^ mask[i % mask.len()]);
    }
    String::from_utf8(decrypted).unwrap_or_default()
}

#[tauri::command]
async fn call_gemini(prompt: String) -> Result<String, String> {
    let key = get_gemini_key();
    let client = reqwest::Client::new();

    let body = serde_json::json!({
        "contents": [{
            "parts": [{"text": prompt}]
        }]
    });

    let res = client.post("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent")
        .header("Content-Type", "application/json")
        .header("x-goog-api-key", &key)
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !res.status().is_success() {
        let status = res.status();
        let err_text = res.text().await.unwrap_or_default();
        return Err(format!("Erreur API Gemini ({}): {}", status, err_text));
    }

    let json_res: serde_json::Value = res.json().await.map_err(|e| e.to_string())?;

    let generated_text = json_res["candidates"][0]["content"]["parts"][0]["text"]
        .as_str()
        .ok_or_else(|| {
            "Impossible d'extraire le texte généré de la réponse API Gemini".to_string()
        })?;

    Ok(generated_text.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            let app_data_dir = app
                .path()
                .app_local_data_dir()
                .expect("failed to get app data dir");
            std::fs::create_dir_all(&app_data_dir).expect("failed to create app data dir");
            let db_path = app_data_dir.join("psychonaut.db");
            println!("Database path: {:?}", db_path);
            let conn = Connection::open(db_path).expect("failed to open database");

            conn.execute(
                "CREATE TABLE IF NOT EXISTS rendus (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    date TEXT NOT NULL,
                    status TEXT NOT NULL,
                    substance TEXT NOT NULL,
                    content TEXT NOT NULL,
                    analysis_id TEXT
                )",
                [],
            )
            .expect("failed to create rendus table");

            conn.execute(
                "CREATE TABLE IF NOT EXISTS drafts (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    date TEXT NOT NULL,
                    content TEXT NOT NULL
                )",
                [],
            )
            .expect("failed to create drafts table");

            app.manage(DbState(Mutex::new(conn)));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            load_data,
            save_rendu,
            save_draft,
            delete_rendu,
            delete_draft,
            publish_to_forum,
            call_gemini,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
