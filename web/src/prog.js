/* Folha de Cálculo — programação (prog … end), solve blocks (Given/find/minerr) e EDOs */
'use strict';
(function () {
  const FC = window.FC;
  const M = FC.M;
  const { Overlay, num, parse, normalize, tex, valTex, ptError, splitTop, findTop } = FC;

  /* ================= Funções novas ================= */
  function toNumVec(v) { return FC.flatNums(v); }
  function callD(D, x, y) {
    const r = D(x, M.matrix(y.slice()));
    return toNumVec(r);
  }
  function rkfixed(y0, x1, x2, npts, D) {
    if (typeof D !== 'function') throw new Error('rkfixed(y0, x1, x2, npts, D): D deve ser uma função D(x, y)');
    let y = toNumVec(y0); const a = num(x1), b = num(x2), n = Math.max(1, Math.round(num(npts)));
    const h = (b - a) / n, out = [[a, ...y]];
    let x = a;
    for (let k = 0; k < n; k++) {
      const k1 = callD(D, x, y);
      const k2 = callD(D, x + h / 2, y.map((v, i) => v + (h / 2) * k1[i]));
      const k3 = callD(D, x + h / 2, y.map((v, i) => v + (h / 2) * k2[i]));
      const k4 = callD(D, x + h, y.map((v, i) => v + h * k3[i]));
      y = y.map((v, i) => v + (h / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
      x = a + (k + 1) * h;
      out.push([x, ...y]);
    }
    return M.matrix(out);
  }
  // Dormand–Prince 5(4) com passo adaptativo; saída em npts+1 pontos igualmente espaçados
  const DP = {
    c: [0, 1 / 5, 3 / 10, 4 / 5, 8 / 9, 1, 1],
    a: [[], [1 / 5], [3 / 40, 9 / 40], [44 / 45, -56 / 15, 32 / 9], [19372 / 6561, -25360 / 2187, 64448 / 6561, -212 / 729], [9017 / 3168, -355 / 33, 46732 / 5247, 49 / 176, -5103 / 18656], [35 / 384, 0, 500 / 1113, 125 / 192, -2187 / 6784, 11 / 84]],
    b5: [35 / 384, 0, 500 / 1113, 125 / 192, -2187 / 6784, 11 / 84, 0],
    b4: [5179 / 57600, 0, 7571 / 16695, 393 / 640, -92097 / 339200, 187 / 2100, 1 / 40]
  };
  function Rkadapt(y0, x1, x2, npts, D) {
    if (typeof D !== 'function') throw new Error('Rkadapt(y0, x1, x2, npts, D): D deve ser uma função D(x, y)');
    let y = toNumVec(y0); const a = num(x1), b = num(x2), n = Math.max(1, Math.round(num(npts)));
    const out = [[a, ...y]], rtol = 1e-8, atol = 1e-12;
    let x = a, h = (b - a) / n / 10, steps = 0;
    for (let k = 1; k <= n; k++) {
      const xt = a + ((b - a) * k) / n;
      while ((xt - x) * Math.sign(b - a) > 1e-15 * Math.abs(xt)) {
        if (Math.abs(h) > Math.abs(xt - x)) h = xt - x;
        const K = [];
        for (let s = 0; s < 7; s++) {
          const ys = y.map((v, i) => { let acc = v; for (let j = 0; j < s; j++) acc += h * DP.a[s][j] * K[j][i]; return acc; });
          K.push(callD(D, x + DP.c[s] * h, ys));
        }
        const y5 = y.map((v, i) => v + h * DP.b5.reduce((s, bb, j) => s + bb * K[j][i], 0));
        const y4 = y.map((v, i) => v + h * DP.b4.reduce((s, bb, j) => s + bb * K[j][i], 0));
        let err = 0;
        for (let i = 0; i < y.length; i++) { const sc = atol + rtol * Math.max(Math.abs(y[i]), Math.abs(y5[i])); err = Math.max(err, Math.abs(y5[i] - y4[i]) / sc); }
        if (!isFinite(err)) { h /= 10; if (++steps > 2e6) throw new Error('Rkadapt: a solução divergiu.'); continue; }
        if (err <= 1) { x += h; y = y5; }
        h *= Math.min(5, Math.max(0.2, 0.9 * Math.pow(Math.max(err, 1e-12), -0.2)));
        if (++steps > 2e6) throw new Error('Rkadapt: passos demais (sistema muito rígido?). Tente mais pontos ou outro intervalo.');
      }
      out.push([xt, ...y]);
    }
    return M.matrix(out);
  }
  function polyroots(v) {
    let c = toNumVec(v);
    while (c.length > 1 && c[c.length - 1] === 0) c.pop();
    const n = c.length - 1;
    if (n < 1) throw new Error('polyroots: informe ao menos 2 coeficientes (v₀ + v₁x + …)');
    const an = c[n]; const a = c.map((x) => x / an);
    let z = [];
    for (let k = 0; k < n; k++) z.push(M.multiply(M.complex(0.4, 0.9), 1).pow(k));
    const P = (x) => { let s = M.complex(1, 0); for (let k = n - 1; k >= 0; k--) s = M.add(M.multiply(s, x), a[k]); return s; };
    for (let it = 0; it < 500; it++) {
      let maxd = 0;
      for (let i = 0; i < n; i++) {
        let den = M.complex(1, 0);
        for (let j = 0; j < n; j++) if (j !== i) den = M.multiply(den, M.subtract(z[i], z[j]));
        const d = M.divide(P(z[i]), den);
        z[i] = M.subtract(z[i], d);
        maxd = Math.max(maxd, M.abs(d));
      }
      if (maxd < 1e-14) break;
    }
    z = z.map((r) => (Math.abs(r.im) < 1e-10 * Math.max(1, Math.abs(r.re)) ? r.re : r));
    z.sort((p, q) => (typeof p === 'number' ? p : p.re) - (typeof q === 'number' ? q : q.re));
    return M.matrix(z);
  }
  function golden(f, a, b, sign) {
    const g = (Math.sqrt(5) - 1) / 2;
    let c = b - g * (b - a), d = a + g * (b - a), fc = sign * f(c), fd = sign * f(d);
    for (let k = 0; k < 200 && Math.abs(b - a) > 1e-12 * (1 + Math.abs(c)); k++) {
      if (fc < fd) { b = d; d = c; fd = fc; c = b - g * (b - a); fc = sign * f(c); }
      else { a = c; c = d; fc = fd; d = a + g * (b - a); fd = sign * f(d); }
    }
    return (a + b) / 2;
  }
  function optFn(sign) {
    const fn = function (args, _m, scope) {
      if (args.length !== 4) throw new Error((sign > 0 ? 'minimize' : 'maximize') + '(expressão, x, a, b)');
      const name = args[1].name, code = args[0].compile(), ov = new Overlay(scope);
      const a = num(args[2].compile().evaluate(scope)), b = num(args[3].compile().evaluate(scope));
      return golden((t) => { ov.set(name, t); return num(code.evaluate(ov)); }, a, b, sign);
    };
    fn.rawArgs = true;
    return fn;
  }
  M.import({ rkfixed, Rkadapt, polyroots, minimize: optFn(1), maximize: optFn(-1) }, { override: true });

  /* ================= Programas ================= */
  const ASSIGN = /^([\p{L}_][\p{L}\p{N}_]*)\s*(?:\[(.*)\])?\s*(?:←|<-)\s*(.+)$/u;
  const indentOf = (s) => { let n = 0; for (const ch of s) { if (ch === ' ') n++; else if (ch === '\t') n += 4; else break; } return n; };

  function parseRangeOrExpr(s) {
    const parts = splitTop(s, '..');
    if (parts.length === 2) {
      const left = splitTop(parts[0], ',');
      return { kind: 'range', a: parse(left[0]), b: left[1] ? parse(left[1]) : null, c: parse(parts[1]) };
    }
    return { kind: 'expr', e: parse(s) };
  }
  function rangeTex(r) {
    if (r.kind === 'expr') return tex(r.e);
    return tex(r.a) + (r.b ? ',\\,' + tex(r.b) : '') + '\\,..\\,' + tex(r.c);
  }

  /* Transforma as linhas de um programa em árvore de comandos */
  function parseProgram(lines, firstLineNo) {
    const items = lines.map((raw, k) => ({ raw, no: firstLineNo + k, ind: indentOf(raw), s: normalize(FC.splitComment(raw)[0]).trim() }))
      .filter((it) => it.s && !it.s.startsWith('//'));
    let pos = 0;
    function block(minInd) {
      const out = [];
      if (pos >= items.length) return out;
      const ind = items[pos].ind;
      if (ind < minInd) return out;
      while (pos < items.length && items[pos].ind === ind) {
        const it = items[pos++];
        out.push(stmt(it, ind));
      }
      if (pos < items.length && items[pos].ind > ind) { const it = items[pos]; throw lineErr(it, 'Recuo (espaços no início) inesperado.'); }
      return out;
    }
    function body(it, ind) {
      if (pos >= items.length || items[pos].ind <= ind) throw lineErr(it, 'O bloco depois de “' + it.s.split(/\s/)[0] + '” está vazio. Recue (com espaços) as linhas de dentro.');
      return block(ind + 1);
    }
    function lineErr(it, msg) { const e = new Error('Linha ' + it.no + ': ' + msg); e.lineNo = it.no; return e; }
    function stmt(it, ind) {
      const s = it.s;
      try {
        let m;
        if ((m = s.match(/^for\s+([\p{L}_][\p{L}\p{N}_]*)\s*(?:∈|\bin\b)\s*(.+)$/u))) return { t: 'for', v: m[1], r: parseRangeOrExpr(m[2]), body: body(it, ind), it };
        if ((m = s.match(/^while\s+(.+)$/))) return { t: 'while', c: parse(m[1]), body: body(it, ind), it };
        if ((m = s.match(/^if\s+(.+)$/))) {
          const node = { t: 'if', arms: [{ c: parse(m[1]), body: body(it, ind) }], it };
          while (pos < items.length && items[pos].ind === ind) {
            const nx = items[pos]; let mm;
            if ((mm = nx.s.match(/^(?:else\s+if|elif|elseif)\s+(.+)$/))) { pos++; node.arms.push({ c: parse(mm[1]), body: body(nx, ind) }); }
            else if (/^(else|otherwise)$/.test(nx.s)) { pos++; node.els = body(nx, ind); break; }
            else break;
          }
          return node;
        }
        if (/^(else|otherwise|elif|elseif)\b/.test(s) || /^else\s+if\b/.test(s)) throw new Error('“else” sem “if” correspondente no mesmo recuo.');
        if (s === 'try') {
          const node = { t: 'try', body: body(it, ind), it };
          if (pos < items.length && items[pos].ind === ind && /^on\s+error$/.test(items[pos].s)) { const nx = items[pos++]; node.handler = body(nx, ind); }
          else node.handler = [];
          return node;
        }
        if (s === 'break') return { t: 'break', it };
        if (s === 'continue') return { t: 'continue', it };
        if ((m = s.match(/^return\s+(.+)$/))) return { t: 'return', e: parse(m[1]), it };
        if ((m = s.match(ASSIGN))) {
          return { t: 'set', name: m[1], idx: m[2] != null ? splitTop(m[2], ',').map((x) => FC.M.parse(x.trim())) : null, e: parse(m[3]), it };
        }
        if (findTop(s, ':=') >= 0) throw new Error('Dentro do programa use ← (ou <-) para atribuir, não :=');
        return { t: 'expr', e: parse(s), it };
      } catch (e) {
        if (e.lineNo) throw e;
        throw lineErr(it, ptError(e));
      }
    }
    const prog = block(0);
    if (pos < items.length) throw lineErr(items[pos], 'Recuo inconsistente.');
    return prog;
  }

  /* Escopo local com vetores/matrizes que crescem por índice, como no Mathcad */
  class Locals extends Overlay {
    constructor(parent) { super(parent); this.arr = new Map(); }
    get(k) {
      if (this.arr.has(k)) {
        const a = this.arr.get(k);
        if (!a.cache) a.cache = M.matrix(rectify(a.data, a.dim));
        return a.cache;
      }
      return super.get(k);
    }
    has(k) { return this.arr.has(k) || super.has(k); }
    setWhole(k, v) { this.arr.delete(k); this.m.set(k, v); }
    setIndexed(k, idx, v) {
      let a = this.arr.get(k);
      if (!a) {
        const cur = this.has(k) ? super.get(k) : undefined;
        let data = [], dim = idx.length;
        if (cur !== undefined && (M.isMatrix(cur) || Array.isArray(cur))) { data = JSON.parse(JSON.stringify(FC.toArr(cur))); dim = Array.isArray(data[0]) ? 2 : 1; }
        a = { data, dim: Math.max(dim, idx.length), cache: null };
        if (a.dim === 2 && data.length && !Array.isArray(data[0])) a.data = data.map((e) => [e]);
        this.arr.set(k, a); this.m.delete(k);
      }
      if (idx.length === 1 && a.dim === 2) idx = [idx[0], 0];
      const i = idx[0];
      if (!(i >= 0) || i !== Math.floor(i)) throw new Error('Índice inválido: ' + i + ' (use inteiros a partir de 0).');
      if (idx.length === 1) { a.data[i] = v; }
      else {
        const j = idx[1];
        if (!(j >= 0) || j !== Math.floor(j)) throw new Error('Índice inválido: ' + j + ' (use inteiros a partir de 0).');
        if (!Array.isArray(a.data[i])) a.data[i] = [];
        a.data[i][j] = v;
      }
      a.cache = null;
    }
  }
  function rectify(data, dim) {
    if (dim === 1) { const o = new Array(data.length); for (let i = 0; i < data.length; i++) o[i] = data[i] === undefined ? 0 : data[i]; return o; }
    let C = 0; for (const r of data) if (r && r.length > C) C = r.length;
    const o = new Array(data.length);
    for (let i = 0; i < data.length; i++) { const r = data[i] || []; const row = new Array(C); for (let j = 0; j < C; j++) row[j] = r[j] === undefined ? 0 : r[j]; o[i] = row; }
    return o;
  }

  const BREAK = { f: 'break' }, CONTINUE = { f: 'continue' };
  class Runner {
    constructor() { this.count = 0; this.t0 = Date.now(); this.limitMs = 120000; }
    tick() {
      if ((++this.count & 8191) === 0) {
        if (Date.now() - this.t0 > this.limitMs) throw new Error('O programa passou de ' + this.limitMs / 1000 + ' s. Laço infinito? Confira a condição do while.');
        if (FC.onTick) FC.onTick();
      }
    }
    run(stmts, sc) {
      let last;
      for (const st of stmts) {
        const r = this.exec(st, sc);
        if (r && r.f) return r;
        if (r !== undefined) last = r;
      }
      return last === undefined ? undefined : { v: last.v };
    }
    exec(st, sc) {
      this.tick();
      try {
        switch (st.t) {
          case 'set': {
            const v = st.e.compile().evaluate(sc);
            if (st.idx) sc.setIndexed(st.name, st.idx.map((n) => Math.round(num(n.compile().evaluate(sc)))), v);
            else sc.setWhole(st.name, v);
            return { v };
          }
          case 'expr': return { v: st.e.compile().evaluate(sc) };
          case 'for': {
            let vals;
            if (st.r.kind === 'range') {
              const a = st.r.a.compile().evaluate(sc), c = st.r.c.compile().evaluate(sc);
              const step = st.r.b ? M.subtract(st.r.b.compile().evaluate(sc), a) : 1;
              const n = Math.floor(num(M.divide(M.subtract(c, a), step)) + 1e-9);
              vals = { length: Math.max(0, n + 1), at: (k) => (k === 0 ? a : M.add(a, M.multiply(k, step))) };
            } else {
              const arr = M.flatten(FC.toArr(st.r.e.compile().evaluate(sc)));
              vals = { length: arr.length, at: (k) => arr[k] };
            }
            let last;
            for (let k = 0; k < vals.length; k++) {
              sc.setWhole(st.v, vals.at(k));
              const r = this.run(st.body, sc);
              if (r === BREAK) break;
              if (r === CONTINUE) continue;
              if (r && r.f === 'return') return r;
              if (r) last = r;
            }
            return last;
          }
          case 'while': {
            let last;
            while (st.c.compile().evaluate(sc)) {
              this.tick();
              const r = this.run(st.body, sc);
              if (r === BREAK) break;
              if (r === CONTINUE) continue;
              if (r && r.f === 'return') return r;
              if (r) last = r;
            }
            return last;
          }
          case 'if': {
            for (const arm of st.arms) if (arm.c.compile().evaluate(sc)) return this.run(arm.body, sc);
            if (st.els) return this.run(st.els, sc);
            return undefined;
          }
          case 'try': {
            try { return this.run(st.body, sc); } catch (e) { if (e.lineNo && e.isTimeout) throw e; return this.run(st.handler, sc); }
          }
          case 'break': return BREAK;
          case 'continue': return CONTINUE;
          case 'return': return { f: 'return', v: st.e.compile().evaluate(sc) };
        }
      } catch (e) {
        if (e.lineNo) throw e;
        const er = new Error('Linha ' + st.it.no + ': ' + ptError(e)); er.lineNo = st.it.no; throw er;
      }
    }
  }
  // compila cada expressão uma única vez
  function precompile(stmts) {
    for (const st of stmts) {
      for (const k of ['e', 'c']) if (st[k]) { const code = st[k].compile(); st[k] = { compile: () => code, node: st[k] }; }
      if (st.idx) st.idx = st.idx.map((n) => { const code = n.compile(); return { compile: () => code, node: n }; });
      if (st.r) for (const k of ['a', 'b', 'c', 'e']) if (st.r[k]) { const nd = st.r[k]; const code = nd.compile(); st.r[k] = { compile: () => code, node: nd }; }
      if (st.body) precompile(st.body);
      if (st.arms) st.arms.forEach((a) => { const code = a.c.compile(); a.c = { compile: () => code, node: a.c }; precompile(a.body); });
      if (st.els) precompile(st.els);
      if (st.handler) precompile(st.handler);
    }
    return stmts;
  }
  const nodeOf = (x) => (x && x.node ? x.node : x);
  function progTexRows(stmts, depth, rows) {
    const pad = depth ? '\\hspace{' + (1.2 * depth).toFixed(1) + 'em}' : '';
    const K = (w) => '\\textbf{' + w + '}\\;';
    for (const st of stmts) {
      switch (st.t) {
        case 'set': rows.push(pad + FC.nameTexOf(st.name) + (st.idx ? '_{' + st.idx.map((n) => tex(nodeOf(n))).join(',') + '}' : '') + '\\leftarrow ' + tex(nodeOf(st.e))); break;
        case 'expr': rows.push(pad + tex(nodeOf(st.e))); break;
        case 'for': rows.push(pad + K('for') + FC.nameTexOf(st.v) + '\\in ' + rangeTexC(st.r)); progTexRows(st.body, depth + 1, rows); break;
        case 'while': rows.push(pad + K('while') + tex(nodeOf(st.c))); progTexRows(st.body, depth + 1, rows); break;
        case 'if':
          st.arms.forEach((a, i) => { rows.push(pad + K(i ? 'else if' : 'if') + tex(nodeOf(a.c))); progTexRows(a.body, depth + 1, rows); });
          if (st.els) { rows.push(pad + '\\textbf{else}'); progTexRows(st.els, depth + 1, rows); }
          break;
        case 'try': rows.push(pad + '\\textbf{try}'); progTexRows(st.body, depth + 1, rows); rows.push(pad + '\\textbf{on error}'); progTexRows(st.handler, depth + 1, rows); break;
        case 'break': rows.push(pad + '\\textbf{break}'); break;
        case 'continue': rows.push(pad + '\\textbf{continue}'); break;
        case 'return': rows.push(pad + K('return') + tex(nodeOf(st.e))); break;
      }
    }
    return rows;
  }
  function rangeTexC(r) {
    if (r.kind === 'expr') return tex(nodeOf(r.e));
    return tex(nodeOf(r.a)) + (r.b ? ',\\,' + tex(nodeOf(r.b)) : '') + '\\,..\\,' + tex(nodeOf(r.c));
  }

  FC.parseProgramLines = (lines, first) => parseProgram(lines, first || 1);

  /* ================= Given / find / minerr ================= */
  function solveLM(resid, x0, mode) {
    let x = x0.slice(), n = x.length;
    let r = resid(x), f = r.reduce((s, v) => s + v * v, 0), lam = 1e-3;
    for (let it = 0; it < 500 && f > 1e-28; it++) {
      const m = r.length, J = [];
      for (let j = 0; j < n; j++) {
        const hj = 1e-7 * Math.max(1, Math.abs(x[j])), xp = x.slice(); xp[j] += hj;
        const rp = resid(xp); J.push(rp.map((v, i) => (v - r[i]) / hj));
      }
      // A = JᵀJ, g = Jᵀr
      const A = [...Array(n)].map((_, i) => [...Array(n)].map((__, k) => { let s = 0; for (let q = 0; q < m; q++) s += J[i][q] * J[k][q]; return s; }));
      const g = [...Array(n)].map((_, i) => { let s = 0; for (let q = 0; q < m; q++) s += J[i][q] * r[q]; return s; });
      let improved = false;
      for (let tries = 0; tries < 30; tries++) {
        const B = A.map((row, i) => row.map((v, k) => v + (i === k ? lam * (A[i][i] + 1e-12) : 0)));
        let dx;
        try { dx = gauss(B, g.map((v) => -v)); } catch (e) { lam *= 10; continue; }
        const xn = x.map((v, i) => v + dx[i]), rn = resid(xn), fn = rn.reduce((s, v) => s + v * v, 0);
        if (isFinite(fn) && fn < f) {
          const rel = Math.max(...dx.map((d, i) => Math.abs(d) / (1e-12 + Math.abs(xn[i]))));
          x = xn; r = rn; f = fn; lam = Math.max(lam / 5, 1e-15); improved = true;
          if (rel < 1e-14) it = 1e9;
          break;
        }
        lam *= 8;
      }
      if (!improved) break;
    }
    return { x, f };
  }
  function gauss(A, b) {
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
  function parseConstraint(s) {
    for (const op of ['==', '<=', '>=', '!=']) { const i = findTop(s, op); if (i >= 0) return { op, l: parse(s.slice(0, i)), r: parse(s.slice(i + 2)) }; }
    // "=" sozinho (não parte de <=, >=, ==)
    let d = 0;
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if ('([{'.includes(ch)) d++; else if (')]}'.includes(ch)) d--;
      else if (d === 0 && ch === '=' && s[i - 1] !== '<' && s[i - 1] !== '>' && s[i - 1] !== '!' && s[i - 1] !== '=' && s[i + 1] !== '=') return { op: '=', l: parse(s.slice(0, i)), r: parse(s.slice(i + 1)) };
      else if (d === 0 && (ch === '<' || ch === '>') && s[i + 1] !== '=') return { op: ch, l: parse(s.slice(0, i)), r: parse(s.slice(i + 1)) };
    }
    throw new Error('Restrição sem “=”, “<” ou “>”. Ex.: x^2 + y^2 = 4');
  }
  const OPTEX = { '=': '\\;\\boldsymbol{=}\\;', '==': '\\;\\boldsymbol{=}\\;', '<': '<', '>': '>', '<=': '\\le ', '>=': '\\ge ', '!=': '\\ne ' };

  /* ================= Processamento de uma região inteira ================= */
  FC.Session.prototype.region = function (src) {
    const L0 = String(src || '').split('\n');
    // comentários no fim da linha (// descrição) saem antes de interpretar blocos
    const L = L0.map((l) => FC.splitComment(l)[0]), DESC = L0.map((l) => FC.splitComment(l)[1]);
    const out = [];
    let i = 0;
    let h = FC._tabBase || 0;
    for (let q = 0; q < i; q++) h = FC.fnv ? FC.fnv(L[q] + '\n', h) : h;
    while (i < L.length) {
      const raw = L[i], s = normalize(raw).trim();
      FC._scope = this.scope;
      if (FC.fnv) { h = FC.fnv(raw + '\n', h); FC._tabKey = String(h); }
      // ---- programa ----
      const pm = s.match(/^(.+?):=\s*prog\s*(=)?\s*$/);
      if (pm) {
        let j = i + 1, endAt = -1;
        let showEnd = false;
        while (j < L.length) {
          const em = normalize(L[j]).trim().match(/^end\s*(=)?$/);
          if (em) { endAt = j; showEnd = !!em[1]; break; }
          j++;
        }
        if (endAt < 0) { out.push({ kind: 'error', raw: raw, err: 'Programa sem “end”. Termine o bloco com uma linha contendo só: end', lines: 1 }); i++; continue; }
        out.push(this.program(pm[1].trim(), L.slice(i + 1, endAt), i + 2, !!pm[2] || showEnd, raw));
        if (DESC[i]) { const o = out[out.length - 1]; o.desc = DESC[i]; o.note = o.note ? o.note + ' · ' + DESC[i] : DESC[i]; }
        out[out.length - 1].lines = endAt - i + 1;
        if (FC.fnv) for (let q = i + 1; q <= endAt; q++) h = FC.fnv(L[q] + '\n', h);
        i = endAt + 1; continue;
      }
      // ---- Given ----
      if (/^(given|dado)$/i.test(s)) {
        let j = i + 1; const cons = [];
        while (j < L.length && !/(find|minerr)\s*\(/.test(normalize(L[j]))) { const t = normalize(L[j]).trim(); if (t && !t.startsWith('//')) cons.push({ s: t, no: j + 1 }); j++; }
        if (j >= L.length) { out.push({ kind: 'error', raw: raw, err: 'Bloco Given sem find(…) ou minerr(…) no fim.', lines: 1 }); i++; continue; }
        out.push(this.given(cons, L[j]));
        out[out.length - 1].lines = j - i + 1;
        if (FC.fnv) for (let q = i + 1; q <= j; q++) h = FC.fnv(L[q] + '\n', h);
        i = j + 1; continue;
      }
      const parts = FC.rowParts(L[i]);
      if (parts.length > 1 && !/^\s/.test(L[i])) {
        const items = parts.map((p, k) => { if (FC.fnv) FC._tabKey = String(h) + ':' + k; return this.line(p); }).filter((x) => x && x.kind !== 'empty');
        const r = { kind: 'row', items: items, lines: 1 };
        if (DESC[i]) { r.desc = DESC[i]; r.note = DESC[i]; }
        out.push(r); i++; continue;
      }
      const r = this.line(L0[i]); r.lines = 1; out.push(r); i++;
    }
    FC._tabBase = h;
    return out;
  };

  FC.Session.prototype.program = function (lhsStr, bodyLines, firstNo, show, raw) {
    try {
      const lnode = FC.lhsParse(lhsStr);
      const stmts = precompile(parseProgram(bodyLines, firstNo));
      const locals = new Set();
      (function collect(list) { for (const st of list) { if (st.name) locals.add(st.name); if (st.v) locals.add(st.v); ['body', 'els', 'handler'].forEach((k) => st[k] && collect(st[k])); if (st.arms) st.arms.forEach((a) => collect(a.body)); } })(stmts);
      if (lnode.isFunctionNode) lnode.args.forEach((a) => a.isSymbolNode && locals.add(a.name));
      FC._texShadow = locals;
      let rows;
      try { rows = progTexRows(stmts, 0, []); } finally { FC._texShadow = null; }
      const body = '\\left|\\,\\begin{array}{l}' + rows.join('\\\\') + '\\end{array}\\right.';
      const runner = () => new Runner();
      if (lnode.isFunctionNode && lnode.fn.isSymbolNode) {
        const params = lnode.args.map((a) => { if (!a.isSymbolNode) throw new Error('Parâmetros devem ser nomes'); return a.name; });
        const scope = this.scope, fname = lnode.fn.name;
        const fn = function (...args) {
          const sc = new Locals(scope);
          params.forEach((p, k) => sc.setWhole(p, args[k]));
          const r = runner().run(stmts, sc);
          if (!r) throw new Error('O programa ' + fname + ' não devolveu valor.');
          return r.v;
        };
        this.scope.set(fname, fn); this.defs.delete(fname); this.ranges.delete(fname);
        return { kind: 'prog', tex: tex(lnode) + '\\coloneqq ' + body, name: fname, stmts };
      }
      if (!lnode.isSymbolNode) throw new Error('À esquerda de := prog deve haver um nome ou uma função f(x).');
      const sc = new Locals(this.scope);
      const r = runner().run(stmts, sc);
      if (!r) throw new Error('O programa não devolveu valor (a última linha deve ser o resultado).');
      this.scope.set(lnode.name, r.v); this.ranges.delete(lnode.name); this.defs.delete(lnode.name);
      return { kind: 'prog', tex: FC.nameTexOf(lnode.name) + '\\coloneqq ' + body, res: show ? valTex(r.v) : null, name: lnode.name, stmts };
    } catch (e) {
      return { kind: 'error', raw: raw + '  …', err: ptError(e) };
    }
  };

  FC.Session.prototype.given = function (cons, solveRaw) {
    const rows = ['\\textbf{Given}'];
    try {
      const C = cons.map((c) => { try { const k = parseConstraint(c.s); rows.push(tex(k.l) + OPTEX[k.op] + tex(k.r)); return k; } catch (e) { throw new Error('Linha ' + c.no + ': ' + ptError(e)); } });
      const s = normalize(solveRaw).trim();
      const m = s.match(/(find|minerr)\s*\(([^()]*)\)/);
      const mode = m[1], vars = splitTop(m[2], ',').map((x) => x.trim()).filter(Boolean);
      if (!vars.length) throw new Error(mode + '(x, y, …): informe as incógnitas.');
      for (const v of vars) if (!this.scope.has(v)) throw new Error('Dê um valor inicial (chute) para “' + v + '” antes do Given, ex.: ' + v + ' := 1');
      const x0 = vars.map((v) => num(this.scope.get(v)));
      const codes = C.map((k) => ({ op: k.op, l: k.l.compile(), r: k.r.compile() }));
      const ov = new Overlay(this.scope);
      const resid = (x) => {
        vars.forEach((v, k) => ov.set(v, x[k]));
        return codes.map((k) => {
          const d = num(k.l.evaluate(ov)) - num(k.r.evaluate(ov));
          if (k.op === '=' || k.op === '==') return d;
          if (k.op === '<' || k.op === '<=') return Math.max(0, d);
          if (k.op === '>' || k.op === '>=') return Math.max(0, -d);
          return 0;
        });
      };
      const r0 = resid(x0);
      if (r0.some((v) => !isFinite(v))) throw new Error('As restrições não podem ser avaliadas no chute inicial.');
      const sol = solveLM(resid, x0, mode);
      const scale = 1 + Math.sqrt(r0.reduce((a, v) => a + v * v, 0));
      if (mode === 'find' && !(Math.sqrt(sol.f) < 1e-7 * scale)) throw new Error('find não encontrou solução (resíduo ' + Math.sqrt(sol.f).toExponential(2) + '). Mude os chutes iniciais ou use minerr.');
      const val = vars.length === 1 ? sol.x[0] : M.matrix(sol.x.map((v) => [v]));
      // linha da solução: lhs := find(...)  |  find(...) =
      const solveTex = '\\mathrm{' + mode + '}\\left(' + vars.map(FC.nameTexOf).join(',\\,') + '\\right)';
      const di = findTop(s, ':=');
      let lineTex, res = null;
      if (di >= 0) {
        const lhs = s.slice(0, di).trim(), lnode = FC.lhsParse(lhs);
        const rhsShow = /=\s*$/.test(s.slice(di + 2));
        if (lnode.isSymbolNode) { this.scope.set(lnode.name, val); this.ranges.delete(lnode.name); this.defs.delete(lnode.name); }
        else if (lnode.isMatrixNode) { lnode.items.forEach((it, k) => { if (it.isSymbolNode) this.scope.set(it.name, sol.x[k]); }); }
        else throw new Error('À esquerda de := use um nome (ex.: sol := find(x, y)).');
        lineTex = tex(lnode) + '\\coloneqq ' + solveTex;
        if (rhsShow) res = valTex(val);
      } else { lineTex = solveTex; res = valTex(val); }
      rows.push(lineTex + (res ? ' = \\color{#1d6b3a}{' + res + '}' : ''));
      return { kind: 'given', tex: rows.join('\\\\'), note: mode === 'minerr' ? 'resíduo ' + Math.sqrt(sol.f).toExponential(2) : null };
    } catch (e) {
      return { kind: 'error', raw: 'Given … ' + solveRaw.trim(), err: ptError(e) };
    }
  };
})();
