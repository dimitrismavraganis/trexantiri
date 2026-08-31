(function () {
  // header glass on scroll (pages without a hero intro use this immediately)
  function initHeaderScroll() {
    var header = document.querySelector('.site-header[data-auto-glass]');
    if (!header) return;
    function update() {
      header.classList.toggle('is-glass', window.scrollY > 8);
    }
    window.addEventListener('scroll', update, { passive: true });
    update();
  }

  // mobile modal menu
  function initMobileMenu() {
    var toggles = document.querySelectorAll('[data-menu-toggle]');
    var overlay = document.querySelector('[data-mobile-menu]');
    if (!overlay) return;
    var panel = overlay.querySelector('.trx-modal-panel');
    function open() { overlay.classList.add('is-open'); }
    function close() { overlay.classList.remove('is-open'); }
    toggles.forEach(function (btn) {
      btn.addEventListener('click', function () {
        overlay.classList.contains('is-open') ? close() : open();
      });
    });
    overlay.addEventListener('click', close);
    // The panel swallows clicks so that clicking inside it doesn't dismiss the
    // menu — which means the close button needs its own handler to reach us.
    if (panel) panel.addEventListener('click', function (e) { e.stopPropagation(); });
    overlay.querySelectorAll('button.close').forEach(function (b) { b.addEventListener('click', close); });
    overlay.querySelectorAll('a').forEach(function (a) { a.addEventListener('click', close); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') close();
    });
  }

  /**
   * Infinite draggable carousels.
   *
   * The markup lists each photo once. Here the strip is cloned until it is
   * comfortably wider than its container, and then moved with a transform
   * instead of scrollLeft. Because the offset is taken modulo the width of one
   * set, the strip wraps without ever hitting an edge — there is no jump back
   * and no rubber-banding at either end, which is what made the old
   * scrollLeft version feel broken.
   *
   * Dragging moves the strip 1:1 with the pointer and keeps its momentum on
   * release. Between interactions the strip drifts slowly on its own; hovering
   * it (or grabbing it) stops the drift.
   */
  function initCarousels() {
    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    document.querySelectorAll('.trx-carousel').forEach(function (track) {
      var wrap = track.parentElement;
      var originals = [].slice.call(track.children);
      if (!originals.length || !wrap) return;

      var GAP = parseFloat(getComputedStyle(track).columnGap || getComputedStyle(track).gap) || 0;
      var DRIFT = reduced ? 0 : 0.28;   // px per frame, ≈17px/s
      var FRICTION = 0.94;              // momentum decay after a throw

      var setWidth = 0;   // width of one full set of the original items
      var pos = 0;        // how far the strip is scrolled, in px
      var vel = 0;        // leftover velocity from a drag
      var dragging = false, hovering = false;
      var lastX = 0, pointerId = null;
      var frame = null;

      // Duplicate the strip until it covers the container twice over, so that
      // whatever part of the loop is on screen always has content either side.
      function build() {
        [].slice.call(track.children).forEach(function (child) {
          if (child.hasAttribute('data-clone')) track.removeChild(child);
        });
        setWidth = originals.reduce(function (sum, el) { return sum + el.offsetWidth + GAP; }, 0);
        if (setWidth <= 0) return false;
        var needed = wrap.clientWidth * 2 + setWidth;
        for (var total = setWidth; total < needed; total += setWidth) {
          originals.forEach(function (el) {
            var clone = el.cloneNode(true);
            clone.setAttribute('data-clone', '');
            clone.setAttribute('aria-hidden', 'true');
            track.appendChild(clone);
          });
        }
        track.classList.add('is-loop');
        return true;
      }

      function render() {
        pos = ((pos % setWidth) + setWidth) % setWidth;
        track.style.transform = 'translate3d(' + -pos + 'px,0,0)';
      }

      function tick() {
        if (!dragging) {
          pos += vel;
          vel *= FRICTION;
          if (Math.abs(vel) < 0.02) vel = 0;
          if (!hovering) pos += DRIFT;
        }
        render();
        frame = requestAnimationFrame(tick);
      }

      function start() {
        if (frame === null) frame = requestAnimationFrame(tick);
      }
      function stop() {
        if (frame !== null) { cancelAnimationFrame(frame); frame = null; }
      }

      if (!build()) return;
      render();
      start();

      track.addEventListener('pointerdown', function (e) {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        dragging = true;
        vel = 0;
        lastX = e.clientX;
        pointerId = e.pointerId;
        track.classList.add('is-dragging');
        if (track.setPointerCapture) track.setPointerCapture(e.pointerId);
      });

      track.addEventListener('pointermove', function (e) {
        if (!dragging || e.pointerId !== pointerId) return;
        var dx = e.clientX - lastX;
        lastX = e.clientX;
        pos -= dx;
        // Smooth the per-frame velocity so a twitchy last sample doesn't
        // decide where the strip coasts to.
        vel = vel * 0.6 + -dx * 0.4;
        render();
      });

      function endDrag(e) {
        if (!dragging || (e && e.pointerId !== pointerId)) return;
        dragging = false;
        pointerId = null;
        track.classList.remove('is-dragging');
      }
      track.addEventListener('pointerup', endDrag);
      track.addEventListener('pointercancel', endDrag);

      track.addEventListener('mouseenter', function () { hovering = true; });
      track.addEventListener('mouseleave', function () { hovering = false; });

      // Trackpads and shift-wheel scroll the strip horizontally.
      track.addEventListener('wheel', function (e) {
        var dx = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : (e.shiftKey ? e.deltaY : 0);
        if (!dx) return;
        e.preventDefault();
        pos += dx;
        vel = dx * 0.2;
        render();
      }, { passive: false });

      // An off-screen carousel has nothing to animate.
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (entries) {
          if (entries[0].isIntersecting) start(); else stop();
        }, { rootMargin: '120px' }).observe(wrap);
      }

      var resizeT;
      window.addEventListener('resize', function () {
        clearTimeout(resizeT);
        resizeT = setTimeout(function () {
          if (build()) render();
        }, 150);
      });
    });
  }

  // cookie notice — one line, one button, remembered in localStorage
  function initCookieNotice() {
    var bar = document.querySelector('[data-cookie-notice]');
    if (!bar) return;
    var KEY = 'trx-cookie-notice';
    var stored = null;
    try { stored = localStorage.getItem(KEY); } catch (e) { /* private mode */ }
    if (stored === 'ok') return;
    bar.classList.add('is-visible');
    var accept = bar.querySelector('[data-cookie-accept]');
    if (accept) accept.addEventListener('click', function () {
      bar.classList.remove('is-visible');
      try { localStorage.setItem(KEY, 'ok'); } catch (e) { /* private mode */ }
    });
  }

  // scroll-triggered reveal (replaces GSAP ScrollTrigger)
  function initScrollReveal() {
    if (!('IntersectionObserver' in window)) {
      document.querySelectorAll('[data-reveal], [data-reveal-group]').forEach(function (el) { el.classList.add('in-view'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });
    document.querySelectorAll('[data-reveal], [data-reveal-group]').forEach(function (el) { io.observe(el); });
  }

  document.addEventListener('DOMContentLoaded', function () {
    initHeaderScroll();
    initMobileMenu();
    initCarousels();
    initScrollReveal();
    initCookieNotice();
  });
})();
