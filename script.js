/* =========================================================================
   Instituto Pão Irmão — comportamento e animações
   Sem dependências externas. Tudo respeita prefers-reduced-motion.
   ========================================================================= */

(function () {
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var $  = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };

  /* Um único laço de scroll alimenta todos os efeitos de rolagem. */
  var scrollTasks = [];
  var frameQueued = false;

  function onScroll() {
    if (frameQueued) return;
    frameQueued = true;
    requestAnimationFrame(function () {
      var y = window.pageYOffset;
      for (var i = 0; i < scrollTasks.length; i++) scrollTasks[i](y);
      frameQueued = false;
    });
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });

  /* ---------------------------------------------------------------
     1. Cabeçalho: fundo ao rolar, botão de topo
     --------------------------------------------------------------- */

  var header = $('#site-header');
  var headerInner = $('.site-header__inner');
  var toTop = $('#to-top');

  /* Largura da ilha: o cabeçalho recolhido tem a largura do próprio conteúdo.
     Como não dá para animar até `fit-content`, a largura é medida aqui e entra
     no CSS como --bar-w, que é um comprimento e portanto animável. */
  // Altura do cabeçalho já recolhido, usada para parar na altura certa ao
  // saltar para uma âncora. Lida durante a medição, com as transições paradas.
  var stuckHeight = 0;

  function measureBar() {
    if (!header || !headerInner) return;

    var wasStuck = header.classList.contains('is-stuck');
    header.classList.add('is-measuring');
    if (!wasStuck) header.classList.add('is-stuck');

    stuckHeight = header.offsetHeight;

    var width = 0;
    if (window.innerWidth >= 921) {
      headerInner.style.maxWidth = 'none';
      headerInner.style.width = 'max-content';
      width = Math.ceil(headerInner.getBoundingClientRect().width);
      headerInner.style.width = '';
      headerInner.style.maxWidth = '';
    }

    if (!wasStuck) header.classList.remove('is-stuck');
    void header.offsetWidth;
    header.classList.remove('is-measuring');

    if (width > 0) header.style.setProperty('--bar-w', width + 'px');
  }

  measureBar();
  window.addEventListener('resize', measureBar, { passive: true });
  window.addEventListener('load', measureBar);
  // As fontes trocam depois da primeira pintura e mudam a largura dos textos.
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measureBar);

  scrollTasks.push(function (y) {
    if (header) header.classList.toggle('is-stuck', y > 24);
    if (toTop) toTop.classList.toggle('is-on', y > 900);
  });

  if (toTop) {
    toTop.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
    });
  }

  /* ---------------------------------------------------------------
     2. Menu em telas pequenas
     --------------------------------------------------------------- */

  var navToggle = $('#nav-toggle');
  var nav = $('#nav');
  var lockedY = 0;

  function isNavOpen() {
    return Boolean(nav && nav.classList.contains('is-open'));
  }

  function openNav() {
    if (!nav || isNavOpen()) return;
    // Guarda a rolagem antes de fixar o body, senão a página volta ao topo.
    lockedY = window.pageYOffset;
    document.body.style.top = -lockedY + 'px';
    document.body.classList.add('is-locked');
    nav.classList.add('is-open');
    navToggle.setAttribute('aria-expanded', 'true');
    navToggle.setAttribute('aria-label', 'Fechar menu');
  }

  function closeNav() {
    if (!isNavOpen()) return;
    nav.classList.remove('is-open');
    navToggle.setAttribute('aria-expanded', 'false');
    navToggle.setAttribute('aria-label', 'Abrir menu');
    document.body.classList.remove('is-locked');
    document.body.style.top = '';

    // Devolver a posição tem de ser instantâneo. Sem isto o CSS scroll-behavior
    // transforma a volta numa animação visível.
    var root = document.documentElement;
    var previous = root.style.scrollBehavior;
    root.style.scrollBehavior = 'auto';
    window.scrollTo(0, lockedY);
    root.style.scrollBehavior = previous;
  }

  if (navToggle && nav) {
    navToggle.addEventListener('click', function (e) {
      e.preventDefault();
      if (isNavOpen()) closeNav(); else openNav();
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeNav();
    });

    // Se a tela crescer além do ponto de quebra, o painel não pode ficar preso aberto.
    var wide = window.matchMedia('(min-width: 921px)');
    var onWide = function (e) { if (e.matches) closeNav(); };
    if (wide.addEventListener) wide.addEventListener('change', onWide);
    else if (wide.addListener) wide.addListener(onWide);
  }

  /* ---------------------------------------------------------------
     3. Título dividido em palavras, com entrada escalonada
     --------------------------------------------------------------- */

  $$('[data-split]').forEach(function (el) {
    var words = el.textContent.trim().split(/\s+/);
    el.textContent = '';
    words.forEach(function (w, i) {
      var line = document.createElement('span');
      line.className = 'line';
      line.style.display = 'inline-block';
      line.style.verticalAlign = 'bottom';

      var word = document.createElement('span');
      word.className = 'word';
      word.textContent = w;
      word.style.setProperty('--wd', (i * 0.055).toFixed(3) + 's');

      line.appendChild(word);
      el.appendChild(line);
      if (i < words.length - 1) el.appendChild(document.createTextNode(' '));
    });
  });

  /* ---------------------------------------------------------------
     4. Entrada ao entrar na tela
     --------------------------------------------------------------- */

  var revealables = $$('.reveal, .reveal-img, [data-split], .draw');

  revealables.forEach(function (el) {
    var d = el.getAttribute('data-delay');
    if (d) el.style.setProperty('--d', (Number(d) * 0.09).toFixed(3) + 's');
    if (el.classList.contains('draw') && el.getTotalLength) {
      var len = Math.ceil(el.getTotalLength());
      el.style.setProperty('--len', len);
    }
  });

  if (reduced || !('IntersectionObserver' in window)) {
    revealables.forEach(function (el) { el.classList.add('is-in'); });
  } else {
    var pending = revealables.slice();

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        show(entry.target);
      });
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0 });

    function show(el) {
      el.classList.add('is-in');
      io.unobserve(el);
      var at = pending.indexOf(el);
      if (at > -1) pending.splice(at, 1);
    }

    pending.forEach(function (el) { io.observe(el); });

    /* Rede de segurança. Um salto direto para uma âncora pode atravessar um
       elemento sem que o observador registre a passagem, e ele ficaria invisível
       na tela. A varredura revela o que já está visível. A lista só encolhe,
       então o custo cai a zero depois das primeiras telas. */
    function sweep() {
      if (!pending.length) return;
      var limit = window.innerHeight * 0.96;
      pending.slice().forEach(function (el) {
        var box = el.getBoundingClientRect();
        if (box.top < limit && box.bottom > 0) show(el);
      });
    }

    var lastSweep = 0;
    scrollTasks.push(function () {
      var now = Date.now();
      if (now - lastSweep < 180) return;
      lastSweep = now;
      sweep();
    });

    requestAnimationFrame(sweep);
    window.addEventListener('load', sweep);
    window.addEventListener('hashchange', function () { setTimeout(sweep, 60); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(sweep);

    // Exposto para o clique em âncora disparar a varredura ao terminar a rolagem.
    window.__paoIrmaoSweep = sweep;
  }

  /* ---------------------------------------------------------------
     5. Contagem dos números
     --------------------------------------------------------------- */

  $$('[data-count]').forEach(function (el) {
    var target = Number(el.getAttribute('data-count'));
    if (reduced || !('IntersectionObserver' in window) || !target) {
      el.textContent = String(target);
      return;
    }
    el.textContent = '0';

    var seen = new IntersectionObserver(function (entries) {
      if (!entries[0].isIntersecting) return;
      seen.disconnect();

      var start = performance.now();
      var dur = 1100;

      (function tick(now) {
        var t = Math.min((now - start) / dur, 1);
        var eased = 1 - Math.pow(1 - t, 3);
        el.textContent = String(Math.round(target * eased));
        if (t < 1) requestAnimationFrame(tick);
      })(start);
    }, { threshold: 0.6 });

    seen.observe(el);
  });

  /* ---------------------------------------------------------------
     6. Paralaxe suave
     --------------------------------------------------------------- */

  var parallaxItems = $$('[data-parallax]');

  if (!reduced && parallaxItems.length && window.innerWidth >= 920) {
    var layers = parallaxItems.map(function (el) {
      return { el: el, speed: parseFloat(el.getAttribute('data-parallax')) || 0 };
    });

    scrollTasks.push(function () {
      var vh = window.innerHeight;
      layers.forEach(function (layer) {
        var box = layer.el.getBoundingClientRect();
        if (box.bottom < -200 || box.top > vh + 200) return;
        var center = box.top + box.height / 2 - vh / 2;
        layer.el.style.transform = 'translate3d(0,' + (center * layer.speed).toFixed(2) + 'px,0)';
      });
    });
  }

  /* ---------------------------------------------------------------
     7. Linha do tempo que se preenche conforme a rolagem
     --------------------------------------------------------------- */

  var timeline = $('.timeline');

  if (timeline && !reduced) {
    timeline.style.setProperty('--tl-progress', '0');
    scrollTasks.push(function () {
      var box = timeline.getBoundingClientRect();
      var vh = window.innerHeight;
      var p = (vh * 0.75 - box.top) / box.height;
      timeline.style.setProperty('--tl-progress', String(Math.max(0, Math.min(1, p))));
    });
  }

  /* ---------------------------------------------------------------
     8. Carrossel contínuo da galeria
     --------------------------------------------------------------- */

  $$('[data-marquee]').forEach(function (wrap) {
    var track = $('.marquee__track', wrap);
    if (!track) return;

    // Duplica o conteúdo para que a volta seja invisível.
    // A cópia fica oculta para leitores de tela, senão cada legenda é lida duas vezes.
    var originals = Array.prototype.slice.call(track.children);
    originals.forEach(function (node) {
      var copy = node.cloneNode(true);
      copy.setAttribute('aria-hidden', 'true');
      track.appendChild(copy);
    });

    var setDuration = function () {
      var width = track.scrollWidth / 2;
      track.style.setProperty('--marquee-dur', Math.max(28, width / 42).toFixed(0) + 's');
    };

    setDuration();
    window.addEventListener('resize', setDuration, { passive: true });
    window.addEventListener('load', setDuration);
  });

  /* ---------------------------------------------------------------
     9. Botões com leve atração do cursor
     --------------------------------------------------------------- */

  if (!reduced && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    $$('.magnetic').forEach(function (btn) {
      btn.addEventListener('pointermove', function (e) {
        var box = btn.getBoundingClientRect();
        var x = (e.clientX - box.left - box.width / 2) * 0.18;
        var y = (e.clientY - box.top - box.height / 2) * 0.28;
        btn.style.transform = 'translate(' + x.toFixed(1) + 'px,' + (y - 2).toFixed(1) + 'px)';
      });
      btn.addEventListener('pointerleave', function () { btn.style.transform = ''; });
    });
  }

  /* ---------------------------------------------------------------
     10. Link ativo no menu
     --------------------------------------------------------------- */

  var links = $$('.nav__link');
  var targets = links
    .map(function (a) { return document.querySelector(a.getAttribute('href')); })
    .filter(Boolean);

  if (targets.length) {
    scrollTasks.push(function () {
      var mark = window.pageYOffset + window.innerHeight * 0.32;
      var current = null;

      targets.forEach(function (sec) {
        if (sec.offsetTop <= mark) current = sec.id;
      });

      links.forEach(function (a) {
        a.classList.toggle('is-active', a.getAttribute('href') === '#' + current);
      });
    });
  }

  /* ---------------------------------------------------------------
     11. Aviso curto na base da tela
     --------------------------------------------------------------- */

  var toastEl = $('#toast');
  var toastTimer;

  function toast(message) {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('is-on'); }, 2600);
  }

  /* ---------------------------------------------------------------
     12. Copiar a chave PIX
     --------------------------------------------------------------- */

  $$('[data-copy]').forEach(function (row) {
    var btn = $('.copyrow__btn', row);
    if (!btn) return;
    var label = $('span', btn);
    var original = label ? label.textContent : '';

    btn.addEventListener('click', function () {
      var value = row.getAttribute('data-copy');

      var done = function () {
        row.classList.add('is-copied');
        if (label) label.textContent = 'Copiado';
        toast('Chave PIX copiada.');
        setTimeout(function () {
          row.classList.remove('is-copied');
          if (label) label.textContent = original;
        }, 2200);
      };

      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(value).then(done, fallback);
      } else {
        fallback();
      }

      function fallback() {
        var tmp = document.createElement('textarea');
        tmp.value = value;
        tmp.setAttribute('readonly', '');
        tmp.style.position = 'fixed';
        tmp.style.opacity = '0';
        document.body.appendChild(tmp);
        tmp.select();
        try { document.execCommand('copy'); done(); }
        catch (err) { toast('Copie a chave manualmente: ' + value); }
        document.body.removeChild(tmp);
      }
    });
  });

  /* ---------------------------------------------------------------
     13. Formulário de contato
     Monta a mensagem e abre o WhatsApp do instituto.
     --------------------------------------------------------------- */

  var form = $('#contact-form');

  if (form) {
    var WHATSAPP = '5561981752767';

    var rules = {
      nome: function (v) {
        if (!v.trim()) return 'Escreva seu nome.';
        if (v.trim().length < 2) return 'O nome está curto demais.';
        return '';
      },
      email: function (v) {
        if (!v.trim()) return 'Escreva seu e-mail.';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim())) return 'Esse e-mail parece incompleto.';
        return '';
      },
      telefone: function (v) {
        if (!v.trim()) return '';
        if (v.replace(/\D/g, '').length < 10) return 'Informe o DDD e o número.';
        return '';
      },
      mensagem: function (v) {
        if (!v.trim()) return 'Escreva sua mensagem.';
        if (v.trim().length < 10) return 'Conte um pouco mais, por favor.';
        return '';
      }
    };

    function check(name) {
      var input = form.elements[name];
      var wrap = input.closest('.field');
      var slot = $('#' + name + '-error');
      var msg = rules[name](input.value);

      wrap.classList.toggle('is-invalid', Boolean(msg));
      if (slot) slot.textContent = msg;
      input.setAttribute('aria-invalid', msg ? 'true' : 'false');
      return !msg;
    }

    Object.keys(rules).forEach(function (name) {
      var input = form.elements[name];
      if (!input) return;

      input.addEventListener('blur', function () { check(name); });
      input.addEventListener('input', function () {
        if (input.closest('.field').classList.contains('is-invalid')) check(name);
      });
    });

    // Máscara leve para o telefone brasileiro.
    var tel = form.elements.telefone;
    if (tel) {
      tel.addEventListener('input', function () {
        var d = tel.value.replace(/\D/g, '').slice(0, 11);
        if (d.length > 10)     tel.value = d.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3');
        else if (d.length > 6) tel.value = d.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
        else if (d.length > 2) tel.value = d.replace(/(\d{2})(\d{0,5})/, '($1) $2');
        else if (d.length)     tel.value = '(' + d;
      });
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();

      // map antes de every: todos os campos precisam ser avaliados, não apenas o primeiro inválido.
      var ok = Object.keys(rules).map(check).every(Boolean);

      if (!ok) {
        var first = $('.field.is-invalid input, .field.is-invalid textarea', form);
        if (first) { first.focus(); first.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' }); }
        return;
      }

      var d = form.elements;
      var text =
        'Olá, Instituto Pão Irmão!\n\n' +
        'Assunto: ' + d.assunto.value + '\n' +
        'Nome: ' + d.nome.value.trim() + '\n' +
        'E-mail: ' + d.email.value.trim() +
        (d.telefone.value.trim() ? '\nTelefone: ' + d.telefone.value.trim() : '') +
        '\n\n' + d.mensagem.value.trim();

      window.open('https://wa.me/' + WHATSAPP + '?text=' + encodeURIComponent(text), '_blank', 'noopener');

      var okBox = $('#form-ok');
      if (okBox) {
        okBox.classList.add('is-on');
        setTimeout(function () { okBox.classList.remove('is-on'); }, 7000);
      }
      form.reset();
    });
  }

  /* ---------------------------------------------------------------
     14. Rolagem suave com compensação do cabeçalho
     --------------------------------------------------------------- */

  document.addEventListener('click', function (e) {
    var link = e.target.closest('a[href^="#"]');
    if (!link) return;

    var id = link.getAttribute('href');
    if (id === '#' || id.length < 2) return;

    var target = document.getElementById(id.slice(1));
    if (!target) return;

    e.preventDefault();
    closeNav();

    // O cabeçalho encolhe assim que a rolagem começa, então a conta usa a
    // altura já recolhida. Usar a altura atual pararia alguns pixels fora.
    var offset = (stuckHeight || (header ? header.offsetHeight : 0)) - 6;
    window.scrollTo({
      top: target.getBoundingClientRect().top + window.pageYOffset - offset,
      behavior: reduced ? 'auto' : 'smooth'
    });

    if (history.replaceState) history.replaceState(null, '', id);

    // A rolagem suave pode terminar sobre elementos ainda não revelados.
    if (window.__paoIrmaoSweep) {
      setTimeout(window.__paoIrmaoSweep, 80);
      setTimeout(window.__paoIrmaoSweep, 700);
    }
  });

  /* ---------------------------------------------------------------
     15. Ano no rodapé
     --------------------------------------------------------------- */

  var year = $('#ano');
  if (year) year.textContent = String(new Date().getFullYear());

  /* Primeira passagem para acertar o estado inicial. */
  onScroll();

})();
