/* GSAP entrances + a bounded canvas effect. No animation is required to see content. */
(function () {
  'use strict';
  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  const pending = new Set(), tweens = new Set();
  let observer;
  const animate = (elements) => {
    if (preference.matches || !window.gsap || !elements.length) return;
    const tween = gsap.fromTo(elements, { y: 22, opacity: 0 }, {
      y: 0, opacity: 1, duration: .56, stagger: { amount: Math.min(.24, elements.length * .035) },
      ease: 'power2.out', clearProps: 'transform,opacity', onComplete: () => tweens.delete(tween)
    });
    tweens.add(tween);
  };
  if ('IntersectionObserver' in window) {
    observer = new IntersectionObserver(entries => {
      const visible = entries.filter(entry => entry.isIntersecting).map(entry => entry.target);
      visible.forEach(element => { observer.unobserve(element); pending.delete(element); });
      animate(visible);
    }, { threshold: .12 });
  }
  function reveal(container = document) {
    container.querySelectorAll('[data-reveal]').forEach(element => {
      if (preference.matches || !observer || !window.gsap) return;
      pending.add(element); observer.observe(element);
    });
  }
  function reset() {
    observer?.disconnect(); pending.clear();
    tweens.forEach(tween => tween.progress(1).kill()); tweens.clear();
  }
  function feedback(element) {
    if (!preference.matches && window.gsap) {
      gsap.fromTo(element, { x: -4 }, { x: 0, duration: .3, ease: 'elastic.out(1,.4)', clearProps: 'transform' });
    }
  }
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
    tweens.forEach(tween => document.hidden ? tween.pause() : tween.resume()); sync();
  });
  preference.addEventListener('change', () => { reset(); sync(); });
  window.addEventListener('pagehide', () => { reset(); stop(); });
  window.addEventListener('pageshow', sync);
  window.PortalMotion = { reveal, reset, feedback, canvasRunning: () => active };
  animate([...document.querySelectorAll('[data-enter]')]);
  reveal();
})();
