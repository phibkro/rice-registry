/** An item is installable iff every required tag is satisfied by the
 * machine, OR `targets` contains "any", OR `targets` is empty/missing. */
export function isInstallable(
  itemTargets: string[] | undefined,
  machine: ReadonlySet<string>
): boolean {
  if (!itemTargets || itemTargets.length === 0) return true;
  if (itemTargets.includes("any")) return true;
  return itemTargets.every((t) => machine.has(t));
}
