mod commands;
mod db;
mod enrich;
mod error;
mod feed;
mod resolve;
mod vault;

use std::sync::Arc;

use tauri::Manager;
use tracing_subscriber::EnvFilter;

use commands::AppState;

pub fn run() {
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into()))
        .with_target(false)
        .init();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .setup(|app| {
            let data_dir = app
                .path()
                .app_data_dir()
                .expect("app data dir")
                .to_path_buf();

            let database = db::Db::open(data_dir.clone()).expect("open sqlite");
            tracing::info!(?data_dir, "LumaTube storage ready");

            let http = reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(25))
                .user_agent("LumaTube/0.1 (personal use)")
                .build()
                .expect("http client");

            app.manage(AppState {
                db: Arc::new(database),
                http,
            });
            app.manage(Arc::new(vault::VaultState::default()));

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // playback
            commands::resolve_stream,
            commands::resolve_audio_stream,
            // progress / history
            commands::save_progress,
            commands::get_progress,
            commands::push_history,
            commands::list_history,
            // subscriptions / feed
            commands::resolve_channel,
            commands::add_channel,
            commands::list_channels,
            commands::refresh_feed,
            commands::get_feed,
            commands::search_videos,
            // community metadata
            commands::fetch_segments,
            commands::fetch_dearrow,
            commands::fetch_votes,
            commands::fetch_transcript,
            // downloads
            commands::start_download,
            commands::cancel_download,
            commands::reveal_in_folder,
            commands::delete_download,
            commands::extractor_status,
            commands::update_extractor,
            // account
            commands::google_sign_in,
            commands::google_sign_out,
            // misc
            commands::app_paths,
        ])
        .run(tauri::generate_context!())
        .expect("error while running LumaTube");
}
