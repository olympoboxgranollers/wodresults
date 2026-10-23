// Reparto automático de puntos.
// Lo hace cualquier aparato donde el coach haya entrado con su cuenta (la pantalla de la TV a las 00:00,
// o publicar.html / la pantalla en cuanto se abran): busca los días ya terminados que aún no se han
// cerrado, calcula el podio de cada clase y categoría y suma los puntos. Cada día y clase se cierra
// una sola vez (si otro aparato ya lo ha hecho, las reglas de Firebase rechazan el segundo intento).
import { collection, query, where, getDocs, getDoc, doc, writeBatch, increment, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db, hoy, claseDe, calcularPuntos, idCierre, idRegistro, formatearValor, CLASES, PUNTOS } from "./comun.js";

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
        if (sumar > 0) lote.set(doc(db, "usuarios", f.r.uid), { nombre: f.r.nombre, puntos: increment(sumar) }, { merge: true });
      }
      lote.set(doc(db, "cierres", id), { fecha: g.fecha, clase: g.clase, cerrado: serverTimestamp(), socios: filas.length, puntosTotales: total, automatico: true });
      try { await lote.commit(); cerrados++; } catch (e) { console.warn("Cierre ya hecho o sin permiso", id, e); }
    }
  } catch (e) {
    console.warn("No se han podido cerrar los días pendientes", e);
  } finally { enMarcha = false; }
  return cerrados;
}
