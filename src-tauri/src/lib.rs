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

/// Rendu tel qu'échangé avec le serveur (synchronisation entre appareils)
#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
struct SyncRendu {
    id: String,
    title: String,
    date: Option<String>,
    status: Option<String>,
    substance: Option<String>,
    content: Option<String>,
    analysis_id: Option<String>,
    updated_at: i64,
    deleted: bool,
}

#[derive(Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
struct SyncedVersion {
    id: String,
    updated_at: i64,
}

struct DbState(Mutex<Connection>);

fn now_ms() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

/// Ajoute une colonne si elle n'existe pas encore (migration des bases créées par les anciennes versions)
fn add_column_if_missing(conn: &Connection, table: &str, column: &str, definition: &str) -> rusqlite::Result<bool> {
    let mut stmt = conn.prepare(&format!("PRAGMA table_info({})", table))?;
    let exists = stmt
        .query_map([], |row| row.get::<_, String>(1))?
        .filter_map(Result::ok)
        .any(|name| name == column);
    if !exists {
        conn.execute(&format!("ALTER TABLE {} ADD COLUMN {} {}", table, column, definition), [])?;
    }
    Ok(!exists)
}

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn load_data(state: State<'_, DbState>) -> Result<serde_json::Value, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare("SELECT id, title, date, status, substance, content, analysis_id FROM rendus WHERE deleted = 0")
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
        "INSERT INTO rendus (id, title, date, status, substance, content, analysis_id, updated_at, deleted, synced)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 0, 0)
         ON CONFLICT(id) DO UPDATE SET
            title=excluded.title,
            date=excluded.date,
            status=excluded.status,
            substance=excluded.substance,
            content=excluded.content,
            analysis_id=excluded.analysis_id,
            updated_at=excluded.updated_at,
            deleted=0,
            synced=0",
        params![
            item.id,
            item.title,
            item.date,
            item.status,
            item.substance,
            item.content,
            item.analysis_id,
            now_ms()
        ],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

/// Rendus modifiés (ou supprimés) localement et pas encore envoyés au serveur
#[tauri::command]
fn list_rendus_to_sync(state: State<'_, DbState>) -> Result<Vec<SyncRendu>, String> {
    let conn = state.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT id, title, date, status, substance, content, analysis_id, updated_at, deleted
             FROM rendus WHERE synced = 0",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |row| {
            Ok(SyncRendu {
                id: row.get(0)?,
                title: row.get(1)?,
                date: row.get(2)?,
                status: row.get(3)?,
                substance: row.get(4)?,
                content: row.get(5)?,
                analysis_id: row.get(6)?,
                updated_at: row.get(7)?,
                deleted: row.get::<_, i64>(8)? != 0,
            })
        })
        .map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

/// Marque comme synchronisées les versions envoyées, sauf si le rendu a été modifié entre-temps
#[tauri::command]
fn mark_rendus_synced(state: State<'_, DbState>, items: Vec<SyncedVersion>) -> Result<(), String> {
    let mut conn = state.0.lock().map_err(|e| e.to_string())?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    for it in items {
        tx.execute(
            "UPDATE rendus SET synced = 1 WHERE id = ?1 AND updated_at = ?2",
            params![it.id, it.updated_at],
        )
        .map_err(|e| e.to_string())?;
    }
    tx.commit().map_err(|e| e.to_string())
}

/// Intègre les rendus du serveur : une version distante ne remplace la locale que si elle est plus récente.
/// Renvoie le nombre de rendus modifiés localement.
#[tauri::command]
fn apply_server_rendus(state: State<'_, DbState>, items: Vec<SyncRendu>) -> Result<usize, String> {
    let mut conn = state.0.lock().map_err(|e| e.to_string())?;
    let tx = conn.transaction().map_err(|e| e.to_string())?;
    let mut changed = 0;
    for it in items {
        changed += tx
            .execute(
                "INSERT INTO rendus (id, title, date, status, substance, content, analysis_id, updated_at, deleted, synced)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 1)
                 ON CONFLICT(id) DO UPDATE SET
                    title=excluded.title,
                    date=excluded.date,
                    status=excluded.status,
                    substance=excluded.substance,
                    content=excluded.content,
                    analysis_id=excluded.analysis_id,
                    updated_at=excluded.updated_at,
                    deleted=excluded.deleted,
                    synced=1
                 WHERE excluded.updated_at > rendus.updated_at",
                params![
                    it.id,
                    it.title,
                    it.date.unwrap_or_default(),
                    it.status.unwrap_or_else(|| "EN_ATTENTE".to_string()),
                    it.substance.unwrap_or_default(),
                    it.content.unwrap_or_default(),
                    it.analysis_id,
                    it.updated_at,
                    it.deleted as i64
                ],
            )
            .map_err(|e| e.to_string())?;
    }
    tx.commit().map_err(|e| e.to_string())?;
    Ok(changed)
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
    // Suppression « logique » : la trace est envoyée au serveur pour supprimer le rendu sur les autres appareils
    conn.execute(
        "UPDATE rendus SET deleted = 1, synced = 0, updated_at = ?2 WHERE id = ?1",
        params![id, now_ms()],
    )
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

/// Appelle l'API du VPS pour l'assistant IA : la clé Gemini et la clé d'accès IA
/// ne sont vérifiées que côté serveur (le code du logiciel est public).
async fn ai_post(
    server_url: &str,
    path: &str,
    ia_key: &str,
    body: serde_json::Value,
    timeout_secs: u64,
) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::builder()
        .connect_timeout(std::time::Duration::from_secs(8))
        .timeout(std::time::Duration::from_secs(timeout_secs))
        .build()
        .map_err(|e| e.to_string())?;

    let url = format!("{}{}", server_url.trim_end_matches('/'), path);
    let res = client
        .post(&url)
        .header("x-ia-key", ia_key)
        .json(&body)
        .send()
        .await
        .map_err(|e| {
            if e.is_timeout() || e.is_connect() {
                format!("Serveur injoignable ({}). Vérifiez l'adresse dans les paramètres.", url)
            } else {
                e.to_string()
            }
        })?;

    let status = res.status();
    let json: serde_json::Value = res.json().await.unwrap_or(serde_json::Value::Null);
    if !status.is_success() {
        let msg = json["error"].as_str().unwrap_or("réponse invalide du serveur");
        return Err(format!("{} ({})", msg, status.as_u16()));
    }
    Ok(json)
}

#[tauri::command]
async fn verify_ia_key(server_url: String, ia_key: String) -> Result<bool, String> {
    match ai_post(&server_url, "/ai/verify", &ia_key, serde_json::json!({}), 15).await {
        Ok(_) => Ok(true),
        Err(e) if e.ends_with("(401)") => Ok(false),
        Err(e) => Err(e),
    }
}

#[tauri::command]
async fn call_gemini(prompt: String, server_url: String, ia_key: String) -> Result<String, String> {
    let json = ai_post(
        &server_url,
        "/ai/generate",
        &ia_key,
        serde_json::json!({ "prompt": prompt }),
        100,
    )
    .await?;

    json["text"]
        .as_str()
        .map(|s| s.to_string())
        .ok_or_else(|| "Impossible d'extraire le texte généré de la réponse du serveur".to_string())
}

/// Proxy les appels HTTP vers l'API Recueil depuis Rust (évite le Mixed Content WebView2 en production).
#[tauri::command]
async fn recueil_fetch(
    url: String,
    method: String,
    api_key: String,
    api_password: String,
    username: String,
    owner: Option<String>,
    body: Option<String>,
) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::builder()
        .connect_timeout(std::time::Duration::from_secs(8))
        .timeout(std::time::Duration::from_secs(20))
        .build()
        .map_err(|e| e.to_string())?;

    let req = match method.to_uppercase().as_str() {
        "POST" => client.post(&url),
        "PUT" => client.put(&url),
        "DELETE" => client.delete(&url),
        _ => client.get(&url),
    };

    let req = req
        .header("Content-Type", "application/json")
        .header("x-api-key", &api_key)
        .header("x-api-password", &api_password)
        .header("x-username", &username);

    let req = match owner {
        Some(o) => req.header("x-owner", o),
        None => req,
    };

    let req = if let Some(b) = body {
        req.body(b)
    } else {
        req
    };

    let res = req.send().await.map_err(|e| {
        if e.is_timeout() || e.is_connect() {
            format!(
                "Serveur du Recueil injoignable ({}). Vérifiez l'adresse dans les paramètres, ou si votre réseau (entreprise, école, VPN) bloque le port utilisé.",
                url
            )
        } else {
            e.to_string()
        }
    })?;

    let status = res.status();
    if status == 401 {
        return Err("Identifiants incorrects (mot de passe du Recueil refusé).".to_string());
    }
    if !status.is_success() {
        let err_text = res.text().await.unwrap_or_default();
        return Err(format!("Erreur API: {} {}", status.as_u16(), err_text));
    }

    res.json::<serde_json::Value>().await.map_err(|e| e.to_string())
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

            // Synchronisation avec le serveur : les rendus déjà présents sont marqués « à envoyer » (synced = 0),
            // ce qui rend l'envoi rétroactif au premier lancement de cette version.
            add_column_if_missing(&conn, "rendus", "updated_at", "INTEGER NOT NULL DEFAULT 0")
                .expect("failed to migrate rendus.updated_at");
            add_column_if_missing(&conn, "rendus", "deleted", "INTEGER NOT NULL DEFAULT 0")
                .expect("failed to migrate rendus.deleted");
            add_column_if_missing(&conn, "rendus", "synced", "INTEGER NOT NULL DEFAULT 0")
                .expect("failed to migrate rendus.synced");
            conn.execute(
                "UPDATE rendus SET updated_at = ?1 WHERE updated_at = 0",
                params![now_ms()],
            )
            .expect("failed to initialize rendus.updated_at");

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
            list_rendus_to_sync,
            mark_rendus_synced,
            apply_server_rendus,
            publish_to_forum,
            call_gemini,
            verify_ia_key,
            recueil_fetch,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
