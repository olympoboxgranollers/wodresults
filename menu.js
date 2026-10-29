// Menú común a todas las páginas + acceso con cuenta + editor de resultados para el coach.
import { doc, updateDoc, getDoc, setDoc, writeBatch, increment, collection, onSnapshot, query, where } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { db, PUNTOS, catDe, idRegistro, leerValor, escribirValor, claseDe, categoriasDe, hoy, copiaInsignia, crearInsignia, fmtPuntos, opcionesEjercicios, cosa, nombreBonito, campoMes, camposPeso } from "./comun.js?v=20261029c";
import { escucharCuenta, montarAcceso, salir } from "./cuenta.js?v=20261029c";
import { COACH_EMAIL } from "./config.js?v=20261029c";

// Cuenta para la TV del box (correo que empieza por "tv", p. ej. tv@olympobox.es): no pide perfil ni enseña avisos
export const esCuentaTV = (user) => !!user?.email && /^tv[@.+_-]/i.test(user.email);
export const esCuentaCoach = (user) => !!user && user.email?.toLowerCase() === COACH_EMAIL.toLowerCase();

// ---------- Entrenadores: socios normales que además pueden publicar el WOD y corregir resultados ----------
// La lista la gestiona solo el admin principal (publicar.html → Entrenadores) y se guarda en ajustes/entrenadores
let entrenadores = [], escuchandoEntrenadores = false, usuarioRol = null;
const oyentesRol = new Set();
export const esEntrenador = (user) => !!user && !esCuentaCoach(user) && entrenadores.includes((user.email || "").toLowerCase());
export const esStaff = (user) => esCuentaCoach(user) || esEntrenador(user);
const rolDe = (user) => ({ user, coach: esCuentaCoach(user), entrenador: esEntrenador(user), staff: esStaff(user) });
function arrancarEntrenadores() {
  if (escuchandoEntrenadores) return;
  escuchandoEntrenadores = true;
  onSnapshot(doc(db, "ajustes", "entrenadores"), (s) => {
    entrenadores = (s.exists() ? s.data().emails || [] : []).map((e) => String(e).toLowerCase());
    for (const cb of oyentesRol) cb(rolDe(usuarioRol));
  }, () => {});
}
// cb({ user, coach, entrenador, staff }) cada vez que cambia quién ha entrado o la lista de entrenadores
export function escucharRol(cb) {
  oyentesRol.add(cb);
  escucharCuenta(({ user }) => { usuarioRol = user; if (user) arrancarEntrenadores(); cb(rolDe(user)); });
}

// Iconos de línea propios (mismo trazo en todos)
const ICONOS = {
  resultado: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5"/><path d="M9.5 2.5h5"/><path d="M12 2.5V5"/>',
  ranking: '<path d="M8 3.5h8v5a4 4 0 0 1-8 0v-5z"/><path d="M8 5.5H5.5a3 3 0 0 0 3 4"/><path d="M16 5.5h2.5a3 3 0 0 1-3 4"/><path d="M12 12.5v3.5"/><path d="M8.5 20.5h7"/><path d="M10 16h4l.5 4.5h-5z"/>',
  puntos: '<path d="M12 3.2l2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 16.6l-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z"/>',
  pantalla: '<rect x="3" y="4.5" width="18" height="12" rx="2.5"/><path d="M8.5 20.5h7"/><path d="M12 16.5v4"/>',
  publicar: '<path d="M4.5 19.5l1-4.5L15.8 4.7a2 2 0 0 1 2.8 0l.7.7a2 2 0 0 1 0 2.8L9 18.5z"/><path d="M13.5 7l3.5 3.5"/>',
  entrar: '<path d="M14 4h3.5A2.5 2.5 0 0 1 20 6.5v11a2.5 2.5 0 0 1-2.5 2.5H14"/><path d="M9.5 16.5L14 12 9.5 7.5"/><path d="M14 12H3.5"/>',
  canjes: '<rect x="3.5" y="8.5" width="17" height="12" rx="2"/><path d="M3.5 12.5h17"/><path d="M12 8.5v12"/><path d="M12 8.5c-1.8 0-4.5-.6-4.5-2.6 0-1.3 1-2 2-2 2 0 2.5 2.6 2.5 4.6z"/><path d="M12 8.5c1.8 0 4.5-.6 4.5-2.6 0-1.3-1-2-2-2-2 0-2.5 2.6-2.5 4.6z"/>',
  logros: '<circle cx="12" cy="9" r="5.5"/><path d="M8.6 13.4L7 21l5-2.6 5 2.6-1.6-7.6"/><path d="M12 6.6l.8 1.6 1.7.2-1.2 1.2.3 1.7-1.6-.8-1.6.8.3-1.7-1.2-1.2 1.7-.2z"/>',
  perfil: '<circle cx="12" cy="8.5" r="4"/><path d="M4.5 20.5a7.5 7.5 0 0 1 15 0"/>',
  amigos: '<circle cx="9" cy="8.5" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17" cy="9.5" r="2.8"/><path d="M15.5 14.2A5.5 5.5 0 0 1 21.5 19.5"/>',
  eventos: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17"/><path d="M8 3v4"/><path d="M16 3v4"/><path d="M8 14h2"/><path d="M14 14h2"/><path d="M8 17h2"/>',
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

// ---------- Avisos de amistad: te han mandado una solicitud o han aceptado la tuya ----------
// Se recuerda en este móvil qué avisos ya se han visto para no repetirlos
const colaAmigos = [];
function avisosAmistad(miUid, lista) {
  const clave = "amigos-avisos-" + miUid;
  let vistos = null;
  try { vistos = JSON.parse(localStorage.getItem(clave) || "null"); } catch {}
  const primeraVez = !vistos; vistos = vistos || {};
  for (const a of lista) {
    const otro = (a.uids || []).find((x) => x !== miUid);
    const nombre = a.nombres?.[otro] || "Un socio";
    if (a.estado === "pendiente" && a.para === miUid && vistos[a.id] !== "pendiente") {
      vistos[a.id] = "pendiente"; colaAmigos.push({ tipo: "solicitud", id: a.id, otro, nombre });
    } else if (a.estado === "aceptada" && a.de === miUid && vistos[a.id] !== "aceptada") {
      vistos[a.id] = "aceptada";
      if (!primeraVez) colaAmigos.push({ tipo: "aceptada", id: a.id, otro, nombre });   // las antiguas no se avisan
    } else if (a.estado === "aceptada" && !vistos[a.id]) vistos[a.id] = "aceptada";
  }
  try { localStorage.setItem(clave, JSON.stringify(vistos)); } catch {}
  siguienteAvisoAmigo();
}
function siguienteAvisoAmigo() {
  if (document.querySelector(".aviso-amigo") || !colaAmigos.length) return;
  const a = colaAmigos.shift();
  const dlg = document.createElement("dialog"); dlg.className = "aviso-evento aviso-amigo";
  const h = (tag, cls, txt) => Object.assign(document.createElement(tag), { className: cls, textContent: txt });
  const ini = a.nombre.trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  const x = h("button", "aviso-evento-x", "✕"); x.type = "button"; x.setAttribute("aria-label", "Cerrar");
  const cuerpo = document.createElement("div"); cuerpo.className = "aviso-evento-txt";
  const acc = document.createElement("div"); acc.className = "aviso-evento-acc";
  const cerrar = () => { dlg.close(); dlg.remove(); setTimeout(siguienteAvisoAmigo, 250); };
  if (a.tipo === "solicitud") {
    cuerpo.append(h("small", "", "Solicitud de amistad"), h("b", "", a.nombre), h("span", "", "Quiere ser tu amigo en Olympo Box"));
    const luego = h("button", "aviso-evento-luego", "Ahora no"); luego.type = "button"; luego.addEventListener("click", cerrar);
    const si = h("button", "aviso-evento-ver", "Aceptar"); si.type = "button";
    si.addEventListener("click", async () => {
      si.disabled = true;
      try { await updateDoc(doc(db, "amistades", a.id), { estado: "aceptada" }); si.textContent = "✓ Ahora sois amigos"; setTimeout(cerrar, 900); }
      catch (e) { console.error(e); si.disabled = false; si.textContent = "Reintentar"; }
    });
    acc.append(luego, si);
  } else {
    cuerpo.append(h("small", "", "¡Nuevo amigo!"), h("b", "", a.nombre), h("span", "", "Ha aceptado tu solicitud de amistad"));
    const ok = h("button", "aviso-evento-luego", "Cerrar"); ok.type = "button"; ok.addEventListener("click", cerrar);
    const ver = h("a", "aviso-evento-ver", "Ver su perfil"); ver.href = "perfil.html?uid=" + encodeURIComponent(a.otro);
    acc.append(ok, ver);
  }
  x.addEventListener("click", cerrar);
  dlg.addEventListener("cancel", (ev) => { ev.preventDefault(); cerrar(); });
  dlg.addEventListener("click", (ev) => { if (ev.target === dlg) cerrar(); });
  dlg.append(x, h("div", "aviso-amigo-ini", ini), cuerpo, acc);
  document.body.append(dlg);
  try { dlg.showModal(); } catch { dlg.setAttribute("open", ""); }
}

// Ventana que explica los canjes mientras están cerrados
let dlgCanjes = null;
function explicarCanjes(coach) {
  if (!dlgCanjes) {
    dlgCanjes = document.createElement("dialog");
    dlgCanjes.className = "dialogo-perfil dialogo-canjes";
    dlgCanjes.addEventListener("click", (e) => { if (e.target === dlgCanjes) dlgCanjes.close(); });
    document.body.append(dlgCanjes);
  }
  const d = dlgCanjes; d.replaceChildren();
  const h = (tag, cls, txt) => Object.assign(document.createElement(tag), { className: cls, textContent: txt });
  const lista = document.createElement("ul"); lista.className = "canjes-pasos";
  [["Suma puntos", `+${PUNTOS.reserva} por cada clase que reservas en AimHarder, +${PUNTOS.registrarRX} por registrar tu resultado en RX (+${PUNTOS.registrar} en Open), y extra por el podio, los logros y los eventos.`],
   ["Elige tu premio", "En Canjes verás los productos y premios del box y cuántos puntos cuesta cada uno."],
   ["Canjéalo", "Pulsas Canjear, se descuentan los puntos de tu cartera y el coach te lo entrega en el box."]]
    .forEach(([t, x], i) => { const li = document.createElement("li"); li.append(h("b", "", `${i + 1}. ${t}`), h("span", "", x)); lista.append(li); });
  const acc = document.createElement("div"); acc.className = "canjes-acc";
  const ok = h("button", "canjes-ok", "Entendido"); ok.type = "button"; ok.addEventListener("click", () => d.close());
  if (coach) { const a = h("a", "canjes-link", "Entrar igualmente (admin)"); a.href = "canjes.html"; acc.append(a); }
  else { const a = h("a", "canjes-link", "Ver mi cartera"); a.href = "perfil.html#cartera"; acc.append(a); }
  acc.append(ok);
  d.append(h("div", "canjes-globo", "Próximamente"), h("h3", "canjes-titulo", "Canjes"),
    h("p", "canjes-texto", "Muy pronto podrás cambiar tus puntos por premios del box. Tus puntos ya cuentan: sigue sumando y tenlos listos para cuando abramos."),
    lista, acc);
  d.showModal();
}

const PAGINAS = [
  { id: "canjes",    href: "canjes.html",   texto: "Canjes", proximamente: true },   // bloqueado hasta abrir los canjes
  { id: "ranking",   href: "ranking.html",  texto: "Ranking" },
  { id: "resultado", href: "index.html",    texto: "Resultado" },
  { id: "logros",    href: "logros.html",   texto: "Logros", coach: true },   // los socios ven sus logros en su perfil
  { id: "eventos",   href: "eventos.html",  texto: "Eventos" },
  { id: "amigos",    href: "amigos.html",   texto: "Amigos", socio: true },
  { id: "perfil",    href: "perfil.html",   texto: "Perfil", socio: true },
  { id: "pantalla",  href: "pantalla.html", texto: "Pantalla", coach: true },  // solo el coach (los entrenadores solo Publicar)
  { id: "publicar",  href: "publicar.html", texto: "Publicar", staff: true }
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

  let user = null, solicitudesPendientes = 0, dejarSolicitudes = null;
  const pintar = () => {
    nav.replaceChildren();
    const coach = esCuentaCoach(user);
    let clase = "";
    try { clase = localStorage.getItem("wod-clase") || ""; } catch {}
    for (const p of PAGINAS) {
      if (p.coach && !coach) continue;
      if (p.staff && !esStaff(user)) continue;
      if (p.socio && coach) continue;               // el coach no tiene perfil de atleta
      // Apartado aún cerrado: globo "Próximamente" y, al tocarlo, una ventana que explica en qué consiste
      if (p.proximamente) {
        const b = Object.assign(document.createElement("button"), { type: "button", className: "menu-item menu-pronto" + (p.id === actual ? " activo" : "") });
        b.setAttribute("aria-label", `${p.texto}: próximamente`);
        b.append(icono(p.id), Object.assign(document.createElement("span"), { className: "menu-texto", textContent: p.texto }),
          Object.assign(document.createElement("span"), { className: "globo-menu", textContent: "Próximamente" }));
        b.addEventListener("click", () => explicarCanjes(coach));
        nav.append(b);
        continue;
      }
      const a = document.createElement("a");
      a.href = p.href + (clase && p.id !== "perfil" ? "?clase=" + clase : "");
      a.className = "menu-item" + (p.id === actual ? " activo" : "");
      if (p.id === actual) a.setAttribute("aria-current", "page");
      a.append(icono(p.id), Object.assign(document.createElement("span"), { className: "menu-texto", textContent: p.texto }));
      // Punto rojo en Amigos si alguien te ha mandado una solicitud
      if (p.id === "amigos" && solicitudesPendientes > 0) a.append(Object.assign(document.createElement("span"), { className: "menu-aviso", textContent: solicitudesPendientes > 9 ? "9+" : String(solicitudesPendientes) }));
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
  oyentesRol.add(() => pintar());
  escucharCuenta(({ user: u, ficha }) => {
    if (u) arrancarEntrenadores();
    usuarioRol = u;
    // Socios: logros que ya le tocan, aviso de logro nuevo y aviso de evento nuevo
    if (u && !esCuentaCoach(u) && !esCuentaTV(u) && ficha) { revisarLogros(u, ficha); avisarLogrosNuevos(u, ficha); }
    if (u && !esCuentaCoach(u) && !esCuentaTV(u)) vigilarEventosNuevos(actual);
    // Sin perfil de atleta no se puede usar la app: se pide una vez (el coach no lo necesita)
    // En la TV y en la Pantalla nunca se pide el perfil (se ven en grande en el box)
    if (u && !tv && !/\/(tv|pantalla)\.html$/.test(location.pathname) && !esCuentaTV(u) && ficha !== undefined && (esCuentaCoach(u) ? (!ficha || !ficha.nombre) : (!ficha || !ficha.atleta || !ficha.favorito || !ficha.odiado))) pedirPerfil(u, ficha);
    else if (dlgPerfil?.open) dlgPerfil.close();
    if (!u && protegida) {
      const volver = location.pathname.split("/").pop() + location.search;
      location.replace("index.html?volver=" + encodeURIComponent(volver));
      return;
    }
    document.documentElement.classList.remove("esperando-sesion");
    nav.hidden = !u;
    const cambio = (u?.uid || null) !== (user?.uid || null);
    user = u;
    // Solicitudes de amistad recibidas (para el aviso en el menú)
    if (cambio && !tv) {
      if (dejarSolicitudes) { dejarSolicitudes(); dejarSolicitudes = null; }
      solicitudesPendientes = 0;
      if (u && !esCuentaCoach(u) && !esCuentaTV(u)) dejarSolicitudes = onSnapshot(query(collection(db, "amistades"), where("uids", "array-contains", u.uid)), (s) => {
        solicitudesPendientes = s.docs.filter((d) => d.data().estado === "pendiente" && d.data().para === u.uid).length; pintar();
        avisosAmistad(u.uid, s.docs.map((d) => ({ id: d.id, ...d.data() })));
      }, () => {});
    }
    if (u && dialogo?.open) dialogo.close();
    if (cambio) { pintar(); alCambiar?.({ user, coach: esCuentaCoach(user) }); }
    // Con la sesión del coach abierta, cualquier página reparte los puntos de los días terminados
    if (cambio && esCuentaCoach(u)) import("./cierre.js?v=20261029c").then((m) => m.cerrarYLimpiar()).catch(() => {});
  });
  // Al cambiar de clase en la página, los enlaces llevan a esa misma clase
  addEventListener("storage", pintar);
  return { repintar: pintar };
}

// ---------- Logros: se dan solos al llegar a las clases y se avisan con una ventana ----------
let catalogoLogros = null, escuchandoLogros = false, otorgando = false, ultimaFicha = null, ultimoUser = null;
function revisarLogros(user, ficha) {
  ultimaFicha = ficha; ultimoUser = user;
  if (!escuchandoLogros) {
    escuchandoLogros = true;
    onSnapshot(collection(db, "logros"), (s) => { catalogoLogros = s.docs.map((d) => ({ id: d.id, ...cosa(d.data()) })); if (ultimaFicha) revisarLogros(ultimoUser, ultimaFicha); }, () => {});
  }
  if (!catalogoLogros || otorgando) return;
  const toca = catalogoLogros.filter((l) => l.clases > 0 && (ficha.clases || 0) >= l.clases && !ficha.insignias?.[l.id]).sort((a, b) => a.clases - b.clases);
  if (!toca.length) return;
  otorgando = true;
  (async () => {
    for (const l of toca) {
      try {
        const lote = writeBatch(db);
        lote.update(doc(db, "usuarios", user.uid), { [`insignias.${l.id}`]: copiaInsignia(l), puntos: increment(l.puntos || 0), ultimoLogro: l.id });
        lote.set(doc(db, "usuarios", user.uid, "movimientos", `logro_${l.id}`), { fecha: hoy(), tipo: "insignia", nombre: l.nombre, puntos: l.puntos || 0 });
        await lote.commit();
      } catch (e) { console.warn("No se ha podido dar el logro", l.id, e); }
    }
    otorgando = false;
  })();
}
let dlgLogro = null, colaLogros = [];
function avisarLogrosNuevos(user, ficha) {
  const clave = "logros-vistos-" + user.uid;
  const tiene = Object.keys(ficha.insignias || {});
  let vistos = null;
  try { vistos = JSON.parse(localStorage.getItem(clave) || "null"); } catch {}
  // La primera vez solo se avisa de los conseguidos hoy
  if (!Array.isArray(vistos)) vistos = tiene.filter((id) => ficha.insignias[id]?.fecha !== hoy());
  const nuevos = tiene.filter((id) => !vistos.includes(id));
  try { localStorage.setItem(clave, JSON.stringify([...new Set([...vistos, ...tiene])])); } catch {}
  for (const id of nuevos) if (!colaLogros.some((x) => x.id === id)) colaLogros.push({ id, ...ficha.insignias[id] });
  mostrarSiguienteLogro();
}
function mostrarSiguienteLogro() {
  if (dlgLogro?.open || !colaLogros.length) return;
  const l = colaLogros.shift();
  if (!dlgLogro) {
    dlgLogro = document.createElement("dialog"); dlgLogro.className = "dialogo-logro";
    document.body.append(dlgLogro);
    dlgLogro.addEventListener("close", () => setTimeout(mostrarSiguienteLogro, 250));
  }
  dlgLogro.replaceChildren();
  const med = crearInsignia(l, 150); med.classList.add("logro-medalla");
  const ok = Object.assign(document.createElement("button"), { type: "button", textContent: "¡Genial!" });
  ok.addEventListener("click", () => dlgLogro.close());
  dlgLogro.append(
    Object.assign(document.createElement("div"), { className: "logro-etq", textContent: "Nuevo logro" }),
    med,
    Object.assign(document.createElement("h3"), { textContent: l.nombre }),
    Object.assign(document.createElement("p"), { textContent: l.puntos ? `Has ganado ${fmtPuntos(l.puntos)} puntos. ¡Sigue así!` : "¡Enhorabuena, sigue así!" }),
    ok);
  dlgLogro.showModal();
}

// ---------- Avisos de eventos ----------
// · Evento nuevo: se anuncia al entrar en la app hasta que el socio cierra el aviso.
// · Recordatorio: cada 2 semanas mientras falte para el evento (a quien no se ha apuntado).
// · Última semana: un último aviso cuando faltan 7 días o menos (también a los apuntados).
// Solo sale un aviso a la vez y se guarda en el móvil de cada socio.
let escuchandoEventos = false;
const DIA = 86400000;
function vigilarEventosNuevos(paginaActual) {
  if (escuchandoEventos) return;
  escuchandoEventos = true;
  const clave = "eventos-avisos";
  const leer = () => { try { return JSON.parse(localStorage.getItem(clave) || "{}"); } catch { return {}; } };
  const guardar = (o) => { try { localStorage.setItem(clave, JSON.stringify(o)); } catch {} };
  // Solo los eventos que aún no han pasado
  onSnapshot(query(collection(db, "eventos"), where("fecha", ">=", hoy())), async (s) => {
    const ahora = Date.now(), estado = leer();
    const futuros = s.docs.map((d) => ({ id: d.id, ...cosa(d.data()) })).filter((e) => e.fecha >= hoy()).sort((a, b) => a.fecha.localeCompare(b.fecha));
    // Limpia lo guardado de eventos que ya pasaron
    for (const id of Object.keys(estado)) if (!futuros.some((e) => e.id === id)) delete estado[id];
    // Solo se avisa del SIGUIENTE evento, y en tres momentos: cuando falta un mes, una semana y el día antes (cada uno una vez)
    const e = futuros[0];
    if (!e) { guardar(estado); return; }
    const dias = Math.round((new Date(e.fecha + "T12:00:00") - new Date(hoy() + "T12:00:00")) / DIA);
    const etapa = dias <= 1 ? "dia" : dias <= 7 ? "semana" : dias <= 30 ? "mes" : null;
    if (!etapa) { guardar(estado); return; }
    const st = estado[e.id] || {};
    const marcarEtapa = () => { const o = leer(); const prev = o[e.id] || {}; o[e.id] = { ...prev, [etapa]: true, ...(etapa !== "mes" ? { mes: true } : {}), ...(etapa === "dia" ? { semana: true } : {}) }; guardar(o); };
    if (st[etapa]) { guardar(estado); return; }
    guardar(estado);
    // En la propia página de eventos ya se ve: cuenta como visto
    if (paginaActual === "eventos") { marcarEtapa(); return; }
    if (document.querySelector(".aviso-evento")) return;
    let voy = false;
    if (usuarioRol) { try { voy = (await getDoc(doc(db, "eventos", e.id, "asistentes", usuarioRol.uid))).exists(); } catch {} }
    // A quien ya está apuntado no hace falta recordarle el aviso del mes
    if (voy && etapa === "mes") { marcarEtapa(); return; }
    mostrarAvisoEvento(e, etapa === "mes" ? "recuerda" : "final", dias, voy, marcarEtapa);
  }, () => {});
}
// Aviso de evento: ventana en el centro de la pantalla, con fondo oscuro detrás para que se lea bien
function mostrarAvisoEvento(e, tipo, dias, voy, marcar) {
  const dlg = document.createElement("dialog"); dlg.className = "aviso-evento";
  const f = new Date(e.fecha + "T12:00:00");
  const fecha = f.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
  const cuando = dias === 0 ? "es hoy" : dias === 1 ? "es mañana" : `faltan ${dias} días`;
  const etiqueta = tipo === "nuevo" ? "Nuevo evento" : tipo === "final" ? (voy ? `Te apuntaste · ${cuando[0].toUpperCase() + cuando.slice(1)}` : `¡${cuando[0].toUpperCase() + cuando.slice(1)}!`) : `Recuerda · ${cuando[0].toUpperCase() + cuando.slice(1)}`;
  const h = (tag, cls, txt) => Object.assign(document.createElement(tag), { className: cls, textContent: txt });
  const cerrarX = h("button", "aviso-evento-x", "✕"); cerrarX.type = "button"; cerrarX.setAttribute("aria-label", "Cerrar aviso");
  // Calendario con el día y el mes
  const cal = document.createElement("div"); cal.className = "aviso-evento-cal";
  cal.append(h("b", "", String(f.getDate())), h("span", "", (m => m[0].toUpperCase() + m.slice(1))(f.toLocaleDateString("es-ES", { month: "short" }).replace(".", ""))));
  const cuerpo = document.createElement("div"); cuerpo.className = "aviso-evento-txt";
  cuerpo.append(h("small", "", etiqueta), h("b", "", e.titulo || "Evento"),
    h("span", "", fecha[0].toUpperCase() + fecha.slice(1) + (e.hora ? ` · ${e.hora}` : "") + (e.lugar ? ` · ${e.lugar}` : "")));
  if (e.descripcion) cuerpo.append(h("p", "aviso-evento-desc", e.descripcion));
  if (e.puntos && !voy) cuerpo.append(h("div", "aviso-evento-pts", `+${fmtPuntos(e.puntos)} puntos si vienes`));
  const acc = document.createElement("div"); acc.className = "aviso-evento-acc";
  const ver = h("a", "aviso-evento-ver", voy ? "Ver evento" : "Ver y apuntarme"); ver.href = "eventos.html";
  const luego = h("button", "aviso-evento-luego", "Ahora no"); luego.type = "button";
  acc.append(luego, ver);
  const cerrar = () => { marcar(); dlg.close(); dlg.remove(); };
  cerrarX.addEventListener("click", cerrar); luego.addEventListener("click", cerrar);
  ver.addEventListener("click", marcar);
  dlg.addEventListener("cancel", (ev) => { ev.preventDefault(); cerrar(); });
  dlg.addEventListener("click", (ev) => { if (ev.target === dlg) cerrar(); });
  dlg.append(cerrarX, cal, cuerpo, acc);
  document.body.append(dlg);
  try { dlg.showModal(); } catch { dlg.setAttribute("open", ""); }
}

// ---------- Paneles plegables del coach (crear eventos, logros, productos…) ----------
// caja: el panel entero · cab: su título (al tocarlo se pliega o despliega) · clave: para recordarlo
export function plegable(caja, cab, clave, { abierto = false } = {}) {
  if (!caja || !cab) return { abrir() {} };
  caja.classList.add("plegable"); cab.classList.add("plegable-cab");
  cab.setAttribute("role", "button"); cab.tabIndex = 0;
  let plegado = !abierto;
  try { const g = localStorage.getItem("plegado-" + clave); if (g !== null) plegado = g === "1"; } catch {}
  const poner = (v) => {
    plegado = v; caja.classList.toggle("plegado", v); cab.setAttribute("aria-expanded", String(!v));
    try { localStorage.setItem("plegado-" + clave, v ? "1" : "0"); } catch {}
  };
  poner(plegado);
  cab.addEventListener("click", () => poner(!plegado));
  cab.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); poner(!plegado); } });
  return { abrir: () => poner(false), cerrar: () => poner(true) };
}

// ---------- Perfil de atleta obligatorio ----------
let dlgPerfil = null;
function pedirPerfil(user, ficha) {
  if (dlgPerfil?.open) return;
  if (!dlgPerfil) {
    dlgPerfil = document.createElement("dialog");
    dlgPerfil.className = "dialogo-perfil";
    dlgPerfil.addEventListener("cancel", (e) => e.preventDefault());  // no se puede cerrar sin crearlo
    document.body.append(dlgPerfil);
  }
  dlgPerfil.innerHTML = `
    <form method="dialog" autocomplete="off">
      <div class="perfil-marca">Olympo Box</div>
      <h3>${ficha?.atleta ? "Completa tu perfil" : "Crea tu perfil de atleta"}</h3>
      <p>Tu nombre saldrá en tus resultados, en el ranking y en tu perfil. Lo pones una vez y después lo puedes cambiar desde tu perfil.</p>
      <label>Nombre y apellido<input name="nombre" maxlength="40" required autocomplete="name"></label>
      <label><span>Ejercicio favorito</span><select name="favorito" required></select></label>
      <label><span>Ejercicio más odiado</span><select name="odiado" required></select></label>
      <div class="perfil-msg" role="status"></div>
      <button type="submit">Crear mi perfil</button>
    </form>`;
  const f = dlgPerfil.querySelector("form");
  f.nombre.value = (ficha?.nombre || user.displayName || "").slice(0, 40);
  opcionesEjercicios(f.favorito, ficha?.favorito || "");
  opcionesEjercicios(f.odiado, ficha?.odiado || "");
  f.addEventListener("submit", async (e) => {
    e.preventDefault();
    const limpio = (t) => t.trim().replace(/\s+/g, " ").slice(0, 40);
    const nombre = nombreBonito(limpio(f.nombre.value)), favorito = limpio(f.favorito.value), odiado = limpio(f.odiado.value);
    const msg = f.querySelector(".perfil-msg");
    if (nombre.length < 2) { msg.textContent = "Escribe tu nombre y apellido."; return; }
    if (!favorito || !odiado) { msg.textContent = "Rellena tu ejercicio favorito y el más odiado."; return; }
    f.querySelector("button").disabled = true;
    try {
      const ref = doc(db, "usuarios", user.uid);
      const actual = await getDoc(ref);
      if (actual.exists()) await updateDoc(ref, { nombre, favorito, odiado, atleta: true });
      else await setDoc(ref, { nombre, puntos: 0, favorito, odiado, atleta: true, alta: new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Madrid" }) });
      dlgPerfil.close();
    } catch (err) { console.error(err); msg.textContent = "No se ha podido guardar. Inténtalo de nuevo."; f.querySelector("button").disabled = false; }
  });
  dlgPerfil.showModal();
  setTimeout(() => f.nombre.focus(), 50);
}

// ---------- Protección: no se puede copiar texto, guardar imágenes ni abrir el menú del botón derecho ----------
(function protegerCopia() {
  const editable = (el) => el && (el.closest?.("input, textarea, select, [contenteditable]"));
  document.documentElement.classList.add("sin-copia");
  addEventListener("contextmenu", (e) => { if (!editable(e.target)) e.preventDefault(); });
  addEventListener("copy", (e) => { if (!editable(e.target)) e.preventDefault(); });
  addEventListener("cut", (e) => { if (!editable(e.target)) e.preventDefault(); });
  addEventListener("dragstart", (e) => { if (e.target?.tagName === "IMG") e.preventDefault(); });
  addEventListener("keydown", (e) => {
    const k = e.key?.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && ["s", "u", "p"].includes(k)) e.preventDefault();
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && ["i", "j", "c"].includes(k)) e.preventDefault();
    if (k === "f12") e.preventDefault();
  });
})();

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
  for (const c of categoriasDe(claseDe(r))) sel.append(new Option(c, c, false, c === catDe(r)));
  const ls = Object.assign(document.createElement("label"), { textContent: "Sexo" });
  const selSexo = document.createElement("select");
  selSexo.append(new Option("Chico", "M", false, r.sexo === "M"), new Option("Chica", "F", false, r.sexo === "F"));
  if (!r.sexo) selSexo.prepend(new Option("Sin indicar", "", true, true));
  const lv = Object.assign(document.createElement("label"), { textContent: tipo === "emom" ? "¿Completado? (Sí / No)" : tipo === "tiempo" ? "Tiempo (min:seg) · si no lo acabó: 120 reps" : tipo === "rondas" ? "Rondas+reps (p. ej. 5+12)" : "Kilos" });
  const val = Object.assign(document.createElement("input"), { value: escribirValor(r.valor, tipo) });
  const peso = camposPeso(r);
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
    let pesos; try { pesos = peso.leer(); } catch (t) { return error(t); }
    try { await updateDoc(doc(db, "resultados", r.id), { categoria: sel.value, valor: v, ...pesos, revisado: true, validado: true, ...(selSexo.value ? { sexo: selSexo.value } : {}) }); dlg.close(); }
    catch (e) {
      console.error(e);
      if (e?.code !== "permission-denied") return error("No se ha podido guardar.");
      // Explica el motivo: día ya cerrado, o reglas de Firebase sin actualizar
      let cerrado = false;
      try { cerrado = (await getDoc(doc(db, "cierres", `${r.fecha || hoy()}_${claseDe(r)}`))).exists(); } catch {}
      error(cerrado ? "No se puede: este día ya está cerrado (los puntos ya se repartieron)."
        : "Firebase no ha dejado guardar. Publica las reglas nuevas (reglas-firestore.txt) en Firebase → Firestore → Reglas.");
    }
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
        const reg = await getDoc(regRef);
        if (reg.exists()) {
          const pts = reg.data().puntos || PUNTOS.registrar;   // 20 si era RX, 10 si era Open
          lote.delete(regRef);
          lote.update(doc(db, "usuarios", r.uid), { puntos: increment(-pts), puntosRanking: increment(-pts), [campoMes(r.fecha || hoy())]: increment(-pts), mesBorrado: campoMes(r.fecha || hoy()) });
        }
      }
      await lote.commit();
      dlg.close();
    } catch (e) { console.error(e); error("No se ha podido borrar."); }
  });
  cerrar.addEventListener("click", () => dlg.close());
  if (r.validado) validar.hidden = true;
  btns.append(guardar, validar, borrar, cerrar);
  dlg.append(titulo, sub, lc, sel, ls, selSexo, lv, val, peso.el, msg, btns);
  dlg.showModal();
}
