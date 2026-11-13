// SPDX-License-Identifier: GPL-3.0-or-later
package app.lumatube.mobile

import android.app.Activity
import android.os.Bundle
import android.view.ViewGroup
import android.view.WindowManager
import android.widget.*
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.datasource.DefaultHttpDataSource
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.source.MergingMediaSource
import androidx.media3.exoplayer.source.ProgressiveMediaSource
import androidx.media3.ui.PlayerView
import org.json.JSONObject
import org.schabi.newpipe.extractor.ServiceList
import org.schabi.newpipe.extractor.stream.DeliveryMethod
import org.schabi.newpipe.extractor.stream.StreamInfo
import org.schabi.newpipe.extractor.stream.VideoStream
import java.util.concurrent.Executors

@androidx.annotation.OptIn(markerClass = [androidx.media3.common.util.UnstableApi::class])
class PlayerActivity : Activity() {
    private lateinit var player: ExoPlayer
    private lateinit var message: TextView
    private lateinit var quality: Button
    private val worker = Executors.newSingleThreadExecutor()
    private var info: StreamInfo? = null
    private var loading = false
    private var ready = false
    private var id = ""
    private var record = true
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        id = intent.getStringExtra("videoId") ?: ""
        if (!Regex("^[A-Za-z0-9_-]{11}$").matches(id)) { finish(); return }
        record = intent.getBooleanExtra("recordHistory", true)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        val root = LinearLayout(this).apply { orientation=LinearLayout.VERTICAL; setBackgroundColor(0xff000000.toInt()) }
        val bar = LinearLayout(this)
        bar.addView(Button(this).apply { text="Back"; setOnClickListener { finish() } })
        bar.addView(Button(this).apply { text="Speed"; setOnClickListener { val menu=PopupMenu(this@PlayerActivity,this); listOf(.25f,.5f,.75f,1f,1.25f,1.5f,1.75f,2f,2.5f,3f,3.5f,4f).forEach { rate -> menu.menu.add("${rate}×").setOnMenuItemClickListener { player.setPlaybackSpeed(rate); true } };menu.show() } })
        quality=Button(this).apply { text="Quality"; setOnClickListener { val menu=PopupMenu(this@PlayerActivity,this); candidates().forEach { stream -> menu.menu.add("${stream.height}p${if(stream.fps>=50)"${stream.fps}" else ""}").setOnMenuItemClickListener { play(stream,player.currentPosition,player.playWhenReady); true } };menu.show() } }
        bar.addView(quality)
        bar.addView(Button(this).apply {text="Retry";setOnClickListener { load() }})
        root.addView(HorizontalScrollView(this).apply {addView(bar)})
        player = ExoPlayer.Builder(this).build()
        root.addView(PlayerView(this).apply { player=this@PlayerActivity.player }, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT,0,1f))
        message=TextView(this).apply {setTextColor(0xffdddddd.toInt());setPadding(16,12,16,12);text="Loading stream…"}
        root.addView(message)
        root.setOnApplyWindowInsetsListener { view,insets ->
            if(android.os.Build.VERSION.SDK_INT>=30) {val bars=insets.getInsets(android.view.WindowInsets.Type.systemBars());view.setPadding(bars.left,bars.top,bars.right,bars.bottom)}
            else { @Suppress("DEPRECATION") view.setPadding(insets.systemWindowInsetLeft,insets.systemWindowInsetTop,insets.systemWindowInsetRight,insets.systemWindowInsetBottom) };insets
        }
        setContentView(root)
        player.addListener(object:Player.Listener {override fun onPlayerError(error: PlaybackException) {message.text="Playback failed: ${error.errorCodeName}. Try a lower quality or Retry."}})
        player.setPlaybackSpeed(intent.getFloatExtra("speed",1f).coerceIn(.25f,4f))
        load()
    }
    private fun candidates(): List<VideoStream> = (info?.let { it.videoStreams+it.videoOnlyStreams } ?: emptyList()).filter {it.isUrl && it.deliveryMethod==DeliveryMethod.PROGRESSIVE_HTTP}.sortedByDescending {it.height}.distinctBy {it.height}
    private fun load() {
        if(loading)return
        loading=true; message.text="Resolving YouTube stream…"
        worker.execute {try {
            val result=StreamInfo.getInfo(ServiceList.YouTube,"https://www.youtube.com/watch?v=$id")
            runOnUiThread {if(!isDestroyed){info=result;loading=false;val selected=candidates().firstOrNull{it.height<=1080}?:candidates().lastOrNull();if(selected==null)message.text="No supported progressive stream available. Live streams are not supported yet." else play(selected,if(ready)player.currentPosition else intent.getLongExtra("startAt",0)*1000,true)}}
        } catch(e:Exception) {runOnUiThread {if(!isDestroyed){loading=false;message.text="Extraction failed: ${e.message}. Try again later; no sample video was substituted."}}} }
    }
    private fun play(stream: VideoStream, at: Long, start: Boolean) {
        val factory=ProgressiveMediaSource.Factory(DefaultHttpDataSource.Factory().setUserAgent("Mozilla/5.0 (Android) LumaTubePreview").setConnectTimeoutMs(15000).setReadTimeoutMs(25000))
        val video=factory.createMediaSource(MediaItem.fromUri(stream.content))
        if(stream.isVideoOnly) {
            val audio=info?.audioStreams?.filter{it.isUrl && it.deliveryMethod==DeliveryMethod.PROGRESSIVE_HTTP}?.maxByOrNull{it.averageBitrate}
            if(audio==null){message.text="No compatible audio stream available.";return}
            player.setMediaSource(MergingMediaSource(video,factory.createMediaSource(MediaItem.fromUri(audio.content))))
        } else player.setMediaSource(video)
        player.prepare();player.seekTo(at.coerceAtLeast(0));player.playWhenReady=start;ready=true
        quality.text="${stream.height}p";message.text=info?.name?:"LumaTube"
    }
    override fun onPause() {
        if(::player.isInitialized) {
            if(record && ready && player.duration>0) {
                val prefs=getSharedPreferences("lumatube-native",MODE_PRIVATE)
                val saved=JSONObject(prefs.getString("progress","{}")!!)
                val duration=player.duration/1000.0;val position=player.currentPosition/1000.0
                saved.put(id,JSONObject().put("videoId",id).put("positionSec",position).put("durationSec",duration).put("percent",position/duration).put("completed",position/duration>.97).put("updatedAt",System.currentTimeMillis()))
                while(saved.length()>500)saved.remove(saved.keys().next())
                prefs.edit().putString("progress",saved.toString()).apply()
            }
            player.pause()
        }
        super.onPause()
    }
    override fun onDestroy() {worker.shutdownNow();if(::player.isInitialized)player.release();super.onDestroy()}
}
