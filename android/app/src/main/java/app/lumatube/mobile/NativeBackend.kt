// SPDX-License-Identifier: GPL-3.0-or-later
package app.lumatube.mobile

import android.app.DownloadManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Environment
import android.util.Xml
import okhttp3.Request
import org.json.JSONArray
import org.json.JSONObject
import org.schabi.newpipe.extractor.ServiceList
import org.schabi.newpipe.extractor.Page
import org.schabi.newpipe.extractor.channel.ChannelInfo
import org.schabi.newpipe.extractor.search.SearchExtractor
import org.schabi.newpipe.extractor.stream.StreamInfo
import org.schabi.newpipe.extractor.stream.StreamInfoItem
import org.schabi.newpipe.extractor.stream.VideoStream
import org.schabi.newpipe.extractor.stream.DeliveryMethod
import org.xmlpull.v1.XmlPullParser
import java.io.File
import java.time.Instant
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

class NativeBackend(private val activity: MainActivity) {
    private val prefs = activity.getSharedPreferences("lumatube-native", Context.MODE_PRIVATE)
    private val dm = activity.getSystemService(DownloadManager::class.java)
    private val http = ExtractorHttp().client
    private data class Continuation(val query: String, val extractor: SearchExtractor, val page: Page, val created: Long)
    private val pages = ConcurrentHashMap<String, Continuation>()
    private val validId = Regex("^[A-Za-z0-9_-]{11}$")
    private fun videoId(args: JSONObject): String = args.getString("videoId").also { require(validId.matches(it)) { "Invalid YouTube video ID" } }
    fun invoke(command: String, args: JSONObject): Any? = when (command) {
        "discover_videos" -> discover(args)
        "resolve_channel" -> resolveChannel(args.getString("handle"))
        "refresh_feed" -> refresh(args.getJSONArray("channelIds"))
        "play_video" -> { val id = videoId(args); activity.runOnUiThread { activity.startActivity(Intent(activity, PlayerActivity::class.java).putExtra("videoId", id).putExtra("speed", args.optDouble("speed", 1.0).toFloat()).putExtra("startAt", args.optLong("startAt", 0)).putExtra("recordHistory", args.optBoolean("recordHistory", true))) }; JSONObject() }
        "start_download" -> startDownload(args)
        "cancel_download" -> { synchronized(this) { val jobs = jobs(); val row = jobs.optJSONObject(args.getString("jobId")); if (row != null) dm.remove(row.getLong("nativeId")); jobs.remove(args.getString("jobId")); save(jobs) }; JSONObject() }
        "ack_download" -> { synchronized(this) { val jobs = jobs(); jobs.optJSONObject(args.getString("jobId"))?.put("acked", true); save(jobs) }; JSONObject() }
        "poll_downloads" -> { pollDownloads(); JSONObject() }
        "open_url" -> { val url = Uri.parse(args.getString("url")); require(url.scheme == "https" && url.host == "github.com"); activity.runOnUiThread { activity.startActivity(Intent(Intent.ACTION_VIEW, url)) }; JSONObject() }
        "get_native_progress" -> JSONObject(prefs.getString("progress", "{}")!!)
        "extractor_status" -> JSONObject().put("version", "NewPipeExtractor v0.27.1").put("available", true).put("updatedAt", 0)
        "update_extractor" -> throw IllegalStateException("Android extraction updates require a new APK; desktop yt-dlp updates do not apply.")
        else -> throw IllegalArgumentException("This action is not available in the Android preview: $command")
    }
    private fun discover(args: JSONObject): JSONObject {
        val query = args.getString("query").trim()
        require(query.length in 2..100) { "Search must be 2–100 characters" }
        pages.entries.removeIf { System.currentTimeMillis() - it.value.created > 600000 }
        val token = args.optString("pageToken")
        val extractor: SearchExtractor
        val results: org.schabi.newpipe.extractor.ListExtractor.InfoItemsPage<org.schabi.newpipe.extractor.InfoItem>
        if (token.isNotBlank()) {
            val next = pages[token] ?: throw IllegalStateException("This feed page expired. Refresh the feed.")
            require(next.query == query) { "Search cursor does not match query" }
            extractor = next.extractor; synchronized(extractor) { results = extractor.getPage(next.page) }
        } else {
            extractor = ServiceList.YouTube.getSearchExtractor(query, listOf("videos"), "")
            extractor.fetchPage(); results = extractor.initialPage
        }
        val videos = JSONArray()
        results.items.filterIsInstance<StreamInfoItem>().forEach { item ->
            val id = Uri.parse(item.url).getQueryParameter("v") ?: return@forEach
            if (!validId.matches(id)) return@forEach
            videos.put(JSONObject().put("id", id).put("title", item.name).put("channelId", channelId(item.uploaderUrl)).put("channelName", item.uploaderName).put("thumb", item.thumbnails.firstOrNull()?.url ?: "https://i.ytimg.com/vi/$id/hqdefault.jpg").put("durationSec", item.duration.coerceAtLeast(0)).put("publishedAt", item.uploadDate?.instant?.toString() ?: "").put("views", item.viewCount.coerceAtLeast(0)).put("isShort", item.isShortFormContent))
        }
        var nextToken: String? = null
        if (Page.isValid(results.nextPage)) {
            if (pages.size >= 64) pages.entries.minByOrNull { it.value.created }?.key?.let { pages.remove(it) }
            nextToken = UUID.randomUUID().toString()
            pages[nextToken] = Continuation(query, extractor, results.nextPage, System.currentTimeMillis())
        }
        return JSONObject().put("videos", videos).put("nextPageToken", nextToken ?: JSONObject.NULL)
    }
    private fun channelId(url: String?): String = url?.substringAfter("/channel/", "")?.substringBefore('?')?.substringBefore('/') ?: ""
    private fun resolveChannel(value: String): JSONObject {
        val raw = value.trim()
        val url = if (raw.startsWith("https://")) raw else if (raw.startsWith("UC")) "https://www.youtube.com/channel/$raw" else "https://www.youtube.com/@${raw.removePrefix("@") }"
        val uri = Uri.parse(url)
        require(uri.scheme == "https" && uri.host in listOf("youtube.com", "www.youtube.com", "m.youtube.com")) { "Use a YouTube channel URL or @handle" }
        val info = ChannelInfo.getInfo(ServiceList.YouTube, url)
        val id = channelId(info.url).ifBlank { info.id }
        require(Regex("^UC[\\w-]{22}$").matches(id)) { "Canonical channel ID unavailable" }
        return JSONObject().put("id", id).put("name", info.name).put("avatar", info.avatars.firstOrNull()?.url)
    }
    private fun refresh(ids: JSONArray): JSONArray {
        require(ids.length() <= 100) { "Refresh at most 100 channels at a time" }
        val all = mutableListOf<JSONObject>(); var successes = 0
        val deadline = System.currentTimeMillis() + 45000
        for (i in 0 until ids.length()) {
            if (System.currentTimeMillis() > deadline) break
            val id = ids.getString(i)
            require(Regex("^UC[\\w-]{22}$").matches(id)) { "Invalid channel ID" }
            try {
                http.newCall(Request.Builder().url("https://www.youtube.com/feeds/videos.xml?channel_id=$id").build()).execute().use { response ->
                    check(response.isSuccessful) { "RSS request failed" }
                    val parser = Xml.newPullParser(); parser.setFeature(XmlPullParser.FEATURE_PROCESS_NAMESPACES, true); parser.setInput(response.body!!.charStream())
                    var row: JSONObject? = null; var event = parser.eventType
                    while (event != XmlPullParser.END_DOCUMENT) {
                        if (event == XmlPullParser.START_TAG) when (parser.name) {
                            "entry" -> row = JSONObject().put("channelId", id).put("durationSec", 0)
                            "videoId" -> row?.put("id", parser.nextText())
                            "title" -> if (row != null) row.put("title", parser.nextText())
                            "name" -> if (row != null) row.put("channelName", parser.nextText())
                            "published" -> if (row != null) row.put("publishedAt", parser.nextText())
                            "thumbnail" -> row?.put("thumb", parser.getAttributeValue(null, "url"))
                        }
                        if (event == XmlPullParser.END_TAG && parser.name == "entry") { row?.let { if (it.has("id") && it.has("title")) all.add(it) }; row = null }
                        event = parser.next()
                    }
                    successes++
                }
            } catch (_: Exception) { }
        }
        if (ids.length() > 0 && successes == 0) throw IllegalStateException("No subscription feeds loaded. Check connection and retry.")
        return JSONArray(all.distinctBy { it.getString("id") }.sortedByDescending { it.optString("publishedAt") })
    }
    private fun combined(info: StreamInfo): List<VideoStream> = info.videoStreams.filter { !it.isVideoOnly && it.isUrl && it.deliveryMethod == DeliveryMethod.PROGRESSIVE_HTTP && it.format?.suffix == "mp4" }
    @Synchronized private fun startDownload(args: JSONObject): JSONObject {
        val req = args.getJSONObject("req"); val id = videoId(req); val job = args.getString("jobId")
        require(job.matches(Regex("dl_[A-Za-z0-9_]{1,70}")))
        val preset = req.getString("preset")
        require(!req.optBoolean("sponsorCut")) { "Sponsor-cut downloads are not supported on Android yet." }
        require(preset in listOf("360p", "480p", "720p", "audio-m4a")) { "Android supports combined MP4 up to 720p or M4A audio. MP3/4K merging and subtitle files are not ready." }
        val info = StreamInfo.getInfo(ServiceList.YouTube, "https://www.youtube.com/watch?v=$id")
        val audio = preset == "audio-m4a"
        val stream = if (audio) info.audioStreams.filter { it.isUrl && it.format?.suffix == "m4a" }.maxByOrNull { it.averageBitrate } else combined(info).filter { it.height <= preset.removeSuffix("p").toInt() }.maxByOrNull { it.height }
        checkNotNull(stream) { "No compatible direct-download stream. Adaptive merging is not available on Android yet." }
        val name = req.optString("title", id).replace(Regex("[^\\p{L}\\p{N} ._-]"), "_").take(90) + " [$id]." + if (audio) "m4a" else "mp4"
        val public = req.optBoolean("showInGallery", true)
        val request = DownloadManager.Request(Uri.parse(stream.content)).setTitle(req.optString("title", id)).setDescription("LumaTube offline download").setMimeType(if(audio) "audio/mp4" else "video/mp4").setNotificationVisibility(if(args.optBoolean("notifyComplete")) DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED else DownloadManager.Request.VISIBILITY_VISIBLE).setAllowedOverMetered(!args.optBoolean("wifiOnly", false))
        if (public) request.setDestinationInExternalPublicDir(if(audio) Environment.DIRECTORY_MUSIC else Environment.DIRECTORY_MOVIES, "LumaTube/$name") else request.setDestinationInExternalFilesDir(activity, Environment.DIRECTORY_DOWNLOADS, name)
        val nativeId = dm.enqueue(request)
        val jobs = jobs(); jobs.put(job, JSONObject().put("nativeId", nativeId).put("gallery", public).put("acked", false)); save(jobs)
        return JSONObject().put("jobId", job)
    }
    @Synchronized fun pollDownloads() {
        val jobs = jobs()
        for (job in jobs.keys()) {
            val row = jobs.getJSONObject(job)
            if (row.optBoolean("acked")) continue
            dm.query(DownloadManager.Query().setFilterById(row.getLong("nativeId"))).use { cursor ->
                if (!cursor.moveToFirst()) { activity.emit("download://error", JSONObject().put("jobId",job).put("error","System download no longer exists")); return@use }
                val status = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS))
                val total = cursor.getLong(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES)).coerceAtLeast(0)
                val done = cursor.getLong(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR)).coerceAtLeast(0)
                when (status) {
                    DownloadManager.STATUS_SUCCESSFUL -> activity.emit("download://done", JSONObject().put("jobId",job).put("filePath",cursor.getString(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_LOCAL_URI))).put("bytesTotal",done).put("inGallery",row.optBoolean("gallery")))
                    DownloadManager.STATUS_FAILED -> activity.emit("download://error", JSONObject().put("jobId",job).put("error","Android download failed (reason ${cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_REASON))}). Retry from the video."))
                    else -> activity.emit("download://progress",JSONObject().put("jobId",job).put("progress",if(total>0)done.toDouble()/total else 0.0).put("bytesDone",done).put("bytesTotal",total))
                }
            }
        }
    }
    private fun jobs(): JSONObject = JSONObject(prefs.getString("downloads", "{}")!!)
    private fun save(jobs: JSONObject) { while(jobs.length()>100) jobs.remove(jobs.keys().next()); prefs.edit().putString("downloads",jobs.toString()).apply() }
}
