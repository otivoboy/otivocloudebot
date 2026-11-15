import gsap from 'gsap';

export function initPreloader(): void {
  const preloaderMaybe = document.getElementById('preloader');
  if (!preloaderMaybe) {
    document.body.classList.remove('otivo-preloading');
    return;
  }
  const preloader: HTMLElement = preloaderMaybe;

  const MIN_TIME = 3.6;
  const colors = ['#00e5ff', '#2f6bff', '#7b5cff'];
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const qs = <T extends Element>(sel: string) => preloader.querySelector<T>(sel);

  gsap.config({ force3D: true });
  gsap.ticker.lagSmoothing(0);

  // ---------- "AI CLOUD" letters ----------
  const sub = qs<HTMLElement>('#sub');
  if (sub && sub.childElementCount === 0) {
    'AI CLOUD'.split('').forEach((ch, i) => {
      const s = document.createElement('span');
      if (ch === ' ') {
        s.className = 'gap';
      } else {
        s.textContent = ch;
        s.style.color = i < 2 ? colors[0] : colors[(i % 2) + 1];
      }
      sub.appendChild(s);
    });
  }

  // ---------- Light particle field (few, flat, GPU-moved) ----------
  const pWrap = qs<HTMLElement>('#particles');
  const count = reduce ? 0 : window.innerWidth < 600 ? 12 : window.innerWidth < 1400 ? 22 : 32;
  if (pWrap && pWrap.childElementCount === 0) {
    for (let i = 0; i < count; i++) {
      const p = document.createElement('div');
      p.className = 'particle';
      p.style.left = `${gsap.utils.random(0, 100)}%`;
      p.style.top = `${gsap.utils.random(20, 100)}%`;
      p.style.background = gsap.utils.random(colors);
      const sc = gsap.utils.random(0.5, 1.4);
      gsap.set(p, { scale: sc });
      pWrap.appendChild(p);
      gsap.to(p, {
        y: -gsap.utils.random(140, 320),
        opacity: gsap.utils.random(0.35, 0.9),
        duration: gsap.utils.random(4, 8),
        repeat: -1,
        ease: 'sine.inOut',
        yoyo: true,
        delay: gsap.utils.random(0, 3),
      });
    }
  }

  // ---------- Ambient motion (transform only) ----------
  gsap.to('#preloader .g1', { x: '18vw', y: '10vh', duration: 8, repeat: -1, yoyo: true, ease: 'sine.inOut' });
  gsap.to('#preloader .g2', { x: '-16vw', y: '-8vh', duration: 9, repeat: -1, yoyo: true, ease: 'sine.inOut' });
  gsap.to('#preloader .g3', { scale: 1.25, duration: 5, repeat: -1, yoyo: true, ease: 'sine.inOut' });
  gsap.to('#preloader #r1', { rotation: 360, duration: 16, repeat: -1, ease: 'none' });
  gsap.to('#preloader #r2', { rotation: -360, duration: 24, repeat: -1, ease: 'none' });
  gsap.to('#preloader #r3', { rotation: 360, duration: 10, repeat: -1, ease: 'none' });
  gsap.to('#preloader #halo', { scale: 1.12, opacity: 0.75, duration: 2.2, repeat: -1, yoyo: true, ease: 'sine.inOut' });
  gsap.to('#preloader #logo', { y: -5, duration: 2.4, repeat: -1, yoyo: true, ease: 'sine.inOut' });
  gsap.to('#preloader #barShine', {
    x: () => (qs<HTMLElement>('.bar')?.offsetWidth ?? 300) + 80,
    duration: 1.3,
    repeat: -1,
    repeatDelay: 0.5,
    ease: 'power1.inOut',
  });

  // gentle parallax
  let onPointerMove: ((e: PointerEvent) => void) | null = null;
  if (!reduce && window.matchMedia('(pointer:fine)').matches) {
    const qx = gsap.quickTo('#preloader #stage', 'x', { duration: 0.9, ease: 'power3' });
    const qy = gsap.quickTo('#preloader #stage', 'y', { duration: 0.9, ease: 'power3' });
    const bx = gsap.quickTo('#preloader #bgLayer', 'x', { duration: 1.3, ease: 'power3' });
    const by = gsap.quickTo('#preloader #bgLayer', 'y', { duration: 1.3, ease: 'power3' });
    onPointerMove = (e: PointerEvent) => {
      const nx = e.clientX / window.innerWidth - 0.5;
      const ny = e.clientY / window.innerHeight - 0.5;
      qx(nx * 14);
      qy(ny * 14);
      bx(nx * -26);
      by(ny * -26);
    };
    window.addEventListener('pointermove', onPointerMove, { passive: true });
  }

  // ---------- Intro ----------
  const intro = gsap.timeline({ defaults: { ease: 'power3.out' } });
  intro
    .from('#preloader .ring', { scale: 0.3, opacity: 0, duration: 1.1, stagger: 0.12 }, 0)
    .from('#preloader #halo', { scale: 0.4, opacity: 0, duration: 1.4 }, 0)
    .to('#preloader #stroke-text', { strokeDashoffset: 0, duration: 1.9, ease: 'power2.inOut' }, 0.2)
    .to('#preloader #fill-text', { opacity: 1, duration: 0.9, ease: 'power2.out' }, 1.5)
    .to('#preloader #stroke-text', { opacity: 0, duration: 0.6 }, 1.8)
    .fromTo('#preloader #logo', { scale: 0.96 }, { scale: 1, duration: 0.9, ease: 'back.out(2)' }, 1.5)
    .fromTo('#preloader #sub span', { y: 22, opacity: 0 }, { y: 0, opacity: 1, duration: 0.55, stagger: 0.06 }, 1.8)
    .from('#preloader #loader', { y: 16, opacity: 0, duration: 0.7 }, 1.2);

  // ---------- Progress ----------
  const messages: Array<[number, string]> = [
    [0, 'Initializing neural core…'],
    [25, 'Connecting to OTIVO cloud…'],
    [50, 'Syncing live market data…'],
    [75, 'Warming up AI engine…'],
    [93, 'Almost there…'],
    [100, 'Ready!'],
  ];
  const state = { v: 0 };
  const pct = qs<HTMLElement>('#pct');
  const status = qs<HTMLElement>('#status');
  const fill = qs<HTMLElement>('#barFill');
  let shownPct = -1;
  let msgIndex = -1;

  function render() {
    const v = Math.round(state.v);
    if (fill) {
      fill.style.transform = `scaleX(${state.v / 100})`;
    }
    if (v === shownPct) return;
    shownPct = v;
    if (pct) pct.textContent = `${v}%`;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (v >= messages[i][0]) {
        if (i !== msgIndex) {
          msgIndex = i;
          if (status) status.textContent = messages[i][1];
        }
        break;
      }
    }
  }

  let finishing = false;
  let pageLoaded = document.readyState === 'complete';

  const crawl = gsap.to(state, {
    v: 90,
    duration: MIN_TIME,
    ease: 'power2.inOut',
    onUpdate: render,
    onComplete: maybeFinish,
  });

  if (!pageLoaded) {
    window.addEventListener(
      'load',
      () => {
        pageLoaded = true;
        maybeFinish();
      },
      { once: true }
    );
    // Fallback so an external font/network hiccup never blocks preloader completion
    window.setTimeout(() => {
      if (!pageLoaded) {
        pageLoaded = true;
        maybeFinish();
      }
    }, 6000);
  }

  function maybeFinish() {
    if (finishing || !pageLoaded || crawl.progress() < 1) return;
    finishing = true;
    gsap.to(state, {
      v: 100,
      duration: 0.6,
      ease: 'power2.out',
      onUpdate: render,
      onComplete: exit,
    });
  }

  // ---------- Exit ----------
  function exit() {
    const root = document.getElementById('root');
    if (onPointerMove) {
      window.removeEventListener('pointermove', onPointerMove);
      onPointerMove = null;
    }

    const tl = gsap.timeline({
      onComplete: () => {
        gsap.killTweensOf('#preloader, #preloader *');
        preloader.remove();
        document.body.classList.remove('otivo-preloading');
        if (root) {
          root.style.opacity = '';
          root.style.transform = '';
        }
        window.dispatchEvent(new CustomEvent('otivo:loaded'));
      },
    });

    tl.to('#preloader #loader', { y: 16, opacity: 0, duration: 0.35, ease: 'power2.in' })
      .to('#preloader #sub span', { y: -14, opacity: 0, stagger: 0.025, duration: 0.25 }, '<')
      .fromTo(
        '#preloader #flash',
        { scale: 0.05, opacity: 0.9 },
        { scale: 1, opacity: 0, duration: 0.9, ease: 'power2.out' },
        '>-0.05'
      )
      .to('#preloader #logo', { scale: 1.35, opacity: 0, duration: 0.6, ease: 'power3.in' }, '<')
      .to(['#preloader .ring', '#preloader #halo'], { scale: 1.6, opacity: 0, duration: 0.6, ease: 'power3.in' }, '<')
      .to('#preloader #bgLayer', { opacity: 0, duration: 0.45 }, '<.15');

    if (root) {
      tl.set(root, { opacity: 1 });
    }

    tl.to('#preloader .half.top', { yPercent: -100, duration: 0.85, ease: 'expo.inOut' }, '>-0.1')
      .to('#preloader .half.bottom', { yPercent: 100, duration: 0.85, ease: 'expo.inOut' }, '<');

    if (root) {
      tl.from(root, { y: 20, opacity: 0, duration: 0.55, ease: 'power3.out' }, '<.3');
    }
  }

  if (reduce) {
    gsap.globalTimeline.timeScale(3);
  }
}
