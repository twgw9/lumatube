//! SQLite layer. Everything the user owns lives here: subscriptions,
//! history, progress, notes, clips, playlists, downloads, caches.
//!
//! Design rules:
//!  * WAL mode, single connection pool, all writes on one mutex (SQLite is
//!    fast enough at this scale; correctness > micro-optimisation).
//!  * Schema is additive only — never destructive migrations.

use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};

use crate::error::{AppError, AppResult};

pub const SCHEMA: &str = r#"
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schema_meta (k TEXT PRIMARY KEY, v TEXT);

CREATE TABLE IF NOT EXISTS channel (
  id TEXT PRIMARY KEY,
  handle TEXT,
  name TEXT NOT NULL,
  avatar TEXT,
  subscribers INTEGER,
  subscribed INTEGER DEFAULT 1,
  tags TEXT,
  note TEXT,
  folder_id TEXT,
  last_checked INTEGER,
  uploads_playlist TEXT
);

CREATE TABLE IF NOT EXISTS folder (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  ord INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS video (
  id TEXT PRIMARY KEY,
  channel_id TEXT,
  title TEXT NOT NULL,
  original_title TEXT,
  description TEXT,
  published_at INTEGER,
  duration_sec INTEGER DEFAULT 0,
  thumb TEXT,
  views INTEGER,
  likes INTEGER,
  dislikes INTEGER,
  is_live INTEGER DEFAULT 0,
  is_short INTEGER DEFAULT 0,
  dearrow_title TEXT,
  dearrow_thumb TEXT,
  fetched_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_video_channel ON video(channel_id, published_at DESC);

CREATE TABLE IF NOT EXISTS progress (
  video_id TEXT PRIMARY KEY,
  position_sec REAL DEFAULT 0,
  duration_sec REAL DEFAULT 0,
  percent REAL DEFAULT 0,
  completed INTEGER DEFAULT 0,
  updated_at INTEGER
);

CREATE TABLE IF NOT EXISTS watch_event (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  video_id TEXT,
  title TEXT,
  channel_name TEXT,
  thumb TEXT,
  seconds_watched INTEGER,
  source TEXT DEFAULT 'app',
  watched_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_watch_at ON watch_event(watched_at DESC);

CREATE TABLE IF NOT EXISTS note (
  id TEXT PRIMARY KEY,
  video_id TEXT NOT NULL,
  video_title TEXT,
  channel_name TEXT,
  ts_sec REAL NOT NULL,
  body TEXT NOT NULL,
  tags TEXT,
  created_at INTEGER,
  updated_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_note_video ON note(video_id);

CREATE TABLE IF NOT EXISTS clip (
  id TEXT PRIMARY KEY,
  video_id TEXT,
  video_title TEXT,
  thumb TEXT,
  start_sec REAL,
  end_sec REAL,
  label TEXT,
  created_at INTEGER
);

CREATE TABLE IF NOT EXISTS playlist (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at INTEGER,
  updated_at INTEGER
);
CREATE TABLE IF NOT EXISTS playlist_item (
  playlist_id TEXT,
  video_id TEXT,
  ord INTEGER,
  added_at INTEGER,
  PRIMARY KEY (playlist_id, video_id)
);

CREATE TABLE IF NOT EXISTS download (
  id TEXT PRIMARY KEY,
  video_id TEXT,
  title TEXT,
  channel_name TEXT,
  thumb TEXT,
  preset TEXT,
  status TEXT,
  progress REAL DEFAULT 0,
  bytes_total INTEGER,
  bytes_done INTEGER,
  file_path TEXT,
  show_in_gallery INTEGER DEFAULT 1,
  error TEXT,
  created_at INTEGER,
  finished_at INTEGER
);

CREATE TABLE IF NOT EXISTS sb_cache (
  video_id TEXT NOT NULL,
  payload TEXT NOT NULL,
  fetched_at INTEGER NOT NULL,
  PRIMARY KEY (video_id)
);

CREATE TABLE IF NOT EXISTS meta_cache (
  k TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  fetched_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS pref (
  k TEXT PRIMARY KEY,
  v TEXT
);

CREATE VIRTUAL TABLE IF NOT EXISTS search_fts USING fts5(
  video_id UNINDEXED, title, channel_name, description
);
"#;

#[derive(Clone)]
pub struct Db {
    conn: Arc<Mutex<Connection>>,
}

impl Db {
    pub fn open(dir: PathBuf) -> AppResult<Self> {
        std::fs::create_dir_all(&dir)?;
        let path = dir.join("localtube.db");
        let conn = Connection::open(path)?;
        conn.execute_batch(SCHEMA)?;
        Ok(Self {
            conn: Arc::new(Mutex::new(conn)),
        })
    }

    pub fn with<T>(&self, f: impl FnOnce(&Connection) -> AppResult<T>) -> AppResult<T> {
        let guard = self
            .conn
            .lock()
            .map_err(|_| AppError::Other("db lock poisoned".into()))?;
        f(&guard)
    }

    /* ── generic cache helpers ─────────────────────────────── */

    pub fn cache_get(&self, key: &str, ttl_secs: i64) -> AppResult<Option<String>> {
        self.with(|c| {
            let row: Option<(String, i64)> = c
                .query_row(
                    "SELECT payload, fetched_at FROM meta_cache WHERE k = ?1",
                    params![key],
                    |r| Ok((r.get(0)?, r.get(1)?)),
                )
                .optional()?;
            Ok(row.and_then(|(payload, at)| {
                let age = chrono::Utc::now().timestamp() - at;
                (age < ttl_secs).then_some(payload)
            }))
        })
    }

    pub fn cache_put(&self, key: &str, payload: &str) -> AppResult<()> {
        self.with(|c| {
            c.execute(
                "INSERT INTO meta_cache (k, payload, fetched_at) VALUES (?1, ?2, ?3)
                 ON CONFLICT(k) DO UPDATE SET payload = excluded.payload, fetched_at = excluded.fetched_at",
                params![key, payload, chrono::Utc::now().timestamp()],
            )?;
            Ok(())
        })
    }

    pub fn sb_get(&self, video_id: &str, ttl_secs: i64) -> AppResult<Option<String>> {
        self.with(|c| {
            let row: Option<(String, i64)> = c
                .query_row(
                    "SELECT payload, fetched_at FROM sb_cache WHERE video_id = ?1",
                    params![video_id],
                    |r| Ok((r.get(0)?, r.get(1)?)),
                )
                .optional()?;
            Ok(row.and_then(|(payload, at)| {
                let age = chrono::Utc::now().timestamp() - at;
                (age < ttl_secs).then_some(payload)
            }))
        })
    }

    pub fn sb_put(&self, video_id: &str, payload: &str) -> AppResult<()> {
        self.with(|c| {
            c.execute(
                "INSERT INTO sb_cache (video_id, payload, fetched_at) VALUES (?1, ?2, ?3)
                 ON CONFLICT(video_id) DO UPDATE SET payload = excluded.payload, fetched_at = excluded.fetched_at",
                params![video_id, payload, chrono::Utc::now().timestamp()],
            )?;
            Ok(())
        })
    }

    /* ── subscriptions ──────────────────────────────────────── */

    pub fn upsert_channel(&self, c: &ChannelRow) -> AppResult<()> {
        self.with(|conn| {
            conn.execute(
                "INSERT INTO channel (id, handle, name, avatar, subscribers, subscribed, tags, folder_id, last_checked, uploads_playlist)
                 VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)
                 ON CONFLICT(id) DO UPDATE SET
                   name = excluded.name,
                   handle = COALESCE(excluded.handle, channel.handle),
                   avatar = COALESCE(excluded.avatar, channel.avatar),
                   subscribers = COALESCE(excluded.subscribers, channel.subscribers),
                   last_checked = COALESCE(excluded.last_checked, channel.last_checked)",
                params![
                    c.id,
                    c.handle,
                    c.name,
                    c.avatar,
                    c.subscribers,
                    c.subscribed as i32,
                    c.tags,
                    c.folder_id,
                    c.last_checked,
                    c.uploads_playlist
                ],
            )?;
            Ok(())
        })
    }

    pub fn list_channels(&self) -> AppResult<Vec<ChannelRow>> {
        self.with(|c| {
            let mut stmt = c.prepare(
                "SELECT id, handle, name, avatar, subscribers, subscribed, tags, folder_id, last_checked, uploads_playlist
                 FROM channel ORDER BY name COLLATE NOCASE",
            )?;
            let rows = stmt
                .query_map([], |r| {
                    Ok(ChannelRow {
                        id: r.get(0)?,
                        handle: r.get(1)?,
                        name: r.get(2)?,
                        avatar: r.get(3)?,
                        subscribers: r.get(4)?,
                        subscribed: r.get::<_, i32>(5)? != 0,
                        tags: r.get(6)?,
                        folder_id: r.get(7)?,
                        last_checked: r.get(8)?,
                        uploads_playlist: r.get(9)?,
                    })
                })?
                .collect::<Result<Vec<_>, _>>()?;
            Ok(rows)
        })
    }

    /* ── videos / feed ──────────────────────────────────────── */

    pub fn upsert_videos(&self, videos: &[VideoRow]) -> AppResult<()> {
        self.with(|conn| {
            let tx = conn.unchecked_transaction()?;
            {
                let mut stmt = tx.prepare(
                    "INSERT INTO video (id, channel_id, title, original_title, description, published_at, duration_sec, thumb, views, likes, dislikes, is_live, is_short, dearrow_title, dearrow_thumb, fetched_at)
                     VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?16)
                     ON CONFLICT(id) DO UPDATE SET
                       title = excluded.title,
                       duration_sec = COALESCE(NULLIF(excluded.duration_sec, 0), video.duration_sec),
                       views = COALESCE(excluded.views, video.views),
                       dearrow_title = COALESCE(excluded.dearrow_title, video.dearrow_title),
                       dearrow_thumb = COALESCE(excluded.dearrow_thumb, video.dearrow_thumb)",
                )?;
                for v in videos {
                    stmt.execute(params![
                        v.id,
                        v.channel_id,
                        v.title,
                        v.original_title,
                        v.description,
                        v.published_at,
                        v.duration_sec,
                        v.thumb,
                        v.views,
                        v.likes,
                        v.dislikes,
                        v.is_live as i32,
                        v.is_short as i32,
                        v.dearrow_title,
                        v.dearrow_thumb,
                        chrono::Utc::now().timestamp()
                    ])?;
                }
            }
            tx.commit()?;
            Ok(())
        })
    }

    pub fn feed(&self, limit: i64, channel_ids: Option<&[String]>) -> AppResult<Vec<VideoRow>> {
        self.with(|c| {
            let mut sql = String::from(
                "SELECT v.id, v.channel_id, COALESCE(v.dearrow_title, v.title), v.title, v.description,
                        v.published_at, v.duration_sec, COALESCE(v.dearrow_thumb, v.thumb), v.views,
                        v.likes, v.dislikes, v.is_live, v.is_short
                 FROM video v JOIN channel ch ON ch.id = v.channel_id
                 WHERE ch.subscribed = 1",
            );
            if let Some(ids) = channel_ids {
                if !ids.is_empty() {
                    sql.push_str(" AND v.channel_id IN (");
                    for (i, _) in ids.iter().enumerate() {
                        if i > 0 {
                            sql.push(',');
                        }
                        sql.push('?');
                    }
                    sql.push(')');
                }
            }
            sql.push_str(" ORDER BY v.published_at DESC LIMIT ?");

            let mut stmt = c.prepare(&sql)?;
            let mut bound: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();
            if let Some(ids) = channel_ids {
                for id in ids {
                    bound.push(Box::new(id.clone()));
                }
            }
            bound.push(Box::new(limit));
            let refs: Vec<&dyn rusqlite::ToSql> = bound.iter().map(|b| b.as_ref()).collect();

            let rows = stmt
                .query_map(refs.as_slice(), |r| {
                    Ok(VideoRow {
                        id: r.get(0)?,
                        channel_id: r.get::<_, Option<String>>(1)?.unwrap_or_default(),
                        title: r.get(2)?,
                        original_title: Some(r.get(3)?),
                        description: r.get(4)?,
                        published_at: r.get(5)?,
                        duration_sec: r.get(6)?,
                        thumb: r.get(7)?,
                        views: r.get(8)?,
                        likes: r.get(9)?,
                        dislikes: r.get(10)?,
                        is_live: r.get::<_, i32>(11)? != 0,
                        is_short: r.get::<_, i32>(12)? != 0,
                        dearrow_title: None,
                        dearrow_thumb: None,
                    })
                })?
                .collect::<Result<Vec<_>, _>>()?;
            Ok(rows)
        })
    }

    /* ── progress / history ─────────────────────────────────── */

    pub fn set_progress(&self, p: &ProgressRow) -> AppResult<()> {
        self.with(|c| {
            c.execute(
                "INSERT INTO progress (video_id, position_sec, duration_sec, percent, completed, updated_at)
                 VALUES (?1,?2,?3,?4,?5,?6)
                 ON CONFLICT(video_id) DO UPDATE SET
                   position_sec = excluded.position_sec,
                   duration_sec = excluded.duration_sec,
                   percent = excluded.percent,
                   completed = excluded.completed,
                   updated_at = excluded.updated_at",
                params![
                    p.video_id,
                    p.position_sec,
                    p.duration_sec,
                    p.percent,
                    p.completed as i32,
                    chrono::Utc::now().timestamp()
                ],
            )?;
            Ok(())
        })
    }

    pub fn get_progress(&self, video_id: &str) -> AppResult<Option<ProgressRow>> {
        self.with(|c| {
            Ok(c.query_row(
                "SELECT video_id, position_sec, duration_sec, percent, completed FROM progress WHERE video_id = ?1",
                params![video_id],
                |r| {
                    Ok(ProgressRow {
                        video_id: r.get(0)?,
                        position_sec: r.get(1)?,
                        duration_sec: r.get(2)?,
                        percent: r.get(3)?,
                        completed: r.get::<_, i32>(4)? != 0,
                    })
                },
            )
            .optional()?)
        })
    }

    pub fn push_history(&self, e: &WatchEventRow) -> AppResult<()> {
        self.with(|c| {
            c.execute(
                "INSERT INTO watch_event (video_id, title, channel_name, thumb, seconds_watched, source, watched_at)
                 VALUES (?1,?2,?3,?4,?5,?6,?7)",
                params![
                    e.video_id,
                    e.title,
                    e.channel_name,
                    e.thumb,
                    e.seconds_watched,
                    e.source,
                    chrono::Utc::now().timestamp()
                ],
            )?;
            Ok(())
        })
    }

    pub fn history(&self, limit: i64) -> AppResult<Vec<WatchEventRow>> {
        self.with(|c| {
            let mut stmt = c.prepare(
                "SELECT video_id, title, channel_name, thumb, seconds_watched, source, watched_at
                 FROM watch_event ORDER BY watched_at DESC LIMIT ?1",
            )?;
            let rows = stmt
                .query_map(params![limit], |r| {
                    Ok(WatchEventRow {
                        video_id: r.get(0)?,
                        title: r.get(1)?,
                        channel_name: r.get(2)?,
                        thumb: r.get(3)?,
                        seconds_watched: r.get(4)?,
                        source: r.get(5)?,
                        watched_at: r.get(6)?,
                    })
                })?
                .collect::<Result<Vec<_>, _>>()?;
            Ok(rows)
        })
    }

    /* ── prefs ──────────────────────────────────────────────── */

    pub fn pref_get(&self, k: &str) -> AppResult<Option<String>> {
        self.with(|c| {
            Ok(c.query_row("SELECT v FROM pref WHERE k = ?1", params![k], |r| r.get(0))
                .optional()?)
        })
    }

    pub fn pref_set(&self, k: &str, v: &str) -> AppResult<()> {
        self.with(|c| {
            c.execute(
                "INSERT INTO pref (k, v) VALUES (?1, ?2) ON CONFLICT(k) DO UPDATE SET v = excluded.v",
                params![k, v],
            )?;
            Ok(())
        })
    }
}

/* ── row types (serde -> straight to the frontend) ─────────── */

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChannelRow {
    pub id: String,
    pub handle: Option<String>,
    pub name: String,
    pub avatar: Option<String>,
    pub subscribers: Option<i64>,
    pub subscribed: bool,
    pub tags: Option<String>,
    pub folder_id: Option<String>,
    pub last_checked: Option<i64>,
    pub uploads_playlist: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VideoRow {
    pub id: String,
    pub channel_id: String,
    pub title: String,
    pub original_title: Option<String>,
    pub description: Option<String>,
    pub published_at: Option<i64>,
    pub duration_sec: i64,
    pub thumb: Option<String>,
    pub views: Option<i64>,
    pub likes: Option<i64>,
    pub dislikes: Option<i64>,
    pub is_live: bool,
    pub is_short: bool,
    pub dearrow_title: Option<String>,
    pub dearrow_thumb: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProgressRow {
    pub video_id: String,
    pub position_sec: f64,
    pub duration_sec: f64,
    pub percent: f64,
    pub completed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WatchEventRow {
    pub video_id: String,
    pub title: Option<String>,
    pub channel_name: Option<String>,
    pub thumb: Option<String>,
    pub seconds_watched: Option<i64>,
    pub source: Option<String>,
    pub watched_at: i64,
}
