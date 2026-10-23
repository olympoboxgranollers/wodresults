# Olympo Box · Resultados, ranking y puntos

## Páginas

| Página | Para quién | Qué hace |
|---|---|---|
| `index.html` | Socios (lo abre el QR) | Entrar/crear cuenta, subir el resultado (1 por clase y día), editarlo o validarlo, ver su posición |
| `ranking.html` | Socios, desde casa | Clasificación en directo por clase (WOD / Hyrox / Funcional) y categoría |
| `puntos.html` | Socios | Cartera de puntos, historial y ranking de puntos |
| `pantalla.html` | TV del box | Clasificación en directo con QR por clase; reparte los puntos a las 00:00 si la sesión del coach está abierta |
| `publicar.html` | Coach | Publicar el WOD de cada clase y corregir, validar o borrar resultados |

Todas tienen un menú abajo para pasar de una a otra.

## Archivos de apoyo

`comun.js`, `cuenta.js`, `menu.js`, `cierre.js`, `config.js` (claves de Firebase y email del coach), `estilos.css`, `sw.js` (avisos) y `firestore.rules` (reglas; se pegan en Firebase, no hace falta que estén en GitHub).

## Puesta en marcha (una sola vez)

1. **GitHub** → repositorio `wodresults` → *Add file → Upload files* → arrastra **todos los archivos sueltos** (no la carpeta) → **Commit changes**.
2. **Firebase → Firestore → Reglas** → pega el contenido de `firestore.rules` → **Publicar**.
3. **Firebase → Authentication → Método de acceso** → activa **Google** y **Correo electrónico/contraseña**.
4. **Authentication → Configuración → Dominios autorizados** → añade `olympoboxgranollers.github.io`.
5. En el navegador de la TV, entra una vez en `publicar.html` con la cuenta del coach (Google, olympoboxgranollers@gmail.com).

## Puntos

- 10 por registrar el resultado (al momento, una vez por clase y día).
- Podio de cada categoría a las 00:00: RX +30/+20/+10 · Scaled +15/+10/+5 · Open +7,5/+5/+2,5.
- Los empates comparten puesto. RX va por delante de Scaled y Scaled por delante de Open.

## Enlaces

- Subir resultado: https://olympoboxgranollers.github.io/wodresults/
- Ranking: https://olympoboxgranollers.github.io/wodresults/ranking.html
- Puntos: https://olympoboxgranollers.github.io/wodresults/puntos.html
- Pantalla TV: https://olympoboxgranollers.github.io/wodresults/pantalla.html
- Publicar (coach): https://olympoboxgranollers.github.io/wodresults/publicar.html
