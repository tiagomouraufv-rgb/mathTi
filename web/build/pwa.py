#!/usr/bin/env python3
"""Monta web/site/: o MathTi como app web instalável (PWA) para Windows (Edge/Chrome) e qualquer navegador."""
import pathlib, re, shutil
ROOT = pathlib.Path(__file__).resolve().parent.parent
SITE = ROOT / 'site'
shutil.rmtree(SITE, ignore_errors=True); SITE.mkdir()
html = (ROOT / 'dist' / 'folha-de-calculo.html').read_text(encoding='utf-8')
ver = re.search(r"const VERSION = '([^']+)'", (ROOT / 'src' / 'ui.js').read_text(encoding='utf-8')).group(1)
head = ('<link rel="manifest" href="manifest.webmanifest">\n<meta name="theme-color" content="#1b2430">\n'
        '<link rel="icon" type="image/png" href="favicon.png">\n<link rel="apple-touch-icon" href="icon-192.png">\n')
sw = ("<script>if ('serviceWorker' in navigator && location.protocol.startsWith('http')) "
      "window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });</script>\n")
html = html.replace('</head>', head + '</head>', 1)
i = html.rfind('</body>'); html = html[:i] + sw + html[i:]
(SITE / 'index.html').write_text(html, encoding='utf-8')
for f in (ROOT / 'pwa').iterdir():
    if f.name == 'sw.js': (SITE / 'sw.js').write_text(f.read_text(encoding='utf-8').replace('__VERSAO__', ver), encoding='utf-8')
    else: shutil.copy(f, SITE / f.name)
(SITE / '.nojekyll').write_text('')
print('site pronto:', ver, sorted(p.name for p in SITE.iterdir()))
