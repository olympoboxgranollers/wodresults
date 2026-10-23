import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig, ZONA_HORARIA } from "./config.js";

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

// Fecha de hoy en formato YYYY-MM-DD según la zona horaria del box
export function hoy() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: ZONA_HORARIA });
}

// Tipos de puntuación: "tiempo" (menos es mejor), "reps" y "kg" (más es mejor)
export const TIPOS = {
  tiempo: { etiqueta: "Por tiempo", menosEsMejor: true },
  reps:   { etiqueta: "Repeticiones / AMRAP", menosEsMejor: false },
  kg:     { etiqueta: "Carga (kg)", menosEsMejor: false }
};

export function formatearValor(valor, tipo) {
  if (tipo === "tiempo") {
    const m = Math.floor(valor / 60);
    const s = Math.round(valor % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  }
  if (tipo === "kg") return `${valor} kg`;
  return `${valor} reps`;
}

export function ordenar(lista, tipo) {
  const menos = TIPOS[tipo]?.menosEsMejor ?? false;
  return [...lista].sort((a, b) => (menos ? a.valor - b.valor : b.valor - a.valor));
}
