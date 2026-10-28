// Amigos: solicitudes y amistades entre socios.
// Cada amistad es un documento "amistades/{uidA_uidB}" (los dos uid ordenados) con:
//   uids: [uidA, uidB], de: quien la pidió, para: quien la recibe, nombres: { uid: nombre }, estado: "pendiente" | "aceptada"
import { collection, doc, onSnapshot, query, where, setDoc, updateDoc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db } from "./comun.js?v=20261028b";

export const idAmistad = (a, b) => (a < b ? `${a}_${b}` : `${b}_${a}`);

// Escucha todas mis amistades y solicitudes. cb(mapa) con mapa: uid del otro -> { id, estado, deMi, nombre }
export function escucharAmistades(miUid, cb) {
  return onSnapshot(query(collection(db, "amistades"), where("uids", "array-contains", miUid)), (s) => {
    const mapa = new Map();
    s.forEach((d) => {
      const a = d.data(), otro = a.uids.find((u) => u !== miUid);
      if (otro) mapa.set(otro, { id: d.id, estado: a.estado, deMi: a.de === miUid, nombre: a.nombres?.[otro] || "Socio" });
    });
    cb(mapa);
  }, () => cb(new Map()));
}

export async function pedirAmistad(yo, miNombre, otro, nombreOtro) {
  const uids = [yo, otro].sort();
  await setDoc(doc(db, "amistades", idAmistad(yo, otro)), {
    uids, de: yo, para: otro, estado: "pendiente", creado: serverTimestamp(),
    nombres: { [yo]: String(miNombre || "Socio").slice(0, 40), [otro]: String(nombreOtro || "Socio").slice(0, 40) }
  });
}
export const aceptarAmistad = (id) => updateDoc(doc(db, "amistades", id), { estado: "aceptada" });
// Rechazar, cancelar la solicitud o dejar de ser amigos
export const quitarAmistad = (id) => deleteDoc(doc(db, "amistades", id));

// Botón con el estado de la amistad con otro socio (para la lista de socios y el perfil)
export function botonAmistad(rel, { alPedir, alAceptar, alQuitar }) {
  const b = document.createElement("button"); b.type = "button";
  if (!rel) { b.className = "am-btn am-anadir"; b.textContent = "+ Añadir"; b.addEventListener("click", alPedir); }
  else if (rel.estado === "aceptada") {
    b.className = "am-btn am-ok"; b.textContent = "✓ Amigos";
    let seguro = false;
    b.addEventListener("click", () => {
      if (!seguro) { seguro = true; b.textContent = "¿Quitar?"; b.classList.add("am-quitar"); setTimeout(() => { seguro = false; b.textContent = "✓ Amigos"; b.classList.remove("am-quitar"); }, 3000); return; }
      alQuitar();
    });
  } else if (rel.deMi) { b.className = "am-btn am-pend"; b.textContent = "Enviada · Cancelar"; b.addEventListener("click", alQuitar); }
  else { b.className = "am-btn am-anadir"; b.textContent = "Aceptar"; b.addEventListener("click", alAceptar); }
  return b;
}
