---
name: pwa-ios-audio-guard
description: Controla la reproduccion de audio HTML5, la gestion de memoria de archivos Blob, la integracion con MediaSession API y la compatibilidad PWA offline en iOS Safari. Usala siempre que crees o modifiques el controlador de audio, la lectura de archivos MP3 desde IndexedDB, los controles de pantalla de bloqueo, el Service Worker o el manifest.json.
---
# PWA iOS Audio Guard

Garantiza una reproduccion de audio local continua en segundo plano, sin fugas de memoria RAM (Memory Leaks) y respetando las restricciones de WebKit en dispositivos iOS.

## Cuando usarla

- Al implementar o modificar el servicio reproductor de audio (`src/lib/audioController.ts`).
- Al convertir `Blob` de IndexedDB en URLs reproducibles (`URL.createObjectURL`).
- Al configurar la `navigator.mediaSession` API para la pantalla de bloqueo y Dynamic Island en iOS.
- Al configurar el `manifest.json`, los meta tags de PWA para Apple o las areas seguras (`safe-area-inset`).

## Pasos y arquitectura

### 1. Aislar el reproductor con el patron Singleton

Implementa una unica instancia global de `HTMLAudioElement` dentro de un modulo TypeScript puro (`src/lib/audioController.ts`), completamente fuera del arbol de renderizado de React.

- Nunca renderices etiquetas `<audio>` dentro de componentes `.tsx`: si un componente se desmonta al cambiar entre el Mini-Player y la vista a pantalla completa, la musica se cortara.
- Conecta los eventos nativos (`ended`, `timeupdate`, `loadedmetadata`, `error`) directamente a las acciones de `usePlayerStore`.

### 2. Gestionar el ciclo de vida de ObjectURLs (Cero Memory Leaks)

En iOS Safari, la memoria RAM asignada a una PWA es limitada. No liberar los objetos binarios provoca que el sistema operativo cierre la aplicacion tras reproducir varias canciones.

1. Guarda una referencia privada `currentAudioObjectUrl: string | null` en el controlador de audio.
2. Antes de cargar un nuevo `audioBlob` con `URL.createObjectURL(blob)`, verifica si existe `currentAudioObjectUrl` y ejecuta obligatoriamente `URL.revokeObjectURL(currentAudioObjectUrl)`.
3. Aplica la misma limpieza para las caratulas (`coverBlob`) cuando dejen de mostrarse en pantalla.

### 3. Sincronizar con MediaSession API para segundo plano en iOS

Para que iOS no suspenda el hilo de audio al bloquear la pantalla, registra y actualiza `navigator.mediaSession` en cada cambio de pista.

- Actualiza `navigator.mediaSession.metadata` con `title`, `artist`, `album` y `artwork`.
- Registra los handlers `play`, `pause`, `previoustrack`, `nexttrack` y `seekto` vinculandolos directamente a las funciones del `audioController` y `usePlayerStore`.
- Al cambiar de cancion en el evento `ended`, ejecuta la transicion a la siguiente pista de forma sincrona dentro del mismo ciclo del evento para mantener vivo el permiso de reproduccion en segundo plano de iOS.

### 4. Configurar el entorno PWA para iOS

- Incluye en el layout raiz las propiedades `viewport-fit=cover` y `apple-mobile-web-app-capable="yes"`.
- Aplica `padding-bottom: env(safe-area-inset-bottom)` en la barra de navegacion inferior para evitar que quede solapada por el indicador de inicio del iPhone.

## Errores comunes a evitar

- Usar `AudioContext` (Web Audio API) o `GainNode` para controlar el volumen: en iOS el volumen de un elemento de audio es controlado exclusivamente por los botones fisicos del hardware, y enrutar el audio por un `AudioContext` suele silenciar la reproduccion al bloquear la pantalla.
- Controlar `audio.play()` y `audio.pause()` mediante `useEffect` reactivos en componentes visuales: genera condiciones de carrera (`AbortError: The play() request was interrupted`). Ejecuta siempre las ordenes de reproduccion desde el controlador Singleton.
- Intentar reproducir audio sin interaccion previa del usuario: la primera llamada a `audio.play()` debe originarse siempre dentro de un evento `onClick` o `onTouchEnd` directo del usuario.
