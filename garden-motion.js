(function () {
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  function perchPoint(rect, size, viewport, random = Math.random, input = false) {
    const minX = clamp(rect.left + 8, 4, viewport.width - size - 4);
    const maxX = clamp(rect.right - size - 8, minX, viewport.width - size - 4);
    return {
      x: Math.round(minX + random() * (maxX - minX)),
      y: Math.round(clamp(rect.top - size * (input ? .38 : .66), 4, viewport.height - size - 4))
    };
  }

  function walkPoint(rect, size, viewport, current, random = Math.random, input = false) {
    const minX = clamp(rect.left + 8, 4, viewport.width - size - 4);
    const maxX = clamp(rect.right - size - 8, minX, viewport.width - size - 4);
    const distance = 26 + random() * 105, direction = random() < .5 ? -1 : 1;
    let x = clamp(current.x + direction * distance, minX, maxX);
    if (Math.abs(x - current.x) < 12) x = clamp(current.x - direction * distance, minX, maxX);
    return { x: Math.round(x), y: perchPoint(rect, size, viewport, random, input).y };
  }

  function chooseButtonMode(previous, random = Math.random) {
    const modes = ['walk', 'jump', 'dangle', 'breathe'].filter(mode => mode !== previous);
    return modes[Math.floor(random() * modes.length)];
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { perchPoint, walkPoint, chooseButtonMode };
  if (typeof document === 'undefined') return;

  function startGardenMotion() {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const random = () => Math.random();
    const app = document.getElementById('app');
    let ambience = null, layer = null, pets = [], observer = null, scrollFrame = 0;

    function viewport() {
      return { width: window.innerWidth, height: window.innerHeight, size: window.innerWidth <= 700 ? 36 : 54 };
    }

    function isInputHost(host) {
      return host.matches('.koala-nook.field-nook, .add-item-form');
    }

    function landmarks() {
      const selector = app
        ? '#app .welcome, #app .main-panel, #app .week-stamp, #app .source-scan, #app .schedule-prefs, #app .idea-box, #app .plan-section, #app .goal-summary, #app .calendar-save-panel, #app .steps, #app h1, #app h2, #app .koala-nook.field-nook, #app .add-item-form'
        : 'body > main, body > main h1, body > main h2';
      const { height, size } = viewport();
      return [...document.querySelectorAll(selector)].filter(host => {
        const rect = host.getBoundingClientRect();
        return rect.width > size * 2 && rect.height > 20 && rect.top > 70 && rect.top < height - 18 && rect.bottom > 80;
      });
    }

    function setAt(pet, host, point) {
      pet.host = host; pet.x = point.x; pet.y = point.y;
      const rect = host.getBoundingClientRect();
      pet.fraction = clamp((point.x - rect.left) / Math.max(1, rect.width - viewport().size), 0, 1);
      pet.el.style.left = `${point.x}px`;
      pet.el.style.top = `${point.y}px`;
      pet.el.hidden = false;
    }

    function schedule(pet, delay) {
      pet.timer = window.setTimeout(() => wander(pet), delay);
    }

    function idle(pet) {
      pet.el.className = `roaming-koala ${pet.left ? 'facing-left ' : ''}${pet.host && isInputHost(pet.host) ? 'is-dangling' : 'is-idle'}`;
      schedule(pet, 550 + random() * 1500);
    }

    function animateTo(pet, host, point, jumping) {
      const dx = point.x - pet.x, dy = point.y - pet.y;
      pet.left = dx < 0;
      pet.el.className = `roaming-koala ${pet.left ? 'facing-left ' : ''}${jumping ? 'is-jumping' : 'is-walking'}`;
      const duration = jumping ? 880 : clamp(Math.hypot(dx, dy) * 23, 900, 3500);
      const frames = jumping
        ? [{ transform: 'translate(0px, 0px)' }, { transform: `translate(${dx / 2}px, ${dy / 2 - 25}px)`, offset: .5 }, { transform: `translate(${dx}px, ${dy}px)` }]
        : [{ transform: 'translate(0px, 0px)' }, { transform: `translate(${dx}px, ${dy}px)` }];
      pet.motion = pet.el.animate(frames, { duration, easing: jumping ? 'ease-in-out' : 'linear', fill: 'forwards' });
      pet.motion.onfinish = () => {
        if (!layer) return;
        setAt(pet, host, point);
        pet.motion.cancel(); pet.motion = null;
        idle(pet);
      };
    }

    function wander(pet) {
      if (!layer || preference.matches) return;
      if (document.hidden) { schedule(pet, 1200); return; }
      const hosts = landmarks(), view = viewport();
      if (!hosts.length) { pet.el.hidden = true; schedule(pet, 1300); return; }
      if (!pet.host?.isConnected || !hosts.includes(pet.host)) {
        const host = hosts[Math.floor(random() * hosts.length)];
        setAt(pet, host, perchPoint(host.getBoundingClientRect(), view.size, view, random, isInputHost(host)));
      }
      const roll = random();
      if (roll < .22) { idle(pet); return; }
      if (roll < .72) {
        const point = walkPoint(pet.host.getBoundingClientRect(), view.size, view, pet, random, isInputHost(pet.host));
        if (Math.abs(point.x - pet.x) < 8) { idle(pet); return; }
        animateTo(pet, pet.host, point, false);
        return;
      }
      const nearby = hosts.filter(host => host !== pet.host).map(host => ({ host, point: perchPoint(host.getBoundingClientRect(), view.size, view, random, isInputHost(host)) }))
        .filter(({ point }) => Math.hypot(point.x - pet.x, point.y - pet.y) < 240);
      const destination = nearby.length ? nearby[Math.floor(random() * nearby.length)] : {
        host: pet.host,
        point: walkPoint(pet.host.getBoundingClientRect(), view.size, view, pet, random, isInputHost(pet.host))
      };
      animateTo(pet, destination.host, destination.point, true);
    }

    function reanchor() {
      scrollFrame = 0;
      if (!layer) return;
      const hosts = landmarks(), view = viewport();
      pets.forEach(pet => {
        window.clearTimeout(pet.timer);
        pet.motion?.cancel(); pet.motion = null;
        if (!pet.host?.isConnected || !hosts.includes(pet.host)) pet.host = hosts[Math.floor(random() * hosts.length)] || null;
        if (!pet.host) { pet.el.hidden = true; schedule(pet, 1000); return; }
        const rect = pet.host.getBoundingClientRect();
        const minX = clamp(rect.left + 8, 4, view.width - view.size - 4);
        const maxX = clamp(rect.right - view.size - 8, minX, view.width - view.size - 4);
        const point = perchPoint(rect, view.size, view, () => pet.fraction ?? random(), isInputHost(pet.host));
        point.x = Math.round(minX + (pet.fraction ?? random()) * (maxX - minX));
        setAt(pet, pet.host, point);
        idle(pet);
      });
    }

    function requestReanchor() {
      if (!scrollFrame) scrollFrame = window.requestAnimationFrame(reanchor);
    }

    function stop() {
      pets.forEach(pet => { window.clearTimeout(pet.timer); pet.motion?.cancel(); });
      pets = [];
      observer?.disconnect(); observer = null;
      ambience?.remove(); ambience = null;
      layer?.remove(); layer = null;
    }

    function start() {
      if (preference.matches || layer) return;
      ambience = document.createElement('div');
      ambience.className = 'garden-ambience'; ambience.setAttribute('aria-hidden', 'true');
      ambience.innerHTML = '<span class="garden-cloud"></span><span class="garden-cloud"></span><span class="garden-fish"></span><span class="garden-fish"></span>';
      layer = document.createElement('div');
      layer.className = 'koala-roam-layer'; layer.setAttribute('aria-hidden', 'true');
      document.body.append(ambience, layer);
      const hosts = landmarks(), view = viewport();
      for (let i = 0; i < 2; i++) {
        const el = document.createElement('div');
        el.className = 'roaming-koala is-idle';
        el.innerHTML = '<span class="koala-sprite"></span>';
        layer.append(el);
        const pet = { el, host: null, x: 0, y: 0, fraction: 0, left: false, timer: null, motion: null };
        if (hosts.length) {
          const host = hosts[Math.floor(random() * hosts.length)];
          setAt(pet, host, perchPoint(host.getBoundingClientRect(), view.size, view, random, isInputHost(host)));
        } else el.hidden = true;
        pets.push(pet);
        schedule(pet, 500 + i * 700 + random() * 900);
      }
      if (app) {
        observer = new MutationObserver(requestReanchor);
        observer.observe(app, { childList: true, subtree: false });
      }
    }

    function showButtonPet(button, fresh = true) {
      if (button.disabled || button.matches('.plan-event, .item-help-button')) return;
      const old = button.querySelector(':scope > .button-koala');
      if (old && !fresh) return;
      old?.remove();
      const mode = chooseButtonMode(button.dataset.koalaLast, random);
      button.dataset.koalaLast = mode;
      const pet = document.createElement('span');
      pet.className = `button-koala mode-${mode}`;
      pet.setAttribute('aria-hidden', 'true');
      pet.innerHTML = '<span class="koala-sprite"></span>';
      button.classList.add('has-button-koala');
      button.append(pet);
    }

    function removeButtonPet(button) {
      button.querySelector(':scope > .button-koala')?.remove();
      button.classList.remove('has-button-koala');
    }

    document.addEventListener('pointerover', event => {
      const button = event.target.closest?.('button');
      if (button && !button.contains(event.relatedTarget)) showButtonPet(button);
    });
    document.addEventListener('pointerout', event => {
      const button = event.target.closest?.('button');
      if (button && !button.contains(event.relatedTarget) && button !== document.activeElement) removeButtonPet(button);
    });
    document.addEventListener('focusin', event => {
      const button = event.target.closest?.('button');
      if (button) showButtonPet(button, false);
    });
    document.addEventListener('focusout', event => {
      const button = event.target.closest?.('button');
      if (button && !button.matches(':hover')) removeButtonPet(button);
    });
    preference.addEventListener('change', () => preference.matches ? stop() : start());
    window.addEventListener('scroll', requestReanchor, { passive: true });
    window.addEventListener('resize', requestReanchor);
    start();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startGardenMotion, { once: true });
  else startGardenMotion();
})();
