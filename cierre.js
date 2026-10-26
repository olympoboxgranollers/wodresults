// Reparto automático de puntos.
// Lo hace cualquier aparato donde el coach haya entrado con su cuenta (la pantalla de la TV a las 00:00,
// o publicar.html / la pantalla en cuanto se abran): busca los días ya terminados que aún no se han
// cerrado, calcula el podio de cada clase y categoría y suma los puntos. Cada día y clase se cierra
// una sola vez (si otro aparato ya lo ha hecho, las reglas de Firebase rechazan el segundo intento).
import { collection, query, where, getDocs, getDoc, doc, writeBatch, increment, serverTimestamp, deleteDoc, documentId } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db, hoy, claseDe, calcularPuntos, idCierre, idRegistro, formatearValor, CLASES, PUNTOS, umbralLogro, copiaInsignia } from "./comun.js?v=20261026d";

let enMarcha = false;
export async function cerrarDiasPendientes() {
  if (enMarcha) return 0;
  enMarcha = true;
  let cerrados = 0;
  try {
    const snap = await getDocs(query(collection(db, "resultados"), where("fecha", "<", hoy())));
    const grupos = {};
    snap.docs.forEach((d) => {
      const r = { id: d.id, ...d.data() };
      if (!r.uid) return;
      const k = idCierre(claseDe(r), r.fecha);
      (grupos[k] ||= { fecha: r.fecha, clase: claseDe(r), lista: [] }).lista.push(r);
    });
    for (const [id, g] of Object.entries(grupos)) {
      if ((await getDoc(doc(db, "cierres", id))).exists()) continue;
      // Medida del WOD de ese día: la de los resultados (las reglas ya obligaban a que coincidiera)
      const cuenta = {};
      g.lista.forEach((r) => (cuenta[r.tipo] = (cuenta[r.tipo] || 0) + 1));
      const tipo = Object.keys(cuenta).sort((a, b) => cuenta[b] - cuenta[a])[0];
      const filas = calcularPuntos(g.lista, tipo);
      if (!filas.length) continue;
      const lote = writeBatch(db);
      let total = 0;
      for (const f of filas) {
        // Los 10 de registrar ya se sumaron al subir el resultado; aquí solo va el podio
        // (y los 10 de registrar si por lo que sea no se sumaron en su momento)
        const podio = f.puntos - PUNTOS.registrar;
        const regRef = doc(db, "usuarios", f.r.uid, "movimientos", idRegistro(g.clase, g.fecha));
        const faltaRegistro = !(await getDoc(regRef)).exists();
        const sumar = podio + (faltaRegistro ? PUNTOS.registrar : 0);
        total += f.puntos;
        if (faltaRegistro) lote.set(regRef, { fecha: g.fecha, clase: g.clase, tipo: "registro", puntos: PUNTOS.registrar });
        if (podio > 0) lote.set(doc(db, "usuarios", f.r.uid, "movimientos", id), {
          fecha: g.fecha, clase: g.clase, tipo: "podio", categoria: f.categoria, posicion: f.posicion, puntos: podio,
          resultado: formatearValor(f.r.valor, f.r.tipo), wod: CLASES[g.clase]?.nombre || "WOD"
        });
        if (sumar > 0) lote.set(doc(db, "usuarios", f.r.uid), { nombre: f.r.nombre, puntos: increment(sumar), puntosRanking: increment(sumar), ...(faltaRegistro ? { clases: increment(1) } : {}) }, { merge: true });
      }
      lote.set(doc(db, "cierres", id), { fecha: g.fecha, clase: g.clase, cerrado: serverTimestamp(), socios: filas.length, puntosTotales: total, automatico: true });
      try { await lote.commit(); cerrados++; } catch (e) { console.warn("Cierre ya hecho o sin permiso", id, e); }
    }
  } catch (e) {
    console.warn("No se han podido cerrar los días pendientes", e);
  } finally { enMarcha = false; }
  return cerrados;
}

// Borra los resultados y WODs de días anteriores, pero SOLO de los días y clases que ya están cerrados
// (con los puntos repartidos). Así nunca se borra nada antes de dar los puntos del podio.
export async function limpiarDiasCerrados() {
  try {
    const cerrado = {};
    const estaCerrado = async (id) => (cerrado[id] ??= (await getDoc(doc(db, "cierres", id))).exists());
    const viejos = await getDocs(query(collection(db, "resultados"), where("fecha", "<", hoy())));
    const pendientes = new Set();
    for (const d of viejos.docs) {
      const r = d.data();
      const id = idCierre(claseDe(r), r.fecha);
      if (!r.uid || await estaCerrado(id)) await deleteDoc(d.ref).catch(() => {});
      else pendientes.add(id);
    }
    const wods = await getDocs(query(collection(db, "wods"), where(documentId(), "<", hoy())));
    for (const d of wods.docs) if (!pendientes.has(d.id)) await deleteDoc(d.ref).catch(() => {});
    // Chat del ranking: se borran los mensajes de los días anteriores (últimas 2 semanas)
    for (let i = 1; i <= 14; i++) {
      const dia = new Date(Date.now() - i * 86400000).toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" });
      const msgs = await getDocs(collection(db, "chat", dia, "mensajes")).catch(() => null);
      if (msgs) for (const m of msgs.docs) await deleteDoc(m.ref).catch(() => {});
    }
  } catch (e) { console.warn("No se han podido borrar los días anteriores", e); }
}

// Logros de clases: a quien ya ha llegado a 100, 250… clases y aún no lo tiene, se lo da con sus puntos
export async function darLogrosDeClases() {
  try {
    const logros = (await getDocs(collection(db, "logros"))).docs.map((d) => ({ id: d.id, ...d.data() })).filter((l) => umbralLogro(l) > 0);
    if (!logros.length) return 0;
    const socios = (await getDocs(collection(db, "usuarios"))).docs.map((d) => ({ uid: d.id, ...d.data() }));
    let lote = writeBatch(db), ops = 0, dados = 0;
    for (const s of socios) {
      const nuevos = logros.filter((l) => (s.clases || 0) >= umbralLogro(l) && !s.insignias?.[l.id]);
      if (!nuevos.length) continue;
      const cambios = {}; let suma = 0;
      for (const l of nuevos) {
        cambios[`insignias.${l.id}`] = copiaInsignia(l);
        suma += l.puntos || 0;
        lote.set(doc(db, "usuarios", s.uid, "movimientos", `logro_${l.id}`), { fecha: hoy(), tipo: "insignia", nombre: l.nombre, puntos: l.puntos || 0 });
        ops++; dados++;
      }
      if (suma) cambios.puntos = increment(suma);
      lote.update(doc(db, "usuarios", s.uid), cambios); ops++;
      if (ops >= 400) { await lote.commit(); lote = writeBatch(db); ops = 0; }
    }
    if (ops) await lote.commit();
    return dados;
  } catch (e) { console.warn("No se han podido dar los logros de clases", e); return 0; }
}

// Primero reparte los puntos, después da los logros de clases y al final limpia
// Para ahorrar lecturas, los logros se repasan como mucho cada 6 horas y la limpieza una vez al día
// en cada aparato (los socios ya reciben solos sus logros de clases al entrar en la app).
const ls = { leer: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, poner: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };
export async function cerrarYLimpiar() {
  await cerrarDiasPendientes();
  const ahora = Date.now();
  if (ahora - Number(ls.leer("cierre-logros") || 0) > 6 * 3600000) { await darLogrosDeClases(); ls.poner("cierre-logros", String(ahora)); }
  if (ls.leer("cierre-limpieza") !== hoy()) { await limpiarDiasCerrados(); ls.poner("cierre-limpieza", hoy()); }
}
