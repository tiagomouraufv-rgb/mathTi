/* MathTi — lista das funções da folha (para gráficos e animações) com descrição pelo botão direito */
'use strict';
(function () {
  const FC = window.FC;
  const U = () => FC._ui;
  const X = FC.uiExt;

  /* funções e variáveis definidas na folha, na forma em que foram escritas, com a descrição (// no fim da linha
     ou um comentário logo acima) */
  X.declaredFunctions = function (opts) {
    opts = opts || {};
    const out = [], seen = new Set();
    for (const r of U().state.regions) {
      if (r.type === 'data' && (opts.vars || opts.data)) {
        const n = FC.varName(r.name, 'D1');
        if (!seen.has(n)) { seen.add(n); out.push({ name: n, sig: n, desc: 'Tabela de dados importada: ' + n + '[j] é a coluna j; ' + n + '[i, j] o elemento.', region: r.id, kind: 'data' }); }
        continue;
      }
      if (r.type !== 'math') continue;
      const L = String(r.src || '').split('\n');
      FC.srcParts(r.src).forEach(([l, k]) => {
        if (/^\s/.test(l)) return;
        const [body, d] = FC.splitComment(l);
        const t = FC.normalize(body).trim(); const di = FC.findTop(t, ':=');
        if (di <= 0) return;
        let n;
        try { n = FC.parse(t.slice(0, di).trim()); } catch (e) { return; }
        let sig, name;
        if (n.isFunctionNode && n.args.length) { name = n.fn.name; sig = name + '(' + n.args.map((a) => a.toString()).join(', ') + ')'; }
        else if (opts.vars && n.isSymbolNode) { name = n.name; sig = name; }
        else return;
        if (seen.has(sig)) return;
        seen.add(sig);
        let desc = d;
        if (!desc && k > 0) { const pv = L[k - 1].trim(); if (pv.startsWith('//')) desc = pv.slice(2).trim(); }
        const L2 = FC.flatLines(r._lines).find((q) => q.name === name && (q.kind === 'fdef' || q.kind === 'prog' || q.kind === 'vdef' || q.kind === 'range'));
        out.push({ name, sig, desc: desc || '', region: r.id, line: k, tex: L2 && L2.tex, kind: n.isFunctionNode ? 'fn' : 'var' });
      });
    }
    for (const pk of (X.activePacks ? X.activePacks() : [])) for (const fn of pk.funcoes || []) {
      if (!fn.assinatura || !fn.assinatura.includes('(') || seen.has(fn.assinatura)) continue;
      seen.add(fn.assinatura);
      out.push({ name: fn.nome, sig: fn.assinatura, desc: (fn.descricao || '') + ' (pacote ' + pk.nome + ')', pack: true, kind: 'fn' });
    }
    return out;
  };

  function closePop() { const p = document.querySelector('.tip-pop'); if (p) p.remove(); }
  /* descrição/definição de uma função, com opção de escrever a descrição na própria folha */
  function showFnInfo(chip, f) {
    closePop();
    const { h, kt, markDirty, recalc, toast } = U();
    const pop = h('div', { class: 'tip-pop', role: 'dialog', 'aria-label': 'Função ' + f.sig },
      h('div', { class: 'tp-head' }, h('b', null, f.sig), h('button', { class: 'tp-x', 'aria-label': 'Fechar', onclick: closePop }, '×')));
    if (f.tex) { const d = h('div', { class: 'tp-tex' }); d.innerHTML = kt(f.tex); pop.append(h('div', { class: 'tp-lab' }, 'Definição'), d); }
    pop.append(h('div', { class: 'tp-lab' }, 'Descrição'), h('p', null, f.desc || 'Sem descrição ainda.'));
    if (!f.pack && f.region) {
      const inp = h('input', { type: 'text', value: f.desc || '', placeholder: 'ex.: função de onda do poço infinito' });
      const save = () => {
        const r = U().state.regions.find((x) => x.id === f.region); if (!r) return;
        const L = String(r.src || '').split('\n');
        const [body] = FC.splitComment(L[f.line]);
        const txt = inp.value.trim();
        L[f.line] = txt ? body.replace(/\s+$/, '') + '   // ' + txt : body;
        r.src = L.join('\n');
        f.desc = txt;
        const el = document.getElementById(r.id); const ta = el && el.querySelector('textarea.src'); if (ta) ta.value = r.src;
        markDirty(true); closePop(); toast('Descrição gravada na definição (// no fim da linha).');
      };
      pop.append(h('div', { class: 'tp-lab' }, 'Escrever a descrição na folha'), h('div', { class: 'tp-row' }, inp, h('button', { class: 'btn small primary', onclick: save }, 'Gravar')),
        h('p', { class: 'hint' }, 'Fica no fim da linha da definição, depois de //, e aparece em cinza ao lado dela.'));
    }
    document.body.append(pop);
    const rc = chip.getBoundingClientRect(), W = Math.min(380, window.innerWidth - 16);
    pop.style.width = W + 'px';
    pop.style.left = Math.max(8, Math.min(window.innerWidth - W - 8, rc.left)) + 'px';
    const top = rc.bottom + 6, ph = pop.offsetHeight;
    pop.style.top = (top + ph > window.innerHeight - 8 ? Math.max(8, rc.top - ph - 6) : top) + 'px';
  }
  X.showFnInfo = showFnInfo;

  /* botão “Funções da folha”: abre uma janela com as equações; toque numa delas insere no campo em uso */
  function openFnList(target, opts) {
    const { h, kt, icon } = U();
    const fns = X.declaredFunctions(opts);
    const wrap = h('div', { class: 'overlay fnl-ov', onclick: (e) => { if (e.target === wrap) close(); } });
    const close = () => { wrap.remove(); document.removeEventListener('keydown', onEsc, true); if (target && target.isConnected) target.focus(); };
    const onEsc = (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); } };
    const search = h('input', { type: 'search', class: 'fnl-search', placeholder: 'procurar (nome ou descrição)…', 'aria-label': 'Procurar função' });
    const list = h('div', { class: 'fnl-list' });
    const insert = (f) => {
      const t = target;
      if (!t || !t.isConnected) { U().toast('Toque antes no campo da curva.'); return; }
      if (t.tagName === 'INPUT' && !t.value.trim()) { t.value = f.sig; t.dispatchEvent(new Event('input', { bubbles: true })); }
      else U().insertAt(t, f.sig, '');
      close();
    };
    const groups = [['fn', 'Funções da folha'], ['var', 'Variáveis'], ['data', 'Tabelas de dados'], ['pack', 'Funções dos pacotes']];
    const groupOf = (f) => (f.pack ? 'pack' : f.kind === 'data' ? 'data' : f.kind === 'var' ? 'var' : 'fn');
    const paint = () => {
      const q = search.value.trim().toLowerCase();
      list.innerHTML = '';
      for (const [g, lab] of groups) {
        const items = fns.filter((f) => groupOf(f) === g && (!q || (f.sig + ' ' + (f.desc || '')).toLowerCase().includes(q)));
        if (!items.length) continue;
        list.append(h('div', { class: 'fnl-group' }, lab + ' (' + items.length + ')'));
        for (const f of items) {
          const eq = h('div', { class: 'fnl-eq' });
          if (f.tex) eq.innerHTML = kt(f.tex); else eq.append(h('code', null, f.sig));
          const row = h('button', { class: 'fnl-row', type: 'button', title: 'Toque: inserir ' + f.sig + ' · botão direito (ou toque longo): detalhes e descrição' },
            h('div', { class: 'fnl-sig' }, h('code', null, f.sig)), eq, f.desc ? h('div', { class: 'fnl-desc' }, f.desc) : null);
          row.addEventListener('click', () => insert(f));
          row.addEventListener('contextmenu', (e) => { e.preventDefault(); e.stopPropagation(); showFnInfo(row, f); });
          list.append(row);
        }
      }
      if (!list.children.length) list.append(h('p', { class: 'hint' }, fns.length ? 'Nada encontrado.' : 'A folha ainda não tem funções definidas.'));
    };
    search.addEventListener('input', paint);
    wrap.append(h('div', { class: 'hpanel fnl', role: 'dialog', 'aria-label': 'Funções da folha' },
      h('div', { class: 'hhead' }, 'Funções da folha', h('button', { class: 'ib close', 'aria-label': 'Fechar', onclick: close }, icon('<path d="M6 6l12 12M18 6L6 18"/>', 18))),
      h('div', { class: 'hbody' }, h('p', { class: 'hint' }, 'Toque numa equação para inseri-la no campo em uso. Botão direito (ou toque longo) mostra a definição completa e permite escrever a descrição.'), search, list)));
    document.body.append(wrap);
    document.addEventListener('keydown', onEsc, true);
    paint();
  }
  X.openFnList = openFnList;
  X.fnChips = function (getTarget, opts) {
    const { h } = U();
    const n = X.declaredFunctions(opts).length;
    if (!n) return h('span');
    let target = null;
    const b = h('button', { class: 'btn small fnl-btn', type: 'button', title: 'Abre a lista das funções da folha com as equações' }, 'ƒ(x)  Funções da folha (' + n + ')');
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); target = (getTarget && getTarget()) || X.targetField(); });
    b.addEventListener('click', () => { if (!target) target = (getTarget && getTarget()) || X.targetField(); openFnList(target, opts); target = null; });
    return h('div', { class: 'fld span4 fnl-fld' }, b, h('span', { class: 'hint' }, 'toque antes no campo da curva; depois escolha a função na janela'));
  };
})();
