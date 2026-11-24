---
name: mobile-60fps-motion
description: Optimiza las animaciones, transiciones desplegables (Bottom Sheets), gestos tactiles (Swipe to Queue, Drag to Reorder) y el rendimiento a 60/120 FPS en dispositivos moviles. Usala siempre que implementes la apertura del reproductor a pantalla completa, el panel de la cola de reproduccion, gestos de deslizar canciones o listas largas.
---
# Mobile 60FPS Motion

Garantiza que todas las transiciones, paneles desplegables y gestos tactiles del reproductor funcionen a 60/120 FPS constantes acelerados por GPU en pantallas moviles.

## Cuando usarla

- Al programar la transicion desplegable entre el `MiniPlayer` y el `FullScreenPlayer`.
- Al implementar el panel deslizable de la cola de reproduccion (`QueueSheet`).
- Al añadir el gesto tactil de deslizar hacia la derecha sobre una cancion para añadirla a la cola (`Swipe to Queue`).
- Al implementar el reordenamiento tactil (`Drag & Drop`) de canciones dentro de la cola o de una playlist.

## Pasos y arquitectura

### 1. Animar exclusivamente propiedades compuestas por GPU

Para evitar que el procesador del telefono recalcule el diseño de la pagina (Layout Thrashing) en cada fotograma, limita cualquier transicion CSS o animacion a tres propiedades:

- `transform: translate3d(x, y, 0)` (para desplazar paneles, hojas desplegables o filas en gestos swipe).
- `transform: scale()` (para el micro-feedback al pulsar botones o portadas).
- `opacity` (para fundidos de entrada y salida).

### 2. Implementar el gesto "Swipe to Queue" en filas de canciones

Cada fila `TrackRow` debe permitir deslizar el dedo horizontalmente hacia la derecha para encolar la cancion en `userQueue`:

1. Detecta `onTouchStart`, `onTouchMove` y `onTouchEnd` diferenciando el desplazamiento horizontal (`deltaX`) del scroll vertical (`deltaY`). Si `Math.abs(deltaY) > Math.abs(deltaX)`, cancela el gesto horizontal para no bloquear el scroll de la lista.
2. Aplica `transform: translate3d(${deltaX}px, 0, 0)` con resistencia elastica hasta un tope maximo de `72px`, revelando debajo un fondo `#1DB954` con el icono de añadir a la cola.
3. Si al soltar el dedo `deltaX >= 56px`, dispara `addToQueue(track.id)` y devuelve la fila a `0px` con una curva suave (`cubic-bezier(0.22, 1, 0.36, 1)`).

### 3. Transicion MiniPlayer a FullScreenPlayer (Bottom Sheet)

El reproductor a pantalla completa debe estar montado y oculto fuera del borde inferior mediante `transform: translate3d(0, 100%, 0)` y pasar a `translate3d(0, 0, 0)` al abrirse.

- Permite cerrarlo arrastrando hacia abajo desde la zona superior del reproductor siguiendo la posicion `Y` del dedo en tiempo real.
- Añade `will-change: transform` unicamente durante la interaccion activa para optimizar la memoria de video en iOS.

### 4. Bloquear rebotes nativos del navegador en iOS

Configura en `globals.css` las reglas necesarias para que los gestos tactiles no activen la recarga de pagina ni la navegacion hacia atras de Safari:

- Aplica `overscroll-behavior-y: none` en `html` y `body`.
- Aplica `touch-action: pan-y` en los contenedores de listas y `touch-action: none` en las barras de progreso (`SeekBar`) y tiradores de arrastre (`DragHandle`).

## Errores comunes a evitar

- Animar `height`, `max-height`, `top`, `bottom` o `margin`: provoca caidas de fotogramas severas en iOS al abrir el reproductor. Usa siempre `transform: translate3d()`.
- Usar `backdrop-filter: blur()` dentro de elementos que se estan moviendo en cada fotograma: calcular el desenfoque en movimiento satura la GPU movil. Aplica `backdrop-blur` solo en barras estaticas (`BottomNav`) y usa fondos solidos (`#121212` o `#181818`) en los paneles deslizables.
- Renderizar mas de 150 nodos complejos con imagenes Blob en el DOM simultaneamente sin virtualizacion o carga perezosa (`loading="lazy"`).
