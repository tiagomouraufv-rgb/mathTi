#!/usr/bin/env python3
"""Gera dist/folha-de-calculo.html: um único arquivo, offline, com bibliotecas e fontes embutidas."""
import json
import base64, re, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / 'src'
NM = ROOT / 'build' / 'node_modules'
DIST = ROOT / 'dist'
DIST.mkdir(exist_ok=True)

def js_safe(code: str) -> str:
    return code.replace('</script', '<\\/script')

# KaTeX: CSS com fontes woff2 embutidas
kdir = NM / 'katex' / 'dist'
kcss = (kdir / 'katex.min.css').read_text(encoding='utf-8')
def font_src(m):
    block = m.group(0)
    w2 = re.search(r'url\((fonts/[^)]+\.woff2)\)', block)
    if not w2:
        return block
    data = base64.b64encode((kdir / w2.group(1)).read_bytes()).decode()
    return re.sub(r'src:[^;}]+', f'src:url(data:font/woff2;base64,{data}) format("woff2")', block)
kcss = re.sub(r'@font-face\{[^}]+\}', font_src, kcss)

css = '<style>\n' + kcss + '\n' + (SRC / 'app.css').read_text(encoding='utf-8') + '\n</style>'
libs = ''.join(
    '<script>' + js_safe(p.read_text(encoding='utf-8')) + '</script>\n'
    for p in [NM / 'mathjs/lib/browser/math.js', NM / 'katex/dist/katex.min.js', NM / 'plotly.js-dist-min/plotly.min.js', NM / 'mp4-muxer/build/mp4-muxer.js', NM / 'fflate/umd/index.js']
)
# gifenc vem em CommonJS: embrulha para criar window.gifenc
libs += '<script>window.gifenc = (function () { var exports = {}; var module = { exports: exports };\n' + js_safe((NM / 'gifenc/dist/gifenc.js').read_text(encoding='utf-8')) + '\nreturn module.exports; })();</script>\n'
app = ''.join('<script>' + js_safe((SRC / f).read_text(encoding='utf-8')) + '</script>\n'
              for f in ['engine.js', 'prog.js', 'plots.js', 'data.js', 'optics.js', 'packs.js', 'compute.js', 'translate.js', 'example.js', 'ui_data.js', 'ui_optics.js', 'ui_packs.js', 'markdown.js', 'help_tools.js', 'ui_docs.js', 'ui_text.js', 'ui_plots.js', 'ui_drag.js', 'ui_eqfit.js', 'anim.js', 'ui.js'])
# versão Python da biblioteca de óptica (usada pela exportação)
app = '<script>window.FC = window.FC || {}; FC.PY_OPTICS = ' + js_safe(json.dumps((SRC / 'optics_py.txt').read_text(encoding='utf-8'))) + '; FC.DEMO_PACK = ' + js_safe(json.dumps((SRC / 'pacote_exemplo.fpack').read_text(encoding='utf-8'))) + ';</script>\n' + app
# código do Worker (cálculo em segundo plano): math.js + motor + gráficos (só cálculo)
worker_src = 'self.window = self;\n' + '\n;\n'.join(
    p.read_text(encoding='utf-8') for p in [NM / 'mathjs/lib/browser/math.js'] + [SRC / f for f in ['engine.js', 'prog.js', 'plots.js', 'data.js', 'optics.js', 'packs.js', 'compute.js', 'worker.js']])
worker = '<script id="fc-worker-src" type="text/plain">' + js_safe(worker_src) + '</script>\n'

html = (SRC / 'index.html').read_text(encoding='utf-8')
html = html.replace('<!--CSS-->', css).replace('<!--LIBS-->', libs).replace('<!--WORKER-->', worker).replace('<!--APP-->', app)
out = DIST / 'folha-de-calculo.html'
out.write_text(html, encoding='utf-8')
print(out, round(out.stat().st_size / 1e6, 2), 'MB')
