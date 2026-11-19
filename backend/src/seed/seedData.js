/**
 * Initial sample dataset for Doomsday Ready.
 * Seeded automatically on first startup only when the corresponding collection is empty.
 */

export const SAMPLE_MOVIES_SPEC = [
  {
    key: 'iron-man',
    title: 'Iron Man',
    releaseYear: 2008,
    runtimeMinutes: 126,
    watched: false,
    prerequisiteKeys: [],
  },
  {
    key: 'first-avenger',
    title: 'Captain America: The First Avenger',
    releaseYear: 2011,
    runtimeMinutes: 124,
    watched: false,
    prerequisiteKeys: [],
  },
  {
    key: 'avengers',
    title: 'The Avengers',
    releaseYear: 2012,
    runtimeMinutes: 143,
    watched: false,
    prerequisiteKeys: ['iron-man', 'first-avenger'],
  },
  {
    key: 'civil-war',
    title: 'Captain America: Civil War',
    releaseYear: 2016,
    runtimeMinutes: 147,
    watched: false,
    prerequisiteKeys: ['avengers'],
  },
  {
    key: 'ragnarok',
    title: 'Thor: Ragnarok',
    releaseYear: 2017,
    runtimeMinutes: 130,
    watched: false,
    prerequisiteKeys: [],
  },
  {
    key: 'infinity-war',
    title: 'Avengers: Infinity War',
    releaseYear: 2018,
    runtimeMinutes: 149,
    watched: false,
    prerequisiteKeys: ['civil-war', 'ragnarok'],
  },
  {
    key: 'endgame',
    title: 'Avengers: Endgame',
    releaseYear: 2019,
    runtimeMinutes: 181,
    watched: false,
    prerequisiteKeys: ['infinity-war'],
  },
  {
    key: 'doomsday',
    title: 'Avengers: Doomsday',
    releaseYear: 2026,
    runtimeMinutes: 160,
    watched: false,
    prerequisiteKeys: ['endgame'],
  },
];

export const SAMPLE_CINEMAS_SPEC = [
  {
    name: 'Stark IMAX Downtown',
    bundleSizes: [1, 3, 4],
  },
  {
    name: 'Quantum Multiplex',
    bundleSizes: [2, 5],
  },
  {
    name: 'Asgard Grand Cinema',
    bundleSizes: [6, 9, 20],
  },
  {
    name: 'Wakanda Royal Screen',
    bundleSizes: [4, 6],
  },
];

export async function seedDatabase(movieRepo, cinemaRepo) {
  let seededMovies = 0;
  let seededCinemas = 0;

  if ((await movieRepo.count()) === 0) {
    const idByKey = new Map();
    for (const spec of SAMPLE_MOVIES_SPEC) {
      idByKey.set(spec.key, movieRepo.generateId());
    }

    const moviesToInsert = SAMPLE_MOVIES_SPEC.map((spec) => ({
      id: idByKey.get(spec.key),
      title: spec.title,
      releaseYear: spec.releaseYear,
      runtimeMinutes: spec.runtimeMinutes,
      watched: spec.watched,
      prerequisites: spec.prerequisiteKeys.map((k) => idByKey.get(k)),
    }));

    await movieRepo.insertMany(moviesToInsert);
    seededMovies = moviesToInsert.length;
  }

  if ((await cinemaRepo.count()) === 0) {
    await cinemaRepo.insertMany(SAMPLE_CINEMAS_SPEC);
    seededCinemas = SAMPLE_CINEMAS_SPEC.length;
  }

  return { seededMovies, seededCinemas };
}
