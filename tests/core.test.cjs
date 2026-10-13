const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const { webcrypto } = require('node:crypto');
function setup(data = {}, blocked = false) {
  const makeStorage = (map) => ({ getItem: key => map[key] ?? null, setItem: (key, value) => { if (blocked) throw Error('blocked'); map[key] = value; }, removeItem: key => { delete map[key]; } });
  const local = data.local || {}, session = data.session || {};
  const window = { crypto: webcrypto, localStorage: makeStorage(local), sessionStorage: makeStorage(session) };
  vm.runInNewContext(fs.readFileSync('js/core.js', 'utf8'), { window, TextEncoder, Uint8Array, Map, module: { exports: {} } });
  return { core: window.PortalCore, local, session };
}
const user = { nombre: 'Andrés', apellido: 'Escobar', correo: 'Andres@Example.com', password: 'Portal123!' };
test('registration hashes credentials and accounts survive a new browser session', async () => {
  const { core, local } = setup();
  await core.register(user);
  assert.equal(core.currentUser().correo, 'andres@example.com');
  assert(!JSON.stringify(local).includes('Portal123!'));
  const restored = setup({ local }).core;
  assert.equal(restored.currentUser().isGuest, true);
  await restored.login('ANDRES@EXAMPLE.COM', user.password);
  assert.equal(restored.currentUser().nombre, 'Andrés');
});
test('passwords preserve spaces and incorrect credentials fail', async () => {
  const { core } = setup();
  await core.register({ ...user, password: ' Portal123! ' });
  core.logout();
  await assert.rejects(core.login(user.correo, 'Portal123!'));
  await core.login(user.correo, ' Portal123! ');
});
test('email collisions and ambiguous names are rejected', async () => {
  const { core } = setup();
  await core.register(user);
  await assert.rejects(core.register({ ...user, correo: ' ANDRES@example.com ' }));
  await core.register({ ...user, correo: 'other@example.com' });
  await assert.rejects(core.login('Andrés', user.password), /Utiliza tu correo/);
});
test('profile email updates retain favorite identity and do not require a password change', async () => {
  const { core } = setup();
  await core.register(user);
  core.toggleFavorite({ id: 1, name: 'Rick Sanchez', image: 'test' });
  await core.updateProfile({ ...user, correo: 'new@example.com', password: '' });
  assert.equal(core.favorites()[0].id, 1);
  core.logout(); await core.login('new@example.com', user.password);
  assert.equal(core.favorites().length, 1);
});
test('favorites are isolated between guest and registered users', async () => {
  const { core } = setup();
  core.toggleFavorite({ id: 2, name: 'Morty Smith' });
  await core.register(user); assert.equal(core.favorites().length, 0);
  core.toggleFavorite({ id: 1, name: 'Rick Sanchez' });
  core.logout(); assert.equal(core.favorites()[0].id, 2);
});
test('legacy session credentials migrate to hashes with favorites preserved', async () => {
  const { core, session } = setup({ session: { usuarios: JSON.stringify([{ ...user, correo: 'andres@example.com' }]), usuarioLogueado: 'andres@example.com', estadoSesionActiva: 'true' }, local: { 'favoritos_andres@example.com': JSON.stringify([{ id: 1, name: 'Rick Sanchez' }]) } });
  await core.migrateLegacy();
  assert.equal(core.currentUser().isGuest, false); assert.equal(core.favorites()[0].id, 1);
  assert.equal(session.usuarios, undefined);
});
test('invalid stored data and blocked storage leave guest browsing available', async () => {
  const { core } = setup({ local: { 'portal.accounts.v2': '{broken' } }, true);
  assert.equal(core.currentUser().isGuest, true);
  await assert.rejects(core.register(user), /no permite guardar/);
});
test('names support accents and hyphens while HTML is escaped', () => {
  const { core } = setup();
  assert(core.validName('Ana-María')); assert(!core.validName('<img>'));
  assert.equal(core.escape('<img onerror="bad">'), '&lt;img onerror=&quot;bad&quot;&gt;');
});
