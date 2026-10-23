# Ranking del WOD con QR — Olympo Box

## Archivos de esta carpeta (deben estar los 7 sueltos en el repositorio de GitHub)

| Archivo | Para qué sirve |
|---|---|
| `index.html` | Formulario que abre el QR en el móvil del socio (nombre, RX/Scaled, tiempo/rondas/kg) |
| `pantalla.html` | Pantalla de la TV con el ranking en directo y el QR |
| `estilos.css` | Colores y estilo (fondo gris antracita, título lila malva) |
| `comun.js` | Funciones compartidas (formato de tiempos y rondas, orden del ranking) |
| `config.js` | Tus claves de Firebase **(hay que rellenarlo)** |
| `firestore.rules` | Reglas de seguridad: se copian en Firebase, no hace falta que estén en GitHub |
| `LEEME.md` | Estas instrucciones |

## 1. config.js (ya rellenado con tus claves)

Abre `config.js` con el Bloc de notas y sustituye cada `PEGA_AQUI` por tus claves de Firebase
(Firebase → ⚙ Configuración del proyecto → Tus apps → tu app web). Mantén las comillas. Guarda.

Si ya tenías un `config.js` con tus claves en GitHub, puedes copiar las claves desde allí
(abre el archivo en GitHub y copia los valores).

## 2. Actualizar las reglas en Firebase

Firebase → Firestore Database → pestaña **Reglas** → borra todo → pega el contenido de
`firestore.rules` → **Publicar**.

## 3. Subir a GitHub

1. Entra en tu repositorio `wod`.
2. Si hay una carpeta `wod-ranking` u otros archivos viejos, bórralos: abre el archivo → menú `...` → **Delete file** → Commit changes.
3. **Add file → Upload files** → arrastra **los archivos de dentro de esta carpeta** (no la carpeta) → **Commit changes**.
4. Espera a que en la pestaña **Actions** salga el check verde ✅ (1–3 min).

## 4. Comprobar

- Formulario de socios: `https://TU-USUARIO.github.io/wod/?v=3`
- Pantalla TV: `https://TU-USUARIO.github.io/wod/pantalla.html?v=3`

Ábrelo en incógnito o recarga con Ctrl+Shift+R para no ver la versión antigua.
Debe verse con fondo gris antracita, "TU RESULTADO" en lila y la fecha abajo a la derecha.

## Uso diario

1. En la TV abre `pantalla.html` (F11 para pantalla completa).
2. Pulsa **⚙ WOD de hoy** (abajo a la izquierda): nombre del WOD y cómo se puntúa (tiempo, rondas + reps o kg).
3. Los socios escanean el QR y suben su resultado; aparece al instante en el ranking.

**Borrar un resultado equivocado:** Firebase → Firestore Database → `resultados` → documento → ⋮ → Eliminar documento.

**Sin historial:** cada vez que se abre la pantalla se borran solos los resultados de días anteriores.
