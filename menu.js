// Menú común a todas las páginas + acceso con cuenta + editor de resultados para el coach.
import { doc, updateDoc, getDoc, writeBatch, increment } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db, PUNTOS, idRegistro, leerValor, escribirValor, claseDe } from "./comun.js";
import { escucharCuenta, montarAcceso, salir } from "./cuenta.js";
import { COACH_EMAIL } from "./config.js";

export const esCuentaCoach = (user) => !!user && user.email?.toLowerCase() === COACH_EMAIL.toLowerCase();

// Iconos de línea propios (mismo trazo en todos)
const ICONOS = {
  resultado: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5"/><path d="M9.5 2.5h5"/><path d="M12 2.5V5"/>',
  ranking: '<path d="M8 3.5h8v5a4 4 0 0 1-8 0v-5z"/><path d="M8 5.5H5.5a3 3 0 0 0 3 4"/><path d="M16 5.5h2.5a3 3 0 0 1-3 4"/><path d="M12 12.5v3.5"/><path d="M8.5 20.5h7"/><path d="M10 16h4l.5 4.5h-5z"/>',
  puntos: '<path d="M12 3.2l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.6l-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z"/>',
  pantalla: '<rect x="3" y="4.5" width="18" height="12" rx="2.5"/><path d="M8.5 20.5h7"/><path d="M12 16.5v4"/>',
  publicar: '<path d="M4.5 19.5l1-4.5L15.8 4.7a2 2 0 0 1 2.8 0l.7.7a2 2 0 0 1 0 2.8L9 18.5z"/><path d="M13.5 7l3.5 3.5"/>',
  entrar: '<path d="M14 4h3.5A2.5 2.5 0 0 1 20 6.5v11a2.5 2.5 0 0 1-2.5 2.5H14"/><path d="M9.5 16.5L14 12 9.5 7.5"/><path d="M14 12H3.5"/>',
  canjes: '<rect x="3.5" y="8.5" width="17" height="12" rx="2"/><path d="M3.5 12.5h17"/><path d="M12 8.5v12"/><path d="M12 8.5c-1.8 0-4.5-.6-4.5-2.6 0-1.3 1-2 2-2 2 0 2.5 2.6 2.5 4.6z"/><path d="M12 8.5c1.8 0 4.5-.6 4.5-2.6 0-1.3-1-2-2-2-2 0-2.5 2.6-2.5 4.6z"/>',
  salir: '<circle cx="12" cy="8.5" r="4"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0"/>'
};
const icono = (n) => {
  const s = document.createElement("span");
  s.className = "menu-icono";
  // Canjes: el logo del box, en una sola tinta como el resto de iconos
  if (n === "canjes") { s.classList.add("menu-logo"); return s; }
  s.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONOS[n]}</svg>`;
  return s;
};

const PAGINAS = [
  { id: "resultado", href: "index.html",    texto: "Resultado" },
  { id: "ranking",   href: "ranking.html",  texto: "Ranking" },
  { id: "puntos",    href: "puntos.html",   texto: "Puntos" },
  { id: "canjes",    href: "canjes.html",   texto: "Canjes" },
  { id: "pantalla",  href: "pantalla.html", texto: "Pantalla", coach: true },
  { id: "publicar",  href: "publicar.html", texto: "Publicar", coach: true }
];

// Pinta el menú. opciones: actual (id de la página), cuenta (mostrar botón Entrar/Salir), tv (versión pequeña para la TV),
// alCambiar({ user, coach }) se llama cada vez que cambia quién ha entrado
export function montarMenu({ actual, cuenta = true, tv = false, alCambiar, protegida = true } = {}) {
  // Páginas protegidas: sin sesión no se ve nada y se va a la pantalla de entrar (index.html),
  // que después devuelve a esta misma página
  if (protegida) document.documentElement.classList.add("esperando-sesion");
  const nav = document.createElement("nav");
  nav.hidden = true;  // el menú solo aparece con la sesión iniciada
  nav.className = "menu" + (tv ? " menu-tv" : "");
  nav.setAttribute("aria-label", "Páginas");
  document.body.append(nav);
  document.body.classList.add(tv ? "con-menu-tv" : "con-menu");

  let dialogo = null;
  if (cuenta) {
    dialogo = document.createElement("dialog");
    dialogo.className = "dialogo-acceso";
    const caja = document.createElement("div");
    const cerrar = Object.assign(document.createElement("button"), { type: "button", className: "dialogo-cerrar", textContent: "✕" });
    cerrar.setAttribute("aria-label", "Cerrar");
    cerrar.addEventListener("click", () => dialogo.close());
    dialogo.append(cerrar, caja);
    document.body.append(dialogo);
    montarAcceso(caja, { titulo: "Entra con tu cuenta", texto: "Con la cuenta del coach podrás corregir y validar resultados desde aquí." });
  }

  let user = null;
  const pintar = () => {
    nav.replaceChildren();
    const coach = esCuentaCoach(user);
    let clase = "";
    try { clase = localStorage.getItem("wod-clase") || ""; } catch {}
    for (const p of PAGINAS) {
      if (p.coach && !coach) continue;
      if (p.id === "resultado" && coach) continue;  // el coach no registra resultados
      const a = document.createElement("a");
      a.href = p.href + (clase ? "?clase=" + clase : "");
      a.className = "menu-item" + (p.id === actual ? " activo" : "");
      if (p.id === actual) a.setAttribute("aria-current", "page");
      a.append(icono(p.id), Object.assign(document.createElement("span"), { className: "menu-texto", textContent: p.texto }));
      nav.append(a);
    }
    if (cuenta) {
      const b = Object.assign(document.createElement("button"), { type: "button", className: "menu-item menu-cuenta" });
      b.append(icono(user ? "salir" : "entrar"), Object.assign(document.createElement("span"), { className: "menu-texto", textContent: user ? "Salir" : "Entrar" }));
      b.title = user ? `Has entrado como ${user.email}` : "Entrar con tu cuenta";
      b.addEventListener("click", () => { if (user) salir(); else dialogo.showModal(); });
      nav.append(b);
    }
  };
  pintar();
  escucharCuenta(({ user: u }) => {
    if (!u && protegida) {
      const volver = location.pathname.split("/").pop() + location.search;
      location.replace("index.html?volver=" + encodeURIComponent(volver));
      return;
    }
    document.documentElement.classList.remove("esperando-sesion");
    nav.hidden = !u;
    const cambio = (u?.uid || null) !== (user?.uid || null);
    user = u;
    if (u && dialogo?.open) dialogo.close();
    if (cambio) { pintar(); alCambiar?.({ user, coach: esCuentaCoach(user) }); }
  });
  // Al cambiar de clase en la página, los enlaces llevan a esa misma clase
  addEventListener("storage", pintar);
  return { repintar: pintar };
}

// ---------- Editor de un resultado (solo coach) ----------
let dlg = null;
export function abrirEditor(r, tipo) {
  if (!dlg) {
    dlg = document.createElement("dialog");
    dlg.className = "dialogo-editor";
    document.body.append(dlg);
  }
  dlg.replaceChildren();
  const titulo = Object.assign(document.createElement("h3"), { textContent: r.nombre });
  const sub = Object.assign(document.createElement("p"), { className: "editor-sub", textContent: r.validado ? "✓ Validado" + (r.revisado ? " · corregido por el coach" : "") : "Sin validar" });
  const lc = Object.assign(document.createElement("label"), { textContent: "Categoría" });
  const sel = document.createElement("select");
  for (const c of ["RX", "Scaled", "Open"]) sel.append(new Option(c, c, false, c === r.categoria));
  const lv = Object.assign(document.createElement("label"), { textContent: tipo === "tiempo" ? "Tiempo (min:seg)" : tipo === "rondas" ? "Rondas+reps (p. ej. 5+12)" : "Kilos" });
  const val = Object.assign(document.createElement("input"), { value: escribirValor(r.valor, tipo) });
  const msg = Object.assign(document.createElement("div"), { className: "editor-msg" });
  const btns = document.createElement("div"); btns.className = "editor-btns";
  const boton = (t, c) => Object.assign(document.createElement("button"), { type: "button", textContent: t, className: c || "" });
  const guardar = boton("Guardar cambios", "si");
  const validar = boton("✓ Validar", "validar");
  const borrar = boton("Borrar", "borrar");
  const cerrar = boton("Cerrar");
  const error = (t) => { msg.className = "editor-msg error"; msg.textContent = t; };

  guardar.addEventListener("click", async () => {
    const v = leerValor(val.value, tipo);
    if (isNaN(v)) return error("Revisa el resultado.");
    try { await updateDoc(doc(db, "resultados", r.id), { categoria: sel.value, valor: v, revisado: true, validado: true }); dlg.close(); }
    catch (e) { console.error(e); error(e?.code === "permission-denied" ? "No se puede: el día ya está cerrado o no es la cuenta del coach." : "No se ha podido guardar."); }
  });
  validar.addEventListener("click", async () => {
    try { await updateDoc(doc(db, "resultados", r.id), { validado: true }); dlg.close(); }
    catch (e) { console.error(e); error("No se ha podido validar."); }
  });
  let seguro = false;
  borrar.addEventListener("click", async () => {
    if (!seguro) { seguro = true; borrar.textContent = "¿Seguro? Pulsa otra vez"; return; }
    try {
      const lote = writeBatch(db);
      lote.delete(doc(db, "resultados", r.id));
      if (r.uid) {
        const regRef = doc(db, "usuarios", r.uid, "movimientos", idRegistro(claseDe(r), r.fecha));
        if ((await getDoc(regRef)).exists()) {
          lote.delete(regRef);
          lote.update(doc(db, "usuarios", r.uid), { puntos: increment(-PUNTOS.registrar) });
        }
      }
      await lote.commit();
      dlg.close();
    } catch (e) { console.error(e); error("No se ha podido borrar."); }
  });
  cerrar.addEventListener("click", () => dlg.close());
  if (r.validado) validar.hidden = true;
  btns.append(guardar, validar, borrar, cerrar);
  dlg.append(titulo, sub, lc, sel, lv, val, msg, btns);
  dlg.showModal();
}
