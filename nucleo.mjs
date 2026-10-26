// Sincronización de clases asistidas: AimHarder → app de Olympo Box.
// Lógica pura (sin Firebase): recibe un "almacen" con lo que necesita leer y escribir,
// así se puede probar sin tocar datos reales.
//
// IMPORTANTE: el repositorio es público y los registros de GitHub Actions también.
// Aquí nunca se escriben en el registro tokens, emails ni nombres: solo números.

const ZONA = "Europe/Madrid";
export const hoyMadrid = (d = new Date()) => d.toLocaleDateString("sv-SE", { timeZone: ZONA });

// ---------- Cliente de la API de AimHarder ----------
export function crearAim({ base = "https://api.aimharder.com", fetchFn = fetch, minRestanteHora = 5, minRestanteDia = 20 } = {}) {
  let acceso = null;
  const cupo = { hora: null, dia: null, peticiones: 0 };
  const sinCupo = () => (cupo.hora !== null && cupo.hora < minRestanteHora) || (cupo.dia !== null && cupo.dia < minRestanteDia);

  async function pedir(ruta, token) {
    if (sinCupo()) { const e = new Error("SIN_CUPO"); e.sinCupo = true; throw e; }
    cupo.peticiones++;
    const r = await fetchFn(base + ruta, { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } });
    const h = (n) => { const v = r.headers.get(n); return v === null ? null : Number(v); };
    if (h("X-Rate-Limit-Remaining-Hour") !== null) cupo.hora = h("X-Rate-Limit-Remaining-Hour");
    if (h("X-Rate-Limit-Remaining-Day") !== null) cupo.dia = h("X-Rate-Limit-Remaining-Day");
    if (r.status === 429) { const e = new Error("LIMITE_429"); e.sinCupo = true; throw e; }
    if (r.status === 204) return { data: [], pagination: { hasMore: false } };
    const cuerpo = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error(`HTTP_${r.status}`); e.status = r.status; throw e; }
    return cuerpo;
  }

  return {
    cupo,
    sinCupo,
    // Renueva la pareja de tokens con el refresh token. Devuelve el nuevo refresh token (rota en cada uso).
    async renovar(refresh) {
      const c = await pedir("/auth/tokens/refresh", refresh);
      const d = c.data || c;
      if (!d["access-token"] || !d["refresh-token"]) throw new Error("RESPUESTA_TOKEN_RARA");
      acceso = d["access-token"];
      return { refresh: d["refresh-token"], caduca: d["refresh-token-expires-at"] || null, accesoCaduca: d["access-token-expires-at"] || null };
    },
    // Todas las páginas de una lista paginada por cursor
    async todas(ruta) {
      const fuera = [];
      let cursor = "";
      for (let i = 0; i < 200; i++) {
        const sep = ruta.includes("?") ? "&" : "?";
        const c = await pedir(`${ruta}${sep}cursor=${encodeURIComponent(cursor)}`, acceso);
        fuera.push(...(c.data || []));
        if (!c.pagination?.hasMore || !c.pagination?.nextCursor) break;
        cursor = c.pagination.nextCursor;
      }
      return fuera;
    }
  };
}

// ---------- Contar las clases (reservas) de un cliente a partir de su historial ----------
// estado = { desde, asistidas } → solo se piden las reservas con id >= desde.
// Una reserva está "decidida" cuando su día ya pasó (o se canceló); hasta entonces se vuelve a mirar.
export function contarReservas(reservas, estado, hoy) {
  let { desde = 0, asistidas = 0 } = estado || {};
  let extra = 0, pendientes = 0, proximoDia = null, todoDecidido = true;
  const lista = [...reservas].filter((b) => b.id >= desde).sort((a, b) => a.id - b.id);
  for (const b of lista) {
    const cancelada = !!b.cancellation_date;
    const decidida = cancelada || (b.day && b.day < hoy);
    // Cuenta cada reserva no cancelada ni en lista de espera, haya check-in o no
    const cuenta = !cancelada && b.state !== "waiting_list";
    if (decidida && todoDecidido) {
      if (cuenta) asistidas++;
      desde = b.id + 1;
    } else if (decidida) {
      if (cuenta) extra++;
    } else {
      todoDecidido = false;
      pendientes++;
      if (!proximoDia || b.day < proximoDia) proximoDia = b.day;
    }
  }
  return { estado: { desde, asistidas }, total: asistidas + extra, pendientes, proximoDia };
}

// ¿Hace falta volver a mirar a este cliente?
export function hayQueRevisar(est, cliente, hoy) {
  if (!est) return true;
  const ultimaReserva = cliente.class_data?.reservation_date || null;
  if (ultimaReserva !== (est.ultimaReserva || null)) return true;   // ha reservado algo nuevo
  if (est.pendientes > 0 && est.proximoDia && est.proximoDia < hoy) return true;  // ya pasó una clase pendiente
  return false;
}

export const normalEmail = (e) => String(e || "").trim().toLowerCase();

// ---------- Logros de clases que le tocan a un socio ----------
// Clases que pide un logro: las de su modo automático o, si lleva "clases" en el nombre, el número del nombre
export function umbralLogro(l) {
  if (l?.clases > 0) return l.clases;
  return /clases/i.test(l?.nombre || "") ? parseInt(String(l.nombre).match(/\d+/)?.[0] || "0", 10) : 0;
}
// Puntos por cada clase reservada en AimHarder (solo las nuevas desde que se activó: el historial no da puntos)
export const PUNTOS_RESERVA = 5;
export function puntosReservas(usuario, total) {
  const base = typeof usuario?.clasesPuntuadas === "number" ? usuario.clasesPuntuadas : total;
  const nuevas = Math.max(0, total - base);
  return { nuevas, puntos: nuevas * PUNTOS_RESERVA, clasesPuntuadas: Math.max(base, total) };
}
export function logrosNuevos(usuario, clases, logros) {
  return logros.filter((l) => umbralLogro(l) > 0 && clases >= umbralLogro(l) && !usuario?.insignias?.[l.id]);
}

// ---------- Una ejecución completa ----------
// almacen: { leerPrivado, guardarPrivado(patch), cuentasApp(), usuarios(), logros(), actualizarUsuario(uid, datos, logrosNuevos), guardarEstado(obj) }
export async function sincronizar({ aim, almacen, semilla, semillaHash, prueba = false, maxSocios = 400, log = console.log, ahora = new Date() }) {
  const hoy = hoyMadrid(ahora);
  const priv = (await almacen.leerPrivado()) || {};
  const res = { vinculados: 0, revisados: 0, actualizados: 0, logros: 0, sinEmailEnApp: 0, clientesAim: 0, conEmail: 0, prueba, detenidoPorCupo: false, muestras: [] };

  // 1) Tokens. Si el secreto de GitHub es nuevo (lo has regenerado), manda el secreto; si no, el último guardado.
  const usarSemilla = semilla && (!priv.refresh || priv.semillaHash !== semillaHash);
  const refresh = usarSemilla ? semilla : priv.refresh;
  if (!refresh) throw new Error("FALTA_TOKEN: pon el refresh token de AimHarder en el secreto AIMHARDER_REFRESH_TOKEN");
  const t = await aim.renovar(refresh);
  // Se guarda al instante: el refresh token anterior ya no vale
  await almacen.guardarPrivado({ refresh: t.refresh, refreshCaduca: t.caduca, semillaHash, renovado: ahora.toISOString() });
  log(`Token renovado. Caduca: ${t.caduca || "?"}`);

  // 2) Clientes de AimHarder (solo usamos id, email y la fecha de su última reserva)
  const clientes = (await aim.todas("/clients")).filter((c) => !c.deactivation_date);
  res.clientesAim = clientes.length;
  const porEmail = new Map();
  for (const c of clientes) { const e = normalEmail(c.email); if (e) { porEmail.set(e, c); res.conEmail++; } }

  // 3) Cuentas de la app (email de acceso) → se emparejan por email
  const cuentas = await almacen.cuentasApp();
  const usuarios = new Map((await almacen.usuarios()).map((u) => [u.uid, u]));
  const logros = await almacen.logros();
  const pares = [];
  for (const cu of cuentas) {
    const c = porEmail.get(normalEmail(cu.email));
    if (c && usuarios.has(cu.uid)) pares.push({ uid: cu.uid, cliente: c });
  }
  res.vinculados = pares.length;
  const vinculadosUid = new Set(pares.map((p) => p.uid));
  const sinVincular = [...usuarios.values()].filter((u) => u.nombre && !vinculadosUid.has(u.uid)).map((u) => u.nombre).sort((a, b) => a.localeCompare(b, "es"));
  log(`Clientes activos en AimHarder: ${res.clientesAim} (con email: ${res.conEmail}) · socios de la app vinculados: ${res.vinculados}`);

  // 4) Historial de reservas de cada socio vinculado (primero los que hace más que no se miran)
  // Versión 2 del recuento: se cuentan reservas (antes, solo asistencias con check-in).
  // La primera vez se vuelve a leer todo el historial de cada socio y se quitan los ajustes manuales antiguos.
  const VERSION = 2;
  const estados = priv.versionConteo === VERSION ? { ...(priv.estados || {}) } : {};
  // Primero los que aún no tienen el recuento por reservas (los de más clases antes, que son los que más se notan);
  // después, los que hace más que no se miran
  const migrado = (p) => !!usuarios.get(p.uid)?.conteoV2 && !!estados[p.cliente.id];
  pares.sort((a, b) => (migrado(a) - migrado(b))
    || (!migrado(a) ? (usuarios.get(b.uid)?.clases || 0) - (usuarios.get(a.uid)?.clases || 0) : 0)
    || String(estados[a.cliente.id]?.revisado || "").localeCompare(String(estados[b.cliente.id]?.revisado || "")));
  let n = 0;
  for (const { uid, cliente } of pares) {
    if (prueba && n >= 3) break;
    if (n >= maxSocios) break;
    const est = estados[cliente.id];
    const usuario = usuarios.get(uid);
    if (!prueba && !hayQueRevisar(est, cliente, hoy)) {
      // Nada nuevo en AimHarder: solo se corrige el número si en la app no coincide (sin gastar peticiones)
      // Las clases de la app = las asistidas en AimHarder + el ajuste del coach (si le dio un logro de clases a mano)
      const ajuste = usuario.conteoV2 ? (usuario.clasesAjuste || 0) : 0;
      const totalApp = est.total + ajuste;
      const nuevos = logrosNuevos(usuario, totalApp, logros);
      const pr = puntosReservas(usuario, est.total);
      if (usuario.clases !== totalApp || usuario.clasesAim !== est.total || nuevos.length || !usuario.aimharder || !usuario.conteoV2 || usuario.clasesPuntuadas !== pr.clasesPuntuadas) {
        await almacen.actualizarUsuario(uid, { clases: totalApp, clasesAim: est.total, clasesAjuste: ajuste, conteoV2: true, aimharder: true, clasesPuntuadas: pr.clasesPuntuadas }, nuevos, hoy, pr);
        res.actualizados++; res.logros += nuevos.length;
      }
      continue;
    }
    let reservas;
    try {
      reservas = await aim.todas(`/clients/${cliente.id}/booking-history?order=asc${est?.desde ? `&id_from=${est.desde}` : ""}`);
    } catch (e) {
      if (e.sinCupo) { res.detenidoPorCupo = true; break; }
      log(`Aviso: no se ha podido leer un historial (${e.message}).`);
      continue;
    }
    n++; res.revisados++;
    const r = contarReservas(reservas, est, hoy);
    if (prueba) { res.muestras.push({ reservasLeidas: reservas.length, clasesAsistidas: r.total, pendientes: r.pendientes }); continue; }
    estados[cliente.id] = { uid, ...r.estado, total: r.total, pendientes: r.pendientes, proximoDia: r.proximoDia, ultimaReserva: cliente.class_data?.reservation_date || null, revisado: ahora.toISOString() };
    // Ajuste manual del coach: los antiguos (del recuento anterior) se quitan la primera vez
    const ajuste = usuario.conteoV2 ? (usuario.clasesAjuste || 0) : 0;
    const totalApp = r.total + ajuste;
    const nuevos = logrosNuevos(usuario, totalApp, logros);
    const pr = puntosReservas(usuario, r.total);
    // clasesAim: las reservas en AimHarder (sin ajustes), para que el coach vea de dónde sale el total
    if (usuario.clases !== totalApp || usuario.clasesAim !== r.total || nuevos.length || !usuario.aimharder || !usuario.conteoV2 || usuario.clasesPuntuadas !== pr.clasesPuntuadas) {
      await almacen.actualizarUsuario(uid, { clases: totalApp, clasesAim: r.total, clasesAjuste: ajuste, conteoV2: true, aimharder: true, clasesPuntuadas: pr.clasesPuntuadas }, nuevos, hoy, pr);
      res.actualizados++; res.logros += nuevos.length;
    }
  }

  if (!prueba) await almacen.guardarPrivado({ estados, versionConteo: VERSION });
  res.cupo = { ...aim.cupo };
  await almacen.guardarEstado({
    ultima: ahora.toISOString(), ok: true, prueba, vinculados: res.vinculados, revisados: res.revisados, actualizados: res.actualizados, logros: res.logros,
    clientesAim: res.clientesAim, sinVincular, detenidoPorCupo: res.detenidoPorCupo,
    // Socios que aún esperan el recuento por reservas (se van haciendo en cada sincronización)
    pendientesRecuento: prueba ? null : pares.filter((p) => !estados[p.cliente.id]).length, restanteDia: aim.cupo.dia, refreshCaduca: t.caduca || null, mensaje: ""
  });
  log(`Revisados: ${res.revisados} · actualizados: ${res.actualizados} · logros dados: ${res.logros} · peticiones: ${aim.cupo.peticiones} · cupo restante hoy: ${aim.cupo.dia ?? "?"}${res.detenidoPorCupo ? " · parado para no pasar el límite (sigue en la próxima sincronización)" : ""}`);
  if (prueba) res.muestras.forEach((m, i) => log(`Prueba · socio ${i + 1}: ${m.reservasLeidas} reservas leídas → ${m.clasesAsistidas} clases contadas (${m.pendientes} por venir)`));
  return res;
}
