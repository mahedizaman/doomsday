import React, { useCallback, useEffect, useState } from 'react';
import { api, formatFriendlyError } from './api/client.js';
import MoviesView from './components/MoviesView.jsx';
import RewatchPlanView from './components/RewatchPlanView.jsx';
import BookingView from './components/BookingView.jsx';

const TABS = [
  { id: 'movies', label: 'Movies' },
  { id: 'rewatch', label: 'Rewatch Plan' },
  { id: 'booking', label: 'Booking' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState('movies');

  const [movies, setMovies] = useState([]);
  const [loadingMovies, setLoadingMovies] = useState(true);
  const [moviesError, setMoviesError] = useState('');

  const [cinemas, setCinemas] = useState([]);
  const [loadingCinemas, setLoadingCinemas] = useState(true);
  const [cinemasError, setCinemasError] = useState('');

  const loadMovies = useCallback(async () => {
    setLoadingMovies(true);
    setMoviesError('');
    try {
      const data = await api.getMovies();
      setMovies(data);
    } catch (err) {
      setMoviesError(formatFriendlyError(err));
    } finally {
      setLoadingMovies(false);
    }
  }, []);

  const loadCinemas = useCallback(async () => {
    setLoadingCinemas(true);
    setCinemasError('');
    try {
      const data = await api.getCinemas();
      setCinemas(data);
    } catch (err) {
      setCinemasError(formatFriendlyError(err));
    } finally {
      setLoadingCinemas(false);
    }
  }, []);

  useEffect(() => {
    loadMovies();
    loadCinemas();
  }, [loadMovies, loadCinemas]);

  function handleMovieWatchedUpdated(updatedMovie) {
    setMovies((prev) =>
      prev.map((m) => (m.id === updatedMovie.id ? updatedMovie : m))
    );
  }

  return (
    <div className="app-shell">
      <header className="top-header">
        <div className="header-inner">
          <div className="brand">
            <span className="brand-emblem" aria-hidden="true">
              D
            </span>
            <div>
              <h1>Doomsday Ready</h1>
              <p className="brand-sub">
                MCU Rewatch Planner &amp; Opening-Night Watch Party Booking
              </p>
            </div>
          </div>

          <nav className="top-nav" aria-label="Main navigation">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                className={`nav-tab ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
                aria-current={activeTab === tab.id ? 'page' : undefined}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="main-container">
        {activeTab === 'movies' && (
          <MoviesView
            movies={movies}
            loading={loadingMovies}
            error={moviesError}
            onRefresh={loadMovies}
            onMoviesChange={setMovies}
          />
        )}

        {activeTab === 'rewatch' && (
          <RewatchPlanView
            movies={movies}
            loadingMovies={loadingMovies}
            onMovieWatchedUpdated={handleMovieWatchedUpdated}
          />
        )}

        {activeTab === 'booking' && (
          <BookingView
            cinemas={cinemas}
            loadingCinemas={loadingCinemas}
            errorCinemas={cinemasError}
            onRefreshCinemas={loadCinemas}
          />
        )}
      </main>

      <footer className="app-footer">
        <span>Doomsday Ready &bull; Built for Avengers: Doomsday opening night</span>
      </footer>
    </div>
  );
}
