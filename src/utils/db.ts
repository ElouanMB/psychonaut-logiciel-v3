import { invoke } from "@tauri-apps/api/core";
import type { RenduItem, DraftItem } from "../data/mockData";

/** Émis après chaque enregistrement / suppression locale d'un rendu (déclenche la synchronisation) */
export const RENDUS_CHANGED_EVENT = "rendusChanged";

/**
 * Détecte l'identifiant de l'analyse dans le titre ou le contenu.
 * Formats reconnus :
 * - "PSYCHO", "PSY" ou "RDRAD" suivi de chiffres (ex: PSYCHO266372, PSY04129312, RDRAD267949)
 * - Format "20xx-xxxx" (ex: 2026-1687)
 * - Une suite de chiffres d'au moins 5 caractères (ex: 266372)
 */
export function extractAnalysisId(title: string, content: string): string | null {
  // 1. "PSYCHO", "PSY" ou "RDRAD" (insensible à la casse) suivi d'une suite de chiffres
  //    (trois séries distinctes : le préfixe est conservé)
  const psychoRegex = /(?:psycho|psy|rdrad)\d+/i;
  let match = title.match(psychoRegex) || content.match(psychoRegex);
  if (match) {
    return match[0].toUpperCase();
  }

  // 2. Format 20xx-xxxx (ex: 2026-1234)
  const yearFormatRegex = /\b20\d{2}-\d{4,}\b/;
  match = title.match(yearFormatRegex) || content.match(yearFormatRegex);
  if (match) {
    return match[0];
  }

  // 3. Suite de chiffres seule (au moins 5 chiffres)
  const digitsRegex = /\b\d{5,}\b/;
  match = title.match(digitsRegex) || content.match(digitsRegex);
  if (match) {
    return match[0];
  }

  return null;
}

export async function dbLoadData(): Promise<{ rendus: RenduItem[]; drafts: DraftItem[] }> {
  try {
    const data = await invoke<{ rendus: RenduItem[]; drafts: DraftItem[] }>("load_data");
    return data;
  } catch (error) {
    console.error("Erreur lors du chargement des données SQLite:", error);
    return { rendus: [], drafts: [] };
  }
}

export async function dbSaveRendu(rendu: RenduItem): Promise<void> {
  try {
    // Injecter l'analysisId détecté automatiquement à chaque sauvegarde
    const analysisId = extractAnalysisId(rendu.title, rendu.content);
    const updatedRendu = { ...rendu, analysisId };
    await invoke("save_rendu", { item: updatedRendu });
    window.dispatchEvent(new Event(RENDUS_CHANGED_EVENT));
  } catch (error) {
    console.error(`Erreur lors de la sauvegarde du rendu ${rendu.id} :`, error);
  }
}

export async function dbSaveDraft(draft: DraftItem): Promise<void> {
  try {
    await invoke("save_draft", { item: draft });
  } catch (error) {
    console.error(`Erreur lors de la sauvegarde du brouillon ${draft.id} :`, error);
  }
}

export async function dbDeleteRendu(id: string): Promise<void> {
  try {
    await invoke("delete_rendu", { id });
    window.dispatchEvent(new Event(RENDUS_CHANGED_EVENT));
  } catch (error) {
    console.error(`Erreur lors de la suppression du rendu ${id} :`, error);
  }
}

export async function dbDeleteDraft(id: string): Promise<void> {
  try {
    await invoke("delete_draft", { id });
  } catch (error) {
    console.error(`Erreur lors de la suppression du brouillon ${id} :`, error);
  }
}

/**
 * Ouvre l'URL du forum dans le navigateur par défaut du système.
 */
export async function dbPublishToForum(url: string): Promise<void> {
  try {
    await invoke("publish_to_forum", { url });
  } catch (error) {
    console.error("Erreur publish_to_forum:", error);
  }
}
