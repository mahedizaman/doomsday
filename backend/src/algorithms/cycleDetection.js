/**
 * Pure, hand-implemented cycle detection for the movie prerequisite graph.
 *
 * Directed edge convention:
 *   movie -> prerequisite
 * Meaning if movie M has prerequisite P, there is a directed edge M -> P.
 *
 * When assigning prerequisites P to movie M, a cycle is created if and only if:
 *   1. M is directly inside P (self-dependency), OR
 *   2. M is reachable from at least one movie in P by following prerequisite edges.
 *
 * Time complexity: O(V + E), where V is the number of movies and E is the number
 * of prerequisite links reachable from P.
 * Space complexity: O(V) for the visited set and explicit DFS stack.
 */

/**
 * Normalize an adjacency input (Map or plain Object) into a Map<string, string[]>.
 *
 * @param {Map<string, string[]> | Record<string, string[]>} adjacency
 * @returns {Map<string, string[]>}
 */
function toAdjacencyMap(adjacency) {
  if (adjacency instanceof Map) {
    return adjacency;
  }
  const map = new Map();
  for (const [key, value] of Object.entries(adjacency || {})) {
    map.set(String(key), Array.isArray(value) ? value.map(String) : []);
  }
  return map;
}

/**
 * Checks whether setting `proposedPrerequisites` on `movieId` would introduce
 * any cycle (direct self-loop or indirect cycle of any length) in the graph.
 *
 * Uses an iterative DFS (explicit stack) to avoid call-stack overflow on deep graphs.
 *
 * @param {Map<string, string[]> | Record<string, string[]>} adjacency
 *   Current graph mapping each movie ID to its prerequisite movie IDs.
 * @param {string} movieId
 *   The ID of the movie being created or updated.
 * @param {string[]} proposedPrerequisites
 *   The new prerequisite IDs proposed for `movieId`.
 * @returns {boolean} True if assigning these prerequisites creates a cycle; false otherwise.
 */
export function hasCircularDependency(adjacency, movieId, proposedPrerequisites) {
  const targetId = String(movieId);
  const prereqs = (proposedPrerequisites || []).map(String);

  if (prereqs.length === 0) {
    return false;
  }

  // Fast path: direct self-dependency (M -> M)
  for (const prereqId of prereqs) {
    if (prereqId === targetId) {
      return true;
    }
  }

  const graph = toAdjacencyMap(adjacency);

  // Iterative DFS starting from every proposed prerequisite.
  // If we can walk prerequisite edges and reach `targetId`, adding targetId -> prereq
  // closes a directed cycle.
  const visited = new Set();
  const stack = [...prereqs];

  while (stack.length > 0) {
    const currentId = stack.pop();

    if (currentId === targetId) {
      return true;
    }

    if (visited.has(currentId)) {
      continue;
    }
    visited.add(currentId);

    const neighbors = graph.get(currentId);
    if (!neighbors || neighbors.length === 0) {
      continue;
    }

    for (let i = 0; i < neighbors.length; i += 1) {
      const nextId = String(neighbors[i]);
      if (nextId === targetId) {
        return true;
      }
      if (!visited.has(nextId)) {
        stack.push(nextId);
      }
    }
  }

  return false;
}

/**
 * Build an adjacency Map<string, string[]> from a list of movie objects.
 *
 * @param {Array<{ id?: string, _id?: any, prerequisites?: any[] }>} movies
 * @returns {Map<string, string[]>}
 */
export function buildAdjacencyMap(movies) {
  const map = new Map();
  for (const movie of movies) {
    const id = String(movie.id ?? movie._id);
    const prereqs = Array.isArray(movie.prerequisites)
      ? movie.prerequisites.map((p) => String(p))
      : [];
    map.set(id, prereqs);
  }
  return map;
}
