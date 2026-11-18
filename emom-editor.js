// Editor de EMOM para quien publica el WOD (Publicar y Pantalla).
// Al escribir el WOD se detectan solos las rondas y los ejercicios de cada ronda, con la cantidad
// y el peso de chicos y de chicas ("20/16 cal row", "10 clean @60/40"). El coach solo lo revisa.
import { opcionesEjercicios, formatoEjercicio, detectarEjerciciosEmom } from "./comun.js?v=20261118f";

const CSS = `
  .ee { display: grid; gap: 8px; margin-top: 4px; }
  .ee[hidden] { display: none; }
  .ee-tit { font-size: 13px; color: var(--suave, #a9a2b3); margin-top: 8px; }
  .ee-tit small { font-weight: 400; opacity: .8; }
  html body .ee input, html body .ee select { margin: 0 !important; height: 44px; box-sizing: border-box; width: 100%; min-width: 0; }
  html body .ee input { text-align: center; font-weight: 700; padding: 0 4px !important; }
  .ee-lista { display: grid; gap: 10px; }
  .ee-fila { display: grid; gap: 8px; border: 1px solid var(--borde, #2a2233); border-radius: 14px; padding: 10px; }
  .ee-arriba { display: grid; grid-template-columns: minmax(0, 1fr) 88px 40px; gap: 6px; }
  html body .ee .ee-unidad { padding: 0 24px 0 10px !important; background-position: right 7px center !important; }
  .ee-numeros { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 6px; }
  .ee-numeros label { display: grid; gap: 4px; margin: 0 !important; font-size: 11px; color: var(--suave, #a9a2b3); text-align: center; text-transform: none !important; letter-spacing: 0 !important; align-content: end; }
  html body .ee .ee-quitar { height: 44px; margin: 0 !important; padding: 0 !important; border-radius: 12px; background: none !important; background-image: none !important; border: 1px solid var(--borde, #2a2233) !important; color: var(--suave, #a9a2b3) !important; box-shadow: none !important; }
  html body .ee .ee-mas { margin: 2px 0 0 !important; background: none !important; background-image: none !important; border: 1px dashed var(--borde, #2a2233) !important; color: var(--texto, #fff) !important; box-shadow: none !important; border-radius: 12px; padding: 10px; width: 100%; font: inherit; font-weight: 600; text-transform: none !important; letter-spacing: 0 !important; }
`;

export function editorEmom(caja, { desc, tipo, alCambiar = () => {} }) {
  if (!document.getElementById("ee-css")) document.head.append(Object.assign(document.createElement("style"), { id: "ee-css", textContent: CSS }));
  caja.classList.add("ee");
  caja.innerHTML = `
    <div class="ee-tit">Número de rondas del EMOM <small>(se rellena solo; opcional)</small></div>
    <input class="ee-rondas" inputmode="numeric" maxlength="2" placeholder="Ej. 3" aria-label="Número de rondas">
    <div class="ee-tit">Ejercicios de cada ronda <small>(se rellenan solos al escribir el WOD; revísalos)</small></div>
    <div class="ee-lista"></div>
    <button type="button" class="ee-mas">+ Añadir ejercicio</button>`;
  const rondasEl = caja.querySelector(".ee-rondas"), lista = caja.querySelector(".ee-lista");
  let tocados = false, rondasTocadas = false;

  const num = (v, aria) => { const i = Object.assign(document.createElement("input"), { inputMode: "decimal", maxLength: 5, placeholder: "–", value: v ?? "" }); i.setAttribute("aria-label", aria); return i; };
  const campo = (texto, input) => { const l = document.createElement("label"); l.append(texto, input); return l; };
  function fila(e = {}) {
    const f = document.createElement("div"); f.className = "ee-fila";
    const sel = document.createElement("select"); sel.className = "ee-nombre"; sel.setAttribute("aria-label", "Ejercicio");
    opcionesEjercicios(sel, e.nombre || "");
    const u = document.createElement("select"); u.className = "ee-unidad"; u.setAttribute("aria-label", "Unidad");
    for (const x of ["reps", "cal", "m"]) u.append(new Option(x, x, false, (e.unidad || "reps") === x));
    const q = Object.assign(document.createElement("button"), { type: "button", className: "ee-quitar", textContent: "✕" });
    q.setAttribute("aria-label", "Quitar ejercicio");
    q.addEventListener("click", () => { f.remove(); tocados = true; alCambiar(); });
    const arriba = document.createElement("div"); arriba.className = "ee-arriba"; arriba.append(sel, u, q);
    const cM = num(e.cantidad, "Cantidad chicos"), cF = num(e.cantidadF ?? e.cantidad, "Cantidad chicas");
    const kM = num(e.kg || "", "Peso chicos en kg"), kF = num(e.kgF ?? e.kg ?? "", "Peso chicas en kg");
    cM.className = "ee-cm"; cF.className = "ee-cf"; kM.className = "ee-km"; kF.className = "ee-kf";
    const nums = document.createElement("div"); nums.className = "ee-numeros";
    nums.append(campo("Chicos", cM), campo("Chicas", cF), campo("Kg chicos", kM), campo("Kg chicas", kF));
    f.append(arriba, nums);
    for (const el of [sel, u, cM, cF, kM, kF]) el.addEventListener("input", () => { tocados = true; alCambiar(); });
    return f;
  }
  const pintar = (l) => lista.replaceChildren(...l.map(fila));
  function detectar() {
    if (tipo.value !== "emom") return;
    const d = detectarEjerciciosEmom(desc.value);
    if (!tocados) pintar(d.ejercicios);
    if (!rondasTocadas && d.rondas) rondasEl.value = d.rondas;
  }
  const ver = () => { caja.hidden = tipo.value !== "emom"; detectar(); };
  let t;
  desc.addEventListener("input", () => { clearTimeout(t); t = setTimeout(detectar, 300); });
  tipo.addEventListener("change", ver);
  rondasEl.addEventListener("input", () => { rondasTocadas = true; alCambiar(); });
  caja.querySelector(".ee-mas").addEventListener("click", () => { lista.append(fila()); tocados = true; alCambiar(); });

  return {
    // Carga lo que ya estaba publicado (si no tenía ejercicios, los detecta del texto)
    cargar(w) {
      rondasEl.value = w?.rondas || ""; rondasTocadas = !!w?.rondas;
      pintar(w?.ejerciciosEmom || []); tocados = !!w?.ejerciciosEmom?.length;
      ver();
    },
    // { rondas, ejerciciosEmom } listos para guardar; lanza un texto si algo está mal
    leer() {
      if (tipo.value !== "emom") return {};
      const rt = rondasEl.value.trim();
      const rondas = rt ? parseInt(rt, 10) : 0;
      if (rt && !(/^\d+$/.test(rt) && rondas >= 1 && rondas <= 99)) throw "Revisa el número de rondas (de 1 a 99).";
      const n = (el, permitirVacio) => {
        const v = el.value.trim().replace(",", ".");
        if (!v) return permitirVacio ? 0 : NaN;
        const x = Number(v); return x > 0 && x <= 9999 ? Math.round(x * 10) / 10 : NaN;
      };
      const ejercicios = [];
      for (const f of lista.querySelectorAll(".ee-fila")) {
        const nombre = formatoEjercicio(f.querySelector(".ee-nombre").value).slice(0, 40);
        const cantidad = n(f.querySelector(".ee-cm")), cF = n(f.querySelector(".ee-cf"), true);
        const kg = n(f.querySelector(".ee-km"), true), kgF = n(f.querySelector(".ee-kf"), true);
        if (!nombre && isNaN(cantidad)) continue;
        if (!nombre) throw "Elige el ejercicio de cada fila.";
        if (isNaN(cantidad)) throw `Revisa la cantidad de chicos de ${nombre}.`;
        if (isNaN(cF) || isNaN(kg) || isNaN(kgF)) throw `Revisa los números de ${nombre}.`;
        ejercicios.push({ nombre, unidad: f.querySelector(".ee-unidad").value, cantidad, cantidadF: cF || cantidad, ...(kg || kgF ? { kg: kg || kgF, kgF: kgF || kg } : {}) });
      }
      return { ...(rondas ? { rondas } : {}), ...(ejercicios.length ? { ejerciciosEmom: ejercicios.slice(0, 10) } : {}) };
    },
  };
}
