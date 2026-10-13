/* Shared browser-local demo accounts and favorites. This is not server authentication. */
(function (root) {
  'use strict';
  const memory = new Map();
  const storage = (kind) => ({
    read(key, fallback = null) {
      try { const raw = root[kind].getItem(key); return raw === null ? (memory.has(`${kind}:${key}`) ? memory.get(`${kind}:${key}`) : fallback) : JSON.parse(raw); }
      catch { return memory.has(`${kind}:${key}`) ? memory.get(`${kind}:${key}`) : fallback; }
    },
    write(key, value) {
      memory.set(`${kind}:${key}`, value);
      try { root[kind].setItem(key, JSON.stringify(value)); return true; } catch { return false; }
    },
    remove(key) { memory.delete(`${kind}:${key}`); try { root[kind].removeItem(key); } catch {} }
  });
  const local = storage('localStorage'), session = storage('sessionStorage');
  const USERS = 'portal.accounts.v2', SESSION = 'portal.session.v2';
  const guest = { id: 'guest', nombre: 'Explorador', apellido: '', correo: '', isGuest: true };
  const email = (value) => String(value).trim().toLowerCase();
  const validName = (value) => /^[\p{L}\p{M}][\p{L}\p{M}\s'’-]{0,59}$/u.test(String(value).trim());
  const validEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value) && value.length <= 254;
  const validPassword = (value) => value.length >= 8 && value.length <= 128 && /[a-z]/.test(value) && /[A-Z]/.test(value) && /\d/.test(value);
  const bytesToHex = (bytes) => [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('');
  const hexToBytes = (hex) => Uint8Array.from(hex.match(/.{2}/g) || [], value => parseInt(value, 16));
  async function hashPassword(password, salt) {
    if (!root.crypto?.subtle) throw Error('Abre el sitio mediante HTTPS o localhost para gestionar tu cuenta.');
    const key = await root.crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
    return bytesToHex(new Uint8Array(await root.crypto.subtle.deriveBits({ name: 'PBKDF2', salt: hexToBytes(salt), iterations: 120000, hash: 'SHA-256' }, key, 256)));
  }
  async function credentials(password) {
    const salt = bytesToHex(root.crypto.getRandomValues(new Uint8Array(16)));
    return { salt, passwordHash: await hashPassword(password, salt) };
  }
  function accounts() {
    const value = local.read(USERS, []);
    return Array.isArray(value) ? value.filter(user => typeof user?.id === 'string' && typeof user.correo === 'string' && typeof user.passwordHash === 'string' && /^[a-f0-9]{32}$/.test(user.salt)) : [];
  }
  function saveAccounts(value) {
    if (!local.write(USERS, value)) throw Error('El navegador no permite guardar cuentas. Puedes explorar sin una cuenta.');
  }
  function publicUser(user) { const { passwordHash, salt, ...profile } = user; return { ...profile, isGuest: false }; }
  function currentUser() {
    const id = session.read(SESSION)?.id;
    const user = accounts().find(user => user.id === id);
    return user ? publicUser(user) : { ...guest };
  }
  function setSession(user) {
    if (!session.write(SESSION, { id: user.id })) throw Error('El navegador no permite iniciar una sesión local. Puedes explorar como invitado.');
  }
  async function register(values) {
    const nombre = values.nombre.trim(), apellido = values.apellido.trim(), correo = email(values.correo);
    if (!validName(nombre) || !validName(apellido)) throw Error('Escribe un nombre y apellido válidos.');
    if (!validEmail(correo)) throw Error('Revisa el formato del correo.');
    if (!validPassword(values.password)) throw Error('La contraseña necesita 8 caracteres, mayúscula, minúscula y número.');
    const all = accounts();
    if (all.some(user => user.correo === correo)) throw Error('Ya existe una cuenta con este correo en este navegador.');
    const user = { id: root.crypto.randomUUID(), nombre, apellido, correo, ...(await credentials(values.password)) };
    all.push(user); saveAccounts(all); setSession(user);
    return publicUser(user);
  }
  async function login(identity, password) {
    const normalized = email(identity), all = accounts();
    const candidates = all.filter(user => user.correo === normalized || user.nombre.toLocaleLowerCase('es') === normalized);
    if (candidates.length > 1) throw Error('Hay varias personas con ese nombre. Utiliza tu correo.');
    const user = candidates[0];
    if (!user || await hashPassword(password, user.salt) !== user.passwordHash) throw Error('El correo o la contraseña no coinciden.');
    setSession(user); return publicUser(user);
  }
  async function updateProfile(values) {
    const current = currentUser(); if (current.isGuest) throw Error('Crea una cuenta para editar tu perfil.');
    const all = accounts(), index = all.findIndex(user => user.id === current.id);
    const nombre = values.nombre.trim(), apellido = values.apellido.trim(), correo = email(values.correo);
    if (!validName(nombre) || !validName(apellido)) throw Error('Escribe un nombre y apellido válidos.');
    if (!validEmail(correo)) throw Error('Revisa el formato del correo.');
    if (all.some(user => user.id !== current.id && user.correo === correo)) throw Error('Ese correo ya pertenece a otra cuenta.');
    if (values.password && !validPassword(values.password)) throw Error('La nueva contraseña necesita 8 caracteres, mayúscula, minúscula y número.');
    const changed = { ...all[index], nombre, apellido, correo };
    if (values.password) Object.assign(changed, await credentials(values.password));
    all[index] = changed; saveAccounts(all); return publicUser(changed);
  }
  function favoritesKey() { return `portal.favorites.${currentUser().id}`; }
  function favorites() {
    const value = local.read(favoritesKey(), []);
    return Array.isArray(value) ? value.filter(item => Number.isInteger(item?.id) && item.id > 0 && typeof item.name === 'string') : [];
  }
  function toggleFavorite(character) {
    let items = favorites(), exists = items.some(item => item.id === character.id);
    if (exists) items = items.filter(item => item.id !== character.id);
    else items.push({ id: character.id, name: character.name, image: character.image, status: character.status, species: character.species, gender: character.gender, origin: character.origin, location: character.location, episode: character.episode });
    const persisted = local.write(favoritesKey(), items);
    return { liked: !exists, persisted, count: items.length };
  }
  async function migrateLegacy() {
    // Preserve existing accounts/favorites from the previous version without retaining plaintext passwords.
    let old;
    try { old = JSON.parse(root.sessionStorage.getItem('usuarios') || '[]'); } catch { return; }
    if (!Array.isArray(old) || !old.length) return;
    const all = accounts();
    for (const item of old) {
      if (!validEmail(email(item?.correo || '')) || typeof item.password !== 'string') continue;
      let user = all.find(user => user.correo === email(item.correo));
      if (!user) {
        user = { id: root.crypto.randomUUID(), nombre: String(item.nombre || 'Explorador'), apellido: String(item.apellido || ''), correo: email(item.correo), ...(await credentials(item.password)) };
        all.push(user);
      }
      const previous = local.read(`favoritos_${item.correo}`, []);
      if (Array.isArray(previous) && previous.length) {
        const key = `portal.favorites.${user.id}`, next = local.read(key, []);
        const merged = new Map([...(Array.isArray(next) ? next : []), ...previous].filter(item => Number.isInteger(item?.id)).map(item => [item.id, item]));
        local.write(key, [...merged.values()]);
      }
    }
    saveAccounts(all);
    try {
      const activeEmail = root.sessionStorage.getItem('usuarioLogueado');
      const active = all.find(user => user.correo === email(activeEmail || ''));
      if (active && root.sessionStorage.getItem('estadoSesionActiva')) setSession(active);
      ['usuarios', 'usuarioLogueado', 'estadoSesionActiva', 'nombreUsuario'].forEach(key => root.sessionStorage.removeItem(key));
    } catch {}
  }
  const api = { local, session, validName, validEmail, validPassword, register, login, updateProfile, currentUser, favorites, toggleFavorite, migrateLegacy,
    logout() { session.remove(SESSION); }, escape(value) { return String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char])); } };
  root.PortalCore = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
