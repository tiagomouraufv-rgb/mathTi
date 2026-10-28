/* Folha de Cálculo — interface das regiões de dados importados, varredura de parâmetro e ajuste; materiais */
'use strict';
(function () {
  const FC = window.FC;
  const U = () => FC._ui;
  const PAL = () => FC.PALETTE;

  /* ---------- utilidades ---------- */
  function previewTable(names, units, rows, maxShow) {
    const esc = U().esc, n = rows.length, C = rows[0] ? rows[0].length : names.length;
    const show = n > (maxShow || 12) ? [0, 1, 2, 3, 4, -1, n - 2, n - 1] : [...Array(n).keys()];
    let html = '<table class="dtbl"><thead><tr><th class="ix"></th>' + names.slice(0, C).map((s) => '<th>' + esc(s) + '</th>').join('') + '</tr>';
    if (units && units.some(Boolean)) html += '<tr class="meta"><td class="ix">Units</td>' + units.slice(0, C).map((s) => '<td>' + esc(s || '') + '</td>').join('') + '</tr>';
    html += '</thead><tbody>';
    for (const i of show) {
      if (i < 0) { html += '<tr class="gap"><td class="ix">⋮</td>' + names.slice(0, C).map(() => '<td>⋮</td>').join('') + '</tr>'; continue; }
      html += '<tr><td class="ix">' + i + '</td>' + rows[i].map((v) => '<td>' + esc(FC.numStr(v)) + '</td>').join('') + '</tr>';
    }
    return html + '</tbody></table>';
  }
  function btn(label, fn, ic) { const { h, icon, IC } = U(); return h('button', { class: 'btn small', onclick: fn }, ic ? icon(IC[ic] || ic, 16) : null, label); }
  function errBox(el, msg) { const e = el.querySelector('.perr'); if (!e) return; e.hidden = !msg; e.textContent = msg || ''; }
  const sel2 = (val, options, onch) => {
    const { h } = U();
    const e = h('select', null, ...options.map(([v, l]) => h('option', { value: v, selected: String(val) === String(v) ? 'selected' : null }, l)));
    e.addEventListener('change', () => onch(e.value));
    return e;
  };
  const txtIn = (val, ph, onch) => { const { h } = U(); const e = h('input', { type: 'text', value: val ?? '', placeholder: ph || '', spellcheck: 'false', autocapitalize: 'off' }); e.addEventListener('input', () => onch(e.value)); return e; };
  const chk = (val, onch) => { const { h } = U(); const e = h('input', { type: 'checkbox' }); e.checked = !!val; e.addEventListener('change', () => onch(e.checked)); return e; };
  const area = (val, ph, rows, onch) => { const { h } = U(); const e = h('textarea', { class: 'src small', rows: rows || 4, spellcheck: 'false', autocapitalize: 'off', placeholder: ph || '' }); e.value = val || ''; e.addEventListener('input', () => onch(e.value)); return e; };

  /* ---------- importação de arquivo ---------- */
  let fileIn = null, pendingRegion = null;
  function applyTableText(r2, text, fname) {
    try {
      const T = FC.parseTable(text);
      r2.table = { names: T.names, units: T.units, comments: T.comments, rows: T.rows };
      r2.file = fname; r2.fileInfo = T.info;
      const base = FC.varName(r2.name, 'D1');
      r2.colvars = T.names.map((n, j) => base + '_' + FC.varName(n, 'c' + j));
      r2.interp = Object.assign({ on: false, xcol: 0, method: 'spline', fnames: [] }, r2.interp || {});
      r2.interp.fnames = [];
      U().markDirty();
      U().toast('Tabela ' + base + ': ' + T.rows.length + ' linhas × ' + T.names.length + ' colunas. Use ' + base + '[0] para a coluna 0 e ' + base + '[i, j] para um elemento.');
      const el = document.getElementById(r2.id); if (el) { const fm = el.querySelector('.form'); if (fm && !fm.hidden) { fm.hidden = true; U().toggleForm(r2, el); } }
      return true;
    } catch (e) { U().toast('Não consegui ler a tabela: ' + e.message); return false; }
  }
  /* colar uma tabela (do Origin, Excel, planilha ou texto) e dar nome à variável */
  async function openPaste(r) {
    const { h, icon } = U();
    const wrap = h('div', { class: 'overlay' });
    const close = () => wrap.remove();
    const name = h('input', { type: 'text', value: r && r.name ? r.name : 'DADO', autocapitalize: 'off', spellcheck: 'false' });
    const ta = h('textarea', { class: 'src', rows: 10, spellcheck: 'false', placeholder: 'Cole aqui as colunas (copiadas do Origin, Excel, Planilhas ou de um .txt). A primeira linha pode ter os nomes das colunas.' });
    try { if (navigator.clipboard && navigator.clipboard.readText) { const t = await Promise.race([navigator.clipboard.readText(), new Promise((res) => setTimeout(() => res(''), 400))]); if (t && /\d/.test(t) && /[\t,; ]/.test(t)) ta.value = t; } } catch (e) { /* sem acesso */ }
    const ok = h('button', { class: 'btn small primary', onclick: () => {
      const nm = FC.varName(name.value, 'DADO');
      let reg = r;
      if (!reg) reg = U().addRegion('data', { name: nm }); else reg.name = nm;
      if (applyTableText(reg, ta.value, 'colado')) close();
    } }, 'Criar a tabela');
    wrap.append(h('div', { class: 'hpanel', role: 'dialog', 'aria-label': 'Colar tabela', style: 'width:min(720px,100%)' },
      h('div', { class: 'hhead' }, 'Colar tabela como variável', h('button', { class: 'ib close', 'aria-label': 'Fechar', onclick: close }, icon('<path d="M6 6l12 12M18 6L6 18"/>', 18))),
      h('div', { class: 'hbody pk' }, h('p', null, 'A tabela vira uma variável da folha. Com o nome DADO: DADO[0] é a coluna 0, DADO[1] a coluna 1 e DADO[i, j] um elemento. Use direto em gráficos (curva de dados), tabelas e contas.'),
        U().field('Nome da variável', name), ta),
      h('div', { class: 'pkfoot' }, h('button', { class: 'btn small', onclick: close }, 'Cancelar'), ok)));
    document.body.append(wrap);
    setTimeout(() => ta.focus(), 50);
  }

  function openImport(r) {
    if (!fileIn) {
      fileIn = document.createElement('input');
      fileIn.type = 'file'; fileIn.accept = '.txt,.csv,.dat,.tsv,.prn,.asc,text/plain,text/csv'; fileIn.hidden = true;
      document.body.append(fileIn);
      fileIn.addEventListener('change', () => {
        const f = fileIn.files[0], r2 = pendingRegion; fileIn.value = '';
        if (!f || !r2) return;
        if (/\.(xlsx?|opju?|ods)$/i.test(f.name)) return U().toast('Esse formato não é texto. No Origin ou no Excel, salve como .txt ou .csv e importe de novo.');
        const rd = new FileReader();
        rd.onload = () => applyTableText(r2, rd.result, f.name);
        rd.readAsText(f);
      });
    }
    pendingRegion = r;
    fileIn.click();
  }

  /* ================= Região: dados importados ================= */
  const data = {
    defaults: () => ({ type: 'data', w: 'half', name: 'D' + (1 + U().state.regions.filter((x) => x.type === 'data').length), file: '', table: null, colvars: [], interp: { on: false, xcol: 0, method: 'spline', fnames: [] }, grid2d: { on: false, xcol: 0, ycol: 1, zcol: 2, method: 'linear', fname: '' } }),
    build(r, sec) {
      const { h } = U();
      sec.append(h('div', { class: 'dinfo' }), h('div', { class: 'perr', hidden: true }), h('div', { class: 'defs' }), h('div', { class: 'tblbox' }),
        h('div', { class: 'actions' }, btn('Importar arquivo', () => openImport(r), 'open'), btn('Colar tabela', () => openPaste(r)), btn('Editar', () => U().toggleForm(r, sec), 'edit'),
          btn('TXT (Origin)', () => exportData(r), 'dl')),
        h('div', { class: 'form', hidden: true }));
    },
    render(r, el) {
      const T = r.table;
      el.querySelector('.dinfo').textContent = T ? (r.file || 'dados') + ' · ' + T.rows.length + ' linhas × ' + T.names.length + ' colunas' + (r.fileInfo ? ' · separador ' + r.fileInfo.delim + ' · decimal com ' + r.fileInfo.decimal : '') : 'Nenhum arquivo ainda. Toque em “Importar arquivo” (txt, csv ou dat, inclusive os exportados do Origin).';
      errBox(el, T ? r._err : null);
      const defs = el.querySelector('.defs');
      defs.innerHTML = r._defs ? r._defs.defs.map((d) => '<div><code>' + U().esc(d.t) + '</code> ' + U().esc(d.d) + '</div>').join('') : '';
      el.querySelector('.tblbox').innerHTML = T ? previewTable(T.names, T.units, T.rows) : '';
      el.querySelector('.tblbox').hidden = !T;
    },
    form(r, f) {
      const { h, field } = U();
      const T = r.table;
      const dirty = () => U().markDirty();
      f.append(h('div', { class: 'grid4' }, field('Nome da matriz', txtIn(r.name, 'D1', (v) => { r.name = v; dirty(); })), h('span'), h('span'), h('span')));
      if (!T) { f.append(h('p', { class: 'hint' }, 'Importe um arquivo para configurar as colunas.')); return; }
      const C = T.names.length;
      r.interp = r.interp || { on: false, xcol: 0, method: 'spline', fnames: [] };
      r.interp.fnames = r.interp.fnames || [];
      const cols = h('div', { class: 'colgrid' }, h('b', null, 'Coluna do arquivo'), h('b', null, 'Nome do vetor'), h('b', null, r.interp.on ? 'Função interpolada' : ''));
      for (let j = 0; j < C; j++) {
        const lab = T.names[j] + (T.units[j] ? ' (' + T.units[j] + ')' : '');
        const vIn = txtIn(r.colvars[j] || '', '', (v) => { r.colvars[j] = v; dirty(); });
        const isX = j === (r.interp.xcol | 0);
        const fIn = r.interp.on && !isX ? txtIn(r.interp.fnames[j] || '', (FC.varName(r.colvars[j], 'c' + j)) + '_i', (v) => { r.interp.fnames[j] = v; dirty(); }) : h('span', null, r.interp.on ? '(variável x)' : '');
        cols.append(h('span', null, lab), vIn, fIn);
      }
      const redraw = () => { f.innerHTML = ''; data.form(r, f); };
      const colOpts = T.names.map((n, j) => [j, j + ': ' + n]);
      f.append(
        h('div', { class: 'fsec' }, 'Colunas'), cols,
        h('div', { class: 'fsec' }, 'Interpolação 1D'),
        h('div', { class: 'grid4' },
          field('Criar funções', chk(r.interp.on, (v) => { r.interp.on = v; dirty(); redraw(); })),
          field('Coluna x', sel2(r.interp.xcol, colOpts, (v) => { r.interp.xcol = +v; dirty(); redraw(); })),
          field('Método', sel2(r.interp.method, [['linear', 'linear'], ['spline', 'spline cúbica natural'], ['pchip', 'PCHIP (sem oscilar)'], ['akima', 'Akima']], (v) => { r.interp.method = v; dirty(); }), 'span2')),
        h('div', { class: 'fsec' }, 'Interpolação 2D (colunas x, y, z em grade)'),
        h('div', { class: 'grid4' },
          field('Criar função f(x, y)', chk(r.grid2d && r.grid2d.on, (v) => { r.grid2d = Object.assign({ xcol: 0, ycol: 1, zcol: 2, method: 'linear', fname: '' }, r.grid2d || {}, { on: v }); dirty(); redraw(); })),
          r.grid2d && r.grid2d.on ? field('x', sel2(r.grid2d.xcol, colOpts, (v) => { r.grid2d.xcol = +v; dirty(); })) : h('span'),
          r.grid2d && r.grid2d.on ? field('y', sel2(r.grid2d.ycol, colOpts, (v) => { r.grid2d.ycol = +v; dirty(); })) : h('span'),
          r.grid2d && r.grid2d.on ? field('z', sel2(r.grid2d.zcol, colOpts, (v) => { r.grid2d.zcol = +v; dirty(); })) : h('span')),
        r.grid2d && r.grid2d.on ? h('div', { class: 'grid4' }, field('Nome da função', txtIn(r.grid2d.fname, FC.varName(r.name, 'D1') + '_f', (v) => { r.grid2d.fname = v; dirty(); })), field('Método', sel2(r.grid2d.method, [['linear', 'bilinear'], ['spline', 'spline'], ['pchip', 'PCHIP']], (v) => { r.grid2d.method = v; dirty(); }))) : h('span'),
        h('p', { class: 'hint' }, 'Os vetores e funções ficam disponíveis nas regiões abaixo desta. Avaliar fora do intervalo dos dados gera um aviso de extrapolação.'));
    }
  };
  function exportData(r) {
    const T = r.table; if (!T) return U().toast('Nada para exportar.');
    U().saveFile(U().fileBase(r) + '.txt', 'text/plain', U().originText(T.names, T.units, T.comments || T.names.map(() => ''), T.rows));
  }

  /* ================= Região: varredura de parâmetro ================= */
  function sweepData(r) {
    const S = r._sweep; if (!S) return null;
    const names = FC.splitTop(String(r.names || ''), ',').map((x) => x.trim());
    return { xs: S.rows.map((q) => q[0]), traces: S.exprs.map((e, i) => ({ t: { expr: e, name: names[i] || e, color: PAL()[i % PAL().length], width: 1.5, dash: 'solid', marker: r.markers ? 'circle' : 'none' }, ys: S.rows.map((q) => q[i + 1]) })) };
  }
  const sweep = {
    defaults: () => ({ type: 'sweep', w: 'half', name: 'V' + (1 + U().state.regions.filter((x) => x.type === 'sweep').length), param: 'p', from: '0', to: '1', n: 21, log: false, outputs: '', names: '', xlabel: '', ylabel: '', xlog: false, ylog: false, legend: 'sup-dir', preset: U().state.preset, plot: true, markers: true }),
    build(r, sec) {
      const { h } = U();
      sec.append(h('div', { class: 'dinfo' }), h('div', { class: 'perr', hidden: true }), h('div', { class: 'plot' }), h('div', { class: 'tblbox' }),
        h('div', { class: 'actions' }, btn('Editar', () => U().toggleForm(r, sec), 'edit'), btn('TXT (Origin)', () => exportSweep(r), 'dl'), btn('SVG', () => U().exportFig(r, 'svg')), btn('PNG 600 dpi', () => U().exportFig(r, 'png'))),
        h('div', { class: 'form', hidden: true }));
    },
    render(r, el) {
      const S = r._sweep;
      errBox(el, r._err);
      el.querySelector('.dinfo').textContent = S ? S.vname + ' := tabela ' + S.rows.length + ' × ' + (S.exprs.length + 1) + ' · ' + r.param + ' de ' + r.from + ' a ' + r.to : 'Defina o parâmetro e as grandezas em “Editar”.';
      const box = el.querySelector('.tblbox'), div = el.querySelector('.plot');
      if (!S) { box.innerHTML = ''; div.hidden = true; return; }
      const names = FC.splitTop(String(r.names || ''), ',').map((x) => x.trim());
      box.innerHTML = previewTable([r.param, ...S.exprs.map((e, i) => names[i] || e)], null, S.rows, 10);
      r._data = sweepData(r);
      div.hidden = !r.plot;
      if (r.plot) FC.drawPlot(div, Object.assign({}, r, { xlabel: r.xlabel || r.param, ylabel: r.ylabel || '' }), r._data).catch(() => {});
    },
    form(r, f) {
      const { h, field, inp, sel, presetOpts } = U();
      f.append(
        h('div', { class: 'grid4' }, field('Parâmetro', inp(r, 'param', { ph: 'λ_OT' })), field('De', inp(r, 'from')), field('Até', inp(r, 'to')), field('Pontos', inp(r, 'n', { type: 'number' }))),
        h('div', { class: 'grid4' }, field('Passo logarítmico', inp(r, 'log', { type: 'checkbox' })), field('Nome da tabela', inp(r, 'name', { ph: 'V1' }))),
        field('Grandezas a calcular (uma por linha, usando o parâmetro)', area(r.outputs, 'x0(λ_OT)\nΔU(λ_OT)\nk_trap(λ_OT)', 4, (v) => { r.outputs = v; U().markDirty(); }), 'span4'),
        h('div', { class: 'grid4' }, field('Nomes das colunas (vírgulas)', inp(r, 'names', { ph: 'x0, ΔU, k_trap' }), 'span4')),
        h('div', { class: 'fsec' }, 'Gráfico'),
        h('div', { class: 'grid4' }, field('Mostrar gráfico', inp(r, 'plot', { type: 'checkbox' })), field('Marcadores', inp(r, 'markers', { type: 'checkbox' })), field('Log em x', inp(r, 'xlog', { type: 'checkbox' })), field('Log em y', inp(r, 'ylog', { type: 'checkbox' }))),
        h('div', { class: 'grid4' }, field('Rótulo x', inp(r, 'xlabel', { ph: 'λ_OT (nm)' })), field('Rótulo y', inp(r, 'ylabel')), field('Estilo de revista', sel(r, 'preset', presetOpts()), 'span2')),
        h('p', { class: 'hint' }, 'A tabela fica disponível nas regiões abaixo com o nome dado (coluna 0 = parâmetro). Cada ponto é calculado em segundo plano.'));
    }
  };
  function exportSweep(r) {
    const S = r._sweep; if (!S) return U().toast('Nada para exportar.');
    const names = FC.splitTop(String(r.names || ''), ',').map((x) => x.trim());
    const hd = [r.param, ...S.exprs.map((e, i) => names[i] || e)].map((s) => s.replace(/[_^{}]/g, ''));
    U().saveFile(U().fileBase(r) + '.txt', 'text/plain', U().originText(hd, hd.map(() => ''), hd.map(() => ''), S.rows));
  }

  /* ================= Região: ajuste a dados ================= */
  const OBJ = { A: 'RMS-A (resíduo absoluto normalizado pelo pico)', B: 'MSE-B (relativo, peso 1/y: realça cauda e IR)', C: 'MSE-C (peso espectral y/Σy: realça o pico)' };
  const fit = {
    defaults: () => ({ type: 'fit', w: 'full', xexpr: '', yexpr: '', xvar: 'x', model: '', params: '', mode: 'ajustar', objective: 'A', xmin: '', xmax: '', thresh: 1, define: true, xlabel: 'x', ylabel: 'y', preset: U().state.preset, color: '#1F5FAE' }),
    build(r, sec) {
      const { h } = U();
      sec.append(h('div', { class: 'dinfo' }), h('div', { class: 'perr', hidden: true }), h('div', { class: 'metrics' }), h('div', { class: 'tblbox ptbox' }), h('div', { class: 'plot' }),
        h('div', { class: 'actions' }, btn('Editar', () => U().toggleForm(r, sec), 'edit'), btn('TXT (dados, modelo, resíduo)', () => exportFit(r, 'data'), 'dl'), btn('Parâmetros TXT', () => exportFit(r, 'params')), btn('SVG', () => U().exportFig(r, 'svg')), btn('PNG 600 dpi', () => U().exportFig(r, 'png'))),
        h('div', { class: 'form', hidden: true }));
    },
    render(r, el) {
      const F = r._fit, esc = U().esc;
      errBox(el, r._err);
      const div = el.querySelector('.plot');
      if (!F) { el.querySelector('.dinfo').textContent = r._err ? '' : 'Configure dados, modelo e parâmetros em “Editar”.'; el.querySelector('.metrics').innerHTML = ''; el.querySelector('.ptbox').innerHTML = ''; div.hidden = true; return; }
      el.querySelector('.dinfo').textContent = (r.mode === 'avaliar' ? 'Só avaliação (sem ajuste)' : 'Ajuste por ' + OBJ[r.objective || 'A'].split(' (')[0] + ' · ' + (F.converged ? 'convergiu em ' + F.iters + ' iterações' : 'parou no limite de ' + F.iters + ' iterações (confira os chutes)')) + ' · ' + F.n + ' pontos no domínio Ω' + (r.define !== false ? ' · parâmetros definidos na folha' : '');
      const mt = [['A', 'RMS-A', (F.metrics.rmsA * 100).toPrecision(4) + ' %'], ['B', 'MSE-B', F.metrics.mseB.toPrecision(4)], ['C', 'MSE-C', F.metrics.mseC.toPrecision(4)]];
      el.querySelector('.metrics').innerHTML = mt.map(([k, n, v]) => '<span class="metric' + (k === (r.objective || 'A') && r.mode !== 'avaliar' ? ' on' : '') + '">' + n + '<b>' + v + '</b></span>').join('');
      el.querySelector('.ptbox').innerHTML = '<table class="ptable"><thead><tr><th>Parâmetro</th><th>Inicial</th><th>' + (r.mode === 'avaliar' ? 'Valor' : 'Ajustado') + '</th><th>± erro padrão</th></tr></thead><tbody>' +
        F.params.map((p) => '<tr><td>' + esc(p.name) + (p.fixed ? ' <span class="note">fixo</span>' : '') + '</td><td>' + esc(FC.numStr(p.v0)) + '</td><td><b>' + esc(FC.numStr(p.v)) + '</b></td><td>' + (p.err == null ? '—' : esc(Number(p.err.toPrecision(3)).toString())) + '</td></tr>').join('') + '</tbody></table>';
      r._data = F;
      div.hidden = false;
      FC.drawPlot(div, r, F).catch(() => {});
    },
    form(r, f) {
      const { h, field, inp, sel, presetOpts } = U();
      f.append(
        h('div', { class: 'fsec' }, 'Dados experimentais'),
        h('div', { class: 'grid4' }, field('x dos dados (vetor)', inp(r, 'xexpr', { ph: 'D1_λ' }), 'span2'), field('y dos dados (vetor)', inp(r, 'yexpr', { ph: 'D1_A' }), 'span2')),
        h('div', { class: 'fsec' }, 'Modelo'),
        h('div', { class: 'grid4' }, field('Variável do modelo', inp(r, 'xvar', { ph: 'x' })), field('Modo', sel(r, 'mode', [['ajustar', 'Ajustar parâmetros'], ['avaliar', 'Só avaliar (sem ajuste)']])), field('Objetivo do ajuste', sel(r, 'objective', Object.entries(OBJ).map(([k, v]) => [k, v])), 'span2')),
        field('Modelo y(x, parâmetros)', area(r.model, 'A1·exp(-((x - x1)/σ1)^2) + A2·exp(-((x - x2)/σ2)^2)', 3, (v) => { r.model = v; U().markDirty(); }), 'span4'),
        field('Parâmetros: um por linha — nome = valor, nome = valor [mín, máx] ou nome = valor fixo', area(r.params, 'A1 = 0.8\nx1 = 520 [500, 540]\nσ1 = 30\nA2 = 0.3\nx2 = 600 fixo\nσ2 = 20', 5, (v) => { r.params = v; U().markDirty(); }), 'span4'),
        h('div', { class: 'fsec' }, 'Domínio Ω'),
        h('div', { class: 'grid4' }, field('x mínimo', inp(r, 'xmin', { ph: 'todos' })), field('x máximo', inp(r, 'xmax', { ph: 'todos' })), field('|y| acima de (% do pico)', inp(r, 'thresh', { type: 'number' })), field('Definir parâmetros na folha', inp(r, 'define', { type: 'checkbox' }))),
        h('div', { class: 'fsec' }, 'Gráfico'),
        h('div', { class: 'grid4' }, field('Rótulo x', inp(r, 'xlabel')), field('Rótulo y', inp(r, 'ylabel')), field('Estilo de revista', sel(r, 'preset', presetOpts()), 'span2')),
        h('p', { class: 'hint' }, 'Métricas no domínio Ω, com r = y_modelo − y_dados e pico = máx |y_dados| em Ω: RMS-A = √(média (r/pico)²); MSE-B = média (r/y_dados)²; MSE-C = Σ (y_dados/Σy_dados)·(r/pico)². O erro padrão vem de s²(JᵀJ)⁻¹. Com “Definir parâmetros na folha”, os valores ajustados ficam disponíveis nas regiões abaixo.'));
    }
  };
  function exportFit(r, kind) {
    const F = r._fit; if (!F) return U().toast('Nada para exportar.');
    if (kind === 'params') {
      const rows = F.params.map((p) => [p.v, p.err == null ? NaN : p.err]);
      const txt = 'parametro\tvalor\terro_padrao\r\n' + F.params.map((p) => p.name + '\t' + FC.numStr(p.v) + '\t' + (p.err == null ? '' : FC.numStr(p.err))).join('\r\n') + '\r\nRMS-A\t' + FC.numStr(F.metrics.rmsA) + '\r\nMSE-B\t' + FC.numStr(F.metrics.mseB) + '\r\nMSE-C\t' + FC.numStr(F.metrics.mseC) + '\r\n';
      return U().saveFile(U().fileBase(r) + '_parametros.txt', 'text/plain', txt);
    }
    const rows = F.xs.map((x, i) => [x, F.ye[i], F.ym[i], F.ym[i] - F.ye[i]]);
    const hd = [r.xlabel || 'x', r.ylabel || 'y', 'modelo', 'residuo'].map((s) => s.replace(/[_^{}]/g, ''));
    U().saveFile(U().fileBase(r) + '.txt', 'text/plain', U().originText(hd, ['', '', '', ''], ['dados', 'dados', 'ajuste', 'modelo - dados'], rows));
  }

  /* ================= Materiais ================= */
  const SEED = [{ name: 'Água', src: '// água a 25 °C (valores de referência)\nn := 1.333\nε_r := 78.4\nρ := 997 kg/m^3\nη := 0.890 mPa·s' }];
  function loadLibrary() {
    let lib = null;
    try { lib = JSON.parse(localStorage.getItem('fcalc.materials') || 'null'); } catch (e) { lib = null; }
    U().state.materials = Array.isArray(lib) ? lib : SEED.slice();
  }
  function saveLibrary() {
    try { localStorage.setItem('fcalc.materials', JSON.stringify(U().state.materials)); } catch (e) { /* sem armazenamento */ }
    U().markDirty();
  }
  function mergeMaterials(list) {
    if (!U().state.materials) loadLibrary();
    let added = 0;
    for (const m of list || []) if (m && m.name && !U().state.materials.some((x) => x.name === m.name)) { U().state.materials.push({ name: m.name, src: m.src || '' }); added++; }
    if (added) saveLibrary();
  }
  function openMaterials() {
    const { h, icon, field, toast, state } = U();
    if (!state.materials) loadLibrary();
    let cur = state.materials[0] ? 0 : -1;
    const wrap = h('div', { class: 'overlay', onclick: (e) => { if (e.target === wrap) wrap.remove(); } });
    const dlg = h('div', { class: 'dlg', role: 'dialog', 'aria-label': 'Biblioteca de materiais', style: 'width:min(820px,100%)' });
    const list = h('div', { class: 'mats' }), edit = h('div');
    const draw = () => {
      list.innerHTML = '';
      state.materials.forEach((m, i) => list.append(h('div', { class: 'matrow' + (i === cur ? ' on' : '') },
        h('span', null, h('b', null, m.name), ' ', h('span', { class: 'note' }, (m.src.split('\n').filter((l) => l.includes(':=')).length) + ' definições')),
        h('span', null, btn('Editar', () => { cur = i; draw(); }), ' ', btn('Excluir', () => { state.materials.splice(i, 1); cur = Math.min(cur, state.materials.length - 1); saveLibrary(); draw(); toast('Material excluído.'); })))));
      edit.innerHTML = '';
      if (cur < 0) { edit.append(h('p', { class: 'hint' }, 'Nenhum material. Crie um novo ou a partir de uma região de matemática selecionada.')); return; }
      const m = state.materials[cur];
      const nm = txtIn(m.name, 'MEHPPV', (v) => { m._new = v; });
      const ta = area(m.src, 'λ_1 := 333 nm\nN_tail := 2.92e18 cm^-3', 8, (v) => { m._src = v; });
      const msg = h('div', { class: 'hint' });
      edit.append(
        h('div', { class: 'grid4' }, field('Nome (use na folha como Nome.variável)', nm, 'span2')),
        field('Definições (uma por linha, como numa região de matemática)', ta, 'span4'), msg,
        h('div', { class: 'actions' },
          btn('Salvar material', () => {
            const newName = (m._new ?? m.name).trim();
            if (!/^[\p{L}_][\p{L}\p{N}_]*$/u.test(newName)) { msg.textContent = 'Nome inválido: use letras, números e _, começando por letra (ex.: MEHPPV).'; return; }
            const src = m._src ?? m.src;
            const errs = FC.checkMaterial(src);
            m.name = newName; m.src = src; delete m._new; delete m._src;
            saveLibrary(); draw();
            toast(errs.length ? 'Salvo, mas com erro: ' + errs[0] : 'Material salvo. Use ' + newName + '.<nome> na folha.');
          }, 'check')));
    };
    dlg.append(
      h('div', { class: 'hhead' }, 'Biblioteca de materiais', h('button', { class: 'ib', 'aria-label': 'Fechar', onclick: () => wrap.remove() }, icon('<path d="M6 6l12 12M18 6L6 18"/>'))),
      h('div', { class: 'dbody' },
        h('p', { class: 'hint' }, 'Parâmetros fixos (osciladores, densidades, constantes de Drude…) salvos uma vez e usados em qualquer folha como Nome.variável, por exemplo Água.n. A biblioteca fica neste aparelho e também é salva dentro de cada .fcalc.'),
        h('div', { class: 'actions' },
          btn('Novo material', () => { state.materials.push({ name: 'Material' + (state.materials.length + 1), src: '' }); cur = state.materials.length - 1; draw(); }, 'plus'),
          btn('Criar da região selecionada', () => {
            const sr = state.regions.find((x) => x.id === state.selected);
            if (!sr || sr.type !== 'math') return toast('Selecione antes uma região de matemática (toque nela).');
            state.materials.push({ name: 'Material' + (state.materials.length + 1), src: sr.src || '' }); cur = state.materials.length - 1; draw();
          }),
          btn('Exportar biblioteca', () => U().saveFile('materiais.json', 'application/json', JSON.stringify(state.materials, null, 1)), 'dl'),
          btn('Importar biblioteca', () => {
            const inp2 = document.createElement('input'); inp2.type = 'file'; inp2.accept = '.json,application/json';
            inp2.onchange = () => { const f2 = inp2.files[0]; if (!f2) return; const rd = new FileReader(); rd.onload = () => { try { mergeMaterials(JSON.parse(rd.result)); draw(); toast('Biblioteca importada.'); } catch (e) { toast('Arquivo inválido.'); } }; rd.readAsText(f2); };
            inp2.click();
          }, 'open')),
        list, edit));
    wrap.append(dlg);
    document.body.append(wrap);
    draw();
  }

  /* ================= Aba Dados ================= */
  function ribbon() {
    const { h, bigBtn, addRegion, insertTool } = U();
    const group = (name, items) => {
      const g = h('div', { class: 'tgroup' }, h('div', { class: 'tglabel' }, name));
      const b2 = h('div', { class: 'tgbtns' });
      for (const [lab, ins, post, tip] of items) {
        const b = h('button', { class: 'tool', title: (tip || ins) + ' — botão direito (ou toque longo): ajuda' }, lab);
        b._help = { lab, ins: ins + (post || ''), tip };
        b.addEventListener('pointerdown', (e) => e.preventDefault());
        b.addEventListener('click', () => insertTool(ins, post));
        b2.append(b);
      }
      g.append(b2); return g;
    };
    return [
      bigBtn('Importar tabela', '<path d="M12 3v12M7 10l5 5 5-5"/><path d="M4 17v3h16v-3"/>', () => { const r = addRegion('data'); setTimeout(() => openImport(r), 120); }),
      bigBtn('Colar tabela', '<rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9 4V3h6v1"/><path d="M9 10h6M9 14h6M9 18h4"/>', () => openPaste(null)),
      bigBtn('Varredura', '<path d="M3 20h18M5 16l4-5 4 3 6-8"/><circle cx="9" cy="11" r="1.4"/><circle cx="13" cy="14" r="1.4"/>', () => addRegion('sweep')),
      bigBtn('Ajuste a dados', '<path d="M3 20h18"/><circle cx="6" cy="15" r="1"/><circle cx="9" cy="10" r="1"/><circle cx="13" cy="8" r="1"/><circle cx="17" cy="11" r="1"/><path d="M4 17c4-10 9-12 16-5"/>', () => addRegion('fit')),
      bigBtn('Materiais', '<path d="M4 7l8-4 8 4-8 4z"/><path d="M4 12l8 4 8-4M4 17l8 4 8-4"/>', openMaterials),
      h('div', { class: 'sep' }),
      group('Interpolação', [['linterp', 'linterp(', ', vy, x)', 'Linear'], ['spline', 'spline(', ', vy, x)', 'Spline cúbica natural'], ['pchip', 'pchip(', ', vy, x)', 'PCHIP: sem oscilações'], ['akima', 'akima(', ', vy, x)', 'Akima'], ['interp2D', 'interp2D(', ', x, y)', 'Tabela x, y, z em grade (como o Pg)']]),
      group('Acelerar', [['tabelar', 'f_t := tabelar(f, a, b, 1001)', '', 'Calcula f uma vez numa grade e usa a interpolação; só recalcula se algo acima mudar']])
    ];
  }

  FC.uiExt = Object.assign(FC.uiExt || {}, { data, sweep, fit, ribbon, mergeMaterials, openMaterials, loadLibrary, openImport, openPaste });
})();
