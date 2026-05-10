#!/usr/bin/env bun
import { build } from "./build.ts";
import { validatePath } from "./validate.ts";
import { add } from "./add.ts";
import { query } from "./query.ts";
import { explain } from "./explain.ts";

const [, , cmd, ...rest] = process.argv;

const usage = `nix-rice — rice registry CLI

Usage:
  nix-rice build [--root <dir>] [--out <dir>]
      Compile source rice.json files under <root>/examples/** into a
      static registry: <out>/registry.json + <out>/r/<name>.json.
      Defaults: --root . --out .

  nix-rice validate <path-to-rice.json>
      Check a single source manifest against the registry-item schema.

  nix-rice add <url-or-name>
      [stub] Resolve registry item, write to user flake imports, run
      'nh home switch'. Not implemented in the prototype.

  nix-rice query [--registry <path-or-url>] [--type <type>] [--target <tag>]...
      List installable items from a registry index, filtered by your
      machine's substrate tags. --target may be repeated. Defaults:
      --registry ./registry.json.

  nix-rice explain <name-or-path-or-url> [--installed <name>]...
      Resolve transitive dependencies and report slot conflicts against
      an already-installed set. Read-only — does not mutate anything.
      --installed may be repeated.
`;

switch (cmd) {
  case "build": {
    const opts: { root?: string; out?: string } = {};
    for (let i = 0; i < rest.length; i++) {
      if (rest[i] === "--root") opts.root = rest[++i];
      else if (rest[i] === "--out") opts.out = rest[++i];
    }
    await build({ root: opts.root ?? ".", out: opts.out ?? "." });
    break;
  }
  case "validate": {
    const path = rest[0];
    if (!path) {
      console.error("validate: missing path argument");
      process.exit(2);
    }
    const ok = await validatePath(path);
    process.exit(ok ? 0 : 1);
  }
  case "add": {
    const target = rest[0];
    if (!target) {
      console.error("add: missing url-or-name argument");
      process.exit(2);
    }
    await add(target);
    break;
  }
  case "query": {
    let registry = "./registry.json";
    let type: string | undefined;
    const machineTags: string[] = [];
    for (let i = 0; i < rest.length; i++) {
      if (rest[i] === "--registry") registry = rest[++i]!;
      else if (rest[i] === "--type") type = rest[++i];
      else if (rest[i] === "--target") machineTags.push(rest[++i]!);
    }
    await query({ registry, machineTags, type });
    break;
  }
  case "explain": {
    const target = rest[0];
    if (!target) {
      console.error("explain: missing target argument");
      process.exit(2);
    }
    const installed: string[] = [];
    for (let i = 1; i < rest.length; i++) {
      if (rest[i] === "--installed") installed.push(rest[++i]!);
    }
    const code = await explain({ target, installed });
    process.exit(code);
  }
  case undefined:
  case "--help":
  case "-h":
    console.log(usage);
    break;
  default:
    console.error(`unknown command: ${cmd}\n`);
    console.error(usage);
    process.exit(2);
}
