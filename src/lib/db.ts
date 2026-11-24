// ─── IndexedDB — Esquema relacional cliente (idb wrapper) ──────────────────
// Store `tracks`: metadatos + audioBlob indexados por `id`.
// Store `playlists`: objetos ligeros con `trackIds: string[]` (solo refs).
// NUNCA se duplican Blobs dentro de playlists.

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { TrackRecord, TrackMetadata, Playlist } from '@/types/music';

// ─── Schema ─────────────────────────────────────────────────────────────────
interface MusicDB extends DBSchema {
  tracks: {
    key: string;
    value: TrackRecord;
    indexes: {
      'by-title': string;
      'by-artist': string;
      'by-album': string;
      'by-createdAt': number;
    };
  };
  playlists: {
    key: string;
    value: Playlist;
    indexes: {
      'by-name': string;
      'by-createdAt': number;
    };
  };
}

// ─── Database Singleton ─────────────────────────────────────────────────────
const DB_NAME = 'spotify-local-pwa';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<MusicDB>> | null = null;

function getDB(): Promise<IDBPDatabase<MusicDB>> {
  if (!dbPromise) {
    dbPromise = openDB<MusicDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // ── Tracks Store ──
        if (!db.objectStoreNames.contains('tracks')) {
          const trackStore = db.createObjectStore('tracks', { keyPath: 'id' });
          trackStore.createIndex('by-title', 'title');
          trackStore.createIndex('by-artist', 'artist');
          trackStore.createIndex('by-album', 'album');
          trackStore.createIndex('by-createdAt', 'createdAt');
        }

        // ── Playlists Store ──
        if (!db.objectStoreNames.contains('playlists')) {
          const playlistStore = db.createObjectStore('playlists', { keyPath: 'id' });
          playlistStore.createIndex('by-name', 'name');
          playlistStore.createIndex('by-createdAt', 'createdAt');
        }
      },
    });
  }
  return dbPromise;
}

// ─── Track CRUD ─────────────────────────────────────────────────────────────

/** Guarda un TrackRecord completo (metadatos + audioBlob) en IndexedDB. */
export async function addTrack(track: TrackRecord): Promise<void> {
  const db = await getDB();
  await db.put('tracks', track);
}

/** Recupera el registro completo (incluido audioBlob) — SOLO al reproducir. */
export async function getTrackRecord(id: string): Promise<TrackRecord | undefined> {
  const db = await getDB();
  return db.get('tracks', id);
}

/**
 * Recupera únicamente los metadatos ligeros de una pista (sin audioBlob).
 * Ideal para listar en la UI sin saturar la RAM.
 */
export async function getTrackMetadata(id: string): Promise<TrackMetadata | undefined> {
  const record = await getTrackRecord(id);
  if (!record) return undefined;

  // Desestructurar para excluir audioBlob del resultado
  const { audioBlob: _, ...metadata } = record;
  return metadata;
}

/** Devuelve todos los metadatos de tracks (sin audioBlob) ordenados por createdAt desc. */
export async function getAllTrackMetadata(): Promise<TrackMetadata[]> {
  const db = await getDB();
  const allRecords = await db.getAllFromIndex('tracks', 'by-createdAt');

  return allRecords
    .map(({ audioBlob: _, ...metadata }) => metadata)
    .reverse(); // Más recientes primero
}

/** Devuelve metadatos de un lote de tracks por sus IDs (preserva el orden). */
export async function getTrackMetadataBatch(ids: string[]): Promise<TrackMetadata[]> {
  const db = await getDB();
  const tx = db.transaction('tracks', 'readonly');
  const store = tx.objectStore('tracks');

  const results: TrackMetadata[] = [];
  for (const id of ids) {
    const record = await store.get(id);
    if (record) {
      const { audioBlob: _, ...metadata } = record;
      results.push(metadata);
    }
  }

  await tx.done;
  return results;
}

/** Elimina una pista de IndexedDB (libera el Blob de la DB). */
export async function deleteTrack(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('tracks', id);
}

/** Devuelve el número total de pistas importadas. */
export async function getTrackCount(): Promise<number> {
  const db = await getDB();
  return db.count('tracks');
}

// ─── Playlist CRUD ──────────────────────────────────────────────────────────

/** Crea o actualiza una playlist (solo referencias por ID, sin Blobs de tracks). */
export async function savePlaylist(playlist: Playlist): Promise<void> {
  const db = await getDB();
  await db.put('playlists', playlist);
}

/** Recupera una playlist por su ID. */
export async function getPlaylist(id: string): Promise<Playlist | undefined> {
  const db = await getDB();
  return db.get('playlists', id);
}

/** Devuelve todas las playlists ordenadas por createdAt descendente. */
export async function getAllPlaylists(): Promise<Playlist[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex('playlists', 'by-createdAt');
  return all.reverse();
}

/** Elimina una playlist (no elimina las pistas referenciadas). */
export async function deletePlaylist(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('playlists', id);
}

/** Añade un trackId al final de una playlist existente (si no está ya). */
export async function addTrackToPlaylist(playlistId: string, trackId: string): Promise<void> {
  const db = await getDB();
  const playlist = await db.get('playlists', playlistId);
  if (!playlist) return;

  if (!playlist.trackIds.includes(trackId)) {
    playlist.trackIds.push(trackId);
    await db.put('playlists', playlist);
  }
}

/** Elimina un trackId de una playlist existente. */
export async function removeTrackFromPlaylist(playlistId: string, trackId: string): Promise<void> {
  const db = await getDB();
  const playlist = await db.get('playlists', playlistId);
  if (!playlist) return;

  playlist.trackIds = playlist.trackIds.filter((id) => id !== trackId);
  await db.put('playlists', playlist);
}
