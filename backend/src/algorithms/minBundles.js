/**
 * Pure, hand-implemented bottom-up Dynamic Programming algorithm for finding the
 * fewest cinema seat bundles that sum to an exact group size (minimum coin change).
 *
 * State definition:
 *   dp[s]     = minimum number of bundles required to get exactly `s` seats
 *               (or INF if `s` seats cannot be formed exactly).
 *   choice[s] = the bundle size last added to achieve the optimal dp[s]
 *               (or -1 if unreachable).
 *
 * Transition:
 *   dp[0] = 0
 *   For s = 1 .. groupSize:
 *     For each bundle size b in bundleSizes:
 *       if b <= s and dp[s - b] + 1 < dp[s]:
 *         dp[s] = dp[s - b] + 1
 *         choice[s] = b
 *
 * Reconstruction:
 *   Starting at rem = groupSize, repeatedly read b = choice[rem], increment the
 *   count for bundle size b, and subtract b from rem until rem === 0.
 *
 * Time complexity: O(groupSize * bundleSizes.length)
 * Space complexity: O(groupSize)
 */

/**
 * Compute the minimum number of bundles that add up to exactly `groupSize`.
 *
 * @param {number[]} bundleSizes Distinct positive integer bundle sizes.
 * @param {number} groupSize Positive integer target group size.
 * @returns {
 *   | { possible: true, totalBundles: number, breakdown: Array<{ size: number, count: number }> }
 *   | { possible: false, message: string }
 * }
 */
export function calculateMinBundles(bundleSizes, groupSize) {
  if (!Array.isArray(bundleSizes) || bundleSizes.length === 0) {
    return {
      possible: false,
      message: `No exact combination of bundles adds up to ${groupSize} seats.`,
    };
  }

  if (!Number.isInteger(groupSize) || groupSize < 1) {
    throw new Error('groupSize must be a positive integer');
  }

  // Sort bundle sizes descending so ties deterministically prefer larger bundles.
  const sortedSizes = [...bundleSizes].sort((a, b) => b - a);

  // Any valid solution uses at most `groupSize` bundles (when bundle size 1 exists),
  // so `groupSize + 1` safely represents Infinity inside an Int32Array.
  const INF = groupSize + 1;
  const dp = new Int32Array(groupSize + 1);
  const choice = new Int32Array(groupSize + 1);

  dp.fill(INF);
  choice.fill(-1);
  dp[0] = 0;

  for (let seats = 1; seats <= groupSize; seats += 1) {
    let bestCount = INF;
    let bestSize = -1;

    for (let i = 0; i < sortedSizes.length; i += 1) {
      const size = sortedSizes[i];
      if (size <= seats) {
        const candidate = dp[seats - size] + 1;
        if (candidate < bestCount) {
          bestCount = candidate;
          bestSize = size;
        }
      }
    }

    dp[seats] = bestCount;
    choice[seats] = bestSize;
  }

  if (dp[groupSize] >= INF) {
    return {
      possible: false,
      message: `No exact combination of bundles adds up to ${groupSize} seats.`,
    };
  }

  // Walk backwards through the parent/choice array to count how many of each size were used.
  const counts = new Map();
  let remaining = groupSize;

  while (remaining > 0) {
    const usedSize = choice[remaining];
    if (usedSize <= 0) {
      // Defensive guard: should never happen when dp[groupSize] < INF.
      return {
        possible: false,
        message: `No exact combination of bundles adds up to ${groupSize} seats.`,
      };
    }
    counts.set(usedSize, (counts.get(usedSize) || 0) + 1);
    remaining -= usedSize;
  }

  // Sort breakdown descending by bundle size for clean, consistent presentation.
  const breakdown = Array.from(counts.entries())
    .sort((a, b) => b[0] - a[0])
    .map(([size, count]) => ({ size, count }));

  return {
    possible: true,
    totalBundles: dp[groupSize],
    breakdown,
  };
}
