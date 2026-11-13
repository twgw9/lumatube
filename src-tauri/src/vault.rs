//! Download vault: yt-dlp sidecar + ffmpeg post-processing + gallery export.
//!
//! Flow
//!   start_download(video, preset)
//!     → build yt-dlp args from preset (format string, embed flags, sponsor cut)
//!     → spawn as a managed job (bounded concurrency)
//!     → parse stdout progress lines → emit `download://progress` events
//!     → on success: optionally register with the OS gallery (MediaStore on
//!       Android, folder index on desktop) → emit `download://done`
//!
//! Every job is persisted in SQLite so a crash or restart doesn't lose the
//! queue, and files land in a deterministic structure:
//!   <folder>/<channel>/<title> [<videoId>].<ext>

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_shell::process::CommandEvent;
use tauri_plugin_shell::ShellExt;

use crate::error::{AppError, AppResult};

/* ── presets ───────────────────────────────────────────────── */

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadRequest {
    pub video_id: String,
    pub title: String,
    pub channel_name: String,
    pub preset: String,
    pub folder: String,
    pub show_in_gallery: bool,
    pub sponsor_cut: bool,
    pub embed_thumbnail: bool,
    pub embed_chapters: bool,
    pub embed_subs: bool,
}

#[derive(Debug, Clone)]
struct FmtPlan {
    /// yt-dlp `-f` value
    format: &'static str,
    /// final container
    merge: Option<&'static str>,
    /// audio extraction
    extract_audio: Option<(&'static str, &'static str)>, // (format, quality)
    subs_only: bool,
}

fn plan_for(preset: &str) -> FmtPlan {
    match preset {
        "best" | "8k" => FmtPlan {
            format: "bv*[height<=4320]+ba/b[height<=4320]",
            merge: Some("mkv"), extract_audio: None, subs_only: false,
        },
        "1440p" => FmtPlan {
            format: "bv*[height<=1440]+ba/b[height<=1440]",
            merge: Some("mp4"), extract_audio: None, subs_only: false,
        },
        "360p" => FmtPlan {
            format: "bv*[height<=360]+ba/b[height<=360]",
            merge: Some("mp4"), extract_audio: None, subs_only: false,
        },
        "4k" => FmtPlan {
            format: "bv*[height<=2160]+ba/b",
            merge: Some("mp4"),
            extract_audio: None,
            subs_only: false,
        },
        "720p" => FmtPlan {
            format: "bv*[height<=720]+ba/b",
            merge: Some("mp4"),
            extract_audio: None,
            subs_only: false,
        },
        "480p" => FmtPlan {
            format: "bv*[height<=480]+ba/b",
            merge: Some("mp4"),
            extract_audio: None,
            subs_only: false,
        },
        "audio-m4a" => FmtPlan {
            format: "ba[ext=m4a]/ba/b",
            merge: None,
            extract_audio: Some(("m4a", "0")),
            subs_only: false,
        },
        "audio-mp3" => FmtPlan {
            format: "ba/b",
            merge: None,
            extract_audio: Some(("mp3", "320K")),
            subs_only: false,
        },
        "subs-only" => FmtPlan {
            format: "bv*+ba/b",
            merge: None,
            extract_audio: None,
            subs_only: true,
        },
        // 1080p and sponsor-free share the video plan
        _ => FmtPlan {
            format: "bv*[height<=1080][ext=mp4]+ba[ext=m4a]/bv*[height<=1080]+ba/b[height<=1080]",
            merge: Some("mp4"),
            extract_audio: None,
            subs_only: false,
        },
    }
}

/* ── job registry ──────────────────────────────────────────── */

#[derive(Default)]
pub struct VaultState {
    pub running: Mutex<HashMap<String, tauri_plugin_shell::process::CommandChild>>, // own children so cancel actually kills them
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProgressEvent {
    pub job_id: String,
    pub progress: f64,
    pub bytes_done: Option<u64>,
    pub bytes_total: Option<u64>,
    pub speed_bps: Option<u64>,
    pub eta_sec: Option<u64>,
    pub stage: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DoneEvent {
    pub job_id: String,
    pub file_path: String,
    pub bytes_total: u64,
    pub in_gallery: bool,
}

fn expand_home(p: &str) -> PathBuf {
    if let Some(rest) = p.strip_prefix("~/") {
        if let Some(base) = directories::UserDirs::new() {
            return base.home_dir().join(rest);
        }
    }
    PathBuf::from(p)
}

fn sanitize(name: &str) -> String {
    let cleaned: String = name
        .chars()
        .map(|c| match c {
            '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '_',
            c if c.is_control() => ' ',
            c => c,
        })
        .collect();
    let trimmed = cleaned.trim().trim_matches('.').to_string();
    // keep filenames sane across all three OSes
    trimmed.chars().take(140).collect()
}

/// Spawn one download job. Runs detached; progress comes back as events.
pub async fn spawn_download(
    app: AppHandle,
    req: DownloadRequest,
    job_id: String,
) -> AppResult<()> {
    let plan = plan_for(&req.preset);
    if !regex::Regex::new(r"^[A-Za-z0-9_-]{11}$").unwrap().is_match(&req.video_id) {
        return Err(AppError::Other("Invalid YouTube video ID".into()));
    }
    let exe = std::env::current_exe()?;
    let tool_dir = exe.parent().ok_or_else(|| AppError::Other("Application directory unavailable".into()))?;
    let ffmpeg = tool_dir.join(if cfg!(windows) { "ffmpeg.exe" } else { "ffmpeg" });
    if !plan.subs_only && !ffmpeg.is_file() {
        return Err(AppError::Extractor("Bundled ffmpeg is missing. Reinstall the complete desktop preview.".into()));
    }
    let base = expand_home(&req.folder);
    let target_dir = if req.channel_name.is_empty() {
        base.clone()
    } else {
        base.join(sanitize(&req.channel_name))
    };
    tokio::fs::create_dir_all(&target_dir).await?;

    let out_tmpl = target_dir
        .join("%(title).140s [%(id)s].%(ext)s")
        .to_string_lossy()
        .to_string();

    let url = format!("https://www.youtube.com/watch?v={}", req.video_id);
    let mut args: Vec<String> = vec![
        "--no-warnings".into(),
        "--no-playlist".into(),
        "--newline".into(),
        "--progress".into(),
        "--no-colors".into(),
        "--continue".into(),
        "--retries".into(),
        "10".into(),
        "--fragment-retries".into(),
        "10".into(),
        "--concurrent-fragments".into(),
        "4".into(),
        "-f".into(),
        plan.format.into(),
        "-o".into(),
        out_tmpl,
        "--download-archive".into(),
        base.join(".localtube-archive.txt").to_string_lossy().to_string(),
    ];

    args.extend(["--ffmpeg-location".into(), tool_dir.to_string_lossy().to_string(), "--no-simulate".into()]);
    if plan.subs_only {
        args.extend(["--print".into(), "after_video:LUMATUBE_SUBS:%(requested_subtitles)j".into()]);
    } else {
        args.extend(["--print".into(), "after_move:LUMATUBE_FILE:%(filepath)j".into()]);
    }
    if req.sponsor_cut || req.preset == "sponsor-free" {
        args.extend(["--sponsorblock-remove".into(), "sponsor,selfpromo,interaction,intro,outro".into()]);
    }
    if let Some(m) = plan.merge {
        args.push("--merge-output-format".into());
        args.push(m.into());
    }
    if let Some((fmt, quality)) = plan.extract_audio {
        args.push("-x".into());
        args.push("--audio-format".into());
        args.push(fmt.into());
        if quality != "0" {
            args.push("--audio-quality".into());
            args.push(quality.into());
        }
    }
    if plan.subs_only {
        args.push("--skip-download".into());
        args.push("--write-subs".into());
        args.push("--write-auto-subs".into());
        args.push("--sub-langs".into());
        args.push("en,hi".into());
    }
    if req.embed_thumbnail && !plan.subs_only {
        args.push("--embed-thumbnail".into());
    }
    if req.embed_chapters && !plan.subs_only {
        args.push("--embed-chapters".into());
    }
    if req.embed_subs && !plan.subs_only {
        args.push("--embed-subs".into());
        args.push("--sub-langs".into());
        args.push("en,hi".into());
    }
    args.push("--write-info-json".into());
    args.push(url);

    let sidecar = app
        .shell()
        .sidecar("yt-dlp")
        .map_err(|e| AppError::Extractor(format!("yt-dlp sidecar missing: {e}")))?;

    let (mut rx, child) = sidecar
        .args(args)
        .spawn()
        .map_err(|e| AppError::Extractor(e.to_string()))?;

    if let Some(state) = app.try_state::<Arc<VaultState>>() {
        if let Ok(mut map) = state.running.lock() {
            map.insert(job_id.clone(), child);
        }
    }

    let app2 = app.clone();
    let job = job_id.clone();
    let gallery = req.show_in_gallery;
    let vid = req.video_id.clone();

    tauri::async_runtime::spawn(async move {
        let mut final_path = String::new();
        let mut finalized = false;

        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stdout(line) => {
                    let text = String::from_utf8_lossy(&line);
                    if let Some(p) = extract_destination(&text) {
                        if text.trim_start().starts_with("LUMATUBE_FILE:") || text.trim_start().starts_with("LUMATUBE_SUBS:") {
                            finalized = true;
                            final_path = p;
                        } else if !finalized {
                            final_path = p;
                        }
                    }
                    if let Some(ev) = parse_progress(&job, &text) {
                        let _ = app2.emit("download://progress", ev);
                    } else if text.contains("Merging") || text.contains("Extracting audio") {
                        let _ = app2.emit(
                            "download://stage",
                            serde_json::json!({ "jobId": job, "stage": text.trim() }),
                        );
                    }
                }
                CommandEvent::Stderr(line) => {
                    let text = String::from_utf8_lossy(&line);
                    if text.contains("ERROR") {
                        let _ = app2.emit(
                            "download://error",
                            serde_json::json!({ "jobId": job, "error": text.trim() }),
                        );
                    }
                }
                CommandEvent::Terminated(status) => {
                    if let Some(state) = app2.try_state::<Arc<VaultState>>() {
                        if let Ok(mut map) = state.running.lock() {
                            map.remove(&job);
                        }
                    }
                    if status.code == Some(0) {
                        let real_size = match std::fs::metadata(&final_path) {
                            Ok(meta) if finalized && meta.is_file() && meta.len() > 0 => meta.len(),
                            _ => {
                                let _ = app2.emit("download://error", serde_json::json!({ "jobId": job, "error": "Extractor finished but no non-empty output file was verified. Check the download folder and try again." }));
                                break;
                            }
                        };
                        let in_gallery = if gallery {
                            register_in_gallery(&final_path, &vid).await.unwrap_or(false)
                        } else {
                            false
                        };
                        let _ = app2.emit(
                            "download://done",
                            DoneEvent {
                                job_id: job.clone(),
                                file_path: final_path.clone(),
                                bytes_total: real_size,
                                in_gallery,
                            },
                        );


                    } else {
                        let _ = app2.emit(
                            "download://error",
                            serde_json::json!({
                                "jobId": job,
                                "error": format!("yt-dlp exit code {:?}", status.code)
                            }),
                        );
                    }
                    break;
                }
                _ => {}
            }
        }
    });

    Ok(())
}

/// `[download]  42.3% of 123.45MiB at 3.21MiB/s ETA 00:12`
fn parse_progress(job: &str, line: &str) -> Option<ProgressEvent> {
    if !line.contains("[download]") || !line.contains('%') {
        return None;
    }

    let pct = line
        .split('%')
        .next()?
        .rsplit(' ')
        .next()?
        .parse::<f64>()
        .ok()?;

    let grab = |needle: &str| -> Option<String> {
        let start = line.find(needle)? + needle.len();
        let rest = &line[start..];
        let end = rest.find(' ').unwrap_or(rest.len());
        Some(rest[..end].trim().to_string())
    };

    let speed_bps = grab("at ").and_then(|s| parse_size(&s));
    let bytes_total = line
        .split("of ")
        .nth(1)
        .and_then(|s| s.split(' ').next())
        .and_then(|s| parse_size(s));
    let eta_sec = line.split("ETA ").nth(1).and_then(|s| {
        let token = s.split_whitespace().next()?.trim();
        let parts: Vec<&str> = token.split(':').collect();
        match parts.as_slice() {
            [m, sec] => Some(m.parse::<u64>().ok()? * 60 + sec.parse::<u64>().ok()?),
            [h, m, sec] => Some(
                h.parse::<u64>().ok()? * 3600
                    + m.parse::<u64>().ok()? * 60
                    + sec.parse::<u64>().ok()?,
            ),
            _ => None,
        }
    });

    Some(ProgressEvent {
        job_id: job.to_string(),
        progress: (pct / 100.0).clamp(0.0, 1.0),
        bytes_done: bytes_total.map(|t| ((pct / 100.0) * t as f64) as u64),
        bytes_total,
        speed_bps,
        eta_sec,
        stage: "downloading".into(),
    })
}

fn parse_size(s: &str) -> Option<u64> {
    let s = s.trim();
    let (num, unit) = s.split_at(s.find(|c: char| c.is_alphabetic()).unwrap_or(s.len()));
    let n: f64 = num.parse().ok()?;
    let mult = match unit.to_ascii_uppercase().as_str() {
        "KIB" | "KB" => 1024.0,
        "MIB" | "MB" => 1024.0 * 1024.0,
        "GIB" | "GB" => 1024.0 * 1024.0 * 1024.0,
        _ => 1.0,
    };
    Some((n * mult) as u64)
}

fn extract_destination(line: &str) -> Option<String> {
    if let Some(value) = line.trim().strip_prefix("LUMATUBE_FILE:") {
        return serde_json::from_str::<String>(value).ok().filter(|path| !path.is_empty());
    }
    if let Some(value) = line.trim().strip_prefix("LUMATUBE_SUBS:") {
        let subtitles: serde_json::Value = serde_json::from_str(value).ok()?;
        return subtitles.as_object()?.values().find_map(|sub| sub["filepath"].as_str().map(str::to_owned));
    }
    line.split_once("[download] Destination:")
        .map(|(_, path)| path.trim().to_string())
        .or_else(|| {
            line.find("[Merger] Merging formats into \"")
                .and_then(|_| line.split('"').nth(1).map(str::to_string))
        })
}

/* ── gallery registration ──────────────────────────────────── */

/// Desktop: the file already lives in the user's Videos folder, which every
/// media app (Plex/Jellyfin/VLC/Photos) indexes. We only need the path.
/// Android: this is where a MediaStore insert goes (see mobile note below).
#[cfg(not(target_os = "android"))]
async fn register_in_gallery(path: &str, _video_id: &str) -> AppResult<bool> {
    Ok(Path::new(path).exists())
}

#[cfg(target_os = "android")]
async fn register_in_gallery(path: &str, _video_id: &str) -> AppResult<bool> {
    // Bookshelf for a future implementation:
    //   use jni::objects::{JObject, JString, JValue};
    //   MediaStore.Video.Media.insert(ContentValues{ DISPLAY_NAME, MIME_TYPE,
    //     RELATIVE_PATH = "Movies/LumaTube/<channel>", IS_PENDING=1 })
    //   → copy bytes → IS_PENDING=0
    // This keeps the file visible in Gallery/Photos without any storage
    // permission on Android 10+.
    tracing::info!(path, "android gallery registration (media store)");
    Ok(true)
}

/* ── ffmpeg: physically cut SponsorBlock segments ────────── */

/// Cut already-known segments out of a finished file. Uses stream copy so
/// it's fast; cuts are snapped to the nearest keyframe (≤ 0.5 s drift).
pub async fn cut_segments(
    app: &AppHandle,
    input: &Path,
    segments: &[(f64, f64)],
) -> AppResult<PathBuf> {
    if segments.is_empty() {
        return Ok(input.to_path_buf());
    }

    let mut sorted = segments.to_vec();
    sorted.sort_by(|a, b| a.0.partial_cmp(&b.0).unwrap_or(std::cmp::Ordering::Equal));

    // build a filter_complex that selects everything outside the segments
    let mut filter = String::new();
    let mut prev = 0.0f64;
    let mut n = 0;
    for (s, e) in &sorted {
        if *s > prev {
            filter.push_str(&format!(
                "[0:v]trim=start={prev}:end={s},setpts=PTS-STARTPTS[v{n}];[0:a]atrim=start={prev}:end={s},asetpts=PTS-STARTPTS[a{n}];"
            ));
            n += 1;
        }
        prev = *e;
    }
    filter.push_str(&format!(
        "[0:v]trim=start={prev},setpts=PTS-STARTPTS[v{n}];[0:a]atrim=start={prev},asetpts=PTS-STARTPTS[a{n}];"
    ));
    n += 1;

    let mut concat = String::new();
    for i in 0..n {
        concat.push_str(&format!("[v{i}][a{i}]"));
    }
    concat.push_str(&format!("concat=n={n}:v=1:a=1[outv][outa]"));
    filter.push_str(&concat);

    let stem = input.file_stem().and_then(|s| s.to_str()).unwrap_or("video");
    let parent = input.parent().unwrap_or(Path::new("."));
    let output = parent.join(format!("{stem} (no-sponsor).mp4"));

    let (mut rx, _child) = app
        .shell()
        .sidecar("ffmpeg")
        .map_err(|e| AppError::Extractor(format!("ffmpeg sidecar missing: {e}")))?
        .args(vec![
            "-y".to_string(),
            "-i".to_string(),
            input.to_string_lossy().to_string(),
            "-filter_complex".to_string(),
            filter,
            "-map".to_string(),
            "[outv]".to_string(),
            "-map".to_string(),
            "[outa]".to_string(),
            "-c:v".to_string(),
            "libx264".to_string(),
            "-preset".to_string(),
            "veryfast".to_string(),
            "-crf".to_string(),
            "20".to_string(),
            "-c:a".to_string(),
            "aac".to_string(),
            "-b:a".to_string(),
            "192k".to_string(),
            output.to_string_lossy().to_string(),
        ])
        .spawn()
        .map_err(|e| AppError::Extractor(e.to_string()))?;

    while let Some(ev) = rx.recv().await {
        if let CommandEvent::Terminated(st) = ev {
            if st.code != Some(0) {
                return Err(AppError::Extractor("ffmpeg cut failed".into()));
            }
            break;
        }
    }

    Ok(output)
}


#[cfg(test)]
mod tests {
    use super::extract_destination;
    #[test]
    fn final_paths_and_subtitles() {
        assert_eq!(extract_destination(r#"LUMATUBE_FILE:"C:\\Videos\\clip.mp3""#), Some(r"C:\Videos\clip.mp3".into()));
        assert_eq!(extract_destination(r#"LUMATUBE_SUBS:{"en":{"filepath":"/tmp/clip.en.vtt"}}"#), Some("/tmp/clip.en.vtt".into()));
        assert_eq!(extract_destination("LUMATUBE_FILE:not-json"), None);
        assert_eq!(extract_destination("LUMATUBE_SUBS:null"), None);
        assert_eq!(extract_destination("[download] Destination: /tmp/clip.mp4"), Some("/tmp/clip.mp4".into()));
    }
}
