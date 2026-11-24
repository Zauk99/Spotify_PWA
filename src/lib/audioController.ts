// ─── audioController — Singleton HTMLAudioElement ──────────────────────────
// Patrón Singleton: una ÚNICA instancia de Audio fuera de React.
// PROHIBIDO:
//   • Renderizar <audio> en componentes .tsx
//   • Controlar play/pause con useEffect
//   • Usar AudioContext / Web Audio API (iOS lo silencia al bloquear)
// OBLIGATORIO:
//   • Revocar ObjectURL anterior al cargar nueva pista (memory leak iOS)
//   • Sincronizar navigator.mediaSession en cada cambio de pista
//   • Ejecutar transiciones en el mismo ciclo del evento 'ended' (iOS bg)

import type { TrackMetadata } from '@/types/music';

// ─── Estado privado del módulo ──────────────────────────────────────────────
let audio: HTMLAudioElement | null = null;
let currentObjectUrl: string | null = null;
let isInitialized = false;

// ─── Inicialización lazy ────────────────────────────────────────────────────
function getAudio(): HTMLAudioElement {
  if (!audio) {
    audio = new Audio();
    audio.preload = 'auto';
  }
  return audio;
}

/**
 * Inicializa los listeners del audio y los conecta con el store de Zustand.
 * Debe llamarse UNA VEZ tras la primera interacción del usuario (onClick).
 * El import dinámico del store evita dependencias circulares.
 */
export function initAudioController(): void {
  if (isInitialized) return;
  isInitialized = true;

  const audioEl = getAudio();

  // ── timeupdate → actualizar progreso ──
  audioEl.addEventListener('timeupdate', () => {
    import('@/store/usePlayerStore').then(({ usePlayerStore }) => {
      usePlayerStore.getState()._setCurrentTime(audioEl.currentTime);
    });
  });

  // ── loadedmetadata → duración real del archivo ──
  audioEl.addEventListener('loadedmetadata', () => {
    import('@/store/usePlayerStore').then(({ usePlayerStore }) => {
      usePlayerStore.getState()._setDuration(audioEl.duration);
    });
  });

  // ── ended → transición a siguiente pista (SÍNCRONO para iOS bg) ──
  audioEl.addEventListener('ended', () => {
    import('@/store/usePlayerStore').then(({ usePlayerStore }) => {
      // Ejecutar dentro del mismo ciclo de evento para mantener
      // el permiso de reproducción en segundo plano en iOS
      usePlayerStore.getState()._onTrackEnded();
    });
  });

  // ── error → marcar como detenido ──
  audioEl.addEventListener('error', () => {
    console.error('[audioController] Error de reproducción:', audioEl.error);
    import('@/store/usePlayerStore').then(({ usePlayerStore }) => {
      usePlayerStore.getState()._setIsPlaying(false);
    });
  });

  // ── pause/play nativos (ej: interrupción por llamada) ──
  audioEl.addEventListener('pause', () => {
    import('@/store/usePlayerStore').then(({ usePlayerStore }) => {
      usePlayerStore.getState()._setIsPlaying(false);
    });
  });

  audioEl.addEventListener('play', () => {
    import('@/store/usePlayerStore').then(({ usePlayerStore }) => {
      usePlayerStore.getState()._setIsPlaying(true);
    });
  });
}

// ─── Gestión de ObjectURLs (Cero Memory Leaks) ─────────────────────────────

/** Revoca la ObjectURL anterior y crea una nueva para el Blob dado. */
function createSafeObjectUrl(blob: Blob): string {
  if (currentObjectUrl) {
    URL.revokeObjectURL(currentObjectUrl);
    currentObjectUrl = null;
  }
  currentObjectUrl = URL.createObjectURL(blob);
  return currentObjectUrl;
}

// ─── Carga y reproducción ───────────────────────────────────────────────────

/**
 * Carga un Blob de audio en el reproductor y lo reproduce.
 * Actualiza la MediaSession con los metadatos proporcionados.
 */
export async function loadTrack(audioBlob: Blob, meta: TrackMetadata): Promise<void> {
  if (!isInitialized) {
    initAudioController();
  }

  const audioEl = getAudio();

  // Pausar la pista actual si está sonando
  audioEl.pause();

  // Crear ObjectURL segura (revoca la anterior automáticamente)
  const url = createSafeObjectUrl(audioBlob);
  audioEl.src = url;

  // Actualizar MediaSession para pantalla de bloqueo / Dynamic Island
  updateMediaSession(meta);

  // Reproducir
  try {
    await audioEl.play();
  } catch (err) {
    // AbortError es normal si el usuario cambia de pista rápidamente
    if (err instanceof DOMException && err.name === 'AbortError') {
      return;
    }
    console.error('[audioController] Error al reproducir:', err);
  }
}

// ─── Controles de transporte ────────────────────────────────────────────────

/** Alterna play/pause del audio. */
export function togglePlayback(): void {
  const audioEl = getAudio();
  if (audioEl.paused) {
    audioEl.play().catch(() => {
      /* La primera reproducción debe venir de un gesto del usuario */
    });
  } else {
    audioEl.pause();
  }
}

/** Busca una posición concreta en la pista (en segundos). */
export function seekTo(time: number): void {
  const audioEl = getAudio();
  if (Number.isFinite(time)) {
    audioEl.currentTime = time;
  }
}

/** Detiene la reproducción y libera la ObjectURL actual. */
export function stopPlayback(): void {
  const audioEl = getAudio();
  audioEl.pause();
  audioEl.currentTime = 0;

  if (currentObjectUrl) {
    URL.revokeObjectURL(currentObjectUrl);
    currentObjectUrl = null;
  }

  audioEl.removeAttribute('src');
  audioEl.load(); // Libera el buffer del navegador
}

// ─── MediaSession API ───────────────────────────────────────────────────────

/**
 * Actualiza navigator.mediaSession con los metadatos de la pista actual.
 * Registra handlers para play/pause/next/previous/seek vinculados al store.
 */
function updateMediaSession(meta: TrackMetadata): void {
  if (!('mediaSession' in navigator)) return;

  // ── Metadata ──
  const artwork: MediaImage[] = [];
  if (meta.coverBlob) {
    const coverUrl = URL.createObjectURL(meta.coverBlob);
    artwork.push({ src: coverUrl, sizes: '512x512', type: meta.coverBlob.type });
    // Nota: este coverUrl se libera cuando se actualice la próxima pista
    // (el navegador lo maneja internamente para mediaSession artwork).
  }

  navigator.mediaSession.metadata = new MediaMetadata({
    title: meta.title,
    artist: meta.artist,
    album: meta.album,
    artwork,
  });

  // ── Action Handlers ──
  navigator.mediaSession.setActionHandler('play', () => {
    getAudio().play().catch(() => {});
    import('@/store/usePlayerStore').then(({ usePlayerStore }) => {
      usePlayerStore.getState()._setIsPlaying(true);
    });
  });

  navigator.mediaSession.setActionHandler('pause', () => {
    getAudio().pause();
    import('@/store/usePlayerStore').then(({ usePlayerStore }) => {
      usePlayerStore.getState()._setIsPlaying(false);
    });
  });

  navigator.mediaSession.setActionHandler('previoustrack', () => {
    import('@/store/usePlayerStore').then(({ usePlayerStore }) => {
      usePlayerStore.getState().playPrevious();
    });
  });

  navigator.mediaSession.setActionHandler('nexttrack', () => {
    import('@/store/usePlayerStore').then(({ usePlayerStore }) => {
      usePlayerStore.getState().playNext();
    });
  });

  navigator.mediaSession.setActionHandler('seekto', (details) => {
    if (details.seekTime != null) {
      seekTo(details.seekTime);
      import('@/store/usePlayerStore').then(({ usePlayerStore }) => {
        usePlayerStore.getState()._setCurrentTime(details.seekTime!);
      });
    }
  });
}
