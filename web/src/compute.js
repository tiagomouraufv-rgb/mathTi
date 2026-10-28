/* Folha de Cálculo — cálculo de uma folha inteira (usado no Worker e, se ele faltar, na página) */
'use strict';
(function () {
  const FC = window.FC;

  function computeTable(S, r) {
    if (r.mode === 'matrix') {
      const v = S.evalNode(FC.parse(FC.normalize(r.matrix)));
      let a = FC.toArr(v);
      if (!Array.isArray(a[0])) a = a.map((e) => [e]);
      return a.map((row) => row.map(FC.num));
    }
    const exprs = String(r.cols || '').split('\n').map((s) => s.trim()).filter(Boolean);
    if (!exprs.length) throw new Error('Escreva uma expressão por linha, ex.: x, f(x), g(x, 2).');
    const colsV = exprs.map((e) => { try { return FC.flatNums(S.evalNode(FC.parse(FC.normalize(e)))); } catch (err) { throw new Error('Coluna “' + e + '”: ' + FC.ptError(err)); } });
    const n = Math.max(...colsV.map((c) => c.length));
    const out = [];
    for (let i = 0; i < n; i++) out.push(colsV.map((c) => (c.length === 1 ? c[0] : c[i])));
    return out;
  }
  const cleanLine = (L) => { const o = {}; for (const k of ['kind', 'tex', 'res', 'err', 'note', 'raw', 'text', 'lines', 'name', 'desc']) if (L[k] != null) o[k] = L[k]; if (L.items) o.items = L.items.map(cleanLine); return o; };
  const dataSig = (r) => { const T = r.table || {}; const rows = T.rows || []; return JSON.stringify([r.name, r.colvars, r.interp, r.grid2d, rows.length, rows[0], rows[rows.length - 1], rows[rows.length >> 1]]); };

  /* regions: lista de objetos simples; opts: {materials, tabCache}. Devolve resultados por região */
  /* Quadros de uma animação: recalcula a folha até a região alvo com cada valor do parâmetro */
  FC.computeFrames = function (regions, target, param, values, opts, onFrame) {
    const frames = [];
    values.forEach((v, k) => {
      const o = Object.assign({}, opts || {}, { overrides: { [param]: v }, until: target, keepCache: true });
      const r = FC.computeSheet(regions, null, o);
      const t = r.results.find((x) => x.id === target);
      if (!t) throw new Error('A região animada não foi encontrada.');
      if (t.err) throw new Error('Quadro ' + (k + 1) + ' (' + param + ' = ' + FC.numStr(v) + '): ' + t.err);
      frames.push({ v, data: t.data });
      if (onFrame) onFrame(k, values.length);
    });
    return frames;
  };
  /* Animação com gráfico próprio: o usuário escreve as curvas, a variável independente e o parâmetro animado */
  FC.animMode = (a) => a.mode || (a.targetKey ? 'folha' : 'proprio');
  FC.animOwnRegion = function (a) {
    const pal = FC.PALETTE || ['#1F5FAE', '#B03A2E', '#2E7D32', '#D9822B', '#6A3D9A', '#00838F'];
    const base = { id: (a.id || 'anim') + '_g', preset: a.preset || 'acs1', xlabel: a.xlabel || a.xvar || 'x', ylabel: a.ylabel || '', zlabel: a.zlabel || '', panel: '' };
    if ((a.ptype || 'xy') === 'xy') {
      const lines = String(a.curves || '').split('\n').map((x) => x.trim()).filter(Boolean);
      return Object.assign(base, { type: 'xy', xvar: a.xvar || 'x', xmin: a.xmin, xmax: a.xmax, npts: Number(a.npts) || 300,
        traces: lines.map((e, i) => ({ expr: e, name: e, color: pal[i % pal.length], width: 1.6, dash: 'solid', marker: 'none' })),
        xlog: false, ylog: false, xlo: '', xhi: '', ymin: a.ymin2 || '', ymax: a.ymax2 || '', legend: lines.length > 1 ? 'sup-esq' : 'nao' });
    }
    return Object.assign(base, { type: a.ptype, expr: a.gexpr || '', xvar: a.xvar || 'x', yvar: a.yvar || 'y', xmin: a.xmin, xmax: a.xmax, nx: Number(a.nx) || 81,
      ymin: a.ymin, ymax: a.ymax, ny: Number(a.ny) || 81, colorscale: a.colorscale || 'Viridis', reverse: false, contours: false, ncont: 10, zmin: '', zmax: '', colorbar: true });
  };
  FC.animTarget = function (a, regions) {
    if (FC.animMode(a) === 'proprio') return FC.animOwnRegion(a);
    return (regions || []).find((x) => x.key && x.key === a.targetKey) || null;
  };
  /* Quadros do gráfico próprio: calcula a folha até a animação uma vez e só reavalia o gráfico com o parâmetro trocado */
  FC.computeOwnFrames = function (regions, anim, values, opts, onFrame) {
    const own = FC.animOwnRegion(anim), P = String(anim.param || '').trim();
    if (own.type === 'xy' && !own.traces.length) throw new Error('Escreva ao menos uma curva (ex.: y(x, 2, b)).');
    if (own.type !== 'xy' && !String(own.expr).trim()) throw new Error('Escreva a expressão do mapa (ex.: g(x, y, b)).');
    if (P === own.xvar || P === own.yvar) throw new Error('O parâmetro animado (' + P + ') não pode ser a variável do eixo.');
    let S = null;
    FC.computeSheet(regions, null, Object.assign({}, opts || {}, { until: anim.id, keepCache: true, onSession: (s) => { S = s; } }));
    if (!S) throw new Error('A região de animação não foi encontrada.');
    const frames = [];
    values.forEach((v, k) => {
      const S2 = Object.create(S);
      S2.scope = new FC.Overlay(S.scope); S2.scope.set(P, v);
      S2.ranges = new Map(S.ranges); S2.ranges.delete(P);
      let data;
      try { data = FC.computePlot(S2, own); } catch (e) { throw new Error('Quadro ' + (k + 1) + ' (' + P + ' = ' + FC.numStr(v) + '): ' + FC.ptError(e)); }
      frames.push({ v, data });
      if (onFrame) onFrame(k, values.length);
    });
    return frames;
  };
  FC.computeSheet = function (regions, onProgress, opts) {
    opts = opts || {};
    FC.MATERIALS = opts.materials || FC.MATERIALS || [];
    if (opts.tabCache) for (const [k, v] of Object.entries(opts.tabCache)) if (!FC.tabCache.has(k)) FC.tabCache.set(k, v);
    FC.tabUsed = new Set(); FC.tabFresh = 0;
    FC.warnings.reset();
    FC.colTables.clear();
    FC.overrides = opts.overrides ? new Map(Object.entries(opts.overrides)) : null;
    const S = new FC.Session();
    FC._tabBase = 0;
    if (FC.packScope) for (const e of FC.packScope(S.scope, opts.packs)) FC.warnings.add('Pacote ' + e);
    FC.materialScope(S.scope);
    FC._tabBase = FC.overrides ? FC.fnv(JSON.stringify(opts.overrides)) : 0;
    if (opts.packs && opts.packs.length) FC._tabBase = FC.fnv(JSON.stringify(opts.packs.map((p) => [p.id, p.versao, p.ativo, FC.fnv(JSON.stringify(p))])), FC._tabBase || 0);
    if (FC.overrides) for (const [k, v] of FC.overrides) S.scope.set(k, v);
    const out = [];
    let errors = 0, stop = false;
    regions.forEach((r, i) => {
      if (stop) return;
      if (opts.until && r.id === opts.until) { stop = true; if (opts.onSession) opts.onSession(S); }
      else if (opts.until && /^(xy|heat|surf|table|anim|text)$/.test(r.type)) return; // nos quadros, só o alvo é desenhado
      if (onProgress) onProgress(i, regions.length, r);
      const res = { id: r.id };
      const before = FC.warnings.list.length;
      try {
        if (r.type === 'math') {
          res.lines = S.region(r.src).map(cleanLine);
          errors += FC.flatLines(res.lines).filter((x) => x.kind === 'error').length;
        } else if (r.type === 'xy' || r.type === 'heat' || r.type === 'surf') {
          res.data = FC.computePlot(S, r);
        } else if (r.type === 'table') {
          res.rows = computeTable(S, r);
        } else if (r.type === 'data') {
          FC._tabBase = FC.fnv(dataSig(r), FC._tabBase || 0);
          res.defs = FC.defineData(S, r);
        } else if (r.type === 'sweep') {
          FC._tabBase = FC.fnv(JSON.stringify([r.param, r.from, r.to, r.n, r.outputs, r.name]), FC._tabBase || 0);
          res.sweep = FC.computeSweep(S, r);
        } else if (r.type === 'slider') {
          const name = String(r.name || '').trim();
          if (!/^[\p{L}_][\p{L}\p{N}_]*$/u.test(name)) throw new Error('Dê um nome à variável do controle (ex.: λ_OT).');
          const v = FC.overrides && FC.overrides.has(name) ? Number(FC.overrides.get(name)) : Number(r.value);
          S.scope.set(name, v); S.ranges.delete(name); S.defs.delete(name);
          FC._tabBase = FC.fnv(name + '=' + v, FC._tabBase || 0);
          res.slider = { name, v };
        } else if (r.type === 'fit') {
          FC._tabBase = FC.fnv(JSON.stringify([r.xexpr, r.yexpr, r.model, r.params, r.mode, r.objective, r.xmin, r.xmax, r.thresh]), FC._tabBase || 0);
          res.fit = FC.computeFit(S, r);
        }
      } catch (e) {
        res.err = FC.ptError(e); errors++;
      }
      if (FC.warnings.list.length > before) res.warn = FC.warnings.list.slice(before);
      out.push(res);
    });
    FC.overrides = null;
    // cache: mantém só as tabelas usadas nesta passada (as animações não podam o cache)
    if (!opts.keepCache) for (const k of [...FC.tabCache.keys()]) if (!FC.tabUsed.has(k)) FC.tabCache.delete(k);
    const tabCache = {};
    for (const k of FC.tabUsed) tabCache[k] = FC.tabCache.get(k);
    return { results: out, errors, warnings: FC.warnings.list.slice(), tabCache, tabFresh: FC.tabFresh };
  };
})();
