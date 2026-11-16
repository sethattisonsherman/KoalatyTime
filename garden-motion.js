(function () {
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  // Document coordinates keep a pet attached to the same edge while the page scrolls.
  function edgePoint(rect, size, viewport, scroll, edge = 'top', random = Math.random, input = false) {
    const left = rect.left + scroll.x, right = rect.right + scroll.x;
    const top = rect.top + scroll.y, bottom = rect.bottom + scroll.y;
    const minX = clamp(left + 8, scroll.x + 4, scroll.x + viewport.width - size - 4);
    const maxX = clamp(right - size - 8, minX, scroll.x + viewport.width - size - 4);
    if ((edge === 'left' || edge === 'right') && rect.height >= size + 32) {
      return {
        x: Math.round(clamp(edge === 'left' ? left - size * .62 : right - size * .38, scroll.x + 4, scroll.x + viewport.width - size - 4)),
        y: Math.round(top + 12 + random() * (bottom - top - size - 24))
      };
    }
    const perchMinX = input ? Math.max(minX, maxX - size * .35) : minX;
    return {
      x: Math.round(perchMinX + random() * (maxX - perchMinX)),
      y: Math.round((edge === 'bottom' ? bottom : top) - size * (input ? .50 : .90))
    };
  }

  function walkPoint(rect, size, viewport, scroll, current, edge = 'top', random = Math.random, input = false) {
    const start = edgePoint(rect, size, viewport, scroll, edge, () => 0, input);
    const end = edgePoint(rect, size, viewport, scroll, edge, () => 1, input);
    const axis = edge === 'top' || edge === 'bottom' || start.y === end.y ? 'x' : 'y';
    const distance = 26 + random() * 105, direction = random() < .5 ? -1 : 1;
    let value = clamp(current[axis] + direction * distance, start[axis], end[axis]);
    if (Math.abs(value - current[axis]) < 12) value = clamp(current[axis] - direction * distance, start[axis], end[axis]);
    return { x: axis === 'x' ? Math.round(value) : start.x, y: axis === 'y' ? Math.round(value) : start.y };
  }

  function facingLeft(edge, dx = 0) {
    if (edge === 'right') return true;
    if (edge === 'left') return false;
    return dx < 0;
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { edgePoint, walkPoint, facingLeft };
  if (typeof document === 'undefined') return;

  function startGardenMotion() {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const random = () => Math.random();
    const app = document.getElementById('app');
    let ambience = null, layer = null, pets = [], observer = null, layoutFrame = 0;

    function viewport() {
      return { width: window.innerWidth, height: window.innerHeight, size: window.innerWidth <= 700 ? 36 : 54 };
    }

    function scroll() { return { x: window.scrollX, y: window.scrollY }; }

    function isInputHost(host) {
      return host.matches('.koala-nook.field-nook, .add-item-form');
    }

    function landmarks() {
      const selector = app
        ? '#app .welcome, #app .main-panel, #app .week-stamp, #app .source-scan, #app .schedule-prefs, #app .idea-box, #app .plan-section, #app .goal-summary, #app .calendar-save-panel, #app .steps, #app .koala-nook.field-nook, #app .add-item-form'
        : 'body > main';
      const { height, size } = viewport();
      return [...document.querySelectorAll(selector)].filter(host => {
        const rect = host.getBoundingClientRect();
        const style = getComputedStyle(host);
        const hasSurface = isInputHost(host) || parseFloat(style.borderTopWidth) > 0 || parseFloat(style.borderLeftWidth) > 0
          || parseFloat(style.borderRightWidth) > 0 || !['transparent', 'rgba(0, 0, 0, 0)'].includes(style.backgroundColor)
          || style.backgroundImage !== 'none';
        return hasSurface && rect.width > size * 2 && rect.height > 20 && rect.top < height - 18 && rect.bottom > 80;
      });
    }

    function chooseHost(hosts) {
      const containers = hosts.filter(host => !isInputHost(host));
      const pool = containers.length && random() < .86 ? containers : hosts;
      return pool[Math.floor(random() * pool.length)];
    }

    function chooseEdge(host, view) {
      const rect = host.getBoundingClientRect();
      if (isInputHost(host) || rect.height < view.size * 1.8) return 'top';
      const roll = random();
      const floorVisible = rect.height > view.size * 2.4 && rect.bottom < view.height + view.size;
      if (view.width <= 700) return floorVisible && roll > .84 ? 'bottom' : 'top';
      return roll < .60 ? 'top' : roll < .74 && floorVisible ? 'bottom' : roll < .87 ? 'left' : 'right';
    }

    function pointOn(host, edge, fraction = random()) {
      const view = viewport();
      return edgePoint(host.getBoundingClientRect(), view.size, view, scroll(), edge, () => fraction, isInputHost(host));
    }

    function setAt(pet, host, point, edge = pet.edge || 'top') {
      pet.host = host; pet.edge = edge; pet.x = point.x; pet.y = point.y;
      if (edge === 'left' || edge === 'right') pet.left = facingLeft(edge);
      const start = pointOn(host, edge, 0), end = pointOn(host, edge, 1);
      const axis = edge === 'top' || edge === 'bottom' ? 'x' : 'y';
      pet.fraction = clamp((point[axis] - start[axis]) / Math.max(1, end[axis] - start[axis]), 0, 1);
      pet.el.style.left = `${point.x}px`;
      pet.el.style.top = `${point.y}px`;
      const rect = host.getBoundingClientRect(), offset = scroll();
      const border = getComputedStyle(host);
      const borderSide = edge === 'top' ? 'Top' : edge === 'bottom' ? 'Bottom' : edge === 'left' ? 'Left' : 'Right';
      const borderWidth = parseFloat(border[`border${borderSide}Width`]) || 0;
      pet.el.style.setProperty('--koala-contact-x', `${Math.round((edge === 'left' ? rect.left : rect.right) + offset.x - point.x)}px`);
      pet.el.style.setProperty('--koala-contact-y', `${Math.round((edge === 'bottom' ? rect.bottom : rect.top) + offset.y - point.y)}px`);
      pet.el.style.setProperty('--koala-rail-color', borderWidth ? border[`border${borderSide}Color`] : 'rgba(53, 110, 87, .42)');
      pet.el.style.setProperty('--koala-rail-width', `${clamp(borderWidth, 2, 4)}px`);
      pet.el.hidden = false;
    }

    function schedule(pet, delay) {
      pet.timer = window.setTimeout(() => wander(pet), delay);
    }

    function idle(pet) {
      const pose = isInputHost(pet.host) ? 'is-dangling' : pet.edge === 'left' || pet.edge === 'right' ? 'is-clinging'
        : pet.edge === 'bottom' ? ['is-idle', 'is-waving', 'is-sitting'][Math.floor(random() * 3)]
        : ['is-idle', 'is-idle', 'is-waving', 'is-sitting', 'is-peeking', 'is-hanging'][Math.floor(random() * 6)];
      pet.el.className = `roaming-koala edge-${pet.edge} ${pet.left ? 'facing-left ' : ''}${pose}`;
      schedule(pet, 700 + random() * 1700);
    }

    function land(pet) {
      pet.el.className = `roaming-koala edge-${pet.edge} ${pet.left ? 'facing-left ' : ''}is-landing`;
      pet.timer = window.setTimeout(() => idle(pet), 360);
    }

    function animateTo(pet, host, point, edge, jumping = false) {
      const dx = point.x - pet.x, dy = point.y - pet.y;
      pet.left = facingLeft(edge, dx);
      const action = jumping ? 'is-jumping' : edge === 'left' || edge === 'right' ? 'is-climbing' : 'is-walking';
      pet.el.className = `roaming-koala edge-${edge} ${pet.left ? 'facing-left ' : ''}${action}`;
      const duration = jumping ? 920 : clamp(Math.hypot(dx, dy) * 23, 900, 3500);
      const frames = jumping
        ? [{ transform: 'translate(0px, 0px)' }, { transform: `translate(${dx / 2}px, ${dy / 2 - 28}px)`, offset: .5 }, { transform: `translate(${dx}px, ${dy}px)` }]
        : [{ transform: 'translate(0px, 0px)' }, { transform: `translate(${dx}px, ${dy}px)` }];
      pet.motion = pet.el.animate(frames, { duration, easing: jumping ? 'ease-in-out' : 'linear', fill: 'forwards' });
      pet.motion.onfinish = () => {
        if (!layer) return;
        setAt(pet, host, point, edge);
        pet.motion.cancel(); pet.motion = null;
        land(pet);
      };
    }

    function wander(pet) {
      if (!layer || preference.matches) return;
      if (document.hidden) { schedule(pet, 1200); return; }
      const hosts = landmarks(), view = viewport();
      if (!hosts.length) { pet.el.hidden = true; schedule(pet, 1300); return; }
      if (!pet.host?.isConnected || !hosts.includes(pet.host)) {
        const host = chooseHost(hosts), edge = chooseEdge(host, view);
        setAt(pet, host, pointOn(host, edge), edge);
      }
      const roll = random();
      if (roll < .30) { idle(pet); return; }
      if (roll < .82) {
        const point = walkPoint(pet.host.getBoundingClientRect(), view.size, view, scroll(), pet, pet.edge, random, isInputHost(pet.host));
        if (Math.hypot(point.x - pet.x, point.y - pet.y) < 8) { idle(pet); return; }
        animateTo(pet, pet.host, point, pet.edge);
        return;
      }
      const nearby = hosts.filter(host => host !== pet.host && !isInputHost(host)).map(host => {
        const edge = chooseEdge(host, view);
        return { host, edge, point: pointOn(host, edge) };
      }).filter(({ point }) => Math.hypot(point.x - pet.x, point.y - pet.y) < 220);
      if (nearby.length) {
        const destination = nearby[Math.floor(random() * nearby.length)];
        animateTo(pet, destination.host, destination.point, destination.edge, true);
      } else {
        const point = walkPoint(pet.host.getBoundingClientRect(), view.size, view, scroll(), pet, pet.edge, random, isInputHost(pet.host));
        animateTo(pet, pet.host, point, pet.edge, true);
      }
    }

    function reanchor() {
      layoutFrame = 0;
      if (!layer) return;
      const hosts = landmarks(), view = viewport();
      pets.forEach(pet => {
        window.clearTimeout(pet.timer);
        pet.motion?.cancel(); pet.motion = null;
        const replaced = !pet.host?.isConnected;
        if (replaced) pet.host = chooseHost(hosts) || null;
        if (!pet.host) { pet.el.hidden = true; schedule(pet, 1000); return; }
        const edge = replaced || ((pet.edge === 'left' || pet.edge === 'right') && (view.width <= 700 || pet.host.getBoundingClientRect().height < view.size * 1.8))
          ? chooseEdge(pet.host, view) : pet.edge;
        setAt(pet, pet.host, pointOn(pet.host, edge, pet.fraction), edge);
        idle(pet);
      });
    }

    function requestReanchor() {
      if (!layoutFrame) layoutFrame = window.requestAnimationFrame(reanchor);
    }

    function stop() {
      pets.forEach(pet => { window.clearTimeout(pet.timer); pet.motion?.cancel(); });
      pets = [];
      observer?.disconnect(); observer = null;
      if (layoutFrame) window.cancelAnimationFrame(layoutFrame);
      layoutFrame = 0;
      ambience?.remove(); ambience = null;
      layer?.remove(); layer = null;
    }

    function start() {
      if (preference.matches || layer) return;
      ambience = document.createElement('div');
      ambience.className = 'garden-ambience'; ambience.setAttribute('aria-hidden', 'true');
      ambience.innerHTML = '<span class="garden-cloud"></span><span class="garden-cloud"></span><span class="garden-fish"></span><span class="garden-fish"></span><span class="garden-water-glint"></span><span class="garden-water-glint"></span><span class="garden-water-glint"></span>';
      layer = document.createElement('div');
      layer.className = 'koala-roam-layer'; layer.setAttribute('aria-hidden', 'true');
      document.body.append(ambience, layer);
      const hosts = landmarks(), view = viewport();
      let firstHost = null;
      for (let i = 0; i < 2; i++) {
        const el = document.createElement('div');
        el.className = 'roaming-koala is-idle';
        el.innerHTML = '<span class="koala-sprite"></span>';
        layer.append(el);
        const pet = { el, host: null, edge: 'top', x: 0, y: 0, fraction: 0, left: false, timer: null, motion: null };
        if (hosts.length) {
          const host = chooseHost(hosts.filter(candidate => candidate !== firstHost)) || chooseHost(hosts), edge = chooseEdge(host, view);
          if (i === 0) firstHost = host;
          setAt(pet, host, pointOn(host, edge), edge);
          idle(pet);
        } else { el.hidden = true; schedule(pet, 1000); }
        pets.push(pet);
      }
      if (app) {
        observer = new MutationObserver(requestReanchor);
        observer.observe(app, { childList: true, subtree: false });
      }
    }

    preference.addEventListener('change', () => preference.matches ? stop() : start());
    window.addEventListener('resize', requestReanchor);
    start();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startGardenMotion, { once: true });
  else startGardenMotion();
})();
