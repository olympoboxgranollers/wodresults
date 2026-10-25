import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig, ZONA_HORARIA } from "./config.js";

export const app = initializeApp(firebaseConfig);
// Memoria local en el móvil: al cambiar de página solo se descarga lo que ha cambiado (ahorra lecturas del plan gratis)
export const db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });

// Fecha de hoy en formato YYYY-MM-DD según la zona horaria del box
export function hoy() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: ZONA_HORARIA });
}

// ---------- Clases del box ----------
// Cada clase tiene su propio WOD del día, su ranking y su color
export const CLASES = {
  wod:       { nombre: "WOD",       color: "#c39bd3" },  // lila malva
  hyrox:     { nombre: "Hyrox",     color: "#f2d03b" },  // amarillo
  funcional: { nombre: "Funcional", color: "#33d1e0" }   // azul cian
};

// Id del WOD de hoy para una clase, p. ej. "2026-10-23_hyrox"
export const idWod = (clase) => `${hoy()}_${clase}`;

// Clase de un resultado (los antiguos sin clase cuentan como WOD)
export const claseDe = (r) => r.clase || "wod";

// Clase con la que se abre la página: la del enlace (?clase=hyrox), la última usada o WOD
export function claseInicial() {
  const p = new URLSearchParams(location.search).get("clase");
  if (CLASES[p]) return p;
  try { const g = localStorage.getItem("wod-clase"); if (CLASES[g]) return g; } catch {}
  return "wod";
}
export function recordarClase(clase) { try { localStorage.setItem("wod-clase", clase); } catch {} }

// Pinta la página con el color de la clase (todo lo que era lila usa este color)
export function ponerColorClase(clase) {
  document.documentElement.style.setProperty("--malva", CLASES[clase].color);
  document.documentElement.dataset.clase = clase;
}

// Crea los botones de pestañas de clase dentro de un contenedor
export function crearPestanas(contenedor, actual, alCambiar) {
  contenedor.replaceChildren();
  for (const [clave, c] of Object.entries(CLASES)) {
    const b = document.createElement("button");
    b.type = "button"; b.dataset.v = clave; b.textContent = c.nombre;
    b.style.setProperty("--c", c.color);
    b.setAttribute("aria-pressed", clave === actual);
    b.addEventListener("click", () => {
      contenedor.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", x === b));
      alCambiar(clave);
    });
    contenedor.append(b);
  }
}

// Tipos de puntuación: "tiempo" (menos es mejor), "rondas" y "kg" (más es mejor)
// En "rondas" el valor se guarda como rondas * 1000 + reps sueltas (para poder ordenar)
export const TIPOS = {
  tiempo: { etiqueta: "Por tiempo", corto: "Tiempo", menosEsMejor: true },
  rondas: { etiqueta: "AMRAP (rondas + reps)", corto: "Rondas", menosEsMejor: false },
  kg:     { etiqueta: "Carga (kg)", corto: "Kg", menosEsMejor: false }
};

export function formatearValor(valor, tipo) {
  if (tipo === "tiempo") {
    const m = Math.floor(valor / 60);
    const s = Math.round(valor % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  }
  if (tipo === "kg") return `${valor} kg`;
  const rondas = Math.floor(valor / 1000);
  const reps = valor % 1000;
  const txt = `${rondas} ronda${rondas === 1 ? "" : "s"}`;
  return reps ? `${txt} + ${reps}` : txt;
}

// Categorías de más a menos nivel: RX > Scaled > Open
export const CATEGORIAS = ["RX", "Scaled", "Open"];
const ORDEN_CATEGORIA = { RX: 0, Scaled: 1, Open: 2 };

// Material que se puede indicar en Open (con el peso usado en kg)
export const MATERIAL = {
  wallball:   { nombre: "Wall ball",  corto: "WB" },
  dumbbell:   { nombre: "Dumbbell",   corto: "DB" },
  kettlebell: { nombre: "Kettlebell", corto: "KB" },
  barbell:    { nombre: "Barbell",    corto: "BB" }
};

// Texto corto con los pesos de Open, p. ej. "WB 6 · DB 15 kg"
export function textoPesos(pesos) {
  if (!pesos) return "";
  const partes = Object.keys(MATERIAL).filter((k) => pesos[k]).map((k) => `${MATERIAL[k].corto} ${pesos[k]}`);
  return partes.length ? partes.join(" · ") + " kg" : "";
}

// Ordena según el tipo del WOD: primero RX, luego Scaled y luego Open,
// y dentro de cada categoría por resultado. Los de otro tipo van al final.
export function ordenar(lista, tipo) {
  const menos = TIPOS[tipo]?.menosEsMejor ?? false;
  const orden = (r) => ORDEN_CATEGORIA[r.categoria] ?? 9;
  const mismos = lista.filter((r) => (r.tipo || tipo) === tipo);
  const otros = lista.filter((r) => (r.tipo || tipo) !== tipo);
  mismos.sort((a, b) => orden(a) - orden(b) || (menos ? a.valor - b.valor : b.valor - a.valor));
  return [...mismos, ...otros];
}

// Posición de cada atleta en una lista ya ordenada.
// Si dos tienen el mismo resultado en la misma categoría, comparten posición (1, 2, 2, 4…)
export function posiciones(lista) {
  const pos = [];
  lista.forEach((r, i) => {
    const ant = lista[i - 1];
    const empate = ant && ant.categoria === r.categoria && ant.valor === r.valor && ant.tipo === r.tipo;
    pos.push(empate ? pos[i - 1] : i + 1);
  });
  return pos;
}

// Sensaciones que el socio puede elegir al enviar su resultado (opcional)
// "codigo" es el nombre del dibujo 3D (emojis Fluent 3D de Microsoft, de uso libre)
export const SENSACIONES = {
  duro:     { emoji: "😫", codigo: "1f62b", texto: "Muy duro" },
  bien:     { emoji: "🙂", codigo: "1f642", texto: "Bien" },
  sobrado:  { emoji: "😎", codigo: "1f60e", texto: "Sobrado" },
  muerto:   { emoji: "💀", codigo: "1f480", texto: "Me ha matado" },
  fuego:    { emoji: "🔥", codigo: "1f525", texto: "A tope" },
  molestia: { emoji: "🤕", codigo: "1f915", texto: "Con molestias" }
};

// Crea el emoji en 3D; si la imagen no carga, muestra el emoji normal del aparato
export function crearEmoji(clave, clase = "emoji") {
  const s = SENSACIONES[clave];
  if (!s) return null;
  const img = document.createElement("img");
  img.className = clase;
  img.alt = s.emoji;
  img.title = s.texto;
  img.src = `https://unpkg.com/@lobehub/fluent-emoji-3d@1.1.0/assets/${s.codigo}.webp`;
  img.onerror = () => {
    const t = document.createElement("span");
    t.className = clase;
    t.textContent = s.emoji;
    img.replaceWith(t);
  };
  return img;
}

// ---------- Pique: líderes, empates y mensajes ----------

// Clasificación de una categoría (RX o Scaled) con sus posiciones
export function clasificacionDe(resultados, tipo, categoria) {
  const lista = ordenar(resultados.filter((r) => (r.tipo || tipo) === tipo && r.categoria === categoria), tipo);
  return { lista, pos: posiciones(lista) };
}

// Ids de quienes van primeros en cada categoría
export function lideres(resultados, tipo) {
  const mapa = {};
  for (const cat of CATEGORIAS) {
    const { lista, pos } = clasificacionDe(resultados, tipo, cat);
    mapa[cat] = lista.filter((_, i) => pos[i] === 1);
  }
  return mapa;
}

const nombres = (l) => l.map((r) => r.nombre).join(" y ");

// Compara los líderes de antes y de ahora y devuelve los avisos para la pantalla
// Cada aviso: { icono, etiqueta, destacado, texto }
export function mensajesDeLider(antes, ahora) {
  const msgs = [];
  for (const cat of CATEGORIAS) {
    const a = (antes?.[cat] || []).map((r) => r.id).sort().join();
    const b = (ahora[cat] || []).map((r) => r.id).sort().join();
    if (!b || a === b) continue;
    const nuevos = ahora[cat];
    if (nuevos.length > 1) {
      msgs.push({ icono: "⚔️", etiqueta: `Empate en cabeza · ${cat}`, destacado: nombres(nuevos), texto: "comparten el primer puesto" });
    } else if (antes?.[cat]?.length) {
      msgs.push({ icono: "👑", etiqueta: `Nuevo líder · ${cat}`, destacado: nuevos[0].nombre, texto: `le quita el primer puesto a ${nombres(antes[cat])}` });
    } else {
      msgs.push({ icono: "👑", etiqueta: `Primer líder · ${cat}`, destacado: nuevos[0].nombre, texto: "se pone en cabeza" });
    }
  }
  return msgs;
}

// Aviso flotante en la parte de arriba de la página
const colaAvisos = [];
let mostrandoAviso = false;
export function aviso(texto) {
  colaAvisos.push(texto);
  if (!mostrandoAviso) siguienteAviso();
}
function siguienteAviso() {
  const m = colaAvisos.shift();
  if (!m) { mostrandoAviso = false; return; }
  mostrandoAviso = true;
  const el = document.createElement("div");
  el.className = "aviso-flotante";
  const ico = document.createElement("div"); ico.className = "aviso-icono"; ico.textContent = m.icono || "👑";
  const cuerpo = document.createElement("div"); cuerpo.className = "aviso-cuerpo";
  const et = document.createElement("div"); et.className = "aviso-etiqueta"; et.textContent = m.etiqueta || "";
  const linea = document.createElement("div"); linea.className = "aviso-linea";
  const dest = document.createElement("strong"); dest.textContent = m.destacado || "";
  linea.append(dest, document.createTextNode(m.texto ? " " + m.texto : ""));
  cuerpo.append(et, linea);
  el.append(ico, cuerpo);
  document.body.append(el);
  setTimeout(() => el.classList.add("fuera"), 6500);
  setTimeout(() => { el.remove(); siguienteAviso(); }, 7100);
}

// ---------- Puntos ----------
// 10 por registrar (igual en todas las categorías) + extra por el podio de su categoría.
// Scaled suma la mitad que RX y Open la mitad que Scaled. Los empates comparten puesto.
export const PUNTOS = {
  registrar: 10,
  podio: {
    RX:     { 1: 30,  2: 20, 3: 10 },
    Scaled: { 1: 15,  2: 10, 3: 5 },
    Open:   { 1: 7.5, 2: 5,  3: 2.5 }
  }
};
// 7.5 -> "7,5"; 40 -> "40"
export const fmtPuntos = (n) => (Math.round(n * 10) / 10).toLocaleString("es-ES");

// Id del resultado de un socio: uno por socio, clase y día
export const idResultado = (clase, uid) => `${hoy()}_${clase}_${uid}`;
export const idCierre = (clase, fecha = hoy()) => `${fecha}_${clase}`;
export const idRegistro = (clase, fecha = hoy()) => `${fecha}_${clase}_reg`;

// Calcula los puntos de cada socio de una clase (solo resultados con cuenta y en la medida del WOD)
export function calcularPuntos(resultados, tipo) {
  const filas = [];
  for (const cat of CATEGORIAS) {
    const { lista, pos } = clasificacionDe(resultados.filter((r) => r.uid), tipo, cat);
    lista.forEach((r, i) => {
      const extra = PUNTOS.podio[cat]?.[pos[i]] || 0;
      filas.push({ r, categoria: cat, posicion: pos[i], puntos: PUNTOS.registrar + extra });
    });
  }
  return filas;
}

// Convierte lo que escribe el coach al editar ("9:12", "5+12", "85") al valor guardado
export function leerValor(texto, tipo) {
  const t = String(texto).trim().replace(",", ".");
  if (tipo === "tiempo") {
    const m = t.match(/^(\d{1,3}):(\d{1,2})$/);
    if (!m || +m[2] > 59) return NaN;
    return +m[1] * 60 + +m[2];
  }
  if (tipo === "rondas") {
    const m = t.match(/^(\d{1,3})(?:\s*\+\s*(\d{1,3}))?$/);
    return m ? +m[1] * 1000 + +(m[2] || 0) : NaN;
  }
  const n = parseFloat(t);
  return n > 0 && n <= 1000 ? n : NaN;
}
export function escribirValor(valor, tipo) {
  if (tipo === "tiempo") return `${Math.floor(valor / 60)}:${String(valor % 60).padStart(2, "0")}`;
  if (tipo === "rondas") return `${Math.floor(valor / 1000)}+${valor % 1000}`;
  return String(valor);
}

// Títulos de cabecera: la palabra WOD va en minúscula ("Wod del día")
export const titulo = (t) => String(t || "").replace(/\bWOD\b/g, (m, i) => (i === 0 ? "Wod" : "wod"));

// ---------- Logros (insignias) ----------
// El catálogo está en Firebase (colección "logros") y el coach lo va ampliando.
// Estos son los primeros, que el coach puede crear de golpe con un botón.
export const LOGROS_INICIALES = [
  { id: "clases100",  nombre: "100 clases",  corto: "100",  unidad: "clases", descripcion: "Has entrenado 100 clases con nosotros.",  puntos: 100, orden: 100,  nivel: "bronce",   clases: 100,  imagen: "bronce" },
  { id: "clases250",  nombre: "250 clases",  corto: "250",  unidad: "clases", descripcion: "Has entrenado 250 clases con nosotros.",  puntos: 200, orden: 250,  nivel: "plata",    clases: 250,  imagen: "plata" },
  { id: "clases500",  nombre: "500 clases",  corto: "500",  unidad: "clases", descripcion: "Has entrenado 500 clases con nosotros.",  puntos: 350, orden: 500,  nivel: "oro",      clases: 500,  imagen: "oro" },
  { id: "clases750",  nombre: "750 clases",  corto: "750",  unidad: "clases", descripcion: "Has entrenado 750 clases con nosotros.",  puntos: 500, orden: 750,  nivel: "diamante", clases: 750,  imagen: "diamante" },
  { id: "clases1000", nombre: "1000 clases", corto: "1000", unidad: "clases", descripcion: "Has entrenado 1000 clases con nosotros.", puntos: 750, orden: 1000, nivel: "olimpo",   clases: 1000, imagen: "olimpo" }
];
// Medallas ilustradas que se pueden elegir al crear un logro (carpeta medallas/)
export const MEDALLAS = {
  bronce:        { nombre: "Bronce · casco espartano", nivel: "bronce",   numero: true },
  plata:         { nombre: "Plata · Zeus",             nivel: "plata",    numero: true },
  oro:           { nombre: "Oro · Partenón",           nivel: "oro",      numero: true },
  diamante:      { nombre: "Diamante · Pegaso",        nivel: "diamante", numero: true },
  olimpo:        { nombre: "Olimpo · monte Olimpo",    nivel: "olimpo",   numero: true },
  deadlift:      { nombre: "Deadlift",       color: "#d98a4e" },
  backsquat:     { nombre: "Back squat",     color: "#a98ad9" },
  frontsquat:    { nombre: "Front squat",    color: "#4fb07a" },
  shoulderpress: { nombre: "Shoulder press", color: "#e8b83a" },
  cleanjerk:     { nombre: "Clean & jerk",   color: "#4f9be8" },
  snatch:        { nombre: "Snatch",         color: "#b05ce8" },
  benchpress:    { nombre: "Bench press",    color: "#e85454" }
};
export const rutaMedalla = (id) => `medallas/${id}.webp`;
// Imagen de una medalla. Si la carpeta medallas/ no carga (no subida o en otra ruta),
// prueba en la raíz y, si tampoco, usa la copia guardada dentro del código.
export function imagenMedalla(id) {
  const img = Object.assign(document.createElement("img"), { src: rutaMedalla(id), alt: "", draggable: false, decoding: "async" });
  let intento = 0;
  img.addEventListener("error", () => {
    intento++;
    if (intento === 1) img.src = `${id}.webp`;
    else if (intento === 2) import("./medallas-datos.js").then((m) => { if (m.MEDALLAS_DATOS[id]) img.src = m.MEDALLAS_DATOS[id]; }).catch(() => {});
  });
  return img;
}
// Niveles de dificultad de los logros: cuanto más difícil, más exótica la medalla
export const NIVELES = {
  bronce:   { nombre: "Bronce",   texto: "#ffc89a", color: "#c47a45" },
  plata:    { nombre: "Plata",    texto: "#eef1f6", color: "#b9c3d4" },
  oro:      { nombre: "Oro",      texto: "#ffd969", color: "#f2c230" },
  diamante: { nombre: "Diamante", texto: "#c9f6ff", color: "#7fe3ff" },
  olimpo:   { nombre: "Olimpo",   texto: "#ffe9a8", color: "#e040fb" }
};
// El platino ya no existe: lo que se guardó como platino se ve como diamante
export const nivelDe = (n) => (n === "platino" ? "diamante" : NIVELES[n] ? n : "");
// Logros conseguidos por un socio, del más importante al menos
export function insigniasDe(ficha) {
  const m = ficha?.insignias || {};
  return Object.entries(m).map(([id, v]) => ({ id, ...v })).sort((a, b) => (b.orden || 0) - (a.orden || 0) || String(b.fecha).localeCompare(String(a.fecha)));
}
// Estrella de n puntas (canto dentado de la plata)
function estrella(n, R, r, cx = 30, cy = 30) {
  const p = [];
  for (let i = 0; i < n * 2; i++) { const a = (Math.PI * i) / n - Math.PI / 2, d = i % 2 ? r : R; p.push((cx + d * Math.cos(a)).toFixed(2) + "," + (cy + d * Math.sin(a)).toFixed(2)); }
  return p.join(" ");
}
// Rama de laurel con hojas de verdad (punta y nervio), a los dos lados, de abajo (desde) a arriba (hasta)
function laurel(cx, cy, R, relleno, nervio, desde = -70, hasta = 60, hojas = 8, tam = 1) {
  let h = "";
  const hoja = (x, y, rot, t) => `<g transform="translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${rot.toFixed(1)}) scale(${t.toFixed(3)})"><path d="M0 0 C1.6 -1.9 4.6 -2.1 7.2 0 C4.6 2.1 1.6 1.9 0 0Z" fill="${relleno}"/><path d="M0.6 0 L6.4 0" stroke="${nervio}" stroke-width=".35" stroke-linecap="round"/></g>`;
  // Hojas alternas a lo largo del tallo: una hacia fuera, la siguiente hacia dentro
  const total = hojas * 2;
  for (let i = 0; i < total; i++) {
    const deg = desde + ((hasta - desde) * i) / (total - 1), a = (deg * Math.PI) / 180;
    const t = tam * (0.78 + 0.22 * (1 - i / (total - 1)));
    const fuera = i % 2 === 0;
    const r = R + (fuera ? 1.4 : -0.6);
    const x = cx + r * Math.cos(a), y = cy - r * Math.sin(a);
    const rot = -deg - 90 + (fuera ? -34 : 30);
    h += hoja(x, y, rot, t) + hoja(cx - r * Math.cos(a), y, 180 - rot, t);
  }
  // tallos
  const arco = (sx) => { const a1 = (desde * Math.PI) / 180, a2 = (hasta * Math.PI) / 180;
    return `<path d="M${(cx + sx * R * Math.cos(a1)).toFixed(2)} ${(cy - R * Math.sin(a1)).toFixed(2)} A${R} ${R} 0 0 ${sx > 0 ? 0 : 1} ${(cx + sx * R * Math.cos(a2)).toFixed(2)} ${(cy - R * Math.sin(a2)).toFixed(2)}" fill="none" stroke="${nervio}" stroke-width=".6" opacity=".7"/>`; };
  return arco(1) + arco(-1) + h;
}
// Colores de cristal de cada nivel (luz, color, fondo)
const CRISTAL = {
  bronce:   { luz: "#ffd9b8", medio: "#e3894a", profundo: "#2e1405" },
  plata:    { luz: "#ffffff", medio: "#b9c8e0", profundo: "#161d2b" },
  oro:      { luz: "#fff4b5", medio: "#f2bf2a", profundo: "#2e2002" },
  diamante: { luz: "#e9fdff", medio: "#5ad6f5", profundo: "#04222e" },
  olimpo:   { luz: "#ffd6ff", medio: "#d83cf2", profundo: "#24042c" }
};
const mezcla = (h1, h2, t) => {
  const a = parseInt(h1.slice(1), 16), b = parseInt(h2.slice(1), 16);
  const c = (sh) => Math.round(((a >> sh) & 255) * (1 - t) + ((b >> sh) & 255) * t);
  return "#" + ((1 << 24) + (c(16) << 16) + (c(8) << 8) + c(0)).toString(16).slice(1);
};
// Estrella de cristal tallada: cada punta son dos caras (una con luz y otra en sombra) y un núcleo de cristal oscuro
function estrellaCristal(cx, cy, n, R, r, c, { giro = 0, alterna = 1, nucleo = true, g = "" } = {}) {
  const A = (i) => giro + (Math.PI * i) / n - Math.PI / 2;
  const P = (i) => { const rr = i % 4 === 2 && alterna !== 1 ? R * alterna : R; return [cx + rr * Math.cos(A(i)), cy + rr * Math.sin(A(i))]; };
  const Q = (i) => [cx + r * Math.cos(A(i)), cy + r * Math.sin(A(i))];
  const f = (pts) => pts.map(([x, y]) => x.toFixed(2) + "," + y.toFixed(2)).join(" ");
  let h = "";
  for (let k = 0; k < n; k++) {
    const i = 2 * k, tip = P(i), q0 = Q(i - 1), q1 = Q(i + 1), C = [cx, cy];
    // luz que viene de arriba a la izquierda
    const luzCara = (ang) => (Math.cos(ang - (-Math.PI * .75)) + 1) / 2;
    const l1 = luzCara(A(i) - Math.PI / (2 * n)), l2 = luzCara(A(i) + Math.PI / (2 * n));
    h += `<polygon points="${f([C, q0, tip])}" fill="${mezcla(mezcla(c.profundo, c.medio, .7), c.luz, .2 + l1 * .75)}"/>`;
    h += `<polygon points="${f([C, tip, q1])}" fill="${mezcla(mezcla(c.profundo, c.medio, .5), c.luz, .05 + l2 * .45)}"/>`;
    h += `<line x1="${cx}" y1="${cy}" x2="${tip[0].toFixed(2)}" y2="${tip[1].toFixed(2)}" stroke="${c.luz}" stroke-opacity=".55" stroke-width=".35"/>`;
  }
  const contorno = Array.from({ length: 2 * n }, (_, i) => (i % 2 === 0 ? P(i) : Q(i)));
  h += `<polygon points="${f(contorno)}" fill="none" stroke="${c.luz}" stroke-opacity=".9" stroke-width=".55" stroke-linejoin="round"/>`;
  if (nucleo) {
    const nuc = Array.from({ length: n }, (_, k) => Q(2 * k + 1)).map(([x, y]) => [cx + (x - cx) * .92, cy + (y - cy) * .92]);
    h += `<polygon points="${f(nuc)}" fill="url(#${g}nuc)" stroke="${c.luz}" stroke-opacity=".85" stroke-width=".6" stroke-linejoin="round"/>`;
  }
  return h;
}

let nInsignia = 0;
// Insignias de cristal (estilo emblema de logro): disco de cristal oscuro con brillo interior,
// una estrella tallada distinta en cada nivel y, en los más difíciles, laurel de cristal.
// Bronce = gema redonda de 12 caras · Plata = estrella de 6 puntas · Oro = estrella de 5 puntas con laurel ·
// Diamante = gema octogonal con laurel largo y rayos · Olimpo = doble estrella de 8 puntas, corona de laurel completa y luz que gira.
export function crearInsignia(ins, tam = 56) {
  // Medalla ilustrada (imagen elegida al crear el logro)
  if (ins.imagen && MEDALLAS[ins.imagen]) {
    const m = MEDALLAS[ins.imagen];
    const d = document.createElement("span");
    d.className = "insignia insignia-img" + (m.nivel ? " nivel-" + m.nivel : "");
    d.style.setProperty("--t", tam + "px");
    d.style.setProperty("--nc", m.nivel ? NIVELES[m.nivel].color : m.color);
    d.title = ins.nombre || m.nombre;
    d.append(imagenMedalla(ins.imagen));
    // En las de nivel se pone el número (100, 250…) en una plaquita abajo
    if (m.numero && ins.corto && ins.corto !== "★" && tam >= 40) d.append(Object.assign(document.createElement("span"), { className: "insignia-placa", textContent: ins.corto }));
    return d;
  }
  const d = document.createElement("span");
  const nivel = nivelDe(ins.nivel);
  d.className = "insignia" + (nivel ? " nivel-" + nivel : "");
  d.style.setProperty("--t", tam + "px");
  if (nivel) { d.style.setProperty("--tc", NIVELES[nivel].texto); d.style.setProperty("--nc", NIVELES[nivel].color); }
  d.title = (ins.nombre || "") + (nivel ? " · " + NIVELES[nivel].nombre : "");
  const corto = ins.corto || "★";
  const unidad = ins.unidad || "";
  const g = "g" + (++nInsignia);
  let svg;
  if (nivel) {
    const c = CRISTAL[nivel], cx = 30, cy = 28.5, R = 21.5;
    let rayos = "";
    const nRayos = nivel === "olimpo" ? 24 : 16;
    for (let i = 0; i < nRayos; i++) rayos += `<polygon points="${cx},${cy} ${cx - .9},${cy - R + 1} ${cx + .9},${cy - R + 1}" transform="rotate(${(360 * i) / nRayos} ${cx} ${cy})"/>`;
    const opRayos = { bronce: .06, plata: .08, oro: .1, diamante: .14, olimpo: .16 }[nivel];
    const defs = `<radialGradient id="${g}disco" cx=".5" cy=".45" r=".6"><stop offset="0" stop-color="${c.medio}" stop-opacity=".75"/><stop offset=".55" stop-color="${mezcla(c.profundo, c.medio, .25)}"/><stop offset="1" stop-color="${c.profundo}"/></radialGradient>
      <linearGradient id="${g}aro" x1=".1" y1="0" x2=".9" y2="1"><stop offset="0" stop-color="${c.luz}"/><stop offset=".35" stop-color="${c.medio}"/><stop offset=".7" stop-color="${mezcla(c.profundo, c.medio, .5)}"/><stop offset="1" stop-color="${c.luz}"/></linearGradient>
      <radialGradient id="${g}nuc" cx=".4" cy=".35" r=".75"><stop offset="0" stop-color="${mezcla(c.profundo, c.medio, .55)}"/><stop offset="1" stop-color="${c.profundo}"/></radialGradient>
      <radialGradient id="${g}halo"><stop offset=".6" stop-color="${c.medio}" stop-opacity=".45"/><stop offset="1" stop-color="${c.medio}" stop-opacity="0"/></radialGradient>
      <linearGradient id="${g}hoja" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c.luz}"/><stop offset=".55" stop-color="${c.medio}"/><stop offset="1" stop-color="${mezcla(c.profundo, c.medio, .5)}"/></linearGradient>`;
    // Estrella de cada nivel
    let emblema;
    // Bronce, plata y oro: solo un núcleo de cristal liso alrededor del número (sin caras talladas)
    const nucleoLiso = (r) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#${g}nuc)" stroke="${c.luz}" stroke-opacity=".85" stroke-width=".6"/>
      <circle cx="${cx}" cy="${cy}" r="${r + 2.4}" fill="none" stroke="${c.luz}" stroke-opacity=".35" stroke-width=".4"/>`;
    if (nivel === "bronce" || nivel === "plata" || nivel === "oro") emblema = nucleoLiso(13);
    else if (nivel === "diamante") emblema = estrellaCristal(cx, cy, 8, 18.8, 15.6, c, { g, giro: Math.PI / 8 });
    else emblema = estrellaCristal(cx, cy, 8, 19.5, 12, c, { g, giro: Math.PI / 8, nucleo: false }).replaceAll("<polygon", '<polygon opacity=".55"')
      + estrellaCristal(cx, cy, 8, 20.5, 11.4, c, { g, alterna: .62 });
    // Laurel de cristal (solo en los niveles altos)
    const laurelDe = { oro: [-86, -26, 3], diamante: [-88, -6, 4], olimpo: [-90, 52, 6] }[nivel];
    const rama = laurelDe ? laurel(cx, cy, 24.4, `url(#${g}hoja)`, c.luz, laurelDe[0], laurelDe[1], laurelDe[2], nivel === "olimpo" ? 1.3 : 1.45) : "";
    svg = `<defs>${defs}</defs>
      <circle cx="${cx}" cy="${cy}" r="${R + 6}" fill="url(#${g}halo)"/>
      <circle cx="${cx}" cy="${cy}" r="${R}" fill="url(#${g}disco)"/>
      ${nivel === "olimpo" ? `<g class="rayos" fill="${c.luz}" opacity="${opRayos}">${rayos}</g>` : ""}
      <circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="url(#${g}aro)" stroke-width="2"/>
      <circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="${c.luz}" stroke-opacity=".5" stroke-width=".4"/>
      <circle cx="${cx}" cy="${cy}" r="${R - 1.9}" fill="none" stroke="${c.luz}" stroke-opacity=".3" stroke-width=".4"/>
      ${nivel === "plata" || nivel === "olimpo" ? `<circle cx="${cx}" cy="${cy}" r="${R + 2.2}" fill="none" stroke="${c.luz}" stroke-opacity=".45" stroke-width=".5"/>` : ""}
      ${emblema}
      <path d="M${cx - R * .78} ${cy - R * .3} A${R} ${R} 0 0 1 ${cx + R * .78} ${cy - R * .3} Q${cx} ${cy - R * .62} ${cx - R * .78} ${cy - R * .3}Z" fill="#fff" opacity=".1"/>
      ${rama ? `<g class="laurel">${rama}</g>` : ""}
      <path class="destello" d="M${cx + 13} ${cy - 18} l1 2.4 2.4 1 -2.4 1 -1 2.4 -1 -2.4 -2.4 -1 2.4 -1z" fill="#fff"/>`;
  } else {
    svg = `<defs><linearGradient id="${g}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e3c8ee"/><stop offset="1" stop-color="#9b6db0"/></linearGradient></defs>
      <circle cx="30" cy="30" r="27" fill="none" stroke="url(#${g})" stroke-width="3"/>
      <circle cx="30" cy="30" r="21.5" fill="rgba(195,155,211,.14)"/>`;
  }
  d.innerHTML = `<svg viewBox="0 0 60 60" aria-hidden="true">${svg}</svg>`;
  const t = document.createElement("span"); t.className = "insignia-txt" + (corto.length >= 4 ? " largo" : corto.length === 3 ? " medio" : "");
  t.append(Object.assign(document.createElement("b"), { textContent: corto }));
  if (unidad && tam >= 40 && !nivel) t.append(Object.assign(document.createElement("small"), { textContent: unidad }));
  d.append(t);
  return d;
}

// ---------- Logros de clases ----------
// Solo los que llevan la palabra "clases" en el nombre muestran el contador
export const esLogroDeClases = (l) => /clases/i.test(l?.nombre || "");
// Ejercicios para elegir el favorito y el más odiado
export const EJERCICIOS = ["Assault Bike / Echo Bike", "Back Squat", "Box Jump Over", "Box Jumps", "Burpee Box Jump Over", "Burpee Over Bar", "Burpees", "Butterfly Pull-ups", "Chest to Bar", "Clean", "Clean and Jerk", "Cluster", "Crossover Double Unders", "Db Clean and Jerk", "Db Overhead Walking Lunge", "Db Snatch", "Db Thruster", "Deadlift", "Deficit Handstand Push-up", "Devil Press", "Double Unders", "Farmers Carry", "Front Squat", "GHD Sit-ups", "Handstand Push-up", "Handstand Walk", "Hang Clean", "Hang Snatch", "Hollow Hold / Hollow Rock", "Jerk", "Jumping Lunges", "Kettlebell Snatch", "Kettlebell Swing", "Muscle-up", "Overhead Squat", "Pistol Squat", "Power Clean", "Power Snatch", "Pull-ups", "Push Jerk", "Push Press", "Rope Climb", "Rowing", "Run", "Sandbag Bear Hug Carry", "Sandbag Clean", "Shuttle Run", "Single Unders", "SkiErg", "Sled Pull", "Sled Push", "Snatch", "Split Jerk", "Squat Clean", "Squat Snatch", "Strict Handstand Push-up", "Strict Press", "Strict Pull-ups", "Sumo Deadlift High Pull", "Thruster", "Toes to Bar", "Turkish Get-Up", "V-Ups", "Walking Lunges", "Wall Walk", "Wallballs"];
// Se ven en minúscula con la primera letra en mayúscula: "Back squat"
export const formatoEjercicio = (t) => { const x = String(t || "").trim().replace(/\s+/g, " ").toLowerCase(); return x ? x[0].toUpperCase() + x.slice(1) : ""; };
// Rellena un <select> con los ejercicios (y deja elegido el que ya tenía, aunque no esté en la lista)
export function opcionesEjercicios(sel, actual = "") {
  sel.replaceChildren(new Option("Elige un ejercicio…", ""));
  const lista = [...EJERCICIOS];
  if (actual && !lista.some((e) => e.toLowerCase() === actual.toLowerCase())) lista.unshift(actual);
  for (const e of lista) sel.append(new Option(formatoEjercicio(e), e, false, !!actual && e.toLowerCase() === actual.toLowerCase()));
}
// Lo que se guarda en la ficha del socio cuando consigue un logro
export const copiaInsignia = (l, puntos = l.puntos || 0, fecha = hoy()) => ({ nombre: l.nombre, corto: l.corto || "★", unidad: l.unidad || "", orden: l.orden || 0, nivel: l.nivel || "", imagen: l.imagen || "", puntos, fecha });
// Clases necesarias para un logro de clases (las del modo automático o el número del nombre)
export const umbralLogro = (l) => (l?.clases > 0 ? l.clases : (esLogroDeClases(l) ? parseInt(String(l.nombre).match(/\d+/)?.[0] || "0", 10) : 0));
export const umbralClases = (l) => (l?.clases > 0 ? l.clases : parseInt(String(l?.nombre || "").match(/\d+/)?.[0] || "0", 10));
// El siguiente logro de clases que aún no tiene (el de menos clases)
export function siguienteLogroClases(logros, ficha) {
  return logros.filter((l) => esLogroDeClases(l) && umbralClases(l) > 0 && !ficha?.insignias?.[l.id])
    .sort((a, b) => umbralClases(a) - umbralClases(b))[0] || null;
}
