# MathTi

Folha de cálculo no estilo **Mathcad Prime** para o Galaxy Tab S11 (Android, inclusive DeX) e para o Windows (navegador).
Equações com unidades, programas, Given/Find, gráficos para revista, mapas de calor, animações, tabelas para o Origin e exportação para Python, MATLAB, LaTeX e Markdown.

## Baixar

| Onde | Link |
|---|---|
| **Android (tablet)** | [MathTi.apk — última versão](https://github.com/tiagomouraufv-rgb/mathTi/releases/latest/download/MathTi.apk) |
| **Windows — app instalável** | [tiagomouraufv-rgb.github.io/mathTi](https://tiagomouraufv-rgb.github.io/mathTi/) → no Edge: menu **⋯ → Aplicativos → Instalar MathTi** |
| **Windows — arquivo único (offline)** | [MathTi-web.html](https://github.com/tiagomouraufv-rgb/mathTi/releases/latest/download/MathTi-web.html) → abrir com o Edge ou o Chrome |
| Todas as versões | [Releases](https://github.com/tiagomouraufv-rgb/mathTi/releases) |

## Como uma versão nova é gerada

Cada envio (push) para o ramo `main` dispara a ação **Gerar APK e app web** (aba *Actions*), que:

1. monta o app web num único HTML (`web/src` → `web/dist`);
2. copia esse HTML para dentro do projeto Android e compila o APK, assinado com `android/app/assinatura.jks`
   (a mesma assinatura sempre, então o APK novo instala por cima do antigo sem apagar as folhas);
3. publica o APK e o HTML em **Releases** (os links acima sempre apontam para a última);
4. atualiza o app web do GitHub Pages (ramo `gh-pages`).

Também dá para rodar à mão: **Actions → Gerar APK e app web → Run workflow**.

## Estrutura

```
android/        projeto Android (WebView que abre o app web)
web/src/        código do app (motor de cálculo, gráficos, interface)
web/build/      build.py (gera o HTML único), pwa.py (app instalável), dependências npm
web/pwa/        ícones, manifesto e service worker do app web
```

Antes de publicar uma versão nova, atualize os dois números de versão:
`versionCode`/`versionName` em `android/app/build.gradle` e `VERSION` em `web/src/ui.js`.
