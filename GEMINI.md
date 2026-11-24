# CONTEXTO DEL PROYECTO: SPOTIFY LOCAL PWA (OFFLINE-FIRST)

## 1. Arquitectura y Stack Cerrado
- **Objetivo:** Reproductor de música local sin conexión ni anuncios con estética y experiencia de usuario de Spotify, optimizado para iOS Safari como PWA.
- **Stack:** Next.js (App Router), TypeScript estricto (`strict: true`), Tailwind CSS, `zustand` (estado global y doble cola), `idb` (IndexedDB relacional), `lucide-react`.
- **Skills Activas Asociadas:**
  1. `zustand-dual-queue`: Separación de metadatos y Blobs en IndexedDB + Doble Cola (`userQueue` FIFO prioritaria y `contextQueue` secundaria).
  2. `pwa-ios-audio-guard`: Controlador `HTMLAudioElement` bajo patrón Singleton fuera de React, limpieza obligatoria con `URL.revokeObjectURL()` y sincronización con `navigator.mediaSession`.
  3. `spotify-ui-system`: Paleta OLED (`#121212`, `#181818`, `#282828`, `#1DB954`), layout `100dvh` sin scroll roto y áreas táctiles mínimas de `44x44px`.
  4. `mobile-60fps-motion`: Animaciones exclusivas por GPU (`translate3d`, `scale`, `opacity`), gesto *Swipe to Queue* y desplegables tipo *Bottom Sheet*.

## 2. Mapa de Archivos Clave y Contratos
- `src/types/music.ts`: Interfaces `TrackMetadata`, `TrackRecord`, `Playlist`, `PlayerState`, `RepeatMode`.
- `src/lib/db.ts`: Configuración de IndexedDB con almacenes separados `tracks` (metadatos + `audioBlob`) y `playlists` (solo referencias `trackIds: string[]`).
- `src/store/usePlayerStore.ts`: Máquina de estados de reproducción (`currentTrackId`, `userQueue`, `contextQueue`, `originalContextQueue`, `isPlaying`, `shuffle`, `repeatMode`).
- `src/lib/audioController.ts`: Instancia única de `Audio`, revocación de `ObjectURL` y controles de pantalla de bloqueo.
- `src/components/player/MiniPlayer.tsx`: Barra flotante inferior con progreso de `2px`.
- `src/components/player/FullScreenPlayer.tsx`: Reproductor desplegable a pantalla completa.
- `src/components/player/QueueSheet.tsx`: Panel de gestión de `userQueue` y `contextQueue`.
- `src/components/library/TrackRow.tsx`: Fila de canción con gesto táctil *Swipe to Queue*.

## 3. Reglas de Respuesta al Continuar en Gemini Web
- Respetar estrictamente los nombres de propiedades e interfaces definidos en `src/types/music.ts`.
- No reescribir archivos completos si solo se corrige una función; devolver únicamente el bloque afectado o el archivo nuevo solicitado.
- Mantener cero dependencias innecesarias y respetar todas las restricciones de memoria de iOS Safari.

## 4. Estado Actual del Desarrollo (Checklist de Progreso)
*(Marca con [x] lo que ya esté funcionando antes de pegar este archivo en el chat)*
- [x] **Fase 1 (Cimientos):** `music.ts`, `db.ts`, `usePlayerStore.ts` y `audioController.ts` creados y compilando sin errores.
- [ ] **Fase 2 (Layout y MiniPlayer):** Estructura `100dvh`, `BottomNav` con `safe-area` y `MiniPlayer` funcional.
- [ ] **Fase 3 (Importador y Biblioteca):** Lectura de archivos MP3 locales, extracción de metadatos/carátulas y listado con `TrackRow` + *Swipe to Queue*.
- [ ] **Fase 4 (FullScreen, Cola y Playlists):** `FullScreenPlayer` desplegable, vista de doble cola `QueueSheet` y CRUD completo de Playlists.
- [ ] **Fase 5 (Cierre MVP y PWA):** Buscador instantáneo, `manifest.json`, Service Worker offline y pruebas táctiles en iOS.

## 5. Tarea Actual / Bug Pendiente
- **Archivo(s) en los que estoy trabajando ahora:** Fase 2 — `src/app/layout.tsx`, `src/app/globals.css`, `src/components/navigation/BottomNav.tsx`, `src/components/player/MiniPlayer.tsx`
- **Qué necesito hacer o qué error me está dando:** Implementar el layout mobile-first `100dvh` con `BottomNav` (safe-area) y `MiniPlayer` flotante funcional conectado a `usePlayerStore`.
