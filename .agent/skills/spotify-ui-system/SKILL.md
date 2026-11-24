---
name: spotify-ui-system
description: Define el sistema de diseño visual, paleta de colores OLED, tipografia, estructura mobile-first y componentes de interfaz inspirados en Spotify. Usala siempre que crees o estilices vistas, pantallas, tarjetas de playlists, listados de canciones, el Mini-Player, la barra de navegacion inferior o estilos con Tailwind CSS.
---
# Spotify UI System

Aplica una ingenieria de interfaz limpia, sobria y fiel a la experiencia movil de Spotify, evitando los patrones visuales genericos de IA (AI Slop).

## Cuando usarla

- Al crear o modificar cualquier componente visual en `src/components/` o vistas en `src/app/`.
- Al definir variables de tema en Tailwind CSS o `globals.css`.
- Al diseñar las listas de canciones, cabeceras de playlists, el reproductor minimizado (`MiniPlayer`) o la vista a pantalla completa (`FullScreenPlayer`).

## Pasos y arquitectura

### 1. Aplicar Design Tokens estrictos (Paleta Spotify Dark/OLED)

Usa exclusivamente esta jerarquia cromatica mediante variables CSS o clases exactas de Tailwind:

- Fondo base de aplicacion (`bg-base`): `#121212` (o `#000000` en modo OLED puro).
- Superficie elevada / Tarjetas / Mini-Player (`bg-surface`): `#181818` y `#242424` en estado activo/hover.
- Superficie flotante / Modales / Bottom Sheets (`bg-elevated`): `#282828`.
- Color de acento primario (`accent`): `#1DB954` (usado con moderacion: boton principal de Play, indicador de cancion activa en lista, icono de Shuffle/Repeat activo).
- Texto primario: `#FFFFFF` (titulos, controles principales).
- Texto secundario: `#B3B3B3` (artistas, duraciones, subtitulos, iconos inactivos).

### 2. Estructurar el Layout Mobile-First sin Scroll Roto

El contenedor principal debe funcionar como una aplicacion nativa a pantalla fija (`100dvh`, `overflow-hidden`), dividido en tres capas verticales:

1. Area de contenido principal (`flex-1 overflow-y-auto`): unico contenedor con scroll vertical para explorar playlists y canciones.
2. `MiniPlayer` flotante: posicionado justo encima de la barra de navegacion (`h-14`, bordes redondeados `rounded-md`, `mx-2`), con caratula miniatura, titulo/artista, boton Play/Pause y una barra de progreso inferior de `2px` de grosor.
3. `BottomNav` fija: barra inferior con fondo semitransparente oscuro y desenfoque (`backdrop-blur-md bg-black/85`), respetando `env(safe-area-inset-bottom)`.

### 3. Ergonomia tactil (Thumb-Zone) y Densidad de Informacion

- Todo boton interactivo (Play, Pause, Añadir a la cola, Menu de tres puntos) debe tener un area tactil minima de `44x44px` (`min-w-[44px] min-h-[44px] flex items-center justify-center`).
- Los titulos de canciones y nombres de artistas en listados deben usar siempre `truncate` (`overflow-hidden text-ellipsis whitespace-nowrap`) para nunca romper la fila en dos lineas ni empujar los iconos laterales.
- Resalta la cancion que esta sonando actualmente (`currentTrackId`) cambiando el color de su titulo a `#1DB954`.

### 4. Degradado Ambiental Dinamico (Ambient Background)

En la cabecera de las playlists y en la vista `FullScreenPlayer`, extrae el color dominante de la caratula activa (mediante un `<canvas>` oculto de 1x1px o color promedio) y aplica un degradado suave en la parte superior (`linear-gradient(to bottom, var(--ambient-color), #121212)`) para lograr profundidad visual sin saturar.

## Errores comunes a evitar (Anti-AI Slop)

- Prohibido usar degradados morados, azules neon o rosas genericos, sombras brillantes (`shadow-purple-500/50`) o bordes gruesos llamativos.
- Prohibido crear componentes monoliticos de mas de 200 lineas: divide siempre en subcomponentes pequeños (`TrackRow`, `PlaylistHeader`, `QueueItem`, `ProgressBar`).
- Nunca uses `100vh` en movil: usa siempre `100dvh` (Dynamic Viewport Height) para evitar saltos de pantalla en Safari iOS.
