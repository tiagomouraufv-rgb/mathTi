/* Folha de Cálculo — interface dos pacotes de extensão (.fpack)
   Aba "Extensões": incluir nova ferramenta (prompt para o Claude), importar, gerenciar, criar a partir da folha. */
'use strict';
(function () {
  const FC = window.FC;
  const U = () => FC._ui;
  const X = FC.uiExt;
  const KEY = 'fcalc.packs';
  const packs = { installed: [], doc: [] }; // doc: pacotes que vieram dentro de uma folha e não estão instalados

  /* ---------- armazenamento ---------- */
  function savePacks() { try { localStorage.setItem(KEY, JSON.stringify(packs.installed)); } catch (e) { U().toast('Não consegui guardar os pacotes no aparelho.'); } }
  X.loadPacks = function () { try { packs.installed = JSON.parse(localStorage.getItem(KEY) || '[]').filter((p) => p && p.id); } catch (e) { packs.installed = []; } };
  const clean = (pk) => { const o = {}; for (const k in pk) if (k !== 'anterior' && k !== 'instalado_em' && !k.startsWith('_')) o[k] = pk[k]; return o; };
  X.allPacks = () => [...packs.installed, ...packs.doc.filter((d) => !packs.installed.some((p) => p.id === d.id))];
  X.activePacks = () => X.allPacks().filter((p) => p.ativo !== false).map(clean);
  X.packsForDoc = () => FC.packsUsedBy(U().state.regions, X.activePacks());
  X.loadDocPacks = function (list, silent) {
    packs.doc = [];
    const msgs = [];
    for (const pk of list || []) {
      if (!pk || !pk.id) continue;
      const inst = packs.installed.find((p) => p.id === pk.id);
      if (inst && FC.cmpVer(inst.versao, pk.versao) >= 0) { if (inst.ativo === false) msgs.push(pk.nome + ' está desativado'); continue; }
      packs.doc.push(Object.assign({}, pk, { ativo: true, _daFolha: true }));
      msgs.push(pk.nome + ' ' + pk.versao + (inst ? ' (mais novo que o instalado)' : ''));
    }
    if (msgs.length && !silent) setTimeout(() => U().toast(msgs.length > 1 ? 'Esta folha usa os pacotes ' + msgs.join(', ') + ', que vieram dentro dela. Para usá-los em outras folhas: Extensões → Pacotes instalados → Instalar.' : 'Esta folha usa o pacote ' + msgs[0] + ', que veio dentro dela. Para usá-lo em outras folhas: Extensões → Pacotes instalados → Instalar.'), 400);
  };

  /* ---------- abas da barra ---------- */
  X.allTools = function (base) {
    const out = [];
    for (const t of base) {
      if (t.id === 'arq') out.push({ id: 'ext', label: 'Extensões', groups: [], extra: extActions });
      out.push(t);
      if (t.id === 'opt') {
        for (const pk of X.allPacks()) {
          if (pk.ativo === false || !pk.barra) continue;
          const groups = (pk.barra.grupos || []).map((g) => [g.nome || '', (g.botoes || []).map((b) => [b.rotulo || '?', b.inserir || '', b.depois || '', b.dica || '', b.ajuda || null])]);
          out.push({ id: 'pk:' + pk.id, label: pk.barra.rotulo || pk.nome, groups, extra: () => packExtras(pk) });
        }
      }
    }
    return out;
  };
  function packExtras(pk) {
    const { bigBtn } = U();
    const out = [];
    if (pk.teoria && pk.teoria.length) out.push(bigBtn('Teoria', '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5"/><path d="M9 8h6M9 12h4"/>', () => openPackTheory(pk)));
    if (pk.exemplo && pk.exemplo.length) { const b = bigBtn('Exemplo', '<path d="M4 19V5l8 4 8-4v14l-8 4z"/>', () => insertExample(pk)); b._help = { lab: 'Exemplo', extra: { descricao: 'Insere na folha as regiões de exemplo do pacote ' + pk.nome + '.', entradas: '—' } }; out.push(b); }
    return out;
  }
  function insertExample(pk) { const n = U().insertRegions(pk.exemplo || []); U().toast(n ? 'Exemplo do pacote inserido (' + n + ' regiões).' : 'O exemplo do pacote está vazio.'); }
  function openPackTheory(pk) {
    const sec = (pk.teoria || []).map((s) => ({ t: s.titulo || '', p: String(s.texto || '').split(/\n\s*\n/), ex: s.exemplo || '' }));
    sec.push({ t: 'Funções do pacote', p: [(pk.descricao || '') + ' Versão ' + pk.versao + (pk.autor ? ', por ' + pk.autor : '') + '.'], f: (pk.funcoes || []).map((f) => [f.assinatura || f.nome, f.descricao || '']) });
    X.theoryDialog(pk.nome + ' ' + pk.versao, sec);
  }
  function extActions() {
    const { bigBtn } = U();
    return [
      bigBtn('Incluir nova ferramenta', '<path d="M12 5v14M5 12h14"/><rect x="3" y="3" width="18" height="18" rx="3"/>', openPrompt),
      bigBtn('Importar pacote', '<path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M4 19h16"/>', openImport),
      bigBtn('Pacotes instalados', '<rect x="3" y="4" width="18" height="5" rx="1"/><rect x="3" y="11" width="18" height="5" rx="1"/><path d="M7 20h10"/>', openManager),
      bigBtn('Criar da folha', '<path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5"/><path d="M9 14h6M12 11v6"/>', openFromSheet),
      h_sep(),
      bigBtn('Pacote de exemplo', '<path d="M21 8l-9-5-9 5 9 5z"/><path d="M3 8v8l9 5 9-5V8"/><path d="M12 13v8"/>', () => { if (FC.DEMO_PACK) reviewPack(JSON.parse(FC.DEMO_PACK)); })
    ];
  }
  const h_sep = () => U().h('div', { class: 'sep' });

  /* ---------- diálogo genérico ---------- */
  function dialog(title, width) {
    const { h, icon } = U();
    const wrap = h('div', { class: 'overlay' });
    const close = () => wrap.remove();
    const body = h('div', { class: 'hbody pk' });
    const foot = h('div', { class: 'pkfoot' });
    const panel = h('div', { class: 'hpanel', role: 'dialog', 'aria-label': title, style: width ? 'width:min(' + width + 'px,100%)' : null },
      h('div', { class: 'hhead' }, title, h('button', { class: 'ib close', 'aria-label': 'Fechar', onclick: close }, icon('<path d="M6 6l12 12M18 6L6 18"/>', 18))), body, foot);
    wrap.append(panel); document.body.append(wrap);
    return { wrap, body, foot, close };
  }
  const btn = (label, fn, cls) => U().h('button', { class: 'btn small ' + (cls || ''), onclick: fn }, label);

  /* ---------- importar ---------- */
  function parsePackText(txt) {
    let s = String(txt || '').trim().replace(/^﻿/, '');
    const fence = s.match(/```(?:json|fpack)?\s*([\s\S]*?)```/);
    if (fence) s = fence[1].trim();
    const a = s.indexOf('{'), b = s.lastIndexOf('}');
    if (a > 0 || (b >= 0 && b < s.length - 1)) s = s.slice(a, b + 1);
    return JSON.parse(s);
  }
  function openImport() {
    const { h } = U();
    const d = dialog('Importar pacote (.fpack)', 760);
    const fileIn = h('input', { type: 'file', hidden: '' });
    const ta = h('textarea', { class: 'src pkpaste', placeholder: 'Ou cole aqui o conteúdo do pacote (o texto que começa com { "formato": "fpack" …). Pode colar a resposta inteira do Claude: o app acha o pacote dentro dela.', spellcheck: 'false', autocapitalize: 'off' });
    const go = (txt) => { let pk; try { pk = parsePackText(txt); } catch (e) { return U().toast('Não é um pacote válido (JSON): ' + e.message); } d.close(); reviewPack(pk); };
    fileIn.addEventListener('change', () => { const f = fileIn.files[0]; if (!f) return; const rd = new FileReader(); rd.onload = () => go(rd.result); rd.readAsText(f); });
    d.body.append(
      h('p', null, 'Escolha o arquivo .fpack que o Claude gerou (no tablet ele costuma estar em Downloads) ou cole o texto do pacote.'),
      h('div', { class: 'pkrow' }, btn('Escolher arquivo…', () => fileIn.click(), 'primary'), fileIn), ta);
    d.foot.append(btn('Cancelar', d.close), btn('Verificar pacote colado', () => go(ta.value), 'primary'));
  }

  /* testes num Worker separado (com limite de tempo) */
  function testInWorker(pk, cb) {
    const src = document.getElementById('fc-worker-src');
    if (!src || typeof Worker === 'undefined') { try { const v = FC.validatePack(pk); cb({ validation: v, result: v.errors.length ? null : FC.runPackTests(pk) }); } catch (e) { cb({ validation: { errors: [e.message], warnings: [] } }); } return; }
    const w = new Worker(URL.createObjectURL(new Blob([src.textContent], { type: 'text/javascript' })));
    const timer = setTimeout(() => { w.terminate(); cb({ validation: { errors: ['Os testes passaram de 20 s (laço infinito?). O pacote não foi instalado.'], warnings: [] } }); }, 20000);
    w.onmessage = (ev) => { const m = ev.data || {}; if (m.type !== 'packtest') return; clearTimeout(timer); w.terminate(); cb(m); };
    w.onerror = (e) => { clearTimeout(timer); w.terminate(); cb({ validation: { errors: ['Erro ao testar: ' + (e.message || 'desconhecido')], warnings: [] } }); };
    w.postMessage({ cmd: 'packtest', job: 1, pack: clean(pk) });
  }

  function reviewPack(pk) {
    const { h, esc } = U();
    const d = dialog('Verificar pacote', 820);
    const inst = packs.installed.find((p) => p.id === pk.id);
    const head = h('div', { class: 'pkhead' },
      h('div', null, h('b', null, pk.nome || '(sem nome)'), ' ', h('span', { class: 'note' }, 'versão ' + (pk.versao || '?') + ' · ' + (pk.id || 'sem id') + (pk.autor ? ' · ' + pk.autor : ''))),
      h('div', { class: 'note' }, pk.descricao || ''));
    d.body.append(head);
    if (inst) {
      const c = FC.cmpVer(pk.versao, inst.versao);
      d.body.append(h('p', { class: c > 0 ? 'pkok' : 'pkwarn' }, c > 0 ? 'Atualização: você tem a versão ' + inst.versao + '. A versão atual fica guardada e pode ser restaurada.' : c === 0 ? 'Você já tem esta versão (' + inst.versao + '). Instalar de novo substitui a cópia atual.' : 'Atenção: este pacote é MAIS ANTIGO (' + pk.versao + ') que o instalado (' + inst.versao + ').'));
    }
    const fl = h('table', { class: 'pkfns' }, ...(pk.funcoes || []).map((f) => h('tr', null, h('td', null, f.assinatura || f.nome || ''), h('td', null, f.descricao || ''))));
    d.body.append(h('h3', null, 'Funções e constantes (' + (pk.funcoes || []).length + ')'), fl);
    if (pk.barra) d.body.append(h('p', { class: 'note' }, 'Cria a aba “' + (pk.barra.rotulo || pk.nome) + '” com ' + (pk.barra.grupos || []).reduce((s, g) => s + (g.botoes || []).length, 0) + ' botões' + (pk.teoria && pk.teoria.length ? ', página de teoria' : '') + (pk.exemplo && pk.exemplo.length ? ' e exemplo' : '') + '.'));
    const js = Object.entries(pk.js || {});
    if (js.length) {
      const det = h('details', { class: 'pkjs' }, h('summary', null, 'Código JavaScript do pacote (' + js.map(([n]) => n).join(', ') + ') — toque para ver'));
      for (const [n, c] of js) det.append(h('pre', null, n + '(' + (c.args || []).join(', ') + ') {\n' + (c.corpo || '') + '\n}'));
      d.body.append(det);
    }
    const status = h('div', { class: 'pkstatus' }, h('span', { class: 'spin' }), ' Verificando e rodando os testes…');
    d.body.append(h('h3', null, 'Verificação'), status);
    const bInstall = btn(inst ? 'Atualizar' : 'Instalar', null, 'primary'); bInstall.disabled = true;
    const bForce = btn('Instalar mesmo assim', null); bForce.hidden = true;
    d.foot.append(btn('Cancelar', d.close), bForce, bInstall);
    const doInstall = () => { install(pk); d.close(); };
    bInstall.onclick = doInstall;
    bForce.onclick = () => { if (window.confirm('Alguns testes falharam. Instalar assim mesmo?')) doInstall(); };
    testInWorker(pk, (m) => {
      const v = m.validation || { errors: [], warnings: [] }, r = m.result;
      status.innerHTML = '';
      const list = h('ul', { class: 'pklist' });
      for (const e of v.errors) list.append(h('li', { class: 'bad' }, e));
      if (r) for (const e of r.compileErrors) list.append(h('li', { class: 'bad' }, 'Código: ' + e));
      for (const w of v.warnings) list.append(h('li', { class: 'warn' }, w));
      if (r) for (const w of r.exampleErrors || []) list.append(h('li', { class: 'warn' }, w));
      status.append(list);
      if (r && r.tests.length) {
        const ok = r.tests.filter((t) => t.ok).length;
        status.append(h('p', { class: ok === r.tests.length ? 'pkok' : 'pkwarn' }, 'Testes: ' + ok + ' de ' + r.tests.length + ' passaram.'));
        status.append(h('table', { class: 'pkfns' }, ...r.tests.map((t) => h('tr', null, h('td', null, (t.ok ? '✓ ' : '✗ ') + t.expr), h('td', null, t.err ? t.err : 'obtido ' + fmt(t.obtido) + ' · esperado ' + fmt(t.esperado))))));
      }
      const fatal = v.errors.length || (r && r.compileErrors.length);
      const failing = r && r.tests.some((t) => !t.ok);
      if (fatal) status.append(h('p', { class: 'pkbad' }, 'O pacote não pode ser instalado. Envie esta lista ao Claude para ele corrigir.'), btn('Copiar lista de problemas', () => U().copyText(problemReport(pk, v, r), 'Lista')));
      else { bInstall.disabled = false; if (failing) { bInstall.disabled = true; bForce.hidden = false; status.append(btn('Copiar lista de problemas', () => U().copyText(problemReport(pk, v, r), 'Lista'))); } }
    });
    void esc;
  }
  const fmt = (v) => (Array.isArray(v) ? '[' + v.map(fmt).join(', ') + ']' : typeof v === 'number' ? FC.numStr(v) : String(v));
  function problemReport(pk, v, r) {
    const L = ['O pacote ' + pk.id + ' ' + pk.versao + ' não passou na verificação do MathTi ' + FC.VERSION + '. Corrija e devolva o arquivo .fpack completo, com a mesma "versao" ou maior.', ''];
    for (const e of v.errors) L.push('- Erro: ' + e);
    if (r) { for (const e of r.compileErrors) L.push('- Erro no código: ' + e); for (const t of r.tests) if (!t.ok) L.push('- Teste falhou: ' + t.expr + ' → ' + (t.err || 'obtido ' + fmt(t.obtido) + ', esperado ' + fmt(t.esperado))); }
    for (const w of v.warnings) L.push('- Aviso: ' + w);
    if (r) for (const w of r.exampleErrors || []) L.push('- ' + w);
    return L.join('\n');
  }
  function install(pk) {
    const i = packs.installed.findIndex((p) => p.id === pk.id);
    const neu = Object.assign(clean(pk), { ativo: true, instalado_em: new Date().toISOString().slice(0, 10) });
    if (i >= 0) { neu.anterior = clean(packs.installed[i]); packs.installed[i] = neu; } else packs.installed.push(neu);
    packs.doc = packs.doc.filter((p) => p.id !== pk.id);
    savePacks(); refresh();
    U().toast('Pacote ' + pk.nome + ' ' + pk.versao + ' instalado.' + (pk.barra ? ' Veja a aba “' + (pk.barra.rotulo || pk.nome) + '”.' : ''));
  }
  function refresh() { U().buildRibbon(); U().recalc(); }

  /* ---------- gerenciar ---------- */
  function openManager() {
    const { h } = U();
    const d = dialog('Pacotes instalados', 820);
    const draw = () => {
      d.body.innerHTML = '';
      const all = X.allPacks();
      if (!all.length) d.body.append(h('p', { class: 'hint' }, 'Nenhum pacote ainda. Use “Incluir nova ferramenta” para pedir um ao Claude, ou “Pacote de exemplo” para ver como funciona.'));
      for (const pk of all) {
        const doc = !!pk._daFolha;
        const chk = h('input', { type: 'checkbox' }); chk.checked = pk.ativo !== false;
        chk.addEventListener('change', () => { pk.ativo = chk.checked; if (!doc) savePacks(); refresh(); });
        const row = h('div', { class: 'pkitem' },
          h('div', { class: 'pkinfo' },
            h('label', { class: 'pkon' }, chk, h('b', null, pk.nome), ' ', h('span', { class: 'note' }, 'v' + pk.versao + ' · ' + pk.id + (doc ? ' · veio da folha aberta' : pk.instalado_em ? ' · instalado em ' + pk.instalado_em : ''))),
            h('div', { class: 'note' }, (pk.funcoes || []).map((f) => f.nome).join(', '))),
          h('div', { class: 'pkbtns' },
            doc ? btn('Instalar', () => { install(pk); draw(); }, 'primary') : null,
            pk.teoria && pk.teoria.length ? btn('Teoria', () => openPackTheory(pk)) : btn('Funções', () => openPackTheory(pk)),
            pk.exemplo && pk.exemplo.length ? btn('Exemplo', () => { insertExample(pk); d.close(); }) : null,
            btn('Salvar .fpack', () => U().saveFile(pk.id + '-' + pk.versao + '.fpack', 'application/octet-stream', JSON.stringify(clean(pk), null, 2))),
            btn('Pedir mudança', () => { d.close(); openPrompt(pk); }),
            pk.anterior ? btn('Voltar à ' + pk.anterior.versao, () => { if (!window.confirm('Voltar ' + pk.nome + ' para a versão ' + pk.anterior.versao + '?')) return; const i = packs.installed.indexOf(pk); const prev = Object.assign({}, pk.anterior, { ativo: true, instalado_em: new Date().toISOString().slice(0, 10), anterior: clean(pk) }); packs.installed[i] = prev; savePacks(); refresh(); draw(); }) : null,
            doc ? null : btn('Remover', () => { if (!window.confirm('Remover o pacote ' + pk.nome + '? Folhas que usam as funções dele vão mostrar erro (as salvas depois de usá-lo trazem uma cópia).')) return; packs.installed = packs.installed.filter((p) => p !== pk); savePacks(); refresh(); draw(); }, 'danger')));
        d.body.append(row);
      }
    };
    draw();
    d.foot.append(btn('Importar pacote', () => { d.close(); openImport(); }), btn('Fechar', d.close, 'primary'));
  }

  /* ---------- prompt para o Claude ---------- */
  const APP_FNS = 'Jn Yn In Kn js ys Her Lag LagA Leg Cheb sinc erf erfc gamma ln log exp sqrt abs re im conj arg sin cos tan asin acos atan atan2 sinh cosh tanh mean median stdev Stdev max min sum prod linterp spline pchip akima interp2D tabelar tabelaXYZ augment stack rows cols col row linspace zeros ones identity transpose inv det dot cross integral deriv Σ Π root if minimize maximize rkfixed Rkadapt polyroots find minerr';
  function buildPrompt(desc, base, ctx) {
    const others = X.allPacks().filter((p) => !base || p.id !== base.id).flatMap((p) => FC.packExports(p));
    const L = [];
    L.push('Quero um pacote de extensão (.fpack) para o meu app “MathTi” ' + FC.VERSION + ' (antes chamado Folha de Cálculo; estilo Mathcad, no Android). O arquivo é JSON (UTF-8) e o app o valida, testa e instala, criando funções, uma aba de botões, uma página de teoria e um exemplo.');
    L.push('', '## O que eu quero', String(desc || '').trim() || '(descreva aqui)');
    if (base) L.push('', '## Pacote atual para alterar', 'Mantenha o mesmo "id" (' + base.id + '), aumente a "versao" (atual ' + base.versao + ') e devolva o pacote COMPLETO:', '```json', JSON.stringify(clean(base), null, 2), '```');
    if (ctx) L.push('', '## Trecho da minha folha (contexto)', '```', ctx, '```');
    L.push('', '## Formato do arquivo', '```json', JSON.stringify(FORMAT_EXAMPLE, null, 2), '```');
    L.push('', '## Regras',
      '1. "formato": "fpack", "versao_formato": 1, "app_minimo": "' + FC.VERSION + '". "id" em minúsculas (letras, números, . - _), ex.: "tiago.nome-curto". "versao" como "1.0.0".',
      '2. "codigo" usa a sintaxe da folha (abaixo), com linhas separadas por \\n no JSON. Só definições: não termine linhas com "=" e não use variáveis de intervalo (x := 0, 0.1 .. 10).',
      '2b. O pacote é autocontido: o "codigo" não enxerga variáveis da minha folha nem materiais; tudo de que ele precisa entra como argumento ou constante do próprio pacote. As constantes físicas da lista abaixo estão disponíveis.',
      '3. "funcoes" lista TUDO o que fica disponível na folha (funções e constantes), com "nome", "assinatura" e "descricao". Nomes auxiliares fora da lista ficam internos. Não repita nomes de funções do app: ' + APP_FNS + ', nem as da óptica (' + (FC.OPTICS_FNS || []).join(' ') + ')' + (others.length ? ', nem dos meus outros pacotes (' + others.join(' ') + ')' : '') + '. Use nomes sem colidir com unidades comuns (m, s, g, K, A, V, W, J, N, Pa, Hz, eV, nm, h, c).',
      '4. Prefira "codigo". Use "js" só para laços numéricos pesados: corpo em JavaScript puro que recebe números (ou listas de listas para matrizes) e devolve número ou lista; use só Math e operações básicas. É proibido: this, window, self, globalThis, document, fetch, eval, Function, constructor, prototype, import, require, setTimeout, template strings (`) e obj["texto"]. Para cada função "js" inclua "python" (def com numpy) e, se possível, "matlab".',
      '5. "testes": pelo menos 5 casos {"expr", "esperado", "tol"} com valores calculados de forma independente (casos-limite, valores conhecidos da literatura). "esperado" é número (ou lista de números) em SI se houver unidades.',
      '6. "barra": aba com grupos de botões; cada botão tem "rotulo" (curto), "inserir" (texto antes do cursor), "depois" (texto depois do cursor), "dica" e "ajuda". A "ajuda" aparece quando clico com o botão direito (ou faço toque longo) no botão e é OBRIGATÓRIA em todos os botões: {"descricao": o que a ferramenta faz, em uma ou duas frases; "entradas": quais argumentos ou valores preciso declarar antes, em que ordem, unidades e restrições; "exemplo": linhas da folha, separadas por \\n, que funcionam sozinhas numa folha vazia (defina o que precisar e termine a última linha com "=" para mostrar o valor)}.',
      '6b. Em "funcoes", cada item também leva "entradas" e "exemplo" no mesmo formato da ajuda dos botões.',
      '7. "teoria": seções com "titulo", "texto" (parágrafos separados por \\n\\n; equações em LaTeX entre $…$ ou $$…$$, com barras invertidas dobradas no JSON) e "exemplo" (linhas da folha que podem terminar em "=" para mostrar o valor). Cite as referências.',
      '8. "exemplo": regiões prontas. Região de matemática: {"type": "math", "w": "third", "src": "..."}. Gráfico XY: {"type": "xy", "w": "third", "xvar": "x", "xmin": "0", "xmax": "1", "npts": 300, "traces": [{"expr": "f(x)", "name": "f", "color": "#1F5FAE", "width": 1.5, "dash": "solid", "marker": "none"}], "xlabel": "x", "ylabel": "y", "legend": "sup-dir"}. Mapa de calor: {"type": "heat", "w": "third", "expr": "g(x, y)", "xvar": "x", "yvar": "y", "xmin": "0", "xmax": "1", "nx": 101, "ymin": "0", "ymax": "1", "ny": 101, "colorscale": "Viridis", "xlabel": "x", "ylabel": "y", "zlabel": "z"}. "w" pode ser third, half, twothird ou full.',
      '9. Opcional: "python" e "matlab" no nível do pacote substituem a tradução automática na exportação (senão o app traduz o "codigo" sozinho).',
      '10. Responda com o arquivo completo nome-do-pacote.fpack (JSON válido, sem comentários) e um resumo curto do que ele faz e de como foi testado.');
    L.push('', '## Sintaxe da folha', SYNTAX);
    return L.join('\n');
  }
  const SYNTAX = [
    '- Definir: a := 2 · função: f(x, y) := 3·x·y · comentário: // texto',
    '- Operadores: + − · (ou *) / ^ ; complexo: i (3 + 4i); π ou pi; e. Atenção: ln é o logaritmo natural e log é base 10 (como no Mathcad); log(x, b) usa a base b',
    '- Unidades depois do número: 532 nm, 10 mW, 1.2 W/cm^2 (convertidas internamente para SI); constantes c, h, ħ, k_B, ε_0, μ_0, q_e, m_e, N_A',
    '- Nomes com subscrito: λ_0, w_0, ε_inf (letras gregas e acentos são permitidos)',
    '- Matrizes: [1, 2; 3, 4] (linhas separadas por ;), vetor coluna [1; 2; 3]; índices começam em 0: v[0], M[i, j]; rows(M), cols(M), col(M, j), row(M, i)',
    '- if(condição, valor_se_verdadeiro, valor_se_falso); integral(expr, t, a, b); deriv(expr, x, x0); Σ(k, a, b, expr); Π(k, a, b, expr); root(expr, x, a, b); minimize(expr, x, a, b)',
    '- EDOs: rkfixed(y0, x1, x2, n, D) e Rkadapt(y0, x1, x2, n, D) com D(x, y) devolvendo o vetor de derivadas; saída [x, y0, y1, …]',
    '- Programas (bloco indentado com 2 espaços; a última linha é o valor):',
    '    f(x, n) := prog',
    '      s ← 0',
    '      for k ∈ 0 .. n - 1',
    '        if k > 3',
    '          break',
    '        s ← s + x^k',
    '      while s > 10',
    '        s ← s/2',
    '      s',
    '    end',
    '  Também: else if cond, else, continue, return valor, try / on error, v[i] ← valor (vetor cresce sozinho). "←" pode ser escrito "<-" e "∈" pode ser "in".',
    '- Funções especiais: ' + APP_FNS
  ].join('\n');
  const FORMAT_EXAMPLE = {
    formato: 'fpack', versao_formato: 1, id: 'tiago.exemplo', nome: 'Nome do pacote', versao: '1.0.0', autor: 'Claude para Tiago', descricao: 'Uma frase sobre o pacote.', app_minimo: '0.6.0',
    codigo: '// constantes e funções na sintaxe da folha\nE_fot(λ) := 1239.84198/λ\nepsL(E, ε_inf, f, E0, γ) := ε_inf + f·E0^2/(E0^2 - E^2 - i·γ·E)',
    js: { gaussSoma: { args: ['x', 'P'], corpo: 'let s = 0;\nfor (const r of P) { const d = (x - r[1]) / r[2]; s += r[0] * Math.exp(-0.5 * d * d); }\nreturn s;', python: 'def gaussSoma(x, P):\n    P = np.atleast_2d(np.asarray(P, dtype=float))\n    return float(np.sum(P[:, 0] * np.exp(-0.5 * ((x - P[:, 1]) / P[:, 2])**2)))', matlab: 'function s = gaussSoma(x, P)\n  s = sum(P(:,1).*exp(-0.5*((x - P(:,2))./P(:,3)).^2));\nend' } },
    funcoes: [{ nome: 'E_fot', assinatura: 'E_fot(λ)', descricao: 'Energia do fóton em eV', entradas: 'λ: comprimento de onda em nm (número sem unidade)', exemplo: 'E_fot(500) =' }, { nome: 'epsL', assinatura: 'epsL(E, ε_inf, f, E0, γ)', descricao: 'Oscilador de Lorentz', entradas: 'E, E0 e γ na mesma unidade de energia (eV); ε_inf e f adimensionais', exemplo: 'epsL(2, 2.2, 0.8, 2.5, 0.25) =' }, { nome: 'gaussSoma', assinatura: 'gaussSoma(x, P)', descricao: 'Soma de gaussianas', entradas: 'x: número; P: matriz com uma linha [A, x0, σ] por gaussiana', exemplo: 'gaussSoma(1, [2, 1, 0.5; 1, 3, 1]) =' }],
    barra: { rotulo: 'Aba', grupos: [{ nome: 'Grupo', botoes: [{ rotulo: 'ε', inserir: 'epsL(', depois: ', ε_inf, f, E0, γ)', dica: 'epsL(E, ε_inf, f, E0, γ)', ajuda: { descricao: 'Função dielétrica de um oscilador de Lorentz, ε(E) = ε∞ + f·E0²/(E0² − E² − iγE).', entradas: 'epsL(E, ε_inf, f, E0, γ): E, E0 e γ em eV (mesma unidade); ε_inf e f adimensionais. Resultado complexo.', exemplo: 'ε_t(E) := epsL(E, 2.2, 0.8, 2.5, 0.25)\nre(ε_t(2)) =' } }] }] },
    teoria: [{ titulo: 'Modelo', texto: 'Parágrafo com equação $$\\varepsilon(E)=\\varepsilon_\\infty+\\frac{fE_0^2}{E_0^2-E^2-i\\gamma E}$$\n\nReferência: autor, revista volume, página (ano).', exemplo: 'epsL(2.5, 2, 1, 2.5, 0.1) =' }],
    exemplo: [{ type: 'math', w: 'third', src: 'ε_t(E) := epsL(E, 2.2, 0.8, 2.5, 0.25)\nre(ε_t(2)) =' }],
    testes: [{ expr: 'E_fot(1239.84198)', esperado: 1, tol: 1e-12 }, { expr: 're(epsL(0, 2, 1, 3, 0.1))', esperado: 3, tol: 1e-12 }, { expr: 'gaussSoma(1, [2, 1, 0.5; 1, 3, 1])', esperado: 2.1353352832366128, tol: 1e-12 }]
  };
  X.packPrompt = buildPrompt;
  function openPrompt(base) {
    const { h, state } = U();
    base = base && base.id ? base : null;
    const d = dialog(base ? 'Pedir mudança no pacote ' + base.nome : 'Incluir nova ferramenta', 820);
    const ta = h('textarea', { class: 'src', placeholder: base ? 'O que mudar? Ex.: incluir a função de absorção com alargamento gaussiano; corrigir a unidade de α.' : 'Descreva o que você quer. Ex.: funções do modelo GSB para MEH-PPV (σ_GSB(λ), taxa de bleaching em função da intensidade, população do estado fundamental), uma aba "GSB" com botões, a teoria com as equações e referências, e um exemplo com gráfico.', spellcheck: 'true' });
    const sel = state.regions.find((r) => r.id === state.selected && r.type === 'math');
    const ctxChk = h('input', { type: 'checkbox' }); ctxChk.checked = !!sel; ctxChk.disabled = !sel;
    const steps = h('ol', { class: 'pksteps' },
      h('li', null, 'Descreva a ferramenta abaixo (quanto mais detalhes, melhor: equações, nomes, unidades, artigos de referência).'),
      h('li', null, 'Toque em ', h('b', null, 'Copiar prompt'), '.'),
      h('li', null, 'Abra o app do Claude, comece uma conversa, cole o prompt e envie.'),
      h('li', null, 'O Claude devolve um arquivo .fpack. Baixe o arquivo (ou copie o texto dele).'),
      h('li', null, 'Volte aqui: aba ', h('b', null, 'Extensões → Importar pacote'), ', escolha o arquivo (ou cole o texto) e toque em ', h('b', null, base ? 'Atualizar' : 'Instalar'), '.'));
    d.body.append(steps, ta, h('label', { class: 'pkon' }, ctxChk, ' Incluir a região de matemática selecionada como contexto' + (sel ? '' : ' (selecione uma região antes de abrir)')));
    const make = () => buildPrompt(ta.value, base, ctxChk.checked && sel ? sel.src : '');
    d.foot.append(btn('Cancelar', d.close), btn('Salvar prompt (.txt)', () => U().saveFile('prompt-pacote.txt', 'text/plain', make())), btn('Copiar prompt', () => { if (!ta.value.trim()) return U().toast('Descreva primeiro o que você quer.'); U().copyText(make(), 'Prompt'); }, 'primary'));
    setTimeout(() => ta.focus(), 50);
  }

  /* ---------- criar a partir da folha ---------- */
  function definedIn(src) {
    const out = [];
    const L = FC.srcParts(src).map((x) => x[0]);
    for (const l of L) {
      if (/^\s/.test(l)) continue; // dentro de programas
      const t = FC.normalize(l).trim(); const di = FC.findTop ? FC.findTop(t, ':=') : t.indexOf(':=');
      if (di <= 0) continue;
      try {
        const n = FC.parse(t.slice(0, di).trim());
        if (n.isSymbolNode) out.push({ nome: n.name, assinatura: n.name });
        else if (n.isFunctionNode) out.push({ nome: n.fn.name, assinatura: n.fn.name + '(' + n.args.map((a) => a.toString()).join(', ') + ')' });
      } catch (e) { /* ignora */ }
    }
    return out;
  }
  function openFromSheet() {
    const { h, state } = U();
    const maths = state.regions.filter((r) => r.type === 'math' && String(r.src || '').trim());
    if (!maths.length) return U().toast('A folha não tem regiões de matemática.');
    const d = dialog('Criar pacote a partir da folha', 820);
    const meta = { nome: '', id: '', versao: '1.0.0', autor: '', descricao: '', rotulo: '' };
    const t = (k, ph) => { const e = h('input', { type: 'text', value: meta[k], placeholder: ph, autocapitalize: 'off', spellcheck: 'false' }); e.addEventListener('input', () => { meta[k] = e.value; if (k === 'nome' && !idTouched) { idI.value = meta.id = 'tiago.' + e.value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40); } }); return e; };
    let idTouched = false;
    const idI = t('id', 'tiago.meu-pacote'); idI.addEventListener('input', () => { idTouched = true; });
    const chks = maths.map((r) => { const c = h('input', { type: 'checkbox' }); c.checked = r.id === state.selected; return [r, c]; });
    d.body.append(
      h('p', null, 'Marque as regiões de matemática com as definições (funções, constantes, programas). Linhas que terminam em “=” são ignoradas. Depois o app mostra a verificação; dá para instalar e salvar o .fpack para mandar a colegas.'),
      h('div', { class: 'grid4' }, U().field('Nome', t('nome', 'Modelo GSB')), U().field('Identificador', idI), U().field('Versão', t('versao', '1.0.0')), U().field('Autor', t('autor', 'Tiago'))),
      U().field('Descrição', t('descricao', 'Para que serve')),
      h('div', { class: 'pkregs' }, ...chks.map(([r, c]) => h('label', { class: 'pkon' }, c, ' ', h('code', null, String(r.src).split('\n').slice(0, 2).join(' ⏎ ').slice(0, 90)), ' ', h('span', { class: 'note' }, '(' + definedIn(r.src).length + ' definições)')))));
    const build = () => {
      // tira os "=" de mostrar valor; linhas que só avaliam (sem :=) saem do pacote
      const keep = (l) => {
        const t = FC.normalize(l).trim();
        const showEq = /(^|[^=<>!:])=\s*$/.test(t);
        if (!showEq || /^\s/.test(l)) return l;
        if (t.includes(':=') || /^end\b/.test(t)) return l.replace(/\s*=\s*$/, '');
        return null;
      };
      const src = chks.filter(([, c]) => c.checked).map(([r]) => String(r.src).split('\n').map(keep).filter((l) => l !== null).join('\n')).join('\n');
      if (!src.trim()) { U().toast('Marque ao menos uma região.'); return null; }
      const fns = definedIn(src).map((f) => Object.assign(f, { descricao: '' }));
      return {
        formato: 'fpack', versao_formato: 1, id: meta.id || 'tiago.pacote', nome: meta.nome || 'Meu pacote', versao: meta.versao || '1.0.0', autor: meta.autor, descricao: meta.descricao, app_minimo: FC.VERSION,
        codigo: src, funcoes: fns,
        barra: { rotulo: meta.nome || 'Pacote', grupos: [{ nome: 'Funções', botoes: fns.map((f) => ({ rotulo: f.nome, inserir: f.assinatura.includes('(') ? f.nome + '(' : f.nome, depois: f.assinatura.includes('(') ? ')' : '', dica: f.assinatura })) }] },
        testes: []
      };
    };
    d.foot.append(btn('Cancelar', d.close), btn('Salvar .fpack', () => { const pk = build(); if (pk) U().saveFile(pk.id + '-' + pk.versao + '.fpack', 'application/octet-stream', JSON.stringify(pk, null, 2)); }), btn('Verificar e instalar', () => { const pk = build(); if (pk) { d.close(); reviewPack(pk); } }, 'primary'));
  }

  X.openPackImport = openImport; X.openPackManager = openManager; X.openPackPrompt = openPrompt; X.reviewPack = reviewPack; X.installPack = install;
})();
