package com.tiago.folhadecalculo;

import android.app.Activity;
import android.app.ActivityManager;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.graphics.Color;
import android.graphics.Insets;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.util.Base64;
import android.view.View;
import android.view.WindowInsets;
import android.window.OnBackInvokedCallback;
import android.window.OnBackInvokedDispatcher;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;

import java.io.InputStream;
import java.io.OutputStream;

/**
 * Casca Android da Folha de Cálculo: mostra o app web (assets/index.html) num WebView,
 * totalmente offline, e oferece duas pontes nativas: salvar arquivos e abrir arquivos.
 */
public class MainActivity extends Activity {

    private static final String HOST = "appassets.androidplatform.net";
    private static final String START_URL = "https://" + HOST + "/index.html";
    private static final int REQ_SAVE = 101;
    private static final int REQ_OPEN = 102;

    private WebView web;
    private boolean isExtraWindow = false;
    private ValueCallback<Uri[]> fileCallback;
    private byte[] pendingBytes;
    private String pendingName;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.parseColor("#1B2430"));
        web = new WebView(this);
        root.addView(web, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
        setContentView(root);

        // Android 15+: o app ocupa a tela toda; afastamos o conteúdo das barras e do teclado
        root.setOnApplyWindowInsetsListener((v, insets) -> {
            if (Build.VERSION.SDK_INT >= 30) {
                Insets bars = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                Insets ime = insets.getInsets(WindowInsets.Type.ime());
                v.setPadding(bars.left, bars.top, bars.right, Math.max(bars.bottom, ime.bottom));
            } else {
                v.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(),
                        insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            }
            return insets;
        });

        if ((getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0) {
            WebView.setWebContentsDebuggingEnabled(true);
        }

        WebSettings ws = web.getSettings();
        ws.setJavaScriptEnabled(true);
        ws.setDomStorageEnabled(true);
        ws.setDatabaseEnabled(true);
        ws.setAllowFileAccess(false);
        ws.setAllowContentAccess(true);
        ws.setTextZoom(100);
        ws.setBuiltInZoomControls(false);
        ws.setSupportZoom(false);
        ws.setMediaPlaybackRequiresUserGesture(true);

        web.addJavascriptInterface(new Bridge(), "FcalcAndroid");
        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri u = request.getUrl();
                if (HOST.equals(u.getHost())) {
                    String path = u.getPath();
                    if (path == null || path.equals("/") || path.isEmpty()) path = "/index.html";
                    try {
                        InputStream in = getAssets().open(path.substring(1));
                        return new WebResourceResponse(mimeFor(path), "UTF-8", in);
                    } catch (Exception e) {
                        return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found", new java.util.HashMap<>(), null);
                    }
                }
                return super.shouldInterceptRequest(view, request);
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri u = request.getUrl();
                if (HOST.equals(u.getHost())) return false;
                // links externos abrem no navegador do sistema
                try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception ignored) { }
                return true;
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                i.addCategory(Intent.CATEGORY_OPENABLE);
                i.setType("*/*");
                try {
                    startActivityForResult(i, REQ_OPEN);
                } catch (Exception e) {
                    fileCallback = null;
                    return false;
                }
                return true;
            }
        });

        // janela extra (DeX / tela dividida): abre só a folha pedida
        String janela = getIntent() != null ? getIntent().getStringExtra("janela") : null;
        isExtraWindow = janela != null;
        if (savedInstanceState != null) web.restoreState(savedInstanceState);
        else web.loadUrl(isExtraWindow ? START_URL + "?janela=" + Uri.encode(janela) : START_URL);

        // Android 13+ (e obrigatório no 16): botão voltar via OnBackInvokedCallback
        if (Build.VERSION.SDK_INT >= 33) {
            OnBackInvokedCallback cb = this::handleBack;
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(OnBackInvokedDispatcher.PRIORITY_DEFAULT, cb);
        }
    }

    /** Fecha a ajuda, um formulário ou a edição antes de sair do app. */
    private void handleBack() {
        web.evaluateJavascript("window.FC && FC.back ? FC.back() : false", value -> {
            if (!"true".equals(value)) finish();
        });
    }

    private static String mimeFor(String path) {
        String p = path.toLowerCase();
        if (p.endsWith(".html")) return "text/html";
        if (p.endsWith(".js")) return "application/javascript";
        if (p.endsWith(".css")) return "text/css";
        if (p.endsWith(".svg")) return "image/svg+xml";
        if (p.endsWith(".png")) return "image/png";
        if (p.endsWith(".woff2")) return "font/woff2";
        if (p.endsWith(".json")) return "application/json";
        return "application/octet-stream";
    }

    /** Ponte chamada pelo JavaScript: window.FcalcAndroid.saveFile(nome, mime, base64) */
    private class Bridge {
        @JavascriptInterface
        public void saveFile(String name, String mime, String base64) {
            final byte[] data;
            try {
                data = Base64.decode(base64, Base64.DEFAULT);
            } catch (Exception e) {
                runOnUiThread(() -> Toast.makeText(MainActivity.this, "Arquivo inválido", Toast.LENGTH_SHORT).show());
                return;
            }
            runOnUiThread(() -> {
                pendingBytes = data;
                pendingName = name;
                Intent i = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                i.addCategory(Intent.CATEGORY_OPENABLE);
                i.setType(mime == null || mime.isEmpty() ? "application/octet-stream" : mime);
                i.putExtra(Intent.EXTRA_TITLE, name);
                try {
                    startActivityForResult(i, REQ_SAVE);
                } catch (Exception e) {
                    Toast.makeText(MainActivity.this, "Não foi possível abrir o seletor de arquivos", Toast.LENGTH_LONG).show();
                }
            });
        }

        @JavascriptInterface
        public String platform() {
            return "android";
        }

        /** Abre uma folha numa nova janela (no DeX vira outra janela; no tablet, tela dividida). */
        @JavascriptInterface
        public void openWindow(String docId) {
            runOnUiThread(() -> {
                Intent i = new Intent(MainActivity.this, MainActivity.class);
                i.putExtra("janela", docId);
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_DOCUMENT | Intent.FLAG_ACTIVITY_MULTIPLE_TASK | Intent.FLAG_ACTIVITY_LAUNCH_ADJACENT);
                try {
                    startActivity(i);
                } catch (Exception e) {
                    Toast.makeText(MainActivity.this, "Não foi possível abrir outra janela", Toast.LENGTH_LONG).show();
                }
            });
        }

        /** Título da janela (aparece na barra do DeX e na lista de apps recentes). */
        @JavascriptInterface
        @SuppressWarnings("deprecation")
        public void setTitle(String title) {
            runOnUiThread(() -> {
                try { setTaskDescription(new ActivityManager.TaskDescription(title)); } catch (Exception ignored) { }
            });
        }

        /** Fecha esta janela extra. */
        @JavascriptInterface
        public void closeWindow() {
            runOnUiThread(() -> {
                if (isExtraWindow) finishAndRemoveTask(); else finish();
            });
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQ_OPEN) {
            if (fileCallback != null) {
                Uri[] result = null;
                if (resultCode == RESULT_OK && data != null && data.getData() != null) result = new Uri[]{data.getData()};
                fileCallback.onReceiveValue(result);
                fileCallback = null;
            }
        } else if (requestCode == REQ_SAVE) {
            boolean ok = false;
            if (resultCode == RESULT_OK && data != null && data.getData() != null && pendingBytes != null) {
                try (OutputStream out = getContentResolver().openOutputStream(data.getData(), "wt")) {
                    if (out != null) {
                        out.write(pendingBytes);
                        ok = true;
                    }
                } catch (Exception e) {
                    Toast.makeText(this, "Erro ao gravar: " + e.getMessage(), Toast.LENGTH_LONG).show();
                }
            }
            String js = "window.fcalcSaved && window.fcalcSaved(" + quote(pendingName) + "," + ok + ")";
            web.evaluateJavascript(js, null);
            pendingBytes = null;
            pendingName = null;
        }
    }

    private static String quote(String s) {
        if (s == null) return "''";
        return "'" + s.replace("\\", "\\\\").replace("'", "\\'") + "'";
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        web.saveState(outState);
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        handleBack(); // Android 12 ou anterior
    }

    @Override
    protected void onPause() {
        super.onPause();
        // ao fechar uma janela extra, a folha volta para a janela principal
        if (isFinishing() && isExtraWindow) web.evaluateJavascript("window.FC && FC.releaseWindow && FC.releaseWindow()", null);
        else web.evaluateJavascript("window.FC && FC.flush && FC.flush()", null);
    }

    @Override
    protected void onResume() {
        super.onResume();
        // a outra janela pode ter devolvido folhas: atualiza as abas
        web.evaluateJavascript("window.FC && FC.uiExt && FC.uiExt.renderTabs && FC.uiExt.renderTabs()", null);
    }
}
