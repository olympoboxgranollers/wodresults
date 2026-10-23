# Ranking del WOD con QR — Puesta en marcha

Dos páginas:
- **index.html** → lo que abre el QR en el móvil del socio (nombre, RX/Scaled y resultado).
- **pantalla.html** → para la TV del box: ranking en directo de RX y Scaled + el QR para escanear.

Cada día empieza un ranking nuevo automáticamente. Los socios no necesitan cuenta ni app.

---

## 1. Crear la base de datos (gratis, ~5 min)

1. Entra en https://console.firebase.google.com con tu cuenta de Google → **Agregar proyecto** (p. ej. "olympo-wod"). Puedes desactivar Google Analytics.
2. Menú izquierdo → **Compilación → Firestore Database → Crear base de datos**.
   - Ubicación: `europe-southwest1 (Madrid)` o cualquier `europe-…`.
   - Modo: **producción**.
3. En Firestore, pestaña **Reglas**: borra lo que haya, pega el contenido del archivo `firestore.rules` y pulsa **Publicar**.
4. Rueda dentada ⚙ (arriba a la izquierda) → **Configuración del proyecto** → abajo, en "Tus apps", pulsa el icono **`</>`** (Web) → ponle un nombre → **Registrar app**.
5. Te mostrará un bloque `const firebaseConfig = { ... }`. Copia esos valores en el archivo **`config.js`** sustituyendo cada `PEGA_AQUI`.

El plan gratuito (Spark) permite 20.000 escrituras y 50.000 lecturas al día: de sobra para el box.

## 2. Publicar la web (gratis, ~2 min)

La forma más fácil es **Netlify Drop**:
1. Entra en https://app.netlify.com/drop (crea cuenta gratis con tu Google para que no caduque).
2. Arrastra **la carpeta entera** `wod-ranking` a la página.
3. Te dará una dirección tipo `https://nombre-raro.netlify.app`. En *Site configuration → Change site name* puedes cambiarla a algo como `olympo-wod.netlify.app`.

Cuando cambies algo, vuelve a arrastrar la carpeta en *Deploys*.

## 3. Uso diario

1. En la TV / ordenador del box abre `https://TU-WEB.netlify.app/pantalla.html` y pon el navegador a pantalla completa (F11).
2. Pulsa **⚙ WOD de hoy** (esquina inferior derecha), escribe el nombre del WOD y cómo se puntúa:
   - **Por tiempo** → gana el menor tiempo (el socio mete minutos y segundos).
   - **Repeticiones / AMRAP** → gana quien más reps haga.
   - **Carga (kg)** → gana quien más kilos levante.
3. Los socios escanean el QR de la pantalla, ponen su nombre, RX o Scaled y su resultado. Aparecen al instante en el ranking (resaltados al entrar).

**QR impreso:** el QR siempre apunta a `https://TU-WEB.netlify.app/` y no cambia, así que puedes hacer clic derecho sobre el QR de la pantalla → "Guardar imagen" e imprimirlo para la pared.

## Borrar un resultado equivocado

Firebase Console → Firestore Database → colección `resultados` → busca el documento → menú ⋮ → **Eliminar documento**. (Por seguridad, desde la web nadie puede borrar ni editar.)

## Ten en cuenta

- Cualquiera con el enlace puede enviar un resultado o cambiar el WOD del día; para un box es suficiente, pero no compartas el enlace fuera.
- El móvil recuerda el nombre del socio para la próxima vez.
