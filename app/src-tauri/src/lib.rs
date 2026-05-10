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

fn run_cli(subcommand: &str, name: &str) -> Result<CliResult, String> {
    if name.is_empty() || name.contains('/') || name.contains('\\') || name.contains("..") {
        return Err(format!("invalid item name {name:?}"));
    }

    let output = Command::new("bun")
        .arg("cli/src/index.ts")
        .arg(subcommand)
        .arg(if subcommand == "add" {
            format!("r/{name}.json")
        } else {
            name.to_string()
        })
        .current_dir(REPO_ROOT)
        .output()
        .map_err(|e| format!("spawn bun: {e}"))?;

    Ok(CliResult {
        stdout: String::from_utf8_lossy(&output.stdout).into_owned(),
        stderr: String::from_utf8_lossy(&output.stderr).into_owned(),
        exit_code: output.status.code(),
    })
}

/// Stub apply: shells out to `bun cli/src/index.ts add r/<name>.json`. The CLI
/// resolves transitive deps + checks for slot conflicts but does not yet
/// mutate the user's flake. Real apply path is the next session's work.
#[tauri::command]
async fn apply_item(name: String) -> Result<CliResult, String> {
    run_cli("add", &name)
}

/// Read-only preview: shells out to `bun cli/src/index.ts explain <name>`.
/// Reports the resolved transitive closure + any slot conflicts against the
/// user's installed.json state.
#[tauri::command]
async fn explain_item(name: String) -> Result<CliResult, String> {
    run_cli("explain", &name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            read_registry,
            read_item,
            apply_item,
            explain_item
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
