// SPDX-License-Identifier: GPL-3.0-or-later
package app.lumatube.mobile

import okhttp3.OkHttpClient
import okhttp3.RequestBody.Companion.toRequestBody
import org.schabi.newpipe.extractor.downloader.Downloader
import org.schabi.newpipe.extractor.downloader.Request
import org.schabi.newpipe.extractor.downloader.Response
import java.io.IOException
import java.util.concurrent.TimeUnit

/** Independent adapter implementing NewPipeExtractor's public HTTP contract. */
class ExtractorHttp : Downloader() {
    val client = OkHttpClient.Builder().connectTimeout(15, TimeUnit.SECONDS).readTimeout(25, TimeUnit.SECONDS).callTimeout(35, TimeUnit.SECONDS).build()
    override fun execute(request: Request): Response {
        val builder = okhttp3.Request.Builder().url(request.url()).header("User-Agent", "Mozilla/5.0 (Android 13) AppleWebKit/537.36 Chrome/131.0 Mobile Safari/537.36")
        for ((name, values) in request.headers()) for (value in values) builder.addHeader(name, value)
        val method = request.httpMethod()
        val body = request.dataToSend()?.toRequestBody(null) ?: if (method in listOf("POST", "PUT", "PATCH")) ByteArray(0).toRequestBody(null) else null
        client.newCall(builder.method(method, body).build()).execute().use { response ->
            if (response.code == 429) throw IOException("YouTube rate limit. Wait before retrying.")
            return Response(response.code, response.message, response.headers.toMultimap(), response.body?.string(), response.request.url.toString())
        }
    }
}
