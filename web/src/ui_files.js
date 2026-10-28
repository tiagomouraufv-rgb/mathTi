/* MathTi 0.9.3 — Salvar (grava sobre o mesmo arquivo) e Salvar como (arquivo novo).
   Android: o arquivo escolhido fica ligado à folha (permissão permanente do Android).
   Windows/navegador (Edge, Chrome): File System Access API; sem ela, baixa o arquivo. */
(function () {
  'use strict';
  const X = (FC.uiExt = FC.uiExt || {});
  const U = () => FC._ui;
  const AND = () => window.FcalcAndroid && window.FcalcAndroid.writeUri;
  const FS = () => !AND() && typeof window.showSaveFilePicker === 'function';
  const docId = () => (X.currentDocId && X.currentDocId()) || 'sem-aba';
  const fileName = () => String(U().state.name || 'folha').replace(/[^\wÀ-ú\-]+/g, '_') + '.fcalc';
  const PICK = { suggestedName: '', types: [{ description: 'Folha do MathTi', accept: { 'application/json': ['.fcalc'] } }] };

  /* ---------- ligação folha ↔ arquivo ---------- */
  // Android: guarda a URI em localStorage; navegador: guarda o "handle" no IndexedDB
  const LK = (id) => 'fcalc.file.' + id;
  function getLinkAndroid(id) { try { return JSON.parse(localStorage.getItem(LK(id)) || 'null'); } catch (e) { return null; } }
  function setLinkAndroid(id, v) { try { if (v) localStorage.setItem(LK(id), JSON.stringify(v)); else localStorage.removeItem(LK(id)); } catch (e) { /* nada */ } }
  let dbp = null;
  function db() {
    if (!dbp) dbp = new Promise((res, rej) => { const q = indexedDB.open('mathti-arquivos', 1); q.onupgradeneeded = () => q.result.createObjectStore('h'); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
    return dbp;
  }
  async function idb(mode, fn) { const d = await db(); return new Promise((res, rej) => { const t = d.transaction('h', mode); const r = fn(t.objectStore('h')); t.oncomplete = () => res(r && r.result); t.onerror = () => rej(t.error); }); }
  const memHandles = new Map();
  async function getHandle(id) { if (memHandles.has(id)) return memHandles.get(id); try { const h = await idb('readonly', (s) => s.get(id)); if (h) memHandles.set(id, h); return h || null; } catch (e) { return null; } }
  async function setHandle(id, h) { if (h) memHandles.set(id, h); else memHandles.delete(id); try { await idb('readwrite', (s) => (h ? s.put(h, id) : s.delete(id))); } catch (e) { /* nada */ } }

  X.linkedFileName = async function () {
    const id = docId();
    if (AND()) { const l = getLinkAndroid(id); return l ? l.name : null; }
    const h = await getHandle(id); return h ? h.name : null;
  };
  async function showLinked() {
    const b = document.getElementById('hdrSave'); if (!b) return;
    const n = await X.linkedFileName();
    b.title = n ? 'Salvar sobre “' + n + '” (Ctrl+S)' : 'Salvar (Ctrl+S): escolha onde guardar o arquivo';
  }
  X.showLinked = showLinked;

  function done(name) { U().state.dirty = false; U().toast('Salvo em ' + name); showLinked(); }

  /* ---------- Salvar como ---------- */
  const pendingAs = new Map();
  let seq = 0;
  window.fcalcSavedAs = (token, ok, uri, name) => {
    const p = pendingAs.get(token); pendingAs.delete(token);
    if (!p) return;
    if (!ok) { U().toast('Gravação cancelada'); return; }
    setLinkAndroid(p.id, { uri, name: name || p.name });
    done(name || p.name);
  };
  async function saveAs() {
    const id = docId(), text = U().serialize(), name = fileName();
    if (AND()) {
      const token = 's' + (++seq);
      pendingAs.set(token, { id, name });
      window.FcalcAndroid.saveFileAs(name, 'application/json', b64(text), token);
      return;
    }
    if (FS()) {
      let h;
      try { h = await window.showSaveFilePicker(Object.assign({}, PICK, { suggestedName: name })); }
      catch (e) { if (e && e.name === 'AbortError') return; U().toast('Não consegui abrir a janela de salvar: ' + e.message); return; }
      try { await writeHandle(h, text); await setHandle(id, h); done(h.name); } catch (e) { U().toast('Erro ao gravar: ' + e.message); }
      return;
    }
    U().saveFile(name, 'application/json', text); // baixa (navegador sem acesso a arquivos)
    U().state.dirty = false;
  }
  async function writeHandle(h, text) {
    if (h.queryPermission && (await h.queryPermission({ mode: 'readwrite' })) !== 'granted') {
      if ((await h.requestPermission({ mode: 'readwrite' })) !== 'granted') throw new Error('sem permissão para gravar');
    }
    const w = await h.createWritable(); await w.write(text); await w.close();
  }

  /* ---------- Salvar (sobre o mesmo arquivo) ---------- */
  async function save() {
    const id = docId(), text = U().serialize();
    if (AND()) {
      const l = getLinkAndroid(id);
      if (!l) return saveAs();
      const r = window.FcalcAndroid.writeUri(l.uri, b64(text));
      if (r === 'ok') return done(l.name);
      setLinkAndroid(id, null);
      U().toast('Não consegui gravar em ' + l.name + ' (' + r + '). Escolha onde salvar.');
      return saveAs();
    }
    if (FS()) {
      const h = await getHandle(id);
      if (!h) return saveAs();
      try { await writeHandle(h, text); return done(h.name); }
      catch (e) { await setHandle(id, null); U().toast('Não consegui gravar em ' + h.name + ' (' + e.message + '). Escolha onde salvar.'); return saveAs(); }
    }
    return saveAs();
  }
  X.saveDoc = save;
  X.saveDocAs = saveAs;

  /* ---------- Abrir (fica ligado ao arquivo aberto) ---------- */
  const pendingOpen = new Map();
  window.fcalcOpened = (token, ok, uri, name) => {
    const p = pendingOpen.get(token); pendingOpen.delete(token);
    if (!p || !ok) return;
    const txt = window.FcalcAndroid.readUri(uri);
    if (txt == null || String(txt).startsWith('ERRO:')) { U().toast('Não consegui ler o arquivo ' + (txt || '')); return; }
    if (/\.fcalc$/i.test(name || '') || /^\s*\{/.test(txt)) {
      FC.openText(txt, name);
      setLinkAndroid(docId(), { uri, name });
      showLinked();
    } else U().toast('Escolha um arquivo .fcalc');
  };
  async function open() {
    if (window.FcalcAndroid && window.FcalcAndroid.openDocument) {
      const token = 'o' + (++seq); pendingOpen.set(token, true);
      window.FcalcAndroid.openDocument(token);
      return;
    }
    if (typeof window.showOpenFilePicker === 'function') {
      let hs;
      try { hs = await window.showOpenFilePicker(Object.assign({}, PICK, { multiple: false })); }
      catch (e) { if (e && e.name === 'AbortError') return; document.getElementById('fileIn').click(); return; }
      const h = hs[0], f = await h.getFile(), txt = await f.text();
      FC.openText(txt, f.name);
      await setHandle(docId(), h); showLinked();
      return;
    }
    document.getElementById('fileIn').click();
  }
  X.openDoc = open;

  function b64(s) {
    const bytes = new TextEncoder().encode(s); let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  }
})();
