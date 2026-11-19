import crypto from 'node:crypto';

function generateHexObjectId() {
  return crypto.randomBytes(12).toString('hex');
}

function cloneMovie(movie) {
  return {
    ...movie,
    prerequisites: [...movie.prerequisites],
  };
}

function cloneCinema(cinema) {
  return {
    ...cinema,
    bundleSizes: [...cinema.bundleSizes],
  };
}

/**
 * In-memory Movie repository matching the Mongoose repository contract.
 * Used when running API unit/integration tests without a live MongoDB daemon.
 */
export function createMemoryMovieRepository() {
  const store = new Map();

  return {
    generateId() {
      return generateHexObjectId();
    },

    async findAll() {
      return Array.from(store.values())
        .sort((a, b) => {
          if (a.releaseYear !== b.releaseYear) return a.releaseYear - b.releaseYear;
          return a.title.toLowerCase().localeCompare(b.title.toLowerCase());
        })
        .map(cloneMovie);
    },

    async findById(id) {
      const found = store.get(String(id));
      return found ? cloneMovie(found) : null;
    },

    async findByNormalizedTitle(titleNormalized) {
      for (const movie of store.values()) {
        if (movie.title.toLowerCase() === titleNormalized) {
          return cloneMovie(movie);
        }
      }
      return null;
    },

    async insertMany(items) {
      const now = new Date().toISOString();
      const created = [];
      for (const item of items) {
        const id = item.id ? String(item.id) : generateHexObjectId();
        const record = {
          id,
          title: item.title,
          releaseYear: item.releaseYear,
          runtimeMinutes: item.runtimeMinutes,
          prerequisites: [...(item.prerequisites || [])].map(String),
          watched: Boolean(item.watched),
          createdAt: now,
          updatedAt: now,
        };
        store.set(id, record);
        created.push(cloneMovie(record));
      }
      return created;
    },

    async updateById(id, updates) {
      const existing = store.get(String(id));
      if (!existing) return null;
      const updated = {
        ...existing,
        ...updates,
        prerequisites:
          updates.prerequisites !== undefined
            ? [...updates.prerequisites].map(String)
            : [...existing.prerequisites],
        updatedAt: new Date().toISOString(),
      };
      store.set(String(id), updated);
      return cloneMovie(updated);
    },

    async deleteById(id) {
      const key = String(id);
      if (!store.has(key)) return false;
      store.delete(key);
      for (const movie of store.values()) {
        if (movie.prerequisites.includes(key)) {
          movie.prerequisites = movie.prerequisites.filter((p) => p !== key);
        }
      }
      return true;
    },

    async count() {
      return store.size;
    },
  };
}

/**
 * In-memory Cinema repository matching the Mongoose repository contract.
 */
export function createMemoryCinemaRepository() {
  const store = new Map();

  return {
    async findAll() {
      return Array.from(store.values())
        .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()))
        .map(cloneCinema);
    },

    async findById(id) {
      const found = store.get(String(id));
      return found ? cloneCinema(found) : null;
    },

    async findByNormalizedName(nameNormalized) {
      for (const cinema of store.values()) {
        if (cinema.name.toLowerCase() === nameNormalized) {
          return cloneCinema(cinema);
        }
      }
      return null;
    },

    async insertMany(items) {
      const now = new Date().toISOString();
      const created = [];
      for (const item of items) {
        const id = generateHexObjectId();
        const record = {
          id,
          name: item.name,
          bundleSizes: [...item.bundleSizes],
          createdAt: now,
          updatedAt: now,
        };
        store.set(id, record);
        created.push(cloneCinema(record));
      }
      return created;
    },

    async deleteById(id) {
      return store.delete(String(id));
    },

    async count() {
      return store.size;
    },
  };
}
