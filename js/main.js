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
    if (panel) panel.addEventListener('click', function (e) { e.stopPropagation(); });
    overlay.querySelectorAll('a').forEach(function (a) { a.addEventListener('click', close); });
  }

  // infinite-loop draggable carousels
  function initCarousels() {
    document.querySelectorAll('.trx-carousel').forEach(function (el) {
      var isDown = false, startX = 0, scrollStart = 0;
      function onDown(e) {
        isDown = true; el.style.scrollSnapType = 'none'; el.style.cursor = 'grabbing';
        startX = (e.touches ? e.touches[0].clientX : e.pageX); scrollStart = el.scrollLeft;
      }
      function onMove(e) {
        if (!isDown) return;
        var x = (e.touches ? e.touches[0].clientX : e.pageX);
        el.scrollLeft = scrollStart - (x - startX);
        if (e.cancelable) e.preventDefault();
      }
      function onUp() {
        if (!isDown) return;
        isDown = false; el.style.cursor = 'grab';
        setTimeout(function () { el.style.scrollSnapType = 'x proximity'; }, 50);
      }
      el.style.cursor = 'grab';
      el.addEventListener('mousedown', onDown);
      el.addEventListener('touchstart', onDown, { passive: true });
      window.addEventListener('mousemove', onMove);
      el.addEventListener('touchmove', onMove, { passive: false });
      window.addEventListener('mouseup', onUp);
      el.addEventListener('touchend', onUp);
      (function initLoop(tries) {
        var set = el.scrollWidth / 3;
        if (set > 10) { el.scrollLeft = set; return; }
        if ((tries || 0) > 40) return;
        setTimeout(function () { initLoop((tries || 0) + 1); }, 50);
      })();
      var loopT;
      el.addEventListener('scroll', function () {
        clearTimeout(loopT);
        loopT = setTimeout(function () {
          var set = el.scrollWidth / 3;
          if (set <= 0) return;
          if (el.scrollLeft < set * 0.05) el.scrollLeft += set;
          else if (el.scrollLeft > set * 1.95) el.scrollLeft -= set;
        }, 80);
      }, { passive: true });
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
  });
})();
