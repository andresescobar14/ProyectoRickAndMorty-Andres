/* Shared page controller. API rendering uses escaped text and delegated events. */
(async function () {
  'use strict';
  const core = window.PortalCore, api = window.PortalAPI, motion = window.PortalMotion;
  const $ = (selector) => document.querySelector(selector), esc = core.escape;
  const page = document.body.dataset.page;
  const statusText = { Alive: 'Vivo', Dead: 'Muerto', unknown: 'Desconocido' };
  const speciesText = { Human: 'Humano', Alien: 'Alien', Humanoid: 'Humanoide', Robot: 'Robot', Animal: 'Animal', 'Mythological Creature': 'Criatura mitológica', unknown: 'Desconocida' };
  const genderText = { Male: 'Masculino', Female: 'Femenino', Genderless: 'Sin género', unknown: 'Desconocido' };
  let toastTimer;
  function toast(message) {
    const node = $('#toast'); if (!node) return;
    clearTimeout(toastTimer); node.textContent = message; node.classList.add('is-visible');
    toastTimer = setTimeout(() => node.classList.remove('is-visible'), 3500);
  }
  try { await core.migrateLegacy(); } catch (error) { toast(error.message); }
  function updateHeader() {
    const user = core.currentUser(), count = core.favorites().length;
    document.querySelectorAll('[data-user-name]').forEach(node => { node.textContent = user.nombre; });
    document.querySelectorAll('[data-avatar]').forEach(node => { node.textContent = user.nombre[0]?.toUpperCase() || 'E'; });
    document.querySelectorAll('[data-favorite-count]').forEach(node => { node.textContent = count; });
  }
  updateHeader();
  document.querySelectorAll('[data-logout]').forEach(button => button.addEventListener('click', () => { core.logout(); location.assign('login.html'); }));
  document.querySelectorAll('[data-password-toggle]').forEach(button => button.addEventListener('click', () => {
    const field = document.getElementById(button.dataset.passwordToggle), visible = field.type === 'password';
    field.type = visible ? 'text' : 'password'; button.textContent = visible ? 'Ocultar' : 'Ver';
    button.setAttribute('aria-pressed', String(visible)); button.setAttribute('aria-label', visible ? 'Ocultar contraseña' : 'Mostrar contraseña');
  }));
  function feedback(message, success = false) {
    const node = $('#form-feedback'); if (!node) return;
    node.textContent = message; node.hidden = false; node.classList.toggle('success', success);
    if (!success) { node.focus(); motion?.feedback(node); }
  }
  function busy(form, value) {
    form.setAttribute('aria-busy', String(value));
    form.querySelectorAll('button[type="submit"], button:not([type])').forEach(button => { button.disabled = value; });
  }
  async function authForm() {
    const form = $('#auth-form');
    if (!core.currentUser().isGuest) { location.replace('main.html'); return; }
    if (page === 'register') $('#password').addEventListener('input', (event) => {
      const value = event.target.value;
      const score = [value.length >= 8, /[a-z]/.test(value), /[A-Z]/.test(value), /\d/.test(value)].filter(Boolean).length;
      $('#strength-fill').style.width = `${value.length ? score * 25 : 0}%`;
      $('#strength-fill').style.background = score === 4 ? 'var(--green)' : '#c89977';
    });
    form.addEventListener('submit', async (event) => {
      event.preventDefault(); if (form.getAttribute('aria-busy') === 'true') return;
      if (!form.reportValidity()) return;
      const values = Object.fromEntries(new FormData(form));
      if (page === 'register' && values.password !== values.confirmPassword) {
        $('#confirmPassword').setAttribute('aria-invalid', 'true'); feedback('Las contraseñas no coinciden.'); return;
      }
      $('#confirmPassword')?.removeAttribute('aria-invalid');
      busy(form, true);
      try {
        if (page === 'register') await core.register(values); else await core.login(values.identity, values.password);
        feedback('Portal abierto. Entrando al multiverso…', true);
        location.assign('main.html');
      } catch (error) { feedback(error.message); } finally { busy(form, false); }
    });
  }
  const safeImage = (image) => /^https:\/\/rickandmortyapi\.com\/api\/character\/avatar\/\d+\.(jpeg|jpg|png)$/.test(String(image)) ? image : 'assets/portal.svg';
  function bindImageFallbacks(container) {
    container.querySelectorAll('img[data-character-image]').forEach(image => {
      image.addEventListener('error', () => { image.src = 'assets/portal.svg'; }, { once: true });
    });
  }
  function card(character, liked) {
    const stateClass = character.status === 'Alive' ? 'alive' : character.status === 'Dead' ? 'dead' : '';
    return `<article class="character-card" data-reveal><div class="character-image"><a href="character.html?id=${character.id}" tabindex="-1" aria-hidden="true"><img data-character-image src="${safeImage(character.image)}" width="300" height="300" alt="" loading="lazy" decoding="async"/></a><span class="character-id">#${String(character.id).padStart(3, '0')}</span><button class="favorite-button" data-favorite="${character.id}" aria-pressed="${liked}" aria-label="${liked ? 'Quitar de' : 'Añadir a'} favoritos: ${esc(character.name)}" title="${liked ? 'Quitar favorito' : 'Guardar favorito'}">${liked ? '★' : '☆'}</button></div><div class="character-info"><p class="card-type">${esc(speciesText[character.species] || character.species)} / ${esc(genderText[character.gender] || character.gender || 'Desconocido')}</p><h3><a href="character.html?id=${character.id}">${esc(character.name)}</a></h3><p class="card-status"><span class="status-dot ${stateClass}"></span>${esc(statusText[character.status] || character.status || 'Desconocido')}</p><div class="card-bottom"><p>${esc(character.origin?.name || 'Origen desconocido')}</p><span class="card-arrow" aria-hidden="true">↗</span></div></div></article>`;
  }
  function empty(container, title, description, action = 'Limpiar filtros', kind = 'reset') {
    container.innerHTML = `<div class="empty-state"><span aria-hidden="true">◎</span><h2>${esc(title)}</h2><p>${esc(description)}</p><button class="button button-primary" data-empty-action="${kind}">${esc(action)}</button></div>`;
  }
  function favoriteChanged(character) {
    const result = core.toggleFavorite(character); updateHeader();
    toast(result.persisted ? (result.liked ? 'Personaje guardado en favoritos.' : 'Personaje eliminado de favoritos.') : 'Cambio guardado solo durante esta visita: el navegador bloquea el almacenamiento.');
    return result;
  }
  async function catalog() {
    const grid = $('#character-grid'), params = new URLSearchParams(location.search);
    const state = { page: Math.max(1, Math.min(10000, Number.parseInt(params.get('page'), 10) || 1)), name: (params.get('name') || '').slice(0, 100), status: params.get('status') || '', species: params.get('species') || '', favorites: params.get('view') === 'favorites', pages: 1 };
    let controller, sequence = 0, debounce, characters = new Map();
    $('#search').value = state.name;
    $('#status-filter').value = state.status; state.status = $('#status-filter').value;
    $('#species-filter').value = state.species; state.species = $('#species-filter').value;
    function syncURL() {
      const query = new URLSearchParams();
      if (state.name) query.set('name', state.name); if (state.status) query.set('status', state.status); if (state.species) query.set('species', state.species);
      if (state.page > 1) query.set('page', state.page); if (state.favorites) query.set('view', 'favorites');
      history.replaceState(null, '', `${location.pathname}${query.size ? '?' + query : ''}`);
      core.session.write('portal.catalog.url', `main.html${query.size ? '?' + query : ''}`);
      $('#tab-all').setAttribute('aria-pressed', String(!state.favorites)); $('#tab-favorites').setAttribute('aria-pressed', String(state.favorites));
      document.querySelectorAll('[data-nav]').forEach(link => { if ((link.dataset.nav === 'favorites') === state.favorites) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current'); });
    }
    function pagination(loading = false) {
      $('#page-label').textContent = `Página ${state.page} de ${Math.max(1, state.pages)}`;
      $('#previous-page').disabled = loading || state.page <= 1; $('#next-page').disabled = loading || state.page >= state.pages;
    }
    function render(results, count, pages) {
      results = results.filter(character => Number.isInteger(character?.id) && character.id > 0 && typeof character.name === 'string');
      characters = new Map(results.map(character => [character.id, character]));
      const liked = new Set(core.favorites().map(character => character.id));
      grid.innerHTML = results.map(character => card(character, liked.has(character.id))).join('');
      state.pages = pages || 1; pagination(); grid.setAttribute('aria-busy', 'false');
      $('#results-label').textContent = `${count} ${count === 1 ? 'personaje encontrado' : 'personajes encontrados'}${state.favorites ? ' en tus favoritos' : ''} · ${results.length} en esta página`;
      if (!results.length) empty(grid, state.favorites ? 'Tu próximo favorito te espera.' : 'No hay señales en esta dimensión.', state.favorites ? 'Guarda personajes con la estrella de sus tarjetas. También puedes ajustar los filtros.' : 'Prueba otro nombre, estado o especie para encontrar personajes.', state.favorites ? 'Explorar todos' : 'Limpiar filtros', state.favorites ? 'all' : 'reset');
      bindImageFallbacks(grid); motion?.reveal(grid);
    }
    async function load() {
      clearTimeout(debounce); syncURL(); controller?.abort(); const request = ++sequence; controller = new AbortController();
      motion?.reset(); pagination(true); grid.setAttribute('aria-busy', 'true');
      $('#results-label').textContent = 'Buscando señales del multiverso…';
      grid.innerHTML = Array.from({ length: 8 }, () => '<div class="skeleton" aria-hidden="true"></div>').join('');
      if (state.favorites) {
        const needle = state.name.toLocaleLowerCase('es');
        const matches = core.favorites().filter(character => character.name.toLocaleLowerCase('es').includes(needle) && (!state.status || character.status?.toLowerCase() === state.status) && (!state.species || character.species === state.species));
        state.page = Math.min(state.page, Math.max(1, Math.ceil(matches.length / 20))); syncURL();
        render(matches.slice((state.page - 1) * 20, state.page * 20), matches.length, Math.ceil(matches.length / 20)); return;
      }
      try {
        const data = await api.list(state, { signal: controller.signal }); if (request !== sequence) return;
        if (!Array.isArray(data.results) || !data.info) throw Error('La API devolvió una respuesta incompleta.');
        if (!state.name && !state.status && !state.species) $('#universe-count').textContent = data.info.count.toLocaleString('es');
        render(data.results, data.info.count, data.info.pages);
      } catch (error) {
        if (error.name === 'AbortError' || request !== sequence) return;
        state.pages = state.page; pagination(); grid.setAttribute('aria-busy', 'false');
        if (error.status === 404) { state.page = 1; syncURL(); render([], 0, 1); }
        else { $('#results-label').textContent = 'La conexión no está disponible.'; empty(grid, 'El portal necesita otro intento.', error.message, 'Reintentar', 'retry'); }
      }
    }
    function reset() { state.name = ''; state.status = ''; state.species = ''; state.page = 1; $('#search').value = ''; $('#status-filter').value = ''; $('#species-filter').value = ''; load(); }
    $('#filter-form').addEventListener('submit', event => { event.preventDefault(); load(); });
    $('#search').addEventListener('input', event => { state.name = event.target.value; state.page = 1; controller?.abort(); ++sequence; clearTimeout(debounce); debounce = setTimeout(load, 300); });
    for (const [selector, key] of [['#status-filter', 'status'], ['#species-filter', 'species']]) $(selector).addEventListener('change', event => { state[key] = event.target.value; state.page = 1; load(); });
    $('#reset-filters').addEventListener('click', reset);
    $('#tab-all').addEventListener('click', () => { state.favorites = false; state.page = 1; load(); });
    $('#tab-favorites').addEventListener('click', () => { state.favorites = true; state.page = 1; load(); });
    $('#previous-page').addEventListener('click', () => { if (state.page > 1) { state.page--; load(); $('#catalog').scrollIntoView({ block: 'start' }); } });
    $('#next-page').addEventListener('click', () => { if (state.page < state.pages) { state.page++; load(); $('#catalog').scrollIntoView({ block: 'start' }); } });
    grid.addEventListener('click', event => {
      const favorite = event.target.closest('[data-favorite]');
      if (favorite) {
        const character = characters.get(Number(favorite.dataset.favorite)); if (!character) return;
        const result = favoriteChanged(character);
        if (state.favorites) load();
        else { favorite.setAttribute('aria-pressed', String(result.liked)); favorite.setAttribute('aria-label', `${result.liked ? 'Quitar de' : 'Añadir a'} favoritos: ${character.name}`); favorite.textContent = result.liked ? '★' : '☆'; favorite.title = result.liked ? 'Quitar favorito' : 'Guardar favorito'; }
      }
      const action = event.target.closest('[data-empty-action]')?.dataset.emptyAction;
      if (action === 'retry') load(); if (action === 'reset') reset(); if (action === 'all') { state.favorites = false; reset(); }
    });
    document.addEventListener('keydown', event => { if (event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey && !event.target.closest('input,textarea,select,[contenteditable]')) { event.preventDefault(); $('#search').focus(); } });
    window.addEventListener('storage', event => { if (event.key?.startsWith('portal.favorites.')) { updateHeader(); if (state.favorites) load(); } });
    window.addEventListener('pagehide', () => { controller?.abort(); clearTimeout(debounce); });
    await load();
  }
  async function detail() {
    const container = $('#character-detail'), id = new URLSearchParams(location.search).get('id');
    const saved = core.session.read('portal.catalog.url', 'main.html');
    if (/^main\.html(?:\?[^#]*)?$/.test(saved)) $('.back-link').href = saved;
    container.innerHTML = '<div class="skeleton" style="height:400px;aspect-ratio:auto" aria-hidden="true"></div>';
    let controller = new AbortController(); window.addEventListener('pagehide', () => controller.abort());
    async function load() {
      try {
        const character = await api.character(id, { signal: controller.signal });
        document.title = `${character.name} · Rick & Morty Portal`;
        const liked = core.favorites().some(item => item.id === character.id), status = character.status === 'Alive' ? 'alive' : character.status === 'Dead' ? 'dead' : '';
        container.innerHTML = `<article class="detail-card" data-reveal><div class="detail-image"><img data-character-image src="${safeImage(character.image)}" width="300" height="300" alt="${esc(character.name)}" fetchpriority="high"/></div><div class="detail-info"><span class="eyebrow">EXPEDIENTE #${String(character.id).padStart(3, '0')} · C-137</span><h1>${esc(character.name)}</h1><p class="card-status"><span class="status-dot ${status}"></span>${esc(statusText[character.status] || character.status)} · ${esc(speciesText[character.species] || character.species)}</p><dl class="detail-facts"><div><dt>Género</dt><dd>${esc(genderText[character.gender] || character.gender)}</dd></div><div><dt>Apariciones</dt><dd>${character.episode?.length || 0} episodios</dd></div><div><dt>Origen</dt><dd>${esc(character.origin?.name || 'Desconocido')}</dd></div><div><dt>Última ubicación</dt><dd>${esc(character.location?.name || 'Desconocida')}</dd></div><div><dt>Especie</dt><dd>${esc(speciesText[character.species] || character.species)}</dd></div><div><dt>Tipo</dt><dd>${esc(character.type || 'Sin especificar')}</dd></div></dl><div class="detail-actions"><button id="detail-favorite" class="button ${liked ? 'button-primary' : 'button-secondary'}" aria-pressed="${liked}">${liked ? '★ Guardado' : '☆ Guardar favorito'}</button><a class="button button-secondary" href="${esc($('.back-link').getAttribute('href'))}">Volver al catálogo →</a></div></div></article><section class="episodes-panel" aria-labelledby="episodes-title"><span class="eyebrow">COORDENADAS DE APARICIÓN</span><h2 id="episodes-title">Primeros episodios.</h2><div id="episode-list" class="episode-grid"><p class="muted">Cargando episodios…</p></div></section>`;
        container.setAttribute('aria-busy', 'false'); bindImageFallbacks(container); motion?.reveal(container);
        $('#detail-favorite').addEventListener('click', event => { const result = favoriteChanged(character); event.currentTarget.setAttribute('aria-pressed', String(result.liked)); event.currentTarget.classList.toggle('button-primary', result.liked); event.currentTarget.classList.toggle('button-secondary', !result.liked); event.currentTarget.textContent = result.liked ? '★ Guardado' : '☆ Guardar favorito'; });
        try {
          const episodes = await api.episodes(character.episode || [], { signal: controller.signal });
          $('#episode-list').innerHTML = episodes.length ? episodes.map(episode => `<article class="episode-item"><span>${esc(episode.episode)}</span><h3>${esc(episode.name)}</h3><p>${esc(episode.air_date)}</p></article>`).join('') : '<p class="muted">Sin episodios registrados.</p>';
        } catch (error) { if (error.name !== 'AbortError' && $('#episode-list')) $('#episode-list').textContent = 'No se pudieron cargar los episodios. Los datos del personaje siguen disponibles.'; }
      } catch (error) {
        if (error.name === 'AbortError') return;
        container.setAttribute('aria-busy', 'false');
        empty(container, error.status === 400 || error.status === 404 ? 'Este personaje no está aquí.' : 'La dimensión no responde.', error.message, error.status === 400 || error.status === 404 ? 'Volver al catálogo' : 'Reintentar', error.status === 400 || error.status === 404 ? 'all' : 'retry');
      }
    }
    container.addEventListener('click', event => { const action = event.target.closest('[data-empty-action]')?.dataset.emptyAction; if (action === 'retry') load(); if (action === 'all') location.assign('main.html'); });
    await load();
  }
  function profile() {
    const user = core.currentUser();
    if (user.isGuest) {
      $('.account-layout').outerHTML = '<section class="guest-panel"><span class="eyebrow">MODO EXPLORADOR</span><h1>Una identidad,<br/>tus propios favoritos.</h1><p>Estás explorando como invitado. Crea una cuenta local para tener tu perfil y una colección separada en este navegador.</p><a class="button button-primary" href="index.html">Crear mi cuenta →</a><a class="button button-secondary" href="login.html">Iniciar sesión</a></section>'; return;
    }
    $('#name').value = user.nombre; $('#lastName').value = user.apellido; $('#email').value = user.correo;
    const paint = (value) => { $('#account-name').textContent = `${value.nombre} ${value.apellido}`; $('#account-email').textContent = value.correo; $('#account-avatar').textContent = value.nombre[0].toUpperCase(); updateHeader(); };
    paint(user);
    $('#profile-form').addEventListener('submit', async event => {
      event.preventDefault(); const form = event.currentTarget; if (form.getAttribute('aria-busy') === 'true' || !form.reportValidity()) return;
      busy(form, true);
      try { const user = await core.updateProfile(Object.fromEntries(new FormData(form))); paint(user); $('#password').value = ''; feedback('Tu identidad se actualizó. Tus favoritos siguen contigo.', true); }
      catch (error) { feedback(error.message); } finally { busy(form, false); }
    });
  }
  try {
    if (page === 'register' || page === 'login') await authForm();
    if (page === 'catalog') await catalog();
    if (page === 'character') await detail();
    if (page === 'account') profile();
  } catch (error) { toast(error.message || 'No se pudo abrir el portal. Recarga e inténtalo de nuevo.'); }
})();
