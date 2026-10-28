/* Folha de Cálculo — gráficos (Plotly) com presets de revista */
'use strict';
(function () {
  const FC = window.FC;
  const M = FC.M;

  const PRESETS = {
    acs1: { label: 'ACS · 1 coluna (8,25 cm)', w: 3.25, ratio: 0.74, font: 8, family: 'Arial, Helvetica, sans-serif' },
    acs2: { label: 'ACS · 2 colunas (17,8 cm)', w: 7.0, ratio: 0.45, font: 8, family: 'Arial, Helvetica, sans-serif' },
    aps1: { label: 'APS (PRL, PRA, PRB…) · 1 coluna (8,6 cm)', w: 3.375, ratio: 0.74, font: 8, family: '"Times New Roman", Times, serif' },
    aps2: { label: 'APS (PRL, PRA, PRB…) · 2 colunas (17,8 cm)', w: 7.0, ratio: 0.45, font: 8, family: '"Times New Roman", Times, serif' },
    nat1: { label: 'Nature · 1 coluna (89 mm)', w: 89 / 25.4, ratio: 0.75, font: 7, family: 'Arial, Helvetica, sans-serif' },
    nat2: { label: 'Nature · 2 colunas (183 mm)', w: 183 / 25.4, ratio: 0.42, font: 7, family: 'Arial, Helvetica, sans-serif' },
    sci1: { label: 'Science · 1 coluna (5,7 cm)', w: 5.7 / 2.54, ratio: 0.85, font: 7, family: 'Helvetica, Arial, sans-serif' },
    sci2: { label: 'Science · 2 colunas (12,1 cm)', w: 12.1 / 2.54, ratio: 0.55, font: 7, family: 'Helvetica, Arial, sans-serif' },
    els1: { label: 'Elsevier · 1 coluna (90 mm)', w: 90 / 25.4, ratio: 0.75, font: 8, family: 'Arial, Helvetica, sans-serif' },
    els15: { label: 'Elsevier · 1,5 coluna (140 mm)', w: 140 / 25.4, ratio: 0.6, font: 8, family: 'Arial, Helvetica, sans-serif' },
    els2: { label: 'Elsevier · 2 colunas (190 mm)', w: 190 / 25.4, ratio: 0.42, font: 8, family: 'Arial, Helvetica, sans-serif' },
    rsc1: { label: 'RSC · 1 coluna (8,3 cm)', w: 8.3 / 2.54, ratio: 0.75, font: 7, family: 'Arial, Helvetica, sans-serif' },
    rsc2: { label: 'RSC · 2 colunas (17,1 cm)', w: 17.1 / 2.54, ratio: 0.45, font: 7, family: 'Arial, Helvetica, sans-serif' },
    spr1: { label: 'Springer · 1 coluna (84 mm)', w: 84 / 25.4, ratio: 0.75, font: 8, family: 'Arial, Helvetica, sans-serif' },
    spr2: { label: 'Springer · 2 colunas (174 mm)', w: 174 / 25.4, ratio: 0.45, font: 8, family: 'Arial, Helvetica, sans-serif' },
    tese: { label: 'Tese / relatório (15 cm)', w: 15 / 2.54, ratio: 0.62, font: 10, family: '"Times New Roman", Times, serif' },
    slide: { label: 'Apresentação (16:9)', w: 10, ratio: 0.5625, font: 18, family: 'Arial, Helvetica, sans-serif' }
  };
  FC.PRESETS = PRESETS;
  const PALETTE = ['#1F5FAE', '#D9822B', '#2E8B57', '#B03A2E', '#7B4FA0', '#3A3A3A', '#1A9E9E', '#C2408F'];
  FC.PALETTE = PALETTE;
  const COLORSCALES = { Viridis: 'Viridis', Cividis: 'Cividis', Inferno: 'Hot', 'Azul–vermelho (divergente)': 'RdBu', Cinza: 'Greys', Jet: 'Jet' };
  FC.COLORSCALES = COLORSCALES;

  /* Rótulos: λ_OT → λ<sub>OT</sub>, x^2 → x<sup>2</sup> */
  function label(s) {
    if (!s) return '';
    let t = (FC.texNamesToChars ? FC.texNamesToChars(String(s)) : String(s)).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    t = t.replace(/_\{([^}]*)\}/g, '<sub>$1</sub>').replace(/_([A-Za-z0-9α-ωΑ-Ω]+)/g, '<sub>$1</sub>');
    t = t.replace(/\^\{([^}]*)\}/g, '<sup>$1</sup>').replace(/\^(-?[A-Za-z0-9α-ωΑ-Ω]+)/g, '<sup>$1</sup>');
    return t;
  }
  FC.plotLabel = label;

  /* formato dos números dos eixos: auto, decimal (n casas), científico, potência de 10, prefixos SI */
  function tickFmt(a, fmt, dec, step, log) {
    const n = String(dec ?? '').trim() === '' ? null : Math.max(0, Math.min(8, Math.round(Number(dec))));
    if (fmt === 'dec') { a.tickformat = n == null ? '~r' : '.' + n + 'f'; a.exponentformat = 'none'; }
    else if (fmt === 'sci') { a.tickformat = n == null ? '.1e' : '.' + n + 'e'; }
    else if (fmt === 'pow') { a.exponentformat = 'power'; a.showexponent = 'all'; }
    else if (fmt === 'si') { a.exponentformat = 'SI'; a.tickformat = n == null ? '~s' : '.' + Math.max(1, n) + 's'; }
    else if (n != null) a.tickformat = '.' + n + 'f';
    const st = Number(step);
    if (String(step ?? '').trim() !== '' && isFinite(st) && st > 0) { a.dtick = log ? Math.log10(st) || 1 : st; a.tick0 = 0; }
  }
  FC.tickFmt = tickFmt;
  function axis(title, opt, fontPx) {
    const a = {
      title: { text: label(title), standoff: 6 },
      type: opt.log ? 'log' : 'linear',
      showline: true, linecolor: '#000', linewidth: 1, mirror: 'ticks',
      ticks: 'inside', ticklen: Math.max(3, fontPx * 0.4), tickwidth: 1, tickcolor: '#000',
      minor: { ticks: 'inside', ticklen: Math.max(2, fontPx * 0.22), tickcolor: '#000', showgrid: false },
      showgrid: false, zeroline: false, automargin: true, exponentformat: 'power'
    };
    tickFmt(a, opt.fmt, opt.dec, opt.step, opt.log);
    if (opt.minor === false || opt.minor === 'false') a.minor = { ticks: '' };
    const lo = Number(opt.min), hi = Number(opt.max);
    if (opt.min !== '' && opt.min != null && opt.max !== '' && opt.max != null && isFinite(lo) && isFinite(hi)) {
      a.range = opt.log ? [Math.log10(lo), Math.log10(hi)] : [lo, hi];
      a.autorange = false;
    }
    return a;
  }
  const LEGEND_POS = {
    'sup-esq': { x: 0.02, y: 0.98, xanchor: 'left', yanchor: 'top' },
    'sup-dir': { x: 0.98, y: 0.98, xanchor: 'right', yanchor: 'top' },
    'inf-esq': { x: 0.02, y: 0.02, xanchor: 'left', yanchor: 'bottom' },
    'inf-dir': { x: 0.98, y: 0.02, xanchor: 'right', yanchor: 'bottom' },
    fora: { x: 1.02, y: 1, xanchor: 'left', yanchor: 'top' }
  };

  function baseLayout(r, exp) {
    const p = PRESETS[r.preset] || PRESETS.acs1;
    const fontPx = exp ? (p.font * 96) / 72 : 13;
    return {
      fontPx,
      layout: {
        font: { family: p.family, size: fontPx, color: '#000' },
        paper_bgcolor: '#fff', plot_bgcolor: '#fff',
        margin: exp ? { l: 8, r: 8, t: 8, b: 8 } : { l: 10, r: 14, t: 14, b: 10 },
        showlegend: false,
        separators: r.comma ? ',.' : '.,'
      },
      p
    };
  }

  /* ---------- Cálculo dos dados ---------- */
  function xValues(S, r, nDefault) {
    const rv = S.values(r.xvar);
    const hasLim = String(r.xmin || '').trim() !== '' && String(r.xmax || '').trim() !== '';
    if (rv && !hasLim) return rv.map(FC.num);
    if (!hasLim) throw new Error('Defina “' + r.xvar + '” como variável de intervalo acima (ex.: ' + r.xvar + ' := 0, 0.1 .. 10) ou preencha mínimo e máximo do eixo.');
    const a = S.evalScalar(r.xmin), b = S.evalScalar(r.xmax), n = Math.max(2, Math.round(Number(r.npts) || nDefault));
    if (!isFinite(a) || !isFinite(b)) throw new Error('Limites do eixo inválidos.');
    const out = [];
    for (let k = 0; k < n; k++) out.push(r.xlog && a > 0 && b > 0 ? a * Math.pow(b / a, k / (n - 1)) : a + ((b - a) * k) / (n - 1));
    return out;
  }
  function gridValues(S, varName, min, max, n) {
    const rv = S.values(varName);
    const hasLim = String(min || '').trim() !== '' && String(max || '').trim() !== '';
    if (rv && !hasLim) return rv.map(FC.num);
    if (!hasLim) throw new Error('Preencha mínimo e máximo de “' + varName + '” ou defina-o como variável de intervalo.');
    const a = S.evalScalar(min), b = S.evalScalar(max), N = Math.max(2, Math.round(Number(n) || 101));
    const out = [];
    for (let k = 0; k < N; k++) out.push(a + ((b - a) * k) / (N - 1));
    return out;
  }
  const withDiv = (e, dv) => (String(dv || '').trim() ? '(' + e + ')/(' + dv + ')' : e);
  const finiteMax = (ys) => { let m = 0; for (const y of ys) if (isFinite(y) && Math.abs(y) > m) m = Math.abs(y); return m; };
  function computeXY(S, r) {
    let xs = null;
    const getXs = () => xs || (xs = xValues(S, r, 400));
    const traces = [];
    r.traces.forEach((t, idx) => {
      if (!String(t.expr || '').trim()) return;
      const kind = t.kind || 'func';
      const nm = '“' + (t.name || t.expr) + '”';
      try {
        if (kind === 'data') {
          // dados: vetores x e y (ex.: DADO[0] e DADO[1])
          const X = FC.flatNums(S.evalNode(FC.parse(FC.normalize(t.xexpr || ''))));
          const Y = FC.flatNums(S.evalNode(FC.parse(FC.normalize(withDiv(t.expr, t.div)))));
          if (X.length !== Y.length) throw new Error('x tem ' + X.length + ' valores e y tem ' + Y.length + '.');
          traces.push({ t, xs: X, ys: Y, idx });
        } else if (kind === 'param') {
          // paramétrica: x(p) e y(p) com o parâmetro p num intervalo próprio
          const pv = String(t.pvar || 't').trim();
          const a = S.evalScalar(t.pmin), b = S.evalScalar(t.pmax), n = Math.max(2, Math.round(Number(t.pn) || 300));
          if (!isFinite(a) || !isFinite(b)) throw new Error('preencha o intervalo de ' + pv + '.');
          const cx = S.compileExpr(t.xexpr || ''), cy = S.compileExpr(withDiv(t.expr, t.div));
          const ov = new FC.Overlay(S.scope), X = [], Y = [];
          for (let k = 0; k < n; k++) {
            const v = t.plog && a > 0 && b > 0 ? a * Math.pow(b / a, k / (n - 1)) : a + ((b - a) * k) / (n - 1);
            ov.set(pv, v); X.push(FC.num(cx.evaluate(ov))); Y.push(FC.num(cy.evaluate(ov)));
          }
          traces.push({ t, xs: X, ys: Y, idx });
        } else if (t.xown) {
          // eixo x próprio: variável, intervalo e número de pontos desta curva
          const tv = String(t.txvar || r.xvar || 'x').trim();
          const has = (v) => String(v ?? '').trim() !== '';
          const top = t.txpos === 'top';
          const a = S.evalScalar(has(t.txmin) ? t.txmin : (has(r.xmin) ? r.xmin : NaN)), b = S.evalScalar(has(t.txmax) ? t.txmax : (has(r.xmax) ? r.xmax : NaN));
          if (!isFinite(a) || !isFinite(b)) throw new Error('preencha mínimo e máximo de ' + tv + ' (eixo x próprio da curva).');
          const n = Math.max(2, Math.round(Number(t.tn) || Number(r.npts) || 400));
          const lg = (top ? r.x2log : r.xlog) && a > 0 && b > 0;
          const code = S.compileExpr(withDiv(t.expr, t.div));
          const ov = new FC.Overlay(S.scope), X = [], Y = [];
          for (let k = 0; k < n; k++) { const v = lg ? a * Math.pow(b / a, k / (n - 1)) : a + ((b - a) * k) / (n - 1); ov.set(tv, v); X.push(v); Y.push(FC.num(code.evaluate(ov))); }
          traces.push({ t, xs: X, ys: Y, idx });
        } else {
          const code = S.compileExpr(withDiv(t.expr, t.div));
          const ov = new FC.Overlay(S.scope);
          const ys = getXs().map((x) => { ov.set(r.xvar, x); return FC.num(code.evaluate(ov)); });
          traces.push({ t, ys, idx });
        }
        traces[traces.length - 1].top = t.txpos === 'top';
      } catch (e) { throw new Error('Curva ' + nm + ': ' + FC.ptError(e)); }
    });
    // normalização (como no Origin)
    if (r.norm === 'each') for (const tr of traces) { const m = finiteMax(tr.ys); if (m > 0) tr.ys = tr.ys.map((y) => y / m); }
    else if (r.norm === 'common' && traces.length) {
      let ref = NaN;
      if (r.normRef === 'value') ref = S.evalScalar(r.normVal);
      else if (r.normRef === 'curve') { const k = Math.max(1, Math.round(Number(r.normCurve) || 1)); const tr = traces.find((q) => q.idx === k - 1) || traces[0]; ref = finiteMax(tr.ys); }
      else ref = Math.max(...traces.map((q) => finiteMax(q.ys)));
      if (!isFinite(ref) || ref === 0) throw new Error('Valor de normalização inválido (' + ref + ').');
      for (const tr of traces) tr.ys = tr.ys.map((y) => y / ref);
    }
    let mainXs = xs || (traces.some((q) => !q.xs) ? getXs() : []);
    // dividir o eixo x por uma constante (ex.: nm → µm, ou E/E_0)
    const dv = (e) => { if (!String(e ?? '').trim()) return 1; const v = S.evalScalar(e); if (!isFinite(v) || v === 0) throw new Error('Divisor do eixo x inválido (' + e + ').'); return v; };
    const d1 = dv(r.xdv), d2 = dv(r.x2dv);
    if (d1 !== 1) mainXs = mainXs.map((x) => x / d1);
    for (const tr of traces) if (tr.xs) { const k = tr.top ? d2 : d1; if (k !== 1) tr.xs = tr.xs.map((x) => x / k); }
    return { xs: mainXs, traces };
  }
  // expressão que já é uma matriz (ex.: intensidade de um campo da óptica de Fourier)
  function matrixGrid(S, r) {
    let node; try { node = FC.parse(FC.normalize(r.expr)); } catch (e) { return null; }
    let usesXY = false;
    node.traverse((n) => { if (n.isSymbolNode && (n.name === r.xvar || n.name === r.yvar)) usesXY = true; });
    if (usesXY) return null;
    const v = S.compileExpr(r.expr).evaluate(new FC.Overlay(S.scope));
    const a = FC.M.isMatrix(v) ? v.toArray() : v;
    if (!Array.isArray(a) || !Array.isArray(a[0])) return null;
    const z = a.map((row) => row.map((q) => (FC.M.isComplex(q) ? FC.M.abs(q) : FC.num(q))));
    const lin = (min, max, n) => {
      const has = String(min || '').trim() !== '' && String(max || '').trim() !== '';
      const lo = has ? S.evalScalar(min) : 0, hi = has ? S.evalScalar(max) : n - 1;
      const o = []; for (let k = 0; k < n; k++) o.push(lo + ((hi - lo) * k) / Math.max(1, n - 1)); return o;
    };
    return { xs: lin(r.xmin, r.xmax, z[0].length), ys: lin(r.ymin, r.ymax, z.length), z, matrix: true };
  }
  function normGrid(S, r, d) {
    if (r.znorm === 'max') { let m = 0; for (const row of d.z) for (const v of row) if (isFinite(v) && Math.abs(v) > m) m = Math.abs(v); if (m > 0) d.z = d.z.map((row) => row.map((v) => v / m)); }
    else if (r.znorm === 'value') { const ref = S.evalScalar(r.znormVal); if (!isFinite(ref) || !ref) throw new Error('Valor de normalização inválido.'); d.z = d.z.map((row) => row.map((v) => v / ref)); }
    return d;
  }
  function computeGrid(S, r) {
    if (String(r.zdiv || '').trim()) r = Object.assign({}, r, { expr: withDiv(r.expr, r.zdiv) });
    const d = normGrid(S, r, computeGrid0(S, r));
    for (const [k, e] of [['xs', r.xdv], ['ys', r.ydv]]) {
      if (!String(e ?? '').trim()) continue;
      const v = S.evalScalar(e);
      if (!isFinite(v) || v === 0) throw new Error('Divisor do eixo ' + k[0] + ' inválido (' + e + ').');
      d[k] = d[k].map((q) => q / v);
    }
    return d;
  }
  function computeGrid0(S, r) {
    const mg = matrixGrid(S, r);
    if (mg) return mg;
    const xs = gridValues(S, r.xvar, r.xmin, r.xmax, r.nx);
    const ys = gridValues(S, r.yvar, r.ymin, r.ymax, r.ny);
    if (xs.length * ys.length > 400000) throw new Error('Grade grande demais (' + xs.length + ' × ' + ys.length + ').');
    const code = S.compileExpr(r.expr);
    const ov = new FC.Overlay(S.scope);
    const z = [];
    for (const y of ys) {
      ov.set(r.yvar, y);
      const row = [];
      for (const x of xs) { ov.set(r.xvar, x); row.push(FC.num(code.evaluate(ov))); }
      z.push(row);
    }
    return { xs, ys, z };
  }
  FC.computePlot = function (S, r) {
    if (r.type === 'xy') return computeXY(S, r);
    return computeGrid(S, r);
  };

  /* ---------- Figuras ---------- */
  function figXY(r, d, exp) {
    const { layout, fontPx } = baseLayout(r, exp);
    const data = d.traces.map(({ t, ys, xs, idx, top }, i) => ({
      xaxis: top ? 'x2' : 'x',
      type: 'scatter', mode: t.marker && t.marker !== 'none' ? (t.lines === false ? 'markers' : 'lines+markers') : 'lines',
      x: xs || d.xs, y: ys, name: label(t.name || t.expr), meta: idx == null ? i : idx, showlegend: !t.hideLeg,
      line: { color: t.color || PALETTE[i % PALETTE.length], width: Number(t.width) || 1.5, dash: t.dash || 'solid', shape: 'linear' },
      marker: { symbol: t.marker && t.marker !== 'none' ? t.marker : 'circle', size: (exp ? 4 : 6), color: t.color || PALETTE[i % PALETTE.length] }
    }));
    layout.xaxis = axis(r.xlabel || r.param || '', { log: r.xlog, min: r.xlo, max: r.xhi, fmt: r.xfmt, dec: r.xdec, step: r.xstep, minor: r.minor }, fontPx);
    layout.yaxis = axis(r.ylabel, { log: r.ylog, min: r.ymin, max: r.ymax, fmt: r.yfmt, dec: r.ydec, step: r.ystep, minor: r.minor }, fontPx);
    if (d.traces.some((q) => q.top)) {
      // eixo x superior independente (outra variável, outra escala)
      layout.xaxis2 = Object.assign(axis(r.x2label || '', { log: r.x2log, min: r.x2lo, max: r.x2hi, fmt: r.x2fmt, dec: r.x2dec, step: r.x2step, minor: r.minor }, fontPx), { overlaying: 'x', side: 'top', anchor: 'y', mirror: false });
      layout.xaxis.mirror = false;
    }
    if (r.legend && r.legend !== 'nao' && data.some((q) => q.showlegend)) {
      layout.showlegend = true;
      const pos = r.legend === 'manual' ? { x: Number(r.legX ?? 0.02), y: Number(r.legY ?? 0.98), xanchor: 'left', yanchor: 'top' } : (LEGEND_POS[r.legend] || LEGEND_POS['sup-esq']);
      layout.legend = Object.assign({ bgcolor: r.legBox ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0)', bordercolor: '#000', borderwidth: r.legBox ? 0.6 : 0, font: { size: fontPx * (Number(r.legSize) || 0.95) }, orientation: r.legHoriz ? 'h' : 'v' }, pos);
    }
    if (r.panel) layout.annotations = [{ text: '<b>' + label(r.panel) + '</b>', xref: 'paper', yref: 'paper', x: Number(r.panelX ?? 0.98), y: Number(r.panelY ?? 0.04), xanchor: r.panelX != null ? 'left' : 'right', yanchor: 'bottom', showarrow: false, font: { size: fontPx * 1.1 } }];
    return { data, layout };
  }
  function zRange(r) {
    const lo = Number(r.zmin), hi = Number(r.zmax);
    const has = String(r.zmin ?? '').trim() !== '' && String(r.zmax ?? '').trim() !== '' && isFinite(lo) && isFinite(hi);
    return has ? { zmin: lo, zmax: hi, zauto: false } : {};
  }
  function figHeat(r, d, exp) {
    const { layout, fontPx } = baseLayout(r, exp);
    const cs = COLORSCALES[r.colorscale] || 'Viridis';
    const cb = { title: { text: label(r.zlabel), side: 'right' }, outlinewidth: 1, outlinecolor: '#000', ticks: 'inside', ticklen: 3, tickcolor: '#000', thickness: exp ? 10 : 16, len: 1, exponentformat: 'power' };
    const data = [Object.assign({ type: 'heatmap', x: d.xs, y: d.ys, z: d.z, colorscale: cs, reversescale: !!r.reverse, colorbar: cb, hovertemplate: 'x=%{x}<br>y=%{y}<br>z=%{z}<extra></extra>' }, zRange(r))];
    if (r.contours) {
      data.push(Object.assign({ type: 'contour', x: d.xs, y: d.ys, z: d.z, showscale: false, hoverinfo: 'skip', ncontours: Number(r.ncont) || 10, contours: { coloring: 'none' }, line: { color: 'rgba(255,255,255,0.75)', width: exp ? 0.6 : 1 } }, zRange(r)));
    }
    if (r.minima) {
      const mx = [], my = [];
      d.z.forEach((row, j) => { for (let i = 1; i < row.length - 1; i++) if (row[i] < row[i - 1] && row[i] <= row[i + 1]) { mx.push(d.xs[i]); my.push(d.ys[j]); } });
      data.push({ type: 'scatter', mode: 'markers', x: mx, y: my, name: 'mínimos', marker: { size: exp ? 2.2 : 3.5, color: '#F4A259' }, hovertemplate: 'mínimo<br>x=%{x}<br>y=%{y}<extra></extra>', showlegend: false });
    }
    layout.xaxis = axis(r.xlabel, { min: r.xlo, max: r.xhi, fmt: r.xfmt, dec: r.xdec, step: r.xstep }, fontPx);
    layout.yaxis = axis(r.ylabel, { min: r.ylo, max: r.yhi, fmt: r.yfmt, dec: r.ydec, step: r.ystep }, fontPx);
    tickFmt(cb, r.zfmt, r.zdec, '', false);
    layout.xaxis.mirror = 'ticks'; layout.yaxis.mirror = 'ticks';
    if (r.panel) layout.annotations = [{ text: '<b>' + label(r.panel) + '</b>', xref: 'paper', yref: 'paper', x: 0.03, y: 0.97, xanchor: 'left', yanchor: 'top', showarrow: false, font: { size: fontPx * 1.1, color: '#fff' } }];
    return { data, layout };
  }
  function figSurf(r, d, exp) {
    const { layout, fontPx } = baseLayout(r, exp);
    const cs = COLORSCALES[r.colorscale] || 'Viridis';
    const data = [Object.assign({ type: 'surface', x: d.xs, y: d.ys, z: d.z, colorscale: cs, reversescale: !!r.reverse, showscale: !!r.colorbar, colorbar: { title: { text: label(r.zlabel) }, thickness: 12, outlinewidth: 1 },
      contours: { z: { show: !!r.contours, usecolormap: true, project: { z: false } } }, lighting: { ambient: 0.75, diffuse: 0.6, specular: 0.15, roughness: 0.7 } }, zRange(r))];
    const ax = (t) => ({ title: { text: label(t) }, showbackground: true, backgroundcolor: '#f6f7f9', gridcolor: '#cfd5dc', linecolor: '#000', ticks: 'outside', tickcolor: '#000', exponentformat: 'power' });
    layout.scene = { xaxis: ax(r.xlabel), yaxis: ax(r.ylabel), zaxis: ax(r.zlabel), camera: r.camera || { eye: { x: 1.65, y: -1.65, z: 1.1 } }, aspectmode: 'manual', aspectratio: { x: 1, y: 1, z: 0.7 } };
    layout.margin = { l: 0, r: 0, t: 0, b: 0 };
    return { data, layout };
  }
  function figFit(r, d, exp) {
    const { layout, fontPx } = baseLayout(r, exp);
    const ord = d.allX.map((x, i) => [x, d.yAll[i]]).sort((a, b) => a[0] - b[0]);
    // resíduo com quebra nas lacunas do domínio Ω
    const gaps = d.xs.slice(1).map((x, i) => x - d.xs[i]).sort((a, b) => a - b);
    const med = gaps.length ? gaps[gaps.length >> 1] : 0;
    const rx = [], ry = [];
    d.xs.forEach((x, i) => { if (i && med && x - d.xs[i - 1] > 2.5 * med) { rx.push(null); ry.push(null); } rx.push(x); ry.push(d.ym[i] - d.ye[i]); });
    const data = [
      { type: 'scatter', mode: 'markers', x: d.x, y: d.y, name: 'dados', marker: { size: exp ? 3 : 5, color: 'rgba(40,46,56,0.55)', symbol: 'circle-open' }, xaxis: 'x', yaxis: 'y' },
      { type: 'scatter', mode: 'lines', x: ord.map((p) => p[0]), y: ord.map((p) => p[1]), name: 'modelo', line: { color: r.color || '#1F5FAE', width: exp ? 1.2 : 2 }, xaxis: 'x', yaxis: 'y' },
      { type: 'scatter', mode: 'lines', x: rx, y: ry, name: 'resíduo', connectgaps: false, line: { color: '#B03A2E', width: exp ? 0.8 : 1.2 }, xaxis: 'x', yaxis: 'y2', showlegend: false },
      { type: 'scatter', mode: 'lines', x: [d.xs[0], d.xs[d.xs.length - 1]], y: [0, 0], line: { color: '#888', width: 0.6, dash: 'dot' }, xaxis: 'x', yaxis: 'y2', hoverinfo: 'skip', showlegend: false }
    ];
    layout.xaxis = Object.assign(axis(r.xlabel, {}, fontPx), { anchor: 'y2' });
    layout.yaxis = Object.assign(axis(r.ylabel, {}, fontPx), { domain: [0.34, 1] });
    layout.yaxis2 = Object.assign(axis('resíduo', {}, fontPx), { domain: [0, 0.24], zeroline: false });
    layout.xaxis.mirror = 'ticks';
    layout.showlegend = true;
    layout.legend = Object.assign({ bgcolor: 'rgba(255,255,255,0)', font: { size: fontPx * 0.95 } }, LEGEND_POS['sup-dir']);
    return { data, layout };
  }
  function figure(r, d, exp) {
    const f = figure0(r, d, exp);
    if (r.frameLabel) {
      const fontPx = exp ? ((FC.PRESETS[r.preset] || FC.PRESETS.acs1).font * 96) / 72 : 13;
      const dark = r.type === 'heat';
      f.layout.annotations = (f.layout.annotations || []).concat([{ text: label(r.frameLabel), xref: 'paper', yref: 'paper', x: 0.98, y: 0.97, xanchor: 'right', yanchor: 'top', showarrow: false,
        font: { size: fontPx * 1.05, color: dark ? '#fff' : '#000' }, bgcolor: dark ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.75)', borderpad: 2 }]);
    }
    return f;
  }
  function figure0(r, d, exp) {
    if (r.type === 'xy' || r.type === 'sweep') return figXY(r, d, exp);
    if (r.type === 'fit') return figFit(r, d, exp);
    if (r.type === 'heat') return figHeat(r, d, exp);
    return figSurf(r, d, exp);
  }
  FC.figure = figure;

  const CONFIG = { displaylogo: false, responsive: true, displayModeBar: false, scrollZoom: false, doubleClick: 'reset' };
  const CONFIG_EDIT = Object.assign({}, CONFIG, { edits: { legendPosition: true, legendText: true, annotationPosition: true, axisTitleText: true } });
  FC.drawPlot = function (div, r, d) {
    const f = figure(r, d, false);
    const H = r.type === 'surf' || r.type === 'fit' ? 380 : 320;
    f.layout.height = H;
    f.layout.autosize = true;
    const editable = (r.type === 'xy' || r.type === 'heat') && !r.frameLabel;
    return Plotly.react(div, f.data, f.layout, editable ? CONFIG_EDIT : CONFIG).then(() => {
      if (editable && !div._editHook) {
        div._editHook = true;
        div.on('plotly_relayout', (ev) => {
          const rr = div._region; if (!rr || !ev) return;
          let ch = false;
          if (ev['legend.x'] != null) { rr.legend = 'manual'; rr.legX = +(+ev['legend.x']).toFixed(3); rr.legY = +(+ev['legend.y']).toFixed(3); ch = true; }
          if (ev['annotations[0].x'] != null) { rr.panelX = +(+ev['annotations[0].x']).toFixed(3); rr.panelY = +(+ev['annotations[0].y']).toFixed(3); ch = true; }
          if (ev['xaxis.title.text'] != null) { rr.xlabel = ev['xaxis.title.text']; ch = true; }
          if (ev['xaxis2.title.text'] != null) { rr.x2label = ev['xaxis2.title.text']; ch = true; }
          if (ev['yaxis.title.text'] != null) { rr.ylabel = ev['yaxis.title.text']; ch = true; }
          if (ch && FC.markDirty) FC.markDirty(false);
        });
        div.on('plotly_restyle', (ev) => {
          const rr = div._region; if (!rr || !ev || !ev[0] || ev[0].name == null) return;
          const k = (ev[1] || [])[0]; const tr = div.data && div.data[k];
          const ti = tr && tr.meta != null ? tr.meta : k;
          if (rr.traces && rr.traces[ti]) { rr.traces[ti].name = String(Array.isArray(ev[0].name) ? ev[0].name[0] : ev[0].name).replace(/<\/?su[bp]>/g, ''); if (FC.markDirty) FC.markDirty(false); }
        });
      }
      div._region = r;
      if (r.type === 'surf' && !div._camHook) {
        div._camHook = true;
        div.on('plotly_relayout', (ev) => { if (ev && ev['scene.camera']) { r.camera = ev['scene.camera']; FC.markDirty && FC.markDirty(false); } });
      }
    });
  };

  /* Exporta a figura no tamanho do preset */
  FC.exportFigure = async function (r, d, fmt) {
    const p = PRESETS[r.preset] || PRESETS.acs1;
    const f = figure(r, d, true);
    const w = Math.round(p.w * 96), h = Math.round(p.w * p.ratio * 96);
    f.layout.width = w; f.layout.height = h;
    const scale = fmt === 'png' ? (r.type === 'surf' ? 3 : 600 / 96) : 1;
    const div = document.createElement('div');
    div.style.cssText = 'position:fixed;left:-10000px;top:0;width:' + w + 'px;height:' + h + 'px';
    document.body.appendChild(div);
    try {
      await Plotly.newPlot(div, f.data, f.layout, { staticPlot: true });
      return await Plotly.toImage(div, { format: fmt, width: w, height: h, scale });
    } finally { Plotly.purge(div); div.remove(); }
  };
})();
