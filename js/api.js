/* Bounded in-memory cache; cancellation and timeouts prevent stale UI and stuck loaders. */
(function (root) {
  'use strict';
  const BASE = 'https://rickandmortyapi.com/api/', cache = new Map();
  class ApiError extends Error { constructor(message, status) { super(message); this.name = 'ApiError'; this.status = status; } }
  function endpoint(path) {
    const url = new URL(path, BASE);
    if (url.origin !== new URL(BASE).origin || !url.pathname.startsWith('/api/')) throw Error('Ruta de API no permitida.');
    return url.href;
  }
  async function request(path, { signal } = {}) {
    const url = endpoint(path), existing = cache.get(url);
    if (signal?.aborted) throw new DOMException('Solicitud cancelada', 'AbortError');
    if (existing && Date.now() - existing.time < 300000) return existing.data;
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal?.addEventListener('abort', abort, { once: true });
    const timeout = setTimeout(abort, 12000);
    try {
      const response = await root.fetch(url, { signal: controller.signal });
      if (!response.ok) throw new ApiError(response.status === 404 ? 'No hay resultados para esta búsqueda.' : 'El portal no pudo conectarse con la API.', response.status);
      const data = await response.json();
      if (!data || typeof data !== 'object') throw new ApiError('La respuesta de la API no es válida.', 502);
      cache.delete(url); cache.set(url, { data, time: Date.now() });
      if (cache.size > 24) cache.delete(cache.keys().next().value);
      return data;
    } catch (error) {
      if (signal?.aborted) throw new DOMException('Solicitud cancelada', 'AbortError');
      if (error.name === 'AbortError') throw new ApiError('La conexión tardó demasiado. Inténtalo de nuevo.', 408);
      if (error instanceof ApiError) throw error;
      throw new ApiError('No se pudo conectar. Revisa tu conexión e inténtalo de nuevo.', 0);
    } finally { clearTimeout(timeout); signal?.removeEventListener('abort', abort); }
  }
  function list({ page = 1, name = '', status = '', species = '' } = {}, options) {
    const query = new URLSearchParams({ page: String(page) });
    for (const [key, value] of Object.entries({ name, status, species })) if (value.trim()) query.set(key, value.trim());
    return request(`character/?${query}`, options);
  }
  function character(id, options) {
    if (!/^\d+$/.test(String(id)) || Number(id) < 1 || !Number.isSafeInteger(Number(id))) return Promise.reject(new ApiError('El identificador del personaje no es válido.', 400));
    return request(`character/${id}`, options);
  }
  function episodes(urls, options) {
    const ids = urls.slice(0, 6).map(url => /^https:\/\/rickandmortyapi\.com\/api\/episode\/(\d+)$/.exec(url)?.[1]).filter(Boolean);
    if (!ids.length) return Promise.resolve([]);
    return request(`episode/${ids.join(',')}`, options).then(value => Array.isArray(value) ? value : [value]);
  }
  const api = { request, list, character, episodes, ApiError };
  root.PortalAPI = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
