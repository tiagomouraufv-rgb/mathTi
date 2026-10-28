/* Folha de Cálculo — controle deslizante ao vivo e animações (GIF, MP4, sequência de PNG) */
'use strict';
(function () {
  const FC = window.FC;
  const U = () => FC._ui;
  const PLOT_TYPES = new Set(['xy', 'heat', 'surf']);

  /* ---------- utilidades ---------- */
  function btn(label, fn, ic) { const { h, icon, IC } = U(); return h('button', { class: 'btn small', onclick: fn }, ic ? icon(IC[ic] || ic, 16) : null, label); }
  function u8ToB64(u8) { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); }
  function saveBytes(name, mime, u8) {
    if (window.FcalcAndroid && window.FcalcAndroid.saveFile) { window.FcalcAndroid.saveFile(name, mime, u8ToB64(u8)); return; }
    const url = URL.createObjectURL(new Blob([u8], { type: mime }));
    const a = document.createElement('a'); a.href = url; a.download = name; document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 8000);
    U().toast('Arquivo gerado: ' + name);
  }
  FC.saveBytes = saveBytes;
  const plotLabel = (r) => {
    const L = U().TYPE_LABEL[r.type];
    if (r.type === 'xy') return L + ' · ' + r.traces.map((t) => t.name || t.expr).filter(Boolean).join(', ');
    return L + ' · ' + (r.expr || '');
  };
  const newKey = () => 'k' + Math.random().toString(36).slice(2, 9);
  function fmtVal(v, digits) {
    if (digits === '' || digits == null || digits === 'auto') return FC.numStr(Number(v.toPrecision(6)));
    return Number(v).toFixed(Math.max(0, Math.min(8, Number(digits))));
  }
  function frameText(a, v) {
    return String(a.label || '{p} = {v}').replace(/\{p\}/g, a.param).replace(/\{v\}/g, fmtVal(v, a.digits));
  }

  /* ================= Controle deslizante ================= */
  const slider = {
    defaults: () => ({ type: 'slider', w: 'third', name: 'p', min: 0, max: 1, step: 0.01, value: 0.5 }),
    build(r, sec) {
      const { h } = U();
      const val = h('div', { class: 'sl-val' });
      const rng = h('input', { type: 'range', class: 'sl-range', min: r.min, max: r.max, step: r.step || 'any', value: r.value, 'aria-label': 'Valor de ' + r.name });
      const num = h('input', { type: 'number', class: 'sl-num', step: r.step || 'any', value: r.value, inputmode: 'decimal', 'aria-label': 'Valor exato' });
      const set = (v, src) => {
        v = Number(v); if (!isFinite(v)) return;
        r.value = v;
        if (src !== rng) rng.value = v;
        if (src !== num) num.value = v;
        drawVal(r, val);
        U().live();
      };
      rng.addEventListener('input', () => set(rng.value, rng));
      num.addEventListener('change', () => set(num.value, num));
      const lim = h('div', { class: 'sl-lim' }, h('span', { class: 'sl-min' }), h('span', { class: 'sl-max' }));
      sec.append(val, h('div', { class: 'sl-row' }, rng, num), lim,
        h('div', { class: 'actions' }, btn('Editar', () => U().toggleForm(r, sec), 'edit')), h('div', { class: 'perr', hidden: true }), h('div', { class: 'form', hidden: true }));
      sec._sl = { rng, num, val, lim };
    },
    render(r, el) {
      const sl = el._sl || (el.closest && el.closest('section') && el.closest('section')._sl);
      const e = el.querySelector('.perr'); e.hidden = !r._err; e.textContent = r._err || '';
      if (!sl) return;
      sl.rng.min = r.min; sl.rng.max = r.max; sl.rng.step = r.step || 'any';
      if (document.activeElement !== sl.rng) sl.rng.value = r.value;
      if (document.activeElement !== sl.num) sl.num.value = r.value;
      sl.lim.querySelector('.sl-min').textContent = FC.numStr(Number(r.min));
      sl.lim.querySelector('.sl-max').textContent = FC.numStr(Number(r.max));
      drawVal(r, sl.val);
    },
    form(r, f) {
      const { h, field, inp } = U();
      const rebuild = () => { const el = document.getElementById(r.id); if (el && el._sl) { el._sl.rng.min = r.min; el._sl.rng.max = r.max; el._sl.rng.step = r.step || 'any'; } U().renderOutput(r); };
      const numIn = (k) => { const e = h('input', { type: 'number', value: r[k], step: 'any', inputmode: 'decimal' }); e.addEventListener('input', () => { r[k] = Number(e.value); rebuild(); U().markDirty(); }); return e; };
      f.append(h('div', { class: 'grid4' }, field('Variável', inp(r, 'name', { ph: 'λ_OT' })), field('Mínimo', numIn('min')), field('Máximo', numIn('max')), field('Passo', numIn('step'))),
        h('p', { class: 'hint' }, 'A variável fica definida para as regiões abaixo. Ao arrastar, a folha recalcula e os gráficos se atualizam.'));
    }
  };
  function drawVal(r, el) { el.innerHTML = U().kt(FC.nameTexOf(r.name || 'p') + ' = \\color{#1d6b3a}{' + FC.numTex(Number(r.value)) + '}'); }

  /* ================= Animação ================= */
  let aw = null; const ajob = { n: 0, cb: null };
  function animWorker() {
    if (aw) return aw;
    const src = document.getElementById('fc-worker-src');
    if (!src || typeof Worker === 'undefined') return null;
    try {
      aw = new Worker(URL.createObjectURL(new Blob([src.textContent], { type: 'text/javascript' })));
      aw.onmessage = (ev) => { const m = ev.data || {}; if (m.job === ajob.n && ajob.cb) ajob.cb(m); };
      return aw;
    } catch (e) { return null; }
  }
  function targetOf(a) {
    if (FC.animMode(a) === 'proprio') return FC.animOwnRegion(a);
    return U().state.regions.find((x) => x.key && x.key === a.targetKey && PLOT_TYPES.has(x.type));
  }
  const ownSig = (a) => (FC.animMode(a) === 'proprio' ? JSON.stringify(FC.animOwnRegion(a)) : '');
  function valuesOf(a) {
    const lo = Number(a.from), hi = Number(a.to), n = Math.max(2, Math.round(Number(a.frames) || 30));
    if (!isFinite(lo) || !isFinite(hi)) throw new Error('Os valores inicial e final do parâmetro devem ser números.');
    return [...Array(n).keys()].map((k) => lo + ((hi - lo) * k) / (n - 1));
  }
  function plain() { return U().state.regions.map((r) => { const o = {}; for (const k in r) if (!k.startsWith('_')) o[k] = r[k]; return o; }); }
  function computeFrames(a, el) {
    const own = FC.animMode(a) === 'proprio';
    const T = targetOf(a);
    if (!T) return U().toast('Escolha o gráfico a animar em “Editar”.');
    if (own && T.type === 'xy' && !T.traces.length) return U().toast('Em “Editar”, escreva a curva a animar (ex.: y(x, 2, b)).');
    const P = String(a.param || '').trim();
    if (!/^[\p{L}_][\p{L}\p{N}_]*$/u.test(P)) return U().toast('Dê o nome do parâmetro (ex.: λ_OT).');
    let vals; try { vals = valuesOf(a); } catch (e) { return U().toast(e.message); }
    const st = el.querySelector('.an-status');
    const done = (frames) => { a._frames = frames; a._framesVer = U().state.version; a._framesSig = sigOf(a); st.textContent = ''; U().renderOutput(a); };
    const fail = (msg) => { st.textContent = ''; const e = el.querySelector('.perr'); e.hidden = false; e.textContent = msg; };
    el.querySelector('.perr').hidden = true;
    const w = animWorker();
    const opts = { materials: U().state.materials || [], tabCache: U().state.tabCache || {}, packs: FC.uiExt.activePacks() };
    if (!w) {
      try { done(own ? FC.computeOwnFrames(plain(), plainOne(a), vals, opts) : FC.computeFrames(plain(), T.id, P, vals, opts)); } catch (e) { fail(FC.ptError(e)); }
      return;
    }
    ajob.n++;
    st.textContent = 'Calculando quadros… 0 de ' + vals.length;
    ajob.cb = (m) => {
      if (m.type === 'aprogress') st.textContent = 'Calculando quadros… ' + (m.k + 1) + ' de ' + m.n;
      else if (m.type === 'adone') done(m.frames);
      else if (m.type === 'afail') fail(m.err);
    };
    w.postMessage({ cmd: 'anim', job: ajob.n, regions: plain(), target: T.id, param: P, values: vals, opts, own: own ? plainOne(a) : null });
  }
  const plainOne = (r) => { const o = {}; for (const k in r) if (!k.startsWith('_')) o[k] = r[k]; return o; };
  const sigOf = (a) => JSON.stringify([FC.animMode(a), a.targetKey, a.param, a.from, a.to, a.frames, ownSig(a)]);
  /* Região do gráfico com escala fixa e rótulo do quadro */
  function frameRegion(a, T, frames, k) {
    const rr = Object.assign({}, T, { frameLabel: a.labelOn === false ? '' : frameText(a, frames[k].v) });
    if (a.fixed !== false) {
      if (T.type === 'xy') {
        let lo = Infinity, hi = -Infinity;
        for (const f of frames) for (const t of f.data.traces) for (const y of t.ys) if (isFinite(y)) { if (y < lo) lo = y; if (y > hi) hi = y; }
        const pad = (hi - lo) * 0.04 || 1;
        if (!(String(T.ymin ?? '').trim() && String(T.ymax ?? '').trim()) && isFinite(lo)) { rr.ymin = lo - pad; rr.ymax = hi + pad; }
      } else {
        let lo = Infinity, hi = -Infinity;
        for (const f of frames) for (const row of f.data.z) for (const z of row) if (isFinite(z)) { if (z < lo) lo = z; if (z > hi) hi = z; }
        if (!(String(T.zmin ?? '').trim() && String(T.zmax ?? '').trim()) && isFinite(lo)) { rr.zmin = lo; rr.zmax = hi; }
      }
    }
    return rr;
  }
  function order(a, n) {
    const seq = [...Array(n).keys()];
    if (a.pingpong) for (let k = n - 2; k > 0; k--) seq.push(k);
    return seq;
  }
  const players = new Map();
  function stopPlayer(id) { const p = players.get(id); if (p) { clearInterval(p.timer); p.timer = null; } }

  const anim = {
    defaults: () => ({ type: 'anim', w: 'half', targetKey: '', ptype: 'xy', curves: '', gexpr: '', xvar: 'x', xmin: '0', xmax: '10', npts: 300, yvar: 'y', ymin: '0', ymax: '10', nx: 81, ny: 81, xlabel: '', ylabel: '', zlabel: '', ymin2: '', ymax2: '', colorscale: 'Viridis', preset: U().state.preset || 'acs1', param: '', from: '0', to: '1', frames: 30, fps: 10, pingpong: false, hold: 0.5, label: '{p} = {v}', labelOn: true, digits: 'auto', fixed: true, scale: 2 }),
    build(r, sec) {
      const { h, icon } = U();
      const play = h('button', { class: 'btn small an-play' }, '▶ Reproduzir');
      const scrub = h('input', { type: 'range', class: 'an-scrub', min: 0, max: 0, step: 1, value: 0, 'aria-label': 'Quadro' });
      const info = h('span', { class: 'an-frame' });
      sec.append(h('div', { class: 'dinfo an-info' }), h('div', { class: 'perr', hidden: true }), h('div', { class: 'an-status' }), h('div', { class: 'an-stale', hidden: true }, 'A folha mudou depois do cálculo dos quadros. Toque em “Calcular quadros” para atualizar.'),
        h('div', { class: 'plot an-plot' }), h('div', { class: 'an-ctrl' }, play, scrub, info),
        h('div', { class: 'actions' },
          btn('Calcular quadros', () => computeFrames(r, sec), 'check'), btn('Editar', () => U().toggleForm(r, sec), 'edit'),
          btn('GIF', () => exportAnim(r, sec, 'gif'), 'dl'), btn('MP4', () => exportAnim(r, sec, 'mp4')), btn('PNG (zip)', () => exportAnim(r, sec, 'zip'))),
        h('div', { class: 'form', hidden: true }));
      const show = (k) => {
        const T = targetOf(r), F = r._frames; if (!T || !F || !F.length) return;
        k = Math.max(0, Math.min(F.length - 1, k)); scrub.value = k;
        info.textContent = 'quadro ' + (k + 1) + ' de ' + F.length + ' · ' + r.param + ' = ' + fmtVal(F[k].v, r.digits);
        FC.drawPlot(sec.querySelector('.an-plot'), frameRegion(r, T, F, k), F[k].data).catch(() => {});
      };
      scrub.addEventListener('input', () => { stopPlayer(r.id); play.textContent = '▶ Reproduzir'; show(+scrub.value); });
      play.addEventListener('click', () => {
        const p = players.get(r.id) || {}; players.set(r.id, p);
        if (p.timer) { stopPlayer(r.id); play.textContent = '▶ Reproduzir'; return; }
        if (!r._frames) return U().toast('Calcule os quadros primeiro.');
        const seq = order(r, r._frames.length); let i = seq.indexOf(+scrub.value); if (i < 0) i = 0;
        play.textContent = '❚❚ Pausar';
        p.timer = setInterval(() => { i = (i + 1) % seq.length; show(seq[i]); }, 1000 / Math.max(1, Number(r.fps) || 10));
      });
      sec._an = { show, scrub, play };
    },
    render(r, el) {
      const T = targetOf(r);
      const ownTxt = FC.animMode(r) === 'proprio' ? (T.type === 'xy' ? T.traces.map((t) => t.expr).join(', ') + ' com ' + T.xvar + ' de ' + T.xmin + ' a ' + T.xmax : T.expr + ' em ' + T.xvar + ' × ' + T.yvar) : '';
      el.querySelector('.an-info').textContent = T && (ownTxt || FC.animMode(r) === 'folha') && !(FC.animMode(r) === 'proprio' && T.type === 'xy' && !T.traces.length) ? 'Anima: ' + (ownTxt || plotLabel(T)) + ' · ' + (r.param || '?') + ' de ' + r.from + ' a ' + r.to + ' · ' + r.frames + ' quadros · ' + r.fps + ' quadros/s' + (r.pingpong ? ' · ida e volta' : '') : 'Toque em “Editar” para escrever as equações (ou escolher um gráfico da folha) e o parâmetro a variar.';
      const has = !!(r._frames && r._frames.length && r._framesSig === sigOf(r));
      if (r._frames && !has) r._frames = null;
      el.querySelector('.an-stale').hidden = !(has && r._framesVer !== U().state.version);
      const ctrl = el.querySelector('.an-ctrl'), div = el.querySelector('.an-plot');
      ctrl.hidden = !has; div.hidden = !has;
      if (has && el._an) { el._an.scrub.max = r._frames.length - 1; el._an.show(+el._an.scrub.value || 0); }
      else if (!has && T && !el.querySelector('.an-status').textContent) el.querySelector('.an-status').textContent = 'Toque em “Calcular quadros” para gerar a animação.';
    },
    form(r, f) {
      const { h, field, inp, sel } = U();
      const redraw = () => { f.innerHTML = ''; anim.form(r, f); };
      const mode = FC.animMode(r);
      const msel = h('select', null, h('option', { value: 'proprio', selected: mode === 'proprio' ? 'selected' : null }, 'Escrever as equações aqui'), h('option', { value: 'folha', selected: mode === 'folha' ? 'selected' : null }, 'Animar um gráfico que já está na folha'));
      msel.addEventListener('change', () => { r.mode = msel.value; U().markDirty(false); U().renderOutput(r); redraw(); });
      f.append(h('div', { class: 'grid4' }, field('O que animar', msel, 'span4')));
      const sliders = U().state.regions.filter((x) => x.type === 'slider');
      if (mode === 'folha') {
        const plots = U().state.regions.filter((x) => PLOT_TYPES.has(x.type));
        const tsel = h('select', null, h('option', { value: '' }, '— escolha —'), ...plots.map((x, i) => h('option', { value: x.key || 'idx' + i, selected: x.key && x.key === r.targetKey ? 'selected' : null }, (i + 1) + '. ' + plotLabel(x))));
        tsel.addEventListener('change', () => {
          const i = tsel.selectedIndex - 1; if (i < 0) { r.targetKey = ''; return; }
          const x = plots[i]; if (!x.key) x.key = newKey();
          r.targetKey = x.key; U().markDirty(false); U().renderOutput(r);
        });
        f.append(h('div', { class: 'grid4' }, field('Gráfico a animar', tsel, 'span4')));
      } else {
        const fns = declaredFunctions();
        const tsel = sel(r, 'ptype', [['xy', 'Curvas (gráfico XY)'], ['heat', 'Mapa de calor'], ['surf', 'Superfície 3D']], () => { U().renderOutput(r); redraw(); });
        f.append(h('div', { class: 'grid4' }, field('Tipo de gráfico', tsel, 'span2'), field('Estilo', sel(r, 'preset', U().presetOpts()), 'span2')));
        let target = null;
        if (fns.length) {
          f.append(FC.uiExt.fnChips(() => target || f.querySelector('textarea, input[type=text]'), {}), h('p', { class: 'hint span4' }, 'Depois de inserir, troque os argumentos: um número fixa o valor, um nome da folha usa o valor dele e um nome novo vira o parâmetro animado.'));
        }
        if ((r.ptype || 'xy') === 'xy') {
          const ta = h('textarea', { class: 'src', rows: '3', placeholder: 'y(x, 2, b)\ny(x, a2, b)', spellcheck: 'false', autocapitalize: 'off' }); ta.value = r.curves || '';
          ta.addEventListener('input', () => { r.curves = ta.value; U().markDirty(false); U().renderOutput(r); });
          target = ta;
          f.append(h('div', { class: 'grid4' }, field('Curvas (uma por linha)', ta, 'span4')),
            h('div', { class: 'grid4' }, field('Variável do eixo x', inp(r, 'xvar', { ph: 'x' })), field('x de', inp(r, 'xmin')), field('x até', inp(r, 'xmax')), field('Pontos', inp(r, 'npts', { type: 'number' }))),
            h('div', { class: 'grid4' }, field('Rótulo do eixo x', inp(r, 'xlabel', { ph: 'x' })), field('Rótulo do eixo y', inp(r, 'ylabel', { ph: 'y' })), field('y mín. (opcional)', inp(r, 'ymin2')), field('y máx. (opcional)', inp(r, 'ymax2'))));
        } else {
          const ge = inp(r, 'gexpr', { ph: 'g(x, y, b)' });
          target = ge;
          f.append(h('div', { class: 'grid4' }, field('Expressão do mapa', ge, 'span4')),
            h('div', { class: 'grid4' }, field('Variável x', inp(r, 'xvar', { ph: 'x' })), field('x de', inp(r, 'xmin')), field('x até', inp(r, 'xmax')), field('Pontos em x', inp(r, 'nx', { type: 'number' }))),
            h('div', { class: 'grid4' }, field('Variável y', inp(r, 'yvar', { ph: 'y' })), field('y de', inp(r, 'ymin')), field('y até', inp(r, 'ymax')), field('Pontos em y', inp(r, 'ny', { type: 'number' }))),
            h('div', { class: 'grid4' }, field('Rótulo x', inp(r, 'xlabel')), field('Rótulo y', inp(r, 'ylabel')), field('Rótulo da cor (z)', inp(r, 'zlabel')), field('Cores', sel(r, 'colorscale', Object.keys(FC.COLORSCALES).map((k) => [k, k])))));
        }
      }
      f.append(
        h('div', { class: 'grid4' }, field('Parâmetro animado', inp(r, 'param', { ph: mode === 'proprio' ? 'b' : (sliders[0] ? sliders[0].name : 'λ_OT') })), field('Valor inicial', inp(r, 'from')), field('Valor final', inp(r, 'to')), field('Quadros', inp(r, 'frames', { type: 'number' }))),
        h('div', { class: 'grid4' }, field('Quadros por segundo', inp(r, 'fps', { type: 'number' })), field('Ida e volta', inp(r, 'pingpong', { type: 'checkbox' })), field('Pausa nas pontas (s)', inp(r, 'hold', { type: 'number' })), field('Escala e eixos fixos', inp(r, 'fixed', { type: 'checkbox' }))),
        h('div', { class: 'grid4' }, field('Rótulo do quadro', inp(r, 'label', { ph: '{p} = {v} nm' }), 'span2'), field('Mostrar rótulo', inp(r, 'labelOn', { type: 'checkbox' })), field('Casas decimais', sel(r, 'digits', [['auto', 'automático'], ['0', '0'], ['1', '1'], ['2', '2'], ['3', '3']]))),
        h('div', { class: 'grid4' }, field('Resolução do vídeo/GIF', sel(r, 'scale', [['1', '1× (tamanho da revista)'], ['2', '2×'], ['3', '3×']]), 'span2')),
        h('p', { class: 'hint' }, mode === 'proprio'
          ? 'Como no Mathcad, dentro de uma função vale a ordem dos argumentos: com y(x, a, b) := a·x + b, a curva y(x, 2, b) fixa a = 2 e anima b, e y(x, a2, b) usa a variável a2 da folha. O parâmetro animado vale só neste gráfico: ele passa por cima de qualquer valor dado antes com := (por exemplo, a := 2), sem mudar o resto da folha. No rótulo, {p} é o nome do parâmetro e {v} o valor.'
          : 'O parâmetro pode ser um controle deslizante, uma variável definida com := ou um nome usado direto no gráfico. Cada quadro recalcula a folha até o gráfico com o novo valor. No rótulo, {p} é o nome do parâmetro e {v} o valor; use _ para subscrito (ex.: λ_OT = {v} nm).'));
    }
  };
  function insertInto(el, txt) {
    if (!el) return;
    if (el.tagName === 'TEXTAREA') {
      const v = el.value, p = el.selectionStart == null ? v.length : el.selectionStart, q = el.selectionEnd == null ? p : el.selectionEnd;
      const pre = v.slice(0, p), post = v.slice(q);
      const ins = (pre && !pre.endsWith('\n') && !post ? '\n' : '') + txt;
      el.value = pre + ins + post; el.focus(); el.setSelectionRange(pre.length + ins.length, pre.length + ins.length);
    } else { el.value = txt; el.focus(); }
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }
  /* funções declaradas na folha (e nos pacotes ativos), na forma em que foram escritas */
  function declaredFunctions() {
    const out = [], seen = new Set();
    for (const r of U().state.regions) {
      if (r.type !== 'math') continue;
      for (const [l] of FC.srcParts(r.src)) {
        if (/^\s/.test(l)) continue;
        const t = FC.normalize(l).trim(); const di = FC.findTop(t, ':=');
        if (di <= 0) continue;
        try { const n = FC.parse(t.slice(0, di).trim()); if (n.isFunctionNode && n.args.length) { const sgn = n.fn.name + '(' + n.args.map((a) => a.toString()).join(', ') + ')'; if (!seen.has(sgn)) { seen.add(sgn); out.push(sgn); } } } catch (e) { /* ignora */ }
      }
    }
    for (const pk of (FC.uiExt.activePacks ? FC.uiExt.activePacks() : [])) for (const fn of pk.funcoes || []) if (fn.assinatura && fn.assinatura.includes('(') && !seen.has(fn.assinatura)) { seen.add(fn.assinatura); out.push(fn.assinatura); }
    return out;
  }

  /* ---------- renderização dos quadros em imagem ---------- */
  async function renderImages(a, T, frames, onProg) {
    const p = FC.PRESETS[T.preset] || FC.PRESETS.acs1;
    const w = Math.round(p.w * 96), hgt = Math.round(p.w * p.ratio * 96);
    const sc = Math.max(1, Number(a.scale) || 2);
    let W = Math.round(w * sc), H = Math.round(hgt * sc); W += W % 2; H += H % 2;
    const div = document.createElement('div');
    div.style.cssText = 'position:fixed;left:-10000px;top:0;width:' + w + 'px;height:' + hgt + 'px';
    document.body.appendChild(div);
    const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const imgs = [];
    try {
      for (let k = 0; k < frames.length; k++) {
        const rr = frameRegion(a, T, frames, k);
        const fig = FC.figure(rr, frames[k].data, true);
        fig.layout.width = w; fig.layout.height = hgt;
        await Plotly.react(div, fig.data, fig.layout, { staticPlot: true });
        const url = await Plotly.toImage(div, { format: 'png', width: w, height: hgt, scale: sc });
        const img = await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = url; });
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, H); ctx.drawImage(img, 0, 0, W, H);
        imgs.push({ url, data: ctx.getImageData(0, 0, W, H) });
        if (onProg) onProg(k, frames.length);
        if (exporting.cancel) throw new Error('cancelado');
      }
    } finally { Plotly.purge(div); div.remove(); }
    return { imgs, W, H, canvas, ctx };
  }
  const exporting = { busy: false, cancel: false };
  /* GIF em memória (usado pela exportação para Markdown) */
  FC.uiExt.animGifBytes = async function (a, onProg) {
    const T = targetOf(a);
    if (!T || !a._frames || a._framesSig !== sigOf(a)) return null;
    const fps = Math.max(1, Number(a.fps) || 10), hold = Math.max(0, Math.round((Number(a.hold) || 0) * fps));
    const R = await renderImages(a, T, a._frames, onProg);
    const seq = order(a, a._frames.length);
    const { GIFEncoder, quantize, applyPalette } = window.gifenc;
    const gif = GIFEncoder(), delay = Math.round(1000 / fps);
    for (let i = 0; i < seq.length; i++) {
      const k = seq[i], d = R.imgs[k].data.data;
      const pal = quantize(d, 256), idx = applyPalette(d, pal);
      const ends = (k === 0 || k === a._frames.length - 1) && hold;
      gif.writeFrame(idx, R.W, R.H, { palette: pal, delay: ends ? delay * (1 + hold) : delay });
      if (i % 6 === 0) await new Promise((r) => setTimeout(r, 0));
    }
    gif.finish();
    return gif.bytes();
  };
  async function exportAnim(a, el, fmt) {
    const T = targetOf(a);
    if (!T) return U().toast('Escolha o gráfico a animar em “Editar”.');
    if (!a._frames || a._framesSig !== sigOf(a)) return U().toast('Calcule os quadros primeiro.');
    if (exporting.busy) return U().toast('Já há uma exportação em andamento.');
    exporting.busy = true; exporting.cancel = false;
    const st = el.querySelector('.an-status');
    const cancelBtn = U().h('button', { class: 'linkbtn2', onclick: () => { exporting.cancel = true; } }, 'Cancelar');
    const setSt = (t) => { st.textContent = t + ' '; st.append(cancelBtn); };
    try {
      const fps = Math.max(1, Number(a.fps) || 10), hold = Math.max(0, Math.round((Number(a.hold) || 0) * fps));
      const R = await renderImages(a, T, a._frames, (k, n) => setSt('Desenhando quadro ' + (k + 1) + ' de ' + n + '…'));
      const seq = order(a, a._frames.length);
      const base = U().fileBase(T) + '_animacao';
      if (fmt === 'gif') {
        setSt('Codificando GIF…');
        const { GIFEncoder, quantize, applyPalette } = window.gifenc;
        const gif = GIFEncoder(), delay = Math.round(1000 / fps);
        for (let i = 0; i < seq.length; i++) {
          const k = seq[i], d = R.imgs[k].data.data;
          const pal = quantize(d, 256), idx = applyPalette(d, pal);
          const ends = (k === 0 || k === a._frames.length - 1) && hold;
          gif.writeFrame(idx, R.W, R.H, { palette: pal, delay: ends ? delay * (1 + hold) : delay });
          if (exporting.cancel) throw new Error('cancelado');
          if (i % 4 === 0) { setSt('Codificando GIF… ' + (i + 1) + ' de ' + seq.length); await new Promise((r) => setTimeout(r, 0)); }
        }
        gif.finish();
        saveBytes(base + '.gif', 'image/gif', gif.bytes());
      } else if (fmt === 'zip') {
        setSt('Montando o ZIP…');
        const files = {};
        a._frames.forEach((f, k) => { const b = atob(R.imgs[k].url.split(',')[1]); const u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); files['quadro_' + String(k).padStart(3, '0') + '.png'] = u; });
        files['valores.txt'] = new TextEncoder().encode('quadro\t' + a.param + '\r\n' + a._frames.map((f, k) => k + '\t' + FC.numStr(f.v)).join('\r\n') + '\r\n');
        saveBytes(base + '_png.zip', 'application/zip', window.fflate.zipSync(files, { level: 0 }));
      } else {
        const full = [];
        for (const k of seq) { const ends = (k === 0 || k === a._frames.length - 1) ? hold : 0; for (let j = 0; j <= ends; j++) full.push(k); }
        const out = await encodeVideo(R, full, fps, (i, n) => setSt('Codificando vídeo… ' + (i + 1) + ' de ' + n));
        saveBytes(base + '.' + out.ext, out.mime, out.bytes);
        if (out.ext !== 'mp4') setTimeout(() => U().toast('Este aparelho não grava MP4; o vídeo foi salvo em WebM.'), 2800);
      }
      st.textContent = '';
    } catch (e) {
      st.textContent = e.message === 'cancelado' ? 'Exportação cancelada.' : 'Falha ao exportar: ' + e.message;
    } finally { exporting.busy = false; }
  }
  async function encodeVideo(R, seq, fps, onProg) {
    if (typeof VideoEncoder !== 'undefined' && window.Mp4Muxer) {
      const codecs = ['avc1.640028', 'avc1.4d0028', 'avc1.42e01f', 'avc1.42001f'];
      let cfg = null;
      for (const c of codecs) {
        const t = { codec: c, width: R.W, height: R.H, bitrate: Math.min(12e6, R.W * R.H * fps * 0.15), framerate: fps };
        try { const s = await VideoEncoder.isConfigSupported(t); if (s.supported) { cfg = t; break; } } catch (e) { /* tenta o próximo */ }
      }
      if (cfg) {
        const muxer = new Mp4Muxer.Muxer({ target: new Mp4Muxer.ArrayBufferTarget(), video: { codec: 'avc', width: R.W, height: R.H }, fastStart: 'in-memory' });
        let err = null;
        const enc = new VideoEncoder({ output: (chunk, meta) => muxer.addVideoChunk(chunk, meta), error: (e) => { err = e; } });
        enc.configure(cfg);
        const ctx = R.ctx;
        for (let i = 0; i < seq.length; i++) {
          ctx.putImageData(R.imgs[seq[i]].data, 0, 0);
          const vf = new VideoFrame(R.canvas, { timestamp: Math.round((i * 1e6) / fps), duration: Math.round(1e6 / fps) });
          enc.encode(vf, { keyFrame: i % Math.max(1, fps * 2) === 0 });
          vf.close();
          if (err) throw err;
          if (exporting.cancel) throw new Error('cancelado');
          if (i % 5 === 0) { onProg(i, seq.length); await new Promise((r) => setTimeout(r, 0)); }
        }
        await enc.flush();
        if (err) throw err;
        muxer.finalize();
        return { bytes: new Uint8Array(muxer.target.buffer), mime: 'video/mp4', ext: 'mp4' };
      }
    }
    // alternativa: MediaRecorder (WebM), em tempo real
    if (typeof MediaRecorder === 'undefined' || !R.canvas.captureStream) throw new Error('este navegador não grava vídeo. Use GIF ou PNG.');
    const stream = R.canvas.captureStream(0), track = stream.getVideoTracks()[0];
    const mime = ['video/mp4;codecs=avc1', 'video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find((m) => MediaRecorder.isTypeSupported(m));
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8e6 });
    const chunks = []; rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    const stopped = new Promise((res) => { rec.onstop = res; });
    rec.start();
    for (let i = 0; i < seq.length; i++) {
      R.ctx.putImageData(R.imgs[seq[i]].data, 0, 0);
      if (track.requestFrame) track.requestFrame();
      onProg(i, seq.length);
      await new Promise((r) => setTimeout(r, 1000 / fps));
      if (exporting.cancel) { rec.stop(); throw new Error('cancelado'); }
    }
    rec.stop(); await stopped;
    const blob = new Blob(chunks, { type: mime.split(';')[0] });
    return { bytes: new Uint8Array(await blob.arrayBuffer()), mime: mime.split(';')[0], ext: mime.startsWith('video/mp4') ? 'mp4' : 'webm' };
  }

  /* ---------- registro ---------- */
  FC.uiExt = FC.uiExt || {};
  FC.uiExt.slider = slider;
  FC.uiExt.anim = anim;
  FC.uiExt.animRibbon = () => {
    const { bigBtn, addRegion } = U();
    return [
      bigBtn('Controle deslizante', '<path d="M3 12h18"/><circle cx="9" cy="12" r="3"/>', () => addRegion('slider')),
      bigBtn('Animação', '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M10 9l5 3-5 3z"/>', () => addRegion('anim'))
    ];
  };
})();
