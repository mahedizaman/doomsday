/**
 * Pure, hand-implemented topological rewatch-order algorithm using iterative
 * DFS post-order traversal.
 *
 * Given a target movie and the full movie collection:
 * - Finds all transitive prerequisites of the target movie (excluding the target itself).
 * - Returns each prerequisite exactly once (handles diamond-shaped dependencies).
 * - Guarantees every movie appears AFTER all of its own prerequisites.
 * - Produces a deterministic order by sorting prerequisites by releaseYear ascending,
 *   then title (case-insensitive) ascending, then id ascending.
 * - Computes summary statistics: totalCount, watchedCount, remainingRuntimeMinutes.
 *
 * Time complexity: O(V + E + E log D), where V is the number of reachable movies,
 * E is the number of reachable prerequisite edges, and D is the maximum out-degree
 * (sorting each node's prerequisites for deterministic traversal).
 * Space complexity: O(V) for the lookup map, visited set, and explicit stack.
 */

/**
 * Deterministic comparator for ordering sibling prerequisites.
 * Earliest releaseYear first, then alphabetical title (case-insensitive), then id.
 */
function compareMoviesDeterministically(a, b) {
  if (a.releaseYear !== b.releaseYear) {
    return a.releaseYear - b.releaseYear;
  }
  const titleA = (a.title || '').toLowerCase();
  const titleB = (b.title || '').toLowerCase();
  if (titleA < titleB) return -1;
  if (titleA > titleB) return 1;
  if (a.id < b.id) return -1;
  if (a.id > b.id) return 1;
  return 0;
}

/**
 * Normalize an array or Map of movies into Map<string, NormalizedMovie>.
 *
 * @param {Map<string, object> | Array<object>} moviesInput
 * @returns {Map<string, object>}
 */
function toMoviesMap(moviesInput) {
  const map = new Map();
  const iterable = moviesInput instanceof Map ? moviesInput.values() : moviesInput;

  for (const raw of iterable) {
    const id = String(raw.id ?? raw._id);
    map.set(id, {
      id,
      title: raw.title,
      releaseYear: raw.releaseYear,
      runtimeMinutes: raw.runtimeMinutes,
      watched: Boolean(raw.watched),
      prerequisites: Array.isArray(raw.prerequisites)
        ? raw.prerequisites.map((p) => String(p))
        : [],
    });
  }
  return map;
}

/**
 * Compute the topological rewatch order for a target movie.
 *
 * @param {Map<string, object> | Array<object>} moviesInput All movies in the graph.
 * @param {string} targetId ID of the target movie to prepare for.
 * @returns {{
 *   target: { id: string, title: string },
 *   order: Array<{ id: string, title: string, releaseYear: number, runtimeMinutes: number, watched: boolean }>,
 *   totalCount: number,
 *   watchedCount: number,
 *   remainingRuntimeMinutes: number
 * }}
 */
export function computeRewatchOrder(moviesInput, targetId) {
  const moviesById = toMoviesMap(moviesInput);
  const targetKey = String(targetId);
  const target = moviesById.get(targetKey);

  if (!target) {
    throw new Error(`Target movie not found: ${targetKey}`);
  }

  // Helper to get existing prerequisite movie objects sorted deterministically.
  const getSortedPrerequisites = (movie) => {
    const resolved = [];
    for (const prereqId of movie.prerequisites) {
      const prereq = moviesById.get(prereqId);
      if (prereq) {
        resolved.push(prereq);
      }
    }
    resolved.sort(compareMoviesDeterministically);
    return resolved;
  };

  // Iterative DFS post-order traversal.
  // Each stack frame is { id, expanded }:
  //   - expanded === false: first time visiting this frame; mark visited, push
  //     { id, expanded: true }, then push prerequisites in REVERSE sorted order so
  //     the lowest-sorted prerequisite is popped and explored first.
  //   - expanded === true: all prerequisites of `id` have already been emitted, so
  //     it is now safe to emit `id` to `order`.
  //
  // We seed the stack with the target's prerequisites (never the target itself)
  // so the target movie is excluded from the returned rewatch order.
  const visited = new Set([targetKey]);
  const emitted = new Set();
  const order = [];
  const stack = [];

  const targetPrereqs = getSortedPrerequisites(target);
  for (let i = targetPrereqs.length - 1; i >= 0; i -= 1) {
    stack.push({ id: targetPrereqs[i].id, expanded: false });
  }

  while (stack.length > 0) {
    const frame = stack.pop();

    if (frame.expanded) {
      if (!emitted.has(frame.id)) {
        emitted.add(frame.id);
        const movie = moviesById.get(frame.id);
        order.push({
          id: movie.id,
          title: movie.title,
          releaseYear: movie.releaseYear,
          runtimeMinutes: movie.runtimeMinutes,
          watched: movie.watched,
        });
      }
      continue;
    }

    if (visited.has(frame.id)) {
      continue;
    }
    visited.add(frame.id);

    // Post-order marker: emit this movie only after all of its prerequisites finish.
    stack.push({ id: frame.id, expanded: true });

    const movie = moviesById.get(frame.id);
    const prereqs = getSortedPrerequisites(movie);
    // Push in reverse so the first prerequisite in deterministic order is popped first.
    for (let i = prereqs.length - 1; i >= 0; i -= 1) {
      const nextId = prereqs[i].id;
      if (!visited.has(nextId)) {
        stack.push({ id: nextId, expanded: false });
      }
    }
  }

  let watchedCount = 0;
  let remainingRuntimeMinutes = 0;

  for (const movie of order) {
    if (movie.watched) {
      watchedCount += 1;
    } else {
      remainingRuntimeMinutes += movie.runtimeMinutes;
    }
  }

  return {
    target: {
      id: target.id,
      title: target.title,
    },
    order,
    totalCount: order.length,
    watchedCount,
    remainingRuntimeMinutes,
  };
}
