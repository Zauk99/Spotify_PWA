// ─── Spotify Local PWA — Contratos de Datos (Type-Driven) ───────────────────
// Todas las interfaces son el contrato único entre IndexedDB, Zustand y la UI.
// NO usar `any`. NO duplicar Blobs fuera de IndexedDB.

// ─── Repeat Mode ────────────────────────────────────────────────────────────
/** Comportamiento al llegar al final de la cola de contexto. */
export type RepeatMode = 'off' | 'context' | 'track';

// ─── Track ──────────────────────────────────────────────────────────────────
/** Metadatos ligeros de una canción (sin el binario de audio). */
export interface TrackMetadata {
  /** UUID v4 generado al importar el archivo. */
  readonly id: string;
  title: string;
  artist: string;
  album: string;
  /** Duración en segundos. */
  duration: number;
  /** Carátula extraída del MP3 (puede faltar). */
  coverBlob?: Blob;
  /** Timestamp de importación (Date.now()). */
  createdAt: number;
}

/**
 * Registro completo almacenado en IndexedDB (store `tracks`).
 * Extiende los metadatos añadiendo el archivo binario MP3.
 * Solo debe cargarse en memoria cuando la pista va a reproducirse.
 */
export interface TrackRecord extends TrackMetadata {
  /** Blob del archivo MP3 original. */
  audioBlob: Blob;
}

// ─── Playlist ───────────────────────────────────────────────────────────────
/** Referencia ligera a un conjunto ordenado de pistas (sin duplicar Blobs). */
export interface Playlist {
  readonly id: string;
  name: string;
  description?: string;
  /** Carátula personalizada de la playlist (opcional). */
  coverBlob?: Blob;
  /** Array ordenado de IDs de TrackRecord. NUNCA objetos Track completos. */
  trackIds: string[];
  createdAt: number;
}

// ─── Player State ───────────────────────────────────────────────────────────
/** Estado completo del reproductor gestionado por Zustand. */
export interface PlayerState {
  // ── Pista activa ──
  currentTrackId: string | null;
  /** Metadatos cacheados de la pista activa (sin audioBlob). */
  currentTrackMeta: TrackMetadata | null;
  isPlaying: boolean;

  // ── Progreso ──
  /** Posición actual de reproducción en segundos. */
  currentTime: number;
  /** Duración total de la pista activa en segundos. */
  duration: number;

  // ── Doble Cola ──
  /** Cola prioritaria FIFO — canciones añadidas manualmente. */
  userQueue: string[];
  /** Cola secundaria — pistas de la playlist/álbum activo. */
  contextQueue: string[];
  /** Respaldo del orden original para restaurar al desactivar shuffle. */
  originalContextQueue: string[];

  // ── Modos ──
  shuffle: boolean;
  repeatMode: RepeatMode;
}

// ─── Player Actions ─────────────────────────────────────────────────────────
/** Acciones que mutan el PlayerState. Separadas para claridad en Zustand. */
export interface PlayerActions {
  // ── Reproducción ──
  /** Inicia la reproducción de una pista por su ID. */
  playTrack: (trackId: string) => Promise<void>;
  /** Alterna Play / Pause. */
  togglePlayPause: () => void;
  /** Avanza a la siguiente pista respetando la jerarquía de colas. */
  playNext: () => Promise<void>;
  /** Retrocede a la pista anterior o reinicia la actual (< 3 s). */
  playPrevious: () => Promise<void>;
  /** Busca una posición concreta en la pista (seek). */
  seekTo: (time: number) => void;

  // ── Cola ──
  /** Encola una pista al final de userQueue. */
  addToQueue: (trackId: string) => void;
  /** Elimina una pista de userQueue por su índice. */
  removeFromQueue: (index: number) => void;
  /** Reordena userQueue moviendo un elemento. */
  reorderQueue: (fromIndex: number, toIndex: number) => void;
  /** Carga una playlist/álbum como contexto de reproducción. */
  setContextQueue: (trackIds: string[], startIndex?: number) => Promise<void>;

  // ── Modos ──
  /** Alterna shuffle (baraja/restaura solo contextQueue). */
  toggleShuffle: () => void;
  /** Cicla el modo de repetición: off → context → track → off. */
  cycleRepeatMode: () => void;

  // ── Sincronización interna (desde audioController) ──
  /** Actualiza currentTime (llamado por timeupdate del audio). */
  _setCurrentTime: (time: number) => void;
  /** Actualiza duration (llamado por loadedmetadata del audio). */
  _setDuration: (duration: number) => void;
  /** Marca la pista como terminada (llamado por ended). */
  _onTrackEnded: () => Promise<void>;
  /** Establece metadatos de la pista actual en el store. */
  _setCurrentTrackMeta: (meta: TrackMetadata | null) => void;
  /** Fuerza el estado isPlaying (sincronización con audio real). */
  _setIsPlaying: (playing: boolean) => void;
}
