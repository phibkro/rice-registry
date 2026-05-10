// Tiny semver subset — enough to evaluate compatibility ranges in
// registry-item `compatibility` fields. Supported operators: >=, >, ==, <=, <
// (and bare versions, which are treated as ==). Multi-clause ranges (a||b,
// a b) are NOT supported — keep version constraints simple, one clause.

import type { MachineProfile } from "./state.ts";
import type { RegistryItem } from "./schema.ts";

type Op = ">=" | ">" | "==" | "<=" | "<";

type Constraint = { op: Op; version: number[] };

function parseVersion(s: string): number[] {
  // Strip a leading "v" if present, then split on "." and parse ints.
  // Non-numeric segments are tolerated but compared as 0 — semver
  // pre-release tags ("0.45.0-rc1") will mostly compare correctly for
  // the current numeric prefix, which is good enough for our use case.
  const cleaned = s.replace(/^v/, "").trim();
  return cleaned.split(/[.\-+]/).map((p) => {
    const n = parseInt(p, 10);
    return Number.isFinite(n) ? n : 0;
  });
}

function parseConstraint(s: string): Constraint {
  const trimmed = s.trim();
  const m = trimmed.match(/^(>=|<=|==|>|<)\s*(.+)$/);
  if (m) {
    return { op: m[1] as Op, version: parseVersion(m[2]!) };
  }
  return { op: "==", version: parseVersion(trimmed) };
}

function compareVersions(a: number[], b: number[]): number {
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const ai = a[i] ?? 0;
    const bi = b[i] ?? 0;
    if (ai !== bi) return ai - bi;
  }
  return 0;
}

export function satisfies(actual: string, constraint: string): boolean {
  const a = parseVersion(actual);
  const c = parseConstraint(constraint);
  const cmp = compareVersions(a, c.version);
  switch (c.op) {
    case ">=":
      return cmp >= 0;
    case ">":
      return cmp > 0;
    case "==":
      return cmp === 0;
    case "<=":
      return cmp <= 0;
    case "<":
      return cmp < 0;
  }
}

export type CompatMiss = {
  item: string;
  key: string;
  required: string;
  actual: string;
};

/** Check each item's `compatibility.{key}` constraint against the machine
 * profile's declared `{key}` version. Items requiring a key the user
 * hasn't declared a version for are skipped (we don't know enough to
 * judge). Items with no `compatibility` are skipped. */
export function checkCompat(
  items: RegistryItem[],
  machine: MachineProfile | undefined
): CompatMiss[] {
  if (!machine) return [];
  const misses: CompatMiss[] = [];
  for (const it of items) {
    if (!it.compatibility) continue;
    for (const [key, required] of Object.entries(it.compatibility)) {
      const actual = (machine as Record<string, string | undefined>)[key];
      if (!actual) continue;
      if (!satisfies(actual, required)) {
        misses.push({ item: it.name, key, required, actual });
      }
    }
  }
  return misses;
}
