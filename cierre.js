// Reparto automático de puntos.
// Lo hace cualquier aparato donde el coach haya entrado con su cuenta (la pantalla de la TV a las 00:00,
// o publicar.html / la pantalla en cuanto se abran): busca los días ya terminados que aún no se han
// cerrado, calcula el podio de cada clase y categoría y suma los puntos. Cada día y clase se cierra
// una sola vez (si otro aparato ya lo ha hecho, las reglas de Firebase rechazan el segundo intento).
import { collection, query, where, getDocs, getDoc, doc, writeBatch, increment, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db, hoy, claseDe, calcularPuntos, idCierre, formatearValor, CLASES } from "./comun.js";

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
      const total = filas.reduce((s, f) => s + f.puntos, 0);
      const lote = writeBatch(db);
      lote.set(doc(db, "cierres", id), { fecha: g.fecha, clase: g.clase, cerrado: serverTimestamp(), socios: filas.length, puntosTotales: total, automatico: true });
      for (const f of filas) {
        lote.set(doc(db, "usuarios", f.r.uid), { nombre: f.r.nombre, puntos: increment(f.puntos) }, { merge: true });
        lote.set(doc(db, "usuarios", f.r.uid, "movimientos", id), {
          fecha: g.fecha, clase: g.clase, categoria: f.categoria, posicion: f.posicion, puntos: f.puntos,
          resultado: formatearValor(f.r.valor, f.r.tipo), wod: CLASES[g.clase]?.nombre || "WOD"
        });
      }
      try { await lote.commit(); cerrados++; } catch (e) { console.warn("Cierre ya hecho o sin permiso", id, e); }
    }
  } catch (e) {
    console.warn("No se han podido cerrar los días pendientes", e);
  } finally { enMarcha = false; }
  return cerrados;
}
