import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig, ZONA_HORARIA } from "./config.js";

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// Fecha de hoy en formato YYYY-MM-DD según la zona horaria del box
export function hoy() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: ZONA_HORARIA });
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

// Ordena según el tipo del WOD; los resultados con otro tipo van al final
export function ordenar(lista, tipo) {
  const menos = TIPOS[tipo]?.menosEsMejor ?? false;
  const mismos = lista.filter((r) => (r.tipo || tipo) === tipo);
  const otros = lista.filter((r) => (r.tipo || tipo) !== tipo);
  mismos.sort((a, b) => (menos ? a.valor - b.valor : b.valor - a.valor));
  return [...mismos, ...otros];
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
