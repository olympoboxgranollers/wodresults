// Se ejecuta en GitHub Actions cada hora (ver .github/workflows/aimharder.yml).
// Lee las clases asistidas en AimHarder y las pone en la app (Firestore) con la cuenta de servicio de Firebase.
import { createHash } from "node:crypto";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { crearAim, sincronizar } from "./nucleo.mjs";

const secreto = (n) => (process.env[n] || "").trim();
const semilla = secreto("AIMHARDER_REFRESH_TOKEN");
if (semilla) console.log(`::add-mask::${semilla}`);
let cuenta;
try { cuenta = JSON.parse(secreto("FIREBASE_SERVICE_ACCOUNT")); }
catch { console.error("Falta o está mal el secreto FIREBASE_SERVICE_ACCOUNT (tiene que ser el JSON entero de la clave)."); process.exit(1); }

initializeApp({ credential: cert(cuenta) });
const db = getFirestore();
const auth = getAuth();
const privado = db.doc("privado/aimharder");   // tokens y estado: nadie lo puede leer desde la app
const estado = db.doc("sync/aimharder");       // resumen que ve el coach en Logros

const almacen = {
  async leerPrivado() { const s = await privado.get(); return s.exists ? s.data() : null; },
  async guardarPrivado(patch) {
    if (patch.refresh) console.log(`::add-mask::${patch.refresh}`);
    // Varios intentos: si se perdiera el token nuevo habría que generar otro en AimHarder
    for (let i = 0; i < 5; i++) {
      // mergeFields: cada campo enviado se sustituye entero (así un recuento nuevo borra los estados antiguos)
      try { await privado.set(patch, { mergeFields: Object.keys(patch) }); return; }
      catch (e) { if (i === 4) throw e; await new Promise((r) => setTimeout(r, 1500 * (i + 1))); }
    }
  },
  async cuentasApp() {
    const fuera = [];
    let token;
    do {
      const r = await auth.listUsers(1000, token);
      for (const u of r.users) if (u.email) fuera.push({ uid: u.uid, email: u.email });
      token = r.pageToken;
    } while (token);
    return fuera;
  },
  async usuarios() { return (await db.collection("usuarios").get()).docs.map((d) => ({ uid: d.id, ...d.data() })); },
  async logros() { return (await db.collection("logros").get()).docs.map((d) => ({ id: d.id, ...d.data() })); },
  async actualizarUsuario(uid, datos, nuevos, hoy, reservas = null) {
    const lote = db.batch();
    const cambios = { ...datos };
    let suma = 0;
    // Puntos por las clases nuevas reservadas en AimHarder (van a la cartera, no al ranking)
    if (reservas?.puntos > 0) {
      suma += reservas.puntos;
      lote.set(db.doc(`usuarios/${uid}/movimientos/reserva_${hoy}_${Date.now()}`), { fecha: hoy, tipo: "reserva", nombre: `${reservas.nuevas} ${reservas.nuevas === 1 ? "clase" : "clases"}`, puntos: reservas.puntos });
    }
    for (const l of nuevos) {
      cambios[`insignias.${l.id}`] = { nombre: l.nombre, corto: l.corto || "★", unidad: l.unidad || "", orden: l.orden || 0, nivel: l.nivel || "", imagen: l.imagen || "", puntos: l.puntos || 0, fecha: hoy };
      suma += l.puntos || 0;
      lote.set(db.doc(`usuarios/${uid}/movimientos/logro_${l.id}`), { fecha: hoy, tipo: "insignia", nombre: l.nombre, puntos: l.puntos || 0 });
    }
    if (suma) cambios.puntos = FieldValue.increment(suma);
    lote.update(db.doc(`usuarios/${uid}`), cambios);
    await lote.commit();
  },
  async guardarEstado(obj) { await estado.set(obj); },
  // Socios que el coach pide recontar ya (Logros → Clases realizadas → «Recontar desde AimHarder»)
  async leerForzados() { const s = await db.doc("ajustes/sincronizar").get(); return s.exists ? (s.data().uids || []) : []; },
  async limpiarForzados(uids) { await db.doc("ajustes/sincronizar").set({ uids: FieldValue.arrayRemove(...uids) }, { merge: true }); }
};

const prueba = process.env.PRUEBA === "true";
const aim = crearAim();
try {
  const semillaHash = semilla ? createHash("sha256").update(semilla).digest("hex").slice(0, 16) : null;
  await sincronizar({ aim, almacen, semilla, semillaHash, prueba });
  console.log(prueba ? "✓ Prueba terminada: no se ha cambiado ningún socio." : "✓ Sincronización terminada.");
} catch (e) {
  // Mensaje para el coach (sin datos personales)
  const msg = String(e?.message || e);
  const humano = e?.status === 401 || e?.status === 403 || e?.status === 400
    ? "AimHarder no acepta el token. Genera uno nuevo en AimHarder (Configuración → API) y pégalo en el secreto AIMHARDER_REFRESH_TOKEN de GitHub."
    : e?.sinCupo ? "Se ha llegado al límite de peticiones de AimHarder; se seguirá en la próxima sincronización."
    : msg.startsWith("FALTA_TOKEN") ? "Falta el token de AimHarder en los secretos de GitHub."
    : "Error en la sincronización: " + msg;
  console.error("✗ " + humano);
  try { await estado.set({ ultima: new Date().toISOString(), ok: false, mensaje: humano }, { merge: true }); } catch {}
  if (!e?.sinCupo) process.exit(1);
}
