import { invoke } from "@tauri-apps/api/core";
import { recueilApi, getSyncOwner } from "./recueilApi";
import type { SyncRendu } from "./recueilApi";
import { initialRendus } from "../data/mockData";

// Les rendus d'exemple insérés au premier lancement ne sont jamais envoyés au serveur
const MOCK_IDS = new Set(initialRendus.map((r) => r.id));
const PUSH_BATCH_SIZE = 25;

export interface SyncResult {
  pushed: number;
  /** Nombre de rendus modifiés localement par la version du serveur */
  pulled: number;
}

export function canSync(): boolean {
  return !!getSyncOwner() && !!localStorage.getItem("recueilApiPassword");
}

let running: Promise<SyncResult | null> | null = null;

/**
 * Envoie les rendus modifiés localement (y compris, au premier lancement, tous les rendus existants),
 * puis récupère ceux du serveur. Dans les deux sens, la version la plus récente gagne.
 * Renvoie null si la synchronisation n'est pas configurée (pas de compte forum ou de mot de passe du Recueil).
 */
export function syncRendus(): Promise<SyncResult | null> {
  if (!canSync()) return Promise.resolve(null);
  // Une seule synchronisation à la fois
  if (!running) {
    running = doSync().finally(() => {
      running = null;
    });
  }
  return running;
}

async function doSync(): Promise<SyncResult> {
  const pending = (await invoke<SyncRendu[]>("list_rendus_to_sync")).filter((r) => !MOCK_IDS.has(r.id));

  for (let i = 0; i < pending.length; i += PUSH_BATCH_SIZE) {
    const batch = pending.slice(i, i + PUSH_BATCH_SIZE);
    await recueilApi.pushRendus(batch);
    await invoke("mark_rendus_synced", {
      items: batch.map((r) => ({ id: r.id, updatedAt: r.updatedAt })),
    });
  }

  const remote = await recueilApi.getRendus();
  const pulled = await invoke<number>("apply_server_rendus", { items: remote });
  return { pushed: pending.length, pulled };
}
