const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
function setup(fetch) {
  const window = { fetch };
  vm.runInNewContext(fs.readFileSync('js/api.js', 'utf8'), { window, URL, URLSearchParams, AbortController, DOMException, setTimeout, clearTimeout, Map, Date, module: { exports: {} } });
  return window.PortalAPI;
}
test('filters are encoded and cache avoids repeating identical requests', async () => {
  let calls = 0, url;
  const api = setup(async value => { calls++; url = value; return { ok: true, json: async () => ({ info: { count: 1 }, results: [] }) }; });
  await api.list({ name: 'Rick & Morty', status: 'alive', page: 2 });
  await api.list({ name: 'Rick & Morty', status: 'alive', page: 2 });
  assert.equal(calls, 1); assert.equal(new URL(url).searchParams.get('name'), 'Rick & Morty');
});
test('404 remains distinguishable from network errors', async () => {
  const api = setup(async () => ({ ok: false, status: 404 }));
  await assert.rejects(api.list(), error => error.status === 404);
  const offline = setup(async () => { throw Error('offline'); });
  await assert.rejects(offline.list(), error => error.status === 0);
});
test('invalid IDs and outside endpoints never issue requests', async () => {
  let calls = 0; const api = setup(async () => { calls++; });
  await assert.rejects(api.character('../secret')); await assert.rejects(api.request('https://example.com/private'));
  assert.equal(calls, 0);
});
test('caller cancellation remains AbortError', async () => {
  const api = setup((url, options) => new Promise((resolve, reject) => options.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))));
  const controller = new AbortController(), pending = api.list({}, { signal: controller.signal }); controller.abort();
  await assert.rejects(pending, error => error.name === 'AbortError');
});
test('episode request batches at most six validated IDs', async () => {
  let url; const api = setup(async value => { url = value; return { ok: true, json: async () => [{ id: 1 }] }; });
  await api.episodes(Array.from({ length: 20 }, (_, i) => `https://rickandmortyapi.com/api/episode/${i + 1}`));
  assert.equal(url.split('/').pop(), '1,2,3,4,5,6');
});
