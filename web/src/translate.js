/* Folha de Cálculo — exporta a folha para Python (NumPy/SciPy/Matplotlib) ou MATLAB */
'use strict';
(function () {
  const FC = window.FC;
  const M = FC.M;
  const { normalize, findTop, splitTop } = FC;

  const CONSTS = {
    c: ['speedOfLight', 'velocidade da luz'], h: ['planckConstant', 'constante de Planck'], 'ħ': ['reducedPlanckConstant', 'ħ'],
    k_B: ['boltzmann', 'Boltzmann'], 'ε_0': ['electricConstant', 'permissividade do vácuo'], 'μ_0': ['magneticConstant', 'permeabilidade do vácuo'],
    q_e: ['elementaryCharge', 'carga elementar'], m_e: ['electronMass', 'massa do elétron'], N_A: ['avogadro', 'Avogadro']
  };
  const GREEK = { 'α': 'alpha', 'β': 'beta', 'γ': 'gamma', 'δ': 'delta', 'ε': 'epsilon', 'ζ': 'zeta', 'η': 'eta', 'θ': 'theta', 'ι': 'iota', 'κ': 'kappa', 'λ': 'lambda', 'μ': 'mu', 'ν': 'nu', 'ξ': 'xi', 'ο': 'omicron', 'π': 'pi', 'ρ': 'rho', 'σ': 'sigma', 'ς': 'sigma', 'τ': 'tau', 'υ': 'upsilon', 'φ': 'phi', 'χ': 'chi', 'ψ': 'psi', 'ω': 'omega', 'Γ': 'Gamma', 'Δ': 'Delta', 'Θ': 'Theta', 'Λ': 'Lambda', 'Ξ': 'Xi', 'Π': 'Pi', 'Σ': 'Sigma', 'Φ': 'Phi', 'Ψ': 'Psi', 'Ω': 'Omega', 'ħ': 'hbar' };
  const PY_RESERVED = new Set('False None True and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield np special integrate optimize interpolate plt print sum max min abs range'.split(' '));
  const M_RESERVED = new Set('break case catch classdef continue else elseif end for function global if otherwise parfor persistent return spmd switch try while i j pi e eps inf nan sum max min abs mean disp plot figure'.split(' '));

  function isUnitName(n) { try { return M.Unit.isValuelessUnit(n); } catch (e) { return false; } }
  function numLit(x) {
    if (typeof x !== 'number') x = Number(x);
    if (!isFinite(x)) return null;
    if (Number.isInteger(x) && Math.abs(x) < 1e15) return String(x);
    return String(x);
  }

  class Emitter {
    constructor(lang) {
      this.lang = lang; this.py = lang === 'py';
      this.defined = new Set(Object.keys(CONSTS)); this.ranges = new Set();
      this.locals = null; this.growing = null; this.helpers = new Set(); this.nested = []; this.warn = new Set();
    }
    name(n) {
      if (this.py && this.alias && this.alias.has(n)) return this.alias.get(n);
      if (this.py) return PY_RESERVED.has(n) ? n + '_' : n.replace(/[^\p{L}\p{N}_]/gu, '_');
      if (this.alias && this.alias.has(n)) return this.alias.get(n);
      let s = '';
      for (const ch of n.normalize('NFD').replace(/[\u0300-\u036f]/g, '')) s += GREEK[ch] ? (s && !s.endsWith('_') ? '_' : '') + GREEK[ch] : /[A-Za-z0-9_]/.test(ch) ? ch : '';
      if (!/^[A-Za-z]/.test(s)) s = 'v' + s;
      if (M_RESERVED.has(s)) s += '_';
      if (this.progLocals && this.progLocals.has(n)) s += '_L';
      return s.slice(0, 60);
    }
    known(n) { return (this.locals && this.locals.has(n)) || this.defined.has(n); }
    /* Subárvore só com números e unidades (ex.: 532 nm, 10 W/cm^2) vira número em SI */
    unitLiteral(node) {
      let hasUnit = false, ok = true;
      node.traverse((n) => {
        if (n.isSymbolNode) { if (!this.known(n.name) && isUnitName(n.name) && !(n.name in M)) hasUnit = true; else ok = false; }
        else if (n.isFunctionNode || n.isAccessorNode || n.isArrayNode) ok = false;
      });
      if (!ok || !hasUnit) return null;
      try {
        const v = node.compile().evaluate({});
        const si = M.isUnit(v) ? v.value : FC.num(v);
        const s = numLit(si);
        return s === null ? null : s;
      } catch (e) { return null; }
    }
    siFactor(unitNode) {
      try { const u = unitNode.compile().evaluate({}); return M.isUnit(u) ? numLit(M.unit(1, u.formatUnits()).value) : '1'; } catch (e) { return '1'; }
    }
    help(h) { this.helpers.add(h); }
    lambda(v, body) { return this.py ? '(lambda ' + this.name(v) + ': ' + body + ')' : '@(' + this.name(v) + ') ' + body; }
    expr(node) {
      const py = this.py;
      if (node.isParenthesisNode) return '(' + this.expr(node.content) + ')';
      if (node.isOperatorNode || node.isSymbolNode) {
        const lit = node.isOperatorNode ? this.unitLiteral(node) : null;
        if (lit !== null) return lit;
      }
      if (node.isConstantNode) {
        const v = node.value;
        if (typeof v === 'number') return numLit(v) ?? (py ? 'np.inf' : 'Inf');
        if (typeof v === 'string') return py ? JSON.stringify(v) : "'" + v.replace(/'/g, "''") + "'";
        if (typeof v === 'boolean') return py ? (v ? 'True' : 'False') : (v ? 'true' : 'false');
        return String(v);
      }
      if (node.isSymbolNode) {
        const n = node.name;
        if (this.alias && this.alias.has(n)) return this.alias.get(n);
        if (this.known(n)) return this.name(n);
        const special = { pi: py ? 'np.pi' : 'pi', e: py ? 'np.e' : 'exp(1)', i: py ? '1j' : '1i', Infinity: py ? 'np.inf' : 'Inf', NaN: py ? 'np.nan' : 'NaN', true: py ? 'True' : 'true', false: py ? 'False' : 'false' };
        if (special[n]) return special[n];
        if (isUnitName(n)) { const s = this.unitLiteral(node); if (s !== null) return s; }
        return this.name(n);
      }
      if (node.isOperatorNode) return this.op(node);
      if (node.isFunctionNode && node.fn && node.fn.name === '__vsub') return this.expr(FC.unVsub(node));
      if (node.isFunctionNode) return this.fn(node);
      if (node.isAccessorNode && node.index.dotNotation) return this.expr(node.object) + '.' + this.name(String(node.index.dimensions[0].value));
      if (node.isAccessorNode) {
        const dims = node.index.dimensions.map((d) => (d.isOperatorNode && d.fn === 'add' && d.args[1].isConstantNode && d.args[1].value === 1 ? d.args[0] : d));
        const obj = this.expr(node.object);
        const all = (d) => d.isRangeNode; // T[j] de tabela de dados = T[:, j]
        if (py) return obj + '[' + dims.map((d) => (all(d) ? ':' : 'int(' + this.expr(d) + ')')).join(', ') + ']';
        return obj + '(' + dims.map((d) => (all(d) ? ':' : this.expr(d) + '+1')).join(', ') + ')';
      }
      if (node.isArrayNode) {
        const rows = node.items;
        const is2D = rows.length && rows[0].isArrayNode;
        if (!is2D) return py ? 'np.array([' + rows.map((r) => this.expr(r)).join(', ') + '])' : '[' + rows.map((r) => this.expr(r)).join(', ') + ']';
        const colVec = rows.every((r) => r.items.length === 1);
        if (py) return colVec ? 'np.array([' + rows.map((r) => this.expr(r.items[0])).join(', ') + '])' : 'np.array([' + rows.map((r) => '[' + r.items.map((x) => this.expr(x)).join(', ') + ']').join(', ') + '])';
        return '[' + rows.map((r) => r.items.map((x) => this.expr(x)).join(', ')).join('; ') + ']';
      }
      if (node.isConditionalNode) {
        if (py) return '(' + this.expr(node.trueExpr) + ' if ' + this.expr(node.condition) + ' else ' + this.expr(node.falseExpr) + ')';
        this.help('ifelse'); return 'ifelse_(' + this.expr(node.condition) + ', ' + this.expr(node.trueExpr) + ', ' + this.expr(node.falseExpr) + ')';
      }
      if (node.isRangeNode) return py ? 'np.arange(' + this.expr(node.start) + ', ' + this.expr(node.end) + ' + 1)' : this.expr(node.start) + ':' + this.expr(node.end);
      this.warn.add('Trecho não traduzido: ' + node.toString());
      return py ? 'None  # ' + node.toString() : 'NaN /* ' + node.toString() + ' */';
    }
    op(node) {
      const py = this.py, a = node.args;
      const P = { or: 1, and: 2, not: 3, equal: 4, unequal: 4, smaller: 4, larger: 4, smallerEq: 4, largerEq: 4, add: 5, subtract: 5, multiply: 6, divide: 6, mod: 6, dotMultiply: 6, dotDivide: 6, unaryMinus: 7, unaryPlus: 7, pow: 8, dotPow: 8 };
      const wrap = (child, right) => {
        const s = this.expr(child);
        if (child.isOperatorNode && P[child.fn] !== undefined && P[node.fn] !== undefined && this.unitLiteral(child) === null) {
          if (P[child.fn] < P[node.fn] || (right && P[child.fn] === P[node.fn] && /subtract|divide|pow|mod/.test(node.fn))) return '(' + s + ')';
          if (node.fn === 'pow' && child.fn.startsWith('unary') && !right) return '(' + s + ')';
        }
        return s;
      };
      if (node.fn === 'to') return '(' + this.expr(a[0]) + ') / ' + this.siFactor(a[1]);
      const bin = {
        add: '+', subtract: '-', multiply: py ? '*' : '.*', divide: py ? '/' : './', pow: py ? '**' : '.^', dotMultiply: py ? '*' : '.*', dotDivide: py ? '/' : './', dotPow: py ? '**' : '.^',
        equal: '==', unequal: py ? '!=' : '~=', smaller: '<', larger: '>', smallerEq: '<=', largerEq: '>=', and: py ? ' and ' : ' & ', or: py ? ' or ' : ' | '
      };
      if (node.fn === 'unaryMinus') return '-' + wrap(a[0]);
      if (node.fn === 'unaryPlus') return wrap(a[0]);
      if (node.fn === 'not') return (py ? 'not ' : '~') + wrap(a[0]);
      if (node.fn === 'mod') return py ? wrap(a[0]) + ' % ' + wrap(a[1], true) : 'mod(' + this.expr(a[0]) + ', ' + this.expr(a[1]) + ')';
      if (node.fn === 'factorial') return py ? 'special.factorial(' + this.expr(a[0]) + ')' : 'factorial(' + this.expr(a[0]) + ')';
      if (node.fn === 'transpose') return py ? 'np.transpose(' + this.expr(a[0]) + ')' : '(' + this.expr(a[0]) + ").'";
      const sym = bin[node.fn];
      if (sym && a.length === 2) {
        const tight = /^(multiply|divide|pow|dotMultiply|dotDivide|dotPow)$/.test(node.fn);
        const opS = sym.trim();
        return wrap(a[0]) + (tight ? opS : ' ' + opS + ' ') + wrap(a[1], true);
      }
      this.warn.add('Operador não traduzido: ' + node.op);
      return '(' + a.map((x) => this.expr(x)).join(' ' + node.op + ' ') + ')';
    }
    fn(node) {
      const py = this.py, n = node.fn.isSymbolNode ? node.fn.name : null, a = node.args, E = (x) => this.expr(x);
      const args = () => a.map(E).join(', ');
      if (!n) return E(node.fn) + '(' + args() + ')';
      if (this.known(n)) return this.name(n) + '(' + args() + ')';
      const bound = (iVar, iExpr) => { const v = a[iVar].name; const prev = this.locals; this.locals = new Set([...(prev || []), v]); const body = E(a[iExpr]); const nm = this.name(v); this.locals = prev; return { v, body, nm }; };
      switch (n) {
        case 'integral': {
          if (a.length === 3) { this.help('integral'); return py ? '_integral(' + E(a[0]) + ', ' + E(a[1]) + ', ' + E(a[2]) + ')' : 'integral(' + E(a[0]) + ', ' + E(a[1]) + ', ' + E(a[2]) + ", 'ArrayValued', true)"; }
          const b = bound(1, 0);
          if (py) { this.help('integral'); return '_integral(lambda ' + b.nm + ': ' + b.body + ', ' + E(a[2]) + ', ' + E(a[3]) + ')'; }
          return 'integral(@(' + b.nm + ') ' + b.body + ', ' + E(a[2]) + ', ' + E(a[3]) + ", 'ArrayValued', true)";
        }
        case 'deriv': { const b = bound(1, 0); this.help('deriv'); return py ? '_deriv(lambda ' + b.nm + ': ' + b.body + ', ' + E(a[2]) + ')' : 'deriv_(@(' + b.nm + ') ' + b.body + ', ' + E(a[2]) + ')'; }
        case 'root': { const b = bound(1, 0); return py ? 'optimize.brentq(lambda ' + b.nm + ': ' + b.body + ', ' + E(a[2]) + ', ' + E(a[3]) + ', xtol=1e-14)' : 'fzero(@(' + b.nm + ') ' + b.body + ', [' + E(a[2]) + ', ' + E(a[3]) + '])'; }
        case 'minimize': case 'maximize': {
          const b = bound(1, 0), sg = n === 'maximize' ? '-' : '';
          return py ? "optimize.minimize_scalar(lambda " + b.nm + ': ' + sg + '(' + b.body + '), bounds=(' + E(a[2]) + ', ' + E(a[3]) + "), method='bounded', options={'xatol': 1e-12}).x" : 'fminbnd(@(' + b.nm + ') ' + sg + '(' + b.body + '), ' + E(a[2]) + ', ' + E(a[3]) + ')';
        }
        case 'Σ': case 'somatorio': case 'Π': case 'produtorio': {
          const b = bound(0, 3), prod = n === 'Π' || n === 'produtorio';
          if (py) return (prod ? 'np.prod([' : 'sum(') + b.body + ' for ' + b.nm + ' in range(int(' + E(a[1]) + '), int(' + E(a[2]) + ') + 1)' + (prod ? '])' : ')');
          return (prod ? 'prod' : 'sum') + '(arrayfun(@(' + b.nm + ') ' + b.body + ', ' + E(a[1]) + ':' + E(a[2]) + '))';
        }
        case 'if': if (py) return '(' + E(a[1]) + ' if ' + E(a[0]) + ' else ' + E(a[2]) + ')'; this.help('ifelse'); return 'ifelse_(' + args() + ')';
        case 'pchip': case 'akima': {
          if (py) { this.help('_interp1'); return "_interp1(" + E(a[0]) + ', ' + E(a[1]) + ", '" + n + "')(" + E(a[2]) + ')'; }
          return 'interp1(' + E(a[0]) + '(:), ' + E(a[1]) + '(:), ' + E(a[2]) + ", '" + (n === 'akima' ? 'makima' : 'pchip') + "', 'extrap')";
        }
        case 'interp2D': {
          const meth = a[3] ? "'" + (a[3].isSymbolNode ? a[3].name : String(a[3].value)) + "'" : "'linear'";
          if (py) { this.help('_interp2D'); return '_interp2D(' + E(a[0]) + ', ' + meth + ')(' + E(a[1]) + ', ' + E(a[2]) + ')'; }
          this.help('interp2D_'); return 'interp2D_(' + E(a[0]) + ', ' + E(a[1]) + ', ' + E(a[2]) + ')';
        }
        case 'tabelar': {
          const meth = a[4] ? "'" + (a[4].isSymbolNode ? a[4].name : String(a[4].value)) + "'" : "'spline'";
          if (py) { this.help('_interp1'); this.help('_tabelar'); return '_tabelar(' + E(a[0]) + ', ' + E(a[1]) + ', ' + E(a[2]) + ', ' + E(a[3]) + ', ' + meth + ')'; }
          this.help('tabelar_'); return 'tabelar_(' + E(a[0]) + ', ' + E(a[1]) + ', ' + E(a[2]) + ', ' + E(a[3]) + ', ' + meth + ')';
        }
        case 'diff': case 'expandir': this.warn.add('Derivada/expansão simbólica não exportada.'); return py ? 'None' : 'NaN';
      }
      const MAP_PY = {
        sin: 'np.sin', cos: 'np.cos', tan: 'np.tan', asin: 'np.arcsin', acos: 'np.arccos', atan: 'np.arctan', atan2: 'np.arctan2', sinh: 'np.sinh', cosh: 'np.cosh', tanh: 'np.tanh', asinh: 'np.arcsinh', acosh: 'np.arccosh', atanh: 'np.arctanh',
        sec: '1/np.cos', csc: '1/np.sin', cot: '1/np.tan',
        sqrt: 'np.emath.sqrt', exp: 'np.exp', abs: 'np.abs', ln: 'np.emath.log', log10: 'np.log10', log2: 'np.log2', floor: 'np.floor', ceil: 'np.ceil', round: 'np.round', sign: 'np.sign',
        re: 'np.real', im: 'np.imag', conj: 'np.conj', arg: 'np.angle', mod: 'np.mod',
        gamma: 'special.gamma', erf: 'special.erf', erfc: 'special.erfc',
        Jn: 'special.jv', Yn: 'special.yv', In: 'special.iv', Kn: 'special.kv', js: 'special.spherical_jn', ys: 'special.spherical_yn',
        Her: 'special.eval_hermite', Lag: 'special.eval_laguerre', LagA: 'special.eval_genlaguerre', Leg: 'special.eval_legendre', Cheb: 'special.eval_chebyt',
        mean: 'np.mean', median: 'np.median', max: 'np.max', min: 'np.min', sum: 'np.sum', prod: 'np.prod', std: 'np.std', stdev: 'np.std',
        inv: 'np.linalg.inv', det: 'np.linalg.det', cross: 'np.cross', dot: 'np.dot', transpose: 'np.transpose', identity: 'np.eye', linspace: 'np.linspace', size: 'np.shape',
        rows: '_rows', cols: '_cols', augment: '_augment', stack: '_stack', col: '_col', row: '_row', tabelaXYZ: 'tabelaXYZ', polyroots: '_polyroots', rkfixed: '_rkfixed', Rkadapt: '_rkadapt', sinc: '_sinc', linterp: '_linterp', spline: '_spline', interp: '_spline', deg2rad: 'np.deg2rad', rad2deg: 'np.rad2deg', zeros: '_zeros', ones: '_ones'
      };
      const MAP_M = {
        sin: 'sin', cos: 'cos', tan: 'tan', asin: 'asin', acos: 'acos', atan: 'atan', atan2: 'atan2', sinh: 'sinh', cosh: 'cosh', tanh: 'tanh', asinh: 'asinh', acosh: 'acosh', atanh: 'atanh', sec: 'sec', csc: 'csc', cot: 'cot',
        sqrt: 'sqrt', exp: 'exp', abs: 'abs', ln: 'log', log10: 'log10', log2: 'log2', floor: 'floor', ceil: 'ceil', round: 'round', sign: 'sign', re: 'real', im: 'imag', conj: 'conj', arg: 'angle', mod: 'mod',
        gamma: 'gamma', erf: 'erf', erfc: 'erfc', Jn: 'besselj', Yn: 'bessely', In: 'besseli', Kn: 'besselk', js: 'sphj_', ys: 'sphy_',
        Her: 'her_', Lag: 'lag_', LagA: 'laga_', Leg: 'leg_', Cheb: 'cheb_',
        mean: 'mean', median: 'median', max: 'max', min: 'min', sum: 'sum', prod: 'prod', inv: 'inv', det: 'det', cross: 'cross', dot: 'dot', transpose: 'transpose', identity: 'eye', linspace: 'linspace', size: 'size', zeros: 'zeros', ones: 'ones',
        rows: 'rows_', cols: 'cols_', augment: 'augment_', stack: 'stack_', col: 'col_', row: 'row_', tabelaXYZ: 'tabelaXYZ_', polyroots: 'polyroots_', rkfixed: 'rkfixed_', Rkadapt: 'rkadapt_', sinc: 'sinc_', linterp: 'linterp_', spline: 'spline_', interp: 'spline_', deg2rad: 'deg2rad', rad2deg: 'rad2deg'
      };
      if (n === 'log') {
        if (a.length === 2) return py ? '(np.log(' + E(a[0]) + ') / np.log(' + E(a[1]) + '))' : '(log(' + E(a[0]) + ') ./ log(' + E(a[1]) + '))';
        return py ? 'np.log10(' + E(a[0]) + ')' : 'log10(' + E(a[0]) + ')';
      }
      if (n === 'Stdev') return py ? 'np.std(' + E(a[0]) + ', ddof=1)' : 'std(' + E(a[0]) + ')';
      if (n === 'stdev' && !py) return 'std(' + E(a[0]) + ', 1)';
      if (n === 'LagA' && py) return 'special.eval_genlaguerre(' + E(a[0]) + ', ' + E(a[1]) + ', ' + E(a[2]) + ')';
      if (n === 'sinc' && py) return 'np.sinc((' + E(a[0]) + ') / np.pi)';
      if (FC.OPTICS_FNS && FC.OPTICS_FNS.includes(n)) {
        if (py) { this.help('_optics'); return n + '(' + args() + ')'; }
        this.warn.add('Funções de óptica (' + n + ') ainda não têm versão MATLAB; use a exportação para Python.');
        return this.name(n) + '(' + args() + ')';
      }
      const map = py ? MAP_PY : MAP_M, f = map[n];
      if (f) {
        if (/^_|_$/.test(f) || f === 'tabelaXYZ') this.help(f);
        if (py && (n === 'zeros' || n === 'ones')) return 'np.' + n + '((' + args() + '))';
        if (f.startsWith('1/')) return '(1/' + f.slice(2) + '(' + args() + '))';
        return f + '(' + args() + ')';
      }
      this.warn.add('Função sem equivalente direto: ' + n + ' (mantida com o mesmo nome).');
      return this.name(n) + '(' + args() + ')';
    }
  }

  /* ---------------- Funções auxiliares emitidas no arquivo ---------------- */
  const PY_HELP = {
    _interp1: 'def _interp1(vx, vy, method="spline"):\n    # interpolação 1D como na Folha (linear, spline natural, pchip, akima); extrapola nas pontas\n    x = np.ravel(vx).astype(float); y = np.ravel(vy).astype(float); o = np.argsort(x); x, y = x[o], y[o]\n    if method == "linear":\n        return interpolate.interp1d(x, y, kind="linear", fill_value="extrapolate")\n    if method == "pchip":\n        return interpolate.PchipInterpolator(x, y, extrapolate=True)\n    if method == "akima":\n        f = interpolate.Akima1DInterpolator(x, y)\n        f.extrapolate = True\n        return f\n    return interpolate.CubicSpline(x, y, bc_type="natural", extrapolate=True)',
    _interp2D: 'def _interp2D(T, method="linear"):\n    # interpola uma tabela x, y, z em grade (interp2D da Folha)\n    T = np.asarray(T, dtype=float); xs = np.unique(T[:, 0]); ys = np.unique(T[:, 1])\n    Z = np.full((len(xs), len(ys)), np.nan)\n    Z[np.searchsorted(xs, T[:, 0]), np.searchsorted(ys, T[:, 1])] = T[:, 2]\n    g = interpolate.RegularGridInterpolator((xs, ys), Z, method="linear" if method == "linear" else "cubic", bounds_error=False, fill_value=None)\n    return lambda x, y: g(np.stack(np.broadcast_arrays(np.asarray(x, float), np.asarray(y, float)), axis=-1))',
    _tabelar: 'def _tabelar(f, a, b, n, method="spline"):\n    # calcula f uma vez numa grade e devolve a interpolação (tabelar da Folha)\n    xs = np.linspace(a, b, int(n)); ys = np.array([f(x) for x in xs], dtype=float)\n    return _interp1(xs, ys, method)',
    integral: 'def _integral(f, a, b):\n    """Integral numérica (Folha: integral(expr, x, a, b))."""\n    return integrate.quad(f, a, b, limit=400, epsabs=1e-13, epsrel=1e-11)[0]',
    deriv: 'def _deriv(f, x0):\n    """Derivada numérica de 4ª ordem num ponto."""\n    h = 1e-3 * max(1e-3, abs(x0))\n    return (-f(x0 + 2*h) + 8*f(x0 + h) - 8*f(x0 - h) + f(x0 - 2*h)) / (12*h)',
    _rows: 'def _rows(A):\n    return np.shape(np.atleast_1d(A))[0]',
    _cols: 'def _cols(A):\n    s = np.shape(np.atleast_1d(A))\n    return s[1] if len(s) > 1 else 1',
    _augment: 'def _augment(*v):\n    return np.column_stack([np.asarray(x) for x in v])',
    _stack: 'def _stack(*v):\n    return np.vstack([np.atleast_2d(np.asarray(x)).reshape(-1, np.shape(np.atleast_2d(x))[-1]) if np.ndim(x) > 1 else np.asarray(x).reshape(-1, 1) for x in v])',
    _col: 'def _col(A, j):\n    return np.asarray(A)[:, int(j)]',
    _row: 'def _row(A, i):\n    return np.asarray(A)[int(i), :]',
    tabelaXYZ: 'def tabelaXYZ(f, x0, dx, x1, y0, dy, y1):\n    """Tabela x, y, f(x, y) com x no laço externo (como o for aninhado do Mathcad)."""\n    xs = np.linspace(x0, x1, int(round((x1 - x0) / dx)) + 1)\n    ys = np.linspace(y0, y1, int(round((y1 - y0) / dy)) + 1)\n    return np.array([[x, y, f(x, y)] for x in xs for y in ys])',
    _polyroots: 'def _polyroots(v):\n    """Raízes de v0 + v1*x + v2*x^2 + ... (ordem do Mathcad)."""\n    r = np.roots(np.asarray(v, dtype=float)[::-1])\n    return np.sort_complex(r).real if np.all(np.abs(np.imag(r)) < 1e-10) else np.sort_complex(r)',
    _rkfixed: 'def _rkfixed(y0, x1, x2, npts, D):\n    """RK4 de passo fixo; devolve matriz [x, y0, y1, ...] com npts+1 linhas."""\n    y = np.atleast_1d(np.asarray(y0, dtype=float)).ravel()\n    xs = np.linspace(x1, x2, int(npts) + 1); h = xs[1] - xs[0]; out = [np.r_[xs[0], y]]\n    for x in xs[:-1]:\n        k1 = np.ravel(D(x, y)); k2 = np.ravel(D(x + h/2, y + h/2*k1)); k3 = np.ravel(D(x + h/2, y + h/2*k2)); k4 = np.ravel(D(x + h, y + h*k3))\n        y = y + h/6*(k1 + 2*k2 + 2*k3 + k4); out.append(np.r_[x + h, y])\n    return np.array(out)',
    _rkadapt: 'def _rkadapt(y0, x1, x2, npts, D):\n    """Passo adaptativo (Dormand-Prince); saída em npts+1 pontos."""\n    xs = np.linspace(x1, x2, int(npts) + 1)\n    s = integrate.solve_ivp(lambda x, y: np.ravel(D(x, y)), (x1, x2), np.atleast_1d(np.asarray(y0, dtype=float)).ravel(), t_eval=xs, rtol=1e-8, atol=1e-12)\n    return np.column_stack([s.t, s.y.T])',
    _sinc: '',
    _linterp: 'def _linterp(vx, vy, x):\n    return np.interp(x, np.ravel(vx), np.ravel(vy))',
    _spline: 'def _spline(vx, vy, x):\n    """Spline cúbica natural (como na Folha)."""\n    return interpolate.CubicSpline(np.ravel(vx), np.ravel(vy), bc_type="natural")(x)',
    grow: 'class _Grow:\n    """Vetor/matriz que cresce por índice, como no Mathcad (posições vazias valem 0)."""\n    def __init__(self):\n        self.d = {}\n    def __setitem__(self, k, v):\n        self.d[k if isinstance(k, tuple) else (k,)] = v\n    def __getitem__(self, k):\n        return self.arr()[k]\n    def arr(self):\n        if not self.d:\n            return np.zeros(0)\n        nd = max(len(k) for k in self.d)\n        shape = [max(k[i] for k in self.d if len(k) > i) + 1 for i in range(nd)]\n        a = np.zeros(shape, dtype=complex if any(isinstance(v, complex) for v in self.d.values()) else float)\n        for k, v in self.d.items():\n            a[k + (0,) * (nd - len(k))] = v\n        return a\n    def __array__(self, dtype=None, copy=None):\n        return self.arr()\n\ndef _v(x):\n    return x.arr() if isinstance(x, _Grow) else x'
  };
  const M_HELP = {
    interp2D_: 'function z = interp2D_(T, x, y)\n  xs = unique(T(:,1)); ys = unique(T(:,2)); Z = nan(numel(xs), numel(ys));\n  [~, ix] = ismember(T(:,1), xs); [~, iy] = ismember(T(:,2), ys);\n  Z(sub2ind(size(Z), ix, iy)) = T(:,3);\n  F = griddedInterpolant({xs, ys}, Z, \'linear\', \'linear\'); z = F(x, y);\nend',
    tabelar_: 'function F = tabelar_(f, a, b, n, metodo)\n  if nargin < 5, metodo = \'spline\'; end\n  if strcmp(metodo, \'akima\'), metodo = \'makima\'; end\n  xs = linspace(a, b, n); ys = arrayfun(f, xs);\n  F = @(x) interp1(xs, ys, x, metodo, \'extrap\');\nend',
    fitres_: 'function r = fitres_(q, p0, livre, lo, hi, modelo, xs, ye, obj)\n  p = p0; p(livre) = min(max(q, lo(livre)), hi(livre));\n  d = modelo(xs, p) - ye; pk = max(abs(ye));\n  switch obj\n    case \'B\', r = d ./ ye;\n    case \'C\', r = sqrt(max(ye, 0) / sum(ye)) .* d / pk;\n    otherwise, r = d / pk;\n  end\nend',
    ifelse: 'function r = ifelse_(c, a, b)\n  if c, r = a; else, r = b; end\nend',
    deriv: 'function d = deriv_(f, x0)\n  h = 1e-3*max(1e-3, abs(x0));\n  d = (-f(x0+2*h) + 8*f(x0+h) - 8*f(x0-h) + f(x0-2*h))/(12*h);\nend',
    sphj_: 'function r = sphj_(n, x)\n  r = sqrt(pi./(2*x)).*besselj(n+0.5, x);\nend',
    sphy_: 'function r = sphy_(n, x)\n  r = sqrt(pi./(2*x)).*bessely(n+0.5, x);\nend',
    her_: 'function r = her_(n, x)\n  a = ones(size(x)); if n == 0, r = a; return; end\n  b = 2*x; for k = 1:n-1, c = 2*x.*b - 2*k*a; a = b; b = c; end; r = b;\nend',
    lag_: 'function r = lag_(n, x)\n  r = laga_(n, 0, x);\nend',
    laga_: 'function r = laga_(n, al, x)\n  a = ones(size(x)); if n == 0, r = a; return; end\n  b = 1 + al - x; for k = 1:n-1, c = ((2*k+1+al-x).*b - (k+al)*a)/(k+1); a = b; b = c; end; r = b;\nend',
    leg_: 'function r = leg_(n, x)\n  a = ones(size(x)); if n == 0, r = a; return; end\n  b = x; for k = 1:n-1, c = ((2*k+1)*x.*b - k*a)/(k+1); a = b; b = c; end; r = b;\nend',
    cheb_: 'function r = cheb_(n, x)\n  r = cos(n*acos(x));\nend',
    rows_: 'function r = rows_(A)\n  r = size(A, 1);\nend',
    cols_: 'function r = cols_(A)\n  r = size(A, 2);\nend',
    augment_: 'function r = augment_(varargin)\n  c = cellfun(@(v) reshape(v, [], size(v, 2) * (size(v,1) > 1) + (size(v,1) == 1)), varargin, \'UniformOutput\', false);\n  r = [c{:}];\nend',
    stack_: 'function r = stack_(varargin)\n  r = vertcat(varargin{:});\nend',
    col_: 'function r = col_(A, j)\n  r = A(:, j+1);\nend',
    row_: 'function r = row_(A, i)\n  r = A(i+1, :);\nend',
    tabelaXYZ_: 'function T = tabelaXYZ_(f, x0, dx, x1, y0, dy, y1)\n  xs = x0:dx:x1; ys = y0:dy:y1; T = zeros(numel(xs)*numel(ys), 3); k = 0;\n  for x = xs, for y = ys, k = k + 1; T(k, :) = [x, y, f(x, y)]; end, end\nend',
    polyroots_: 'function r = polyroots_(v)\n  r = sort(roots(flip(v(:)\')));\nend',
    rkfixed_: 'function Y = rkfixed_(y0, x1, x2, npts, D)\n  y = y0(:); h = (x2 - x1)/npts; x = x1; Y = zeros(npts+1, numel(y)+1); Y(1, :) = [x, y\'];\n  for k = 1:npts\n    k1 = D(x, y); k2 = D(x+h/2, y+h/2*k1(:)); k3 = D(x+h/2, y+h/2*k2(:)); k4 = D(x+h, y+h*k3(:));\n    y = y + h/6*(k1(:) + 2*k2(:) + 2*k3(:) + k4(:)); x = x1 + k*h; Y(k+1, :) = [x, y\'];\n  end\nend',
    rkadapt_: 'function Y = rkadapt_(y0, x1, x2, npts, D)\n  opts = odeset(\'RelTol\', 1e-8, \'AbsTol\', 1e-12);\n  [t, y] = ode45(@(x, yy) reshape(D(x, yy), [], 1), linspace(x1, x2, npts+1), y0(:), opts);\n  Y = [t, y];\nend',
    sinc_: 'function r = sinc_(x)\n  r = sin(x)./x; r(x == 0) = 1;\nend',
    linterp_: 'function r = linterp_(vx, vy, x)\n  r = interp1(vx(:), vy(:), x, \'linear\', \'extrap\');\nend',
    spline_: 'function r = spline_(vx, vy, x)\n  r = interp1(vx(:), vy(:), x, \'spline\');  % "not-a-knot"; na Folha a spline é natural\nend'
  };

  /* ---------------- Rótulos para Matplotlib / MATLAB ---------------- */
  function labelPy(s) {
    s = FC.texNamesToChars(String(s || ''));
    return s.replace(/_\{([^}]*)\}/g, '$_{\\mathrm{$1}}$').replace(/_([A-Za-z0-9α-ωΑ-Ω]+)/g, '$_{\\mathrm{$1}}$').replace(/\^\{([^}]*)\}/g, '$^{$1}$').replace(/\^(-?[A-Za-z0-9]+)/g, '$^{$1}$');
  }
  const pyStr = (s) => JSON.stringify(String(s));
  const mStr = (s) => "'" + String(s).replace(/'/g, "''") + "'";
  const DASH_PY = { solid: '-', dash: '--', dot: ':', dashdot: '-.' }, DASH_M = { solid: '-', dash: '--', dot: ':', dashdot: '-.' };
  const MARK_PY = { circle: 'o', square: 's', 'triangle-up': '^', diamond: 'D', 'circle-open': 'o', 'square-open': 's' };
  const CMAP = { Viridis: 'viridis', Cividis: 'cividis', 'Inferno': 'inferno', 'Azul–vermelho (divergente)': 'RdBu_r', Cinza: 'gray', Jet: 'jet' };
  const CMAP_M = { Viridis: 'parula', Cividis: 'parula', Inferno: 'hot', 'Azul–vermelho (divergente)': 'turbo', Cinza: 'gray', Jet: 'jet' };
  const rgb = (hex) => { const h = (hex || '#1F5FAE').replace('#', ''); return [0, 2, 4].map((i) => (parseInt(h.substr(i, 2), 16) / 255).toFixed(3)).join(' '); };

  /* Intervalo a, b .. c: com números literais, calcula passo e quantidade */
  function rangeCode(E, aN, bN, cN) {
    const lit = (n) => (n && n.isConstantNode && typeof n.value === 'number' ? n.value : n && n.isOperatorNode && n.fn === 'unaryMinus' && n.args[0].isConstantNode ? -n.args[0].value : null);
    const A = lit(aN), B = bN ? lit(bN) : null, Cc = lit(cN);
    const a = E.expr(aN), c = E.expr(cN);
    if (A !== null && Cc !== null && (bN ? B !== null : true)) {
      const st = bN ? B - A : 1, n = Math.round((Cc - A) / st) + 1;
      const stS = numLit(Number(st.toPrecision(12)));
      return E.py ? 'np.linspace(' + a + ', ' + c + ', ' + n + ')' : a + ':' + stS + ':' + c;
    }
    const st = bN ? '(' + E.expr(bN) + ') - (' + a + ')' : '1';
    return E.py ? 'np.linspace(' + a + ', ' + c + ', int(round(((' + c + ') - (' + a + ')) / (' + st + '))) + 1)' : '(' + a + '):(' + st + '):(' + c + ')';
  }

  /* ---------------- Tradução da folha ---------------- */
  function translate(state, lang) {
    // tabelas de dados: T[j] é a coluna j
    const prevCols = new Set(FC.colTables);
    FC.colTables.clear();
    for (const r of state.regions) if (r.type === 'data') FC.colTables.add(FC.varName(r.name, 'D1'));
    try { return translate0(state, lang); } finally { FC.colTables.clear(); for (const n of prevCols) FC.colTables.add(n); }
  }
  function translate0(state, lang) {
    const py = lang === 'py', E = new Emitter(lang);
    let body = [];
    const C = (t) => (py ? '# ' : '% ') + t;
    const parse = (s) => FC.parse(normalize(s));
    const P = FC.PRESETS;
    let figN = 0, tabN = 0;
    const base = (state.name || 'folha').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w-]+/g, '_');

    const emitLine = (raw, ind) => {
      const pad = ' '.repeat(ind);
      const s = normalize(raw).trim();
      if (!s) return;
      if (s.startsWith('//')) { body.push(pad + C(s.slice(2).trim())); return; }
      if (/->\s*$/.test(s)) { body.push(pad + C('simbólico na Folha: ' + raw.trim())); return; }
      const di = findTop(s, ':=');
      if (di >= 0) {
        const lhs = s.slice(0, di).trim();
        let rhs = s.slice(di + 2).trim(); let show = false;
        if (/[^=<>!]=\s*$/.test(rhs) && !/==\s*$/.test(rhs)) { show = true; rhs = rhs.replace(/=\s*$/, '').trim(); }
        const ln = FC.unVsub(parse(lhs));
        if (ln.isSymbolNode && findTop(rhs, '..') >= 0) {
          const parts = splitTop(rhs, '..'), left = splitTop(parts[0], ',');
          const code = rangeCode(E, parse(left[0]), left[1] ? parse(left[1]) : null, parse(parts[1]));
          E.defined.add(ln.name); E.ranges.add(ln.name);
          const nm = E.name(ln.name);
          body.push(pad + nm + ' = ' + code + (py ? '' : ';') + '  ' + C('variável de intervalo'));
          return;
        }
        if (ln.isFunctionNode && ln.fn.isSymbolNode) {
          const params = ln.args.map((x) => x.name), fname = ln.fn.name;
          E.defined.add(fname);
          const prev = E.locals; E.locals = new Set(params);
          const bodyE = E.expr(parse(rhs));
          const ps = params.map((p) => E.name(p));
          E.locals = prev;
          body.push(pad + (py ? 'def ' + E.name(fname) + '(' + ps.join(', ') + '):\n' + pad + '    return ' + bodyE : E.name(fname) + ' = @(' + ps.join(', ') + ') ' + bodyE + ';'));
          return;
        }
        if (ln.isAccessorNode && ln.object.isSymbolNode) {
          const dims = ln.index.dimensions.map((d) => (d.isOperatorNode && d.fn === 'add' ? d.args[0] : d));
          const names = dims.map((d) => d.name);
          const nm = E.name(ln.object.name); E.defined.add(ln.object.name);
          const prev = E.locals; E.locals = new Set(names);
          const ex = E.expr(parse(rhs)); const ns = names.map((n2) => E.name(n2));
          E.locals = prev;
          const rv = names.map((n2) => E.name(n2));
          if (py) body.push(pad + nm + ' = np.array(' + (names.length === 1 ? '[' + ex + ' for ' + ns[0] + ' in ' + rv[0] + ']' : '[[' + ex + ' for ' + ns[1] + ' in ' + rv[1] + '] for ' + ns[0] + ' in ' + rv[0] + ']') + ')');
          else body.push(pad + nm + ' = ' + (names.length === 1 ? 'arrayfun(@(' + ns[0] + ') ' + ex + ', ' + rv[0] + ")';" : '[];  % matriz 2D montada por índices: revise'));
          if (show) body.push(pad + (py ? 'print(' + pyStr(lhs + ' =') + ', ' + nm + ')' : 'disp(' + mStr(lhs + ' =') + '); disp(' + nm + ');'));
          return;
        }
        if (ln.isSymbolNode) {
          const ex = E.expr(parse(rhs));
          E.defined.add(ln.name); E.ranges.delete(ln.name);
          const nm = E.name(ln.name);
          body.push(pad + (py ? nm + ' = ' + ex : nm + ' = ' + ex + ';'));
          if (show) body.push(pad + (py ? 'print(' + pyStr(ln.name + ' =') + ', ' + nm + ')' : 'disp(' + mStr(ln.name + ' =') + '); disp(' + nm + ');'));
          return;
        }
      }
      if (/[^=<>!:]=\s*$/.test(s)) {
        const e = s.replace(/=\s*$/, '').trim();
        const ex = E.expr(parse(e));
        body.push(pad + (py ? 'print(' + pyStr(e + ' =') + ', ' + ex + ')' : 'disp(' + mStr(e + ' =') + '); disp(' + ex + ');'));
        return;
      }
      body.push(pad + C('não traduzido: ' + raw.trim()));
    };

    /* ---- programas ---- */
    const progLocals = (stmts, set) => { for (const st of stmts) { if (st.name) set.add(st.name); if (st.v) set.add(st.v); ['body', 'els', 'handler'].forEach((k) => st[k] && progLocals(st[k], set)); if (st.arms) st.arms.forEach((a) => progLocals(a.body, set)); } return set; };
    const growNames = (stmts, set) => { for (const st of stmts) { if (st.t === 'set' && st.idx) set.add(st.name); ['body', 'els', 'handler'].forEach((k) => st[k] && growNames(st[k], set)); if (st.arms) st.arms.forEach((a) => growNames(a.body, set)); } return set; };
    function stmtsCode(stmts, ind, out, ctx) {
      const pad = (py ? '    ' : '  ').repeat(ind);
      const X = (n) => { const s = E.expr(n); return s; };
      const val = (n) => { const s = X(n); return py && ctx.grow.size && n.isSymbolNode && ctx.grow.has(n.name) ? '_v(' + s + ')' : s; };
      stmts.forEach((st, k) => {
        const isLast = k === stmts.length - 1 && ind === ctx.base;
        switch (st.t) {
          case 'set': {
            const nm = E.name(st.name);
            if (st.idx) out.push(pad + (py ? nm + '[' + st.idx.map((i2) => 'int(' + X(i2) + ')').join(', ') + '] = ' + X(st.e) : nm + '(' + st.idx.map((i2) => X(i2) + '+1').join(', ') + ') = ' + X(st.e) + ';'));
            else out.push(pad + nm + ' = ' + X(st.e) + (py ? '' : ';'));
            if (isLast) out.push(pad + (py ? '__r = ' + (ctx.grow.has(st.name) ? '_v(' + nm + ')' : nm) : ctx.ret + ' = ' + nm + ';'));
            break;
          }
          case 'expr': out.push(pad + (py ? '__r = ' + val(st.e) : ctx.ret + ' = ' + X(st.e) + ';')); break;
          case 'for': {
            const v = E.name(st.v);
            let it;
            if (st.r.kind === 'range') it = rangeCode(E, st.r.a, st.r.b, st.r.c);
            else it = py ? 'np.ravel(' + val(st.r.e) + ')' : 'reshape(' + X(st.r.e) + ', 1, [])';
            out.push(pad + (py ? 'for ' + v + ' in ' + it + ':' : 'for ' + v + ' = ' + it));
            stmtsCode(st.body, ind + 1, out, ctx);
            if (!py) out.push(pad + 'end');
            break;
          }
          case 'while': out.push(pad + (py ? 'while ' + X(st.c) + ':' : 'while ' + X(st.c))); stmtsCode(st.body, ind + 1, out, ctx); if (!py) out.push(pad + 'end'); break;
          case 'if':
            st.arms.forEach((a, i) => { out.push(pad + (py ? (i ? 'elif ' : 'if ') + X(a.c) + ':' : (i ? 'elseif ' : 'if ') + X(a.c))); stmtsCode(a.body, ind + 1, out, ctx); });
            if (st.els) { out.push(pad + (py ? 'else:' : 'else')); stmtsCode(st.els, ind + 1, out, ctx); }
            if (!py) out.push(pad + 'end');
            break;
          case 'try': out.push(pad + (py ? 'try:' : 'try')); stmtsCode(st.body, ind + 1, out, ctx); out.push(pad + (py ? 'except Exception:' : 'catch')); if (st.handler.length) stmtsCode(st.handler, ind + 1, out, ctx); else if (py) out.push(pad + '    pass'); if (!py) out.push(pad + 'end'); break;
          case 'break': out.push(pad + (py ? 'break' : 'break;')); break;
          case 'continue': out.push(pad + (py ? 'continue' : 'continue;')); break;
          case 'return': out.push(pad + (py ? 'return ' + val(st.e) : ctx.ret + ' = ' + X(st.e) + '; return;')); break;
        }
      });
      if (py && !stmts.length) out.push(pad + 'pass');
    }
    function emitProgram(lhsStr, lines, startNo) {
      const ln = FC.parse(normalize(lhsStr));
      const stmts = FC.parseProgramLines(lines, startNo);
      const locals = progLocals(stmts, new Set());
      const isFn = ln.isFunctionNode;
      const params = isFn ? ln.args.map((a) => a.name) : [];
      params.forEach((p) => locals.add(p));
      const grow = growNames(stmts, new Set());
      const fname = isFn ? ln.fn.name : '__prog_' + ln.name;
      if (isFn) E.defined.add(fname);
      const prev = E.locals; E.locals = locals;
      const prevPL = E.progLocals; if (!py) E.progLocals = locals;
      const out = [];
      if (py) {
        out.push('def ' + E.name(fname) + '(' + params.map((p) => E.name(p)).join(', ') + '):');
        out.push('    __r = None');
        [...grow].filter((g) => !params.includes(g)).forEach((g) => { out.push('    ' + E.name(g) + ' = _Grow()'); });
        if (grow.size) E.help('grow');
        stmtsCode(stmts, 1, out, { grow, base: 1 });
        out.push('    return __r');
      } else {
        out.push('function r__ = ' + E.name(fname) + '(' + params.map((p) => E.name(p)).join(', ') + ')');
        out.push('  r__ = [];');
        stmtsCode(stmts, 1, out, { grow, base: 1, ret: 'r__' });
        out.push('end');
      }
      E.locals = prev; E.progLocals = prevPL;
      if (py) body.push(...out);
      else E.nested.push(out.join('\n'));
      if (!isFn) {
        E.defined.add(ln.name);
        body.push(py ? E.name(ln.name) + ' = ' + E.name(fname) + '()' : E.name(ln.name) + ' = ' + E.name(fname) + '();');
      }
    }
    function emitGiven(cons, solveRaw) {
      const s = normalize(solveRaw).trim();
      const m = s.match(/(find|minerr)\s*\(([^()]*)\)/);
      const vars = splitTop(m[2], ',').map((x) => x.trim()).filter(Boolean);
      const prev = E.locals; E.locals = new Set(vars);
      const res = cons.map((c) => {
        const t = c.s; let op, i;
        for (const o of ['==', '<=', '>=']) { i = findTop(t, o); if (i >= 0) { op = o; break; } }
        if (!op) { const k = t.search(/(?<![<>!=])=(?!=)/); if (k >= 0) { op = '='; i = k; } else { const q = t.search(/[<>]/); op = t[q]; i = q; } }
        const L = E.expr(FC.parse(t.slice(0, i))), R = E.expr(FC.parse(t.slice(i + op.length)));
        if (op === '=' || op === '==') return '(' + L + ') - (' + R + ')';
        if (op[0] === '<') return py ? 'max(0.0, (' + L + ') - (' + R + '))' : 'max(0, (' + L + ') - (' + R + '))';
        return py ? 'max(0.0, (' + R + ') - (' + L + '))' : 'max(0, (' + R + ') - (' + L + '))';
      });
      const vn = vars.map((v) => E.name(v));
      E.locals = prev;
      const di = findTop(s, ':=');
      const target = di >= 0 ? FC.parse(s.slice(0, di).trim()) : null;
      if (py) {
        body.push(C('bloco Given … ' + m[1] + '(' + vars.join(', ') + ')'));
        body.push('def __eqs(__v):');
        body.push('    ' + vn.join(', ') + (vn.length === 1 ? ',' : '') + ' = __v');
        body.push('    return [' + res.join(', ') + ']');
        const solver = m[1] === 'find' && res.length === vars.length ? 'optimize.fsolve(__eqs, [' + vn.join(', ') + '], xtol=1e-13)' : 'optimize.least_squares(__eqs, [' + vn.join(', ') + '], xtol=1e-15, ftol=1e-15, gtol=1e-15).x';
        const val = vars.length === 1 ? solver + '[0]' : solver;
        if (target && target.isSymbolNode) { E.defined.add(target.name); body.push(E.name(target.name) + ' = ' + val); if (/=\s*$/.test(s.slice(di + 2))) body.push('print(' + pyStr(target.name + ' =') + ', ' + E.name(target.name) + ')'); }
        else body.push('print(' + pyStr(m[1] + '(' + vars.join(', ') + ') =') + ', ' + val + ')');
      } else {
        body.push(C('bloco Given … ' + m[1] + '(' + vars.join(', ') + ')  (resolvido por mínimos quadrados com fminsearch)'));
        const fv = '@(v__) sum([' + res.map((r) => r.replace(new RegExp('\\b(' + vn.map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')\\b', 'g'), (w) => 'v__(' + (vn.indexOf(w) + 1) + ')')).join('; ') + '].^2)';
        const val = "fminsearch(" + fv + ", [" + vn.join('; ') + "], optimset('TolX', 1e-12, 'TolFun', 1e-16, 'MaxFunEvals', 1e5, 'MaxIter', 1e5))";
        if (target && target.isSymbolNode) { E.defined.add(target.name); body.push(E.name(target.name) + ' = ' + val + ';'); if (/=\s*$/.test(s.slice(di + 2))) body.push('disp(' + mStr(target.name + ' =') + '); disp(' + E.name(target.name) + ');'); }
        else body.push('disp(' + mStr(m[1] + '(' + vars.join(', ') + ') =') + '); disp(' + val + ');');
      }
    }

    /* ---- materiais usados ---- */
    let usesNS = false, usesMT = false;
    const sheetText = JSON.stringify(state.regions);
    for (const mt of state.materials || []) {
      if (!mt || !mt.name || !sheetText.includes(mt.name + '.')) continue;
      const before = new Set(E.defined), saved = body;
      body = [];
      const L = String(mt.src || '').split('\n');
      const localNames = new Set();
      for (const l of L) { const t = normalize(l).trim(); const di = findTop(t, ':='); if (di > 0) { try { const ln = FC.parse(t.slice(0, di).trim()); if (ln.isSymbolNode) localNames.add(ln.name); else if (ln.isFunctionNode) localNames.add(ln.fn.name); } catch (e) { /* ignora */ } } }
      const prevPL = E.progLocals; if (!py) E.progLocals = localNames;
      for (const l of L) { try { emitLine(l, py ? 4 : 2); } catch (e) { body.push(C('não traduzido: ' + l.trim())); } }
      const inner = body; body = saved;
      const names = [...localNames];
      const fn = (py ? '__mat_' : 'mat_') + E.name(mt.name) + (py ? '' : '_');
      if (py) {
        usesNS = true;
        body.push(C('material ' + mt.name + ' (biblioteca da Folha)'), 'def ' + fn + '():', ...inner, '    return SimpleNamespace(' + names.map((n) => E.name(n) + '=' + E.name(n)).join(', ') + ')', E.name(mt.name) + ' = ' + fn + '()');
      } else {
        const fields = names.map((n) => "'" + E.name(n).replace(/_L$/, '') + "', " + E.name(n)).join(', ');
        E.nested.push(['function S__ = ' + fn + '()', ...inner, '  S__ = struct(' + fields + ');', 'end'].join('\n'));
      }
      E.progLocals = prevPL;
      if (!py) body.push(E.name(mt.name) + ' = ' + fn + '();  % material ' + mt.name);
      E.defined = before; E.defined.add(mt.name);
    }

    /* ---- pacotes de extensão usados pela folha ---- */
    const packRegions = [];
    for (const pk of FC.packsUsedBy ? FC.packsUsedBy(state.regions, state.packs || []) : []) {
      body.push('', C('---- pacote ' + pk.nome + ' ' + pk.versao + ' (' + pk.id + ') ----'));
      const own = py ? pk.python : pk.matlab;
      if (own) {
        // o pacote traz a própria versão em Python/MATLAB
        if (py) body.push(...String(own).split('\n'));
        else E.nested.push(String(own));
        for (const n of FC.packExports(pk)) E.defined.add(n);
        continue;
      }
      for (const [n, d] of Object.entries(pk.js || {})) {
        const code = py ? d.python : d.matlab;
        if (code) { if (py) body.push(...String(code).split('\n')); else E.nested.push(String(code)); }
        else { E.warn.add('Função ' + n + ' do pacote ' + pk.nome + ' não tem versão ' + (py ? 'Python' : 'MATLAB') + '.'); }
        E.defined.add(n);
      }
      if (String(pk.codigo || '').trim()) packRegions.push({ type: 'math', src: String(pk.codigo) });
    }

    /* ---- regiões ---- */
    let swN = 0, fitN = 0, animN = 0;
    for (const r of [...packRegions, ...state.regions]) {
      body.push('');
      if (String(r.title || '').trim()) body.push(C('==== ' + String(r.title).trim() + ' ===='));
      if (r.capOn && String(r.cap || '').trim()) body.push(C('Legenda: ' + String(r.cap).trim().replace(/\n+/g, ' ')));
      if (r.type === 'text') { String(r.src || '').split('\n').forEach((l) => body.push(C(l.replace(/\*\*/g, '')))); continue; }
      if (r.type === 'math') {
        const L0 = String(r.src || '').split('\n');
        const L = L0.map((l) => FC.splitComment(l)[0]), DS = L0.map((l) => FC.splitComment(l)[1]);
        for (let i = 0; i < L.length; i++) {
          const s = normalize(L[i]).trim();
          if (DS[i]) body.push(C(DS[i]));
          try {
            const pm = s.match(/^(.+?):=\s*prog\s*(=)?\s*$/);
            if (pm) {
              let j = i + 1; while (j < L.length && !/^end\s*(=)?$/.test(normalize(L[j]).trim())) j++;
              emitProgram(pm[1].trim(), L.slice(i + 1, j), i + 2);
              const showP = pm[2] || /=\s*$/.test(normalize(L[j] || '').trim());
              const lnode = FC.parse(pm[1].trim());
              if (showP && lnode.isSymbolNode) body.push(py ? 'print(' + pyStr(lnode.name + ' =') + ', ' + E.name(lnode.name) + ')' : 'disp(' + mStr(lnode.name + ' =') + '); disp(' + E.name(lnode.name) + ');');
              i = j; continue;
            }
            if (/^(given|dado)$/i.test(s)) {
              let j = i + 1; const cons = [];
              while (j < L.length && !/(find|minerr)\s*\(/.test(normalize(L[j]))) { const t = normalize(L[j]).trim(); if (t && !t.startsWith('//')) cons.push({ s: t }); j++; }
              if (j < L.length) emitGiven(cons, L[j]);
              i = j; continue;
            }
            { const P = FC.rowParts(L[i]); if (P.length > 1) P.forEach((p) => emitLine(p, 0)); else emitLine(L[i], 0); }
          } catch (e) { body.push(C('não traduzido (' + FC.ptError(e) + '): ' + L[i].trim())); }
        }
        continue;
      }
      if (r.type === 'data') {
        const T = r.table;
        if (!T || !T.rows || !T.rows.length) { body.push(C('região de dados sem arquivo importado')); continue; }
        const nm = FC.varName(r.name, 'D1'), C0 = T.rows[0].length;
        E.defined.add(nm);
        const lit = (v) => (isFinite(v) ? numLit(v) : py ? 'np.nan' : 'NaN');
        body.push(C('dados importados: ' + (r.file || nm) + ' (' + T.rows.length + ' × ' + C0 + '; colunas: ' + T.names.join(', ') + ')'));
        if (py) body.push(E.name(nm) + ' = np.array([', ...T.rows.map((row) => '    [' + row.map(lit).join(', ') + '],'), '])');
        else body.push(E.name(nm) + ' = [', ...T.rows.map((row) => '  ' + row.map(lit).join(', ')), '];');
        const colv = [];
        for (let j = 0; j < C0; j++) {
          const v = FC.varName((r.colvars || [])[j], nm + '_c' + j); colv.push(v); E.defined.add(v);
          body.push(E.name(v) + ' = ' + (py ? E.name(nm) + '[:, ' + j + ']' : E.name(nm) + '(:, ' + (j + 1) + ');'));
        }
        if (r.interp && r.interp.on) {
          const xc = Math.min(C0 - 1, Math.max(0, r.interp.xcol | 0)), meth = r.interp.method || 'spline';
          for (let j = 0; j < C0; j++) {
            if (j === xc) continue;
            const fn = FC.varName((r.interp.fnames || [])[j], colv[j] + '_i'); E.defined.add(fn);
            if (py) { E.help('_interp1'); body.push(E.name(fn) + ' = _interp1(' + E.name(colv[xc]) + ', ' + E.name(colv[j]) + ", '" + meth + "')"); }
            else body.push(E.name(fn) + ' = @(x) interp1(' + E.name(colv[xc]) + ', ' + E.name(colv[j]) + ", x, '" + ({ linear: 'linear', spline: 'spline', pchip: 'pchip', akima: 'makima' }[meth] || 'spline') + "', 'extrap');");
          }
        }
        if (r.grid2d && r.grid2d.on) {
          const g = r.grid2d, fn = FC.varName(g.fname, nm + '_f'); E.defined.add(fn);
          if (py) { E.help('_interp2D'); body.push(E.name(fn) + ' = _interp2D(' + E.name(nm) + '[:, [' + (g.xcol | 0) + ', ' + (g.ycol | 0) + ', ' + (g.zcol | 0) + ']], ' + "'" + (g.method || 'linear') + "')"); }
          else { E.help('interp2D_'); body.push(E.name(fn) + ' = @(x, y) interp2D_(' + E.name(nm) + '(:, [' + ((g.xcol | 0) + 1) + ', ' + ((g.ycol | 0) + 1) + ', ' + ((g.zcol | 0) + 1) + ']), x, y);'); }
        }
        continue;
      }
      if (r.type === 'sweep') {
        swN++;
        try {
          const pv = String(r.param || 'p').trim(), vn = FC.varName(r.name, 'V' + swN);
          const exprs = String(r.outputs || '').split('\n').map((x) => x.trim()).filter(Boolean);
          const prev = E.locals; E.locals = new Set([pv]);
          const ex = exprs.map((x) => E.expr(parse(x)));
          const pn = E.name(pv);
          E.locals = prev; E.defined.add(vn);
          const a = E.expr(parse(r.from)), b = E.expr(parse(r.to)), n = Math.max(2, Math.round(Number(r.n) || 21));
          const names = FC.splitTop(String(r.names || ''), ',').map((x) => x.trim());
          const hd = [pv, ...exprs.map((e, i) => names[i] || e)].map((x) => x.replace(/[_^{}]/g, '')).join('\t');
          const file = base + '_varredura' + swN + '.txt';
          body.push(C('varredura de ' + pv + ' (' + n + ' pontos)'));
          if (py) {
            body.push(E.name(vn) + ' = np.array([[' + pn + ', ' + ex.join(', ') + '] for ' + pn + ' in ' + (r.log ? 'np.geomspace(' : 'np.linspace(') + a + ', ' + b + ', ' + n + ')], dtype=float)');
            body.push('np.savetxt(' + pyStr(file) + ', ' + E.name(vn) + ', delimiter="\\t", header=' + pyStr(hd) + ', comments="", fmt="%.10g")');
            if (r.plot !== false) {
              const pr = P[r.preset] || P.acs1;
              body.push('fig, ax = plt.subplots(figsize=(' + pr.w + ', ' + +(pr.w * pr.ratio).toFixed(3) + '))');
              exprs.forEach((e, i) => body.push('ax.plot(' + E.name(vn) + '[:, 0], ' + E.name(vn) + '[:, ' + (i + 1) + "], '" + (r.markers ? 'o-' : '-') + "', ms=3, lw=1.2, label=" + pyStr(labelPy(names[i] || e)) + ')'));
              body.push('ax.set_xlabel(' + pyStr(labelPy(r.xlabel || pv)) + '); ax.set_ylabel(' + pyStr(labelPy(r.ylabel || '')) + '); ax.legend()');
              if (r.xlog) body.push("ax.set_xscale('log')");
              if (r.ylog) body.push("ax.set_yscale('log')");
              body.push('fig.tight_layout(); fig.savefig(' + pyStr(base + '_varredura' + swN + '.pdf') + ')');
            }
          } else {
            body.push('vals__ = ' + (r.log ? 'logspace(log10(' + a + '), log10(' + b + '), ' + n + ')' : 'linspace(' + a + ', ' + b + ', ' + n + ')') + ';');
            body.push(E.name(vn) + ' = cell2mat(arrayfun(@(' + pn + ') [' + pn + ', ' + ex.join(', ') + "], vals__, 'UniformOutput', false)');");
            body.push("fid = fopen(" + mStr(file) + ", 'w'); fprintf(fid, '%s\\n', " + mStr(hd) + "); fclose(fid);");
            body.push("writematrix(" + E.name(vn) + ", " + mStr(file) + ", 'Delimiter', 'tab', 'WriteMode', 'append');");
            if (r.plot !== false) {
              body.push("figure; hold on; box on;");
              exprs.forEach((e, i) => body.push('plot(' + E.name(vn) + '(:,1), ' + E.name(vn) + '(:,' + (i + 2) + "), '" + (r.markers ? 'o-' : '-') + "', 'DisplayName', " + mStr(names[i] || e) + ');'));
              body.push('xlabel(' + mStr(r.xlabel || pv) + '); ylabel(' + mStr(r.ylabel || '') + "); legend('Box', 'off');");
            }
          }
        } catch (e) { body.push(C('varredura não traduzida: ' + FC.ptError(e))); }
        continue;
      }
      if (r.type === 'fit') {
        fitN++;
        try {
          const Pp = FC.parseFitParams(r.params);
          const xv = String(r.xvar || 'x').trim();
          const pnames = Pp.map((q) => q.name);
          const X = E.expr(parse(r.xexpr)), Y = E.expr(parse(r.yexpr));
          const p0 = Pp.map((q) => E.expr(parse(q.v0)));
          const lo = Pp.map((q) => (q.lo != null ? E.expr(parse(q.lo)) : py ? '-np.inf' : '-Inf'));
          const hi = Pp.map((q) => (q.hi != null ? E.expr(parse(q.hi)) : py ? 'np.inf' : 'Inf'));
          const free = Pp.map((q) => (q.fixed ? (py ? 'False' : 'false') : (py ? 'True' : 'true')));
          const xmin = String(r.xmin || '').trim() ? E.expr(parse(r.xmin)) : py ? '-np.inf' : '-Inf';
          const xmax = String(r.xmax || '').trim() ? E.expr(parse(r.xmax)) : py ? 'np.inf' : 'Inf';
          const thr = Number(r.thresh) || 0, obj = r.objective || 'A';
          const file = base + '_ajuste' + fitN;
          body.push(C('ajuste a dados ' + fitN + ' (' + (r.mode === 'avaliar' ? 'só avaliação' : 'objetivo ' + { A: 'RMS-A', B: 'MSE-B', C: 'MSE-C' }[obj]) + ')'));
          if (py) {
            const prev = E.locals; E.locals = new Set([xv, ...pnames]);
            const mex = E.expr(parse(r.model));
            const xn = E.name(xv), pn = pnames.map((q) => E.name(q));
            E.locals = prev;
            body.push('__x = np.ravel(np.asarray(' + X + ', dtype=float)); __y = np.ravel(np.asarray(' + Y + ', dtype=float))');
            body.push('__m = np.isfinite(__x) & np.isfinite(__y) & (__x >= ' + xmin + ') & (__x <= ' + xmax + ') & (np.abs(__y) >= ' + thr / 100 + ' * np.nanmax(np.abs(__y)))');
            body.push('__xs, __ye = __x[__m], __y[__m]');
            body.push('def __modelo(' + xn + ', ' + pn.join(', ') + '):', '    return np.array([' + mex + ' for ' + xn + ' in np.ravel(' + xn + ')], dtype=float)');
            body.push('__p0 = np.array([' + p0.join(', ') + '], dtype=float)', '__livre = np.array([' + free.join(', ') + '])', '__lo = np.array([' + lo.join(', ') + '], dtype=float); __hi = np.array([' + hi.join(', ') + '], dtype=float)');
            const resExpr = { A: '__d / __pk', B: '__d / __ye', C: 'np.sqrt(np.clip(__ye, 0, None) / np.sum(__ye)) * __d / __pk' }[obj];
            body.push('def __res(q):', '    p = __p0.copy(); p[__livre] = q', '    __d = __modelo(__xs, *p) - __ye; __pk = np.max(np.abs(__ye))', '    return ' + resExpr);
            if (r.mode !== 'avaliar') body.push('__sol = optimize.least_squares(__res, __p0[__livre], bounds=(__lo[__livre], __hi[__livre]), xtol=1e-12, ftol=1e-12)', '__p = __p0.copy(); __p[__livre] = __sol.x');
            else body.push('__p = __p0.copy()');
            if (r.define !== false) { pnames.forEach((q) => E.defined.add(q)); body.push(pn.join(', ') + (pn.length === 1 ? ',' : '') + ' = __p'); }
            body.push('__ym = __modelo(__xs, *__p); __r = __ym - __ye; __pk = np.max(np.abs(__ye))');
            body.push('print("RMS-A =", np.sqrt(np.mean((__r / __pk)**2)), "| MSE-B =", np.mean((__r[__ye != 0] / __ye[__ye != 0])**2), "| MSE-C =", np.sum(__ye / np.sum(__ye) * (__r / __pk)**2))');
            body.push('for __n, __v in zip(' + pyStr(pnames.join(',')) + '.split(","), __p): print("  ", __n, "=", __v)');
            const pr = P[r.preset] || P.acs1;
            body.push('fig, (ax, axr) = plt.subplots(2, 1, sharex=True, figsize=(' + pr.w + ', ' + +(pr.w * pr.ratio * 1.25).toFixed(3) + "), gridspec_kw={'height_ratios': [3, 1]})");
            body.push("ax.plot(__x, __y, 'o', mfc='none', ms=2.5, color='0.35', label='dados'); __o = np.argsort(__x); ax.plot(__x[__o], __modelo(__x[__o], *__p), '-', lw=1.4, color=" + pyStr(r.color || '#1F5FAE') + ", label='modelo')");
            body.push("axr.plot(__xs, __r, '-', lw=0.8, color='#B03A2E'); axr.axhline(0, color='0.5', lw=0.5, ls=':')");
            body.push('ax.set_ylabel(' + pyStr(labelPy(r.ylabel)) + '); axr.set_ylabel("resíduo"); axr.set_xlabel(' + pyStr(labelPy(r.xlabel)) + '); ax.legend()');
            body.push('fig.tight_layout(); fig.savefig(' + pyStr(file + '.pdf') + ')');
            body.push('np.savetxt(' + pyStr(file + '.txt') + ', np.column_stack([__xs, __ye, __ym, __r]), delimiter="\\t", header="x\\ty\\tmodelo\\tresiduo", comments="", fmt="%.10g")');
          } else {
            E.help('fitres_');
            const prev = E.locals; E.locals = new Set([xv]);
            E.alias = new Map(pnames.map((q, k) => [q, 'p__(' + (k + 1) + ')']));
            const mex = E.expr(parse(r.model));
            const xn = E.name(xv);
            E.alias = null; E.locals = prev;
            body.push('x__ = ' + X + '; x__ = x__(:); y__ = ' + Y + '; y__ = y__(:);');
            body.push('m__ = isfinite(x__) & isfinite(y__) & x__ >= ' + xmin + ' & x__ <= ' + xmax + ' & abs(y__) >= ' + thr / 100 + ' * max(abs(y__));');
            body.push('xs__ = x__(m__); ye__ = y__(m__);');
            body.push('modelo__ = @(xx, p__) arrayfun(@(' + xn + ') ' + mex + ', xx);');
            body.push('p0__ = [' + p0.join(', ') + ']; livre__ = logical([' + free.join(', ') + ']); lo__ = [' + lo.join(', ') + ']; hi__ = [' + hi.join(', ') + '];');
            if (r.mode !== 'avaliar') {
              body.push("q__ = fminsearch(@(q) sum(fitres_(q, p0__, livre__, lo__, hi__, modelo__, xs__, ye__, '" + obj + "').^2), p0__(livre__), optimset('TolX', 1e-12, 'TolFun', 1e-16, 'MaxFunEvals', 2e5, 'MaxIter', 2e5));");
              body.push('p__ = p0__; p__(livre__) = min(max(q__, lo__(livre__)), hi__(livre__));');
            } else body.push('p__ = p0__;');
            if (r.define !== false) { pnames.forEach((q) => E.defined.add(q)); body.push(pnames.map((q, k) => E.name(q) + ' = p__(' + (k + 1) + ');').join(' ')); }
            body.push('ym__ = modelo__(xs__, p__); r__ = ym__ - ye__; pk__ = max(abs(ye__));');
            body.push("fprintf('RMS-A = %g | MSE-B = %g | MSE-C = %g\\n', sqrt(mean((r__/pk__).^2)), mean((r__(ye__ ~= 0)./ye__(ye__ ~= 0)).^2), sum(ye__/sum(ye__).*(r__/pk__).^2));");
            body.push("figure; subplot(4,1,1:3); plot(x__, y__, 'o', 'MarkerSize', 3); hold on; [xo__, io__] = sort(x__); plot(xo__, modelo__(xo__, p__), 'LineWidth', 1.4); ylabel(" + mStr(r.ylabel) + "); legend('dados', 'modelo', 'Box', 'off');");
            body.push("subplot(4,1,4); plot(xs__, r__, 'r-'); yline(0, ':'); xlabel(" + mStr(r.xlabel) + "); ylabel('resíduo');");
            body.push("writematrix([xs__, ye__, ym__, r__], " + mStr(file + '.txt') + ", 'Delimiter', 'tab');");
          }
        } catch (e) { body.push(C('ajuste não traduzido: ' + FC.ptError(e))); }
        continue;
      }
      if (r.type === 'slider') {
        const nm = String(r.name || 'p').trim();
        E.defined.add(nm);
        body.push(E.name(nm) + ' = ' + numLit(Number(r.value)) + (py ? '' : ';') + '  ' + C('controle deslizante (' + r.min + ' a ' + r.max + ')'));
        continue;
      }
      if (r.type === 'anim') {
        animN++;
        const T = FC.animTarget(r, state.regions);
        if (!T || (T.type === 'xy' && !T.traces.length)) { body.push(C('animação sem gráfico escolhido')); continue; }
        const ownMode = FC.animMode(r) === 'proprio';
        if (!py) { body.push(C('animação de ' + T.type + ' variando ' + r.param + ': não exportada para o MATLAB; use o script Python ou exporte GIF/MP4 pelo app.')); continue; }
        try {
          const pv = String(r.param || '').trim(), pn = E.name(pv);
          const n = Math.max(2, Math.round(Number(r.frames) || 30)), fps = Math.max(1, Number(r.fps) || 10);
          const pr = P[T.preset] || P.acs1, w = pr.w, hh = +(pr.w * pr.ratio).toFixed(3);
          const file = base + '_animacao' + animN;
          const dig = r.digits === 'auto' || r.digits == null || r.digits === '' ? null : Number(r.digits);
          const lab = labelPy(String(r.label || '{p} = {v}').replace(/\{p\}/g, pv));
          const labExpr = r.labelOn === false ? '""' : pyStr(lab) + '.replace("{v}", ' + (dig == null ? '"%g" % __vals[k]' : '"%.' + dig + 'f" % __vals[k]') + ')';
          E.defined.add(pv);
          body.push(C('animação: ' + T.type + ' variando ' + pv + ' de ' + r.from + ' a ' + r.to + ' (' + n + ' quadros, ' + fps + ' quadros/s)'));
          body.push(C('Atenção: variáveis calculadas a partir de ' + pv + ' antes deste ponto não são recalculadas; funções que usam ' + pv + ' diretamente, sim.'));
          body.push('from matplotlib.animation import FuncAnimation, PillowWriter');
          if (ownMode) body.push('__old_p = globals().get(' + pyStr(pn) + ')  ' + C('guarda o valor de ' + pv + ' da folha, se houver'));
          body.push('__vals = np.linspace(' + E.expr(parse(r.from)) + ', ' + E.expr(parse(r.to)) + ', ' + n + ')');
          const seqCode = '__seq = list(range(' + n + '))' + (r.pingpong ? ' + list(range(' + (n - 2) + ', 0, -1))' : '');
          if (T.type === 'xy') {
            const xv = T.xvar;
            const hasLim = String(T.xmin || '').trim() && String(T.xmax || '').trim();
            const prev = E.locals; E.locals = new Set([xv]);
            const xs = hasLim ? 'np.linspace(' + E.expr(parse(T.xmin)) + ', ' + E.expr(parse(T.xmax)) + ', ' + (T.npts || 400) + ')' : E.name(xv);
            const tr = T.traces.filter((t) => String(t.expr || '').trim()).map((t) => ({ t, ex: E.expr(parse(t.expr)) }));
            const xn = E.name(xv);
            E.locals = prev;
            body.push('__x = np.asarray(' + xs + ', dtype=float)', '__fr = []', 'for ' + pn + ' in __vals:', '    __fr.append([' + tr.map(({ ex }) => 'np.vectorize(lambda ' + xn + ': ' + ex + ', otypes=[float])(__x)').join(', ') + '])', '__fr = np.array(__fr)');
            body.push('fig, ax = plt.subplots(figsize=(' + w + ', ' + hh + '))');
            body.push('__ln = [' + tr.map(({ t }, i) => 'ax.plot(__x, __fr[0, ' + i + '], color=' + pyStr(t.color || '#1F5FAE') + ', lw=' + (t.width || 1.5) + ", ls='" + (DASH_PY[t.dash] || '-') + "', label=" + pyStr(labelPy(t.name || t.expr)) + ')[0]').join(', ') + ']');
            body.push('__lo, __hi = np.nanmin(__fr), np.nanmax(__fr); __pad = 0.04 * (__hi - __lo or 1)');
            if (r.fixed !== false) body.push('ax.set_ylim(__lo - __pad, __hi + __pad)');
            body.push('ax.set_xlabel(' + pyStr(labelPy(T.xlabel)) + '); ax.set_ylabel(' + pyStr(labelPy(T.ylabel)) + ')');
            body.push("__txt = ax.text(0.97, 0.95, '', transform=ax.transAxes, ha='right', va='top')");
            body.push(seqCode, 'def __upd(k):', '    for i, l in enumerate(__ln):', '        l.set_ydata(__fr[k, i])', '    __txt.set_text(' + labExpr + ')', '    return __ln + [__txt]');
          } else {
            const hasX = String(T.xmin || '').trim() && String(T.xmax || '').trim(), hasY = String(T.ymin || '').trim() && String(T.ymax || '').trim();
            const prev = E.locals; E.locals = new Set([T.xvar, T.yvar]);
            const ex = E.expr(parse(T.expr));
            const gx = hasX ? 'np.linspace(' + E.expr(parse(T.xmin)) + ', ' + E.expr(parse(T.xmax)) + ', ' + (T.nx || 101) + ')' : E.name(T.xvar);
            const gy = hasY ? 'np.linspace(' + E.expr(parse(T.ymin)) + ', ' + E.expr(parse(T.ymax)) + ', ' + (T.ny || 101) + ')' : E.name(T.yvar);
            const xn = E.name(T.xvar), yn = E.name(T.yvar);
            E.locals = prev;
            const cmap = (CMAP[T.colorscale] || 'viridis') + (T.reverse ? '_r' : '');
            body.push('__X, __Y = np.meshgrid(' + gx + ', ' + gy + ')', '__fr = []', 'for ' + pn + ' in __vals:', '    __fr.append(np.vectorize(lambda ' + xn + ', ' + yn + ': ' + ex + ', otypes=[float])(__X, __Y))', '__fr = np.array(__fr)');
            body.push('__lo, __hi = np.nanmin(__fr), np.nanmax(__fr)');
            if (T.type === 'heat') {
              body.push('fig, ax = plt.subplots(figsize=(' + w + ', ' + hh + '))');
              body.push("__m = ax.pcolormesh(__X, __Y, __fr[0], cmap='" + cmap + "', shading='auto'" + (r.fixed !== false ? ', vmin=__lo, vmax=__hi' : '') + ')');
              body.push('fig.colorbar(__m, ax=ax, pad=0.02).set_label(' + pyStr(labelPy(T.zlabel)) + ')');
              body.push('ax.set_xlabel(' + pyStr(labelPy(T.xlabel)) + '); ax.set_ylabel(' + pyStr(labelPy(T.ylabel)) + ')');
              body.push("__txt = ax.text(0.97, 0.95, '', transform=ax.transAxes, ha='right', va='top', color='white')");
              body.push(seqCode, 'def __upd(k):', '    __m.set_array(__fr[k].ravel())', '    __txt.set_text(' + labExpr + ')', '    return [__m, __txt]');
            } else {
              body.push('fig = plt.figure(figsize=(' + w + ', ' + hh + ')); ax = fig.add_subplot(111, projection="3d")');
              body.push(seqCode, 'def __upd(k):', '    ax.clear()', "    ax.plot_surface(__X, __Y, __fr[k], cmap='" + cmap + "', linewidth=0" + (r.fixed !== false ? ', vmin=__lo, vmax=__hi' : '') + ')', (r.fixed !== false ? '    ax.set_zlim(__lo, __hi)' : '    pass'),
                '    ax.set_xlabel(' + pyStr(labelPy(T.xlabel)) + '); ax.set_ylabel(' + pyStr(labelPy(T.ylabel)) + '); ax.set_zlabel(' + pyStr(labelPy(T.zlabel)) + ')', '    ax.set_title(' + labExpr + ')', '    return []');
            }
          }
          body.push('fig.tight_layout()', '__an = FuncAnimation(fig, __upd, frames=__seq, interval=' + Math.round(1000 / fps) + ', blit=False)');
          body.push('__an.save(' + pyStr(file + '.gif') + ', writer=PillowWriter(fps=' + fps + '), dpi=200)');
          body.push('try:', '    __an.save(' + pyStr(file + '.mp4') + ', fps=' + fps + ', dpi=200)', 'except Exception as __e:', '    print("MP4 não gerado (precisa do ffmpeg instalado):", __e)');
          if (ownMode) body.push('if __old_p is not None:', '    ' + pn + ' = __old_p  ' + C('restaura o valor de ' + pv));
          else body.push(pn + ' = ' + (state.regions.find((x) => x.type === 'slider' && x.name === pv) ? numLit(Number(state.regions.find((x) => x.type === 'slider' && x.name === pv).value)) : '__vals[0]') + '  ' + C('restaura o valor de ' + pv));
        } catch (e) { body.push(C('animação não traduzida: ' + FC.ptError(e))); }
        continue;
      }
      if (r.type === 'table') {
        tabN++;
        const fname = base + '_tabela' + tabN + '.txt';
        try {
          let arr;
          if (r.mode === 'matrix') arr = py ? 'np.asarray(' + E.expr(parse(r.matrix)) + ', dtype=float)' : E.expr(parse(r.matrix));
          else {
            const cols = String(r.cols || '').split('\n').map((x) => x.trim()).filter(Boolean).map((x) => E.expr(parse(x)));
            arr = py ? 'np.column_stack([np.broadcast_to(np.ravel(c_), (n_,)) for c_, n_ in [(c_, max(np.size(z) for z in [' + cols.join(', ') + '])) for c_ in [' + cols.join(', ') + ']]])' : '[' + cols.map((c) => 'reshape(' + c + ', [], 1)').join(', ') + ']';
          }
          const names = FC.splitTop(String(r.names || ''), ',').map((x) => x.trim());
          body.push(C('tabela ' + tabN + ' (TXT para o Origin)'));
          if (py) {
            body.push('__T = ' + arr);
            body.push('np.savetxt(' + pyStr(fname) + ', __T, delimiter="\\t", header=' + pyStr(names.filter(Boolean).join('\t')) + ', comments="", fmt="%.10g")');
          } else {
            body.push('T__ = ' + arr + ';');
            body.push("fid = fopen(" + mStr(fname) + ", 'w'); fprintf(fid, '%s\\n', " + mStr(names.filter(Boolean).join('\t')) + "); fclose(fid);");
            body.push("writematrix(T__, " + mStr(fname) + ", 'Delimiter', 'tab', 'WriteMode', 'append');");
          }
        } catch (e) { body.push(C('tabela não traduzida: ' + FC.ptError(e))); }
        continue;
      }
      if (r.type === 'xy' || r.type === 'heat' || r.type === 'surf') {
        figN++;
        const pr = P[r.preset] || P.acs1, w = pr.w, hh = +(pr.w * pr.ratio).toFixed(3);
        const file = base + '_fig' + figN + (r.type === 'surf' ? '.png' : '.pdf');
        try {
          if (r.type === 'xy') {
            const xv = r.xvar;
            const hasLim = String(r.xmin || '').trim() && String(r.xmax || '').trim();
            const withDiv = (e, dv) => (String(dv || '').trim() ? '(' + e + ')/(' + dv + ')' : e);
            const tl = r.traces.filter((t) => String(t.expr || '').trim());
            const needX = tl.some((t) => (t.kind || 'func') === 'func' && !t.xown);
            const prev = E.locals;
            const traces = tl.map((t) => {
              const kind = t.kind || 'func';
              if (kind === 'func' && t.xown) {
                const tv = String(t.txvar || xv).trim(), has = (v) => String(v ?? '').trim() !== '';
                E.locals = new Set([tv]); const ex = E.expr(parse(withDiv(t.expr, t.div))); E.locals = prev;
                return { t, kind: 'own', ex, tv, ta: E.expr(parse(has(t.txmin) ? t.txmin : r.xmin || '0')), tb: E.expr(parse(has(t.txmax) ? t.txmax : r.xmax || '1')), tn: Math.max(2, Math.round(Number(t.tn) || Number(r.npts) || 400)) };
              }
              if (kind === 'func') { E.locals = new Set([xv]); const ex = E.expr(parse(withDiv(t.expr, t.div))); E.locals = prev; return { t, kind, ex }; }
              if (kind === 'param') { const pv = String(t.pvar || 't').trim(); E.locals = new Set([pv]); const ex = E.expr(parse(withDiv(t.expr, t.div))), xx = E.expr(parse(t.xexpr || '0')); E.locals = prev; return { t, kind, ex, xx, pv, pa: E.expr(parse(t.pmin)), pb: E.expr(parse(t.pmax)), pn: Math.max(2, Math.round(Number(t.pn) || 300)) }; }
              return { t, kind, ex: E.expr(parse(withDiv(t.expr, t.div))), xx: E.expr(parse(t.xexpr || '0')) };
            });
            const xs = hasLim ? (py ? 'np.linspace(' + E.expr(parse(r.xmin)) + ', ' + E.expr(parse(r.xmax)) + ', ' + (r.npts || 400) + ')' : 'linspace(' + E.expr(parse(r.xmin)) + ', ' + E.expr(parse(r.xmax)) + ', ' + (r.npts || 400) + ')') : null;
            const xsrc = xs || E.name(xv);
            body.push(C('gráfico ' + figN + ' (estilo ' + pr.label + ')'));
            if (py) {
              if (needX) body.push('__x = np.asarray(' + xsrc + ', dtype=float)');
              body.push('__cv = []  ' + C('(x, y) de cada curva'));
              traces.forEach((q) => {
                if (q.kind === 'func') body.push('__cv.append((__x, np.vectorize(lambda ' + E.name(xv) + ': ' + q.ex + ', otypes=[float])(__x)))');
                else if (q.kind === 'own') body.push('__t = np.linspace(' + q.ta + ', ' + q.tb + ', ' + q.tn + ')', '__cv.append((__t, np.vectorize(lambda ' + E.name(q.tv) + ': ' + q.ex + ', otypes=[float])(__t)))  ' + C('eixo x próprio: ' + q.tv));
                else if (q.kind === 'param') body.push('__p = np.linspace(' + q.pa + ', ' + q.pb + ', ' + q.pn + ')', '__cv.append((np.vectorize(lambda ' + E.name(q.pv) + ': ' + q.xx + ', otypes=[float])(__p), np.vectorize(lambda ' + E.name(q.pv) + ': ' + q.ex + ', otypes=[float])(__p)))  ' + C('paramétrica em ' + q.pv));
                else body.push('__cv.append((np.ravel(np.asarray(' + q.xx + ', dtype=float)), np.ravel(np.asarray(' + q.ex + ', dtype=float))))  ' + C('dados'));
              });
              if (r.norm === 'each') body.push('__cv = [(cx, cy / np.nanmax(np.abs(cy))) for cx, cy in __cv]  ' + C('cada curva pelo seu máximo'));
              else if (r.norm === 'common') {
                const ref = r.normRef === 'value' ? E.expr(parse(r.normVal || '1')) : r.normRef === 'curve' ? 'np.nanmax(np.abs(__cv[' + Math.max(0, Math.round(Number(r.normCurve) || 1) - 1) + '][1]))' : 'max(np.nanmax(np.abs(cy)) for cx, cy in __cv)';
                body.push('__ref = ' + ref, '__cv = [(cx, cy / __ref) for cx, cy in __cv]  ' + C('todas pelo mesmo valor'));
              }
              const isTop = (q) => q.t.txpos === 'top', hasTop = traces.some(isTop);
              const dvs = (e) => (String(e ?? '').trim() ? E.expr(parse(e)) : null);
              const dx1 = dvs(r.xdv), dx2 = dvs(r.x2dv);
              traces.forEach((q, k) => { const dd = isTop(q) ? dx2 : dx1; if (dd) body.push('__cv[' + k + '] = (__cv[' + k + '][0] / (' + dd + '), __cv[' + k + '][1])  ' + C('eixo x dividido por ' + (isTop(q) ? r.x2dv : r.xdv))); });
              body.push('fig, ax = plt.subplots(figsize=(' + w + ', ' + hh + '))');
              if (hasTop) body.push('ax2 = ax.twiny()  ' + C('eixo x superior independente'));
              traces.forEach(({ t }, k) => {
                const mk = t.marker && t.marker !== 'none' ? ", marker='" + MARK_PY[t.marker] + "'" + (/open/.test(t.marker) ? ", mfc='none'" : '') + ', ms=3' : '';
                const ls = t.marker && t.marker !== 'none' && t.lines === false ? "ls='none'" : "ls='" + (DASH_PY[t.dash] || '-') + "'";
                body.push((t.txpos === 'top' ? 'ax2' : 'ax') + '.plot(__cv[' + k + '][0], __cv[' + k + '][1], color=' + pyStr(t.color || '#1F5FAE') + ', lw=' + (t.width || 1.5) + ', ' + ls + mk + ', label=' + (t.hideLeg ? '"_nolegend_"' : pyStr(labelPy(t.name || t.expr))) + ')');
              });
              body.push('ax.set_xlabel(' + pyStr(labelPy(r.xlabel)) + '); ax.set_ylabel(' + pyStr(labelPy(r.ylabel)) + ')');
              if (r.xlog) body.push("ax.set_xscale('log')");
              if (r.ylog) body.push("ax.set_yscale('log')");
              if (String(r.xlo || '').trim() && String(r.xhi || '').trim()) body.push('ax.set_xlim(' + r.xlo + ', ' + r.xhi + ')');
              if (String(r.ymin || '').trim() && String(r.ymax || '').trim()) body.push('ax.set_ylim(' + r.ymin + ', ' + r.ymax + ')');
              for (const [ax2, fmt, dec] of [['xaxis', r.xfmt, r.xdec], ['yaxis', r.yfmt, r.ydec]]) {
                const n = String(dec ?? '').trim() === '' ? null : Math.round(Number(dec));
                if (fmt === 'dec' && n != null) body.push('ax.' + ax2 + '.set_major_formatter(__mt.FormatStrFormatter("%.' + n + 'f"))');
                else if (fmt === 'sci' || fmt === 'pow') body.push("ax.ticklabel_format(axis='" + ax2[0] + "', style='sci', scilimits=(0, 0), useMathText=True)");
                else if (fmt === 'si') body.push('ax.' + ax2 + '.set_major_formatter(__mt.EngFormatter())');
                if (fmt) usesMT = true;
              }
              if (hasTop) {
                body.push('ax2.set_xlabel(' + pyStr(labelPy(r.x2label)) + ')');
                if (r.x2log) body.push("ax2.set_xscale('log')");
                if (String(r.x2lo || '').trim() && String(r.x2hi || '').trim()) body.push('ax2.set_xlim(' + r.x2lo + ', ' + r.x2hi + ')');
                body.push('__h1, __l1 = ax.get_legend_handles_labels(); __h2, __l2 = ax2.get_legend_handles_labels()');
              }
              const LH = hasTop ? '__h1 + __h2, __l1 + __l2, ' : '';
              if (r.legend && r.legend !== 'nao') {
                if (r.legend === 'manual') body.push("ax.legend(" + LH + "loc='upper left', bbox_to_anchor=(" + Number(r.legX ?? 0.02) + ', ' + Number(r.legY ?? 0.98) + '), frameon=' + (r.legBox ? 'True' : 'False') + ')');
                else body.push("ax.legend(" + LH + "loc=" + pyStr({ 'sup-esq': 'upper left', 'sup-dir': 'upper right', 'inf-esq': 'lower left', 'inf-dir': 'lower right', fora: 'upper left' }[r.legend] || 'best') + (r.legend === 'fora' ? ', bbox_to_anchor=(1.02, 1)' : '') + ')');
              }
              if (r.panel) body.push('ax.text(' + (r.panelX != null ? Number(r.panelX) : 0.97) + ', ' + (r.panelY != null ? Number(r.panelY) : 0.05) + ', ' + pyStr(r.panel) + ", transform=ax.transAxes, ha='" + (r.panelX != null ? 'left' : 'right') + "', fontweight='bold')");
            } else {
              if (needX) body.push('x__ = ' + xsrc + ';');
              body.push("figure('Units', 'inches', 'Position', [1 1 " + w + ' ' + hh + "]); hold on; box on;");
              traces.forEach((q) => {
                const t = q.t;
                let X, Y;
                if (q.kind === 'func') { X = 'x__'; Y = 'arrayfun(@(' + E.name(xv) + ') ' + q.ex + ', x__)'; }
                else if (q.kind === 'own') { body.push('t__ = linspace(' + q.ta + ', ' + q.tb + ', ' + q.tn + ');'); X = 't__'; Y = 'arrayfun(@(' + E.name(q.tv) + ') ' + q.ex + ', t__)'; }
                else if (q.kind === 'param') { body.push('p__ = linspace(' + q.pa + ', ' + q.pb + ', ' + q.pn + ');'); X = 'arrayfun(@(' + E.name(q.pv) + ') ' + q.xx + ', p__)'; Y = 'arrayfun(@(' + E.name(q.pv) + ') ' + q.ex + ', p__)'; }
                else { X = q.xx; Y = q.ex; }
                body.push('y__ = ' + Y + ';');
                if (r.norm === 'each') body.push('y__ = y__ / max(abs(y__));');
                else if (r.norm === 'common' && r.normRef === 'value') body.push('y__ = y__ / (' + E.expr(parse(r.normVal || '1')) + ');');
                { const dd = t.txpos === 'top' ? r.x2dv : r.xdv; if (String(dd ?? '').trim()) X = '(' + X + ') / (' + E.expr(parse(dd)) + ')'; }
                if (t.txpos === 'top') E.warn.add('MATLAB: curvas do eixo x superior foram desenhadas no eixo principal (o Python exporta o eixo superior).');
                body.push('plot(' + X + ', y__, ' + "'Color', [" + rgb(t.color) + "], 'LineWidth', " + (t.width || 1.5) + ", 'LineStyle', '" + (DASH_M[t.dash] || '-') + "', 'DisplayName', " + mStr(t.name || t.expr) + ');');
              });
              if (r.norm === 'common' && r.normRef !== 'value') E.warn.add('MATLAB: a normalização comum pelo máximo não foi exportada (use o Python).');
              body.push('xlabel(' + mStr(r.xlabel) + '); ylabel(' + mStr(r.ylabel) + ');');
              if (r.xlog) body.push("set(gca, 'XScale', 'log');");
              if (r.ylog) body.push("set(gca, 'YScale', 'log');");
              if (r.legend && r.legend !== 'nao') body.push("legend('Location', '" + ({ 'sup-esq': 'northwest', 'sup-dir': 'northeast', 'inf-esq': 'southwest', 'inf-dir': 'southeast', fora: 'northeastoutside', manual: 'best' }[r.legend] || 'best') + "', 'Box', 'off');");
              body.push("set(gca, 'FontName', 'Arial', 'FontSize', " + pr.font + ", 'TickDir', 'in');");
            }
          } else {
            const hasX = String(r.xmin || '').trim() && String(r.xmax || '').trim(), hasY = String(r.ymin || '').trim() && String(r.ymax || '').trim();
            const prev = E.locals; E.locals = new Set([r.xvar, r.yvar]);
            const ex = E.expr(parse(String(r.zdiv || '').trim() ? '(' + r.expr + ')/(' + r.zdiv + ')' : r.expr));
            E.locals = prev;
            let usesXY = false; parse(r.expr).traverse((q) => { if (q.isSymbolNode && (q.name === r.xvar || q.name === r.yvar)) usesXY = true; });
            const gx = hasX ? (py ? 'np.linspace(' + E.expr(parse(r.xmin)) + ', ' + E.expr(parse(r.xmax)) + ', ' + (r.nx || 101) + ')' : 'linspace(' + E.expr(parse(r.xmin)) + ', ' + E.expr(parse(r.xmax)) + ', ' + (r.nx || 101) + ')') : E.name(r.xvar);
            const gy = hasY ? (py ? 'np.linspace(' + E.expr(parse(r.ymin)) + ', ' + E.expr(parse(r.ymax)) + ', ' + (r.ny || 101) + ')' : 'linspace(' + E.expr(parse(r.ymin)) + ', ' + E.expr(parse(r.ymax)) + ', ' + (r.ny || 101) + ')') : E.name(r.yvar);
            const xn = E.name(r.xvar), yn = E.name(r.yvar);
            body.push(C((r.type === 'heat' ? 'mapa de calor ' : 'superfície 3D ') + figN + ' (estilo ' + pr.label + ')'));
            if (py) {
              if (usesXY) {
                body.push('__X, __Y = np.meshgrid(' + gx + ', ' + gy + ')');
                body.push('__Z = np.vectorize(lambda ' + xn + ', ' + yn + ': ' + ex + ', otypes=[float])(__X, __Y)');
              } else {
                // a expressão já é uma matriz (linhas = y, colunas = x)
                body.push('__Z = np.abs(np.asarray(' + ex + '))');
                const lim = (a, b, nn) => (String(a || '').trim() && String(b || '').trim() ? 'np.linspace(' + E.expr(parse(a)) + ', ' + E.expr(parse(b)) + ', ' + nn + ')' : 'np.arange(' + nn + ')');
                body.push('__X, __Y = np.meshgrid(' + lim(r.xmin, r.xmax, '__Z.shape[1]') + ', ' + lim(r.ymin, r.ymax, '__Z.shape[0]') + ')');
              }
              if (r.znorm === 'max') body.push('__Z = __Z / np.nanmax(np.abs(__Z))  ' + C('normalizado pelo máximo'));
              else if (r.znorm === 'value') body.push('__Z = __Z / (' + E.expr(parse(r.znormVal || '1')) + ')');
              if (String(r.xdv ?? '').trim()) body.push('__X = __X / (' + E.expr(parse(r.xdv)) + ')  ' + C('eixo x dividido por ' + r.xdv));
              if (String(r.ydv ?? '').trim()) body.push('__Y = __Y / (' + E.expr(parse(r.ydv)) + ')  ' + C('eixo y dividido por ' + r.ydv));
              const vlim = String(r.zmin ?? '').trim() && String(r.zmax ?? '').trim() ? ', vmin=' + r.zmin + ', vmax=' + r.zmax : '';
              if (r.type === 'heat') {
                body.push('fig, ax = plt.subplots(figsize=(' + w + ', ' + hh + '))');
                body.push("__m = ax.pcolormesh(__X, __Y, __Z, cmap='" + (CMAP[r.colorscale] || 'viridis') + (r.reverse ? '_r' : '') + "', shading='auto', rasterized=True" + vlim + ')');
                if (r.contours) body.push("ax.contour(__X, __Y, __Z, levels=" + (r.ncont || 10) + ", colors='white', linewidths=0.5, alpha=0.75)");
                body.push('fig.colorbar(__m, ax=ax, pad=0.02).set_label(' + pyStr(labelPy(r.zlabel)) + ')');
                body.push('ax.set_xlabel(' + pyStr(labelPy(r.xlabel)) + '); ax.set_ylabel(' + pyStr(labelPy(r.ylabel)) + ')');
                if (r.panel) body.push('ax.text(0.04, 0.92, ' + pyStr(r.panel) + ", transform=ax.transAxes, color='white', fontweight='bold')");
              } else {
                body.push('fig = plt.figure(figsize=(' + w + ', ' + hh + ')); ax = fig.add_subplot(111, projection="3d")');
                body.push("ax.plot_surface(__X, __Y, __Z, cmap='" + (CMAP[r.colorscale] || 'viridis') + (r.reverse ? '_r' : '') + "', linewidth=0, antialiased=True" + vlim + ')');
                body.push('ax.set_xlabel(' + pyStr(labelPy(r.xlabel)) + '); ax.set_ylabel(' + pyStr(labelPy(r.ylabel)) + '); ax.set_zlabel(' + pyStr(labelPy(r.zlabel)) + ')');
              }
            } else {
              body.push('[X__, Y__] = meshgrid(' + gx + ', ' + gy + ');');
              body.push('Z__ = arrayfun(@(' + xn + ', ' + yn + ') ' + ex + ', X__, Y__);');
              if (String(r.xdv ?? '').trim()) body.push('X__ = X__ / (' + E.expr(parse(r.xdv)) + ');');
              if (String(r.ydv ?? '').trim()) body.push('Y__ = Y__ / (' + E.expr(parse(r.ydv)) + ');');
              body.push("figure('Units', 'inches', 'Position', [1 1 " + w + ' ' + hh + ']);');
              if (r.type === 'heat') {
                body.push("pcolor(X__, Y__, Z__); shading interp; colormap(" + (CMAP_M[r.colorscale] || 'parula') + "); cb = colorbar; cb.Label.String = " + mStr(r.zlabel) + ';');
                if (r.contours) body.push("hold on; contour(X__, Y__, Z__, " + (r.ncont || 10) + ", 'w', 'LineWidth', 0.5);");
              } else body.push('surf(X__, Y__, Z__, \'EdgeColor\', \'none\'); colormap(' + (CMAP_M[r.colorscale] || 'parula') + '); zlabel(' + mStr(r.zlabel) + ');');
              body.push('xlabel(' + mStr(r.xlabel) + '); ylabel(' + mStr(r.ylabel) + ');');
              body.push("set(gca, 'FontName', 'Arial', 'FontSize', " + pr.font + ", 'TickDir', 'in', 'Layer', 'top');");
            }
          }
          if (py) body.push('fig.tight_layout(); fig.savefig(' + pyStr(file) + ', dpi=600)');
          else body.push("exportgraphics(gcf, " + mStr(file) + ", 'Resolution', 600);");
        } catch (e) { body.push(C('gráfico não traduzido: ' + FC.ptError(e))); }
      }
    }

    /* ---- montagem ---- */
    const head = [];
    const when = new Date().toISOString().slice(0, 10);
    if (py) {
      head.push('# -*- coding: utf-8 -*-', '# Gerado pelo MathTi ' + FC.VERSION + ' a partir de "' + (state.name || 'folha') + '" em ' + when + '.',
        '# Requer: numpy, scipy, matplotlib.  Unidades foram convertidas para o SI.',
        '# Atenção: "*" é produto elemento a elemento (NumPy); para produto de matrizes use "@".', '',
        'import numpy as np', 'from scipy import special, integrate, optimize, interpolate', 'import matplotlib.pyplot as plt', ...(usesMT ? ['import matplotlib.ticker as __mt'] : []), ...(usesNS ? ['from types import SimpleNamespace'] : []), '',
        "plt.rcParams.update({'font.family': 'sans-serif', 'font.sans-serif': ['Arial', 'Liberation Sans', 'DejaVu Sans'], 'font.size': 8, 'axes.linewidth': 0.8,",
        "                     'xtick.direction': 'in', 'ytick.direction': 'in', 'xtick.top': True, 'ytick.right': True, 'mathtext.fontset': 'stix'})", '',
        '# constantes físicas (SI)');
      for (const [k, [mname, desc]] of Object.entries(CONSTS)) head.push(E.name(k) + ' = ' + numLit(M[mname].value) + '  # ' + desc);
      const hs = [...E.helpers].map((h) => (h === '_optics' ? FC.PY_OPTICS : PY_HELP[h])).filter(Boolean);
      if (hs.length) head.push('', '# funções auxiliares (equivalentes às da Folha)', ...hs.map((x) => x + '\n'));
      const tail = ['', 'plt.show()'];
      return { text: [...head, ...body, ...tail].join('\n') + '\n', warnings: [...E.warn] };
    }
    const fnName = base.replace(/^[^A-Za-z]+/, '') || 'folha';
    head.push('function ' + fnName + '()', '% Gerado pelo MathTi ' + FC.VERSION + ' a partir de "' + (state.name || 'folha') + '" em ' + when + '.',
      '% Unidades convertidas para o SI. Operações usam .* ./ .^ (elemento a elemento).', '% Salve como ' + fnName + '.m e rode digitando ' + fnName + ' na janela de comandos.', '',
      '% constantes físicas (SI)');
    for (const [k, [mname, desc]] of Object.entries(CONSTS)) head.push(E.name(k) + ' = ' + numLit(M[mname].value) + ';  % ' + desc);
    const nested = E.nested.length ? ['', '% ---- programas da folha (funções aninhadas) ----', ...E.nested.map((x) => x.split('\n').map((l) => '  ' + l).join('\n'))] : [];
    const helpers = [...E.helpers].map((h) => M_HELP[h]).filter(Boolean);
    const text = [...head, ...body.map((l) => '  ' + l), ...nested, 'end', '', ...(helpers.length ? ['% ---- funções auxiliares ----', ...helpers.map((x) => x + '\n')] : [])].join('\n') + '\n';
    return { text, warnings: [...E.warn], fileName: fnName + '.m' };
  }
  FC.translate = translate;
})();
