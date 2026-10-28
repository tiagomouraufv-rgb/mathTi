/* MathTi — texto rico (cor, negrito, sublinhado, destaque, figuras), símbolos da barra em qualquer campo
   e conversão das ferramentas de matemática em LaTeX dentro do texto. */
'use strict';
(function () {
  const FC = window.FC;
  const U = () => FC._ui;
  const X = FC.uiExt;

  const GREEK_TEX = { 'α': '\\alpha', 'β': '\\beta', 'γ': '\\gamma', 'δ': '\\delta', 'ε': '\\varepsilon', 'ζ': '\\zeta', 'η': '\\eta', 'θ': '\\theta', 'ι': '\\iota', 'κ': '\\kappa', 'λ': '\\lambda', 'μ': '\\mu', 'ν': '\\nu', 'ξ': '\\xi', 'π': '\\pi', 'ρ': '\\rho', 'σ': '\\sigma', 'τ': '\\tau', 'υ': '\\upsilon', 'φ': '\\phi', 'χ': '\\chi', 'ψ': '\\psi', 'ω': '\\omega', 'Γ': '\\Gamma', 'Δ': '\\Delta', 'Θ': '\\Theta', 'Λ': '\\Lambda', 'Ξ': '\\Xi', 'Π': '\\Pi', 'Σ': '\\Sigma', 'Φ': '\\Phi', 'Ψ': '\\Psi', 'Ω': '\\Omega', 'ħ': '\\hbar', '∞': '\\infty', '·': '\\cdot', '×': '\\times', '≤': '\\le', '≥': '\\ge', '≠': '\\ne', '←': '\\leftarrow', '∈': '\\in', '∂': '\\partial', '∇': '\\nabla' };
  FC.GREEK_TEX = GREEK_TEX;

  const isField = (t) => !!t && !t.disabled && !t.readOnly && (t.tagName === 'TEXTAREA' || (t.tagName === 'INPUT' && /^(text|search)$/.test(t.type || 'text')));
  let lastField = null;
  document.addEventListener('focusin', (e) => { if (isField(e.target)) lastField = e.target; });
  // o ˆ (acento) do teclado do tablet vira ^ em qualquer campo
  document.addEventListener('input', (e) => {
    const t = e.target;
    if (!isField(t) || !/[\u02C6\uFF3E\u0302]/.test(t.value)) return;
    const p = t.selectionStart;
    t.value = t.value.replace(/[\u02C6\uFF3E\u0302]/g, '^');
    try { t.setSelectionRange(p, p); } catch (err) { /* nada */ }
  }, true);

  /* campo onde a ferramenta deve escrever: o que está em foco ou o último usado */
  X.targetField = function () {
    const a = document.activeElement;
    if (isField(a)) return a;
    if (lastField && lastField.isConnected && lastField.offsetParent !== null) return lastField;
    return null;
  };

  /* ---------- ferramenta de matemática -> LaTeX (dentro do texto) ---------- */
  const subFix = (s) => s.replace(/([\p{L}])_([\p{L}\p{N}]+)/gu, '$1_{$2}');
  const greekTex = (s) => s.replace(/[α-ωΑ-ΩħΠΣ∞·×≤≥≠←∈∂∇]/g, (c) => (GREEK_TEX[c] ? GREEK_TEX[c] + ' ' : c));
  X.texSnippet = function (ins, post) {
    ins = String(ins || ''); post = String(post || '');
    const pure = ins.trim();
    // letras, constantes e unidades entram como texto comum (o texto mostra λ, k_B e nm direto)
    if (!post && (/^[\p{L}ħ∞][\p{L}\p{N}_]*$/u.test(pure) || (/^ \S/.test(ins) && !/[=(]/.test(ins)))) return [/^ /.test(ins) ? ins : pure, '', true];
    if (/^ \S/.test(ins) && !/[=(]/.test(ins)) return ['\\,\\mathrm{' + pure.replace(/\^(\d+)/g, '^{$1}').replace(/µ|u(?=m)/g, '\\mu ') + '}', ''];
    const T = {
      ':=': ['\\coloneqq ', ''], '=': ['=', ''], '->': ['\\rightarrow ', ''], '^2': ['^{2}', ''], '^': ['^{', '}'],
      'sqrt(': ['\\sqrt{', '}'], 'abs(': ['\\left|', '\\right|'], '·': ['\\cdot ', ''], '/': ['/', ''], 'i': ['i', ''], 'e': ['e', ''],
      '// ': ['', ''], '∞': ['\\infty ', '']
    };
    if (T[pure]) return T[pure];
    if (/^integral\($/.test(pure)) return ['\\int_{a}^{b} ', '\\,dx'];
    if (/^Σ\(/.test(pure)) return ['\\sum_{k=1}^{n} ', ''];
    if (/^Π\(/.test(pure)) return ['\\prod_{k=1}^{n} ', ''];
    if (/^diff\($/.test(pure)) return ['\\frac{d}{dx}\\left(', '\\right)'];
    if (/^deriv\($/.test(pure)) return ['\\left.\\frac{d}{dx}', '\\right|_{x_0}'];
    if (/^[A-Za-zα-ωΑ-Ω_]+\($/.test(pure)) {
      const nm = pure.slice(0, -1);
      const special = { Jn: 'J_{n}', Yn: 'Y_{n}', In: 'I_{n}', Kn: 'K_{n}', js: 'j_{n}', ys: 'y_{n}', Her: 'H_{n}', Lag: 'L_{n}', LagA: 'L_{n}^{\\alpha}', Leg: 'P_{n}', Cheb: 'T_{n}', gamma: '\\Gamma', erf: '\\mathrm{erf}', exp: '\\exp', ln: '\\ln', log: '\\log', sin: '\\sin', cos: '\\cos', tan: '\\tan', sinh: '\\sinh', cosh: '\\cosh', tanh: '\\tanh' }[nm];
      return [(special || '\\mathrm{' + nm.replace(/_/g, '\\_') + '}') + '\\left(', '\\right)'];
    }
    // nomes, letras gregas, constantes, operadores
    let s = greekTex(subFix(ins)).replace(/\s*:=\s*/g, ' \\coloneqq ').replace(/\*/g, '\\cdot ');
    let p = greekTex(subFix(post));
    if (/[\n]/.test(s + p)) { s = s.replace(/\n\s*/g, ' '); p = p.replace(/\n\s*/g, ' '); }
    return [s, p];
  };
  function insideMath(text, pos) {
    const before = text.slice(0, pos).replace(/\\\$/g, '');
    return ((before.match(/\$/g) || []).length % 2) === 1;
  }
  function insertTex(ta, ins, post) {
    const [a, b, plain] = X.texSnippet(ins, post);
    if (!a && !b) return;
    if (plain) { U().insertAt(ta, a, ''); return; }
    if (insideMath(ta.value, ta.selectionStart)) { U().insertAt(ta, a, b); return; }
    U().insertAt(ta, '$' + a, b + '$');
    // símbolo completo (λ, x², constantes): o cursor sai da fórmula; com argumento (√, ∫, xʸ) fica dentro
    if (!b) { const p = ta.selectionStart + 1; ta.setSelectionRange(p, p); }
  }

  /* roteia a inserção da barra: matemática, texto ou qualquer campo de formulário */
  X.insertRouted = function (ins, post) {
    const f = X.targetField();
    if (!f) return false;
    const sec = f.closest && f.closest('section.region');
    const r = sec && U().state.regions.find((x) => x.id === sec.id);
    if (r && r.type === 'math' && f.classList.contains('src')) return false; // o editor de matemática trata
    if (r && r.type === 'text' && f.classList.contains('src')) { insertTex(f, ins, post); return true; }
    if (f.id === 'docName' && !/^[\p{L}\p{N}_ ]+$/u.test(String(ins).trim())) return false;
    const single = f.tagName === 'INPUT';
    U().insertAt(f, single ? String(ins).replace(/\n\s*/g, ' ') : ins, single ? String(post || '').replace(/\n\s*/g, ' ') : post);
    return true;
  };

  /* ---------- texto rico ---------- */
  const COLORS = [['#C62828', 'vermelho'], ['#1F5FAE', 'azul'], ['#2E7D32', 'verde'], ['#E07B00', 'laranja'], ['#6A3D9A', 'roxo'], ['#5B6676', 'cinza']];
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function inline(t) {
    // t já escapado
    t = t.replace(/&lt;span style=&quot;color:\s*(#[0-9a-fA-F]{3,8})&quot;&gt;([\s\S]*?)&lt;\/span&gt;/g, '<span style="color:$1">$2</span>');
    t = t.replace(/&lt;u&gt;([\s\S]*?)&lt;\/u&gt;/g, '<u>$1</u>').replace(/&lt;sup&gt;([\s\S]*?)&lt;\/sup&gt;/g, '<sup>$1</sup>').replace(/&lt;sub&gt;([\s\S]*?)&lt;\/sub&gt;/g, '<sub>$1</sub>');
    t = t.replace(/==([^=\n]+)==/g, '<mark>$1</mark>').replace(/~~([^~\n]+)~~/g, '<s>$1</s>');
    t = t.replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>').replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<i>$2</i>');
    // fora das fórmulas: \alpha vira α, x^2 e x^{n} viram sobrescrito, x_{n} subscrito
    t = FC.texNamesToChars(t);
    t = t.replace(/([\p{L}\p{N})\]])\^\{([^}]*)\}/gu, '$1<sup>$2</sup>').replace(/([\p{L}\p{N})\]])\^(-?[\p{L}\p{N}.]+)/gu, '$1<sup>$2</sup>');
    t = t.replace(/([\p{L}\p{N})\]])_\{([^}]*)\}/gu, '$1<sub>$2</sub>').replace(/(^|[^\p{L}\p{N}_])([\p{L}]{1,2})_([\p{L}\p{N}]{1,3})(?![\p{L}\p{N}_])/gu, '$1$2<sub>$3</sub>');
    return t;
  }
  X.textHTML = function (src, r) {
    const s = String(src || '');
    if (!s.trim()) return '<span class="placeholder">Texto vazio — toque para escrever.</span>';
    const { kt } = U();
    // separa fórmulas ($$…$$, $…$) e figuras
    const parts = s.split(/(\$\$[\s\S]+?\$\$|\$[^$\n]+\$|!\[[^\]\n]*\]\([^)\n]+\))/g);
    let html = '';
    for (const p of parts) {
      if (/^\$\$[\s\S]+\$\$$/.test(p)) { html += '<div class="tmath">' + kt(p.slice(2, -2), true) + '</div>'; continue; }
      if (/^\$[^$]+\$$/.test(p)) { html += kt(p.slice(1, -1)); continue; }
      const im = p.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
      if (im) {
        const [cap, w] = im[1].split('|');
        let src2 = im[2];
        if (/^img:/.test(src2)) src2 = r && r.imgs ? r.imgs[src2.slice(4)] : '';
        if (!/^(data:image\/|https?:)/.test(src2 || '')) { html += '<span class="perr">[figura não encontrada]</span>'; continue; }
        html += '<figure class="timg"' + (w ? ' style="width:' + Math.min(100, Math.max(10, +w || 100)) + '%"' : '') + '><img src="' + esc(src2) + '" alt="' + esc(cap) + '">' + (cap ? '<figcaption>' + inline(esc(cap)) + '</figcaption>' : '') + '</figure>';
        continue;
      }
      // blocos por linha
      const lines = esc(p).split('\n');
      let out = '', list = null;
      const close = () => { if (list) { out += '</' + list + '>'; list = null; } };
      lines.forEach((ln, k) => {
        let m;
        if ((m = ln.match(/^(#{1,3}) (.*)$/))) { close(); const lv = m[1].length; out += '<h' + (lv + 1) + '>' + inline(m[2]) + '</h' + (lv + 1) + '>'; return; }
        if ((m = ln.match(/^\s*[-•] (.*)$/))) { if (list !== 'ul') { close(); out += '<ul>'; list = 'ul'; } out += '<li>' + inline(m[1]) + '</li>'; return; }
        if ((m = ln.match(/^\s*\d+[.)] (.*)$/))) { if (list !== 'ol') { close(); out += '<ol>'; list = 'ol'; } out += '<li>' + inline(m[1]) + '</li>'; return; }
        if ((m = ln.match(/^&gt; ?(.*)$/))) { close(); out += '<blockquote>' + inline(m[1]) + '</blockquote>'; return; }
        close();
        out += inline(ln) + (k < lines.length - 1 ? '<br>' : '');
      });
      close();
      html += out;
    }
    return html.replace(/(<br>\s*)+(<h\d|<ul|<ol|<blockquote|<div class="tmath"|<figure)/g, '$2');
  };

  /* ---------- botões da aba Texto ---------- */
  function textTA() {
    const f = X.targetField();
    const sec = f && f.closest && f.closest('section.region');
    const r = sec && U().state.regions.find((x) => x.id === sec.id);
    if (r && r.type === 'text' && f.classList.contains('src')) return { ta: f, r };
    const sel = U().state.regions.find((x) => x.id === U().state.selected && x.type === 'text');
    if (sel) { U().startEdit(sel.id); const el = document.getElementById(sel.id); const ta = el && el.querySelector('textarea.src'); if (ta) return { ta, r: sel }; }
    return null;
  }
  function wrap(a, b, ph) {
    const t = textTA();
    if (!t) { const r = U().addRegion('text'); setTimeout(() => wrap(a, b, ph), 120); return r; }
    const { ta } = t, s = ta.selectionStart, e = ta.selectionEnd;
    const sel = ta.value.slice(s, e) || ph || '';
    ta.value = ta.value.slice(0, s) + a + sel + b + ta.value.slice(e);
    ta.setSelectionRange(s + a.length, s + a.length + sel.length);
    ta.dispatchEvent(new Event('input', { bubbles: true })); ta.focus();
  }
  function linePrefix(pre) {
    const t = textTA(); if (!t) { U().addRegion('text'); setTimeout(() => linePrefix(pre), 120); return; }
    const { ta } = t, s = ta.selectionStart, ls = ta.value.lastIndexOf('\n', s - 1) + 1;
    const cur = ta.value.slice(ls).match(/^(#{1,3} |[-•] |\d+[.)] |> )?/)[0];
    ta.value = ta.value.slice(0, ls) + (cur === pre ? '' : pre) + ta.value.slice(ls + cur.length);
    const np = s - cur.length + (cur === pre ? 0 : pre.length); ta.setSelectionRange(np, np);
    ta.dispatchEvent(new Event('input', { bubbles: true })); ta.focus();
  }
  async function shrink(file) {
    const url = await new Promise((res, rej) => { const rd = new FileReader(); rd.onload = () => res(rd.result); rd.onerror = rej; rd.readAsDataURL(file); });
    if (/svg/.test(file.type)) return url;
    const img = await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = url; });
    const k = Math.min(1, 1600 / Math.max(img.width, img.height));
    const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    const ctx = c.getContext('2d');
    const png = /png|gif/.test(file.type);
    if (!png) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); }
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return png ? c.toDataURL('image/png') : c.toDataURL('image/jpeg', 0.86);
  }
  function insertFigure() {
    let t = textTA();
    if (!t) { const r = U().addRegion('text'); setTimeout(insertFigure, 150); return; }
    const inpF = document.createElement('input'); inpF.type = 'file'; inpF.accept = 'image/*';
    inpF.addEventListener('change', async () => {
      const f = inpF.files[0]; if (!f) return;
      try {
        const data = await shrink(f);
        t = textTA() || t;
        const r = t.r; r.imgs = r.imgs || {};
        let n = 1; while (r.imgs['f' + n]) n++;
        r.imgs['f' + n] = data;
        const ta = t.ta, s = ta.selectionStart;
        const txt = (s > 0 && ta.value[s - 1] !== '\n' ? '\n' : '') + '![Figura ' + n + '|100](img:f' + n + ')\n';
        ta.value = ta.value.slice(0, s) + txt + ta.value.slice(s);
        ta.dispatchEvent(new Event('input', { bubbles: true }));
        U().toast('Figura inserida. Troque “Figura ' + n + '” pela legenda e o 100 pela largura em %.');
      } catch (e) { U().toast('Não consegui ler a imagem: ' + e.message); }
    });
    inpF.click();
  }
  X.textRibbon = function () {
    const { h, bigBtn } = U();
    const fb = (lab, title, fn, style, help) => {
      const b = h('button', { class: 'tool', title, style: style || null }, lab);
      b.addEventListener('pointerdown', (e) => e.preventDefault());
      b.addEventListener('click', fn);
      b._help = { lab: title, ins: null, extra: help || { descricao: title, entradas: 'Selecione o trecho na região de texto (ou toque no botão e escreva).', exemplo: '' } };
      return b;
    };
    const group = (name, ...btns) => h('div', { class: 'tgroup' }, h('div', { class: 'tglabel' }, name), h('div', { class: 'tgbtns' }, ...btns));
    const colorSel = h('div', { class: 'tcolors' }, ...COLORS.map(([c, n]) => fb('A', 'Cor: ' + n, () => wrap('<span style="color:' + c + '">', '</span>', 'texto'), 'color:' + c + ';font-weight:700')));
    return [
      bigBtn('Região de texto', '<path d="M5 6h14M12 6v13M9 19h6"/>', () => U().addRegion('text')),
      bigBtn('Região de matemática', '<path d="M5 5h8l-6 7 6 7H5"/><path d="M15 12h5M17.5 9.5v5"/>', () => U().addRegion('math')),
      h('div', { class: 'sep' }),
      group('Formatação',
        fb('B', 'Negrito (**texto**)', () => wrap('**', '**', 'texto'), 'font-weight:800'),
        fb('I', 'Itálico (*texto*)', () => wrap('*', '*', 'texto'), 'font-style:italic;font-family:serif'),
        fb('U', 'Sublinhado (<u>texto</u>)', () => wrap('<u>', '</u>', 'texto'), 'text-decoration:underline'),
        fb('S', 'Riscado (~~texto~~)', () => wrap('~~', '~~', 'texto'), 'text-decoration:line-through'),
        fb('▮', 'Destacar (==texto==)', () => wrap('==', '==', 'texto'), 'background:#fff2a8'),
        fb('x²', 'Sobrescrito no texto (<sup>…</sup>)', () => wrap('<sup>', '</sup>', '2')),
        fb('x₂', 'Subscrito no texto (<sub>…</sub>)', () => wrap('<sub>', '</sub>', '2'))),
      group('Cor', colorSel),
      group('Parágrafo',
        fb('T1', 'Título (#)', () => linePrefix('# ')), fb('T2', 'Subtítulo (##)', () => linePrefix('## ')), fb('T3', 'Seção (###)', () => linePrefix('### ')),
        fb('• lista', 'Lista com marcadores (- item)', () => linePrefix('- ')), fb('1. lista', 'Lista numerada (1. item)', () => linePrefix('1. ')), fb('❝', 'Citação (> texto)', () => linePrefix('> '))),
      group('Fórmulas e figuras',
        fb('$x$', 'Fórmula na linha ($…$). As ferramentas das outras abas escrevem LaTeX aqui.', () => wrap('$', '$', 'E = h\\nu'), null, { descricao: 'Fórmula LaTeX no meio do texto. Dentro do texto, os botões das abas Matemática, Gregas, Funções e Unidades escrevem LaTeX (x², λ, √, ∫…).', entradas: 'Escreva entre $ e $. Ex.: $E = h\\nu$, $\\psi_n(x)$, $x^{2}$.', exemplo: '' }),
        fb('$$', 'Equação em destaque ($$…$$)', () => wrap('$$', '$$', '\\psi_n(x) = \\sqrt{2/L}\\,\\sin(n\\pi x/L)')),
        fb('Figura', 'Inserir figura (imagem do aparelho)', insertFigure, null, { descricao: 'Insere uma imagem (foto, esquema, gráfico) na região de texto. Ela fica guardada dentro da folha.', entradas: 'Escolha a imagem. Depois edite a linha ![legenda|largura](img:f1): troque a legenda e a largura em % (ex.: 60).', exemplo: '' }))
    ];
  };
})();
