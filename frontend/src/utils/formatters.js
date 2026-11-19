/**
 * Format total minutes as "Xh Ym" (e.g. 345 -> "5h 45m", 45 -> "0h 45m").
 */
export function formatRuntime(totalMinutes) {
  const safeMinutes = Math.max(0, Math.floor(Number(totalMinutes) || 0));
  const hours = Math.floor(safeMinutes / 60);
  const mins = safeMinutes % 60;
  return `${hours}h ${mins}m`;
}

/**
 * Format a bundle breakdown into the human-readable headline:
 * e.g. "5 x 1, 2 x 3 - 4 bundles"
 */
export function formatBundleSummary(breakdown, totalBundles) {
  const parts = breakdown.map((item) => `${item.size} x ${item.count}`);
  const bundleLabel = totalBundles === 1 ? 'bundle' : 'bundles';
  return `${parts.join(', ')} - ${totalBundles} ${bundleLabel}`;
}
