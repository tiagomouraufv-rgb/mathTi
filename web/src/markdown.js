/* MathTi — exportação da folha para Markdown (Obsidian e outros apps de notas)
   Gera nota.md + pasta de anexos (PNG dos gráficos, GIF das animações, CSV das tabelas, a própria folha .fcalc),
   num ZIP, ou um .md único com as imagens embutidas. Equações em LaTeX ($$ … $$), que o Obsidian mostra. */
'use strict';
(function () {
  const FC = window.FC;
  const U = () => FC._ui;
  const X = FC.uiExt;
  const enc = new TextEncoder();

  const slug = (s) => String(s || 'folha').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w-]+/g, '_').replace(/^_+|_+$/g, '') || 'folha';
  const cell = (v) => String(v == null ? '' : v).replace(/\|/g, '\\|').replace(/\n/g, ' ');
  const num = (v) => (typeof v === 'number' ? FC.numStr(v) : String(v));
  function mdTable(head, rows, max) {
    const L = ['| ' + head.map(cell).join(' | ') + ' |', '|' + head.map(() => ' ---: ').join('|') + '|'];
    const show = rows.length > max ? rows.slice(0, Math.ceil(max / 2)).concat([null], rows.slice(rows.length - Math.floor(max / 2))) : rows;
    for (const r of show) L.push(r === null ? '| ' + head.map(() => '⋮').join(' | ') + ' |' : '| ' + r.map((v) => cell(num(v))).join(' | ') + ' |');
    return L.join('\n');
  }
  const b64ToBytes = (b64) => { const s = atob(b64); const u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; };
  const bytesToB64 = (u) => { let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(s); };

  /* imagem de cada gráfico já desenhado na folha */
  async function plotPNGs(r, opts) {
    const out = [];
    if (opts.journal && /^(xy|heat|surf)$/.test(r.type) && r._data) {
      const url = await FC.exportFigure(r, r._data, 'png');
      out.push(url.split(',')[1]);
      return out;
    }
    const el = document.getElementById(r.id);
    if (!el) return out;
    for (const div of el.querySelectorAll('.js-plotly-plot')) {
      if (div.closest('[hidden]') || !div.offsetWidth) continue;
      const url = await Plotly.toImage(div, { format: 'png', width: div.offsetWidth || 600, height: div.offsetHeight || 400, scale: opts.scale || 2 });
      out.push(url.split(',')[1]);
    }
    return out;
  }

  /* Monta a nota. Devolve { md, files: {caminho: Uint8Array} } */
  async function build(opts, onProg) {
    const { state, texOf, serialize } = U();
    const base = slug(state.name);
    const dir = base + '-anexos';
    const files = {};
    let nFig = 0, nGif = 0, nTab = 0, nImg = 0;
    const L = [];
    const today = new Date().toISOString().slice(0, 10);
    const tags = String(opts.tags || '').split(/[\s,]+/).map((t) => t.replace(/^#/, '')).filter(Boolean);
    L.push('---', 'title: "' + String(state.name || 'folha').replace(/"/g, '\\"') + '"', 'created: ' + today, 'tags: [' + tags.join(', ') + ']', 'origem: MathTi ' + FC.VERSION, '---', '');
    if (!state.regions.some((r) => r.type === 'text' && /^#\s/.test(String(r.src || '').trim()))) L.push('# ' + (state.name || 'Folha'), '');
    const addImg = (name, bytes, mime, alt) => {
      if (opts.single) return '![' + alt + '](data:' + mime + ';base64,' + bytesToB64(bytes) + ')';
      files[dir + '/' + name] = bytes;
      return '![' + alt + '](' + dir + '/' + name + ')';
    };
    const addFile = (name, bytes, label) => {
      if (opts.single) return '';
      files[dir + '/' + name] = bytes;
      return '[' + label + '](' + dir + '/' + name + ')';
    };
    // título da região vira subtítulo; legenda (caption) vai junto do “Figura N.”
    let prevR = null, prevStart = 0;
    const capFix = () => {
      if (!prevR || !prevR.capOn || !String(prevR.cap || '').trim()) return;
      for (let q = prevStart; q < L.length; q++) if (/^\*(Figura|Animação) \d+[^*]*\*$/.test(L[q])) L[q] = L[q] + ' ' + String(prevR.cap).trim().replace(/\n+/g, ' ');
    };
    for (let i = 0; i < state.regions.length; i++) {
      const r = state.regions[i];
      capFix(); prevR = r;
      if (String(r.title || '').trim()) L.push('#### ' + String(r.title).trim(), '');
      prevStart = L.length;
      if (onProg) onProg(i, state.regions.length, r);
      await new Promise((res) => setTimeout(res, 0));
      if (r._err) { L.push('> [!warning] Erro nesta região', '> ' + String(r._err).replace(/\n/g, '\n> '), ''); continue; }
      switch (r.type) {
        case 'text': {
          let s = String(r.src || '').trim();
          // figuras do texto vão para os anexos
          s = s.replace(/!\[([^\]]*)\]\(img:([^)\s]+)\)/g, (m, cap, id) => {
            const data = r.imgs && r.imgs[id]; if (!data) return '';
            const mm = data.match(/^data:(image\/[\w+.-]+);base64,(.*)$/); if (!mm) return '';
            const ext = mm[1] === 'image/png' ? 'png' : mm[1] === 'image/svg+xml' ? 'svg' : 'jpg';
            nImg++;
            const [c0, w] = cap.split('|');
            const md = addImg('imagem' + String(nImg).padStart(2, '0') + '.' + ext, b64ToBytes(mm[2]), mm[1], c0 || 'figura');
            return w && !opts.single ? md.replace('](', '|' + Math.round(6.4 * Number(w)) + '](') : md;
          });
          if (s) L.push(s, '');
          break;
        }
        case 'math': {
          for (const ln of r._lines || []) {
            if (ln.kind === 'comment') { L.push('*' + ln.text + '*', ''); continue; }
            if (ln.kind === 'error') { L.push('> [!warning] `' + String(ln.raw || '').trim() + '`', '> ' + ln.err, ''); continue; }
            const t = texOf(ln, true);
            if (t) L.push('$$', t, '$$', '');
            if (ln.note && ln.kind === 'given') L.push('*' + ln.note + '*', '');
          }
          if (opts.code && String(r.src || '').trim()) L.push('```mathti', String(r.src), '```', '');
          break;
        }
        case 'xy': case 'heat': case 'surf': {
          for (const b64 of await plotPNGs(r, opts)) { nFig++; L.push(addImg('figura' + String(nFig).padStart(2, '0') + '.png', b64ToBytes(b64), 'image/png', 'Figura ' + nFig + (r.panel ? ' ' + r.panel : '')), '', '*Figura ' + nFig + (r.panel ? ' ' + r.panel : '') + '.*', ''); }
          break;
        }
        case 'table': {
          const rows = r._rows || [];
          if (!rows.length) break;
          const nc = rows[0].length;
          const head = r.mode === 'matrix' ? U().splitList(r.names, nc, (k) => 'c' + k) : String(r.cols || '').split('\n').map((x) => x.trim()).filter(Boolean);
          while (head.length < nc) head.push('c' + head.length);
          nTab++;
          L.push(mdTable(head, rows, opts.maxRows), '');
          const csv = head.join(',') + '\n' + rows.map((x) => x.map((v) => (typeof v === 'number' ? String(v) : '"' + String(v).replace(/"/g, '""') + '"')).join(',')).join('\n') + '\n';
          const link = addFile('tabela' + String(nTab).padStart(2, '0') + '.csv', enc.encode(csv), 'Tabela completa (' + rows.length + ' linhas, CSV)');
          L.push('*Tabela ' + nTab + '.* ' + link, '');
          break;
        }
        case 'data': {
          const T = r.table || {};
          L.push('**Dados “' + (r.name || '') + '”**: ' + (T.rows ? T.rows.length : 0) + ' linhas × ' + (T.rows && T.rows[0] ? T.rows[0].length : 0) + ' colunas' + (r.file ? ' (arquivo ' + r.file + ')' : '') + '.', '');
          if (r._defs && r._defs.defs) L.push(r._defs.defs.map((d) => '- `' + d.t + '`: ' + d.d).join('\n'), '');
          break;
        }
        case 'sweep': {
          const sw = r._sweep;
          if (!sw) break;
          L.push('**Varredura de ' + r.param + '** (' + sw.rows.length + ' valores, matriz `' + sw.vname + '`)', '');
          for (const b64 of await plotPNGs(r, opts)) { nFig++; L.push(addImg('figura' + String(nFig).padStart(2, '0') + '.png', b64ToBytes(b64), 'image/png', 'Figura ' + nFig), '', '*Figura ' + nFig + '.*', ''); }
          const names = U().splitList(r.names, sw.exprs.length, (k) => sw.exprs[k]);
          nTab++;
          L.push(mdTable([r.param, ...names], sw.rows, opts.maxRows), '');
          const csv = [r.param, ...names].join(',') + '\n' + sw.rows.map((x) => x.join(',')).join('\n') + '\n';
          const link = addFile('tabela' + String(nTab).padStart(2, '0') + '.csv', enc.encode(csv), 'Tabela completa (CSV)');
          L.push('*Tabela ' + nTab + '.* ' + link, '');
          break;
        }
        case 'fit': {
          const f = r._fit;
          if (!f) break;
          let mtex; try { mtex = '$' + FC.parse(FC.normalize(String(r.model || ''))).toTex({ parenthesis: 'auto', implicit: 'hide' }) + '$'; } catch (e) { mtex = '`' + r.model + '`'; }
          L.push('**' + (r.mode === 'avaliar' ? 'Avaliação' : 'Ajuste') + ' do modelo** ' + mtex + ' (' + f.n + ' pontos)', '');
          for (const b64 of await plotPNGs(r, opts)) { nFig++; L.push(addImg('figura' + String(nFig).padStart(2, '0') + '.png', b64ToBytes(b64), 'image/png', 'Figura ' + nFig), '', '*Figura ' + nFig + '.*', ''); }
          L.push(mdTable(['parâmetro', 'valor', 'erro padrão', 'inicial'], f.params.map((p) => [p.name + (p.fixed ? ' (fixo)' : ''), p.v, p.err == null ? '—' : p.err, p.v0]), 999), '');
          L.push('RMS-A = ' + FC.numStr(f.metrics.rmsA) + ' · MSE-B = ' + FC.numStr(f.metrics.mseB) + ' · MSE-C = ' + FC.numStr(f.metrics.mseC), '');
          break;
        }
        case 'slider': {
          L.push('Controle: $' + FC.nameTexOf(r.name || 'p') + ' = ' + FC.numTex(Number(r.value)) + '$ (de ' + r.min + ' a ' + r.max + ')', '');
          break;
        }
        case 'anim': {
          if (!opts.gifs) break;
          let bytes = null;
          try { bytes = await X.animGifBytes(r, (k, n) => onProg && onProg(i, state.regions.length, r, 'quadro ' + (k + 1) + ' de ' + n)); } catch (e) { bytes = null; }
          if (!bytes) { L.push('> [!note] Animação de ' + r.param + ' não incluída: toque em “Calcular quadros” na região de animação antes de exportar.', ''); break; }
          nGif++;
          L.push(addImg('animacao' + String(nGif).padStart(2, '0') + '.gif', bytes, 'image/gif', 'Animação ' + nGif), '', '*Animação ' + nGif + ': ' + r.param + ' de ' + r.from + ' a ' + r.to + '.*', '');
          break;
        }
        default: break;
      }
    }
    capFix();
    if (opts.sheet && !opts.single) {
      const link = addFile(base + '.fcalc', enc.encode(serialize()), 'Folha original (abrir no MathTi)');
      L.push('---', '', link, '');
    }
    return { md: L.join('\n').replace(/\n{3,}/g, '\n\n'), files, base };
  }
  X.buildMarkdown = build;

  /* ---------- diálogo ---------- */
  X.openMarkdown = function () {
    const { h, icon, state, toast } = U();
    const o = { single: false, code: false, gifs: true, sheet: true, journal: false, scale: 2, maxRows: 20, tags: 'mathti' };
    const wrap = h('div', { class: 'overlay' });
    const close = () => wrap.remove();
    const chk = (k, label) => { const c = h('input', { type: 'checkbox' }); c.checked = !!o[k]; c.addEventListener('change', () => { o[k] = c.checked; }); return h('label', { class: 'pkon' }, c, ' ' + label); };
    const radio = (val, label) => { const c = h('input', { type: 'radio', name: 'mdfmt' }); c.checked = o.single === val; c.addEventListener('change', () => { o.single = val; }); return h('label', { class: 'pkon' }, c, ' ' + label); };
    const tagIn = h('input', { type: 'text', value: o.tags, autocapitalize: 'off', spellcheck: 'false' }); tagIn.addEventListener('input', () => { o.tags = tagIn.value; });
    const rowsIn = h('input', { type: 'number', value: o.maxRows, min: '4', inputmode: 'numeric' }); rowsIn.addEventListener('input', () => { o.maxRows = Math.max(4, Number(rowsIn.value) || 20); });
    const status = h('div', { class: 'pkstatus' });
    const nAnim = state.regions.filter((r) => r.type === 'anim').length, nAnimOk = state.regions.filter((r) => r.type === 'anim' && r._frames).length;
    const body = h('div', { class: 'hbody pk' },
      h('p', null, 'Cria uma nota em Markdown com o texto, as equações (LaTeX), os gráficos (PNG), as animações (GIF) e as tabelas da folha, na ordem em que aparecem.'),
      h('h3', null, 'Formato'),
      radio(false, 'ZIP com a nota .md e uma pasta de anexos (recomendado para o Obsidian)'),
      radio(true, 'Um único arquivo .md com as imagens embutidas (mais pesado; sem CSV nem folha original)'),
      h('h3', null, 'Conteúdo'),
      chk('gifs', 'Incluir as animações como GIF' + (nAnim ? ' (' + nAnimOk + ' de ' + nAnim + ' com quadros calculados)' : ' (a folha não tem animações)')),
      chk('code', 'Incluir o código de cada região de matemática (bloco de código)'),
      chk('sheet', 'Anexar a folha original (.fcalc) para reabrir no MathTi'),
      chk('journal', 'Gráficos no estilo de revista (600 dpi; arquivos maiores) em vez da imagem da tela'),
      h('div', { class: 'grid4' }, U().field('Linhas mostradas por tabela', rowsIn), U().field('Tags (separadas por espaço)', tagIn, 'span2')),
      status);
    const go = h('button', { class: 'btn small primary' }, 'Gerar nota');
    const foot = h('div', { class: 'pkfoot' }, h('button', { class: 'btn small', onclick: close }, 'Cancelar'), go);
    go.onclick = async () => {
      go.disabled = true;
      status.innerHTML = ''; const msg = h('span'); status.append(h('span', { class: 'spin' }), ' ', msg);
      try {
        const res = await build(o, (i, n, r, extra) => { msg.textContent = 'Região ' + (i + 1) + ' de ' + n + ' (' + (U().TYPE_LABEL[r.type] || r.type) + ')' + (extra ? ' · ' + extra : '') + '…'; });
        if (o.single) FC.saveBytes(res.base + '.md', 'text/markdown', enc.encode(res.md));
        else {
          const files = Object.assign({ [res.base + '.md']: enc.encode(res.md) }, res.files);
          FC.saveBytes(res.base + '-nota.zip', 'application/zip', window.fflate.zipSync(files, { level: 6 }));
        }
        close();
        toast(o.single ? 'Nota Markdown gerada.' : 'Nota gerada: extraia o ZIP dentro do seu cofre do Obsidian.');
      } catch (e) {
        status.innerHTML = ''; status.append(h('p', { class: 'pkbad' }, 'Não consegui gerar a nota: ' + e.message)); go.disabled = false;
      }
    };
    wrap.append(h('div', { class: 'hpanel', role: 'dialog', 'aria-label': 'Exportar Markdown', style: 'width:min(720px,100%)' },
      h('div', { class: 'hhead' }, 'Exportar nota em Markdown', h('button', { class: 'ib close', 'aria-label': 'Fechar', onclick: close }, icon('<path d="M6 6l12 12M18 6L6 18"/>', 18))), body, foot));
    document.body.append(wrap);
  };
})();
