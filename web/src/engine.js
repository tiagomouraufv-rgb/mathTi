/* Folha de Cálculo — motor de cálculo (sintaxe estilo Mathcad sobre math.js) */
'use strict';
(function () {
  const FC = (window.FC = window.FC || {});
  const M = math.create(math.all, {});
  FC.M = M;

  /* ---------- Escopo em camadas (para avaliar elemento a elemento) ---------- */
  class Overlay {
    constructor(parent) { this.p = parent; this.m = new Map(); }
    get(k) { return this.m.has(k) ? this.m.get(k) : this.p.get(k); }
    has(k) { return this.m.has(k) || this.p.has(k); }
    set(k, v) { this.m.set(k, v); return this; }
    delete(k) { return this.m.delete(k); }
    clear() { this.m.clear(); }
    keys() { return new Set([...this.p.keys(), ...this.m.keys()]).values(); }
    get size() { return new Set([...this.p.keys(), ...this.m.keys()]).size; }
    forEach(cb) { for (const k of this.keys()) cb(this.get(k), k, this); }
    entries() { return this[Symbol.iterator](); }
    [Symbol.iterator]() { const s = this; return (function* () { for (const k of s.keys()) yield [k, s.get(k)]; })(); }
  }
  FC.Overlay = Overlay;

  /* ---------- Conversões numéricas ---------- */
  function num(v) {
    if (typeof v === 'number') return v;
    if (typeof v === 'boolean') return v ? 1 : 0;
    if (v == null) return NaN;
    if (M.isUnit(v)) {
      if (v.value == null) return NaN;
      const u = v.formatUnits();
      try { return u ? v.toNumber(u) : v.value; } catch (e) { return v.value; }
    }
    if (M.isComplex(v)) return Math.abs(v.im) < 1e-14 * Math.max(1, Math.abs(v.re)) ? v.re : NaN;
    if (M.isBigNumber(v) || M.isFraction(v)) return Number(v);
    if (M.isMatrix(v) || Array.isArray(v)) {
      const a = M.flatten(M.isMatrix(v) ? v.toArray() : v);
      return a.length === 1 ? num(a[0]) : NaN;
    }
    return NaN;
  }
  FC.num = num;
  function toArr(v) {
    if (M.isMatrix(v)) return v.toArray();
    if (Array.isArray(v)) return v;
    return [v];
  }
  FC.toArr = toArr;
  function flatNums(v) { return M.flatten(toArr(v)).map(num); }
  FC.flatNums = flatNums;

  /* ---------- Normalização da escrita ---------- */
  // nomes LaTeX (\psi, \lambda…) viram letras; o ˆ do teclado do tablet vira ^
  const TEX_CHARS = { alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', varepsilon: 'ε', zeta: 'ζ', eta: 'η', theta: 'θ', vartheta: 'θ', iota: 'ι', kappa: 'κ', lambda: 'λ', mu: 'μ', nu: 'ν', xi: 'ξ', pi: 'π', rho: 'ρ', sigma: 'σ', tau: 'τ', upsilon: 'υ', phi: 'φ', varphi: 'φ', chi: 'χ', psi: 'ψ', omega: 'ω', Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ', Xi: 'Ξ', Pi: 'Π', Sigma: 'Σ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω', hbar: 'ħ', infty: '∞', cdot: '·', times: '×', partial: '∂', nabla: '∇', pm: '±', degree: '°' };
  FC.TEX_CHARS = TEX_CHARS;
  const TEX_RE = new RegExp('\\\\(' + Object.keys(TEX_CHARS).sort((a, b) => b.length - a.length).join('|') + ')(?![A-Za-z])', 'g');
  FC.texNamesToChars = (s) => String(s).replace(TEX_RE, (m, k) => TEX_CHARS[k]).replace(/[\u02C6\uFF3E]/g, '^').replace(/\u0302/g, '^');
  function normalize(s) {
    return FC.texNamesToChars(String(s))
      .replace(/≔/g, ':=')
      .replace(/→/g, '->')
      .replace(/[·×⋅]/g, '*')
      .replace(/[−–]/g, '-')
      .replace(/‥/g, '..')
      .replace(/÷/g, '/')
      .replace(/π/g, 'pi')
      .replace(/∞/g, 'Infinity')
      .replace(/√\s*\(/g, 'sqrt(')
      .replace(/²/g, '^2').replace(/³/g, '^3')
      .replace(/µ/g, 'u')
      .replace(/μ(?=(m|s|g|A|V|W|J|F|L|K|mol|Hz|eV|N|C|T)\b)/g, 'u')
      .replace(/≤/g, '<=').replace(/≥/g, '>=').replace(/≠/g, '!=');
  }
  FC.normalize = normalize;
  /* "f(x) := x^2   // descrição" -> ["f(x) := x^2", "descrição"] (// dentro de aspas não conta) */
  FC.splitComment = function (raw) {
    const s = String(raw);
    const t = s.trimStart();
    if (t.startsWith('//')) return [s, null];
    let q = null;
    for (let i = 0; i < s.length - 1; i++) {
      const c = s[i];
      if (q) { if (c === q) q = null; continue; }
      if (c === '"' || c === "'") { q = c; continue; }
      if (c === '/' && s[i + 1] === '/') return [s.slice(0, i).replace(/\s+$/, ''), s.slice(i + 2).trim() || null];
    }
    return [s, null];
  };

  /* Procura um separador fora de parênteses/colchetes/aspas */
  function findTop(s, sep, from) {
    let d = 0, q = null;
    for (let i = from || 0; i <= s.length - sep.length; i++) {
      const ch = s[i];
      if (q) { if (ch === q) q = null; continue; }
      if (ch === '"' || ch === "'") { q = ch; continue; }
      if ('([{'.includes(ch)) d++;
      else if (')]}'.includes(ch)) d--;
      else if (d === 0 && s.substr(i, sep.length) === sep) return i;
    }
    return -1;
  }
  FC.findTop = findTop;
  function splitTop(s, sep) {
    const out = []; let start = 0, i;
    while ((i = findTop(s, sep, start)) >= 0) { out.push(s.slice(start, i)); start = i + sep.length; }
    out.push(s.slice(start));
    return out;
  }
  FC.splitTop = splitTop;
  // várias definições na mesma linha, separadas por ; (fora de [ ], ( ), { } e aspas) → mostradas lado a lado
  FC.rowParts = function (s) { const p = splitTop(String(s || ''), ';').map((x) => x.trim()).filter(Boolean); return p; };
  // linhas da fonte com as partes separadas por ; já abertas: [[texto, nº da linha]]
  FC.srcParts = function (src) { const o = []; String(src || '').split('\n').forEach((l, k) => { if (/^\s/.test(l) || !l.includes(';')) { o.push([l, k]); return; } const [b, d] = FC.splitComment(l); const p = FC.rowParts(b); if (p.length < 2) { o.push([l, k]); return; } p.forEach((x, j) => o.push([x + (d && j === p.length - 1 ? '   // ' + d : ''), k])); }); return o; };
  FC.flatLines = function (lines) { const o = []; for (const l of lines || []) { if (l && l.kind === 'row') o.push(...(l.items || [])); else o.push(l); } return o; };

  /* ---------- Índices começando em 0 (como no Mathcad) ---------- */
  // tabelas de dados importados: T[j] é a coluna j (como no Origin); T[i, j] é o elemento
  FC.colTables = FC.colTables || new Set();
  const ALL_ROWS = M.parse('A[:, 1]').index.dimensions[0];
  function zeroBased(node) {
    return node.transform(function (n) {
      if (n.isAccessorNode && n.object && n.object.isSymbolNode && FC.colTables.has(n.object.name) && n.index && !n.index.dotNotation && n.index.dimensions.length === 1) {
        const d = n.index.dimensions[0];
        return new M.AccessorNode(n.object, new M.IndexNode([ALL_ROWS, d.isRangeNode ? d : new M.OperatorNode('+', 'add', [zeroBased(d), new M.ConstantNode(1)])], false));
      }
      // v[i] com um índice só: funciona também em vetor coluna (n×1) e linha (1×n), como no Mathcad
      if (n.isAccessorNode && n.index && !n.index.dotNotation && n.index.dimensions.length === 1 && !n.index.dimensions[0].isRangeNode) {
        return new M.FunctionNode(new M.SymbolNode('__vsub'), [zeroBased(n.object), new M.OperatorNode('+', 'add', [zeroBased(n.index.dimensions[0]), new M.ConstantNode(1)])]);
      }
      if (n.isIndexNode && !n.dotNotation) {
        return new M.IndexNode(
          n.dimensions.map((d) =>
            d.isRangeNode ? d : new M.OperatorNode('+', 'add', [zeroBased(d), new M.ConstantNode(1)])
          ),
          false
        );
      }
      return n;
    });
  }
  function parse(str) { return zeroBased(M.parse(str)); }
  FC.parse = parse;
  // lado esquerdo de definição: __vsub(v, i) volta a ser v[i]
  FC.unVsub = function (n) { return n && n.isFunctionNode && n.fn && n.fn.name === '__vsub' ? new M.AccessorNode(n.args[0], new M.IndexNode([n.args[1]], false)) : n; };
  function lhsParse(str) { return FC.unVsub(parse(str)); }
  FC.lhsParse = lhsParse;

  /* ---------- Funções extras (especiais, análise, tabelas) ---------- */
  const nativeLog = M.log;

  function mapLast(fn) {
    return function (...args) {
      const last = args[args.length - 1];
      if (M.isMatrix(last) || Array.isArray(last)) {
        const head = args.slice(0, -1).map(num);
        return M.map(last, (v) => fn(...head, num(v)));
      }
      return fn(...args.map(num));
    };
  }

  // Bessel por regra do trapézio periódica (exata até a precisão de máquina)
  function besselJ(n, x) {
    n = Math.round(n);
    const N = 2 * Math.ceil(Math.abs(x) + Math.abs(n)) + 64;
    let s = 0;
    for (let k = 0; k < N; k++) { const t = (2 * Math.PI * k) / N; s += Math.cos(n * t - x * Math.sin(t)); }
    return s / N;
  }
  function besselI(n, x) {
    n = Math.round(n);
    const N = 2 * Math.ceil(Math.abs(x) + Math.abs(n)) + 64;
    let s = 0;
    for (let k = 0; k < N; k++) { const t = (2 * Math.PI * k) / N; s += Math.exp(x * Math.cos(t)) * Math.cos(n * t); }
    return s / N;
  }
  function simpson(f, a, b, N) {
    if (N % 2) N++;
    const h = (b - a) / N; let s = f(a) + f(b);
    for (let k = 1; k < N; k++) s += (k % 2 ? 4 : 2) * f(a + k * h);
    return (s * h) / 3;
  }
  function tailEnd(x, n) { // t onde x*sinh(t) - n*t > 45
    let t = 1;
    while (x * Math.sinh(t) - Math.abs(n) * t < 45 && t < 50) t += 0.25;
    return t;
  }
  function besselY(n, x) {
    n = Math.round(n);
    if (x <= 0) return NaN;
    const a = simpson((t) => Math.sin(x * Math.sin(t) - n * t), 0, Math.PI, 2 * Math.ceil(2 * (x + Math.abs(n))) + 400) / Math.PI;
    const T = tailEnd(x, n);
    const sg = n % 2 === 0 ? 1 : -1;
    const b = simpson((t) => (Math.exp(n * t) + sg * Math.exp(-n * t)) * Math.exp(-x * Math.sinh(t)), 0, T, 4000) / Math.PI;
    return a - b;
  }
  function besselK(n, x) {
    if (x <= 0) return NaN;
    const T = Math.max(tailEnd(x, n), 1);
    return simpson((t) => Math.exp(-x * Math.cosh(t)) * Math.cosh(n * t), 0, T, 4000);
  }
  function sphJ(n, x) {
    n = Math.round(n);
    if (x === 0) return n === 0 ? 1 : 0;
    const j0 = Math.sin(x) / x;
    if (n === 0) return j0;
    const j1 = Math.sin(x) / (x * x) - Math.cos(x) / x;
    if (n === 1) return j1;
    if (n < Math.abs(x)) { // recorrência ascendente estável
      let a = j0, b = j1;
      for (let k = 1; k < n; k++) { const c = ((2 * k + 1) / x) * b - a; a = b; b = c; }
      return b;
    }
    // Miller (descendente)
    const N = n + 20 + Math.floor(Math.sqrt(40 * n));
    let jp = 0, jc = 1e-300, res = 0;
    for (let k = N; k > 0; k--) {
      const jm = ((2 * k + 1) / x) * jc - jp;
      jp = jc; jc = jm;
      if (k - 1 === n) res = jc;
      if (Math.abs(jc) > 1e250) { jc *= 1e-250; jp *= 1e-250; res *= 1e-250; }
    }
    return (res * j0) / jc;
  }
  function sphY(n, x) {
    n = Math.round(n);
    let a = -Math.cos(x) / x;
    if (n === 0) return a;
    let b = -Math.cos(x) / (x * x) - Math.sin(x) / x;
    for (let k = 1; k < n; k++) { const c = ((2 * k + 1) / x) * b - a; a = b; b = c; }
    return b;
  }
  function hermite(n, x) { n = Math.round(n); let a = 1; if (n === 0) return a; let b = 2 * x; for (let k = 1; k < n; k++) { const c = 2 * x * b - 2 * k * a; a = b; b = c; } return b; }
  function legendre(n, x) { n = Math.round(n); let a = 1; if (n === 0) return a; let b = x; for (let k = 1; k < n; k++) { const c = ((2 * k + 1) * x * b - k * a) / (k + 1); a = b; b = c; } return b; }
  function laguerreA(n, al, x) { n = Math.round(n); let a = 1; if (n === 0) return a; let b = 1 + al - x; for (let k = 1; k < n; k++) { const c = ((2 * k + 1 + al - x) * b - (k + al) * a) / (k + 1); a = b; b = c; } return b; }
  function chebT(n, x) { n = Math.round(n); let a = 1; if (n === 0) return a; let b = x; for (let k = 1; k < n; k++) { const c = 2 * x * b - a; a = b; b = c; } return b; }

  function asArrays(vx, vy) { return [flatNums(vx), flatNums(vy)]; }
  function linterp(vx, vy, x) {
    const [X, Y] = asArrays(vx, vy);
    const f = (t) => {
      if (t <= X[0]) return Y[0] + ((Y[1] - Y[0]) * (t - X[0])) / (X[1] - X[0]);
      const n = X.length;
      if (t >= X[n - 1]) return Y[n - 2] + ((Y[n - 1] - Y[n - 2]) * (t - X[n - 2])) / (X[n - 1] - X[n - 2]);
      let lo = 0, hi = n - 1;
      while (hi - lo > 1) { const m = (lo + hi) >> 1; if (X[m] > t) hi = m; else lo = m; }
      return Y[lo] + ((Y[hi] - Y[lo]) * (t - X[lo])) / (X[hi] - X[lo]);
    };
    return M.isMatrix(x) || Array.isArray(x) ? M.map(x, (v) => f(num(v))) : f(num(x));
  }
  const splineCache = new WeakMap();
  function splineCoef(X, Y) {
    const n = X.length, y2 = new Array(n).fill(0), u = new Array(n).fill(0);
    for (let i = 1; i < n - 1; i++) {
      const sig = (X[i] - X[i - 1]) / (X[i + 1] - X[i - 1]);
      const p = sig * y2[i - 1] + 2;
      y2[i] = (sig - 1) / p;
      u[i] = (Y[i + 1] - Y[i]) / (X[i + 1] - X[i]) - (Y[i] - Y[i - 1]) / (X[i] - X[i - 1]);
      u[i] = ((6 * u[i]) / (X[i + 1] - X[i - 1]) - sig * u[i - 1]) / p;
    }
    for (let k = n - 2; k >= 0; k--) y2[k] = y2[k] * y2[k + 1] + u[k];
    return y2;
  }
  function spline(vx, vy, x) {
    const [X, Y] = asArrays(vx, vy);
    let y2 = M.isMatrix(vy) || Array.isArray(vy) ? splineCache.get(vy) : null;
    if (!y2) { y2 = splineCoef(X, Y); if (typeof vy === 'object') splineCache.set(vy, y2); }
    const n = X.length;
    const f = (t) => {
      let lo = 0, hi = n - 1;
      if (t <= X[0]) { lo = 0; hi = 1; } else if (t >= X[n - 1]) { lo = n - 2; hi = n - 1; } else {
        while (hi - lo > 1) { const m = (lo + hi) >> 1; if (X[m] > t) hi = m; else lo = m; }
      }
      const h = X[hi] - X[lo], a = (X[hi] - t) / h, b = (t - X[lo]) / h;
      return a * Y[lo] + b * Y[hi] + ((a * a * a - a) * y2[lo] + (b * b * b - b) * y2[hi]) * (h * h) / 6;
    };
    return M.isMatrix(x) || Array.isArray(x) ? M.map(x, (v) => f(num(v))) : f(num(x));
  }

  function columnize(v) {
    const a = toArr(v);
    if (!Array.isArray(a[0])) return a.map((e) => [e]);
    return a;
  }
  function augment(...vs) {
    const cols = vs.map(columnize);
    const n = cols[0].length;
    for (const c of cols) if (c.length !== n) throw new Error('augment: as colunas têm tamanhos diferentes');
    const out = [];
    for (let i = 0; i < n; i++) out.push([].concat(...cols.map((c) => c[i])));
    return M.matrix(out);
  }
  function stack(...vs) {
    const out = [];
    for (const v of vs) { const a = toArr(v); if (Array.isArray(a[0])) out.push(...a); else out.push(...a.map((e) => [e])); }
    return M.matrix(out);
  }
  function rows(v) { const s = M.size(v).valueOf(); return s.length ? s[0] : 1; }
  function cols(v) { const s = M.size(v).valueOf(); return s.length > 1 ? s[1] : 1; }
  function col(Mx, j) { const a = toArr(Mx); return M.matrix(a.map((r) => (Array.isArray(r) ? r[Math.round(num(j))] : r))); }
  function row(Mx, i) { const a = toArr(Mx); return M.matrix(a[Math.round(num(i))]); }
  function linspace(a, b, n) { n = Math.max(2, Math.round(num(n))); a = num(a); b = num(b); const o = []; for (let k = 0; k < n; k++) o.push(a + ((b - a) * k) / (n - 1)); return M.matrix(o); }
  function steps(a, d, b) { const o = []; a = num(a); d = num(d); b = num(b); const n = Math.floor((b - a) / d + 1e-9); for (let k = 0; k <= n; k++) o.push(a + k * d); return o; }
  function tabelaXYZ(f, x0, dx, x1, y0, dy, y1) {
    if (typeof f !== 'function') throw new Error('tabelaXYZ: o primeiro argumento deve ser uma função, ex.: tabelaXYZ(g, 0, 0.1, 10, 0, 0.1, 10)');
    const xs = steps(x0, dx, x1), ys = steps(y0, dy, y1), out = [];
    for (const x of xs) for (const y of ys) out.push([x, y, num(f(x, y))]);
    return M.matrix(out);
  }

  // Funções com argumentos "crus" (recebem a expressão sem avaliar)
  function evalIn(node, scope) { return node.compile().evaluate(scope); }
  function makeVarFn(args, scope, idxExpr, idxVar) {
    const code = args[idxExpr].compile();
    const name = args[idxVar].name;
    if (!name) throw new Error('o argumento da variável deve ser um nome, ex.: x');
    const ov = new Overlay(scope);
    return (t) => { ov.set(name, t); return code.evaluate(ov); };
  }
  function adaptSimpson(f, a, b, eps, whole, fa, fb, fm, depth) {
    const m = (a + b) / 2, lm = (a + m) / 2, rm = (m + b) / 2;
    const flm = f(lm), frm = f(rm);
    const left = ((m - a) / 6) * (fa + 4 * flm + fm), right = ((b - m) / 6) * (fm + 4 * frm + fb);
    const d = left + right - whole;
    if (depth <= 0 || Math.abs(d) <= 15 * eps) return left + right + d / 15;
    return adaptSimpson(f, a, m, eps / 2, left, fa, fm, flm, depth - 1) + adaptSimpson(f, m, b, eps / 2, right, fm, fb, frm, depth - 1);
  }
  function quad(f, a, b) {
    if (a === b) return 0;
    if (!isFinite(a) || !isFinite(b)) { // troca t = x/(1-x^2) para limites infinitos
      const g = (u) => { const t = u / (1 - u * u); return f(t) * (1 + u * u) / Math.pow(1 - u * u, 2); };
      const ua = isFinite(a) ? (Math.abs(a) < 1e-300 ? 0 : (-1 + Math.sqrt(1 + 4 * a * a)) / (2 * a)) : -1 + 1e-12;
      const ub = isFinite(b) ? (Math.abs(b) < 1e-300 ? 0 : (-1 + Math.sqrt(1 + 4 * b * b)) / (2 * b)) : 1 - 1e-12;
      return quad(g, ua, ub);
    }
    // soma de 16 painéis adaptativos (robusto para integrandos oscilantes)
    const P = 16, h = (b - a) / P; let s = 0;
    for (let k = 0; k < P; k++) {
      const x0 = a + k * h, x1 = x0 + h, fa = f(x0), fb = f(x1), fm = f((x0 + x1) / 2);
      const whole = (h / 6) * (fa + 4 * fm + fb);
      s += adaptSimpson(f, x0, x1, 1e-11 * Math.max(1, Math.abs(whole)), whole, fa, fb, fm, 18);
    }
    return s;
  }
  function integral(args, _m, scope) {
    let f, a, b;
    if (args.length === 3) {
      const fn = evalIn(args[0], scope);
      f = (t) => num(fn(t)); a = num(evalIn(args[1], scope)); b = num(evalIn(args[2], scope));
    } else if (args.length === 4) {
      const g = makeVarFn(args, scope, 0, 1);
      f = (t) => num(g(t)); a = num(evalIn(args[2], scope)); b = num(evalIn(args[3], scope));
    } else throw new Error('integral(expressão, x, a, b)');
    return quad(f, a, b);
  }
  integral.rawArgs = true;
  function deriv(args, _m, scope) {
    if (args.length !== 3) throw new Error('deriv(expressão, x, x0)');
    const g = makeVarFn(args, scope, 0, 1), x0 = num(evalIn(args[2], scope));
    const h = 1e-3 * Math.max(1e-3, Math.abs(x0));
    const f = (t) => num(g(t));
    return (-f(x0 + 2 * h) + 8 * f(x0 + h) - 8 * f(x0 - h) + f(x0 - 2 * h)) / (12 * h);
  }
  deriv.rawArgs = true;
  function sumLike(isProd) {
    const fn = function (args, _m, scope) {
      if (args.length !== 4) throw new Error((isProd ? 'Π' : 'Σ') + '(i, início, fim, expressão)');
      const g = makeVarFn(args, scope, 3, 0);
      const a = Math.round(num(evalIn(args[1], scope))), b = Math.round(num(evalIn(args[2], scope)));
      let s = isProd ? 1 : 0;
      for (let k = a; k <= b; k++) s = isProd ? M.multiply(s, g(k)) : M.add(s, g(k));
      return s;
    };
    fn.rawArgs = true;
    return fn;
  }
  function root(args, _m, scope) {
    if (args.length !== 4) throw new Error('root(expressão, x, a, b): procura a raiz entre a e b');
    const g = makeVarFn(args, scope, 0, 1);
    const f = (t) => num(g(t));
    let a = num(evalIn(args[2], scope)), b = num(evalIn(args[3], scope));
    let fa = f(a), fb = f(b);
    if (fa === 0) return a; if (fb === 0) return b;
    if (fa * fb > 0) throw new Error('root: a expressão não muda de sinal entre a e b');
    for (let it = 0; it < 200; it++) {
      let m = b - (fb * (b - a)) / (fb - fa); // secante com salvaguarda
      if (!(m > Math.min(a, b) && m < Math.max(a, b))) m = (a + b) / 2;
      const fm = f(m);
      if (Math.abs(fm) < 1e-15 || Math.abs(b - a) < 1e-14 * Math.max(1, Math.abs(m))) return m;
      if (fa * fm < 0) { b = m; fb = fm; } else { a = m; fa = fm; }
      const mid = (a + b) / 2, fmid = f(mid); // bissecção intercalada
      if (fa * fmid < 0) { b = mid; fb = fmid; } else { a = mid; fa = fmid; }
    }
    return (a + b) / 2;
  }
  root.rawArgs = true;
  function seFn(args, _m, scope) {
    if (args.length !== 3) throw new Error('if(condição, valor_se_verdadeiro, valor_se_falso)');
    return evalIn(args[0], scope) ? evalIn(args[1], scope) : evalIn(args[2], scope);
  }
  seFn.rawArgs = true;

  // v[i] (índice único, já somado 1): vetor coluna n×1 ou linha 1×n dá o elemento; o resto segue o math.js
  function vsub(A, k) {
    const i = num(k) - 1;
    if (M.isMatrix(A) || Array.isArray(A)) {
      const s = M.size(A).valueOf();
      if (s.length === 2 && s[1] === 1) return M.subset(A, M.index(i, 0));
      if (s.length === 2 && s[0] === 1) return M.subset(A, M.index(0, i));
    }
    if (M.isMatrix(k) || Array.isArray(k)) return M.subset(A, M.index(M.subtract(k, 1)));
    return M.subset(A, M.index(i));
  }
  M.import({ __vsub: vsub }, { override: true });
  M.import({
    Jn: mapLast(besselJ), Yn: mapLast(besselY), In: mapLast(besselI), Kn: mapLast(besselK),
    js: mapLast(sphJ), ys: mapLast(sphY),
    Her: mapLast(hermite), Leg: mapLast(legendre), Lag: mapLast((n, x) => laguerreA(n, 0, x)),
    LagA: mapLast(laguerreA), Cheb: mapLast(chebT),
    sinc: mapLast((x) => (x === 0 ? 1 : Math.sin(x) / x)),
    erfc: mapLast((x) => 1 - M.erf(x)),
    ln: (x) => nativeLog(x),
    log: (x, b) => (b === undefined ? M.log10(x) : nativeLog(x, b)),
    stdev: (v) => M.std(v, 'uncorrected'), Stdev: (v) => M.std(v),
    linterp, spline, interp: spline,
    augment, stack, rows, cols, col, row, linspace, tabelaXYZ,
    integral, deriv, root, if: seFn,
    'Σ': sumLike(false), somatorio: sumLike(false), 'Π': sumLike(true), produtorio: sumLike(true),
    deg2rad: (x) => (num(x) * Math.PI) / 180, rad2deg: (x) => (num(x) * 180) / Math.PI
  }, { override: true });

  /* ---------- Constantes físicas ---------- */
  function baseScope() {
    const s = new Map();
    s.set('c', M.speedOfLight);
    s.set('h', M.planckConstant);
    s.set('ħ', M.reducedPlanckConstant);
    s.set('k_B', M.boltzmann);
    s.set('ε_0', M.electricConstant);
    s.set('μ_0', M.magneticConstant);
    s.set('q_e', M.elementaryCharge);
    s.set('m_e', M.electronMass);
    s.set('N_A', M.avogadro);
    return s;
  }
  FC.baseScope = baseScope;

  /* ---------- LaTeX ---------- */
  const greekNames = new Set('alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu nu xi omicron pi rho sigma tau upsilon phi chi psi omega Gamma Delta Theta Lambda Xi Pi Sigma Upsilon Phi Psi Omega'.split(' '));
  function nameTex(name) {
    if (name === 'pi') return '\\pi';
    if (name === 'Infinity') return '\\infty';
    if (name === 'ħ') return '\\hbar';
    const latinExt = /[À-ɏ]/.test(name);
    const wrapName = (t) => (latinExt ? '\\textit{' + t.replace(/_/g, '\\_') + '}' : t.length > 1 ? '\\mathit{' + t.replace(/_/g, '\\_') + '}' : t);
    const nU = (name.match(/_/g) || []).length;
    if (nU > 1) return wrapName(name);
    const u = name.indexOf('_');
    let base = u >= 0 ? name.slice(0, u) : name;
    const sub = u >= 0 ? name.slice(u + 1) : '';
    const b = greekNames.has(base) ? '\\' + base : wrapName(base);
    return sub ? b + '_{' + (latinExt ? '\\text{' + sub + '}' : '\\mathrm{' + sub + '}') + '}' : b;
  }
  const builtinFns = new Set(Object.keys(M).filter((k) => typeof M[k] === 'function'));
  const BOUND_ARG = { integral: 1, deriv: 1, root: 1, minimize: 1, maximize: 1, 'Σ': 0, somatorio: 0, 'Π': 0, produtorio: 0 };
  FC.BOUND_ARG = BOUND_ARG;
  function isUnitName(n) { try { return M.Unit.isValuelessUnit(n); } catch (e) { return false; } }
  function texHandler(node, opts) {
    if (node.isSymbolNode) {
      const sc = FC._scope;
      if (sc && !sc.has(node.name) && !(node.name in M) && !(FC._texShadow && FC._texShadow.has(node.name)) && isUnitName(node.name)) return '{' + unitTex(node.name).replace(/^\\,/, '') + '}';
      return '{' + nameTex(node.name) + '}';
    }
    if (node.isFunctionNode && node.fn && node.fn.name === '__vsub') return FC.unVsub(node).toTex(opts);
    if (node.isFunctionNode && node.fn && node.fn.isSymbolNode && BOUND_ARG[node.fn.name] !== undefined && !node._shadowed) {
      const v = node.args[BOUND_ARG[node.fn.name]];
      if (v && v.isSymbolNode) {
        const prev = FC._texShadow; FC._texShadow = new Set([...(prev || []), v.name]);
        node._shadowed = true;
        try { return node.toTex(opts); } finally { node._shadowed = false; FC._texShadow = prev; }
      }
    }
    if (node.isFunctionNode && node.fn && node.fn.isSymbolNode) {
      const n = node.fn.name, a = node.args;
      const T = (x) => x.toTex(opts);
      if ((n === 'integral') && a.length === 4) return '\\int_{' + T(a[2]) + '}^{' + T(a[3]) + '}' + T(a[0]) + '\\,\\mathrm{d}' + T(a[1]);
      if ((n === 'Σ' || n === 'somatorio') && a.length === 4) return '\\sum_{' + T(a[0]) + '=' + T(a[1]) + '}^{' + T(a[2]) + '}' + T(a[3]);
      if ((n === 'Π' || n === 'produtorio') && a.length === 4) return '\\prod_{' + T(a[0]) + '=' + T(a[1]) + '}^{' + T(a[2]) + '}' + T(a[3]);
      if (n === 'deriv' && a.length === 3) return '\\left.\\frac{\\mathrm{d}}{\\mathrm{d}' + T(a[1]) + '}' + T(a[0]) + '\\right|_{' + T(a[1]) + '=' + T(a[2]) + '}';
      if (n === 'diff' && a.length === 2) return '\\frac{\\mathrm{d}}{\\mathrm{d}' + T(a[1]) + '}' + T(a[0]);
      if (n === 'sqrt' && a.length === 1) return '\\sqrt{' + T(a[0]) + '}';
      if (n === 'abs' && a.length === 1) return '\\left|' + T(a[0]) + '\\right|';
      if (/^(Jn|Yn|In|Kn|js|ys|Her|Leg|Lag|Cheb)$/.test(n) && a.length === 2) {
        const sym = { Jn: 'J', Yn: 'Y', In: 'I', Kn: 'K', js: 'j', ys: 'y', Her: 'H', Leg: 'P', Lag: 'L', Cheb: 'T' }[n];
        return sym + '_{' + T(a[0]) + '}\\left(' + T(a[1]) + '\\right)';
      }
      if (typeof M[n] !== 'function' || n === 'if') return nameTex(n) + '\\left(' + a.map(T).join(',\\,') + '\\right)';
    }
    if (node.isOperatorNode && node.fn === 'to') return node.args[0].toTex(opts) + '\\;\\text{em}\\;' + node.args[1].toTex(opts);
    if (node.isIndexNode && node.dotNotation && node.dimensions[0] && node.dimensions[0].isConstantNode) return '.' + nameTex(String(node.dimensions[0].value));
    if (node.isIndexNode && !node.dotNotation) {
      // mostra o índice como subscrito na base 0
      const dims = node.dimensions.map((d) => (d.isOperatorNode && d.fn === 'add' && d.args[1].isConstantNode && d.args[1].value === 1 ? d.args[0] : d));
      return '_{' + dims.map((d) => d.toTex(opts)).join(',') + '}';
    }
    return undefined;
  }
  function tex(node) {
    try { return node.toTex({ parenthesis: 'keep', implicit: 'hide', handler: texHandler }); }
    catch (e) { return '\\text{' + String(node).replace(/[{}\\]/g, '') + '}'; }
  }
  FC.tex = tex;
  FC.nameTexOf = nameTex;

  function numTex(x) {
    if (Number.isNaN(x)) return '\\text{NaN}';
    if (!isFinite(x)) return x > 0 ? '\\infty' : '-\\infty';
    if (x === 0) return '0';
    const a = Math.abs(x);
    if (Number.isInteger(x) && a < 1e15) return String(x);
    if (a >= 1e6 || a < 1e-3) {
      const e = Math.floor(Math.log10(a));
      let m = x / Math.pow(10, e);
      let ms = String(Number(m.toPrecision(6)));
      if (ms === '10' || ms === '-10') { ms = x < 0 ? '-1' : '1'; return ms + '\\times 10^{' + (e + 1) + '}'; }
      return ms + '\\times 10^{' + e + '}';
    }
    return String(Number(x.toPrecision(6)));
  }
  FC.numTex = numTex;
  function numStr(x) {
    if (typeof x !== 'number') x = num(x);
    if (!isFinite(x)) return String(x);
    if (x === 0) return '0';
    const a = Math.abs(x);
    if (a >= 1e6 || a < 1e-4) return x.toExponential(9).replace(/\.?0+e/, 'e');
    return String(Number(x.toPrecision(10)));
  }
  FC.numStr = numStr;
  function unitTex(u) {
    return '\\,\\mathrm{' + u
      .replace(/\bu(?=[a-zA-Z])/g, '\\mu ')
      .replace(/\^\s*\(?(-?\d+(\.\d+)?)\)?/g, '^{$1}')
      .replace(/\s*\*\s*/g, '\\cdot ')
      .replace(/\s*\/\s*/g, '/')
      .replace(/ohm/g, '\\Omega') + '}';
  }
  function scalarTex(v) {
    if (typeof v === 'number') return numTex(v);
    if (typeof v === 'boolean') return v ? '\\text{verdadeiro}' : '\\text{falso}';
    if (M.isComplex(v)) {
      if (Math.abs(v.im) < 1e-15 * Math.max(1, Math.abs(v.re))) return numTex(v.re);
      const re = v.re, im = v.im;
      const imS = numTex(Math.abs(im)) + '\\,i';
      if (Math.abs(re) < 1e-15 * Math.abs(im)) return (im < 0 ? '-' : '') + imS;
      return numTex(re) + (im < 0 ? ' - ' : ' + ') + imS;
    }
    if (M.isUnit(v)) {
      if (v.value == null) return unitTex(v.formatUnits()).replace(/^\\,/, '');
      const s = M.format(v, { precision: 6 });
      const sp = s.indexOf(' ');
      const n = sp > 0 ? s.slice(0, sp) : s, u = sp > 0 ? s.slice(sp + 1) : '';
      const nv = Number(n);
      return (isNaN(nv) ? '\\text{' + n + '}' : numTex(nv)) + (u ? unitTex(u) : '');
    }
    if (M.isBigNumber(v) || M.isFraction(v)) return numTex(Number(v));
    if (typeof v === 'function') return '\\text{função}';
    if (typeof v === 'string') return '\\text{“' + v.replace(/[{}\\$&#^_%~]/g, '') + '”}';
    if (v && v.isNode) return tex(v);
    return '\\text{' + String(v).replace(/[{}\\$&#^_%~]/g, '') + '}';
  }
  function valTex(v) {
    if (M.isMatrix(v) || Array.isArray(v)) {
      let a = toArr(v);
      if (a.length === 0) return '\\left[\\;\\right]';
      if (!Array.isArray(a[0])) a = a.map((e) => [e]);
      const R = a.length, C = a[0].length;
      const rIdx = R > 10 ? [0, 1, 2, 3, 4, 5, -1, R - 1] : [...Array(R).keys()];
      const cIdx = C > 8 ? [0, 1, 2, 3, 4, -1, C - 1] : [...Array(C).keys()];
      const lines = rIdx.map((i) => cIdx.map((j) => (i < 0 ? (j < 0 ? '\\ddots' : '\\vdots') : j < 0 ? '\\cdots' : scalarTex(a[i][j]))).join(' & '));
      return '\\begin{bmatrix}' + lines.join('\\\\') + '\\end{bmatrix}' + (R > 10 || C > 8 ? '\\;{\\scriptstyle ' + R + '\\times' + C + '}' : '');
    }
    return scalarTex(v);
  }
  FC.valTex = valTex;

  /* ---------- Mensagens de erro em português ---------- */
  function ptError(e) {
    let m = (e && e.message) || String(e);
    m = m.replace(/^Undefined symbol (.+)$/, '“$1” não está definido. Defina antes (acima ou à esquerda).')
      .replace(/^Undefined function (.+)$/, 'A função “$1” não está definida.')
      .replace(/^Unexpected end of expression.*/, 'A expressão está incompleta.')
      .replace(/^Parenthesis \) expected.*/, 'Falta fechar um parêntese “)”.')
      .replace(/^Value expected.*/, 'Falta um valor na expressão.')
      .replace(/^Unexpected operator (.+?) \(char.*/, 'Operador “$1” fora do lugar.')
      .replace(/^Units do not match.*/, 'As unidades não são compatíveis.')
      .replace(/^Dimension mismatch.*/, 'As dimensões (tamanhos) não são compatíveis.')
      .replace(/^Index out of range.*/, 'Índice fora do intervalo (os índices começam em 0).')
      .replace(/^Too many arguments in function (.+?) \(.*/, 'Argumentos demais na função $1.')
      .replace(/^Too few arguments in function (.+?) \(.*/, 'Faltam argumentos na função $1.')
      .replace(/^Unexpected type of argument in function (.+?) \(.*/, 'Tipo de argumento inesperado em $1 (vetor onde se esperava número?).');
    return m;
  }
  FC.ptError = ptError;

  /* ---------- Sessão de cálculo (uma passada pela folha) ---------- */
  class Session {
    constructor() {
      this.scope = baseScope();
      this.ranges = new Map(); // nome -> array de valores
      this.defs = new Map(); // nome da função -> {params, body}
    }
    /* Nome não definido que coincide com unidade (m, s, Pg…) só vale como unidade junto de um número */
    checkUnits(node) {
      const shadow = new Set(), bad = [];
      let hasNumUnit = false, hasTo = false;
      node.traverse((n) => {
        if (n.isFunctionAssignmentNode) n.params.forEach((p) => shadow.add(p));
        if (n.isFunctionNode && n.fn && n.fn.isSymbolNode && BOUND_ARG[n.fn.name] !== undefined) {
          const a = n.args[BOUND_ARG[n.fn.name]]; if (a && a.isSymbolNode) shadow.add(a.name);
        }
        if (n.isOperatorNode && n.fn === 'to') hasTo = true;
        if (n.isOperatorNode && n.implicit && n.args[0] && (n.args[0].isConstantNode || (n.args[0].isOperatorNode && n.args[0].fn === 'unaryMinus' && n.args[0].args[0].isConstantNode))) hasNumUnit = true;
        if (n.isSymbolNode && !shadow.has(n.name) && !this.scope.has(n.name) && !(n.name in M) && isUnitName(n.name)) bad.push(n.name);
      });
      if (bad.length && !hasNumUnit && !hasTo) {
        const u = bad[0];
        throw new Error('“' + u + '” não está definido. (Também é o nome de uma unidade; para usá-la como unidade escreva junto de um número, ex.: 2 ' + u + '.)');
      }
    }
    rangesIn(node) {
      const names = new Set(), shadow = new Set();
      node.traverse((n) => {
        if (n.isFunctionAssignmentNode) n.params.forEach((p) => shadow.add(p));
        if (n.isSymbolNode && this.ranges.has(n.name) && !shadow.has(n.name)) names.add(n.name);
      });
      return [...names];
    }
    evalNode(node, scope) {
      scope = scope || this.scope;
      this.checkUnits(node);
      const rv = this.rangesIn(node);
      if (rv.length === 0) return node.compile().evaluate(scope);
      if (rv.length > 1) throw new Error('A expressão usa duas variáveis de intervalo (' + rv.join(', ') + '). Use uma tabela, um mapa de calor ou tabelaXYZ.');
      const name = rv[0], vals = this.ranges.get(name), code = node.compile(), ov = new Overlay(scope), out = [];
      for (const v of vals) { ov.set(name, v); out.push(code.evaluate(ov)); }
      return M.matrix(out);
    }
    makeRange(rhs) {
      const parts = splitTop(rhs, '..');
      if (parts.length !== 2) return null;
      const left = splitTop(parts[0], ',');
      if (left.length > 2) return null;
      const a = this.evalNode(parse(left[0])), c = this.evalNode(parse(parts[1]));
      let step;
      if (left.length === 2) step = M.subtract(this.evalNode(parse(left[1])), a);
      else step = M.isUnit(a) ? M.multiply(1, M.unit(1, a.formatUnits())) : 1;
      const n = Math.floor(num(M.divide(M.subtract(c, a), step)) + 1e-9);
      if (!(n >= 0)) throw new Error('Intervalo vazio: confira início, segundo valor e fim.');
      if (n > 2e6) throw new Error('Intervalo grande demais (' + (n + 1) + ' valores).');
      const vals = [];
      for (let k = 0; k <= n; k++) vals.push(M.add(a, M.multiply(k, step)));
      return { vals, a, step, c };
    }
    inline(node, depth) {
      depth = depth || 0;
      if (depth > 30) throw new Error('Definições recursivas demais para expandir.');
      const self = this;
      const out = node.transform(function (n) {
        if (n.isFunctionNode && n.fn && n.fn.isSymbolNode && self.defs.has(n.fn.name)) {
          const d = self.defs.get(n.fn.name);
          if (d.params.length !== n.args.length) return n;
          const args = n.args.map((a) => self.inline(a, depth + 1));
          const body = d.body.transform((m) => {
            if (m.isSymbolNode) { const i = d.params.indexOf(m.name); if (i >= 0) return new M.ParenthesisNode(args[i]); }
            return m;
          });
          return self.inline(new M.ParenthesisNode(body), depth + 1);
        }
        return n;
      });
      return out;
    }
    symbolic(node) {
      let n = this.inline(node);
      n = n.transform((m) => {
        if (m.isFunctionNode && m.fn && m.fn.isSymbolNode && m.fn.name === 'diff' && m.args.length === 2 && m.args[1].isSymbolNode) {
          return M.derivative(m.args[0], m.args[1].name);
        }
        if (m.isFunctionNode && m.fn && m.fn.isSymbolNode && m.fn.name === 'expandir' && m.args.length === 1) {
          try { return M.rationalize(m.args[0]); } catch (e) { return m.args[0]; }
        }
        return m;
      });
      let s;
      try { s = M.simplify(n); } catch (e) { s = n; }
      return s;
    }
    /* Processa uma linha; devolve {kind, tex, res, err, note} */
    line(raw) {
      const [body, desc] = FC.splitComment(raw);
      const r = this.line0(body);
      if (desc && r && r.kind !== 'comment' && r.kind !== 'empty') { r.desc = desc; r.note = r.note ? r.note + ' · ' + desc : desc; }
      return r;
    }
    line0(raw) {
      FC._scope = this.scope;
      const s = normalize(raw).trim();
      if (!s) return { kind: 'empty' };
      if (s.startsWith('//')) return { kind: 'comment', text: raw.trim().slice(2).trim() };
      try {
        if (/->\s*$/.test(s)) {
          const node = parse(s.replace(/->\s*$/, ''));
          const r = this.symbolic(node);
          return { kind: 'sym', tex: tex(node), res: tex(r) };
        }
        const di = findTop(s, ':=');
        if (di >= 0) {
          const lhs = s.slice(0, di).trim();
          let rhs = s.slice(di + 2).trim();
          let show = false;
          if (/[^=<>!]=\s*$/.test(rhs) && !/==\s*$/.test(rhs)) { show = true; rhs = rhs.replace(/=\s*$/, '').trim(); }
          if (!lhs || !rhs) throw new Error('Definição incompleta: use nome := expressão');
          const lnode = lhsParse(lhs);
          // variável de intervalo
          if (lnode.isSymbolNode && findTop(rhs, '..') >= 0) {
            const r = this.makeRange(rhs);
            if (r) {
              this.ranges.set(lnode.name, r.vals);
              this.scope.set(lnode.name, M.matrix(r.vals));
              const t = nameTex(lnode.name) + '\\coloneqq ' + scalarTex(r.a) + ',\\,' + scalarTex(M.add(r.a, r.step)) + '\\,..\\,' + scalarTex(r.c);
              return { kind: 'range', tex: t, note: r.vals.length + ' valores', name: lnode.name };
            }
          }
          // função
          if (lnode.isFunctionNode && lnode.fn.isSymbolNode) {
            const params = lnode.args.map((a) => { if (!a.isSymbolNode) throw new Error('Os parâmetros da função devem ser nomes, ex.: f(x, y)'); return a.name; });
            const body = parse(rhs);
            const fname = lnode.fn.name;
            const node = new M.FunctionAssignmentNode(fname, params, body);
            node.compile().evaluate(this.scope);
            this.defs.set(fname, { params, body });
            this.ranges.delete(fname);
            FC._texShadow = new Set(params);
            let t;
            try { t = tex(lnode) + '\\coloneqq ' + tex(body); } finally { FC._texShadow = null; }
            return { kind: 'fdef', tex: t, name: fname };
          }
          // elemento de vetor/matriz com variável de intervalo: v[i] := ...
          if (lnode.isAccessorNode && lnode.object.isSymbolNode) {
            const body = parse(rhs);
            const idx = lnode.index.dimensions.map((d) => (d.isOperatorNode && d.fn === 'add' ? d.args[0] : d));
            const rnames = idx.map((d) => (d.isSymbolNode && this.ranges.has(d.name) ? d.name : null));
            if (rnames.every((x) => x)) {
              const code = body.compile(), ov = new Overlay(this.scope);
              let val;
              if (rnames.length === 1) {
                const out = [];
                for (const v of this.ranges.get(rnames[0])) { ov.set(rnames[0], v); out[Math.round(num(v))] = code.evaluate(ov); }
                for (let k = 0; k < out.length; k++) if (out[k] === undefined) out[k] = 0;
                val = M.matrix(out);
              } else if (rnames.length === 2) {
                const out = [];
                for (const vi of this.ranges.get(rnames[0])) {
                  ov.set(rnames[0], vi); const i = Math.round(num(vi)); out[i] = out[i] || [];
                  for (const vj of this.ranges.get(rnames[1])) { ov.set(rnames[1], vj); out[i][Math.round(num(vj))] = code.evaluate(ov); }
                }
                const C = Math.max(...out.map((r) => (r ? r.length : 0)));
                for (let i = 0; i < out.length; i++) { out[i] = out[i] || []; for (let j = 0; j < C; j++) if (out[i][j] === undefined) out[i][j] = 0; }
                val = M.matrix(out);
              } else throw new Error('Use no máximo dois índices.');
              const nm = lnode.object.name;
              this.scope.set(nm, val); this.ranges.delete(nm); this.defs.delete(nm);
              return { kind: 'vdef', tex: tex(lnode) + '\\coloneqq ' + tex(body), res: show ? valTex(val) : null, name: nm };
            }
          }
          if (!lnode.isSymbolNode) throw new Error('À esquerda de := deve haver um nome, uma função f(x) ou um elemento v[i].');
          const body = parse(rhs);
          if (FC.overrides && FC.overrides.has(lnode.name)) {
            const ov = FC.overrides.get(lnode.name);
            this.scope.set(lnode.name, ov); this.ranges.delete(lnode.name); this.defs.delete(lnode.name);
            return { kind: 'vdef', tex: nameTex(lnode.name) + '\\coloneqq ' + valTex(ov), res: null, name: lnode.name, note: 'valor do quadro' };
          }
          const val = this.evalNode(body);
          this.scope.set(lnode.name, val);
          this.ranges.delete(lnode.name); this.defs.delete(lnode.name);
          return { kind: 'vdef', tex: nameTex(lnode.name) + '\\coloneqq ' + tex(body), res: show ? valTex(val) : null, name: lnode.name };
        }
        if (/[^=<>!:]=\s*$/.test(s) || /^=\s*$/.test(s)) {
          const e = s.replace(/=\s*$/, '');
          const node = parse(e);
          const val = this.evalNode(node);
          return { kind: 'eval', tex: tex(node), res: valTex(val), value: val };
        }
        // expressão solta: avalia e mostra como Mathcad faria com "="
        const node = parse(s);
        if (node.isAssignmentNode || node.isFunctionAssignmentNode) throw new Error('Para definir use := (ex.: f(x) := 3·x). Para ver o valor, termine com =.');
        return { kind: 'expr', tex: tex(node), note: 'termine com = para ver o valor' };
      } catch (e) {
        return { kind: 'error', raw: raw, err: ptError(e) };
      }
    }
    /* Avalia uma expressão (texto) num escopo, com variável(is) dada(s) */
    compileExpr(str) { return parse(normalize(str)).compile(); }
    evalScalar(str) { const s = normalize(String(str || '')).trim(); if (!s) return NaN; return num(this.evalNode(parse(s))); }
    values(name) { return this.ranges.has(name) ? this.ranges.get(name) : null; }
  }
  FC.Session = Session;
})();
