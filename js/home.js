(function () {
  function tween(duration, onUpdate, ease) {
    return new Promise(function (resolve, reject) {
      var start = performance.now();
      function step() {
        var t = Math.min((performance.now() - start) / duration, 1);
        // onUpdate runs inside a timer, so a throw here would escape the caller's
        // try/catch and leave this promise pending forever — reject instead.
        try { onUpdate(ease ? ease(t) : t); } catch (err) { reject(err); return; }
        if (t < 1) setTimeout(step, 16); else resolve();
      }
      step();
    });
  }
  function easeOut2(t) { return 1 - (1 - t) * (1 - t); }
  function easeInOutCubic(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var heroDone = false;

  function finalizeHero() {
    if (heroDone) return;
    heroDone = true;
    var section = document.getElementById('hero-section');
    if (section) {
      section.style.width = '100%';
      section.style.borderRadius = '0px';
      section.querySelectorAll('[data-hero-el]').forEach(function (el) {
        el.style.opacity = 1; el.style.filter = 'blur(0px)'; el.style.transform = 'translateY(0)';
      });
    }
  }

  async function runPreloader(onDone) {
    var el = document.getElementById('preloader');
    if (!el) { onDone(); return; }
    if (reduced) { el.style.display = 'none'; onDone(); return; }
    try {
      var path = document.getElementById('preloader-path');
      var dot = document.getElementById('preloader-dot');
      var boatWrap = document.getElementById('preloader-boat');
      var pctEl = document.getElementById('preloader-pct');
      if (!path || !dot || !boatWrap) { el.style.display = 'none'; onDone(); return; }
      var len = path.getTotalLength();
      path.style.strokeDasharray = String(len);
      path.style.strokeDashoffset = String(len);

      await Promise.all([
        tween(850, function (e) {
          path.style.strokeDashoffset = String(len * (1 - e));
          var pt = path.getPointAtLength(e * len);
          dot.setAttribute('cx', pt.x);
          dot.setAttribute('cy', pt.y);
        }, easeInOutCubic),
        tween(1000, function (e) { if (pctEl) pctEl.textContent = Math.round(e * 100) + '%'; }, easeInOutCubic)
      ]);
      await tween(300, function (e) { boatWrap.style.transform = 'scale(' + (1 - e * 0.18) + ')'; }, easeOut2);
      await tween(500, function (e) { el.style.transform = 'translateY(' + (-e * 100) + '%)'; }, easeInOutCubic);
      el.style.display = 'none';
      onDone();
    } catch (e) {
      console.error('Trexantiri preloader error:', e);
      el.style.display = 'none';
      onDone();
    }
  }

  async function setupHero() {
    var section = document.getElementById('hero-section');
    var img = document.getElementById('hero-bg-img');
    if (!section) { heroDone = true; return; }
    var els = [].slice.call(section.querySelectorAll('[data-hero-el]'));

    if (reduced) { finalizeHero(); return; }

    section.style.width = '24%';
    section.style.borderRadius = '50% 50% 0 0';
    els.forEach(function (el) { el.style.opacity = 0; });

    await tween(1300, function (e) {
      section.style.width = (24 + e * 76) + '%';
      var radiusPct = 50 * (1 - e);
      section.style.borderRadius = radiusPct + '% ' + radiusPct + '% 0 0';
      if (img) img.style.transform = 'scale(' + (1.15 - e * 0.15) + ')';
    }, easeInOutCubic);

    for (var i = 0; i < els.length; i++) {
      await tween(420, (function (el) {
        return function (e) {
          el.style.opacity = e;
          el.style.filter = 'blur(' + ((1 - e) * 10) + 'px)';
          el.style.transform = 'translateY(' + ((1 - e) * 16) + 'px)';
        };
      })(els[i]), easeOut2);
    }

    heroDone = true;
  }

  function setupSignatureScene() {
    var wrapper = document.getElementById('scene-wrapper');
    var words = document.querySelectorAll('#scene-headline [data-word]');
    var bgImgs = document.querySelectorAll('#scene-bg [data-scene-bg]');
    if (!wrapper) return;

    if (reduced) {
      words.forEach(function (w) { w.style.opacity = 1; w.style.filter = 'blur(0px)'; w.style.transform = 'none'; });
      if (bgImgs[0]) bgImgs[0].style.opacity = 1;
      return;
    }

    if (!('IntersectionObserver' in window)) {
      words.forEach(function (w) { w.style.opacity = 1; w.style.filter = 'blur(0px)'; w.style.transform = 'none'; });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        words.forEach(function (wd, i) {
          wd.style.transition = 'opacity 0.6s ease ' + (i * 0.06) + 's, filter 0.6s ease ' + (i * 0.06) + 's, transform 0.6s ease ' + (i * 0.06) + 's';
          wd.style.opacity = 1;
          wd.style.filter = 'blur(0px)';
          wd.style.transform = 'translateY(0)';
        });
        io.unobserve(entry.target);
      });
    }, { threshold: 0.3 });
    io.observe(wrapper);
  }

  document.addEventListener('DOMContentLoaded', function () {
    var initSection = document.getElementById('hero-section');
    if (initSection && !reduced) {
      initSection.style.width = '24%';
      initSection.style.borderRadius = '50% 50% 0 0';
      initSection.querySelectorAll('[data-hero-el]').forEach(function (el) { el.style.opacity = 0; });
    }
    runPreloader(function () {
      Promise.resolve().then(setupHero).catch(function (e) {
        console.error('Trexantiri hero error:', e);
        finalizeHero();
      });
    });
    setupSignatureScene();
    // Hard safety net: whatever happened, never leave the hero stuck
    // mid-animation. It has to outlast the full chain (preloader, the
    // expand, then one tween per hero element) or it cuts the last
    // element in — which is what happened when the review link was added.
    setTimeout(finalizeHero, 8000);
  });
})();
