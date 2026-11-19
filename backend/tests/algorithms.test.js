import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';

import {
  hasCircularDependency,
  buildAdjacencyMap,
} from '../src/algorithms/cycleDetection.js';
import { computeRewatchOrder } from '../src/algorithms/rewatchOrder.js';
import { calculateMinBundles } from '../src/algorithms/minBundles.js';

function createSampleMcuMovies() {
  return [
    {
      id: 'iron-man',
      title: 'Iron Man',
      releaseYear: 2008,
      runtimeMinutes: 126,
      watched: true,
      prerequisites: [],
    },
    {
      id: 'cap-1',
      title: 'Captain America: The First Avenger',
      releaseYear: 2011,
      runtimeMinutes: 124,
      watched: true,
      prerequisites: [],
    },
    {
      id: 'avengers',
      title: 'The Avengers',
      releaseYear: 2012,
      runtimeMinutes: 143,
      watched: true,
      prerequisites: ['iron-man', 'cap-1'],
    },
    {
      id: 'civil-war',
      title: 'Captain America: Civil War',
      releaseYear: 2016,
      runtimeMinutes: 147,
      watched: false,
      prerequisites: ['avengers'],
    },
    {
      id: 'ragnarok',
      title: 'Thor: Ragnarok',
      releaseYear: 2017,
      runtimeMinutes: 130,
      watched: true,
      prerequisites: [],
    },
    {
      id: 'infinity-war',
      title: 'Avengers: Infinity War',
      releaseYear: 2018,
      runtimeMinutes: 149,
      watched: false,
      prerequisites: ['civil-war', 'ragnarok'],
    },
    {
      id: 'endgame',
      title: 'Avengers: Endgame',
      releaseYear: 2019,
      runtimeMinutes: 181,
      watched: false,
      prerequisites: ['infinity-war'],
    },
    {
      id: 'doomsday',
      title: 'Avengers: Doomsday',
      releaseYear: 2026,
      runtimeMinutes: 160,
      watched: false,
      prerequisites: ['endgame'],
    },
  ];
}

describe('Cycle Detection (pure algorithm)', () => {
  it('allows valid non-cyclic prerequisites', () => {
    const movies = createSampleMcuMovies();
    const graph = buildAdjacencyMap(movies);

    // Adding Thor: Ragnarok as prerequisite of Civil War does not create a cycle
    assert.equal(hasCircularDependency(graph, 'civil-war', ['avengers', 'ragnarok']), false);
    // Adding no prerequisites never creates a cycle
    assert.equal(hasCircularDependency(graph, 'iron-man', []), false);
  });

  it('detects direct self-dependency (M -> M)', () => {
    const movies = createSampleMcuMovies();
    const graph = buildAdjacencyMap(movies);

    assert.equal(hasCircularDependency(graph, 'iron-man', ['iron-man']), true);
    assert.equal(hasCircularDependency(graph, 'avengers', ['iron-man', 'avengers']), true);
  });

  it('detects a direct 2-node cycle (A -> B -> A)', () => {
    const graph = new Map([
      ['A', ['B']],
      ['B', []],
    ]);

    assert.equal(hasCircularDependency(graph, 'B', ['A']), true);
  });

  it('detects making Avengers: Endgame a prerequisite of Iron Man (long indirect cycle)', () => {
    const movies = createSampleMcuMovies();
    const graph = buildAdjacencyMap(movies);

    // Iron Man -> Endgame -> Infinity War -> Civil War -> Avengers -> Iron Man
    assert.equal(hasCircularDependency(graph, 'iron-man', ['endgame']), true);
  });

  it('detects a longer arbitrary indirect cycle (A -> B -> C -> D -> E -> A)', () => {
    const graph = new Map([
      ['A', []],
      ['B', ['A']],
      ['C', ['B']],
      ['D', ['C']],
      ['E', ['D']],
    ]);

    assert.equal(hasCircularDependency(graph, 'A', ['E']), true);
    // Reversing direction from a new node F -> E is valid
    assert.equal(hasCircularDependency(graph, 'F', ['E']), false);
  });

  it('allows diamond-shaped dependencies without false-positive cycle detection', () => {
    const graph = new Map([
      ['A', []],
      ['B', ['A']],
      ['C', ['A']],
      ['D', []],
    ]);

    // D -> [B, C] forms a diamond, NOT a cycle
    assert.equal(hasCircularDependency(graph, 'D', ['B', 'C']), false);
  });
});

describe('Rewatch Order (pure iterative DFS post-order topological sort)', () => {
  it('returns all 7 prerequisites for Avengers: Doomsday in valid deterministic topological order', () => {
    const movies = createSampleMcuMovies();
    const result = computeRewatchOrder(movies, 'doomsday');

    assert.deepEqual(result.target, { id: 'doomsday', title: 'Avengers: Doomsday' });
    assert.equal(result.totalCount, 7);
    assert.equal(result.watchedCount, 4);
    // Unwatched: Civil War (147) + Infinity War (149) + Endgame (181) = 477
    assert.equal(result.remainingRuntimeMinutes, 477);

    const titles = result.order.map((m) => m.title);
    assert.deepEqual(titles, [
      'Iron Man',
      'Captain America: The First Avenger',
      'The Avengers',
      'Captain America: Civil War',
      'Thor: Ragnarok',
      'Avengers: Infinity War',
      'Avengers: Endgame',
    ]);

    // Target itself must not be included
    assert.equal(result.order.some((m) => m.id === 'doomsday'), false);

    // Verify topological invariant: every prerequisite appears before any movie that depends on it
    const position = new Map(result.order.map((m, idx) => [m.id, idx]));
    const byId = new Map(movies.map((m) => [m.id, m]));
    for (const item of result.order) {
      for (const prereqId of byId.get(item.id).prerequisites) {
        assert.ok(
          position.get(prereqId) < position.get(item.id),
          `Expected ${prereqId} before ${item.id}`
        );
      }
    }
  });

  it('returns Iron Man and The First Avenger before The Avengers for Captain America: Civil War', () => {
    const movies = createSampleMcuMovies();
    const result = computeRewatchOrder(movies, 'civil-war');

    assert.equal(result.totalCount, 3);
    assert.equal(result.watchedCount, 3);
    assert.equal(result.remainingRuntimeMinutes, 0);
    assert.deepEqual(
      result.order.map((m) => m.title),
      ['Iron Man', 'Captain America: The First Avenger', 'The Avengers']
    );
  });

  it('returns an empty list for Thor: Ragnarok (no prerequisites)', () => {
    const movies = createSampleMcuMovies();
    const result = computeRewatchOrder(movies, 'ragnarok');

    assert.deepEqual(result.target, { id: 'ragnarok', title: 'Thor: Ragnarok' });
    assert.deepEqual(result.order, []);
    assert.equal(result.totalCount, 0);
    assert.equal(result.watchedCount, 0);
    assert.equal(result.remainingRuntimeMinutes, 0);
  });

  it('includes shared prerequisites exactly once in a diamond dependency graph', () => {
    const diamondMovies = [
      { id: 'A', title: 'Origin', releaseYear: 2010, runtimeMinutes: 100, watched: false, prerequisites: [] },
      { id: 'B', title: 'Branch One', releaseYear: 2012, runtimeMinutes: 110, watched: true, prerequisites: ['A'] },
      { id: 'C', title: 'Branch Two', releaseYear: 2013, runtimeMinutes: 120, watched: false, prerequisites: ['A'] },
      { id: 'D', title: 'Finale', releaseYear: 2015, runtimeMinutes: 150, watched: false, prerequisites: ['C', 'B'] },
    ];

    const result = computeRewatchOrder(diamondMovies, 'D');
    const ids = result.order.map((m) => m.id);

    assert.deepEqual(ids, ['A', 'B', 'C']);
    assert.equal(result.totalCount, 3);
    assert.equal(result.watchedCount, 1);
    assert.equal(result.remainingRuntimeMinutes, 220); // A (100) + C (120)
  });

  it('handles deep linear chains without stack overflow (iterative DFS)', () => {
    const depth = 5000;
    const chain = [];
    for (let i = 0; i < depth; i += 1) {
      chain.push({
        id: `m-${i}`,
        title: `Movie ${i}`,
        releaseYear: 2000,
        runtimeMinutes: 10,
        watched: false,
        prerequisites: i === 0 ? [] : [`m-${i - 1}`],
      });
    }

    const result = computeRewatchOrder(chain, `m-${depth - 1}`);
    assert.equal(result.totalCount, depth - 1);
    assert.equal(result.order[0].id, 'm-0');
    assert.equal(result.order[result.order.length - 1].id, `m-${depth - 2}`);
  });
});

describe('Minimum Bundles (pure bottom-up DP)', () => {
  it('solves bundles [1, 3, 4] for group 6 -> 2 bundles: 3 x 2', () => {
    const result = calculateMinBundles([1, 3, 4], 6);

    assert.equal(result.possible, true);
    assert.equal(result.totalBundles, 2);
    assert.deepEqual(result.breakdown, [{ size: 3, count: 2 }]);
  });

  it('solves bundles [2, 5] for group 11 -> 4 bundles: 5 x 1, 2 x 3', () => {
    const result = calculateMinBundles([2, 5], 11);

    assert.equal(result.possible, true);
    assert.equal(result.totalBundles, 4);
    assert.deepEqual(result.breakdown, [
      { size: 5, count: 1 },
      { size: 2, count: 3 },
    ]);
  });

  it('solves bundles [6, 9, 20] for group 44 -> 4 bundles: 20 x 1, 9 x 2, 6 x 1', () => {
    const result = calculateMinBundles([6, 9, 20], 44);

    assert.equal(result.possible, true);
    assert.equal(result.totalBundles, 4);
    assert.deepEqual(result.breakdown, [
      { size: 20, count: 1 },
      { size: 9, count: 2 },
      { size: 6, count: 1 },
    ]);
  });

  it('returns possible: false for bundles [4, 6] and group 7', () => {
    const result = calculateMinBundles([4, 6], 7);

    assert.equal(result.possible, false);
    assert.match(result.message, /7/);
  });

  it('returns 1 bundle when groupSize equals an available bundle size', () => {
    const result = calculateMinBundles([2, 5, 8], 8);

    assert.equal(result.possible, true);
    assert.equal(result.totalBundles, 1);
    assert.deepEqual(result.breakdown, [{ size: 8, count: 1 }]);
  });

  it('always finds a solution when bundle size 1 is present', () => {
    const result = calculateMinBundles([1, 7, 10], 14);

    assert.equal(result.possible, true);
    assert.equal(result.totalBundles, 2);
    assert.deepEqual(result.breakdown, [{ size: 7, count: 2 }]);
  });

  it('handles largest bundle size 500 accurately', () => {
    const result = calculateMinBundles([500, 120, 7], 1134);

    assert.equal(result.possible, true);
    // 500*2 + 120*1 + 7*2 = 1134 -> 5 bundles
    assert.equal(result.totalBundles, 5);
    assert.deepEqual(result.breakdown, [
      { size: 500, count: 2 },
      { size: 120, count: 1 },
      { size: 7, count: 2 },
    ]);
  });

  it('runs fast for maximum groupSize = 10,000 with 10 bundle sizes', () => {
    const sizes = [3, 7, 13, 29, 53, 97, 199, 311, 419, 500];
    const start = performance.now();
    const result = calculateMinBundles(sizes, 10000);
    const elapsedMs = performance.now() - start;

    assert.equal(result.possible, true);
    assert.equal(result.totalBundles, 20);
    assert.deepEqual(result.breakdown, [{ size: 500, count: 20 }]);
    assert.ok(elapsedMs < 100, `Expected < 100ms, took ${elapsedMs.toFixed(2)}ms`);

    // Also test a non-multiple of 500 at groupSize = 9,999
    const start2 = performance.now();
    const result2 = calculateMinBundles(sizes, 9999);
    const elapsedMs2 = performance.now() - start2;

    assert.equal(result2.possible, true);
    const sum = result2.breakdown.reduce((acc, item) => acc + item.size * item.count, 0);
    const count = result2.breakdown.reduce((acc, item) => acc + item.count, 0);
    assert.equal(sum, 9999);
    assert.equal(count, result2.totalBundles);
    assert.ok(elapsedMs2 < 100, `Expected < 100ms, took ${elapsedMs2.toFixed(2)}ms`);
  });
});
