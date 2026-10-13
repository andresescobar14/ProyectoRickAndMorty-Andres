/* GSAP interactions, AOS section entrances and a bounded canvas effect. */
(function () {
  'use strict';
  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  const desktop = matchMedia('(min-width: 881px)');
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  const pending = new Set(), revealTweens = new Set(), introTweens = new Set(), interactionTweens = new Set();
  let observer, aosInitialized = false;
  function animate(elements, scope = revealTweens) {
    if (preference.matches || !window.gsap || !elements.length) return;
    const tween = gsap.fromTo(elements, { y: desktop.matches ? 30 : 18, opacity: 0 }, {
      y: 0, opacity: 1, duration: desktop.matches ? .68 : .48,
      stagger: { amount: Math.min(.3, elements.length * .05) }, ease: 'power2.out',
      clearProps: 'transform,opacity', onComplete: () => scope.delete(tween)
    });
    scope.add(tween);
  }
  function initAOS() {
    document.querySelectorAll('.section-heading, .filters, .episodes-panel, .site-footer').forEach(element => {
      if (!element.hasAttribute('data-enter') && !element.hasAttribute('data-reveal')) element.dataset.aos = 'fade-up';
    });
    if (preference.matches || !window.AOS) { document.documentElement.classList.remove('aos-ready'); return; }
    try {
      document.documentElement.classList.add('aos-ready');
      if (!aosInitialized) {
        AOS.init({ duration: 460, offset: 32, once: true, mirror: false,
          throttleDelay: 120, debounceDelay: 100, disableMutationObserver: true });
        aosInitialized = true;
      } else AOS.refreshHard();
    } catch { document.documentElement.classList.remove('aos-ready'); }
  }
  if ('IntersectionObserver' in window) {
    observer = new IntersectionObserver(entries => {
      const visible = entries.filter(entry => entry.isIntersecting).map(entry => entry.target);
      visible.forEach(element => { observer.unobserve(element); pending.delete(element); });
      animate(visible);
    }, { threshold: .08 });
  }
  function reveal(container = document) {
    container.querySelectorAll('[data-reveal]').forEach(element => {
      if (preference.matches || !observer || !window.gsap) return;
      pending.add(element); observer.observe(element);
    });
    initAOS();
  }
  function finish(scope) {
    [...scope].forEach(tween => { tween.progress(1).kill(); }); scope.clear();
  }
  // Catalog reloads must not cancel header or form entrances.
  function reset() { observer?.disconnect(); pending.clear(); finish(revealTweens); }
  function resetAll() { reset(); finish(introTweens); finish(interactionTweens); }
  function feedback(element) {
    if (!preference.matches && window.gsap) {
      const tween = gsap.fromTo(element, { x: -4 }, { x: 0, duration: .3,
        ease: 'elastic.out(1,.4)', clearProps: 'transform', onComplete: () => interactionTweens.delete(tween) });
      interactionTweens.add(tween);
    }
  }
  // Desktop interactions run on pointer entry/exit only; no pointermove loop or tilt calculation.
  function hoverCard(event, entered) {
    if (preference.matches || !desktop.matches || !finePointer.matches || !window.gsap) return;
    const card = event.target.closest?.('.character-card');
    if (!card || card.contains(event.relatedTarget)) return;
    const image = card.querySelector('.character-image img'), arrow = card.querySelector('.card-arrow');
    const targets = [image, arrow].filter(Boolean);
    gsap.killTweensOf(targets);
    interactionTweens.forEach(tween => { if (tween.targets().some(target => targets.includes(target))) interactionTweens.delete(tween); });
    for (const [target, props] of [[image, { scale: entered ? 1.055 : 1, y: entered ? -3 : 0 }], [arrow, { x: entered ? 3 : 0, y: entered ? -3 : 0 }]]) {
      if (!target) continue;
      const tween = gsap.to(target, { ...props, duration: entered ? .28 : .22, ease: 'power2.out',
        overwrite: 'auto', ...(entered ? {} : { clearProps: 'transform' }), onComplete: () => interactionTweens.delete(tween) });
      interactionTweens.add(tween);
    }
  }
  document.addEventListener('pointerover', event => hoverCard(event, true));
  document.addEventListener('pointerout', event => hoverCard(event, false));
  function syncDesktopClass() {
    const enabled = desktop.matches && finePointer.matches && !preference.matches && !!window.gsap;
    document.documentElement.classList.toggle('gsap-desktop-motion', enabled);
    if (!enabled && window.gsap) {
      const targets = document.querySelectorAll('.character-image img, .card-arrow');
      finish(interactionTweens); gsap.killTweensOf(targets); gsap.set(targets, { clearProps: 'transform' });
    }
  }
  desktop.addEventListener('change', syncDesktopClass); finePointer.addEventListener('change', syncDesktopClass);
  // One canvas, at most 26 particles, capped resolution and a 30 fps draw budget.
  const canvas = document.getElementById('portal-canvas');
  let particleColor = 'rgba(120,200,255,.48)', particleAccent = '#78c8ff';
  let frame = 0, active = false, inView = false, last = 0, size = 0, context, particles = [], canvasObserver, resizeObserver;
  const stop = () => { active = false; cancelAnimationFrame(frame); frame = 0; };
  function resize() {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect(); size = Math.min(rect.width, rect.height, 460);
    if (!size) return;
    const ratio = Math.min(devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(size * ratio); canvas.height = Math.round(size * ratio);
    context = canvas.getContext('2d'); if (!context) return;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    const theme = getComputedStyle(document.documentElement);
    particleColor = theme.getPropertyValue('--portal-particle').trim() || particleColor;
    particleAccent = theme.getPropertyValue('--accent').trim() || particleAccent;
    particles = Array.from({ length: innerWidth < 768 ? 16 : 26 }, (_, index) => ({
      angle: index * 2.399, radius: size * (.24 + (index % 7) * .02), speed: .08 + (index % 4) * .03, width: .7 + (index % 3) * .35
    }));
    draw(0);
  }
  function draw(time) {
    if (!context || !size) return;
    context.clearRect(0, 0, size, size);
    const center = size / 2;
    for (const particle of particles) {
      const angle = particle.angle + time * .0001 * particle.speed;
      context.beginPath(); context.strokeStyle = particleColor; context.lineWidth = particle.width;
      context.arc(center, center, particle.radius, angle, angle + .3); context.stroke();
      context.beginPath(); context.fillStyle = particleAccent;
      context.arc(center + Math.cos(angle) * particle.radius, center + Math.sin(angle) * particle.radius, particle.width + .4, 0, Math.PI * 2); context.fill();
    }
  }
  function tick(time) {
    if (!active) return;
    if (time - last >= 1000 / 30) { draw(time); last = time; }
    frame = requestAnimationFrame(tick);
  }
  function sync() {
    const shouldRun = !!canvas && inView && !document.hidden && !preference.matches && size > 0 && !!context;
    if (shouldRun && !active) { active = true; last = 0; frame = requestAnimationFrame(tick); }
    else if (!shouldRun) stop();
  }
  if (canvas) {
    resize();
    if ('ResizeObserver' in window) { resizeObserver = new ResizeObserver(() => { resize(); sync(); }); resizeObserver.observe(canvas); }
    if ('IntersectionObserver' in window) {
      canvasObserver = new IntersectionObserver(entries => { inView = entries[0].isIntersecting; sync(); }); canvasObserver.observe(canvas);
    }
    // Without visibility observation the effect stays static.
  }
  document.addEventListener('visibilitychange', () => {
    document.documentElement.classList.toggle('page-hidden', document.hidden);
    [revealTweens, introTweens, interactionTweens].forEach(scope => scope.forEach(tween => document.hidden ? tween.pause() : tween.resume())); sync();
  });
  preference.addEventListener('change', () => { resetAll(); syncDesktopClass(); initAOS(); sync(); });
  window.addEventListener('pagehide', () => { resetAll(); stop(); });
  window.addEventListener('pageshow', () => { sync(); initAOS(); });
  window.PortalMotion = { reveal, reset, feedback, canvasRunning: () => active };
  syncDesktopClass();
  const isAuth = document.body.dataset.page === 'login' || document.body.dataset.page === 'register';
  const intro = isAuth
    ? document.querySelectorAll('.auth-copy > *, .canvas-wrap, .form-heading > *, #auth-form > *, .auth-switch, .auth-note')
    : document.querySelectorAll('[data-enter]');
  animate([...intro], introTweens);
  reveal();
})();
