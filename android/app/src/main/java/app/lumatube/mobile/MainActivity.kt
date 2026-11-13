// SPDX-License-Identifier: GPL-3.0-or-later
package app.lumatube.mobile

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.webkit.*
import androidx.webkit.WebViewAssetLoader
import org.json.JSONObject
import org.schabi.newpipe.extractor.NewPipe
import java.util.concurrent.Executors

class MainActivity : Activity() {
    private lateinit var web: WebView
    private lateinit var backend: NativeBackend
    private val workers = Executors.newFixedThreadPool(3)
    private val main = Handler(Looper.getMainLooper())
    private val origin = "https://appassets.androidplatform.net/"
    private val poll = object : Runnable { override fun run() { if (::backend.isInitialized) workers.execute { backend.pollDownloads() }; main.postDelayed(this, 1500) } }
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        NewPipe.init(ExtractorHttp())
        web = WebView(this)
        backend = NativeBackend(this)
        val loader = WebViewAssetLoader.Builder().addPathHandler("/", WebViewAssetLoader.AssetsPathHandler(this)).build()
        web.settings.apply { javaScriptEnabled = true; domStorageEnabled = true; allowFileAccess = false; allowContentAccess = false; mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW; setSupportMultipleWindows(false); mediaPlaybackRequiresUserGesture = true }
        web.setBackgroundColor(android.graphics.Color.BLACK)
        web.addJavascriptInterface(object {
            @JavascriptInterface fun request(id: String, command: String, payload: String) {
                if (!id.matches(Regex("[a-zA-Z0-9_-]{1,80}")) || payload.length > 128000) return
                workers.execute {
                    val response = try { JSONObject().put("value", backend.invoke(command, JSONObject(payload))) } catch (e: Exception) { JSONObject().put("error", e.message ?: "Native action failed") }
                    main.post { if (!isDestroyed && web.url?.startsWith(origin) == true) web.evaluateJavascript("window.__lumaResolve?.(${JSONObject.quote(id)},${response});", null) }
                }
            }
        }, "LumaNative")
        web.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? = loader.shouldInterceptRequest(request.url)
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                if (!request.isForMainFrame) return true
                val url = request.url
                if (url.toString().startsWith(origin)) return false
                if (url.scheme == "https") try { startActivity(Intent(Intent.ACTION_VIEW, url).addCategory(Intent.CATEGORY_BROWSABLE)) } catch (_: Exception) { }
                return true
            }
        }
        web.setOnApplyWindowInsetsListener { view, insets ->
            if (android.os.Build.VERSION.SDK_INT >= 30) { val bars = insets.getInsets(android.view.WindowInsets.Type.systemBars() or android.view.WindowInsets.Type.ime()); view.setPadding(bars.left, bars.top, bars.right, bars.bottom) }
            else { @Suppress("DEPRECATION") view.setPadding(insets.systemWindowInsetLeft, insets.systemWindowInsetTop, insets.systemWindowInsetRight, insets.systemWindowInsetBottom) }
            insets
        }
        setContentView(web)
        web.loadUrl("${origin}index.html")
    }
    fun emit(name: String, payload: JSONObject) { main.post { if (!isDestroyed) web.evaluateJavascript("window.dispatchEvent(new CustomEvent(${JSONObject.quote(name)},{detail:$payload}));", null) } }
    override fun onResume() { super.onResume(); main.post(poll); main.postDelayed({ emit("luma:resume", JSONObject()) }, 500) }
    override fun onPause() { main.removeCallbacks(poll); super.onPause() }
    @Deprecated("Legacy back fallback") override fun onBackPressed() { if (web.canGoBack()) web.goBack() else super.onBackPressed() }
    override fun onDestroy() { main.removeCallbacksAndMessages(null); workers.shutdownNow(); web.removeJavascriptInterface("LumaNative"); web.destroy(); super.onDestroy() }
}
