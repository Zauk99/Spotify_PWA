// ─── usePlayerStore — Motor de Doble Cola (Zustand) ────────────────────────
// Réplica del sistema de colas de Spotify:
// • userQueue (FIFO prioritaria) — canciones encoladas manualmente.
// • contextQueue (secundaria) — playlist/álbum activo.
// NUNCA se almacenan Blobs aquí. Solo IDs (string).

'use client';

import { create } from 'zustand';
import type { PlayerState, PlayerActions, TrackMetadata, RepeatMode } from '@/types/music';
import { getTrackMetadata, getTrackRecord } from '@/lib/db';

// ─── Fisher-Yates Shuffle ───────────────────────────────────────────────────
function fisherYatesShuffle<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// ─── Estado inicial ─────────────────────────────────────────────────────────
const initialState: PlayerState = {
  currentTrackId: null,
  currentTrackMeta: null,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  userQueue: [],
  contextQueue: [],
  originalContextQueue: [],
  shuffle: false,
  repeatMode: 'off',
};

// ─── Helpers internos ───────────────────────────────────────────────────────

/**
 * Carga y reproduce una pista: obtiene metadatos, actualiza el store,
 * y delega la reproducción real al audioController (importado dinámicamente
 * para evitar dependencias circulares y problemas SSR).
 */
async function loadAndPlayTrack(
  trackId: string,
  set: (partial: Partial<PlayerState>) => void,
): Promise<void> {
  const meta = await getTrackMetadata(trackId);
  if (!meta) return;

  set({
    currentTrackId: trackId,
    currentTrackMeta: meta,
    currentTime: 0,
    duration: meta.duration,
    isPlaying: true,
  });

  // Import dinámico para romper la dependencia circular store ↔ audioController
  const { loadTrack } = await import('@/lib/audioController');
  const record = await getTrackRecord(trackId);
  if (record) {
    await loadTrack(record.audioBlob, meta);
  }
}

// ─── Store ──────────────────────────────────────────────────────────────────
export const usePlayerStore = create<PlayerState & PlayerActions>()((set, get) => ({
  ...initialState,

  // ═══════════════════════════════════════════════════════════════════════════
  // REPRODUCCIÓN
  // ═══════════════════════════════════════════════════════════════════════════

  async playTrack(trackId: string) {
    await loadAndPlayTrack(trackId, set);
  },

  togglePlayPause() {
    const { isPlaying, currentTrackId } = get();
    if (!currentTrackId) return;

    // Delegar al audioController sin import dinámico en esta path caliente;
    // el controlador ya estará importado tras el primer playTrack.
    import('@/lib/audioController').then(({ togglePlayback }) => {
      togglePlayback();
    });

    set({ isPlaying: !isPlaying });
  },

  async playNext() {
    const { userQueue, contextQueue, repeatMode, currentTrackId } = get();

    // 1. Cola prioritaria: userQueue
    if (userQueue.length > 0) {
      const [nextId, ...restUserQueue] = userQueue;
      set({ userQueue: restUserQueue });
      await loadAndPlayTrack(nextId, set);
      return;
    }

    // 2. Cola de contexto: contextQueue
    if (contextQueue.length > 0) {
      const [nextId, ...restContextQueue] = contextQueue;
      set({ contextQueue: restContextQueue });
      await loadAndPlayTrack(nextId, set);
      return;
    }

    // 3. Ambas colas vacías — evaluar repeatMode
    if (repeatMode === 'track' && currentTrackId) {
      // Repetir la misma pista
      await loadAndPlayTrack(currentTrackId, set);
      return;
    }

    if (repeatMode === 'context') {
      // Restaurar la cola de contexto completa y volver al inicio
      const { originalContextQueue, shuffle } = get();
      const restored = shuffle
        ? fisherYatesShuffle(originalContextQueue)
        : [...originalContextQueue];

      if (restored.length > 0) {
        const [nextId, ...rest] = restored;
        set({ contextQueue: rest });
        await loadAndPlayTrack(nextId, set);
        return;
      }
    }

    // repeatMode === 'off' y no hay más pistas → parar
    set({ isPlaying: false, currentTime: 0 });
    import('@/lib/audioController').then(({ stopPlayback }) => {
      stopPlayback();
    });
  },

  async playPrevious() {
    const { currentTime, currentTrackId, originalContextQueue } = get();

    // Si han pasado más de 3 segundos, reiniciar la pista actual
    if (currentTime > 3 && currentTrackId) {
      const { seekTo } = await import('@/lib/audioController');
      seekTo(0);
      set({ currentTime: 0 });
      return;
    }

    // Si no, buscar la pista anterior en originalContextQueue
    if (currentTrackId && originalContextQueue.length > 0) {
      const currentIndex = originalContextQueue.indexOf(currentTrackId);
      if (currentIndex > 0) {
        const prevId = originalContextQueue[currentIndex - 1];
        await loadAndPlayTrack(prevId, set);
        return;
      }
    }

    // No hay pista anterior — reiniciar la actual
    if (currentTrackId) {
      const { seekTo } = await import('@/lib/audioController');
      seekTo(0);
      set({ currentTime: 0 });
    }
  },

  seekTo(time: number) {
    import('@/lib/audioController').then(({ seekTo }) => {
      seekTo(time);
    });
    set({ currentTime: time });
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // COLA
  // ═══════════════════════════════════════════════════════════════════════════

  addToQueue(trackId: string) {
    set((state) => ({ userQueue: [...state.userQueue, trackId] }));
  },

  removeFromQueue(index: number) {
    set((state) => ({
      userQueue: state.userQueue.filter((_, i) => i !== index),
    }));
  },

  reorderQueue(fromIndex: number, toIndex: number) {
    set((state) => {
      const queue = [...state.userQueue];
      const [moved] = queue.splice(fromIndex, 1);
      queue.splice(toIndex, 0, moved);
      return { userQueue: queue };
    });
  },

  async setContextQueue(trackIds: string[], startIndex = 0) {
    const { shuffle } = get();

    // Guardar el orden original siempre
    const original = [...trackIds];

    // La pista en startIndex es la que se reproduce ahora
    const trackToPlay = trackIds[startIndex];
    // contextQueue = todo lo que viene después de la pista actual
    const remaining = trackIds.filter((_, i) => i !== startIndex);

    const context = shuffle ? fisherYatesShuffle(remaining) : remaining;

    set({
      originalContextQueue: original,
      contextQueue: context,
      userQueue: [], // Limpiar userQueue al cambiar de contexto (comportamiento Spotify)
    });

    if (trackToPlay) {
      await loadAndPlayTrack(trackToPlay, set);
    }
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // MODOS
  // ═══════════════════════════════════════════════════════════════════════════

  toggleShuffle() {
    const { shuffle, contextQueue, originalContextQueue, currentTrackId } = get();

    if (shuffle) {
      // Desactivar shuffle → restaurar contextQueue desde originalContextQueue
      // Posicionar después de currentTrackId
      const currentIndex = originalContextQueue.indexOf(currentTrackId ?? '');
      const restored =
        currentIndex >= 0
          ? originalContextQueue.slice(currentIndex + 1)
          : [...originalContextQueue];

      set({ shuffle: false, contextQueue: restored });
    } else {
      // Activar shuffle → barajar contextQueue (Fisher-Yates)
      set({
        shuffle: true,
        contextQueue: fisherYatesShuffle(contextQueue),
      });
    }
  },

  cycleRepeatMode() {
    const cycle: Record<RepeatMode, RepeatMode> = {
      off: 'context',
      context: 'track',
      track: 'off',
    };
    set((state) => ({ repeatMode: cycle[state.repeatMode] }));
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // SINCRONIZACIÓN INTERNA (audioController → store)
  // ═══════════════════════════════════════════════════════════════════════════

  _setCurrentTime(time: number) {
    set({ currentTime: time });
  },

  _setDuration(duration: number) {
    set({ duration });
  },

  async _onTrackEnded() {
    const { repeatMode, currentTrackId } = get();

    // repeat track → reproducir la misma pista inmediatamente
    if (repeatMode === 'track' && currentTrackId) {
      await loadAndPlayTrack(currentTrackId, set);
      return;
    }

    // Delegar al flujo normal de playNext
    await get().playNext();
  },

  _setCurrentTrackMeta(meta: TrackMetadata | null) {
    set({ currentTrackMeta: meta });
  },

  _setIsPlaying(playing: boolean) {
    set({ isPlaying: playing });
  },
}));
