// Cuentas de socio: entrar con Google o con email y contraseña.
// Cada socio tiene su ficha en usuarios/{uid} con su nombre y sus puntos.
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, setPersistence, browserLocalPersistence, browserSessionPersistence,
  createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail, sendEmailVerification, reload, signOut, updateProfile }
  from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { doc, onSnapshot, setDoc, updateDoc, getDoc, writeBatch, increment } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { app, db, hoy, idRegistro, PUNTOS, persona, nombreBonito, campoMes, puntosRegistro } from "./comun.js?v=20261029c";

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

// Como con Google: una cuenta solo vale si ha demostrado que el email es suyo (pulsando el enlace que le llega)
export const sinVerificar = (user) => !!user && !user.isAnonymous && !user.emailVerified;
// Avisa a quien esté escuchando cuando un socio acaba de verificar (onAuthStateChanged no salta con reload)
const alVerificar = new Set();

// Escucha quién ha entrado y su ficha (nombre y puntos). alCambiar({ user, ficha })
export function escucharCuenta(alCambiar) {
  let dejarFicha = null;
  const cambio = (user) => {
    if (dejarFicha) { dejarFicha(); dejarFicha = null; }
    // Las TV conectadas entran como anónimas y las cuentas sin verificar el email no valen todavía:
    // para la app es como no tener sesión (el panel de acceso le pide que lo verifique)
    if (!user || user.isAnonymous || sinVerificar(user)) return alCambiar({ user: null, ficha: null });
    alCambiar({ user, ficha: undefined });  // undefined = cargando
    dejarFicha = onSnapshot(doc(db, "usuarios", user.uid),
      (s) => {
        const raw = s.exists() ? s.data() : null;
        // Si el nombre está guardado en minúscula (p. ej. "ana lópez"), se corrige solo a "Ana López"
        if (raw?.nombre && nombreBonito(raw.nombre) !== raw.nombre) updateDoc(doc(db, "usuarios", user.uid), { nombre: nombreBonito(raw.nombre).slice(0, 40) }).catch(() => {});
        alCambiar({ user, ficha: raw ? persona(raw) : null });
      },
      () => alCambiar({ user, ficha: null }));
  };
  onAuthStateChanged(auth, cambio);
  alVerificar.add(cambio);
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
    <div class="acceso-msg" role="status"></div>
    <div class="acceso-verificar" hidden>
      <p class="acceso-texto">Te hemos enviado un enlace a <b class="acceso-mail"></b>. Ábrelo para activar tu cuenta (mira también en Spam) y después pulsa «Ya lo he verificado».</p>
      <button type="button" class="acceso-entrar acceso-hecho">Ya lo he verificado</button>
      <div class="acceso-links">
        <button type="button" class="acceso-reenviar">No me ha llegado: <b>reenviar email</b></button>
        <button type="button" class="acceso-otra">Entrar con otra cuenta</button>
      </div>
      <div class="acceso-msg acceso-msg-verificar" role="status"></div>
    </div>`;
  const q = (s) => contenedor.querySelector(s);
  q(".acceso-titulo").textContent = titulo;
  q(".acceso-texto").textContent = texto;
  q(".acceso-texto").hidden = !texto;
  const [email, pass] = contenedor.querySelectorAll(".acceso-email input");
  const nombre = q(".acceso-nombre");
  const msg = (t, ok = false) => { q(".acceso-msg").textContent = t; q(".acceso-msg").classList.toggle("ok", ok); };
  let crear = false;

  // Cuenta de email sin verificar: en vez del formulario se enseña cómo activarla
  const msgV = (t, ok = false) => { q(".acceso-msg-verificar").textContent = t; q(".acceso-msg-verificar").classList.toggle("ok", ok); };
  const pintarModo = (user) => {
    const pendiente = sinVerificar(user);
    for (const el of contenedor.children) if (!el.classList.contains("acceso-titulo")) el.hidden = pendiente !== el.classList.contains("acceso-verificar");
    q(".acceso-texto").hidden = pendiente || !texto;
    q(".acceso-titulo").textContent = pendiente ? "Verifica tu email" : titulo;
    if (pendiente) { q(".acceso-mail").textContent = user.email; msgV(""); }
  };
  onAuthStateChanged(auth, pintarModo);
  q(".acceso-hecho").addEventListener("click", async () => {
    const user = auth.currentUser;
    if (!user) return;
    try {
      await reload(user);
      if (!user.emailVerified) return msgV("Todavía no consta como verificado. Abre el enlace del email y vuelve a probar.");
      await user.getIdToken(true);  // token nuevo con email_verified, para que las reglas de Firebase lo acepten
      pintarModo(user);
      for (const cb of alVerificar) cb(user);
    } catch (e) { msgV(textoError(e)); }
  });
  q(".acceso-reenviar").addEventListener("click", async () => {
    try { await sendEmailVerification(auth.currentUser); msgV("Email reenviado. Puede tardar un par de minutos.", true); }
    catch (e) { msgV(textoError(e)); }
  });
  q(".acceso-otra").addEventListener("click", () => salir());

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
        // La ficha se crea al verificar el email (el perfil de atleta ya sale con este nombre)
        await sendEmailVerification(cred.user);
      } else {
        await signInWithEmailAndPassword(auth, em, pw);
      }
    } catch (err) { msg(textoError(err)); }
  });
}

// Suma al momento los puntos por registrar (una sola vez por clase y día).
// Devuelve true si los ha sumado ahora y false si ya estaban sumados.
export async function sumarRegistro(user, clase, ficha, categoria = "Open") {
  const pts = puntosRegistro(categoria);   // 20 en RX, 10 en Open
  const mid = idRegistro(clase);
  const ref = doc(db, "usuarios", user.uid, "movimientos", mid);
  if ((await getDoc(ref)).exists()) return false;
  // Las clases hechas salen solo de AimHarder (las reservas): registrar un resultado NO suma clase
  // puntosRanking: solo registrar y podio (para el ranking general) y el campo del mes (ranking general mensual)
  const guardar = async (conMes) => {
    const lote = writeBatch(db);
    lote.set(ref, { fecha: hoy(), clase, tipo: "registro", puntos: pts });
    lote.update(doc(db, "usuarios", user.uid), { puntos: increment(pts), puntosRanking: increment(pts), ...(conMes ? { [campoMes(mid)]: increment(pts) } : {}), ultimoRegistro: mid });
    await lote.commit();
  };
  // Si las reglas de Firebase aún no aceptan el campo del mes, se suman igual los puntos (sin el del mes)
  try { await guardar(true); }
  catch (e) { console.warn("Sin el campo del mes (¿reglas sin publicar?)", e); await guardar(false); }
  return pts;
}
