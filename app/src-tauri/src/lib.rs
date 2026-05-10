//! rice-registry Tauri shell.
//!
//! The repo root is resolved at compile time from CARGO_MANIFEST_DIR; commands
//! read registry.json + r/<name>.json from there and shell out to the bun CLI
//! for `apply` (which is itself a stub today — see ../../cli/src/add.ts).

use serde::Serialize;
use std::path::PathBuf;
use std::process::Command;

/// Repo root, resolved at compile time. CARGO_MANIFEST_DIR points to
/// `<repo>/app/src-tauri`; two parents up reaches the registry root.
///
/// DEV-ONLY: this only works while the binary lives next to the repo it was
/// compiled in. For a packaged build, replace this with a runtime config
/// (env var `RICE_REGISTRY_DIR`, or a `~/.config/rice-registry/config.toml`,
/// or a CLI arg passed at startup). Tracked in docs/OUTSTANDING.md.
const REPO_ROOT: &str = concat!(env!("CARGO_MANIFEST_DIR"), "/../..");

fn registry_path() -> PathBuf {
    PathBuf::from(REPO_ROOT).join("registry.json")
}

fn item_path(name: &str) -> PathBuf {
    PathBuf::from(REPO_ROOT).join("r").join(format!("{name}.json"))
}

#[derive(Serialize)]
struct CliResult {
    stdout: String,
    stderr: String,
    exit_code: Option<i32>,
}

#[tauri::command]
fn read_registry() -> Result<String, String> {
    std::fs::read_to_string(registry_path()).map_err(|e| format!("read registry: {e}"))
}

#[tauri::command]
fn read_item(name: String) -> Result<String, String> {
    // Reject anything that could escape `r/` — names are kebab-case in the
    // schema; any path separator or `..` is illegal.
    if name.is_empty()
        || name.contains('/')
        || name.contains('\\')
        || name.contains("..")
    {
        return Err(format!("invalid item name {name:?}"));
    }
    std::fs::read_to_string(item_path(&name)).map_err(|e| format!("read item {name}: {e}"))
}

/// Stub apply: shells out to `bun cli/src/index.ts add r/<name>.json`. The CLI
/// itself currently just validates and prints the dependency graph (see add.ts).
/// Real apply path (flake mutation + nh home switch + screenshot) is the next
/// session's work.
#[tauri::command]
async fn apply_item(name: String) -> Result<CliResult, String> {
    if name.is_empty()
        || name.contains('/')
        || name.contains('\\')
        || name.contains("..")
    {
        return Err(format!("invalid item name {name:?}"));
    }

    let output = Command::new("bun")
        .arg("cli/src/index.ts")
        .arg("add")
        .arg(format!("r/{name}.json"))
        .current_dir(REPO_ROOT)
        .output()
        .map_err(|e| format!("spawn bun: {e}"))?;

    Ok(CliResult {
        stdout: String::from_utf8_lossy(&output.stdout).into_owned(),
        stderr: String::from_utf8_lossy(&output.stderr).into_owned(),
        exit_code: output.status.code(),
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            read_registry,
            read_item,
            apply_item
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
