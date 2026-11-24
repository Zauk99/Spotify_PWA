---
name: zustand-dual-queue
description: Diseña y audita la arquitectura de datos en IndexedDB y el motor de estado global con Zustand para un reproductor de musica local estilo Spotify en Next.js y TypeScript. Usala siempre que crees o modifiques interfaces de canciones y playlists, operaciones CRUD en IndexedDB o la logica de la doble cola de reproduccion (userQueue, contextQueue, shuffle y repeat).
---
# Zustand Dual Queue

Establece los contratos de TypeScript, el esquema relacional en IndexedDB y la maquina de estados de doble cola en Zustand para un reproductor de musica local sin conexion.

## Cuando usarla

- Al definir o modificar las interfaces principales en TypeScript (`TrackMetadata`, `TrackRecord`, `Playlist`, `PlayerState`, `RepeatMode`).
- Al implementar o auditar el almacenamiento local con `idb` (IndexedDB) para canciones y listas de reproduccion.
- Al programar la logica de transicion de canciones (`playNext`, `playPrevious`), encolado manual (`addToQueue`) y modos `shuffle` o `repeat` en Zustand.

## Pasos y arquitectura

### 1. Definir contratos de datos estrictos (Type-Driven)

Crea las interfaces separando los metadatos ligeros de los archivos binarios pesados (`Blob`). Esto evita cargar megabytes innecesarios en la memoria RAM de React o Zustand.

- Define `TrackMetadata` con `id: string`, `title: string`, `artist: string`, `album: string`, `duration: number`, `coverBlob?: Blob` y `createdAt: number`.
- Define `TrackRecord` extendiendo `TrackMetadata` con `audioBlob: Blob` exclusivamente para el almacen fisico de IndexedDB.
- Define `Playlist` con `id: string`, `name: string`, `description?: string`, `coverBlob?: Blob`, `trackIds: string[]` y `createdAt: number`.

### 2. Estructurar IndexedDB de forma relacional

Configura dos almacenes (`Object Stores`) independientes usando la libreria `idb` para no duplicar archivos MP3 cuando una cancion pertenece a multiples playlists.

1. Almacen `tracks`: guarda el archivo binario `audioBlob` y sus metadatos indexados por `id`.
2. Almacen `playlists`: guarda unicamente el array ordenado `trackIds: string[]`. Reordenar, añadir o quitar canciones de una playlist solo debe mutar este array de strings.
3. Carga perezosa (Lazy Loading): recupera el `audioBlob` de un track desde IndexedDB unicamente en el instante en que va a ser reproducido.

### 3. Implementar el motor de Doble Cola en Zustand

Estructura el store (`usePlayerStore`) separando la cola prioritaria manual del contexto de reproduccion activo, replicando el comportamiento exacto de Spotify.

- `currentTrackId: string | null`: referencia a la cancion activa.
- `userQueue: string[]`: cola prioritaria FIFO para canciones añadidas manualmente mediante "Añadir a la cola".
- `contextQueue: string[]`: cola secundaria que contiene el resto de IDs de la playlist o album actual.
- `originalContextQueue: string[]`: copia de respaldo del orden original de `contextQueue` para restaurar la secuencia al desactivar `shuffle`.

### 4. Aplicar las reglas de transicion y Shuffle

Programar las transiciones respetando la jerarquia entre ambas colas garantiza que las canciones encoladas a mano nunca se pierdan ni se desordenen.

1. En `playNext()`: verifica primero si `userQueue.length > 0`. Si tiene elementos, extrae el primer ID (`userQueue[0]`), asignalo a `currentTrackId` y eliminalo de `userQueue`.
2. Si `userQueue` esta vacia: toma el siguiente ID disponible en `contextQueue`. Si llega al final, evalua `repeatMode` (`off`, `context`, `track`).
3. En `toggleShuffle()`: baraja unicamente `contextQueue` (usando el algoritmo Fisher-Yates) y conserva `userQueue` intacta. Al apagar `shuffle`, restaura `contextQueue` a partir de `originalContextQueue` manteniendo la posicion posterior a `currentTrackId`.

## Errores comunes a evitar

- Guardar objetos `Blob` o `ArrayBuffer` dentro del store de Zustand: satura la memoria del navegador en movil y degrada el rendimiento de renderizado. Guarda siempre IDs (`string`) en Zustand y consulta los metadatos en un mapa ligero o en IndexedDB.
- Fusionar `userQueue` y `contextQueue` en un solo array: impide saber que canciones fueron encoladas manualmente y rompe la restauracion del orden original al desactivar el modo aleatorio.
- Usar el tipo `any`: habilita siempre el tipado estricto para que el compilador detecte desajustes entre el esquema de IndexedDB y los componentes visuales.
