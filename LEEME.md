# Olympo Box · App de resultados, ranking, canjes, logros y eventos

## Páginas

| Página | Para quién | Qué hace |
|---|---|---|
| `index.html` | Socios (lo abre el QR) | Entrar o crear cuenta, crear el perfil de atleta, subir el resultado (1 por clase y día), editarlo o validarlo, ver su puesto, los puntos sumados y el contador «Próximo logro» |
| `ranking.html` | Socios | Ranking en directo por clase (WOD / Hyrox / Funcional) y categoría; tocando a un socio se abre su perfil |
| `canjes.html` | Socios y coach | Cartera de puntos (puntos de hoy, ocultar puntos, botón «Ranking de puntos») y catálogo de canjeables. El socio pulsa Canjear; el coach añade productos, ve los pendientes y marca Entregado |
| `perfil.html` | Socios | Foto, ejercicio favorito y más odiado, puntos, puesto, marcas personales (2 destacadas + «Mis marcas») y logros con su contador de clases |
| `eventos.html` | Socios y coach | Calendario de eventos: Asistiré, añadir a Google/Apple/Android, lista de asistentes y pasar lista con puntos |
| `logros.html` | Coach | Crear, dar y quitar logros (bronce, plata, oro, diamante, olimpo), contador de clases y estado de AimHarder |
| `pantalla.html` | TV del box | Ranking en directo con el QR de cada clase, pantalla completa (⛶) y ⚙ WOD de hoy; reparte los puntos a las 00:00 |
| `publicar.html` | Coach | Publicar el WOD de cada clase y corregir, validar o borrar resultados |
| `puntos.html` | — | Redirige a Canjes (enlaces antiguos) |

Menú de los socios: Canjes · Ranking · Resultado · Eventos · Perfil.
Menú del coach: Canjes · Ranking · Logros · Eventos · Pantalla · Publicar.

## Archivos de apoyo

`config.js` (Firebase, nombre, coach, clases y extras), `tema.css` (colores), `estilos.css`, `comun.js`, `cuenta.js`, `menu.js`, `cierre.js`, `sw.js`, `manifest.json`, logo e iconos, y `firestore.rules` (se pega en Firebase).

Sincronización con AimHarder: carpeta `sync/` y `.github/workflows/aimharder.yml`.

## Subir y actualizar

1. **GitHub** → repositorio `wodresults` → *Add file → Upload files* → arrastra los archivos sueltos y la carpeta `sync` → **Commit changes**.
   - La carpeta `.github` está oculta en Mac: *Add file → Create new file* → nombre `.github/workflows/aimharder.yml` → pega el contenido de `sync/aimharder.yml`.
2. **Firebase → Firestore → Reglas** → pega `firestore.rules` → **Publicar**.
3. **Firebase → Authentication** → Google y Correo/contraseña activados; dominio `olympoboxgranollers.github.io` autorizado.
4. En la TV, abre `pantalla.html` con la cuenta del coach (Google) y pulsa ⛶.
5. Después de cada actualización, recarga con Ctrl+Shift+R.

## Puntos

- 10 por registrar el resultado (al momento, una vez por clase y día). Cada resultado cuenta además como una clase para los logros.
- Podio de cada categoría a las 00:00: RX +30/+20/+10 · Scaled +15/+10/+5 · Open +7,5/+5/+2,5. Los empates comparten puesto.
- Logros (los puntos de cada logro) y eventos (+100 cuando el coach pasa lista).
- El podio y los logros de clases se reparten desde un aparato con la sesión del coach abierta: la TV con `pantalla.html` lo hace a las 00:00; si está apagada, en cuanto el coach abra cualquier página.

## Clases desde AimHarder (opcional, gratis)

GitHub ejecuta cada hora `sync/aimharder.mjs`: lee las clases asistidas de cada socio en AimHarder (emparejados por email) y las pone en la app.

1. **Firebase → ⚙ Configuración del proyecto → Cuentas de servicio → Generar nueva clave privada** (no la compartas).
2. **AimHarder → Configuración → API** → copia el refresh token.
3. **GitHub → Settings → Secrets and variables → Actions**: `FIREBASE_SERVICE_ACCOUNT` (el `.json` entero) y `AIMHARDER_REFRESH_TOKEN`.
4. **GitHub → Actions → «Clases desde AimHarder» → Run workflow** con «Solo prueba».

## Enlaces

- Subir resultado (QR): https://olympoboxgranollers.github.io/wodresults/
- Ranking: https://olympoboxgranollers.github.io/wodresults/ranking.html
- Canjes: https://olympoboxgranollers.github.io/wodresults/canjes.html
- Eventos: https://olympoboxgranollers.github.io/wodresults/eventos.html
- Pantalla TV: https://olympoboxgranollers.github.io/wodresults/pantalla.html
- Publicar (coach): https://olympoboxgranollers.github.io/wodresults/publicar.html
