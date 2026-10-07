#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{
    fs::{self, File},
    io::{Read, Write},
    net::{SocketAddr, TcpListener, TcpStream},
    path::PathBuf,
    process::{Child, Command, Stdio},
    sync::Mutex,
    thread,
    time::{Duration, Instant},
};
use tauri::{Manager, RunEvent, WebviewUrl, WebviewWindowBuilder};

struct LocalServer(Mutex<Option<Child>>);

impl LocalServer {
    fn stop(&self) {
        if let Ok(mut guard) = self.0.lock() {
            if let Some(mut child) = guard.take() {
                // Let Next.js finish its shutdown before forcing the server to stop.
                unsafe { libc::kill(child.id() as i32, libc::SIGTERM); }
                let deadline = Instant::now() + Duration::from_secs(3);
                while Instant::now() < deadline {
                    if matches!(child.try_wait(), Ok(Some(_))) { return; }
                    thread::sleep(Duration::from_millis(50));
                }
                let _ = child.kill();
                let _ = child.wait();
            }
        }
    }
}

impl Drop for LocalServer {
    fn drop(&mut self) { self.stop(); }
}

fn wait_for_server(child: &mut Child, port: u16) -> Result<(), Box<dyn std::error::Error>> {
    let address: SocketAddr = format!("127.0.0.1:{port}").parse()?;
    let deadline = Instant::now() + Duration::from_secs(45);
    while Instant::now() < deadline {
        if let Some(status) = child.try_wait()? {
            return Err(format!("Local server exited with {status}; see next-server.log in the app's log folder.").into());
        }
        if let Ok(mut socket) = TcpStream::connect_timeout(&address, Duration::from_millis(200)) {
            socket.set_read_timeout(Some(Duration::from_secs(1)))?;
            socket.set_write_timeout(Some(Duration::from_secs(1)))?;
            socket.write_all(format!("GET / HTTP/1.1\r\nHost: 127.0.0.1:{port}\r\nConnection: close\r\n\r\n").as_bytes())?;
            let mut response = [0; 32];
            if let Ok(length) = socket.read(&mut response) {
                if String::from_utf8_lossy(&response[..length]).starts_with("HTTP/1.1 200") { return Ok(()); }
            }
        }
        thread::sleep(Duration::from_millis(100));
    }
    Err("The local server did not start within 45 seconds; see next-server.log.".into())
}

fn launch(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    let resources = app.path().resource_dir()?;
    let server_dir = resources.join("server");
    let executable_dir = std::env::current_exe()?.parent().ok_or("Missing executable directory")?.to_path_buf();
    let node = executable_dir.join("node");
    let data = std::env::var_os("CODE_MERGER_DATA").map(PathBuf::from).unwrap_or(app.path().app_data_dir()?.join("data"));
    fs::create_dir_all(&data)?;
    let logs = app.path().app_log_dir()?;
    fs::create_dir_all(&logs)?;
    let log = File::create(logs.join("next-server.log"))?;
    let listener = TcpListener::bind("127.0.0.1:0")?;
    let port = listener.local_addr()?.port();
    drop(listener);

    // Bundled Node also supplies /usr/bin/env node for agent CLIs launched by Finder.
    let path = format!("{}:{}:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin", executable_dir.display(), std::env::var("PATH").unwrap_or_default());
    let mut child = Command::new(&node)
        .arg(server_dir.join("server.js"))
        .current_dir(&server_dir)
        .env("NODE_ENV", "production")
        .env("HOSTNAME", "127.0.0.1")
        .env("PORT", port.to_string())
        .env("CODE_MERGER_DATA", data)
        .env("PATH", path)
        .stdin(Stdio::null())
        .stdout(log.try_clone()?)
        .stderr(log)
        .spawn()?;
    if let Err(error) = wait_for_server(&mut child, port) {
        let _ = child.kill();
        let _ = child.wait();
        return Err(error);
    }
    app.manage(LocalServer(Mutex::new(Some(child))));
    let url: tauri::Url = format!("http://127.0.0.1:{port}").parse()?;
    let origin = url.origin();
    WebviewWindowBuilder::new(app, "main", WebviewUrl::External(url))
        .title("Code Merger")
        .inner_size(1280.0, 840.0)
        .min_inner_size(800.0, 600.0)
        .disable_drag_drop_handler()
        .on_navigation(move |target| target.origin() == origin)
        .build()?;
    Ok(())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _, _| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        .setup(launch)
        .build(tauri::generate_context!())
        .expect("Could not start Code Merger")
        .run(|app, event| {
            if matches!(event, RunEvent::Exit) {
                if let Some(server) = app.try_state::<LocalServer>() { server.stop(); }
            }
        });
}
