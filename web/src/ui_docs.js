/* MathTi — várias folhas abertas (abas), janelas separadas (DeX), desfazer/refazer, copiar/colar regiões,
   atalhos de teclado e ajuda de cada ferramenta (botão direito ou toque longo). */
'use strict';
(function () {
  const FC = window.FC;
  const U = () => FC._ui;
  const X = FC.uiExt;
  const params = new URLSearchParams(location.search);
  const WIN = params.get('janela') ? 'w-' + params.get('janela') : 'main';
  const LIST = 'fcalc.tabs', DOC = (id) => 'fcalc.d.' + id;
  const ls = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* nada */ } }
  };
  const mem = new Map();  // folhas abertas nesta janela, em memória (mantêm resultados e quadros de animação)
  const hist = new Map(); // desfazer/refazer por folha
  let cur = null, clip = null, textClip = '', lastWritten = null, warnedSpace = false;
  const newDocId = () => 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  function readList() { try { const l = JSON.parse(ls.get(LIST) || 'null'); if (l && Array.isArray(l.list)) { l.active = l.active || {}; return l; } } catch (e) { /* nada */ } return { list: [], active: {} }; }
  function writeList(l) { ls.set(LIST, JSON.stringify(l)); }
  function editList(fn) { const l = readList(); fn(l); writeList(l); return l; }
  const plainRegions = () => U().state.regions.map((r) => { const o = {}; for (const k in r) if (!k.startsWith('_')) o[k] = r[k]; return o; });

  /* ---------- guardar e trocar de folha ---------- */
  function saveCurrent() {
    if (!cur) return;
    const st = U().state, js = U().serialize(), t = Date.now();
    if (!ls.set(DOC(cur), js) && !warnedSpace) { warnedSpace = true; U().toast('O aparelho não tem espaço para guardar todas as folhas abertas. Salve as importantes como arquivo (.fcalc) e feche algumas abas.'); }
    editList((l) => { const e = l.list.find((x) => x.id === cur); if (e) { e.name = st.name; e.t = t; } });
    mem.set(cur, { name: st.name, preset: st.preset, regions: st.regions, tabCache: st.tabCache, myStyle: st.myStyle, packs: X.packsForDoc ? X.packsForDoc() : [], t });
  }
  X.saveCurrent = saveCurrent;
  function setTitle() {
    const n = U().state.name || 'sem_titulo';
    document.title = n + ' — MathTi';
    try { if (window.FcalcAndroid && window.FcalcAndroid.setTitle) window.FcalcAndroid.setTitle(n + ' — MathTi'); } catch (e) { /* nada */ }
  }
  function openDoc(id) {
    const st = U().state, e = readList().list.find((x) => x.id === id);
    const m = mem.get(id);
    if (U().state.editing) U().stopEdit(true);
    if (m && m.t >= ((e && e.t) || 0)) {
      Object.assign(st, { name: m.name, preset: m.preset, regions: m.regions, tabCache: m.tabCache || {}, selected: null, editing: null });
      if (m.myStyle) st.myStyle = m.myStyle;
      document.getElementById('docName').value = st.name;
      X.loadDocPacks(m.packs || [], true);
      cur = id;
      U().buildRibbon(); U().buildSheet(); U().recalc();
    } else {
      let doc = null;
      try { doc = JSON.parse(ls.get(DOC(id)) || 'null'); } catch (err) { doc = null; }
      cur = id;
      try { U().load(doc && doc.regions ? doc : FC.EXAMPLE()); } catch (err) { U().load(FC.EXAMPLE()); U().toast('Não consegui abrir esta folha: ' + err.message); }
    }
    if (!hist.has(id)) hist.set(id, { stack: [snap()], idx: 0 });
    editList((l) => { l.active[WIN] = id; });
    renderTabs(); setTitle();
  }
  function switchTo(id) { if (id === cur) return; commitNow(); saveCurrent(); openDoc(id); }
  function addDoc(doc, win) {
    const id = newDocId();
    ls.set(DOC(id), JSON.stringify(doc));
    editList((l) => l.list.push({ id, name: doc.name || 'sem_titulo', win: win || WIN, t: 0 }));
    return id;
  }
  X.newTab = function (doc) {
    commitNow(); saveCurrent();
    const id = addDoc(doc || { app: 'fcalc', version: 1, name: 'sem_titulo', regions: [{ type: 'math', w: 'third', src: '' }] });
    openDoc(id);
    return id;
  };
  X.openInNewTab = function (doc, fname) {
    if (!doc || !Array.isArray(doc.regions)) throw new Error('Arquivo não reconhecido.');
    // se a aba atual está vazia e intocada, usa ela
    const st = U().state;
    const empty = st.regions.length <= 1 && !st.regions.some((r) => String(r.src || '').trim()) && (st.name || 'sem_titulo') === 'sem_titulo';
    if (empty && cur) { U().load(doc); hist.set(cur, { stack: [snap()], idx: 0 }); saveCurrent(); renderTabs(); setTitle(); }
    else X.newTab(doc);
    if (fname) U().toast('Aberto: ' + fname);
  };
  function closeTab(id) {
    const l = readList(), e = l.list.find((x) => x.id === id); if (!e) return;
    const nm = e.id === cur ? U().state.name : e.name;
    if (!window.confirm('Fechar a folha “' + (nm || 'sem_titulo') + '”? Ela deixa de ficar guardada no aparelho; se quiser mantê-la, toque antes em Salvar (.fcalc).')) return;
    const mine = l.list.filter((x) => x.win === WIN);
    const idx = mine.findIndex((x) => x.id === id);
    editList((L) => { L.list = L.list.filter((x) => x.id !== id); });
    ls.del(DOC(id)); mem.delete(id); hist.delete(id);
    if (id !== cur) { renderTabs(); return; }
    cur = null;
    const rest = mine.filter((x) => x.id !== id);
    if (rest.length) openDoc(rest[Math.max(0, idx - 1)].id);
    else if (WIN !== 'main') closeWindow();
    else X.newTab();
  }
  function cycle(d) {
    const mine = readList().list.filter((x) => x.win === WIN); if (mine.length < 2) return;
    const i = mine.findIndex((x) => x.id === cur);
    switchTo(mine[(i + d + mine.length) % mine.length].id);
  }

  /* ---------- janelas (DeX / tela dividida) ---------- */
  function openWindow(id) {
    id = id || cur; if (!id) return;
    commitNow(); saveCurrent();
    editList((l) => { const e = l.list.find((x) => x.id === id); if (e) e.win = 'w-' + id; });
    const opened = (() => {
      try { if (window.FcalcAndroid && window.FcalcAndroid.openWindow) { window.FcalcAndroid.openWindow(id); return true; } } catch (e) { /* nada */ }
      const w = window.open(location.pathname + '?janela=' + encodeURIComponent(id), '_blank');
      return !!w;
    })();
    if (!opened) { editList((l) => { const e = l.list.find((x) => x.id === id); if (e) e.win = WIN; }); U().toast('Não consegui abrir outra janela.'); return; }
    if (id === cur) {
      mem.delete(id); cur = null;
      const mine = readList().list.filter((x) => x.win === WIN);
      if (mine.length) openDoc(mine[0].id); else X.newTab();
    } else renderTabs();
    U().toast('A folha abriu em outra janela. Ao fechar aquela janela, ela volta para cá.');
  }
  function closeWindow() {
    releaseWindow();
    try { if (window.FcalcAndroid && window.FcalcAndroid.closeWindow) { window.FcalcAndroid.closeWindow(); return; } } catch (e) { /* nada */ }
    window.close();
  }
  function releaseWindow() {
    if (WIN === 'main') { saveCurrent(); return true; }
    commitNow(); saveCurrent();
    editList((l) => { for (const e of l.list) if (e.win === WIN) e.win = 'main'; });
    return true;
  }
  FC.releaseWindow = releaseWindow;
  function bringBack(id) {
    if (!window.confirm('Esta folha está aberta em outra janela. Trazer para esta janela? (Feche a outra janela antes, para não editar a mesma folha em dois lugares.)')) return;
    editList((l) => { const e = l.list.find((x) => x.id === id); if (e) e.win = WIN; });
    mem.delete(id);
    switchTo(id);
  }
  function refreshFromStorage() {
    renderTabs();
  }

  /* ---------- barra de abas ---------- */
  function renderTabs() {
    const { h, icon } = U();
    const bar = document.getElementById('docTabs'); if (!bar) return;
    bar.innerHTML = '';
    const l = readList();
    const list = h('div', { class: 'dt-list', role: 'tablist' });
    for (const e of l.list) {
      const mineTab = e.win === WIN;
      if (!mineTab && WIN !== 'main') continue;
      const name = e.id === cur ? U().state.name : e.name;
      if (!mineTab) {
        list.append(h('button', { class: 'dt-tab away', title: 'Aberta em outra janela — toque para trazer de volta', onclick: () => bringBack(e.id) }, icon('<rect x="3" y="5" width="13" height="11" rx="1"/><path d="M8 19h13V8"/>', 14), h('span', null, name || 'sem_titulo')));
        continue;
      }
      const tab = h('div', { class: 'dt-tab' + (e.id === cur ? ' on' : ''), role: 'tab', 'aria-selected': e.id === cur ? 'true' : 'false', title: name },
        h('button', { class: 'dt-name', onclick: () => switchTo(e.id) }, name || 'sem_titulo'),
        h('button', { class: 'dt-x', 'aria-label': 'Fechar folha', title: 'Fechar (Ctrl+W)', onclick: () => closeTab(e.id) }, '×'));
      list.append(tab);
    }
    bar.append(list,
      h('button', { class: 'dt-btn', title: 'Nova folha (Ctrl+N)', 'aria-label': 'Nova folha', onclick: () => X.newTab() }, '+'),
      h('button', { class: 'dt-btn wide', title: 'Abrir esta folha em outra janela (DeX ou tela dividida) — Ctrl+Shift+N', onclick: () => openWindow(cur) }, icon('<rect x="3" y="5" width="13" height="11" rx="1"/><path d="M8 19h13V8"/>', 15), h('span', null, 'Nova janela')));
    const on = list.querySelector('.on'); if (on && on.scrollIntoView) on.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
  X.renderTabs = renderTabs;

  /* ---------- desfazer / refazer ---------- */
  let pending = null, restoring = false;
  // figuras do texto ficam fora das cópias do histórico (só uma referência), para não pesar
  const imgStore = new Map();
  const refImgs = (v) => { const o = {}; for (const [k, d] of Object.entries(v)) { const key = 'ref:' + d.length + ':' + d.slice(-48); imgStore.set(key, d); o[k] = key; } return o; };
  const snap = () => JSON.stringify({ name: U().state.name, regions: plainRegions() }, (k, v) => (k === 'imgs' && v && typeof v === 'object' ? refImgs(v) : v));
  function commitNow() {
    if (!pending || !cur) { pending = null; return; }
    clearTimeout(pending); pending = null;
    const H = hist.get(cur) || { stack: [], idx: -1 };
    const s = snap();
    if (H.stack[H.idx] === s) return;
    H.stack = H.stack.slice(0, H.idx + 1); H.stack.push(s);
    if (H.stack.length > 80) H.stack.shift();
    H.idx = H.stack.length - 1; hist.set(cur, H);
    updateUndoBtns();
  }
  let pendingSince = 0;
  X.onChange = function () {
    if (restoring || !cur) return;
    // agrupa a digitação em blocos (pausa de 0,7 s ou no máximo 2,5 s de digitação contínua)
    if (!pending) pendingSince = Date.now();
    clearTimeout(pending); pending = setTimeout(commitNow, Date.now() - pendingSince > 2500 ? 0 : 700);
    const e = document.querySelector('#docTabs .dt-tab.on .dt-name'); if (e) e.textContent = U().state.name || 'sem_titulo';
    setTimeout(updateUndoBtns, 0);
  };
  function applySnap(s) {
    const { state, DEFAULTS } = U();
    const o = JSON.parse(s);
    for (const r of o.regions) if (r.imgs) for (const k of Object.keys(r.imgs)) if (String(r.imgs[k]).startsWith('ref:')) r.imgs[k] = imgStore.get(r.imgs[k]) || '';
    if (state.editing) U().stopEdit(true);
    state.name = o.name; document.getElementById('docName').value = o.name || '';
    const old = new Map(state.regions.map((r) => [r.id, r]));
    state.regions = o.regions.map((r) => {
      const prev = old.get(r.id);
      const n = Object.assign(DEFAULTS[r.type] ? DEFAULTS[r.type]() : {}, r);
      // mantém quadros de animação se a região não mudou
      if (prev && prev._frames && JSON.stringify(Object.fromEntries(Object.entries(prev).filter(([k]) => !k.startsWith('_')))) === JSON.stringify(r)) { n._frames = prev._frames; n._framesSig = prev._framesSig; n._framesVer = prev._framesVer; }
      return n;
    });
    state.selected = null;
    restoring = true; U().buildSheet(); U().recalc(); U().markDirty(false); restoring = false;
    renderTabs(); setTitle(); updateUndoBtns();
  }
  /* o que estava aberto (edição de equação, formulário do gráfico, campo em uso) volta aberto depois de desfazer */
  function context() {
    const { state } = U();
    const c = { editing: state.editing, forms: [], focus: null, oldSrc: null };
    if (state.editing) { const r = state.regions.find((x) => x.id === state.editing); c.oldSrc = r ? String(r.src || '') : null; }
    document.querySelectorAll('section.region').forEach((sec) => { const f = sec.querySelector(':scope > .form'); if (f && !f.hidden) c.forms.push(sec.id); });
    const a = document.activeElement, sec = a && a.closest && a.closest('section.region');
    if (sec && a.matches('input, textarea, select') && !a.matches('textarea.src')) {
      const all = [...sec.querySelectorAll('input, textarea, select')];
      c.focus = { id: sec.id, i: all.indexOf(a), cls: a.className, caret: a.selectionStart };
    }
    return c;
  }
  function restore(c) {
    const { state, startEdit, toggleForm } = U();
    for (const id of c.forms) { const r = state.regions.find((x) => x.id === id), el = document.getElementById(id); if (r && el && toggleForm) { const f = el.querySelector(':scope > .form'); if (f && f.hidden) toggleForm(r, el); } }
    if (c.editing) {
      const r = state.regions.find((x) => x.id === c.editing);
      if (r && startEdit) {
        startEdit(r.id);
        const ta = document.querySelector('#' + CSS.escape(r.id) + ' textarea.src');
        if (ta) { const a = c.oldSrc || '', b = ta.value; let k = 0; while (k < a.length && k < b.length && a[k] === b[k]) k++; try { ta.setSelectionRange(k, k); } catch (e) { /* nada */ } }
      }
    }
    if (c.focus) {
      const el = document.getElementById(c.focus.id);
      if (el) {
        const all = [...el.querySelectorAll('input, textarea, select')];
        const f = all[c.focus.i] && all[c.focus.i].className === c.focus.cls ? all[c.focus.i] : null;
        if (f) { f.focus(); try { if (c.focus.caret != null) f.setSelectionRange(f.value.length, f.value.length); } catch (e) { /* nada */ } }
      }
    }
  }
  function step(d) {
    commitNow();
    const H = hist.get(cur);
    if (!H || (d < 0 ? H.idx <= 0 : H.idx >= H.stack.length - 1)) return U().toast(d < 0 ? 'Nada para desfazer.' : 'Nada para refazer.');
    const c = context();
    H.idx += d; applySnap(H.stack[H.idx]);
    try { restore(c); } catch (e) { /* nada */ }
  }
  function undo() { step(-1); }
  function redo() { step(1); }
  function updateUndoBtns() {
    const H = hist.get(cur);
    const u = document.getElementById('hdrUndo'), r = document.getElementById('hdrRedo');
    if (u) u.classList.toggle('dim', !(pending || (H && H.idx > 0)));
    if (r) r.classList.toggle('dim', !(H && H.idx < H.stack.length - 1));
  }
  X.undo = undo; X.redo = redo;

  /* ---------- copiar / colar ---------- */
  const selRegion = () => U().state.regions.find((r) => r.id === U().state.selected);
  const cleanRegion = (r) => { const o = {}; for (const k in r) if (!k.startsWith('_') && k !== 'id') o[k] = r[k]; return JSON.parse(JSON.stringify(o)); };
  function writeSys(text) { lastWritten = text; try { if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).catch(() => {}); } catch (e) { /* nada */ } }
  function editingTA() { const a = document.activeElement; return U().state.editing && a && a.tagName === 'TEXTAREA' ? a : null; }
  function copy(cut) {
    const ta = editingTA();
    if (ta) {
      const s = ta.value.slice(ta.selectionStart, ta.selectionEnd);
      if (!s) return U().toast('Selecione o texto a copiar.');
      textClip = s; writeSys(s);
      if (cut) { ta.setRangeText('', ta.selectionStart, ta.selectionEnd, 'start'); ta.dispatchEvent(new Event('input', { bubbles: true })); }
      return U().toast(cut ? 'Texto recortado.' : 'Texto copiado.');
    }
    const r = selRegion();
    if (!r) return U().toast('Toque numa região para selecioná-la e depois copie.');
    clip = [cleanRegion(r)];
    writeSys(r.type === 'math' || r.type === 'text' ? String(r.src || '') : JSON.stringify({ 'mathti-regioes': clip }));
    if (cut) {
      const st = U().state, i = st.regions.indexOf(r);
      st.regions.splice(i, 1); st.selected = null;
      U().buildSheet(); U().recalc(); U().markDirty(false);
      U().toast('Região recortada. Ctrl+V cola, Ctrl+Z desfaz.');
    } else U().toast('Região copiada' + (readList().list.length > 1 ? ' (pode colar em outra folha).' : '.'));
  }
  async function readSys() {
    try {
      if (!navigator.clipboard || !navigator.clipboard.readText) return null;
      return await Promise.race([navigator.clipboard.readText(), new Promise((res) => setTimeout(() => res(null), 400))]);
    } catch (e) { return null; }
  }
  async function paste() {
    const ta = editingTA();
    const sys = await readSys();
    if (ta) {
      const s = sys != null && sys !== '' ? sys : textClip || (clip && clip[0] && clip[0].src) || '';
      if (!s) return U().toast('Nada para colar.');
      ta.focus(); ta.setRangeText(s, ta.selectionStart, ta.selectionEnd, 'end'); ta.dispatchEvent(new Event('input', { bubbles: true }));
      return;
    }
    let regs = null;
    if (sys != null && sys !== '' && sys !== lastWritten) {
      try { const o = JSON.parse(sys); if (o && Array.isArray(o['mathti-regioes'])) regs = o['mathti-regioes']; } catch (e) { regs = [{ type: 'math', w: 'third', src: sys }]; }
    }
    regs = regs || clip;
    if (!regs || !regs.length) return U().toast('Nada para colar. Selecione uma região e copie (Ctrl+C).');
    const n = U().insertRegions(regs);
    U().toast(n === 1 ? 'Região colada.' : n + ' regiões coladas.');
  }
  function duplicateSel() { const r = selRegion(); if (!r) return U().toast('Selecione uma região.'); U().insertRegions([cleanRegion(r)]); }
  function deleteSel() {
    const r = selRegion(); if (!r) return;
    const st = U().state; st.regions.splice(st.regions.indexOf(r), 1); st.selected = null;
    U().buildSheet(); U().recalc(); U().markDirty(false); U().toast('Região excluída. Ctrl+Z desfaz.');
  }
  X.copy = copy; X.paste = paste;

  /* ---------- atalhos ---------- */
  function onKey(e) {
    const ctrl = e.ctrlKey || e.metaKey, k = (e.key || '').toLowerCase();
    const inText = !!(e.target && e.target.closest && e.target.closest('textarea, input, select, [contenteditable="true"]'));
    const go = (fn) => { e.preventDefault(); e.stopPropagation(); fn(); };
    if (k === 'f1') return go(() => document.getElementById('hdrHelp').click());
    if (ctrl && k === 's') return go(() => document.getElementById('hdrSave').click());
    if (ctrl && k === 'o') return go(() => document.getElementById('hdrOpen').click());
    if (ctrl && e.shiftKey && k === 'n') return go(() => openWindow(cur));
    if (ctrl && k === 'n') return go(() => X.newTab());
    if (ctrl && k === 'w') return go(() => closeTab(cur));
    if (ctrl && (k === 'tab' || k === 'pagedown' || k === 'pageup')) return go(() => cycle(k === 'pageup' || (k === 'tab' && e.shiftKey) ? -1 : 1));
    if (ctrl && e.shiftKey && k === 'e') return go(() => FC.uiExt.openMarkdown && FC.uiExt.openMarkdown());
    // desfazer/refazer valem em toda a folha, inclusive na edição de equações e nos formulários dos gráficos
    // (dentro das janelas de diálogo continuam os do sistema)
    const inDialog = !!(e.target && e.target.closest && e.target.closest('.overlay, .tip-pop'));
    if (!inDialog && ctrl && k === 'z' && !e.shiftKey && !e.altKey) return go(undo);
    if (!inDialog && ctrl && !e.altKey && (k === 'y' || (k === 'z' && e.shiftKey))) return go(redo);
    if (inText) return; // dentro de um campo, os outros atalhos de texto são os do sistema
    const hasSel = String(window.getSelection ? window.getSelection() : '').length > 0;
    if (ctrl && k === 'c' && !hasSel) return go(() => copy(false));
    if (ctrl && k === 'x' && !hasSel) return go(() => copy(true));
    if (ctrl && k === 'v') return go(paste);
    if (ctrl && k === 'd') return go(duplicateSel);
    if (k === 'delete' && U().state.selected) return go(deleteSel);
    if (k === 'escape') { if (FC.back && FC.back()) e.preventDefault(); }
  }

  /* ---------- ajuda de cada ferramenta ---------- */
  function closePop() { const p = document.querySelector('.tip-pop'); if (p) p.remove(); }
  function showToolHelp(btn) {
    const info = btn._help; if (!info) return;
    const hp = FC.toolHelp(info.lab, info.ins, info.tip, info.extra);
    if (!hp) return;
    closePop();
    const { h } = U();
    const pop = h('div', { class: 'tip-pop', role: 'dialog', 'aria-label': 'Ajuda: ' + hp.t },
      h('div', { class: 'tp-head' }, h('b', null, hp.t), h('button', { class: 'tp-x', 'aria-label': 'Fechar', onclick: closePop }, '×')),
      h('p', null, hp.d));
    if (hp.e) pop.append(h('div', { class: 'tp-lab' }, 'Entradas'), h('p', null, hp.e));
    if (hp.x) {
      pop.append(h('div', { class: 'tp-lab' }, 'Exemplo'), h('pre', null, hp.x));
      pop.append(h('div', { class: 'tp-btns' }, h('button', { class: 'btn small', onclick: () => { U().addRegion('math', { src: hp.x }); closePop(); } }, 'Inserir exemplo na folha')));
    }
    document.body.append(pop);
    const r = btn.getBoundingClientRect(), W = Math.min(380, window.innerWidth - 16);
    pop.style.width = W + 'px';
    pop.style.left = Math.max(8, Math.min(window.innerWidth - W - 8, r.left)) + 'px';
    const top = r.bottom + 6, ph = pop.offsetHeight;
    pop.style.top = (top + ph > window.innerHeight - 8 ? Math.max(8, r.top - ph - 6) : top) + 'px';
  }
  X.showToolHelp = showToolHelp;

  /* ---------- início ---------- */
  X.docsInit = function () {
    let l = readList();
    if (!l.list.length) {
      // primeira vez nesta versão: a folha guardada antes vira a primeira aba
      const old = ls.get('fcalc.doc');
      let doc = null; try { doc = JSON.parse(old || 'null'); } catch (e) { doc = null; }
      addDoc(doc && doc.regions ? doc : FC.EXAMPLE(), 'main');
      l = readList();
    }
    if (WIN !== 'main') {
      const id0 = params.get('janela');
      if (l.list.some((x) => x.id === id0)) editList((L) => { const e = L.list.find((x) => x.id === id0); e.win = WIN; L.active[WIN] = id0; });
      l = readList();
    }
    let mine = l.list.filter((x) => x.win === WIN);
    if (!mine.length) { addDoc({ app: 'fcalc', version: 1, name: 'sem_titulo', regions: [{ type: 'math', w: 'third', src: '' }] }, WIN); l = readList(); mine = l.list.filter((x) => x.win === WIN); }
    const act = mine.find((x) => x.id === l.active[WIN]) || mine[0];
    openDoc(act.id);

    // botões do cabeçalho
    const keep = (el) => el && el.addEventListener('pointerdown', (e) => e.preventDefault()); // não tira o foco do editor
    const bind = (id, fn) => { const el = document.getElementById(id); if (el) { keep(el); el.addEventListener('click', fn); } };
    bind('hdrUndo', undo); bind('hdrRedo', redo); bind('hdrCopy', () => copy(false)); bind('hdrPaste', paste);
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('contextmenu', (e) => {
      const b = e.target.closest && e.target.closest('.tool');
      if (b && b._help) { e.preventDefault(); showToolHelp(b); }
    });
    document.addEventListener('pointerdown', (e) => { if (!e.target.closest('.tip-pop')) closePop(); }, true);
    window.addEventListener('focus', refreshFromStorage);
    window.addEventListener('storage', (e) => { if (e.key === LIST) refreshFromStorage(); });
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refreshFromStorage(); else { commitNow(); saveCurrent(); } });
    window.addEventListener('pagehide', () => { if (WIN !== 'main') releaseWindow(); else saveCurrent(); });
    updateUndoBtns();
  };
})();
