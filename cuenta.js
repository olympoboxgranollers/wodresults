// Cuentas de socio: entrar con Google o con email y contraseña.
// Cada socio tiene su ficha en usuarios/{uid} con su nombre y sus puntos.
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, setPersistence, browserLocalPersistence, browserSessionPersistence,
  createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail, signOut, updateProfile }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, onSnapshot, setDoc, updateDoc, getDoc, writeBatch, increment } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { app, db, hoy, idRegistro, PUNTOS, persona, nombreBonito } from "./comun.js?v=20261026c";

export const auth = getAuth(app);
auth.languageCode = "es";
// Si se volvió de Google por redirección, recoge el resultado (y el error, si lo hubo)
let errorRedireccion = null;
getRedirectResult(auth).catch((e) => { errorRedireccion = e; });

const ERRORES = {
  "auth/invalid-credential": "Email o contraseña incorrectos.",
  "auth/wrong-password": "Email o contraseña incorrectos.",
  "auth/user-not-found": "No hay ninguna cuenta con ese email. Pulsa \"Crear cuenta\".",
  "auth/email-already-in-use": "Ya hay una cuenta con ese email. Pulsa \"Entrar\".",
  "auth/weak-password": "La contraseña tiene que tener al menos 6 caracteres.",
  "auth/invalid-email": "Ese email no es válido.",
  "auth/missing-password": "Escribe la contraseña.",
  "auth/too-many-requests": "Demasiados intentos. Espera un minuto y vuelve a probar.",
  "auth/popup-closed-by-user": "Has cerrado la ventana de Google antes de terminar. Vuelve a pulsar \"Entrar con Google\".",
  "auth/cancelled-popup-request": "Ya hay una ventana de Google abierta. Termina en ella o ciérrala y vuelve a probar.",
  "auth/popup-blocked": "El navegador ha bloqueado la ventana de Google. Permite las ventanas emergentes para esta web, o ábrela en Safari o Chrome (no dentro de WhatsApp o Instagram).",
  "auth/operation-not-allowed": "El acceso con este método no está activado en Firebase (Authentication → Método de acceso).",
  "auth/web-storage-unsupported": "Este navegador no deja guardar la sesión (¿modo privado?). Prueba en una ventana normal.",
  "auth/network-request-failed": "Sin conexión. Revisa tu internet.",
  "auth/unauthorized-domain": "Esta web no está autorizada en Firebase (Authentication → Configuración → Dominios autorizados)."
};
export const textoError = (e) => ERRORES[e?.code] || "No se ha podido completar. Inténtalo de nuevo.";

// Escucha quién ha entrado y su ficha (nombre y puntos). alCambiar({ user, ficha })
export function escucharCuenta(alCambiar) {
  let dejarFicha = null;
  onAuthStateChanged(auth, (user) => {
    if (dejarFicha) { dejarFicha(); dejarFicha = null; }
    // Las TV conectadas entran como anónimas: para la app es como no tener sesión
    if (!user || user.isAnonymous) return alCambiar({ user: null, ficha: null });
    alCambiar({ user, ficha: undefined });  // undefined = cargando
    dejarFicha = onSnapshot(doc(db, "usuarios", user.uid),
      (s) => {
        const raw = s.exists() ? s.data() : null;
        // Si el nombre está guardado en minúscula (p. ej. "ana lópez"), se corrige solo a "Ana López"
        if (raw?.nombre && nombreBonito(raw.nombre) !== raw.nombre) updateDoc(doc(db, "usuarios", user.uid), { nombre: nombreBonito(raw.nombre).slice(0, 40) }).catch(() => {});
        alCambiar({ user, ficha: raw ? persona(raw) : null });
      },
      () => alCambiar({ user, ficha: null }));
  });
}

// Crea la ficha la primera vez o cambia el nombre si lo ha cambiado
export async function guardarNombre(user, ficha, nombre) {
  if (ficha === undefined) {  // aún no había llegado la ficha: se mira antes de crearla
    const s = await getDoc(doc(db, "usuarios", user.uid));
    ficha = s.exists() ? persona(s.data()) : null;
  }
  nombre = nombreBonito(nombre);
  if (!ficha) await setDoc(doc(db, "usuarios", user.uid), { nombre, puntos: 0 });
  else if (ficha.nombre !== nombre) await updateDoc(doc(db, "usuarios", user.uid), { nombre });
}

export const salir = () => signOut(auth);

// Google siempre pregunta qué cuenta usar (así, después de salir, no vuelve a entrar sola con la misma)
const proveedorGoogle = () => {
  const p = new GoogleAuthProvider();
  p.setCustomParameters({ prompt: "select_account" });
  return p;
};
// "Recordarme": si no está marcado, la sesión se cierra al cerrar el navegador
async function aplicarRecordar(recordar) {
  try { await setPersistence(auth, recordar ? browserLocalPersistence : browserSessionPersistence); } catch {}
}

// Dibuja el panel de acceso dentro de "contenedor"
export function montarAcceso(contenedor, { titulo = "Entra en tu cuenta", texto = "" } = {}) {
  contenedor.classList.add("acceso");
  contenedor.innerHTML = `
    <div class="acceso-titulo"></div>
    <p class="acceso-texto"></p>
    <button type="button" class="acceso-google"><span class="g">G</span> Entrar con Google</button>
    <label class="acceso-recordar"><input type="checkbox" checked> Mantener la sesión iniciada en este dispositivo</label>
    <div class="acceso-o"><span>o con tu email</span></div>
    <form class="acceso-email" novalidate>
      <input type="email" autocomplete="email" placeholder="Email" aria-label="Email" required>
      <input type="password" autocomplete="current-password" placeholder="Contraseña" aria-label="Contraseña" required>
      <input type="text" class="acceso-nombre" autocomplete="name" placeholder="Nombre y apellido" aria-label="Nombre y apellido" maxlength="40" hidden>
      <button type="submit" class="acceso-entrar">Entrar</button>
    </form>
    <div class="acceso-links">
      <button type="button" class="acceso-modo">¿No tienes cuenta? <b>Crear cuenta</b></button>
      <button type="button" class="acceso-olvido">He olvidado la contraseña</button>
    </div>
    <div class="acceso-msg" role="status"></div>`;
  const q = (s) => contenedor.querySelector(s);
  q(".acceso-titulo").textContent = titulo;
  q(".acceso-texto").textContent = texto;
  q(".acceso-texto").hidden = !texto;
  const [email, pass] = contenedor.querySelectorAll(".acceso-email input");
  const nombre = q(".acceso-nombre");
  const msg = (t, ok = false) => { q(".acceso-msg").textContent = t; q(".acceso-msg").classList.toggle("ok", ok); };
  let crear = false;

  const recordar = q(".acceso-recordar input");
  // La opción se guarda al marcarla (no al pulsar Google): la ventana de Google tiene que abrirse
  // en el mismo instante del toque o el navegador la bloquea
  recordar.addEventListener("change", () => aplicarRecordar(recordar.checked));
  if (errorRedireccion) msg(textoError(errorRedireccion));
  let abriendo = false;
  q(".acceso-google").addEventListener("click", () => {
    if (abriendo) return;
    abriendo = true;
    msg("");
    signInWithPopup(auth, proveedorGoogle())
      .catch((e) => {
        if (e.code === "auth/operation-not-supported-in-this-environment") return signInWithRedirect(auth, proveedorGoogle());
        msg(textoError(e));
      })
      .finally(() => { abriendo = false; });
  });
  q(".acceso-modo").addEventListener("click", () => {
    crear = !crear;
    nombre.hidden = !crear;
    pass.autocomplete = crear ? "new-password" : "current-password";
    q(".acceso-entrar").textContent = crear ? "Crear cuenta" : "Entrar";
    q(".acceso-modo").innerHTML = crear ? "¿Ya tienes cuenta? <b>Entrar</b>" : "¿No tienes cuenta? <b>Crear cuenta</b>";
    msg("");
  });
  q(".acceso-olvido").addEventListener("click", async () => {
    if (!email.value.trim()) return msg("Escribe tu email y vuelve a pulsar \"He olvidado la contraseña\".");
    try { await sendPasswordResetEmail(auth, email.value.trim()); msg("Te hemos enviado un email para cambiar la contraseña.", true); }
    catch (e) { msg(textoError(e)); }
  });
  q(".acceso-email").addEventListener("submit", async (e) => {
    e.preventDefault();
    msg("");
    const em = email.value.trim(), pw = pass.value;
    await aplicarRecordar(recordar.checked);
    try {
      if (crear) {
        const n = nombre.value.trim().replace(/\s+/g, " ");
        if (!n) return msg("Escribe tu nombre y apellido.");
        const cred = await createUserWithEmailAndPassword(auth, em, pw);
        await updateProfile(cred.user, { displayName: n });
        await setDoc(doc(db, "usuarios", cred.user.uid), { nombre: n, puntos: 0 });
      } else {
        await signInWithEmailAndPassword(auth, em, pw);
      }
    } catch (err) { msg(textoError(err)); }
  });
}

// Suma al momento los puntos por registrar (una sola vez por clase y día).
// Devuelve true si los ha sumado ahora y false si ya estaban sumados.
export async function sumarRegistro(user, clase, ficha) {
  const mid = idRegistro(clase);
  const ref = doc(db, "usuarios", user.uid, "movimientos", mid);
  if ((await getDoc(ref)).exists()) return false;
  const lote = writeBatch(db);
  lote.set(ref, { fecha: hoy(), clase, tipo: "registro", puntos: PUNTOS.registrar });
  // Cada resultado subido cuenta como una clase hecha (para los logros de 100, 250… clases),
  // salvo si sus clases ya vienen de AimHarder (entonces manda AimHarder)
  // puntosRanking: solo registrar y podio (para el ranking general)
  lote.update(doc(db, "usuarios", user.uid), { puntos: increment(PUNTOS.registrar), puntosRanking: increment(PUNTOS.registrar), ultimoRegistro: mid, ...(ficha?.aimharder ? {} : { clases: increment(1) }) });
  await lote.commit();
  return true;
}
