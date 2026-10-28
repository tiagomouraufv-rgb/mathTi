/* Folha de Cálculo — interface */
'use strict';
(function () {
  const FC = window.FC;
  const M = FC.M;
  const VERSION = '0.9.3';
  FC.VERSION = VERSION;
  const $ = (sel, el) => (el || document).querySelector(sel);
  const h = (tag, attrs, ...kids) => {
    const e = document.createElement(tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k === 'html') e.innerHTML = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else if (k === 'value') e.value = v;
      else if (k === 'checked') e.checked = !!v;
      else e.setAttribute(k, v === true ? '' : v);
    }
    for (const k of kids.flat()) if (k != null && k !== false) e.append(k.nodeType ? k : document.createTextNode(String(k)));
    return e;
  };
  const icon = (d, size) => {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('width', size || 18); s.setAttribute('height', size || 18);
    s.setAttribute('aria-hidden', 'true'); s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor');
    s.setAttribute('stroke-width', '1.8'); s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round');
    s.innerHTML = d; return s;
  };
  const IC = {
    up: '<path d="M12 19V5M6 11l6-6 6 6"/>', down: '<path d="M12 5v14M6 13l6 6 6-6"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16v4z"/>', check: '<path d="M5 12l5 5 9-10"/>',
    dl: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>', file: '<path d="M6 3h8l5 5v13H6z"/><path d="M14 3v5h5"/>',
    open: '<path d="M3 7h6l2 2h10v10H3z"/>', save: '<path d="M5 4h11l3 3v13H5z"/><path d="M8 4v5h7V4M8 20v-6h8v6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>', help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5V14M12 17.5v.01"/>',
    undo: '<path d="M9 7L4 12l5 5M4 12h10a6 6 0 0 1 0 12"/>'
  };

  /* ---------- Estado ---------- */
  const state = { name: 'sem_titulo', regions: [], selected: null, editing: null, preset: 'acs1', dirty: false, lastTA: null };
  FC.state = state;
  let uid = 1;
  const newId = () => 'r' + Date.now().toString(36) + (uid++);

  const DEFAULTS = {
    math: () => ({ type: 'math', w: 'third', src: '' }),
    text: () => ({ type: 'text', w: 'full', src: '' }),
    xy: () => ({ type: 'xy', w: 'third', xvar: 'x', xmin: '', xmax: '', npts: 400, traces: [{ expr: 'f(x)', name: '', color: FC.PALETTE[0], width: 1.5, dash: 'solid', marker: 'none' }], xlabel: 'x', ylabel: 'y', xlog: false, ylog: false, xlo: '', xhi: '', ymin: '', ymax: '', legend: 'sup-esq', preset: state.preset, panel: '' }),
    heat: () => ({ type: 'heat', w: 'third', expr: 'g(x, y)', xvar: 'x', yvar: 'y', xmin: '0', xmax: '10', nx: 101, ymin: '0', ymax: '10', ny: 101, colorscale: 'Viridis', reverse: false, contours: false, ncont: 10, zmin: '', zmax: '', xlabel: 'x', ylabel: 'y', zlabel: 'z', preset: state.preset, panel: '' }),
    surf: () => ({ type: 'surf', w: 'third', expr: 'g(x, y)', xvar: 'x', yvar: 'y', xmin: '0', xmax: '10', nx: 61, ymin: '0', ymax: '10', ny: 61, colorscale: 'Viridis', reverse: false, contours: false, colorbar: false, zmin: '', zmax: '', xlabel: 'x', ylabel: 'y', zlabel: 'z', preset: state.preset }),
    table: () => ({ type: 'table', w: 'third', mode: 'cols', cols: 'x\nf(x)', matrix: 'Pg', names: '', units: '', comments: '' }),
    data: () => FC.uiExt.data.defaults(),
    sweep: () => FC.uiExt.sweep.defaults(),
    fit: () => FC.uiExt.fit.defaults(),
    slider: () => FC.uiExt.slider.defaults(),
    anim: () => FC.uiExt.anim.defaults()
  };
  const TYPE_LABEL = { math: 'Matemática', text: 'Texto', xy: 'Gráfico XY', heat: 'Mapa de calor', surf: 'Superfície 3D', table: 'Tabela', data: 'Dados importados', sweep: 'Varredura de parâmetro', fit: 'Ajuste a dados', slider: 'Controle deslizante', anim: 'Animação' };

  /* ---------- Gravação de arquivos ---------- */
  function b64FromString(s) {
    const bytes = new TextEncoder().encode(s); let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  }
  function saveFile(name, mime, content, isDataUrl) {
    try {
      if (window.FcalcAndroid && window.FcalcAndroid.saveFile) {
        let b64;
        if (!isDataUrl) b64 = b64FromString(content);
        else if (/^data:[^,]*;base64,/.test(content)) b64 = content.slice(content.indexOf(',') + 1);
        else b64 = b64FromString(decodeURIComponent(content.slice(content.indexOf(',') + 1)));
        window.FcalcAndroid.saveFile(name, mime, b64);
        return;
      }
    } catch (e) { toast('Falha ao salvar: ' + e.message); return; }
    let url;
    if (isDataUrl) {
      if (/^data:image\/svg/.test(content) && !/;base64,/.test(content)) url = content;
      else url = content;
    } else url = URL.createObjectURL(new Blob([content], { type: mime + ';charset=utf-8' }));
    const a = h('a', { href: url, download: name });
    document.body.append(a); a.click(); a.remove();
    if (!isDataUrl) setTimeout(() => URL.revokeObjectURL(url), 4000);
    toast('Arquivo gerado: ' + name);
  }
  FC.saveFile = saveFile;
  window.fcalcSaved = (name, ok) => toast(ok ? 'Salvo: ' + name : 'Gravação cancelada');

  let toastTimer;
  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
  }
  FC.toast = toast;

  /* ---------- Documento ---------- */
  function serialize() {
    return JSON.stringify({ app: 'fcalc', version: 1, name: state.name, preset: state.preset, myStyle: state.myStyle || null, materials: state.materials || [], packs: FC.uiExt.packsForDoc(), tabCache: state.tabCache || {}, regions: state.regions.map((r) => { const o = {}; for (const k in r) if (!k.startsWith('_') && k !== 'id') o[k] = r[k]; return o; }) }, null, 1);
  }
  function load(doc) {
    if (!doc || !Array.isArray(doc.regions)) throw new Error('Arquivo não reconhecido.');
    state.name = doc.name || 'sem_titulo';
    state.preset = doc.preset || 'acs1';
    if (doc.myStyle) { state.myStyle = doc.myStyle; applyMyStyle(doc.myStyle); }
    if (state.preset === 'mine' && !FC.PRESETS.mine) state.preset = 'acs1';
    state.tabCache = doc.tabCache || {};
    FC.uiExt.mergeMaterials(doc.materials || []);
    state.regions = doc.regions.map((r) => Object.assign(DEFAULTS[r.type] ? DEFAULTS[r.type]() : {}, r, { id: newId() }));
    state.selected = null; state.editing = null;
    $('#docName').value = state.name;
    FC.uiExt.loadDocPacks(doc.packs || []);
    buildRibbon(); buildSheet(); recalc();
  }
  FC.load = load;
  function autosave() {
    if (FC.uiExt.saveCurrent) { FC.uiExt.saveCurrent(); return; }
    try { localStorage.setItem('fcalc.doc', serialize()); } catch (e) { /* armazenamento indisponível */ }
  }
  let saveTimer;
  function markDirty(recalcToo) {
    state.dirty = true;
    state.version = (state.version || 0) + 1;
    if (FC.uiExt.onChange) FC.uiExt.onChange();
    clearTimeout(saveTimer); saveTimer = setTimeout(autosave, 800);
    if (recalcToo !== false) scheduleRecalc();
  }
  FC.markDirty = markDirty;

  /* ---------- Recalcular ---------- */
  let recalcTimer;
  function scheduleRecalc() { clearTimeout(recalcTimer); recalcTimer = setTimeout(recalc, 350); }
  /* Cálculo em segundo plano: um Worker recebe a folha e devolve os resultados */
  const calc = { worker: null, job: 0, busy: false, ok: true, t0: 0, showTimer: null };
  function makeWorker() {
    try {
      const src = document.getElementById('fc-worker-src');
      if (!src || typeof Worker === 'undefined') return null;
      const url = URL.createObjectURL(new Blob([src.textContent], { type: 'text/javascript' }));
      const w = new Worker(url);
      w.onmessage = onWorkerMsg;
      w.onerror = (e) => { if (e && e.preventDefault) e.preventDefault(); calc.ok = false; calc.worker = null; calc.busy = false; setBusy(false); recalcSync(); };
      return w;
    } catch (e) { return null; }
  }
  function calcOpts() { return { materials: state.materials || [], tabCache: state.tabCache || {}, packs: FC.uiExt.activePacks() }; }
  function plainRegions() { return state.regions.map((r) => { const o = {}; for (const k in r) if (!k.startsWith('_')) o[k] = r[k]; return o; }); }
  function recalc() {
    if (!calc.ok) return recalcSync();
    if (calc.busy && calc.worker) { calc.worker.terminate(); calc.worker = null; }
    if (!calc.worker) calc.worker = makeWorker();
    if (!calc.worker) { calc.ok = false; return recalcSync(); }
    calc.job++; calc.busy = true; calc.t0 = performance.now();
    setBusy(true, 0, state.regions.length);
    calc.worker.postMessage({ cmd: 'calc', job: calc.job, regions: plainRegions(), opts: calcOpts() });
  }
  function requestLive() {
    state.version = (state.version || 0) + 1;
    clearTimeout(saveTimer); saveTimer = setTimeout(autosave, 800);
    if (calc.busy) { calc.pending = true; return; }
    clearTimeout(recalcTimer); recalc();
  }
  function onWorkerMsg(ev) {
    const m = ev.data || {};
    if (m.type === 'ready' || m.job !== calc.job) return;
    if (m.type === 'progress') { setBusy(true, m.i, m.n); return; }
    calc.busy = false;
    if (m.type === 'fail') { setBusy(false); toast('Erro no cálculo: ' + m.err); return; }
    if (m.type === 'done') applyResults(m.results, m.errors, performance.now() - calc.t0, m);
    if (calc.pending) { calc.pending = false; recalc(); }
  }
  function applyResults(results, errors, ms, extra) {
    const byId = new Map(results.map((x) => [x.id, x]));
    for (const r of state.regions) {
      const x = byId.get(r.id); if (!x) continue;
      r._lines = x.lines || null; r._data = x.data || null; r._rows = x.rows || null; r._err = x.err || null;
      r._defs = x.defs || null; r._sweep = x.sweep || null; r._fit = x.fit || null; r._warn = x.warn || null; r._slider = x.slider || null;
    }
    if (extra) {
      if (extra.tabCache) { const changed = JSON.stringify(Object.keys(extra.tabCache)) !== JSON.stringify(Object.keys(state.tabCache || {})); state.tabCache = extra.tabCache; if (changed) { clearTimeout(saveTimer); saveTimer = setTimeout(autosave, 800); } }
      const w = extra.warnings || [];
      const st = $('#stWarn');
      st.hidden = !w.length;
      st.textContent = w.length ? '⚠ ' + w.length + (w.length > 1 ? ' avisos' : ' aviso') : '';
      st.title = w.join('\n');
      st.onclick = () => toast(w.slice(0, 3).join(' · '));
    }
    for (const r of state.regions) renderOutput(r);
    setBusy(false);
    ms = Math.round(ms);
    $('#stTime').textContent = 'Recalculado em ' + (ms < 1000 ? ms + ' ms' : (ms / 1000).toFixed(1) + ' s');
    $('#stErr').textContent = errors ? errors + (errors > 1 ? ' erros' : ' erro') : 'Sem erros';
    $('#stErr').className = errors ? 'st-err' : 'st-ok';
  }
  function recalcSync() {
    const t0 = performance.now();
    const r = FC.computeSheet(plainRegions(), null, calcOpts());
    applyResults(r.results, r.errors, performance.now() - t0, r);
  }
  function cancelCalc() {
    if (calc.worker) { calc.worker.terminate(); calc.worker = null; }
    calc.busy = false; calc.job++; setBusy(false);
    $('#stTime').textContent = 'Cálculo cancelado. Edite a folha para calcular de novo.';
  }
  function setBusy(on, i, n) {
    const b = $('#stBusy');
    if (!on) { clearTimeout(calc.showTimer); calc.showTimer = null; b.hidden = true; return; }
    $('#stBusyTxt').textContent = 'Calculando… região ' + Math.min((i || 0) + 1, n || 1) + ' de ' + (n || 1);
    if (b.hidden && !calc.showTimer) calc.showTimer = setTimeout(() => { calc.showTimer = null; if (calc.busy) b.hidden = false; }, 400);
  }
  FC.recalc = recalc;

  /* ---------- Renderização matemática ---------- */
  function kt(t, display) {
    try { return katex.renderToString(t, { throwOnError: false, strict: 'ignore', displayMode: !!display, output: 'html' }); }
    catch (e) { return '<code>' + esc(t) + '</code>'; }
  }
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const descHTML = (L) => (L.desc ? '<span class="ml-desc">' + esc(L.desc) + '</span>' : '');
  function lineHTML(L) {
    switch (L.kind) {
      case 'empty': return '<div class="ml ml-empty"></div>';
      case 'comment': return '<div class="ml ml-com">' + esc(L.text) + '</div>';
      case 'error': return '<div class="ml ml-err"><code>' + esc(L.raw) + '</code><div class="errmsg">' + esc(L.err) + '</div></div>';
      case 'range': return '<div class="ml">' + kt(L.tex) + ' <span class="note">' + esc(L.note) + '</span></div>';
      case 'fdef': return '<div class="ml">' + kt(L.tex) + descHTML(L) + '</div>';
      case 'vdef': return '<div class="ml">' + kt(L.tex + (L.res ? ' = \\color{#1d6b3a}{' + L.res + '}' : '')) + descHTML(L) + '</div>';
      case 'eval': return '<div class="ml">' + kt(L.tex + ' = \\color{#1d6b3a}{' + L.res + '}') + descHTML(L) + '</div>';
      case 'sym': return '<div class="ml">' + kt(L.tex + ' \\rightarrow \\color{#1d6b3a}{' + L.res + '}') + '</div>';
      case 'expr': return '<div class="ml">' + kt(L.tex) + ' <span class="note">' + esc(L.note) + '</span></div>';
      case 'prog': return '<div class="ml ml-prog">' + kt(L.tex + (L.res ? ' = \\color{#1d6b3a}{' + L.res + '}' : '')) + '</div>';
      case 'row': return '<div class="ml ml-row">' + (L.items || []).map((x) => '<div class="ml-cell">' + lineHTML(x).replace(/^<div class="ml/, '<div class="mlc') + '</div>').join('') + (L.note ? '<span class="note">' + esc(L.note) + '</span>' : '') + '</div>';
      case 'given': return '<div class="ml ml-given">' + kt('\\begin{array}{l}' + L.tex + '\\end{array}') + (L.note ? ' <span class="note">' + esc(L.note) + '</span>' : '') + '</div>';
      default: return '';
    }
  }
  const GREEK_TEX = { 'α': '\\alpha', 'β': '\\beta', 'γ': '\\gamma', 'δ': '\\delta', 'ε': '\\varepsilon', 'ζ': '\\zeta', 'η': '\\eta', 'θ': '\\theta', 'ι': '\\iota', 'κ': '\\kappa', 'λ': '\\lambda', 'μ': '\\mu', 'ν': '\\nu', 'ξ': '\\xi', 'ρ': '\\rho', 'σ': '\\sigma', 'τ': '\\tau', 'υ': '\\upsilon', 'φ': '\\phi', 'χ': '\\chi', 'ψ': '\\psi', 'ω': '\\omega', 'Γ': '\\Gamma', 'Δ': '\\Delta', 'Θ': '\\Theta', 'Λ': '\\Lambda', 'Ξ': '\\Xi', 'Π': '\\Pi', 'Σ': '\\Sigma', 'Φ': '\\Phi', 'Ψ': '\\Psi', 'Ω': '\\Omega', 'ħ': '\\hbar' };
  /* Equação pronta para o manuscrito: ≔ vira =, sem cores, gregas como comandos */
  function texOf(L, keepDef) {
    let t;
    switch (L.kind) {
      case 'fdef': case 'range': t = L.tex; break;
      case 'vdef': case 'prog': t = L.tex + (L.res ? ' = ' + L.res : ''); break;
      case 'eval': case 'sym': t = L.tex + ' = ' + L.res; break;
      case 'given': t = '\\begin{array}{l}' + L.tex + '\\end{array}'; break;
      case 'row': { const p = (L.items || []).map((x) => texOf(x, keepDef)).filter(Boolean); return p.length ? p.join(' \\qquad ') : null; }
      default: return null;
    }
    return t.replace(/\\coloneqq/g, keepDef ? '\\mathrel{:=}' : '=').replace(/\\color\{[^}]*\}/g, '').replace(/\\textbf\{Given\}/g, '\\text{Given}')
      .replace(/[α-ωΑ-Ωħ]/g, (ch) => (GREEK_TEX[ch] ? GREEK_TEX[ch] + ' ' : ch)).replace(/\{\{([^{}]*)\}\}/g, '{$1}').replace(/\s+/g, ' ').trim();
  }
  FC.texOf = texOf;
  function copyText(s, what) {
    const done = () => toast((what || 'Texto') + ' copiado.');
    const fallback = () => {
      const ta = h('textarea', { style: 'position:fixed;left:-9999px;top:0' }); ta.value = s; document.body.append(ta); ta.select();
      try { document.execCommand('copy'); done(); } catch (e) { toast('Não foi possível copiar.'); }
      ta.remove();
    };
    try { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(s).then(done, fallback); else fallback(); } catch (e) { fallback(); }
  }
  function copyRegionTex(r) {
    const L = (r._lines || []).map(texOf).filter(Boolean);
    if (!L.length) return toast('Nada para copiar nesta região.');
    copyText(L.length === 1 ? L[0] : '\\begin{gather*}\n' + L.join(' \\\\\n') + '\n\\end{gather*}', 'LaTeX');
  }
  function textHTML(src) {
    const parts = String(src || '').split(/(\$[^$]+\$)/g);
    return parts.map((p) => {
      if (/^\$[^$]+\$$/.test(p)) return kt(p.slice(1, -1));
      let t = esc(p);
      t = t.replace(/^### (.*)$/gm, '<h4>$1</h4>').replace(/^## (.*)$/gm, '<h3>$1</h3>').replace(/^# (.*)$/gm, '<h2>$1</h2>');
      t = t.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/\*([^*]+)\*/g, '<i>$1</i>');
      return t.replace(/\n/g, '<br>');
    }).join('') || '<span class="placeholder">Texto vazio — toque para escrever.</span>';
  }

  /* ---------- Saídas das regiões ---------- */
  function renderOutput(r) {
    const el = document.getElementById(r.id);
    if (!el) return;
    el.classList.toggle('has-err', !!r._err);
    const wb = $('.rwarn', el);
    if (wb) { wb.hidden = !(r._warn && r._warn.length); wb.textContent = r._warn ? '⚠ ' + r._warn.join(' · ') : ''; }
    if (FC.uiExt[r.type] && FC.uiExt[r.type].render) return FC.uiExt[r.type].render(r, el);
    if (r.type === 'math') {
      const out = $('.mout', el);
      const lines = (r._lines || []).filter((L) => L.kind !== 'empty' || state.editing !== r.id);
      out.innerHTML = lines.length ? lines.map((L, k) => { const html = lineHTML(L); return texOf(L) ? html.replace('<div class="ml', '<div data-i="' + k + '" class="ml has-tex') .replace(/<\/div>$/, '<button class="cp" data-i="' + k + '" aria-label="Copiar em LaTeX" title="Copiar em LaTeX">TeX</button></div>') : html; }).join('') : '<span class="placeholder">Região vazia — toque para escrever, ex.: f(x) := 3·x</span>';
      out._lines = lines;
      if (FC.uiExt.fitEquations) requestAnimationFrame(() => FC.uiExt.fitEquations(out));
    } else if (r.type === 'text') {
      $('.tout', el).innerHTML = FC.uiExt.textHTML ? FC.uiExt.textHTML(r.src, r) : textHTML(r.src);
      if (FC.uiExt.fitEquations) { const to = $('.tout', el); requestAnimationFrame(() => FC.uiExt.fitEquations(to)); }
    } else if (r.type === 'table') {
      renderTable(r, el);
    } else {
      const err = $('.perr', el), div = $('.plot', el);
      if (r._err || !r._data) { err.textContent = r._err || ''; err.hidden = !r._err; div.hidden = !!r._err; return; }
      err.hidden = true; div.hidden = false;
      FC.drawPlot(div, r, r._data).catch((e) => { err.hidden = false; err.textContent = 'Erro ao desenhar: ' + e.message; });
    }
  }
  function renderTable(r, el) {
    const box = $('.tblbox', el), err = $('.perr', el);
    if (r._err || !r._rows) { err.hidden = false; err.textContent = r._err || 'Sem dados.'; box.innerHTML = ''; return; }
    err.hidden = true;
    const rows = r._rows, n = rows.length, C = rows[0] ? rows[0].length : 0;
    const names = splitList(r.names, C, (i) => (r.mode === 'cols' ? String(r.cols || '').split('\n').filter((s) => s.trim())[i] || 'C' + i : 'C' + i));
    const units = splitList(r.units, C, () => '');
    const show = n > 14 ? [0, 1, 2, 3, 4, 5, -1, n - 3, n - 2, n - 1] : [...Array(n).keys()];
    let html = '<table class="dtbl"><thead><tr><th class="ix"></th>' + names.map((s) => '<th>' + esc(s) + '</th>').join('') + '</tr>';
    if (units.some(Boolean)) html += '<tr class="meta"><td class="ix">Units</td>' + units.map((s) => '<td>' + esc(s) + '</td>').join('') + '</tr>';
    html += '</thead><tbody>';
    for (const i of show) {
      if (i < 0) { html += '<tr class="gap"><td class="ix">⋮</td>' + names.map(() => '<td>⋮</td>').join('') + '</tr>'; continue; }
      html += '<tr><td class="ix">' + i + '</td>' + rows[i].map((v) => '<td>' + esc(FC.numStr(v)) + '</td>').join('') + '</tr>';
    }
    html += '</tbody></table>';
    box.innerHTML = html;
    $('.tinfo', el).textContent = n + ' linhas × ' + C + ' colunas';
  }
  function splitList(s, n, dflt) {
    const a = FC.splitTop(String(s || ''), ',').map((x) => x.trim());
    const out = [];
    for (let i = 0; i < n; i++) out.push(a[i] || dflt(i));
    return out;
  }

  /* ---------- Exportação de dados (Origin) ---------- */
  function originText(names, units, comments, rows) {
    const lines = [names.join('\t')];
    if (units.some(Boolean) || comments.some(Boolean)) { lines.push(units.join('\t')); lines.push(comments.join('\t')); }
    for (const r of rows) lines.push(r.map((v) => (v === '' ? '' : FC.numStr(v))).join('\t'));
    return lines.join('\r\n') + '\r\n';
  }
  function gridMatrixText(xs, ys, z) {
    return z.map((row) => row.map(FC.numStr).join('\t')).join('\r\n') + '\r\n';
  }
  const FILE_TAG = { xy: 'grafico_xy', heat: 'mapa_de_calor', surf: 'superficie_3d', table: 'tabela', data: 'dados', sweep: 'varredura', fit: 'ajuste' };
  function fileBase(r) { return (state.name || 'folha').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w\-]+/g, '_') + '_' + (FILE_TAG[r.type] || r.type); }
  function exportTable(r, kind) {
    if (!r._rows) return toast('Nada para exportar.');
    const C = r._rows[0].length;
    const names = splitList(r.names, C, (i) => (r.mode === 'cols' ? String(r.cols || '').split('\n').filter((s) => s.trim())[i] || 'C' + i : 'C' + i));
    const units = splitList(r.units, C, () => ''), com = splitList(r.comments, C, () => '');
    if (kind === 'csv') {
      const txt = [names.join(','), ...r._rows.map((row) => row.map(FC.numStr).join(','))].join('\r\n') + '\r\n';
      return saveFile(fileBase(r) + '.csv', 'text/csv', txt);
    }
    if (kind === 'grid') {
      if (C < 3) return toast('A matriz precisa de 3 colunas: x, y, z.');
      const xs = [...new Set(r._rows.map((q) => q[0]))].sort((a, b) => a - b), ys = [...new Set(r._rows.map((q) => q[1]))].sort((a, b) => a - b);
      if (xs.length * ys.length !== r._rows.length) return toast('As colunas x e y não formam uma grade regular.');
      const xi = new Map(xs.map((v, i) => [v, i])), yi = new Map(ys.map((v, i) => [v, i]));
      const z = ys.map(() => new Array(xs.length).fill(NaN));
      for (const q of r._rows) z[yi.get(q[1])][xi.get(q[0])] = q[2];
      toast('Matriz: linhas = y (' + ys[0] + ' a ' + ys[ys.length - 1] + '), colunas = x (' + xs[0] + ' a ' + xs[xs.length - 1] + ')');
      return saveFile(fileBase(r) + '_matriz.txt', 'text/plain', gridMatrixText(xs, ys, z));
    }
    saveFile(fileBase(r) + '.txt', 'text/plain', originText(names, units, com, r._rows));
  }
  function exportPlotData(r, kind) {
    const d = r._data; if (!d) return toast('Nada para exportar.');
    if (r.type === 'xy') {
      let names, rows;
      if (d.traces.every((q) => !q.xs)) {
        names = [r.xlabel || r.xvar, ...d.traces.map(({ t }) => t.name || t.expr)];
        rows = d.xs.map((x, i) => [x, ...d.traces.map(({ ys }) => ys[i])]);
      } else {
        // curvas com x próprio: um par de colunas (x, y) por curva, como no Origin
        names = []; d.traces.forEach(({ t, top }) => { names.push('x ' + (top ? (r.x2label || 'sup.') : (r.xlabel || r.xvar)), t.name || t.expr); });
        const N = Math.max(...d.traces.map((q) => (q.xs || d.xs).length));
        rows = []; for (let i = 0; i < N; i++) rows.push(d.traces.flatMap((q) => { const X = q.xs || d.xs; return i < X.length ? [X[i], q.ys[i]] : ['', '']; }));
      }
      return saveFile(fileBase(r) + '.txt', 'text/plain', originText(names.map(plain), names.map(() => ''), names.map(() => ''), rows));
    }
    if (kind === 'grid') {
      toast('Matriz: linhas = ' + r.yvar + ' (' + d.ys[0] + ' a ' + d.ys[d.ys.length - 1] + '), colunas = ' + r.xvar + ' (' + d.xs[0] + ' a ' + d.xs[d.xs.length - 1] + ')');
      return saveFile(fileBase(r) + '_matriz.txt', 'text/plain', gridMatrixText(d.xs, d.ys, d.z));
    }
    const rows = [];
    for (let i = 0; i < d.xs.length; i++) for (let j = 0; j < d.ys.length; j++) rows.push([d.xs[i], d.ys[j], d.z[j][i]]);
    const names = [r.xlabel || r.xvar, r.ylabel || r.yvar, r.zlabel || r.expr].map(plain);
    saveFile(fileBase(r) + '_xyz.txt', 'text/plain', originText(names, ['', '', ''], ['', '', ''], rows));
  }
  const plain = (s) => String(s || '').replace(/[_^{}]/g, '');
  async function exportFig(r, fmt) {
    if (!r._data) return toast('Nada para exportar.');
    toast('Gerando figura…');
    try {
      const url = await FC.exportFigure(r, r._data, fmt);
      saveFile(fileBase(r) + '.' + fmt, fmt === 'svg' ? 'image/svg+xml' : 'image/png', url, true);
    } catch (e) { toast('Falha ao gerar a figura: ' + e.message); }
  }

  /* ---------- Construção da folha ---------- */
  function buildSheet() {
    const sheet = $('#sheet');
    sheet.innerHTML = '';
    for (const r of state.regions) sheet.append(regionEl(r));
    if (!state.regions.length) sheet.append(h('div', { class: 'empty-sheet' }, 'Folha vazia. Use “+ Matemática” abaixo ou um botão da faixa para começar.'));
  }
  function regionEl(r) {
    const sec = h('section', { class: 'region w-' + r.w + ' t-' + r.type + (state.selected === r.id ? ' sel' : '') + (state.editing === r.id ? ' editing' : ''), id: r.id, 'aria-label': TYPE_LABEL[r.type] });
    sec.addEventListener('pointerdown', () => select(r.id), true);
    const widthSel = h('select', { class: 'wsel', 'aria-label': 'Largura da região', onchange: (e) => { r.w = e.target.value; sec.className = sec.className.replace(/w-\w+/, 'w-' + r.w); markDirty(false); setTimeout(() => resizePlots(r), 50); } },
      ...[['third', '⅓'], ['half', '½'], ['twothird', '⅔'], ['full', 'Inteira']].map(([v, l]) => h('option', { value: v, selected: r.w === v ? 'selected' : null }, l)));
    // título opcional da região (no lugar de “Gráfico XY”, “Matemática”…)
    const ttl = h('input', { class: 'rtitle', type: 'text', value: r.title || '', placeholder: TYPE_LABEL[r.type], spellcheck: 'false', 'aria-label': 'Título da região (opcional)', title: 'Toque para dar um título a esta região (opcional)' });
    ttl.addEventListener('input', () => { r.title = ttl.value; sec.classList.toggle('has-title', !!ttl.value.trim()); markDirty(false); });
    ttl.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); ttl.blur(); } });
    if (String(r.title || '').trim()) sec.classList.add('has-title');
    const isPlot = PLOT_TYPES.has(r.type);
    const head = h('div', { class: 'rhead' },
      h('div', { class: 'rname' },
        h('span', { class: 'rtype rdrag', title: 'Arraste para mover a região', 'data-drag': r.id }, h('span', { class: 'grip', 'aria-hidden': 'true' }, '⠿')),
        ttl),
      h('div', { class: 'rtools' },
        r.type === 'math' ? h('button', { class: 'ib txt', 'aria-label': 'Copiar a região em LaTeX', title: 'Copiar a região em LaTeX', onclick: () => copyRegionTex(r) }, 'TeX') : null,
        isPlot ? h('button', { class: 'ib txt capbtn' + (r.capOn ? ' on' : ''), 'aria-label': 'Mostrar ou esconder a legenda da figura', title: 'Legenda da figura (caption) embaixo do gráfico', onclick: (e) => toggleCaption(r, sec, e.currentTarget) }, 'Leg.') : null,
        widthSel,
        h('button', { class: 'ib', 'aria-label': 'Mover para cima', onclick: () => move(r, -1) }, icon(IC.up)),
        h('button', { class: 'ib', 'aria-label': 'Mover para baixo', onclick: () => move(r, 1) }, icon(IC.down)),
        h('button', { class: 'ib', 'aria-label': 'Duplicar', onclick: () => duplicate(r) }, icon(IC.copy)),
        h('button', { class: 'ib danger', 'aria-label': 'Excluir', onclick: () => remove(r) }, icon(IC.trash))));
    sec.append(head);
    if (FC.uiExt[r.type] && FC.uiExt[r.type].build) {
      FC.uiExt[r.type].build(r, sec);
      if (isPlot) addCaption(r, sec);
      sec.append(h('div', { class: 'rwarn', hidden: true }));
      return sec;
    }
    if (r.type === 'math' || r.type === 'text') {
      const isMath = r.type === 'math';
      const ta = h('textarea', { class: 'src', spellcheck: 'false', autocapitalize: 'off', autocomplete: 'off', rows: 3, placeholder: isMath ? 'Uma expressão por linha, ex.:\nx := 0, 0.1 .. 10\nf(x) := 3·x   // descrição opcional\nf(2) =' : 'Texto. **negrito**, *itálico*, ==destaque==, $E = h\\nu$, # Título. Use a aba Texto para cor, figuras e listas.' });
      ta.value = r.src || '';
      ta.addEventListener('input', () => { r.src = ta.value; autoGrow(ta); if (!isMath) renderOutput(r); markDirty(isMath); });
      ta.addEventListener('focus', () => { state.lastTA = ta; select(r.id); });
      ta.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') { e.preventDefault(); stopEdit(); }
        if (isMath && e.key === ':' && !e.ctrlKey && !e.metaKey) { /* ":" vira ":=" como no Mathcad */
          const p = ta.selectionStart, lineStart = ta.value.lastIndexOf('\n', p - 1) + 1, before = ta.value.slice(lineStart, p);
          const insideBrackets = (before.match(/\[/g) || []).length > (before.match(/\]/g) || []).length;
          if (!insideBrackets && ta.value[p - 1] !== ':' && ta.value[p] !== '=') { e.preventDefault(); insertAt(ta, ' := ', ''); }
        }
        if (isMath && e.key === '=' && ta.value.slice(ta.selectionStart - 4, ta.selectionStart) === ' := ') e.preventDefault();
        if (e.ctrlKey && (e.key === 'g' || e.key === 'G')) { e.preventDefault(); greekToggle(ta); }
      });
      const done = h('button', { class: 'btn small', onclick: (e) => { e.stopPropagation(); stopEdit(); } }, icon(IC.check, 16), 'Concluir');
      const editor = h('div', { class: 'editor' }, ta, h('div', { class: 'edbar' }, h('span', { class: 'hint' }, isMath ? '“:” vira ≔ · termine com = para ver o valor · → para expandir · // descrição · Ctrl+G grego' : 'aba Texto: cor, negrito, figuras · as outras abas escrevem $LaTeX$'), done));
      const out = h('div', { class: isMath ? 'mout' : 'tout', onclick: (e) => {
        const b = e.target.closest('.cp');
        if (b) { e.stopPropagation(); const L = (out._lines || [])[+b.dataset.i]; const t = L && texOf(L); if (t) copyText(t, 'LaTeX'); return; }
        startEdit(r.id);
      } });
      sec.append(out, editor);
      if (state.editing === r.id) setTimeout(() => { autoGrow(ta); ta.focus(); }, 0);
    } else if (r.type === 'table') {
      sec.append(
        h('div', { class: 'tinfo' }),
        h('div', { class: 'perr', hidden: true }),
        h('div', { class: 'tblbox' }),
        h('div', { class: 'actions' },
          h('button', { class: 'btn small', onclick: () => toggleForm(r, sec) }, icon(IC.edit, 16), 'Editar'),
          h('button', { class: 'btn small', onclick: () => exportTable(r, 'txt') }, icon(IC.dl, 16), 'TXT (Origin)'),
          h('button', { class: 'btn small', onclick: () => exportTable(r, 'grid') }, 'Matriz'),
          h('button', { class: 'btn small', onclick: () => exportTable(r, 'csv') }, 'CSV')),
        h('div', { class: 'form', hidden: true }));
    } else {
      const acts = [h('button', { class: 'btn small', onclick: () => toggleForm(r, sec) }, icon(IC.edit, 16), 'Editar')];
      if (r.type !== 'surf') acts.push(h('button', { class: 'btn small', onclick: () => exportFig(r, 'svg') }, icon(IC.dl, 16), 'SVG'));
      acts.push(h('button', { class: 'btn small', onclick: () => exportFig(r, 'png') }, r.type === 'surf' ? 'PNG' : 'PNG 600 dpi'));
      if (r.type === 'xy') acts.push(h('button', { class: 'btn small', onclick: () => exportPlotData(r) }, 'Dados TXT'));
      else acts.push(h('button', { class: 'btn small', onclick: () => exportPlotData(r, 'xyz') }, 'TXT XYZ'), h('button', { class: 'btn small', onclick: () => exportPlotData(r, 'grid') }, 'Matriz'));
      sec.append(h('div', { class: 'perr', hidden: true }), h('div', { class: 'plot' }), h('div', { class: 'actions' }, ...acts), h('div', { class: 'form', hidden: true }));
      addCaption(r, sec);
    }
    sec.append(h('div', { class: 'rwarn', hidden: true }));
    return sec;
  }
  /* ---------- legenda de figura (caption), como \caption{} de artigo ---------- */
  const PLOT_TYPES = new Set(['xy', 'heat', 'surf', 'anim', 'fit', 'sweep']);
  function capInline(s) {
    return String(s || '').split(/(\$[^$]+\$)/g).map((p) => (/^\$[^$]+\$$/.test(p) ? kt(p.slice(1, -1)) : esc(p).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/\*([^*]+)\*/g, '<i>$1</i>'))).join('');
  }
  function figNumber(r) { let n = 0; for (const x of state.regions) { if (PLOT_TYPES.has(x.type) && x.capOn) n++; if (x === r) return n; } return n; }
  FC.figNumber = figNumber;
  function renumberCaps() { for (const x of state.regions) { const el = document.getElementById(x.id); const b = el && el.querySelector('.rcap .fignum'); if (b) b.textContent = 'Figura ' + figNumber(x) + '.'; } }
  function addCaption(r, sec) {
    const shown = h('div', { class: 'rcap-view', title: 'Toque para editar a legenda' });
    const ta = h('textarea', { class: 'rcap-edit', rows: 2, spellcheck: 'true', placeholder: 'Legenda da figura. Aceita $\\lambda$ (LaTeX), **negrito** e *itálico*.' });
    const cap = h('figcaption', { class: 'rcap', hidden: !r.capOn }, h('b', { class: 'fignum' }, 'Figura ' + figNumber(r) + '.'), ' ', shown, ta);
    const paint = () => { shown.innerHTML = r.cap ? capInline(r.cap) : '<span class="placeholder">toque para escrever a legenda…</span>'; };
    const edit = (on) => { cap.classList.toggle('editing', on); if (on) { ta.value = r.cap || ''; setTimeout(() => { ta.focus(); ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 2 + 'px'; }, 0); } else paint(); };
    shown.addEventListener('click', (e) => { e.stopPropagation(); edit(true); });
    ta.addEventListener('input', () => { r.cap = ta.value; ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 2 + 'px'; markDirty(false); });
    ta.addEventListener('blur', () => edit(false));
    ta.addEventListener('keydown', (e) => { if (e.key === 'Escape' || (e.key === 'Enter' && !e.shiftKey)) { e.preventDefault(); ta.blur(); } });
    paint();
    const anchor = sec.querySelector('.an-ctrl') || sec.querySelector('.plot');
    if (anchor) anchor.after(cap); else sec.append(cap);
    cap._edit = edit;
  }
  function toggleCaption(r, sec, btn) {
    r.capOn = !r.capOn;
    const cap = sec.querySelector('.rcap'); if (!cap) return;
    cap.hidden = !r.capOn; btn.classList.toggle('on', !!r.capOn);
    renumberCaps(); markDirty(false);
    if (r.capOn && !r.cap && cap._edit) cap._edit(true);
  }
  function autoGrow(ta) { ta.style.height = 'auto'; ta.style.height = Math.max(72, ta.scrollHeight + 2) + 'px'; }
  function select(id) {
    if (state.selected === id) return;
    state.selected = id;
    document.querySelectorAll('.region.sel').forEach((e) => e.classList.remove('sel'));
    const el = document.getElementById(id); if (el) el.classList.add('sel');
  }
  function startEdit(id) {
    if (state.editing === id) return;
    stopEdit(true);
    state.editing = id; select(id);
    const el = document.getElementById(id); if (!el) return;
    el.classList.add('editing');
    const ta = $('textarea.src', el); autoGrow(ta); ta.focus();
    state.lastTA = ta;
  }
  function stopEdit(silent) {
    if (!state.editing) return;
    const el = document.getElementById(state.editing);
    if (el) el.classList.remove('editing');
    const r = state.regions.find((x) => x.id === state.editing);
    state.editing = null;
    if (r) renderOutput(r);
  }
  function move(r, d) {
    const i = state.regions.indexOf(r), j = i + d;
    if (j < 0 || j >= state.regions.length) return;
    state.regions.splice(i, 1); state.regions.splice(j, 0, r);
    buildSheet(); recalc(); markDirty(false);
  }
  function duplicate(r) {
    const c = JSON.parse(JSON.stringify(r, (k, v) => (k.startsWith('_') ? undefined : v)));
    c.id = newId();
    state.regions.splice(state.regions.indexOf(r) + 1, 0, c);
    buildSheet(); recalc(); markDirty(false);
  }
  let lastRemoved = null;
  function remove(r) {
    const i = state.regions.indexOf(r);
    lastRemoved = { r, i };
    state.regions.splice(i, 1);
    if (state.editing === r.id) state.editing = null;
    buildSheet(); recalc(); markDirty(false);
    toastUndo('Região excluída.');
  }
  function toastUndo(msg) {
    const t = $('#toast'); t.innerHTML = '';
    t.append(msg + ' ', h('button', { class: 'linkbtn', onclick: () => { if (lastRemoved) { state.regions.splice(lastRemoved.i, 0, lastRemoved.r); lastRemoved = null; buildSheet(); recalc(); markDirty(false); t.classList.remove('show'); } } }, 'Desfazer'));
    t.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 5000);
  }
  function addRegion(type, opts) {
    const r = Object.assign(DEFAULTS[type](), opts || {}, { id: newId() });
    const i = state.selected ? state.regions.findIndex((x) => x.id === state.selected) : -1;
    state.regions.splice(i >= 0 ? i + 1 : state.regions.length, 0, r);
    state.selected = r.id;
    if (type === 'math' || type === 'text') state.editing = r.id;
    buildSheet(); recalc(); markDirty(false);
    setTimeout(() => { const el = document.getElementById(r.id); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' }); if (type !== 'math' && type !== 'text') toggleForm(r, el); }, 60);
    return r;
  }
  FC.addRegion = addRegion;
  // insere várias regiões prontas (exemplos de pacotes) depois da selecionada
  function insertRegions(list) {
    const i = state.selected ? state.regions.findIndex((x) => x.id === state.selected) : -1;
    const rs = list.filter((r) => r && DEFAULTS[r.type]).map((r) => Object.assign(DEFAULTS[r.type](), JSON.parse(JSON.stringify(r)), { id: newId() }));
    state.regions.splice(i >= 0 ? i + 1 : state.regions.length, 0, ...rs);
    if (rs.length) state.selected = rs[rs.length - 1].id;
    buildSheet(); recalc(); markDirty(false);
    setTimeout(() => { const el = rs[0] && document.getElementById(rs[0].id); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 80);
    return rs.length;
  }
  function resizePlots(r) { const el = document.getElementById(r.id); const p = el && $('.plot', el); if (p && p.data) Plotly.Plots.resize(p); }

  /* ---------- Formulários de edição ---------- */
  let styleClip = null;
  function field(label, input, cls) { return h('label', { class: 'fld ' + (cls || '') }, h('span', null, label), input); }
  function inp(r, key, opts) {
    opts = opts || {};
    const e = h('input', { type: opts.type || 'text', value: r[key] ?? '', placeholder: opts.ph || '', inputmode: opts.num ? 'decimal' : null, autocapitalize: 'off', spellcheck: 'false' });
    if (opts.type === 'checkbox') { e.checked = !!r[key]; e.addEventListener('change', () => { r[key] = e.checked; markDirty(); }); }
    else e.addEventListener('input', () => { r[key] = opts.type === 'number' ? Number(e.value) : e.value; markDirty(); });
    return e;
  }
  function sel(r, key, options, onch) {
    const e = h('select', null, ...options.map(([v, l]) => h('option', { value: v, selected: String(r[key]) === String(v) ? 'selected' : null }, l)));
    e.addEventListener('change', () => { r[key] = e.value; markDirty(); if (onch) onch(); });
    return e;
  }
  const presetOpts = () => Object.entries(FC.PRESETS).map(([k, p]) => [k, p.label]);
  function toggleForm(r, sec) {
    const f = $('.form', sec);
    if (!f.hidden) { f.hidden = true; return; }
    f.innerHTML = '';
    if (FC.uiExt[r.type] && FC.uiExt[r.type].form) FC.uiExt[r.type].form(r, f);
    else if (r.type === 'xy') formXY(r, f);
    else if (r.type === 'table') formTable(r, f);
    else formGrid(r, f);
    f.hidden = false;
  }
  const FMT_OPTS = [['', 'automático'], ['dec', 'decimal'], ['sci', 'científico (1.5e+3)'], ['pow', 'potência de 10'], ['si', 'prefixos SI (k, M, µ)']];
  function axisFmt(r, k) { return [field('Números', sel(r, k + 'fmt', FMT_OPTS)), field('Casas decimais', inp(r, k + 'dec', { ph: 'auto', num: true })), field('Passo das marcas', inp(r, k + 'step', { ph: 'auto', num: true }))]; }
  function formXY(r, f) {
    const tr = h('div', { class: 'traces' });
    const KINDS = [['func', 'y(x): função da variável do eixo x'], ['param', 'uma função em função de outra (parâmetro comum)'], ['data', 'dados: vetores x e y (ex.: tabela)']];
    const tin = (t, key, ph, cls) => { const e = h('input', { type: 'text', value: t[key] ?? '', placeholder: ph || '', spellcheck: 'false', autocapitalize: 'off', class: cls || null }); e.addEventListener('input', () => { t[key] = e.value; markDirty(); }); return e; };
    const drawTraces = () => {
      tr.innerHTML = '';
      r.traces.forEach((t, i) => {
        const kind = t.kind || 'func';
        const kd = h('select', { 'aria-label': 'Tipo de curva', onchange: (e) => { t.kind = e.target.value; if (t.kind === 'data' && (!t.marker || t.marker === 'none')) { t.marker = 'circle'; t.lines = false; } drawTraces(); markDirty(); } }, ...KINDS.map(([v, l]) => h('option', { value: v, selected: kind === v ? 'selected' : null }, l)));
        const nm = h('input', { type: 'text', value: t.name || '', placeholder: 'legenda (aceita \\psi_n, λ_0, x^2)', oninput: (e) => { t.name = e.target.value; markDirty(); } });
        const show = h('input', { type: 'checkbox' }); show.checked = !t.hideLeg; show.addEventListener('change', () => { t.hideLeg = !show.checked; markDirty(); });
        const col = h('input', { type: 'color', value: t.color || FC.PALETTE[i % FC.PALETTE.length], 'aria-label': 'Cor', oninput: (e) => { t.color = e.target.value; markDirty(); } });
        const wd = h('input', { type: 'range', min: '0.5', max: '4', step: '0.25', value: t.width || 1.5, 'aria-label': 'Espessura', oninput: (e) => { t.width = Number(e.target.value); wv.textContent = t.width; markDirty(); } });
        const wv = h('span', { class: 'wv' }, String(t.width || 1.5));
        const ds = h('select', { 'aria-label': 'Estilo da linha', onchange: (e) => { t.dash = e.target.value; markDirty(); } }, ...[['solid', 'contínua'], ['dash', 'tracejada'], ['dot', 'pontilhada'], ['dashdot', 'traço-ponto']].map(([v, l]) => h('option', { value: v, selected: t.dash === v ? 'selected' : null }, l)));
        const mk = h('select', { 'aria-label': 'Marcador', onchange: (e) => { t.marker = e.target.value; markDirty(); } }, ...[['none', 'sem marcador'], ['circle', '●'], ['square', '■'], ['triangle-up', '▲'], ['diamond', '◆'], ['circle-open', '○'], ['square-open', '□']].map(([v, l]) => h('option', { value: v, selected: t.marker === v ? 'selected' : null }, l)));
        const ln = h('input', { type: 'checkbox' }); ln.checked = t.lines !== false; ln.addEventListener('change', () => { t.lines = ln.checked; markDirty(); });
        const del = h('button', { class: 'ib danger', 'aria-label': 'Remover curva', onclick: () => { r.traces.splice(i, 1); drawTraces(); markDirty(); } }, icon(IC.trash));
        const cpy = h('button', { class: 'btn small', onclick: () => { styleClip = { color: t.color, width: t.width, dash: t.dash, marker: t.marker, lines: t.lines }; toast('Estilo da curva copiado.'); } }, 'Copiar estilo');
        const pst = h('button', { class: 'btn small', onclick: () => { if (!styleClip) return toast('Copie o estilo de uma curva antes.'); Object.assign(t, styleClip); drawTraces(); markDirty(); } }, 'Colar estilo');
        let rows;
        if (kind === 'param') rows = [
          h('div', { class: 'trow' }, field('Eixo x: função', tin(t, 'xexpr', 'N_T(I_P)', 'cexpr'), 'grow'), field('Eixo y: função', tin(t, 'expr', 'κ(I_P)', 'cexpr'), 'grow')),
          h('div', { class: 'trow' }, field('Parâmetro comum', tin(t, 'pvar', 'I_P')), field('de', tin(t, 'pmin', '0')), field('até', tin(t, 'pmax', '10')), field('pontos', tin(t, 'pn', '300')))];
        else if (kind === 'data') rows = [h('div', { class: 'trow' }, field('x (vetor)', tin(t, 'xexpr', 'DADO[0]', 'cexpr'), 'grow'), field('y (vetor)', tin(t, 'expr', 'DADO[1]', 'cexpr'), 'grow'))];
        else rows = [h('div', { class: 'trow' }, field('Curva ' + (i + 1) + ': y(' + (t.xown ? (t.txvar || r.xvar || 'x') : (r.xvar || 'x')) + ')', tin(t, 'expr', 'f(x)', 'cexpr'), 'grow'))];
        // eixo x desta curva: o principal (embaixo) ou um eixo superior independente; intervalo próprio
        const xp = h('select', { 'aria-label': 'Eixo x desta curva', onchange: (e) => { t.txpos = e.target.value; if (t.txpos === 'top' && kind === 'func' && !t.xown) t.xown = true; drawTraces(); drawTop(); markDirty(); } },
          ...[['', 'eixo x principal (embaixo)'], ['top', 'eixo x superior (independente)']].map(([v, l]) => h('option', { value: v, selected: (t.txpos || '') === v ? 'selected' : null }, l)));
        const xo = h('input', { type: 'checkbox' }); xo.checked = !!t.xown; xo.addEventListener('change', () => { t.xown = xo.checked; drawTraces(); markDirty(); });
        const xrows = [h('div', { class: 'trow' }, field('Eixo x desta curva', xp, 'grow'), kind === 'func' ? h('label', { class: 'chk' }, xo, ' variável, intervalo e pontos próprios') : null)];
        if (kind === 'func' && t.xown) xrows.push(h('div', { class: 'trow' }, field('Variável', tin(t, 'txvar', r.xvar || 'x')), field('de', tin(t, 'txmin', String(r.xmin || 'mín. do eixo'))), field('até', tin(t, 'txmax', String(r.xmax || 'máx. do eixo'))), field('pontos', tin(t, 'tn', String(r.npts || 400)))));
        tr.append(h('div', { class: 'trace' + (t.txpos === 'top' ? ' top' : '') },
          h('div', { class: 'trow' }, field('Curva ' + (i + 1) + ' — tipo', kd, 'grow')),
          ...rows, ...xrows,
          h('div', { class: 'trow' }, field('Dividir por (opcional)', tin(t, 'div', 'ex.: k_B·295 K, 2, máximo teórico'), 'grow'), field('Legenda', nm, 'grow'), h('label', { class: 'chk' }, show, ' na legenda')),
          h('div', { class: 'trow' }, col, h('span', { class: 'lbl' }, 'espessura'), wd, wv, ds, mk, h('label', { class: 'chk' }, ln, ' ligar pontos'), del),
          h('div', { class: 'trow' }, cpy, pst)));
      });
    };
    const topBox = h('div');
    const drawTop = () => {
      topBox.innerHTML = '';
      if (!r.traces.some((t) => t.txpos === 'top')) return;
      topBox.append(h('div', { class: 'fsec' }, 'Eixo x superior (curvas com eixo independente)'),
        h('div', { class: 'grid4' }, field('Rótulo x superior', inp(r, 'x2label', { ph: 'λ (nm)' }), 'span2'), field('Escala log', inp(r, 'x2log', { type: 'checkbox' })), field('Dividir x sup. por', inp(r, 'x2dv', { ph: 'ex.: 1000' }))),
        h('div', { class: 'grid4' }, field('Mostrar x sup. de', inp(r, 'x2lo', { ph: 'auto' })), field('até', inp(r, 'x2hi', { ph: 'auto' }))),
        h('div', { class: 'grid4' }, ...axisFmt(r, 'x2')));
    };
    drawTraces(); drawTop();
    const add = (kind) => { const n = r.traces.length; r.traces.push({ kind, expr: '', xexpr: '', name: '', color: FC.PALETTE[n % FC.PALETTE.length], width: 1.5, dash: 'solid', marker: kind === 'data' ? 'circle' : 'none', lines: kind !== 'data', pvar: kind === 'param' ? '' : undefined }); drawTraces(); markDirty(false); };
    const normBox = h('div');
    const drawNorm = () => {
      normBox.innerHTML = '';
      if (r.norm === 'common') normBox.append(h('div', { class: 'grid4' }, field('Dividir todas por', sel(r, 'normRef', [['max', 'o maior valor entre todas'], ['curve', 'o máximo de uma curva'], ['value', 'um valor que eu informo']], drawNorm), 'span2'),
        r.normRef === 'curve' ? field('Número da curva', inp(r, 'normCurve', { ph: '1', num: true })) : r.normRef === 'value' ? field('Valor (aceita expressão)', inp(r, 'normVal', { ph: 'k_B·295 K' })) : h('span')));
    };
    drawNorm();
    const legBox = h('div');
    const drawLeg = () => {
      legBox.innerHTML = '';
      if (r.legend === 'manual') legBox.append(h('div', { class: 'grid4' }, field('x da legenda (0 a 1)', inp(r, 'legX', { ph: '0.02', num: true })), field('y da legenda (0 a 1)', inp(r, 'legY', { ph: '0.98', num: true }))));
    };
    drawLeg();
    f.append(
      FC.uiExt.fnChips(null, { data: true }),
      h('div', { class: 'fsec' }, 'Curvas'), tr,
      h('div', { class: 'trow' },
        h('button', { class: 'btn small', onclick: () => add('func') }, icon(IC.plus, 16), 'Curva y(x)'),
        h('button', { class: 'btn small', onclick: () => add('param') }, icon(IC.plus, 16), 'Função × função'),
        h('button', { class: 'btn small', onclick: () => add('data') }, icon(IC.plus, 16), 'Dados (tabela)')),
      h('div', { class: 'fsec' }, 'Eixo x'),
      h('div', { class: 'grid4' }, field('Variável', inp(r, 'xvar')), field('Mínimo', inp(r, 'xmin', { ph: 'da variável' })), field('Máximo', inp(r, 'xmax', { ph: 'da variável' })), field('Pontos', inp(r, 'npts', { type: 'number' }))),
      h('div', { class: 'grid4' }, field('Rótulo x', inp(r, 'xlabel', { ph: 'λ_OT (nm)' }), 'span2'), field('Escala log', inp(r, 'xlog', { type: 'checkbox' })), field('Painel', inp(r, 'panel', { ph: '(a)' }))),
      h('div', { class: 'grid4' }, field('Mostrar x de', inp(r, 'xlo', { ph: 'auto' })), field('até', inp(r, 'xhi', { ph: 'auto' })), field('Dividir x por', inp(r, 'xdv', { ph: 'ex.: 1000, E_0' }), 'span2')),
      h('div', { class: 'grid4' }, ...axisFmt(r, 'x')),
      topBox,
      h('div', { class: 'fsec' }, 'Eixo y'),
      h('div', { class: 'grid4' }, field('Rótulo y', inp(r, 'ylabel'), 'span2'), field('Escala log', inp(r, 'ylog', { type: 'checkbox' }))),
      h('div', { class: 'grid4' }, field('y mínimo', inp(r, 'ymin', { ph: 'auto' })), field('y máximo', inp(r, 'ymax', { ph: 'auto' }))),
      h('div', { class: 'grid4' }, ...axisFmt(r, 'y')),
      h('div', { class: 'fsec' }, 'Normalização'),
      h('div', { class: 'grid4' }, field('Normalizar', sel(r, 'norm', [['', 'não'], ['each', 'cada curva pelo seu máximo'], ['common', 'todas pelo mesmo valor']], drawNorm), 'span2')),
      normBox,
      h('div', { class: 'fsec' }, 'Legenda e aparência'),
      h('div', { class: 'grid4' }, field('Posição da legenda', sel(r, 'legend', [['sup-esq', 'sup. esquerda'], ['sup-dir', 'sup. direita'], ['inf-esq', 'inf. esquerda'], ['inf-dir', 'inf. direita'], ['fora', 'fora do gráfico'], ['manual', 'onde eu arrastar'], ['nao', 'sem legenda']], drawLeg)), field('Caixa na legenda', inp(r, 'legBox', { type: 'checkbox' })), field('Legenda na horizontal', inp(r, 'legHoriz', { type: 'checkbox' })), field('Tamanho (×)', inp(r, 'legSize', { ph: '0.95', num: true }))),
      legBox,
      h('div', { class: 'grid4' }, field('Estilo de revista', sel(r, 'preset', presetOpts()), 'span2'), field('Vírgula decimal', inp(r, 'comma', { type: 'checkbox' })), field('Marcas menores', sel(r, 'minor', [['', 'sim'], ['false', 'não']]))),
      h('p', { class: 'hint' }, 'No gráfico: arraste a legenda e a letra do painel para onde quiser; toque no nome de uma curva na legenda ou no título de um eixo para editar. Rótulos aceitam _ (subscrito), ^ (sobrescrito) e nomes LaTeX: \\psi_n, λ_{OT}, k_{B}T, x^2. “Dividir por” e “Normalizar” funcionam como no Origin (ex.: dividir por k_B·T).'));
  }
  function formGrid(r, f) {
    const nb = h('div');
    const drawN = () => { nb.innerHTML = ''; if (r.znorm === 'value') nb.append(h('div', { class: 'grid4' }, field('Dividir por (valor ou expressão)', inp(r, 'znormVal', { ph: 'k_B·295 K' }), 'span2'))); };
    drawN();
    f.append(
      FC.uiExt.fnChips(null, {}),
      h('div', { class: 'grid4' }, field('Função z(x, y)', inp(r, 'expr', { ph: 'g(x, y)' }), 'span4')),
      h('div', { class: 'grid4' }, field('Dividir z por (opcional)', inp(r, 'zdiv', { ph: 'ex.: k_B·295 K' }), 'span2'), field('Normalizar z', sel(r, 'znorm', [['', 'não'], ['max', 'pelo máximo'], ['value', 'por um valor']], drawN), 'span2')),
      nb,
      h('div', { class: 'fsec' }, 'Grade'),
      h('div', { class: 'grid4' }, field('Variável x', inp(r, 'xvar')), field('x mínimo', inp(r, 'xmin')), field('x máximo', inp(r, 'xmax')), field('pontos em x', inp(r, 'nx', { type: 'number' }))),
      h('div', { class: 'grid4' }, field('Variável y', inp(r, 'yvar')), field('y mínimo', inp(r, 'ymin')), field('y máximo', inp(r, 'ymax')), field('pontos em y', inp(r, 'ny', { type: 'number' }))),
      h('div', { class: 'grid4' }, field('Dividir eixo x por', inp(r, 'xdv', { ph: 'ex.: 1000' }), 'span2'), field('Dividir eixo y por', inp(r, 'ydv', { ph: 'ex.: 1000' }), 'span2')),
      h('div', { class: 'fsec' }, 'Cores'),
      h('div', { class: 'grid4' }, field('Paleta', sel(r, 'colorscale', Object.keys(FC.COLORSCALES).map((k) => [k, k])), 'span2'), field('Inverter', inp(r, 'reverse', { type: 'checkbox' })), field('Curvas de nível', inp(r, 'contours', { type: 'checkbox' }))),
      h('div', { class: 'grid4' }, field('z mínimo fixo', inp(r, 'zmin', { ph: 'auto' })), field('z máximo fixo', inp(r, 'zmax', { ph: 'auto' })), r.type === 'heat' ? field('Nº de níveis', inp(r, 'ncont', { type: 'number' })) : field('Barra de cor', inp(r, 'colorbar', { type: 'checkbox' }))),
      r.type === 'heat' ? h('div', { class: 'grid4' }, field('Marcar mínimos (em cada linha)', inp(r, 'minima', { type: 'checkbox' }), 'span2')) : h('span'),
      h('div', { class: 'fsec' }, 'Rótulos'),
      h('div', { class: 'grid4' }, field('Eixo x', inp(r, 'xlabel')), field('Eixo y', inp(r, 'ylabel')), field(r.type === 'heat' ? 'Barra de cor' : 'Eixo z', inp(r, 'zlabel')), r.type === 'heat' ? field('Painel', inp(r, 'panel', { ph: '(c)' })) : h('span')),
      h('div', { class: 'fsec' }, 'Números dos eixos'),
      h('div', { class: 'grid4' }, h('span', { class: 'lbl' }, 'x'), ...axisFmt(r, 'x')),
      h('div', { class: 'grid4' }, h('span', { class: 'lbl' }, 'y'), ...axisFmt(r, 'y')),
      r.type === 'heat' ? h('div', { class: 'grid4' }, field('Números da barra de cor', sel(r, 'zfmt', FMT_OPTS)), field('Casas decimais', inp(r, 'zdec', { ph: 'auto', num: true }))) : h('span'),
      h('div', { class: 'grid4' }, field('Estilo de revista', sel(r, 'preset', presetOpts()), 'span2'), field('Vírgula decimal', inp(r, 'comma', { type: 'checkbox' }))),
      h('p', { class: 'hint' }, r.type === 'surf' ? 'Gire a superfície com o dedo; o ângulo escolhido é usado na exportação.' : 'Grades maiores (ex.: 301 × 301) ficam mais suaves e demoram mais para calcular.'));
  }
  function formTable(r, f) {
    const box = h('div');
    const draw = () => {
      box.innerHTML = '';
      if (r.mode === 'cols') {
        const ta = h('textarea', { class: 'src small', rows: 4, spellcheck: 'false', autocapitalize: 'off', placeholder: 'x\nf(x)\ng(x, 2)' });
        ta.value = r.cols || ''; ta.addEventListener('input', () => { r.cols = ta.value; markDirty(); });
        box.append(field('Colunas: uma expressão por linha (avaliadas sobre a variável de intervalo)', ta, 'span4'));
      } else box.append(field('Matriz ou vetor (ex.: Pg, augment(x, f(x)), tabelaXYZ(g, 0, 0.1, 10, 0, 0.1, 10))', inp(r, 'matrix'), 'span4'));
    };
    f.append(
      h('div', { class: 'grid4' }, field('Origem dos dados', sel(r, 'mode', [['cols', 'Colunas'], ['matrix', 'Matriz']], draw), 'span2')),
      box,
      h('div', { class: 'fsec' }, 'Cabeçalho para o Origin (separe por vírgulas)'),
      h('div', { class: 'grid4' }, field('Long Name', inp(r, 'names', { ph: 'λ, ε1, ε2' }), 'span4')),
      h('div', { class: 'grid4' }, field('Units', inp(r, 'units', { ph: 'nm, , ' }), 'span2'), field('Comments', inp(r, 'comments'), 'span2')),
      h('p', { class: 'hint' }, 'TXT (Origin): separado por tabulação, com as linhas Long Name, Units e Comments. Matriz: para tabelas x, y, z em grade, gera a matriz pronta para o mapa de calor.'));
    draw();
  }

  /* ---------- Inserção pela faixa ---------- */
  function insertAt(ta, ins, post) {
    const a = ta.selectionStart ?? ta.value.length, b = ta.selectionEnd ?? a;
    const ls = ta.value.lastIndexOf('\n', a - 1) + 1, ind = (ta.value.slice(ls, a).match(/^\s*/) || [''])[0];
    if (ind) { ins = ins.replace(/\n/g, '\n' + ind); post = (post || '').replace(/\n/g, '\n' + ind); }
    const selTxt = ta.value.slice(a, b);
    ta.value = ta.value.slice(0, a) + ins + selTxt + (post || '') + ta.value.slice(b);
    const caret = a + ins.length + selTxt.length;
    ta.setSelectionRange(caret, caret);
    ta.dispatchEvent(new Event('input'));
    ta.focus();
  }
  function activeTA() {
    if (state.editing) {
      const el = document.getElementById(state.editing);
      const r = state.regions.find((x) => x.id === state.editing);
      if (el && r && r.type === 'math') return $('textarea.src', el);
    }
    return null;
  }
  function insertTool(ins, post) {
    // em formulários, nomes, legendas e regiões de texto o símbolo vai para o campo em uso
    if (FC.uiExt.insertRouted && FC.uiExt.insertRouted(ins, post)) return;
    let ta = activeTA();
    if (!ta) {
      const selR = state.regions.find((x) => x.id === state.selected);
      if (selR && selR.type === 'math') { startEdit(selR.id); ta = activeTA(); }
      else { addRegion('math'); ta = activeTA(); }
    }
    if (ta) {
      // depois de uma linha terminada em = ou ->, um novo nome começa numa linha nova
      // só uma avaliação terminada em "=" (ou "->") faz a próxima ferramenta começar numa linha nova; ":=" não
      const before = ta.value.slice(0, ta.selectionStart);
      if (ta.selectionStart === ta.value.length && /((^|[^:=<>!])=|->)\s*$/.test(before.split('\n').pop()) && /^[A-Za-zα-ωΑ-ΩΣΠ\/]/.test(ins)) insertAt(ta, '\n', '');
      insertAt(ta, ins, post);
    }
  }
  const GREEK_MAP = { a: 'α', b: 'β', g: 'γ', d: 'δ', e: 'ε', z: 'ζ', h: 'η', q: 'θ', i: 'ι', k: 'κ', l: 'λ', m: 'μ', n: 'ν', x: 'ξ', p: 'π', r: 'ρ', s: 'σ', t: 'τ', u: 'υ', f: 'φ', c: 'χ', y: 'ψ', w: 'ω', G: 'Γ', D: 'Δ', Q: 'Θ', L: 'Λ', X: 'Ξ', P: 'Π', S: 'Σ', F: 'Φ', Y: 'Ψ', W: 'Ω' };
  function greekToggle(ta) {
    const p = ta.selectionStart; if (!p) return;
    const ch = ta.value[p - 1], g = GREEK_MAP[ch];
    if (!g) return toast('Ctrl+G converte a letra anterior em grega (ex.: l → λ).');
    ta.value = ta.value.slice(0, p - 1) + g + ta.value.slice(p);
    ta.setSelectionRange(p, p); ta.dispatchEvent(new Event('input'));
  }

  const TOOLS = [
    { id: 'mat', label: 'Matemática', groups: [
      ['Definir e avaliar', [['≔', ' := ', '', 'Definir (atalho: tecla “:”)'], ['=', ' =', '', 'Avaliar'], ['→', ' ->', '', 'Resultado simbólico'], ['a, b ‥ c', 'x := 0, 0.1 .. 10', '', 'Variável de intervalo'], ['//', '// ', '', 'Comentário']]],
      ['Operadores', [['x²', '^2', ''], ['xʸ', '^', ''], ['√', 'sqrt(', ')'], ['|x|', 'abs(', ')'], ['·', '·', ''], ['÷', '/', ''], ['i', 'i', '', 'Unidade imaginária'], ['π', 'π', ''], ['e', 'e', '', 'Número de Euler'], ['∞', '∞', '']]],
      ['Cálculo', [['∫', 'integral(', ', x, a, b)', 'integral(expressão, x, a, b)'], ['Σ', 'Σ(k, 1, n, ', ')', 'Σ(k, início, fim, expressão)'], ['Π', 'Π(k, 1, n, ', ')', 'Produtório'], ['d/dx', 'diff(', ', x) ->', 'Derivada simbólica'], ["f′(x₀)", 'deriv(', ', x, x0)', 'Derivada numérica num ponto'], ['raiz', 'root(', ', x, a, b)', 'Raiz entre a e b'], ['if', 'if(', ', a, b)', 'if(condição, se verdadeiro, se falso)'], ['expandir', 'expandir(', ') ->', 'Expande polinômios']]]
    ] },
    { id: 'prg', label: 'Programação', groups: [
      ['Bloco', [['prog … end', 'r := prog\n  ', '\nend', 'Programa com valor (última linha é o resultado)'], ['f(x) := prog', 'f(x) := prog\n  ', '\nend', 'Programa como função'], ['←', ' ← ', '', 'Atribuição local (ou <-)'], ['v[i] ←', 'v[i] ← ', '', 'Elemento de vetor; cresce sozinho']]],
      ['Controle', [['for', 'for i ∈ 0 .. n\n  ', ''], ['while', 'while cond\n  ', ''], ['if', 'if cond\n  ', ''], ['else if', 'else if cond\n  ', ''], ['else', 'else\n  ', ''], ['break', 'break', ''], ['continue', 'continue', ''], ['return', 'return ', ''], ['try', 'try\n  ', '\non error\n  ', 'try … on error']]],
      ['Solve block', [['Given', 'Given\n  ', '\nsol := find(x, y)', 'Restrições (com =, <, >) e depois find ou minerr'], ['find', 'find(', ')'], ['minerr', 'minerr(', ')', 'Melhor aproximação por mínimos quadrados']]],
      ['EDO e otimização', [['rkfixed', 'Y := rkfixed(y0, 0, 10, 100, D)', '', 'RK4 de passo fixo: D(x, y) devolve o vetor de derivadas'], ['Rkadapt', 'Y := Rkadapt(y0, 0, 10, 100, D)', '', 'Passo adaptativo'], ['D(t, y)', 'D(t, y) := [-y[0]; y[0] - y[1]]', '', 'Exemplo de sistema'], ['polyroots', 'polyroots(', ')', 'Raízes de v₀ + v₁x + …'], ['minimize', 'minimize(', ', x, a, b)'], ['maximize', 'maximize(', ', x, a, b)']]]
    ] },
    { id: 'greg', label: 'Gregas', groups: [
      ['Minúsculas', 'α β γ δ ε ζ η θ ι κ λ μ ν ξ ρ σ τ υ φ χ ψ ω'.split(' ').map((g) => [g, g, ''])],
      ['Maiúsculas', 'Γ Δ Θ Λ Ξ Π Σ Φ Ψ Ω'.split(' ').map((g) => [g, g, ''])]
    ] },
    { id: 'mtx', label: 'Matriz', groups: [
      ['Criar', [['2×2', '[1, 2; 3, 4]', ''], ['3×1', '[1; 2; 3]', ''], ['zeros', 'zeros(3, 3)', ''], ['identidade', 'identity(3)', ''], ['linspace', 'linspace(0, 1, 11)', ''], ['v[i] ≔', 'v[i] := ', '', 'Vetor com variável de intervalo i']]],
      ['Operações', [['Mᵢ,ⱼ', '[i, j]', '', 'Elemento (índices começam em 0)'], ['Mᵀ', 'transpose(', ')'], ['M⁻¹', 'inv(', ')'], ['|M|', 'det(', ')'], ['a×b', 'cross(', ', b)'], ['a·b', 'dot(', ', b)'], ['autovalores', 'eigs(', ').values =']]],
      ['Montar', [['augment', 'augment(', ', b)'], ['stack', 'stack(', ', b)'], ['coluna', 'col(', ', j)'], ['linha', 'row(', ', i)'], ['rows', 'rows(', ')'], ['cols', 'cols(', ')']]]
    ] },
    { id: 'fun', label: 'Funções', groups: [
      ['Bessel', [['Jn', 'Jn(', ', x)'], ['Yn', 'Yn(', ', x)'], ['In', 'In(', ', x)'], ['Kn', 'Kn(', ', x)'], ['js', 'js(', ', x)', 'Bessel esférica'], ['ys', 'ys(', ', x)']]],
      ['Polinômios', [['Her', 'Her(', ', x)', 'Hermite'], ['Lag', 'Lag(', ', x)', 'Laguerre'], ['LagA', 'LagA(', ', α, x)', 'Laguerre associado'], ['Leg', 'Leg(', ', x)', 'Legendre'], ['Cheb', 'Cheb(', ', x)', 'Chebyshev']]],
      ['Especiais', [['Γ', 'gamma(', ')'], ['erf', 'erf(', ')'], ['erfc', 'erfc(', ')'], ['sinc', 'sinc(', ')']]],
      ['Trigonométricas', [['sin', 'sin(', ')'], ['cos', 'cos(', ')'], ['tan', 'tan(', ')'], ['asin', 'asin(', ')'], ['acos', 'acos(', ')'], ['atan', 'atan(', ')'], ['atan2', 'atan2(', ', x)'], ['sinh', 'sinh(', ')'], ['cosh', 'cosh(', ')'], ['tanh', 'tanh(', ')']]],
      ['Exp e log', [['exp', 'exp(', ')'], ['ln', 'ln(', ')'], ['log', 'log(', ')', 'Base 10, como no Mathcad'], ['log_b', 'log(', ', b)']]],
      ['Estatística', [['mean', 'mean(', ')'], ['median', 'median(', ')'], ['stdev', 'stdev(', ')', 'Desvio padrão populacional'], ['Stdev', 'Stdev(', ')', 'Desvio padrão amostral'], ['max', 'max(', ')'], ['min', 'min(', ')'], ['sum', 'sum(', ')']]],
      ['Dados', [['linterp', 'linterp(', ', vy, x)'], ['spline', 'spline(', ', vy, x)', 'Spline cúbica natural'], ['tabelaXYZ', 'Pg := tabelaXYZ(g, 0, 0.1, 10, 0, 0.1, 10)', '', 'Tabela x, y, g(x, y)']]]
    ] },
    { id: 'uni', label: 'Unidades e constantes', groups: [
      ['Constantes', [['c', 'c', '', 'Velocidade da luz'], ['h', 'h', '', 'Planck'], ['ħ', 'ħ', ''], ['k_B', 'k_B', '', 'Boltzmann'], ['ε₀', 'ε_0', ''], ['μ₀', 'μ_0', ''], ['q_e', 'q_e', '', 'Carga elementar'], ['m_e', 'm_e', '', 'Massa do elétron'], ['N_A', 'N_A', '']]],
      ['Unidades', [['nm', ' nm', ''], ['µm', ' µm', ''], ['mm', ' mm', ''], ['m', ' m', ''], ['fs', ' fs', ''], ['ns', ' ns', ''], ['s', ' s', ''], ['eV', ' eV', ''], ['J', ' J', ''], ['mW', ' mW', ''], ['W', ' W', ''], ['W/cm²', ' W/cm^2', ''], ['Hz', ' Hz', ''], ['THz', ' THz', ''], ['K', ' K', '']]],
      ['Converter', [['em eV', ' to eV =', '', 'Mostra o valor em eV'], ['em nm', ' to nm =', ''], ['em µm', ' to um =', '']]]
    ] },
    { id: 'opt', label: 'Óptica', groups: FC.uiExt.opticsGroups, extra: () => FC.uiExt.opticsExtra() },
    { id: 'graf', label: 'Gráficos', actions: true },
    { id: 'dad', label: 'Dados', actions: true },
    { id: 'tab', label: 'Tabelas', actions: true },
    { id: 'txt', label: 'Texto', actions: true },
    { id: 'arq', label: 'Arquivo', actions: true }
  ];
  const ACTIONS = {
    graf: () => [
      bigBtn('Gráfico XY', '<path d="M3 3v18h18"/><path d="M6 16l4-6 3 3 6-8"/>', () => addRegion('xy')),
      bigBtn('Mapa de calor', '<rect x="3" y="3" width="6" height="6"/><rect x="9" y="3" width="6" height="6" fill="currentColor" opacity=".4"/><rect x="15" y="3" width="6" height="6"/><rect x="3" y="9" width="6" height="6" fill="currentColor" opacity=".4"/><rect x="9" y="9" width="6" height="6" fill="currentColor"/><rect x="15" y="9" width="6" height="6" fill="currentColor" opacity=".4"/><rect x="3" y="15" width="6" height="6"/><rect x="9" y="15" width="6" height="6" fill="currentColor" opacity=".4"/><rect x="15" y="15" width="6" height="6"/>', () => addRegion('heat')),
      ...FC.uiExt.animRibbon(),
      bigBtn('Superfície 3D', '<path d="M2 16l9 5 11-6-9-5z"/><path d="M5 16c3 0 4-11 7-11s4 10 6 9"/>', () => addRegion('surf')),
      h('div', { class: 'sep' }),
      bigBtn('Meu estilo', '<path d="M4 20l4-1 11-11-3-3L5 16z"/><path d="M14 6l3 3"/>', openMyStyle),
      h('label', { class: 'presetSel' }, h('span', null, 'Estilo para novos gráficos'), (() => { const s = h('select', { onchange: (e) => { state.preset = e.target.value; markDirty(false); } }, ...Object.entries(FC.PRESETS).map(([k, p]) => h('option', { value: k, selected: state.preset === k ? 'selected' : null }, p.label))); return s; })())
    ],
    dad: () => FC.uiExt.ribbon(),
    tab: () => [
      bigBtn('Tabela de colunas', '<rect x="3" y="4" width="18" height="16" rx="1"/><path d="M3 9h18M9 4v16M15 4v16"/>', () => addRegion('table')),
      bigBtn('Tabela de matriz', '<rect x="3" y="4" width="18" height="16" rx="1"/><path d="M3 9h18M3 14h18M9 4v16M15 4v16"/>', () => addRegion('table', { mode: 'matrix' })),
      bigBtn('Inserir tabelaXYZ', '<path d="M4 6h16M4 12h16M4 18h16"/>', () => insertTool('Pg := tabelaXYZ(g, 0, 0.1, 10, 0, 0.1, 10)', ''))
    ],
    txt: () => FC.uiExt.textRibbon(),
    arq: () => [
      bigBtn('Novo', IC.file, newDoc), bigBtn('Abrir', IC.open, openDoc), bigBtn('Salvar', IC.save, saveDoc), bigBtn('Salvar como', IC.save, () => FC.uiExt.saveDocAs()),
      bigBtn('Exemplo', '<path d="M4 19V5l8 4 8-4v14l-8 4z"/>', () => FC.uiExt.newTab(FC.EXAMPLE())),
      h('div', { class: 'sep' }),
      bigBtn('Exportar Python', '<path d="M8 4h6a3 3 0 0 1 3 3v4H9a3 3 0 0 0-3 3v3H5a2 2 0 0 1-2-2v-4a3 3 0 0 1 3-3h7"/><path d="M16 20h-6a3 3 0 0 1-3-3v-1"/><circle cx="10" cy="6.5" r=".8" fill="currentColor"/>', () => exportCode('py')),
      bigBtn('Exportar Markdown', '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 15V9l2.5 3L12 9v6"/><path d="M16 9v6M14 13l2 2 2-2"/>', () => FC.uiExt.openMarkdown()),
      bigBtn('Exportar MATLAB', '<path d="M3 15l5-3 3 2 4-9 6 10-4 2-2-4-3 5z"/>', () => exportCode('m')),
      h('div', { class: 'sep' }),
      bigBtn('Ajuda', IC.help, () => openHelp())
    ]
  };
  function bigBtn(label, svg, fn) { const b = h('button', { class: 'tool big', onclick: fn }, icon(svg, 22), h('span', null, label)); b._help = { lab: label }; return b; }
  let curTab = 'mat';
  function buildRibbon() {
    const tabs = $('#tabs'); tabs.innerHTML = '';
    const ALL = FC.uiExt.allTools(TOOLS);
    if (!ALL.find((x) => x.id === curTab)) curTab = 'mat';
    for (const t of ALL) tabs.append(h('button', { class: 'tab' + (t.id === curTab ? ' on' : ''), role: 'tab', 'aria-selected': t.id === curTab ? 'true' : 'false', onclick: () => { curTab = t.id; buildRibbon(); } }, t.label));
    const row = $('#toolrow'); row.innerHTML = '';
    const t = ALL.find((x) => x.id === curTab);
    if (t.actions) { row.append(...ACTIONS[t.id]()); row.querySelectorAll('.tool.big').forEach((b) => { if (!b._help) b._help = { lab: b.textContent.trim() }; }); return; }
    for (const [gname, items] of t.groups) {
      const g = h('div', { class: 'tgroup' }, h('div', { class: 'tglabel' }, gname));
      const btns = h('div', { class: 'tgbtns' });
      for (const [lab, ins, post, tip, extra] of items) {
        const b = h('button', { class: 'tool', title: (tip || (ins + (post || '')).trim()) + ' — botão direito (ou toque longo): ajuda' }, lab);
        b._help = { lab, ins: ins + (post || ''), tip, extra };
        b.addEventListener('pointerdown', (e) => e.preventDefault()); // mantém o foco no editor
        b.addEventListener('click', () => insertTool(ins, post));
        btns.append(b);
      }
      g.append(btns); row.append(g);
    }
    if (t.extra) row.append(...t.extra());
    row.querySelectorAll('.tool.big').forEach((b) => { if (!b._help) b._help = { lab: b.textContent.trim() }; });
  }

  /* ---------- Arquivo ---------- */
  function exportCode(lang) {
    let r;
    try { r = FC.translate(Object.assign({}, state, { packs: FC.uiExt.activePacks() }), lang); } catch (e) { return toast('Não consegui exportar: ' + e.message); }
    const base = (state.name || 'folha').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w-]+/g, '_');
    const name = lang === 'py' ? base + '.py' : (r.fileName || base + '.m');
    saveFile(name, lang === 'py' ? 'text/x-python' : 'text/plain', r.text);
    if (r.warnings && r.warnings.length) setTimeout(() => toast('Exportado com avisos: ' + r.warnings.slice(0, 2).join(' · ')), 2700);
  }
  function confirmLose() { return !state.regions.length || window.confirm('Substituir a folha atual? Salve antes se quiser guardá-la.'); }
  function newDoc() { FC.uiExt.newTab(); }
  function saveDoc() { if (FC.uiExt.saveDoc) return FC.uiExt.saveDoc(); saveFile((state.name || 'folha').replace(/[^\wÀ-ú\-]+/g, '_') + '.fcalc', 'application/json', serialize()); state.dirty = false; }
  function openDoc() { if (FC.uiExt.openDoc) return FC.uiExt.openDoc(); $('#fileIn').click(); }
  FC.openText = (txt, fname) => { try { FC.uiExt.openInNewTab(JSON.parse(txt), fname); } catch (e) { toast('Não consegui abrir: ' + e.message); } };

  /* ---------- Meu estilo (preset do usuário) ---------- */
  const FONTS = [['Arial, Helvetica, sans-serif', 'Arial'], ['Helvetica, Arial, sans-serif', 'Helvetica'], ['"Times New Roman", Times, serif', 'Times New Roman'], ['Calibri, Carlito, Arial, sans-serif', 'Calibri'], ['"Computer Modern", "Latin Modern Roman", "CMU Serif", serif', 'Computer Modern']];
  function applyMyStyle(ms) {
    if (!ms) return;
    FC.PRESETS.mine = { label: 'Meu estilo · ' + (ms.name || 'personalizado') + ' (' + ms.wcm + ' cm)', w: ms.wcm / 2.54, ratio: ms.ratio, font: ms.pt, family: ms.family };
  }
  function openMyStyle() {
    const ms = Object.assign({ name: 'personalizado', wcm: 8.25, ratio: 0.74, pt: 8, family: FONTS[0][0] }, state.myStyle || {});
    const dlg = h('div', { class: 'dlg', role: 'dialog', 'aria-label': 'Meu estilo' });
    const close = () => wrap.remove();
    const num = (k, step) => { const e = h('input', { type: 'number', step: step, value: ms[k], inputmode: 'decimal' }); e.addEventListener('input', () => { ms[k] = Number(e.value); }); return e; };
    const txt = h('input', { type: 'text', value: ms.name }); txt.addEventListener('input', () => { ms.name = txt.value; });
    const fam = h('select', null, ...FONTS.map(([v, l]) => h('option', { value: v, selected: ms.family === v ? 'selected' : null }, l))); fam.addEventListener('change', () => { ms.family = fam.value; });
    dlg.append(
      h('div', { class: 'hhead' }, 'Meu estilo de figura', h('button', { class: 'ib', 'aria-label': 'Fechar', onclick: close }, icon('<path d="M6 6l12 12M18 6L6 18"/>'))),
      h('div', { class: 'dbody' },
        h('p', { class: 'hint' }, 'Vale para a exportação (SVG e PNG). Depois escolha “Meu estilo” no campo Estilo de revista de cada gráfico.'),
        h('div', { class: 'grid4' }, field('Nome', txt, 'span2'), field('Largura (cm)', num('wcm', '0.05')), field('Altura ÷ largura', num('ratio', '0.01'))),
        h('div', { class: 'grid4' }, field('Fonte', fam, 'span2'), field('Tamanho (pt)', num('pt', '0.5'))),
        h('div', { class: 'actions' },
          h('button', { class: 'btn', onclick: () => { state.myStyle = ms; applyMyStyle(ms); try { localStorage.setItem('fcalc.mystyle', JSON.stringify(ms)); } catch (e) { /* sem armazenamento */ } markDirty(false); buildRibbon(); close(); toast('Meu estilo salvo.'); } }, icon(IC.check, 16), 'Salvar estilo'),
          h('button', { class: 'btn', onclick: () => { state.preset = 'mine'; state.myStyle = ms; applyMyStyle(ms); markDirty(false); buildRibbon(); close(); toast('Novos gráficos usarão o seu estilo.'); } }, 'Salvar e usar nos novos gráficos'))));
    const wrap = h('div', { class: 'overlay', onclick: (e) => { if (e.target === wrap) close(); } }, dlg);
    document.body.append(wrap);
  }

  /* ---------- Ajuda ---------- */
  function openHelp() { $('#help').hidden = false; $('#help .hbody').scrollTop = 0; }

  /* ---------- Início ---------- */
  function init() {
    $('#ver').textContent = 'v' + VERSION;
    try { const ms = JSON.parse(localStorage.getItem('fcalc.mystyle') || 'null'); if (ms) { state.myStyle = ms; applyMyStyle(ms); } } catch (e) { /* sem armazenamento */ }
    FC.uiExt.loadLibrary();
    FC.uiExt.loadPacks();
    $('#stCancel').addEventListener('click', cancelCalc);
    buildRibbon();
    $('#docName').addEventListener('input', (e) => { state.name = e.target.value; markDirty(false); });
    $('#fileIn').addEventListener('change', (e) => {
      const f = e.target.files[0]; if (!f) return;
      const rd = new FileReader(); rd.onload = () => FC.openText(rd.result, f.name); rd.readAsText(f); e.target.value = '';
    });
    $('#hdrSave').addEventListener('click', saveDoc);
    $('#hdrOpen').addEventListener('click', openDoc);
    $('#hdrSaveAs').addEventListener('click', () => FC.uiExt.saveDocAs());
    setTimeout(() => FC.uiExt.showLinked && FC.uiExt.showLinked(), 500);
    $('#hdrHelp').addEventListener('click', openHelp);
    $('#help .close').addEventListener('click', () => { $('#help').hidden = true; });
    document.querySelectorAll('[data-add]').forEach((b) => b.addEventListener('click', () => addRegion(b.dataset.add)));
    document.addEventListener('pointerdown', (e) => {
      if (state.editing && !e.target.closest('.region.editing') && !e.target.closest('.ribbon') && !e.target.closest('.addbar') && !e.target.closest('.status') && !e.target.closest('#toast') && !e.target.closest('.hb-edit') && !e.target.closest('.tip-pop')) stopEdit();
    });
    FC.uiExt.docsInit();
    window.addEventListener('beforeunload', autosave);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') autosave(); });
  }
  FC.init = init;
  FC._ui = { live: requestLive, h, $, icon, IC, field, inp, sel, markDirty, saveFile, toast, esc, kt, splitList, originText, state, presetOpts, exportFig, toggleForm, fileBase, addRegion, renderOutput, copyText, bigBtn, insertTool, buildRibbon, recalc, select, TYPE_LABEL, insertRegions, DEFAULTS, serialize, texOf, load, buildSheet, stopEdit, insertAt, startEdit, kt };
  FC.flush = () => { autosave(); return true; };
  FC.back = () => {
    const tp = document.querySelector('.tip-pop'); if (tp) { tp.remove(); return true; }
    const ov = document.querySelector('.overlay'); if (ov) { ov.remove(); return true; }
    if (!$('#help').hidden) { $('#help').hidden = true; return true; }
    if (state.editing) { stopEdit(); return true; }
    const f = document.querySelector('.form:not([hidden])');
    if (f) { f.hidden = true; return true; }
    return false;
  };
  FC.TOOLS = TOOLS;
})();
