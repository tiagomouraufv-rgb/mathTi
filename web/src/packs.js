/* Folha de Cálculo — pacotes de extensão (.fpack): validação, compilação e uso na folha.
   Roda na página e no Worker. Um pacote traz definições na própria sintaxe da folha ("codigo"),
   funções numéricas opcionais em JavaScript ("js"), barra de ferramentas, teoria, exemplos e testes. */
'use strict';
(function () {
  const FC = window.FC;
  const M = FC.M;
  const NAME_RE = /^[\p{L}_][\p{L}\p{N}_]*$/u;
  const ID_RE = /^[a-z0-9][a-z0-9._-]{1,63}$/;
  const VER_RE = /^\d+\.\d+(\.\d+)?$/;
  FC.PACK_FORMAT = 1;

  function cmpVer(a, b) {
    const pa = String(a || '0').split('.').map(Number), pb = String(b || '0').split('.').map(Number);
    for (let i = 0; i < 3; i++) { const d = (pa[i] || 0) - (pb[i] || 0); if (d) return Math.sign(d); }
    return 0;
  }
  FC.cmpVer = cmpVer;

  /* nomes exportados: os listados em "funcoes" */
  function exportsOf(pk) { return (pk.funcoes || []).map((f) => String(f.nome || '').trim()).filter(Boolean); }
  FC.packExports = exportsOf;

  /* JavaScript de pacote: só código numérico; identificadores que dão acesso ao ambiente são proibidos */
  const JS_FORBIDDEN = ['constructor', 'prototype', '__proto__', 'import', 'require', 'fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'postMessage', 'importScripts',
    'FcalcAndroid', 'localStorage', 'sessionStorage', 'indexedDB', 'caches', 'document', 'window', 'self', 'globalThis', 'eval', 'Function', 'setTimeout', 'setInterval',
    'navigator', 'location', 'Worker', 'Blob', 'URL', 'Reflect', 'Proxy', 'Symbol', 'process', 'this', 'arguments', 'with', 'async', 'await', 'Atomics', 'SharedArrayBuffer'];
  function jsProblems(code) {
    const src = String(code || '');
    const out = [];
    // retira strings e comentários antes de procurar
    const bare = src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ').replace(/(["'`])(?:\\.|(?!\1)[^\\])*\1/g, '""');
    if (/`/.test(src)) out.push('template strings (`) não são permitidas');
    if (/\[\s*["'`]/.test(src)) out.push('acesso a propriedade por texto (obj["..."]) não é permitido');
    for (const w of JS_FORBIDDEN) if (new RegExp('(^|[^\\w$])' + w.replace(/\$/g, '\\$') + '(?![\\w$])').test(bare)) out.push('“' + w + '” não é permitido');
    return out;
  }
  FC.packJsProblems = jsProblems;

  /* Validação estrutural (sem executar nada) */
  FC.validatePack = function (pk, opts) {
    opts = opts || {};
    const errors = [], warnings = [];
    if (!pk || typeof pk !== 'object' || Array.isArray(pk)) return { errors: ['O arquivo não é um pacote (.fpack é um objeto JSON).'], warnings };
    if (pk.formato !== 'fpack') errors.push('Falta "formato": "fpack".');
    if (Number(pk.versao_formato) > FC.PACK_FORMAT) errors.push('Pacote no formato ' + pk.versao_formato + '; este app lê até o formato ' + FC.PACK_FORMAT + '. Atualize o app.');
    if (!ID_RE.test(String(pk.id || ''))) errors.push('"id" deve ter letras minúsculas, números, ponto, hífen ou _ (ex.: "tiago.meh-ppv").');
    if (!String(pk.nome || '').trim()) errors.push('Falta "nome".');
    if (!VER_RE.test(String(pk.versao || ''))) errors.push('"versao" deve ser como "1.0.0".');
    if (pk.app_minimo && FC.VERSION && cmpVer(pk.app_minimo, FC.VERSION) > 0) errors.push('Este pacote precisa do app ' + pk.app_minimo + ' ou mais novo (você tem ' + FC.VERSION + ').');
    if (pk.codigo != null && typeof pk.codigo !== 'string') errors.push('"codigo" deve ser um texto (linhas separadas por \\n).');
    const names = exportsOf(pk);
    if (!names.length) errors.push('"funcoes" deve listar ao menos uma função ou constante exportada.');
    const seen = new Set();
    for (const f of pk.funcoes || []) {
      const n = String(f.nome || '').trim();
      if (!NAME_RE.test(n)) { errors.push('Nome inválido em "funcoes": “' + n + '”.'); continue; }
      if (seen.has(n)) errors.push('Nome repetido: ' + n);
      seen.add(n);
      if (n in M && !(opts.allowOverride || []).includes(n)) errors.push('“' + n + '” já é uma função do app. Use outro nome (ex.: ' + n + '_' + String(pk.id || 'p').split(/[.-]/).pop() + ').');
      if (!f.descricao) warnings.push('Função ' + n + ' sem "descricao".');
    }
    const js = pk.js || {};
    if (typeof js !== 'object' || Array.isArray(js)) errors.push('"js" deve ser um objeto { nome: { args, corpo } }.');
    else for (const [n, d] of Object.entries(js)) {
      if (!NAME_RE.test(n)) errors.push('Nome inválido em "js": ' + n);
      if (!d || !Array.isArray(d.args) || typeof d.corpo !== 'string') { errors.push('js.' + n + ' precisa de "args" (lista) e "corpo" (texto).'); continue; }
      for (const a of d.args) if (!/^[A-Za-z_$][\w$]*$/.test(a) || JS_FORBIDDEN.includes(a)) errors.push('js.' + n + ': argumento inválido “' + a + '” (use letras latinas).');
      for (const p of jsProblems(d.corpo)) errors.push('js.' + n + ': ' + p + '.');
      if (n in M) errors.push('js.' + n + ' tem o nome de uma função do app.');
    }
    // nomes exportados precisam estar definidos no código ou no js
    const src = String(pk.codigo || '');
    for (const n of names) {
      const re = new RegExp('(^|\\n)\\s*' + n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*(\\(|:=|≔)');
      if (!re.test(src) && !(js && js[n])) errors.push('“' + n + '” está em "funcoes" mas não é definido em "codigo" nem em "js".');
    }
    if (pk.barra) {
      const b = pk.barra;
      if (!Array.isArray(b.grupos)) errors.push('"barra.grupos" deve ser uma lista.');
      else for (const g of b.grupos) {
        if (!g || !Array.isArray(g.botoes)) { errors.push('Cada grupo da barra precisa de "botoes".'); continue; }
        for (const bt of g.botoes) if (!bt.ajuda || !bt.ajuda.descricao) warnings.push('Botão “' + (bt.rotulo || '?') + '” sem "ajuda" (descricao, entradas, exemplo).');
      }
    }
    if (pk.testes && !Array.isArray(pk.testes)) errors.push('"testes" deve ser uma lista.');
    if (!pk.testes || !pk.testes.length) warnings.push('O pacote não traz testes.');
    if (pk.exemplo && !Array.isArray(pk.exemplo)) errors.push('"exemplo" deve ser uma lista de regiões.');
    if (js && Object.keys(js).length) warnings.push('O pacote tem código JavaScript (' + Object.keys(js).join(', ') + '). Instale só pacotes que você pediu.');
    return { errors, warnings };
  };

  /* Compila: devolve { exports: Map(nome → valor), errors: [...] }. Cache por conteúdo. */
  const cache = new Map();
  function compile(pk) {
    const key = FC.fnv(JSON.stringify(pk));
    if (cache.has(key)) return cache.get(key);
    const S = new FC.Session();
    const errs = [];
    // funções JavaScript primeiro (o código da folha pode usá-las)
    for (const [n, d] of Object.entries(pk.js || {})) {
      const probs = jsProblems(d.corpo);
      if (probs.length) { errs.push('js.' + n + ': ' + probs[0]); continue; }
      try {
        // eslint-disable-next-line no-new-func
        const f = new Function('Math', ...d.args, '"use strict";\n' + d.corpo);
        const g = function () {
          const a = [...arguments].map((v) => (M.isUnit(v) ? v.value : M.isMatrix(v) ? v.toArray() : M.isComplex(v) ? v : FC.num(v)));
          const r = f(Math, ...a);
          return Array.isArray(r) ? M.matrix(r) : r;
        };
        S.scope.set(n, g);
      } catch (e) { errs.push('js.' + n + ': ' + e.message); }
    }
    // materiais e outros pacotes não entram aqui: o pacote é autocontido
    const lines = S.region(String(pk.codigo || ''));
    for (const L of FC.flatLines(lines)) if (L.kind === 'error') errs.push(String(L.raw || '').trim() + ': ' + L.err);
    const exp = new Map();
    for (const n of exportsOf(pk)) {
      if (S.scope.has(n)) exp.set(n, S.scope.get(n));
      else errs.push('“' + n + '” não ficou definido.');
    }
    const out = { exports: exp, errors: errs };
    if (cache.size > 30) cache.clear();
    cache.set(key, out);
    return out;
  }
  FC.compilePack = compile;

  /* Coloca no escopo da folha as funções dos pacotes ativos */
  FC.packScope = function (scope, packs) {
    const errs = [];
    for (const pk of packs || []) {
      if (!pk || pk.ativo === false) continue;
      try {
        const c = compile(pk);
        for (const [n, v] of c.exports) scope.set(n, v);
        if (c.errors.length) errs.push(pk.nome + ': ' + c.errors[0]);
      } catch (e) { errs.push((pk.nome || pk.id) + ': ' + FC.ptError(e)); }
    }
    return errs;
  };

  /* Testes do pacote: { expr, esperado, tol } — esperado pode ser número, lista ou texto */
  FC.runPackTests = function (pk) {
    const c = compile(pk);
    const res = { compileErrors: c.errors.slice(), tests: [] };
    const S = new FC.Session();
    for (const [n, v] of c.exports) S.scope.set(n, v);
    for (const t of pk.testes || []) {
      const r = { expr: t.expr, esperado: t.esperado };
      try {
        const v = S.evalNode(FC.parse(FC.normalize(String(t.expr))));
        const got = M.isUnit(v) ? v.value : M.isMatrix(v) ? M.flatten(v).toArray() : v;
        r.obtido = Array.isArray(got) ? got.map((x) => (M.isComplex(x) ? x.toString() : x)) : M.isComplex(got) ? got.toString() : got;
        const tol = t.tol == null ? 1e-9 : Number(t.tol);
        const cmp = (a, b) => (typeof b === 'number' ? Math.abs(FC.num(a) - b) <= tol * Math.max(1, Math.abs(b)) : String(a) === String(b));
        if (Array.isArray(t.esperado)) r.ok = Array.isArray(got) && got.length === t.esperado.length && t.esperado.every((b, i) => cmp(got[i], b));
        else r.ok = cmp(got, t.esperado);
      } catch (e) { r.ok = false; r.err = FC.ptError(e); }
      res.tests.push(r);
    }
    // os exemplos da ajuda precisam funcionar numa folha vazia (com o pacote)
    res.exampleErrors = [];
    const exs = [];
    for (const f of pk.funcoes || []) if (f.exemplo) exs.push(['função ' + f.nome, f.exemplo]);
    for (const g of (pk.barra && pk.barra.grupos) || []) for (const b of g.botoes || []) if (b.ajuda && b.ajuda.exemplo) exs.push(['botão “' + b.rotulo + '”', b.ajuda.exemplo]);
    for (const [who, ex] of exs) {
      try {
        const S2 = new FC.Session(); for (const [n, v] of c.exports) S2.scope.set(n, v);
        const bad = FC.flatLines(S2.region(String(ex))).filter((L) => L.kind === 'error');
        if (bad.length) res.exampleErrors.push('Exemplo da ajuda (' + who + '): ' + String(bad[0].raw || '').trim() + ' → ' + bad[0].err);
      } catch (e) { res.exampleErrors.push('Exemplo da ajuda (' + who + '): ' + FC.ptError(e)); }
    }
    return res;
  };

  /* Pacotes que a folha usa (para gravar junto no .fcalc e na exportação) */
  FC.packsUsedBy = function (regions, packs) {
    const txt = JSON.stringify(regions || []);
    return (packs || []).filter((pk) => pk && pk.ativo !== false && exportsOf(pk).some((n) => new RegExp('(^|[^\\p{L}\\p{N}_])' + n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![\\p{L}\\p{N}_])', 'u').test(txt)));
  };
})();
