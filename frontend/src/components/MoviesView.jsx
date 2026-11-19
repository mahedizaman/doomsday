import React, { useMemo, useState } from 'react';
import { api, formatFriendlyError } from '../api/client.js';
import { formatRuntime } from '../utils/formatters.js';

export default function MoviesView({ movies, loading, error, onRefresh, onMoviesChange }) {
  const [title, setTitle] = useState('');
  const [releaseYear, setReleaseYear] = useState('2025');
  const [runtimeMinutes, setRuntimeMinutes] = useState('135');
  const [selectedPrereqs, setSelectedPrereqs] = useState([]);
  const [watched, setWatched] = useState(false);

  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [busyMovieId, setBusyMovieId] = useState(null);
  const [actionError, setActionError] = useState('');

  // Prerequisite editor modal state
  const [editingMovie, setEditingMovie] = useState(null);
  const [editingPrereqs, setEditingPrereqs] = useState([]);
  const [editError, setEditError] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const moviesById = useMemo(() => {
    const map = new Map();
    for (const m of movies) {
      map.set(m.id, m);
    }
    return map;
  }, [movies]);

  function toggleFormPrereq(id) {
    setSelectedPrereqs((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  function toggleEditPrereq(id) {
    setEditingPrereqs((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  async function handleCreateMovie(e) {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    const trimmedTitle = title.trim();
    const yearNum = Number(releaseYear);
    const runtimeNum = Number(runtimeMinutes);

    if (!trimmedTitle) {
      setFormError('Please enter a movie title.');
      return;
    }
    if (!Number.isInteger(yearNum) || yearNum < 1888 || yearNum > 2100) {
      setFormError('Release year must be a whole number between 1888 and 2100.');
      return;
    }
    if (!Number.isInteger(runtimeNum) || runtimeNum < 1 || runtimeNum > 300) {
      setFormError('Runtime must be a whole number between 1 and 300 minutes.');
      return;
    }

    setSubmitting(true);
    try {
      const created = await api.createMovie({
        title: trimmedTitle,
        releaseYear: yearNum,
        runtimeMinutes: runtimeNum,
        prerequisites: selectedPrereqs,
        watched,
      });
      setTitle('');
      setReleaseYear('2025');
      setRuntimeMinutes('135');
      setSelectedPrereqs([]);
      setWatched(false);
      setFormSuccess(`Added "${created.title}" to the MCU library.`);
      await onRefresh();
    } catch (err) {
      setFormError(formatFriendlyError(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleWatched(movie) {
    setActionError('');
    setBusyMovieId(movie.id);
    try {
      const updated = await api.updateMovie(movie.id, { watched: !movie.watched });
      onMoviesChange((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
    } catch (err) {
      setActionError(formatFriendlyError(err));
    } finally {
      setBusyMovieId(null);
    }
  }

  function openPrereqEditor(movie) {
    setEditingMovie(movie);
    setEditingPrereqs([...movie.prerequisites]);
    setEditError('');
  }

  function closePrereqEditor() {
    setEditingMovie(null);
    setEditingPrereqs([]);
    setEditError('');
  }

  async function handleSavePrerequisites(e) {
    e.preventDefault();
    if (!editingMovie) return;

    setEditError('');
    setSavingEdit(true);
    try {
      const updated = await api.updateMovie(editingMovie.id, {
        prerequisites: editingPrereqs,
      });
      onMoviesChange((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
      closePrereqEditor();
    } catch (err) {
      setEditError(formatFriendlyError(err));
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleDeleteMovie(movie) {
    setActionError('');
    setBusyMovieId(movie.id);
    try {
      await api.deleteMovie(movie.id);
      await onRefresh();
    } catch (err) {
      setActionError(formatFriendlyError(err));
    } finally {
      setBusyMovieId(null);
    }
  }

  const watchedCount = movies.filter((m) => m.watched).length;

  return (
    <div className="view-grid">
      {/* Add Movie Form Panel */}
      <section className="card">
        <div className="card-header">
          <h2>Add a Movie</h2>
          <p className="muted">
            Expand the MCU timeline with prerequisites and watch status.
          </p>
        </div>

        <form className="form-stack" onSubmit={handleCreateMovie} noValidate>
          <div className="field">
            <label htmlFor="movie-title">Movie Title</label>
            <input
              id="movie-title"
              type="text"
              placeholder="e.g. Doctor Strange"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={submitting}
              required
            />
          </div>

          <div className="field-row">
            <div className="field">
              <label htmlFor="movie-year">Release Year</label>
              <input
                id="movie-year"
                type="number"
                min="1888"
                max="2100"
                value={releaseYear}
                onChange={(e) => setReleaseYear(e.target.value)}
                disabled={submitting}
                required
              />
            </div>

            <div className="field">
              <label htmlFor="movie-runtime">Runtime (min)</label>
              <input
                id="movie-runtime"
                type="number"
                min="1"
                max="300"
                value={runtimeMinutes}
                onChange={(e) => setRuntimeMinutes(e.target.value)}
                disabled={submitting}
                required
              />
            </div>
          </div>

          <div className="field">
            <label>Prerequisites (optional)</label>
            {movies.length === 0 ? (
              <p className="muted small">Add your first movie to link prerequisites.</p>
            ) : (
              <div className="checklist-box" role="group" aria-label="Select prerequisites">
                {movies.map((m) => (
                  <label key={m.id} className="check-option">
                    <input
                      type="checkbox"
                      checked={selectedPrereqs.includes(m.id)}
                      onChange={() => toggleFormPrereq(m.id)}
                      disabled={submitting}
                    />
                    <span>
                      {m.title} <span className="muted">({m.releaseYear})</span>
                    </span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <label className="check-option standalone">
            <input
              type="checkbox"
              checked={watched}
              onChange={(e) => setWatched(e.target.checked)}
              disabled={submitting}
            />
            <span>Already watched</span>
          </label>

          {formError && (
            <div className="alert alert-error" role="alert">
              {formError}
            </div>
          )}

          {formSuccess && (
            <div className="alert alert-success" role="status">
              {formSuccess}
            </div>
          )}

          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Adding Movie...' : 'Add Movie'}
          </button>
        </form>
      </section>

      {/* Movie Library List */}
      <section className="card">
        <div className="card-header card-header-row">
          <div>
            <h2>MCU Movie Library</h2>
            <p className="muted">
              {movies.length} {movies.length === 1 ? 'movie' : 'movies'} &bull;{' '}
              {watchedCount} watched
            </p>
          </div>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onRefresh}
            disabled={loading}
          >
            Refresh
          </button>
        </div>

        {actionError && (
          <div className="alert alert-error" role="alert">
            {actionError}
          </div>
        )}

        {loading && movies.length === 0 ? (
          <div className="state-box">
            <div className="spinner" aria-hidden="true" />
            <p>Loading movies...</p>
          </div>
        ) : error ? (
          <div className="alert alert-error" role="alert">
            {error}
          </div>
        ) : movies.length === 0 ? (
          <div className="state-box">
            <p className="state-title">No movies yet</p>
            <p className="muted">Use the form on the left to add your first MCU movie.</p>
          </div>
        ) : (
          <ul className="movie-list">
            {movies.map((movie) => {
              const isBusy = busyMovieId === movie.id;
              const prereqTitles = movie.prerequisites
                .map((pid) => moviesById.get(pid)?.title)
                .filter(Boolean);

              return (
                <li
                  key={movie.id}
                  className={`movie-item ${movie.watched ? 'is-watched' : ''}`}
                >
                  <div className="movie-main">
                    <label className="watched-toggle" title="Toggle watched status">
                      <input
                        type="checkbox"
                        checked={movie.watched}
                        onChange={() => handleToggleWatched(movie)}
                        disabled={isBusy}
                        aria-label={`Mark ${movie.title} as watched`}
                      />
                      <span className="checkmark" />
                    </label>

                    <div className="movie-info">
                      <div className="movie-title-row">
                        <h3>{movie.title}</h3>
                        {movie.watched && <span className="badge badge-watched">Watched</span>}
                      </div>

                      <div className="movie-meta">
                        <span>{movie.releaseYear}</span>
                        <span>&bull;</span>
                        <span>
                          {movie.runtimeMinutes}m ({formatRuntime(movie.runtimeMinutes)})
                        </span>
                      </div>

                      <div className="prereq-row">
                        <span className="prereq-label">Prerequisites:</span>
                        {prereqTitles.length === 0 ? (
                          <span className="muted small">None</span>
                        ) : (
                          <div className="chip-list">
                            {prereqTitles.map((pt) => (
                              <span key={pt} className="chip">
                                {pt}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="movie-actions">
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => openPrereqEditor(movie)}
                      disabled={isBusy}
                    >
                      Edit Prerequisites
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger-ghost btn-sm"
                      onClick={() => handleDeleteMovie(movie)}
                      disabled={isBusy}
                      aria-label={`Delete ${movie.title}`}
                    >
                      Delete
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Edit Prerequisites Modal */}
      {editingMovie && (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-prereq-heading"
        >
          <div className="modal-card">
            <div className="modal-header">
              <div>
                <h2 id="edit-prereq-heading">Edit Prerequisites</h2>
                <p className="muted">
                  Choose which movies must be watched before{' '}
                  <strong>{editingMovie.title}</strong>.
                </p>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={closePrereqEditor}
                disabled={savingEdit}
              >
                Close
              </button>
            </div>

            <form className="form-stack" onSubmit={handleSavePrerequisites}>
              <div className="checklist-box modal-checklist">
                {movies
                  .filter((m) => m.id !== editingMovie.id)
                  .map((m) => (
                    <label key={m.id} className="check-option">
                      <input
                        type="checkbox"
                        checked={editingPrereqs.includes(m.id)}
                        onChange={() => toggleEditPrereq(m.id)}
                        disabled={savingEdit}
                      />
                      <span>
                        {m.title} <span className="muted">({m.releaseYear})</span>
                      </span>
                    </label>
                  ))}
              </div>

              {editError && (
                <div className="alert alert-error" role="alert">
                  {editError}
                </div>
              )}

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={closePrereqEditor}
                  disabled={savingEdit}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={savingEdit}>
                  {savingEdit ? 'Saving...' : 'Save Prerequisites'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
