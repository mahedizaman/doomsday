import React, { useCallback, useEffect, useState } from 'react';
import { api, formatFriendlyError } from '../api/client.js';
import { formatRuntime } from '../utils/formatters.js';

export default function RewatchPlanView({ movies, loadingMovies, onMovieWatchedUpdated }) {
  const [targetId, setTargetId] = useState('');
  const [plan, setPlan] = useState(null);
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [planError, setPlanError] = useState('');
  const [updatingMovieId, setUpdatingMovieId] = useState(null);

  // Pick Avengers: Doomsday by default when movies first load.
  useEffect(() => {
    if (movies.length === 0) {
      setTargetId('');
      setPlan(null);
      return;
    }

    const stillExists = movies.some((m) => m.id === targetId);
    if (!stillExists) {
      const doomsday = movies.find((m) => m.title.toLowerCase() === 'avengers: doomsday');
      setTargetId(doomsday ? doomsday.id : movies[0].id);
    }
  }, [movies, targetId]);

  const fetchPlan = useCallback(async (movieId) => {
    if (!movieId) return;
    setLoadingPlan(true);
    setPlanError('');
    try {
      const data = await api.getRewatchOrder(movieId);
      setPlan(data);
    } catch (err) {
      setPlanError(formatFriendlyError(err));
      setPlan(null);
    } finally {
      setLoadingPlan(false);
    }
  }, []);

  useEffect(() => {
    if (targetId) {
      fetchPlan(targetId);
    }
  }, [targetId, fetchPlan]);

  async function handleToggleWatched(item) {
    setUpdatingMovieId(item.id);
    setPlanError('');
    try {
      const updated = await api.updateMovie(item.id, { watched: !item.watched });
      onMovieWatchedUpdated(updated);
      await fetchPlan(targetId);
    } catch (err) {
      setPlanError(formatFriendlyError(err));
    } finally {
      setUpdatingMovieId(null);
    }
  }

  if (loadingMovies && movies.length === 0) {
    return (
      <section className="card">
        <div className="state-box">
          <div className="spinner" aria-hidden="true" />
          <p>Loading movies...</p>
        </div>
      </section>
    );
  }

  if (movies.length === 0) {
    return (
      <section className="card">
        <div className="state-box">
          <p className="state-title">No movies available</p>
          <p className="muted">
            Add movies in the Movies tab first to generate a rewatch plan.
          </p>
        </div>
      </section>
    );
  }

  const progressPct =
    plan && plan.totalCount > 0
      ? Math.round((plan.watchedCount / plan.totalCount) * 100)
      : 100;

  return (
    <div className="single-column">
      <section className="card">
        <div className="card-header">
          <h2>Rewatch Plan Generator</h2>
          <p className="muted">
            Select your target film to get the exact prerequisite watch order.
          </p>
        </div>

        <div className="planner-controls">
          <div className="field planner-select">
            <label htmlFor="target-movie-select">Target Movie</label>
            <select
              id="target-movie-select"
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
            >
              {movies.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title} ({m.releaseYear})
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => fetchPlan(targetId)}
            disabled={loadingPlan || !targetId}
          >
            Refresh Plan
          </button>
        </div>

        {planError && (
          <div className="alert alert-error" role="alert">
            {planError}
          </div>
        )}

        {loadingPlan && !plan ? (
          <div className="state-box">
            <div className="spinner" aria-hidden="true" />
            <p>Computing topological rewatch order...</p>
          </div>
        ) : plan ? (
          <div className="plan-content">
            {/* Summary Stats + Progress Bar */}
            <div className="plan-summary">
              <div className="summary-stats">
                <div className="stat-box">
                  <span className="stat-label">Progress</span>
                  <span className="stat-value">
                    {plan.watchedCount} of {plan.totalCount} watched
                  </span>
                </div>

                <div className="stat-box">
                  <span className="stat-label">Remaining Watch Time</span>
                  <span className="stat-value highlight">
                    {formatRuntime(plan.remainingRuntimeMinutes)}
                  </span>
                </div>
              </div>

              {plan.totalCount > 0 && (
                <div className="progress-wrapper">
                  <div
                    className="progress-track"
                    role="progressbar"
                    aria-valuenow={progressPct}
                    aria-valuemin="0"
                    aria-valuemax="100"
                    aria-label="Rewatch completion progress"
                  >
                    <div
                      className="progress-fill"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                  <span className="progress-pct">{progressPct}%</span>
                </div>
              )}
            </div>

            {/* Ordered List or Empty State */}
            {plan.order.length === 0 ? (
              <div className="state-box state-ready">
                <p className="state-title">No prerequisites required!</p>
                <p className="muted">
                  <strong>{plan.target.title}</strong> stands on its own — you can jump
                  straight in without rewatching any earlier movies.
                </p>
              </div>
            ) : (
              <ol className="rewatch-list">
                {plan.order.map((movie, index) => {
                  const isBusy = updatingMovieId === movie.id;
                  return (
                    <li
                      key={movie.id}
                      className={`rewatch-item ${movie.watched ? 'is-watched' : ''}`}
                    >
                      <span className="step-number">{index + 1}</span>

                      <label className="watched-toggle">
                        <input
                          type="checkbox"
                          checked={movie.watched}
                          onChange={() => handleToggleWatched(movie)}
                          disabled={isBusy}
                          aria-label={`Mark ${movie.title} as watched`}
                        />
                        <span className="checkmark" />
                      </label>

                      <div className="rewatch-info">
                        <h3>{movie.title}</h3>
                        <p className="muted small">
                          {movie.releaseYear} &bull; {formatRuntime(movie.runtimeMinutes)} (
                          {movie.runtimeMinutes} min)
                        </p>
                      </div>

                      <span
                        className={`badge ${
                          movie.watched ? 'badge-watched' : 'badge-pending'
                        }`}
                      >
                        {movie.watched ? 'Watched' : 'To Watch'}
                      </span>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        ) : null}
      </section>
    </div>
  );
}
