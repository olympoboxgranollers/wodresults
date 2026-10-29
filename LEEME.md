# Olympo Box · App de resultados, ranking, canjes, logros y eventos

## Páginas

| Página | Para quién | Qué hace |
|---|---|---|
| `index.html` | Socios (lo abre el QR) | Entrar o crear cuenta, crear el perfil de atleta, subir el resultado (1 por clase y día), editarlo o validarlo, ver su puesto, los puntos sumados y el contador «Próximo logro» |
| `ranking.html` | Socios | Ranking del día por clase y categoría con reacciones (🔥💪👏😮😂), ranking **general** (puntos de registrar + podio), buscador de atletas y **chat del box** del día |
| `canjes.html` | Socios y coach | Cartera de puntos (puntos de hoy, ocultar puntos, botón «Ranking de puntos») y catálogo de canjeables. El socio pulsa Canjear; el coach añade productos, ve los pendientes y marca Entregado |
| `perfil.html` | Socios | Foto, ejercicio favorito y más odiado, puntos, puesto, marcas personales (2 destacadas + «Mis marcas») y logros con su contador de clases |
| `eventos.html` | Socios y coach | Calendario de eventos: Asistiré, añadir a Google/Apple/Android, lista de asistentes y pasar lista con puntos |
| `logros.html` | Coach | Crear, dar y quitar logros con medalla ilustrada (carpeta `medallas/`), contador de clases y estado de AimHarder. Dar un logro de clases sube el contador hasta ese número |
| `pantalla.html` | TV del box | Ranking en directo con el QR de cada clase, pantalla completa (⛶) y ⚙ WOD de hoy; reparte los puntos a las 00:00 |
| `publicar.html` | Coach y entrenadores | Publicar el WOD de cada clase y corregir, validar o borrar resultados. El coach gestiona aquí la lista de **entrenadores** |
| `puntos.html` | — | Redirige a Canjes (enlaces antiguos) |

| `amigos.html` | Socios | Mis amigos, solicitudes y todos los socios registrados. En el perfil salen sus amigos y los amigos en común |
| `tv.html` | TV del box | Pantalla de la TV conectada con código (sin cuenta de coach) |

Menú de los socios: Canjes · Ranking · Resultado · Eventos · Amigos · Perfil.
Menú del coach: Canjes · Ranking · Logros · Eventos · Pantalla · Publicar.
Entrenadores: el menú de socio + Pantalla y Publicar.

Avisos automáticos: ventana de **logro nuevo**, avisos de **amistad** (te envían o aceptan una solicitud) y avisos de **eventos**: solo del siguiente evento, cuando falta un mes, una semana y el día antes (una vez cada uno).

## Archivos

- Páginas: las `.html` de la tabla.
- Apoyo: `config.js` (Firebase, nombre, coach, clases), `estilos.css`, `olympo-ds.css` (diseño), `comun.js`, `cuenta.js`, `menu.js`, `cierre.js`, `amigos.js`, `medallas-datos.js`, `sw.js`, `manifest.json`, logo, iconos y medallas (`.png` / `.webp`).
- Sincronización con AimHarder: `aimharder.mjs`, `nucleo.mjs`, `package.json` y `.github/workflows/aimharder.yml`.
- `firestore.rules` / `reglas-firestore.txt`: las reglas de seguridad que se pegan en Firebase.

## Montar o restaurar la app

1. **GitHub** → repositorio `wodresults` (debe ser **público** para que GitHub Pages funcione gratis) → *Add file → Upload files* → arrastra todos los archivos → **Commit changes**.
   - La carpeta `.github` está oculta en Mac (Cmd+Shift+. para verla). Si no se sube: *Add file → Create new file* → nombre `.github/workflows/aimharder.yml` → pega su contenido.
   - **Settings → Pages** → *Deploy from a branch* → `main` / `(root)`.
2. **Firebase → Firestore → Reglas** → pega `reglas-firestore.txt` → **Publicar**.
3. **Firebase → Authentication → Método de inicio de sesión**: Google, Correo/contraseña y Anónimo (para la TV) activados. En *Configuración → Dominios autorizados*: `olympoboxgranollers.github.io`.
   - Las cuentas con correo/contraseña tienen que **verificar el email** antes de usar la app; las de Google ya vienen verificadas.
4. Si alguna página muestra un error de «índice», abre la consola del navegador: Firebase da un enlace que lo crea con un clic.
5. En la TV, abre `pantalla.html` con la cuenta del coach (o `tv.html` con código) y pulsa ⛶.
6. Después de cada actualización, espera unos minutos y recarga con Ctrl+Shift+R.

## Plan gratuito de Firebase

La app está pensada para no salir del plan gratis (Spark), que no lleva tarjeta: nunca te pueden cobrar. Si algún día se pasara del límite de lecturas, la app dejaría de cargar datos hasta que se reinicia el contador (sobre las 9 de la mañana).
Para gastar poco: el móvil guarda una copia de los datos y al cambiar de página solo descarga lo que ha cambiado; el puesto del ranking se calcula con un recuento; el ranking de puntos solo se carga al abrirlo; y AimHarder se sincroniza cada hora.
Puedes ver el consumo en **Firebase → Firestore → Uso**.

## Puntos

- Por registrar el resultado (al momento, una vez por clase y día): **RX +20 · Open +10**. Cada resultado cuenta además como una clase para los logros.
- Categorías: solo **RX** y **Open** (los resultados antiguos en Scaled cuentan como Open). Cada resultado lleva **chico / chica** y los rankings y podios van separados: RX Chicos, RX Chicas, Open Chicos, Open Chicas.
- En Open va delante quien ha puesto más peso (en cualquier WOD o EMOM); con el mismo peso empatan. Si nadie ha puesto peso, cuenta el resultado.
- Podio de cada grupo a las 00:00: RX +30/+20/+10 · Open +15/+10/+5. Los empates comparten puesto.
- Logros (los puntos de cada logro) y eventos (+100 cuando el coach pasa lista).
- El podio y los logros de clases se reparten desde un aparato con la sesión del coach abierta: la TV con `pantalla.html` lo hace a las 00:00; si está apagada, en cuanto el coach abra cualquier página.

## Clases desde AimHarder (opcional, gratis)

GitHub ejecuta cada hora `aimharder.mjs`: lee las clases reservadas de cada socio en AimHarder (emparejados por email) y las pone en la app.

Solo cuentan las clases **WOD, FUNCIONAL, MASTERS FUNCIONAL, HIBRIDRACE y CROSSBEGINNERS** (el Open box no cuenta). La lista está al principio de `nucleo.mjs` (`CLASES_QUE_CUENTAN`); da igual mayúsculas, acentos y espacios.

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
