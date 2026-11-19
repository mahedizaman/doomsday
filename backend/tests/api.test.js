import { describe, it, beforeEach, afterEach, before, after } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';

import { createApp } from '../src/app.js';
import {
  createMemoryCinemaRepository,
  createMemoryMovieRepository,
} from '../src/repositories/memoryRepositories.js';
import {
  createMongoCinemaRepository,
  createMongoMovieRepository,
} from '../src/repositories/mongoRepositories.js';
import { Movie } from '../src/models/Movie.js';
import { Cinema } from '../src/models/Cinema.js';
import { seedDatabase } from '../src/seed/seedData.js';

const TEST_MONGO_URI = process.env.TEST_MONGO_URI;

async function startTestServer() {
  let movieRepo;
  let cinemaRepo;

  if (TEST_MONGO_URI) {
    await Movie.deleteMany({});
    await Cinema.deleteMany({});
    movieRepo = createMongoMovieRepository();
    cinemaRepo = createMongoCinemaRepository();
  } else {
    movieRepo = createMemoryMovieRepository();
    cinemaRepo = createMemoryCinemaRepository();
  }

  await seedDatabase(movieRepo, cinemaRepo);
  const app = createApp({ movieRepo, cinemaRepo });

  const server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  return {
    baseUrl,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

async function api(baseUrl, path, options = {}) {
  const res = await fetch(`${baseUrl}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json();
  return { status: res.status, data };
}

describe('Doomsday Ready API', () => {
  let ctx;

  before(async () => {
    if (TEST_MONGO_URI) {
      await mongoose.connect(TEST_MONGO_URI);
    }
  });

  after(async () => {
    if (TEST_MONGO_URI) {
      await mongoose.disconnect();
    }
  });

  beforeEach(async () => {
    ctx = await startTestServer();
  });

  afterEach(async () => {
    await ctx.close();
  });

  it('GET /api/health returns service ok', async () => {
    const { status, data } = await api(ctx.baseUrl, '/api/health');
    assert.equal(status, 200);
    assert.equal(data.status, 'ok');
  });

  it('returns consistent 404 error shape for unknown routes', async () => {
    const { status, data } = await api(ctx.baseUrl, '/api/does-not-exist');
    assert.equal(status, 404);
    assert.equal(data.error.code, 'NOT_FOUND');
  });

  describe('Feature 1: Movies, Cycles, and Rewatch Order', () => {
    it('seeds the 8 MCU movies and computes expected rewatch orders', async () => {
      const { status, data: movies } = await api(ctx.baseUrl, '/api/movies');
      assert.equal(status, 200);
      assert.equal(movies.length, 8);

      const byTitle = new Map(movies.map((m) => [m.title, m]));
      const doomsday = byTitle.get('Avengers: Doomsday');
      const civilWar = byTitle.get('Captain America: Civil War');
      const ragnarok = byTitle.get('Thor: Ragnarok');
      const ironMan = byTitle.get('Iron Man');
      const avengers = byTitle.get('The Avengers');

      // 1. Rewatch order for Avengers: Doomsday
      const doomsdayPlan = await api(
        ctx.baseUrl,
        `/api/movies/${doomsday.id}/rewatch-order`
      );
      assert.equal(doomsdayPlan.status, 200);
      assert.equal(doomsdayPlan.data.totalCount, 7);
      assert.equal(doomsdayPlan.data.watchedCount, 0);
      assert.deepEqual(
        doomsdayPlan.data.order.map((m) => m.title),
        [
          'Iron Man',
          'Captain America: The First Avenger',
          'The Avengers',
          'Captain America: Civil War',
          'Thor: Ragnarok',
          'Avengers: Infinity War',
          'Avengers: Endgame',
        ]
      );

      // Mark Iron Man and The Avengers watched, then verify counts and remaining runtime
      await api(ctx.baseUrl, `/api/movies/${ironMan.id}`, {
        method: 'PATCH',
        body: { watched: true },
      });
      await api(ctx.baseUrl, `/api/movies/${avengers.id}`, {
        method: 'PATCH',
        body: { watched: true },
      });

      const updatedPlan = await api(
        ctx.baseUrl,
        `/api/movies/${doomsday.id}/rewatch-order`
      );
      assert.equal(updatedPlan.data.watchedCount, 2);
      // Remaining: First Avenger (124) + Civil War (147) + Ragnarok (130) + Infinity War (149) + Endgame (181) = 731
      assert.equal(updatedPlan.data.remainingRuntimeMinutes, 731);

      // 2. Rewatch order for Captain America: Civil War
      const civilWarPlan = await api(
        ctx.baseUrl,
        `/api/movies/${civilWar.id}/rewatch-order`
      );
      assert.equal(civilWarPlan.status, 200);
      assert.equal(civilWarPlan.data.totalCount, 3);
      assert.equal(civilWarPlan.data.order[2].title, 'The Avengers');
      assert.deepEqual(
        new Set(civilWarPlan.data.order.slice(0, 2).map((m) => m.title)),
        new Set(['Iron Man', 'Captain America: The First Avenger'])
      );

      // 3. Rewatch order for Thor: Ragnarok -> empty list
      const ragnarokPlan = await api(
        ctx.baseUrl,
        `/api/movies/${ragnarok.id}/rewatch-order`
      );
      assert.equal(ragnarokPlan.status, 200);
      assert.deepEqual(ragnarokPlan.data.order, []);
      assert.equal(ragnarokPlan.data.totalCount, 0);
      assert.equal(ragnarokPlan.data.watchedCount, 0);
      assert.equal(ragnarokPlan.data.remainingRuntimeMinutes, 0);
    });

    it('rejects making Avengers: Endgame a prerequisite of Iron Man with 409 CIRCULAR_DEPENDENCY', async () => {
      const { data: movies } = await api(ctx.baseUrl, '/api/movies');
      const byTitle = new Map(movies.map((m) => [m.title, m]));

      const ironMan = byTitle.get('Iron Man');
      const endgame = byTitle.get('Avengers: Endgame');

      const res = await api(ctx.baseUrl, `/api/movies/${ironMan.id}`, {
        method: 'PATCH',
        body: { prerequisites: [endgame.id] },
      });

      assert.equal(res.status, 409);
      assert.equal(res.data.error.code, 'CIRCULAR_DEPENDENCY');
    });

    it('rejects self-dependency and indirect cycles with 409 CIRCULAR_DEPENDENCY', async () => {
      const { data: movies } = await api(ctx.baseUrl, '/api/movies');
      const byTitle = new Map(movies.map((m) => [m.title, m]));
      const ironMan = byTitle.get('Iron Man');
      const avengers = byTitle.get('The Avengers');

      // Self-dependency
      const selfRes = await api(ctx.baseUrl, `/api/movies/${ironMan.id}`, {
        method: 'PATCH',
        body: { prerequisites: [ironMan.id] },
      });
      assert.equal(selfRes.status, 409);
      assert.equal(selfRes.data.error.code, 'CIRCULAR_DEPENDENCY');

      // 2-hop cycle: The Avengers -> Iron Man already exists; setting Iron Man -> The Avengers must fail
      const twoHopRes = await api(ctx.baseUrl, `/api/movies/${ironMan.id}`, {
        method: 'PATCH',
        body: { prerequisites: [avengers.id] },
      });
      assert.equal(twoHopRes.status, 409);
      assert.equal(twoHopRes.data.error.code, 'CIRCULAR_DEPENDENCY');
    });

    it('supports diamond dependencies and lists shared prerequisites only once', async () => {
      const { data: movies } = await api(ctx.baseUrl, '/api/movies');
      const ironMan = movies.find((m) => m.title === 'Iron Man');

      // Create two branches that both depend on Iron Man
      const branchA = await api(ctx.baseUrl, '/api/movies', {
        method: 'POST',
        body: {
          title: 'Iron Man 2',
          releaseYear: 2010,
          runtimeMinutes: 124,
          prerequisites: [ironMan.id],
        },
      });
      const branchB = await api(ctx.baseUrl, '/api/movies', {
        method: 'POST',
        body: {
          title: 'Iron Man 3',
          releaseYear: 2013,
          runtimeMinutes: 130,
          prerequisites: [ironMan.id],
        },
      });
      assert.equal(branchA.status, 201);
      assert.equal(branchB.status, 201);

      // Finale depends on both branches (diamond with Iron Man at the base)
      const finale = await api(ctx.baseUrl, '/api/movies', {
        method: 'POST',
        body: {
          title: 'Armor Wars',
          releaseYear: 2027,
          runtimeMinutes: 135,
          prerequisites: [branchA.data.id, branchB.data.id],
        },
      });
      assert.equal(finale.status, 201);

      const plan = await api(ctx.baseUrl, `/api/movies/${finale.data.id}/rewatch-order`);
      assert.equal(plan.status, 200);
      assert.deepEqual(
        plan.data.order.map((m) => m.title),
        ['Iron Man', 'Iron Man 2', 'Iron Man 3']
      );
      assert.equal(plan.data.totalCount, 3);
    });

    it('validates duplicate titles, ranges, ObjectIds, duplicate prerequisites, and batch creates', async () => {
      // Case-insensitive + trimmed duplicate title
      const dupTitle = await api(ctx.baseUrl, '/api/movies', {
        method: 'POST',
        body: {
          title: '  iron man  ',
          releaseYear: 2008,
          runtimeMinutes: 126,
        },
      });
      assert.equal(dupTitle.status, 409);
      assert.equal(dupTitle.data.error.code, 'DUPLICATE_TITLE');

      // Runtime out of range
      const badRuntime = await api(ctx.baseUrl, '/api/movies', {
        method: 'POST',
        body: {
          title: 'Too Long Movie',
          releaseYear: 2024,
          runtimeMinutes: 301,
        },
      });
      assert.equal(badRuntime.status, 400);
      assert.equal(badRuntime.data.error.code, 'VALIDATION_ERROR');

      // Year out of range
      const badYear = await api(ctx.baseUrl, '/api/movies', {
        method: 'POST',
        body: {
          title: 'Ancient Film',
          releaseYear: 1800,
          runtimeMinutes: 90,
        },
      });
      assert.equal(badYear.status, 400);
      assert.equal(badYear.data.error.code, 'VALIDATION_ERROR');

      // Invalid ObjectId
      const badId = await api(ctx.baseUrl, '/api/movies/not-an-object-id');
      assert.equal(badId.status, 400);
      assert.equal(badId.data.error.code, 'VALIDATION_ERROR');

      // Non-existent prerequisite ID
      const missingPrereq = await api(ctx.baseUrl, '/api/movies', {
        method: 'POST',
        body: {
          title: 'Missing Prereq Film',
          releaseYear: 2024,
          runtimeMinutes: 110,
          prerequisites: ['507f1f77bcf86cd799439011'],
        },
      });
      assert.equal(missingPrereq.status, 404);
      assert.equal(missingPrereq.data.error.code, 'NOT_FOUND');

      // Duplicate prerequisite IDs inside array
      const { data: movies } = await api(ctx.baseUrl, '/api/movies');
      const ironMan = movies.find((m) => m.title === 'Iron Man');
      const dupPrereq = await api(ctx.baseUrl, '/api/movies', {
        method: 'POST',
        body: {
          title: 'Dup Prereq Film',
          releaseYear: 2024,
          runtimeMinutes: 110,
          prerequisites: [ironMan.id, ironMan.id],
        },
      });
      assert.equal(dupPrereq.status, 400);
      assert.equal(dupPrereq.data.error.code, 'VALIDATION_ERROR');

      // Batch create array
      const batch = await api(ctx.baseUrl, '/api/movies', {
        method: 'POST',
        body: [
          { title: 'Doctor Strange', releaseYear: 2016, runtimeMinutes: 115 },
          { title: 'Black Panther', releaseYear: 2018, runtimeMinutes: 134 },
        ],
      });
      assert.equal(batch.status, 201);
      assert.equal(Array.isArray(batch.data), true);
      assert.equal(batch.data.length, 2);

      // Delete cleans dangling references
      const delRes = await api(ctx.baseUrl, `/api/movies/${ironMan.id}`, {
        method: 'DELETE',
      });
      assert.equal(delRes.status, 200);
      const afterMovies = await api(ctx.baseUrl, '/api/movies');
      const avengersAfter = afterMovies.data.find((m) => m.title === 'The Avengers');
      assert.equal(avengersAfter.prerequisites.includes(ironMan.id), false);
    });
  });

  describe('Feature 2: Cinemas and Watch-Party Booking', () => {
    it('seeds the 4 example cinemas and returns all expected booking quotes', async () => {
      const { status, data: cinemas } = await api(ctx.baseUrl, '/api/cinemas');
      assert.equal(status, 200);
      assert.equal(cinemas.length, 4);

      const findByBundles = (expected) =>
        cinemas.find(
          (c) => JSON.stringify(c.bundleSizes) === JSON.stringify(expected)
        );

      const c134 = findByBundles([1, 3, 4]);
      const c25 = findByBundles([2, 5]);
      const c6920 = findByBundles([6, 9, 20]);
      const c46 = findByBundles([4, 6]);

      assert.ok(c134 && c25 && c6920 && c46);

      // Bundles 1,3,4 / group 6 -> 2 bundles: 3 x 2
      const q1 = await api(ctx.baseUrl, `/api/cinemas/${c134.id}/booking?groupSize=6`);
      assert.equal(q1.status, 200);
      assert.equal(q1.data.possible, true);
      assert.equal(q1.data.totalBundles, 2);
      assert.deepEqual(q1.data.breakdown, [{ size: 3, count: 2 }]);

      // Bundles 2,5 / group 11 -> 4 bundles: 5 x 1, 2 x 3
      const q2 = await api(ctx.baseUrl, `/api/cinemas/${c25.id}/booking?groupSize=11`);
      assert.equal(q2.status, 200);
      assert.equal(q2.data.possible, true);
      assert.equal(q2.data.totalBundles, 4);
      assert.deepEqual(q2.data.breakdown, [
        { size: 5, count: 1 },
        { size: 2, count: 3 },
      ]);

      // Bundles 6,9,20 / group 44 -> 4 bundles: 20 x 1, 9 x 2, 6 x 1
      const q3 = await api(ctx.baseUrl, `/api/cinemas/${c6920.id}/booking?groupSize=44`);
      assert.equal(q3.status, 200);
      assert.equal(q3.data.possible, true);
      assert.equal(q3.data.totalBundles, 4);
      assert.deepEqual(q3.data.breakdown, [
        { size: 20, count: 1 },
        { size: 9, count: 2 },
        { size: 6, count: 1 },
      ]);

      // Bundles 4,6 / group 7 -> HTTP 200 with possible: false
      const q4 = await api(ctx.baseUrl, `/api/cinemas/${c46.id}/booking?groupSize=7`);
      assert.equal(q4.status, 200);
      assert.equal(q4.data.possible, false);
      assert.match(q4.data.message, /7/);
    });

    it('validates cinema creation, duplicates, bundle constraints, and groupSize bounds', async () => {
      // Create cinema (single)
      const created = await api(ctx.baseUrl, '/api/cinemas', {
        method: 'POST',
        body: { name: '  Sanctum Cinema  ', bundleSizes: [10, 4, 2] },
      });
      assert.equal(created.status, 201);
      assert.equal(created.data.name, 'Sanctum Cinema');
      assert.deepEqual(created.data.bundleSizes, [2, 4, 10]);

      // Duplicate cinema name (case-insensitive)
      const dupName = await api(ctx.baseUrl, '/api/cinemas', {
        method: 'POST',
        body: { name: 'sanctum cinema', bundleSizes: [2, 3] },
      });
      assert.equal(dupName.status, 409);
      assert.equal(dupName.data.error.code, 'DUPLICATE_NAME');

      // Duplicate bundle sizes rejected with 400
      const dupBundles = await api(ctx.baseUrl, '/api/cinemas', {
        method: 'POST',
        body: { name: 'Dup Bundle Hall', bundleSizes: [2, 5, 2] },
      });
      assert.equal(dupBundles.status, 400);
      assert.equal(dupBundles.data.error.code, 'VALIDATION_ERROR');

      // Non-integer bundle size rejected with 400
      const floatBundle = await api(ctx.baseUrl, '/api/cinemas', {
        method: 'POST',
        body: { name: 'Float Bundle Hall', bundleSizes: [2.5, 4] },
      });
      assert.equal(floatBundle.status, 400);
      assert.equal(floatBundle.data.error.code, 'VALIDATION_ERROR');

      // Out-of-range bundle size (>500)
      const hugeBundle = await api(ctx.baseUrl, '/api/cinemas', {
        method: 'POST',
        body: { name: 'Huge Bundle Hall', bundleSizes: [501] },
      });
      assert.equal(hugeBundle.status, 400);
      assert.equal(hugeBundle.data.error.code, 'VALIDATION_ERROR');

      // Too many bundle sizes (>10)
      const tooMany = await api(ctx.baseUrl, '/api/cinemas', {
        method: 'POST',
        body: {
          name: 'Too Many Bundles',
          bundleSizes: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
        },
      });
      assert.equal(tooMany.status, 400);
      assert.equal(tooMany.data.error.code, 'VALIDATION_ERROR');

      // Invalid groupSize values
      for (const bad of ['0', '-5', '10001', '6.5', 'abc', '']) {
        const res = await api(
          ctx.baseUrl,
          `/api/cinemas/${created.data.id}/booking?groupSize=${encodeURIComponent(bad)}`
        );
        assert.equal(res.status, 400, `Expected 400 for groupSize=${bad}`);
        assert.equal(res.data.error.code, 'VALIDATION_ERROR');
      }

      // Batch create cinemas
      const batch = await api(ctx.baseUrl, '/api/cinemas', {
        method: 'POST',
        body: [
          { name: 'Batch Hall A', bundleSizes: [1, 5] },
          { name: 'Batch Hall B', bundleSizes: [3, 7] },
        ],
      });
      assert.equal(batch.status, 201);
      assert.equal(batch.data.length, 2);
    });
  });
});
