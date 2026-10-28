/* Folha de Cálculo — dados: importação, interpolação 1D/2D, tabelar, materiais, varredura e ajuste */
'use strict';
(function () {
  const FC = window.FC;
  const M = FC.M;
  const { Overlay, num, flatNums } = FC;

  /* ================= Leitura de arquivos de texto (txt, csv, dat, Origin) ================= */
  FC.parseTable = function (text) {
    const lines = String(text).replace(/\r\n?/g, '\n').split('\n').map((l) => l.replace(/\s+$/, '')).filter((l) => l.trim() && !/^\s*[#%]/.test(l));
    if (!lines.length) throw new Error('O arquivo está vazio.');
    const sample = lines.slice(-Math.min(30, lines.length));
    const cand = ['\t', ';', ','];
    let delim = null;
    for (const d of cand) { const c = sample.map((l) => l.split(d).length); if (c.every((n) => n > 1 && n === c[0])) { delim = d; break; } }
    if (!delim) delim = /\s/.test(sample[0].trim()) ? 'ws' : '\t';
    const split = (l) => (delim === 'ws' ? l.trim().split(/\s+/) : l.split(delim).map((x) => x.trim()));
    // vírgula decimal: separador não é vírgula e há números como 1,23
    const decComma = delim !== ',' && sample.some((l) => split(l).some((c) => /^-?\d+,\d+([eE][-+]?\d+)?$/.test(c)));
    const toNum = (s) => { if (s === '' || s == null) return NaN; const t = decComma ? s.replace(',', '.') : s; const v = Number(t.replace(/^"|"$/g, '')); return v; };
    const isNumRow = (l) => { const c = split(l); return c.length > 0 && c.filter((x) => x !== '').every((x) => !isNaN(toNum(x))); };
    let k = 0; const head = [];
    while (k < lines.length && !isNumRow(lines[k])) head.push(split(lines[k++]).map((x) => x.replace(/^"|"$/g, '')));
    const rows = [];
    for (let i = k; i < lines.length; i++) { const c = split(lines[i]); if (!isNumRow(lines[i])) continue; rows.push(c.map(toNum)); }
    if (!rows.length) throw new Error('Não encontrei linhas numéricas no arquivo.');
    const C = Math.max(...rows.map((r) => r.length));
    for (const r of rows) while (r.length < C) r.push(NaN);
    const names = [], units = [], comments = [];
    for (let j = 0; j < C; j++) { names.push((head[0] && head[0][j]) || 'C' + j); units.push((head.length >= 2 && head[1][j]) || ''); comments.push((head.length >= 3 && head[2][j]) || ''); }
    return { names, units, comments, rows, info: { delim: delim === '\t' ? 'tabulação' : delim === 'ws' ? 'espaços' : delim, decimal: decComma ? 'vírgula' : 'ponto', header: head.length } };
  };
  FC.varName = function (s, fallback) {
    let t = String(s || '').replace(/\(.*?\)|\[.*?\]/g, ' ').trim().split(/\s+/)[0] || '';
    t = t.normalize('NFC').replace(/[^\p{L}\p{N}_]/gu, '');
    if (!t || !/^[\p{L}_]/u.test(t)) t = fallback;
    return t;
  };

  /* ================= Interpolação 1D ================= */
  function prepXY(vx, vy) {
    const X = flatNums(vx), Y = flatNums(vy);
    if (X.length !== Y.length) throw new Error('Interpolação: os vetores x e y têm tamanhos diferentes (' + X.length + ' e ' + Y.length + ').');
    const idx = X.map((_, i) => i).filter((i) => isFinite(X[i]) && isFinite(Y[i])).sort((a, b) => X[a] - X[b]);
    const xs = idx.map((i) => X[i]), ys = idx.map((i) => Y[i]);
    if (xs.length < 2) throw new Error('Interpolação: precisa de pelo menos 2 pontos.');
    for (let i = 1; i < xs.length; i++) if (xs[i] === xs[i - 1]) throw new Error('Interpolação: há valores de x repetidos (' + xs[i] + ').');
    return [xs, ys];
  }
  function locate(xs, t) {
    const n = xs.length;
    if (t <= xs[0]) return 0;
    if (t >= xs[n - 1]) return n - 2;
    let lo = 0, hi = n - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (xs[m] > t) hi = m; else lo = m; }
    return lo;
  }
  // derivadas nos nós: PCHIP (Fritsch–Carlson) e Akima
  function pchipSlopes(x, y) {
    const n = x.length, h = [], d = [], m = new Array(n);
    for (let i = 0; i < n - 1; i++) { h.push(x[i + 1] - x[i]); d.push((y[i + 1] - y[i]) / h[i]); }
    if (n === 2) { m[0] = m[1] = d[0]; return m; }
    for (let i = 1; i < n - 1; i++) {
      if (d[i - 1] * d[i] <= 0) m[i] = 0;
      else { const w1 = 2 * h[i] + h[i - 1], w2 = h[i] + 2 * h[i - 1]; m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]); }
    }
    const end = (h0, h1, d0, d1) => { let s = ((2 * h0 + h1) * d0 - h0 * d1) / (h0 + h1); if (Math.sign(s) !== Math.sign(d0)) s = 0; else if (Math.sign(d0) !== Math.sign(d1) && Math.abs(s) > Math.abs(3 * d0)) s = 3 * d0; return s; };
    m[0] = end(h[0], h[1], d[0], d[1]);
    m[n - 1] = end(h[n - 2], h[n - 3], d[n - 2], d[n - 3]);
    return m;
  }
  function akimaSlopes(x, y) {
    const n = x.length, d = [];
    for (let i = 0; i < n - 1; i++) d.push((y[i + 1] - y[i]) / (x[i + 1] - x[i]));
    if (n < 3) return [d[0], d[0]];
    // inclinações estendidas: e[k + 2] = d[k], com duas extrapolações em cada ponta
    const e = new Array(n + 3);
    for (let k = 0; k < n - 1; k++) e[k + 2] = d[k];
    e[1] = 2 * e[2] - e[3]; e[0] = 2 * e[1] - e[2];
    e[n + 1] = 2 * e[n] - e[n - 1]; e[n + 2] = 2 * e[n + 1] - e[n];
    const m = new Array(n);
    for (let i = 0; i < n; i++) {
      const w1 = Math.abs(e[i + 3] - e[i + 2]), w2 = Math.abs(e[i + 1] - e[i]);
      m[i] = w1 + w2 < 1e-300 ? (e[i + 1] + e[i + 2]) / 2 : (w1 * e[i + 1] + w2 * e[i + 2]) / (w1 + w2);
    }
    return m;
  }
  function naturalY2(x, y) {
    const n = x.length, y2 = new Array(n).fill(0), u = new Array(n).fill(0);
    for (let i = 1; i < n - 1; i++) {
      const sig = (x[i] - x[i - 1]) / (x[i + 1] - x[i - 1]), p = sig * y2[i - 1] + 2;
      y2[i] = (sig - 1) / p;
      u[i] = (y[i + 1] - y[i]) / (x[i + 1] - x[i]) - (y[i] - y[i - 1]) / (x[i] - x[i - 1]);
      u[i] = ((6 * u[i]) / (x[i + 1] - x[i - 1]) - sig * u[i - 1]) / p;
    }
    for (let k = n - 2; k >= 0; k--) y2[k] = y2[k] * y2[k + 1] + u[k];
    return y2;
  }
  /* Cria a função interpoladora; onOut(t) é chamado quando t sai do intervalo */
  function makeInterp(xs, ys, method, onOut) {
    const n = xs.length, a = xs[0], b = xs[n - 1];
    method = String(method || 'spline').toLowerCase();
    let f;
    if (method === 'linear' || n === 2) f = (t) => { const i = locate(xs, t); return ys[i] + ((ys[i + 1] - ys[i]) * (t - xs[i])) / (xs[i + 1] - xs[i]); };
    else if (method === 'spline' || method === 'cspline') {
      const y2 = naturalY2(xs, ys);
      f = (t) => { const i = locate(xs, t), h = xs[i + 1] - xs[i], A = (xs[i + 1] - t) / h, B = (t - xs[i]) / h; return A * ys[i] + B * ys[i + 1] + ((A * A * A - A) * y2[i] + (B * B * B - B) * y2[i + 1]) * (h * h) / 6; };
    } else if (method === 'pchip' || method === 'akima') {
      const m = method === 'pchip' ? pchipSlopes(xs, ys) : akimaSlopes(xs, ys);
      f = (t) => {
        const i = locate(xs, t), h = xs[i + 1] - xs[i], s = (t - xs[i]) / h;
        const h00 = (1 + 2 * s) * (1 - s) * (1 - s), h10 = s * (1 - s) * (1 - s), h01 = s * s * (3 - 2 * s), h11 = s * s * (s - 1);
        return h00 * ys[i] + h10 * h * m[i] + h01 * ys[i + 1] + h11 * h * m[i + 1];
      };
    } else throw new Error('Método de interpolação desconhecido: ' + method + ' (use linear, spline, pchip ou akima).');
    const span = b - a, tol = 1e-9 * Math.max(1, Math.abs(span));
    return (t) => {
      if (M.isMatrix(t) || Array.isArray(t)) return M.map(t, (v) => evalOne(num(v)));
      return evalOne(num(t));
    };
    function evalOne(t) { if ((t < a - tol || t > b + tol) && onOut) onOut(t, a, b); return f(t); }
  }
  FC.makeInterp = makeInterp;

  /* Avisos de extrapolação, coletados durante um cálculo */
  FC.warnings = { list: [], seen: new Set(), add(msg) { if (this.seen.has(msg) || this.list.length > 20) return; this.seen.add(msg); this.list.push(msg); }, reset() { this.list = []; this.seen = new Set(); } };
  const outWarn = (name) => (t, a, b) => FC.warnings.add(name + ': x = ' + FC.numStr(t) + ' fora do intervalo dos dados (' + FC.numStr(a) + ' a ' + FC.numStr(b) + '); o valor foi extrapolado.');

  function interpFn(method) {
    return function (vx, vy, x) {
      const [xs, ys] = prepXY(vx, vy);
      return makeInterp(xs, ys, method, outWarn(method + '(…)'))(x);
    };
  }

  /* ================= Interpolação 2D ================= */
  function gridFrom(T) {
    const a = FC.toArr(T);
    if (!Array.isArray(a[0]) || a[0].length < 3) throw new Error('interp2D: use uma tabela com 3 colunas (x, y, z) em grade, como o Pg.');
    const rows = a.map((r) => r.map(num));
    const xs = [...new Set(rows.map((r) => r[0]))].sort((p, q) => p - q), ys = [...new Set(rows.map((r) => r[1]))].sort((p, q) => p - q);
    if (xs.length * ys.length !== rows.length) throw new Error('interp2D: as colunas x e y não formam uma grade regular (' + xs.length + ' × ' + ys.length + ' ≠ ' + rows.length + ' linhas).');
    const xi = new Map(xs.map((v, i) => [v, i])), yi = new Map(ys.map((v, i) => [v, i]));
    const Z = ys.map(() => new Array(xs.length).fill(NaN));
    for (const r of rows) Z[yi.get(r[1])][xi.get(r[0])] = r[2];
    return { xs, ys, Z };
  }
  FC.gridFrom = gridFrom;
  function makeInterp2D(g, method, name) {
    method = String(method || 'linear').toLowerCase();
    const { xs, ys, Z } = g, warn = outWarn(name || 'interp2D');
    const ax = xs[0], bx = xs[xs.length - 1], ay = ys[0], by = ys[ys.length - 1];
    let f;
    if (method === 'linear') {
      f = (x, y) => {
        const i = locate(xs, x), j = locate(ys, y);
        const tx = (x - xs[i]) / (xs[i + 1] - xs[i]), ty = (y - ys[j]) / (ys[j + 1] - ys[j]);
        return (1 - tx) * (1 - ty) * Z[j][i] + tx * (1 - ty) * Z[j][i + 1] + (1 - tx) * ty * Z[j + 1][i] + tx * ty * Z[j + 1][i + 1];
      };
    } else {
      // spline: interpola cada linha em x (pré-calculado) e depois em y
      const rowF = Z.map((row) => makeInterp(xs, row, method));
      f = (x, y) => makeInterp(ys, rowF.map((rf) => rf(x)), method)(y);
    }
    return (x, y) => {
      const one = (xv, yv) => { if (xv < ax || xv > bx || yv < ay || yv > by) warn(xv < ax || xv > bx ? xv : yv, xv < ax || xv > bx ? ax : ay, xv < ax || xv > bx ? bx : by); return f(xv, yv); };
      if (M.isMatrix(x) || Array.isArray(x)) return M.map(x, (v) => one(num(v), num(y)));
      return one(num(x), num(y));
    };
  }
  const grid2DCache = new WeakMap();
  function interp2D(T, x, y, method) {
    let g = typeof T === 'object' ? grid2DCache.get(T) : null;
    if (!g) { g = gridFrom(T); if (typeof T === 'object') grid2DCache.set(T, g); }
    return makeInterp2D(g, method || 'linear', 'interp2D')(x, y);
  }

  /* ================= tabelar(f, a, b, n, método) com cache ================= */
  FC.tabCache = new Map();  // chave -> {xs, ys}
  FC.tabUsed = new Set();
  FC.fnv = function (str, h) {
    h = h === undefined ? 0x811c9dc5 : h;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return h >>> 0;
  };
  function tabelar(args, _m, scope) {
    if (args.length < 4) throw new Error('tabelar(f, a, b, n): f é uma função de uma variável, a e b os limites e n o número de pontos. Ex.: ε1_t := tabelar(ε1, 250, 1600, 1351)');
    const f = args[0].compile().evaluate(scope);
    if (typeof f !== 'function') throw new Error('tabelar: o primeiro argumento deve ser uma função, ex.: tabelar(ε1, 250, 1600, 1351)');
    const a = num(args[1].compile().evaluate(scope)), b = num(args[2].compile().evaluate(scope)), n = Math.max(2, Math.round(num(args[3].compile().evaluate(scope))));
    const method = args[4] ? String(args[4].isSymbolNode ? args[4].name : args[4].compile().evaluate(scope)) : 'spline';
    const key = (FC._tabKey || '') + '|' + args.map((x) => x.toString()).join(',') + '|' + a + '|' + b + '|' + n;
    let t = FC.tabCache.get(key);
    if (!t) {
      const xs = [], ys = [];
      for (let k = 0; k < n; k++) { const x = a + ((b - a) * k) / (n - 1); xs.push(x); ys.push(num(f(x))); if (FC.onTick && (k & 31) === 0) FC.onTick(); }
      t = { xs, ys };
      FC.tabCache.set(key, t);
      FC.tabFresh = (FC.tabFresh || 0) + 1;
    }
    FC.tabUsed.add(key);
    return makeInterp(t.xs, t.ys, method, outWarn('tabelar(' + args[0].toString() + ')'));
  }
  tabelar.rawArgs = true;
  if (FC.BOUND_ARG) { /* tabelar não liga variáveis */ }

  M.import({
    linterp: interpFn('linear'), spline: interpFn('spline'), interp: interpFn('spline'), pchip: interpFn('pchip'), akima: interpFn('akima'),
    interp2D, tabelar
  }, { override: true });

  /* ================= Materiais ================= */
  FC.MATERIALS = [];
  FC.materialScope = function (scope) {
    for (const m of FC.MATERIALS) {
      if (!m || !m.name || !/^[\p{L}_][\p{L}\p{N}_]*$/u.test(m.name)) continue;
      try {
        const S2 = new FC.Session();
        const before = new Set(S2.scope.keys());
        S2.region(m.src || '');
        const obj = {};
        for (const [k, v] of S2.scope) if (!before.has(k)) obj[k] = v;
        scope.set(m.name, obj);
      } catch (e) { /* material com erro é ignorado; o diálogo mostra o erro */ }
    }
  };
  FC.checkMaterial = function (src) {
    const S2 = new FC.Session();
    const out = S2.region(src || '');
    return FC.flatLines(out).filter((L) => L.kind === 'error').map((L) => L.raw.trim() + ': ' + L.err);
  };

  /* ================= Regiões de dados, varredura e ajuste ================= */
  FC.defineData = function (S, r) {
    const T = r.table;
    if (!T || !T.rows || !T.rows.length) throw new Error('Nenhum arquivo importado ainda. Toque em “Importar arquivo”.');
    const C = T.rows[0].length, name = FC.varName(r.name, 'D1');
    const defs = [];
    S.scope.set(name, M.matrix(T.rows));
    FC.colTables.add(name); // name[j] = coluna j
    defs.push({ t: name, d: 'matriz ' + T.rows.length + ' × ' + C + ' · ' + name + '[j] é a coluna j, ' + name + '[i, j] o elemento' });
    const colvars = [];
    for (let j = 0; j < C; j++) {
      const v = FC.varName((r.colvars || [])[j], name + '_c' + j);
      colvars.push(v);
      S.scope.set(v, M.matrix(T.rows.map((row) => row[j])));
      S.ranges.delete(v); S.defs.delete(v);
      defs.push({ t: v, d: 'coluna ' + j + (T.names[j] ? ' (' + T.names[j] + (T.units[j] ? ', ' + T.units[j] : '') + ')' : '') });
    }
    if (r.interp && r.interp.on) {
      const xc = Math.min(C - 1, Math.max(0, r.interp.xcol | 0));
      for (let j = 0; j < C; j++) {
        if (j === xc) continue;
        const fn = FC.varName((r.interp.fnames || [])[j], colvars[j] + '_i');
        const [xs, ys] = prepXY(T.rows.map((q) => q[xc]), T.rows.map((q) => q[j]));
        S.scope.set(fn, makeInterp(xs, ys, r.interp.method, outWarn(fn)));
        S.ranges.delete(fn); S.defs.delete(fn);
        defs.push({ t: fn + '(' + colvars[xc] + ')', d: r.interp.method + ' de ' + colvars[j] + ' em ' + colvars[xc] + ' (' + FC.numStr(xs[0]) + ' a ' + FC.numStr(xs[xs.length - 1]) + ')' });
      }
    }
    if (r.grid2d && r.grid2d.on) {
      const g = r.grid2d, fn = FC.varName(g.fname, name + '_f');
      const grid = gridFrom(T.rows.map((q) => [q[g.xcol | 0], q[g.ycol | 0], q[g.zcol | 0]]));
      S.scope.set(fn, makeInterp2D(grid, g.method || 'linear', fn));
      S.ranges.delete(fn); S.defs.delete(fn);
      defs.push({ t: fn + '(x, y)', d: 'interpolação 2D ' + (g.method || 'linear') + ' numa grade ' + grid.xs.length + ' × ' + grid.ys.length });
    }
    return { defs, n: T.rows.length, C };
  };

  FC.computeSweep = function (S, r) {
    const p = String(r.param || '').trim();
    if (!/^[\p{L}_][\p{L}\p{N}_]*$/u.test(p)) throw new Error('Dê um nome ao parâmetro (ex.: λ_OT).');
    const a = S.evalScalar(r.from), b = S.evalScalar(r.to), n = Math.max(2, Math.round(Number(r.n) || 21));
    if (!isFinite(a) || !isFinite(b)) throw new Error('Preencha os valores inicial e final do parâmetro.');
    const exprs = String(r.outputs || '').split('\n').map((x) => x.trim()).filter(Boolean);
    if (!exprs.length) throw new Error('Escreva ao menos uma grandeza para calcular (uma por linha).');
    const codes = exprs.map((e) => S.compileExpr(e)), ov = new Overlay(S.scope), rows = [];
    for (let k = 0; k < n; k++) {
      const v = r.log && a > 0 && b > 0 ? a * Math.pow(b / a, k / (n - 1)) : a + ((b - a) * k) / (n - 1);
      ov.set(p, v);
      const row = [v];
      codes.forEach((c, i) => { try { row.push(num(c.evaluate(ov))); } catch (e) { const er = new Error('“' + exprs[i] + '” com ' + p + ' = ' + FC.numStr(v) + ': ' + FC.ptError(e)); throw er; } });
      rows.push(row);
      if (FC.onTick) FC.onTick();
    }
    const vname = FC.varName(r.name, 'V1');
    S.scope.set(vname, M.matrix(rows)); S.ranges.delete(vname); S.defs.delete(vname);
    return { rows, exprs, vname };
  };

  /* Métricas de erro no domínio Ω */
  function metrics(ye, ym) {
    const n = ye.length, peak = Math.max(...ye.map(Math.abs)) || 1, sum = ye.reduce((s, v) => s + v, 0) || 1;
    let A = 0, B = 0, Cc = 0, nb = 0;
    for (let i = 0; i < n; i++) {
      const d = ym[i] - ye[i];
      A += (d / peak) ** 2;
      if (ye[i] !== 0) { B += (d / ye[i]) ** 2; nb++; }
      Cc += (ye[i] / sum) * (d / peak) ** 2;
    }
    return { rmsA: Math.sqrt(A / n), mseB: nb ? B / nb : NaN, mseC: Cc };
  }
  FC.fitMetrics = metrics;
  function parseParams(txt) {
    const out = [];
    for (const raw of String(txt || '').split('\n')) {
      const l = FC.normalize(raw).trim();
      if (!l || l.startsWith('//')) continue;
      const m = l.match(/^([\p{L}_][\p{L}\p{N}_]*)\s*(?::=|=)\s*([^\[]+?)\s*(\[\s*([^,\]]+)\s*,\s*([^\]]+)\s*\])?\s*(fixo|fixed)?\s*$/u);
      if (!m) throw new Error('Parâmetro mal escrito: “' + raw.trim() + '”. Use: nome = valor, nome = valor [mín, máx] ou nome = valor fixo');
      out.push({ name: m[1], v0: m[2], lo: m[4], hi: m[5], fixed: !!m[6] });
    }
    if (!out.length) throw new Error('Liste os parâmetros do modelo, um por linha, ex.: A1 = 1');
    return out;
  }
  FC.parseFitParams = parseParams;
  FC.computeFit = function (S, r) {
    const xv = flatNums(S.evalNode(FC.parse(FC.normalize(r.xexpr)))), yv = flatNums(S.evalNode(FC.parse(FC.normalize(r.yexpr))));
    if (xv.length !== yv.length) throw new Error('x e y dos dados têm tamanhos diferentes (' + xv.length + ' e ' + yv.length + ').');
    const xvar = String(r.xvar || 'x').trim();
    const P = parseParams(r.params);
    for (const p of P) { p.val = S.evalScalar(p.v0); p.lo = p.lo != null ? S.evalScalar(p.lo) : -Infinity; p.hi = p.hi != null ? S.evalScalar(p.hi) : Infinity; if (!isFinite(p.val)) throw new Error('Valor inicial inválido para ' + p.name); }
    // domínio Ω
    const lo = String(r.xmin || '').trim() ? S.evalScalar(r.xmin) : -Infinity, hi = String(r.xmax || '').trim() ? S.evalScalar(r.xmax) : Infinity;
    const thr = Number(r.thresh) || 0, peak = Math.max(...yv.filter(isFinite).map(Math.abs));
    const idx = xv.map((_, i) => i).filter((i) => isFinite(xv[i]) && isFinite(yv[i]) && xv[i] >= lo && xv[i] <= hi && Math.abs(yv[i]) >= (thr / 100) * peak);
    if (idx.length < 2) throw new Error('O domínio Ω ficou com menos de 2 pontos. Confira limites e limiar.');
    const xs = idx.map((i) => xv[i]), ye = idx.map((i) => yv[i]);
    const code = S.compileExpr(r.model), ov = new Overlay(S.scope);
    const model = (vals, xarr) => { P.forEach((p, k) => ov.set(p.name, vals[k])); return xarr.map((x) => { ov.set(xvar, x); return num(code.evaluate(ov)); }); };
    const free = P.map((p, k) => (p.fixed ? -1 : k)).filter((k) => k >= 0);
    const pk = Math.max(...ye.map(Math.abs)) || 1, sumY = ye.reduce((s, v) => s + v, 0) || 1;
    const obj = r.objective || 'A';
    const resid = (vals) => { const ym = model(vals, xs); return ym.map((v, i) => { const d = v - ye[i]; if (obj === 'B') return ye[i] !== 0 ? d / ye[i] : 0; if (obj === 'C') return Math.sqrt(Math.max(ye[i], 0) / sumY) * d / pk; return d / pk; }); };
    let vals = P.map((p) => p.val), iters = 0, cov = null, converged = false;
    if (r.mode !== 'avaliar' && free.length) {
      const clip = (v, k) => Math.min(P[k].hi, Math.max(P[k].lo, v));
      let res = resid(vals), f = res.reduce((s, v) => s + v * v, 0), lam = 1e-3;
      for (iters = 0; iters < 300; iters++) {
        const J = free.map((k) => { const hk = 1e-6 * Math.max(1e-6, Math.abs(vals[k])); const vp = vals.slice(); vp[k] += hk; const rp = resid(vp); return rp.map((v, i) => (v - res[i]) / hk); });
        const A = free.map((_, a) => free.map((__, b) => J[a].reduce((s, v, i) => s + v * J[b][i], 0)));
        const g = free.map((_, a) => J[a].reduce((s, v, i) => s + v * res[i], 0));
        let ok = false;
        for (let t = 0; t < 25; t++) {
          const B = A.map((row, i) => row.map((v, j) => v + (i === j ? lam * (A[i][i] + 1e-30) : 0)));
          let dx; try { dx = solve(B, g.map((v) => -v)); } catch (e) { lam *= 10; continue; }
          const vn = vals.slice(); free.forEach((k, a) => { vn[k] = clip(vals[k] + dx[a], k); });
          const rn = resid(vn), fn = rn.reduce((s, v) => s + v * v, 0);
          if (isFinite(fn) && fn <= f) {
            const rel = Math.abs(f - fn) / (f + 1e-300);
            const step = Math.max(...free.map((k) => Math.abs(vn[k] - vals[k]) / (Math.abs(vn[k]) + 1e-12)));
            vals = vn; res = rn; f = fn; lam = Math.max(lam / 5, 1e-15); ok = true;
            if (rel < 1e-10 || step < 1e-9) converged = true;
            break;
          }
          lam *= 8;
        }
        if (!ok) { converged = true; break; }
        if (converged) { iters++; break; }
        if (FC.onTick) FC.onTick();
      }
      // incertezas: cov = s² (JᵀJ)⁻¹
      try {
        const J = free.map((k) => { const hk = 1e-6 * Math.max(1e-6, Math.abs(vals[k])); const vp = vals.slice(); vp[k] += hk; const rp = resid(vp); return rp.map((v, i) => (v - res[i]) / hk); });
        const A = free.map((_, a) => free.map((__, b) => J[a].reduce((s, v, i) => s + v * J[b][i], 0)));
        const dof = Math.max(1, xs.length - free.length), s2 = f / dof;
        const inv = invert(A);
        cov = free.map((_, a) => Math.sqrt(Math.abs(inv[a][a] * s2)));
      } catch (e) { cov = null; }
    }
    const ym = model(vals, xs);
    const met = metrics(ye, ym);
    // modelo em todos os pontos (para o gráfico)
    const allX = xv.filter(isFinite);
    const yAll = model(vals, allX);
    if (r.define !== false) P.forEach((p, k) => { S.scope.set(p.name, vals[k]); S.ranges.delete(p.name); S.defs.delete(p.name); });
    const err = P.map(() => null); if (cov) free.forEach((k, a) => { err[k] = cov[a]; });
    return { params: P.map((p, k) => ({ name: p.name, v0: p.val, v: vals[k], err: err[k], fixed: p.fixed })), metrics: met, n: xs.length, iters: Math.min(iters, 300), converged, x: xv, y: yv, xs, ye, ym, allX, yAll };
  };
  function solve(A, b) {
    const n = b.length, a = A.map((r, i) => [...r, b[i]]);
    for (let c = 0; c < n; c++) {
      let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(a[r][c]) > Math.abs(a[p][c])) p = r;
      if (Math.abs(a[p][c]) < 1e-300) throw new Error('singular');
      [a[c], a[p]] = [a[p], a[c]];
      for (let r = c + 1; r < n; r++) { const f = a[r][c] / a[c][c]; for (let k = c; k <= n; k++) a[r][k] -= f * a[c][k]; }
    }
    const x = new Array(n);
    for (let r = n - 1; r >= 0; r--) { let s = a[r][n]; for (let k = r + 1; k < n; k++) s -= a[r][k] * x[k]; x[r] = s / a[r][r]; }
    return x;
  }
  function invert(A) {
    const n = A.length, out = [];
    for (let j = 0; j < n; j++) { const e = new Array(n).fill(0); e[j] = 1; out.push(solve(A, e)); }
    return A.map((_, i) => out.map((col) => col[i]));
  }
})();
