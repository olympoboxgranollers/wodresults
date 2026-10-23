import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig, ZONA_HORARIA } from "./config.js";

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

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
