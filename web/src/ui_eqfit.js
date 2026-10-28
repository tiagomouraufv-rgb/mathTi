/* MathTi 0.9.2 — equações que se ajustam à largura da região e ampliação em tela cheia (botão direito / toque longo) */
(function () {
  'use strict';
  const X = (FC.uiExt = FC.uiExt || {});
  const U = () => FC._ui;
  const MIN = 0.45; // menor escala automática (45 % do tamanho normal)

  function fitOne(el) {
    el.style.fontSize = '';
    el.classList.remove('shrunk', 'eq-wrap');
    el.classList.add('eq-nw'); // primeiro tenta caber numa linha só, diminuindo a fonte
    const W = el.clientWidth;
    if (!W) return;
    const base = parseFloat(getComputedStyle(el).fontSize) || 17;
    let need = el.scrollWidth;
    if (need <= W + 1) return;
    let k = (W / need) * 0.98;
    if (k < MIN) {
      // longa demais: quebra em linhas com fonte um pouco menor (botão direito mostra inteira)
      el.classList.remove('eq-nw'); el.classList.add('eq-wrap', 'shrunk');
      el.style.fontSize = (base * 0.85).toFixed(2) + 'px';
    } else {
      el.style.fontSize = (base * k).toFixed(2) + 'px';
      need = el.scrollWidth;
      if (need > W + 1) { k = Math.max(MIN, k * (W / need) * 0.98); el.style.fontSize = (base * k).toFixed(2) + 'px'; }
      el.classList.add('shrunk');
    }
    el.title = 'Equação reduzida para caber. Botão direito (ou toque longo) para ver em tela cheia.';
  }
  function fitEquations(box) {
    if (!box) return;
    box.querySelectorAll('.ml:not(.ml-row):not(.ml-err):not(.ml-com):not(.ml-empty), .ml-row > .ml-cell, .katex-display').forEach(fitOne);
    if (!box._fitObs && window.ResizeObserver) {
      let w = box.clientWidth, t = null;
      box._fitObs = new ResizeObserver(() => { if (Math.abs(box.clientWidth - w) < 2) return; w = box.clientWidth; clearTimeout(t); t = setTimeout(() => fitEquations(box), 60); });
      box._fitObs.observe(box);
    }
  }
  X.fitEquations = fitEquations;

  /* ---------- tela cheia ---------- */
  function zoomEquation(src) {
    const { h, icon } = U();
    const html = src.cloneNode(true);
    html.querySelectorAll('.cp, .errmsg').forEach((e) => e.remove());
    html.style.fontSize = ''; html.classList.remove('shrunk', 'eq-wrap'); html.classList.add('eq-nw'); html.removeAttribute('title');
    const stage = h('div', { class: 'eqz-stage' });
    const inner = h('div', { class: 'eqz-inner eq-nw' }); inner.append(...html.childNodes);
    stage.append(inner);
    const wrap = h('div', { class: 'overlay eqz', role: 'dialog', 'aria-label': 'Equação em tela cheia', onclick: (e) => { if (e.target === wrap || e.target === stage) close(); } });
    const close = () => { wrap.remove(); document.removeEventListener('keydown', onKey, true); };
    const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); } };
    let scale = 1;
    const zoom = (f) => { scale = Math.max(0.3, Math.min(6, scale * f)); inner.style.fontSize = (base * scale).toFixed(1) + 'px'; };
    const bar = h('div', { class: 'eqz-bar' },
      h('button', { class: 'btn small', onclick: () => zoom(1 / 1.2) }, '−'),
      h('button', { class: 'btn small', onclick: () => { scale = 1; fit(); } }, 'Ajustar à tela'),
      h('button', { class: 'btn small', onclick: () => zoom(1.2) }, '+'),
      h('button', { class: 'ib close', 'aria-label': 'Fechar', onclick: close }, icon('<path d="M6 6l12 12M18 6L6 18"/>', 20)));
    wrap.append(h('div', { class: 'eqz-box' }, bar, stage));
    document.body.append(wrap);
    document.addEventListener('keydown', onKey, true);
    let base = 40;
    const fit = () => {
      base = 40; inner.style.fontSize = base + 'px';
      const W = stage.clientWidth - 32, H = stage.clientHeight - 32;
      const k = Math.min(W / Math.max(1, inner.scrollWidth), H / Math.max(1, inner.scrollHeight), 2.2);
      base = Math.max(12, base * k); scale = 1; inner.style.fontSize = base.toFixed(1) + 'px';
    };
    requestAnimationFrame(fit);
  }
  X.zoomEquation = zoomEquation;

  document.addEventListener('contextmenu', (e) => {
    const t = e.target;
    if (!t || !t.closest) return;
    if (t.closest('.eqz')) { e.preventDefault(); return; }
    const cell = t.closest('.mout .ml-cell') || t.closest('.mout .ml') || t.closest('.tout .katex-display') || t.closest('.fnl-eq');
    if (!cell || !cell.querySelector('.katex')) return;
    if (U().state.editing && cell.closest('.region.editing')) return;
    e.preventDefault(); e.stopPropagation();
    zoomEquation(cell);
  });
})();
