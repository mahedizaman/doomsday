import React, { useEffect, useState } from 'react';
import { api, formatFriendlyError } from '../api/client.js';
import { formatBundleSummary } from '../utils/formatters.js';

const PRESET_GROUPS = [6, 7, 11, 44];

export default function BookingView({ cinemas, loadingCinemas, errorCinemas, onRefreshCinemas }) {
  const [selectedCinemaId, setSelectedCinemaId] = useState('');
  const [groupSize, setGroupSize] = useState('11');

  const [quote, setQuote] = useState(null);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [quoteError, setQuoteError] = useState('');

  // Create Cinema form state
  const [cinemaName, setCinemaName] = useState('');
  const [bundleInput, setBundleInput] = useState('');
  const [creatingCinema, setCreatingCinema] = useState(false);
  const [cinemaFormError, setCinemaFormError] = useState('');
  const [cinemaFormSuccess, setCinemaFormSuccess] = useState('');

  useEffect(() => {
    if (cinemas.length === 0) {
      setSelectedCinemaId('');
      setQuote(null);
      return;
    }
    const exists = cinemas.some((c) => c.id === selectedCinemaId);
    if (!exists) {
      setSelectedCinemaId(cinemas[0].id);
    }
  }, [cinemas, selectedCinemaId]);

  const selectedCinema = cinemas.find((c) => c.id === selectedCinemaId) || null;

  async function runBookingQuote(cinemaId, rawSize) {
    setQuoteError('');
    setQuote(null);

    if (!cinemaId) {
      setQuoteError('Please select a cinema first.');
      return;
    }

    const trimmed = String(rawSize).trim();
    if (!/^\d+$/.test(trimmed)) {
      setQuoteError('Group size must be a whole number between 1 and 10,000.');
      return;
    }

    const parsed = Number.parseInt(trimmed, 10);
    if (parsed < 1 || parsed > 10000) {
      setQuoteError('Group size must be between 1 and 10,000.');
      return;
    }

    setLoadingQuote(true);
    try {
      const data = await api.getBookingQuote(cinemaId, parsed);
      setQuote(data);
    } catch (err) {
      setQuoteError(formatFriendlyError(err));
    } finally {
      setLoadingQuote(false);
    }
  }

  function handleBookingSubmit(e) {
    e.preventDefault();
    runBookingQuote(selectedCinemaId, groupSize);
  }

  async function handleCreateCinema(e) {
    e.preventDefault();
    setCinemaFormError('');
    setCinemaFormSuccess('');

    const trimmedName = cinemaName.trim();
    if (!trimmedName) {
      setCinemaFormError('Please enter a cinema name.');
      return;
    }

    const tokens = bundleInput
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    if (tokens.length < 1 || tokens.length > 10) {
      setCinemaFormError('Enter between 1 and 10 comma-separated bundle sizes (e.g. 2, 5, 10).');
      return;
    }

    const parsedSizes = [];
    const seen = new Set();
    for (const token of tokens) {
      if (!/^\d+$/.test(token)) {
        setCinemaFormError(`"${token}" is not a valid positive integer.`);
        return;
      }
      const num = Number.parseInt(token, 10);
      if (num < 1 || num > 500) {
        setCinemaFormError('Each bundle size must be between 1 and 500.');
        return;
      }
      if (seen.has(num)) {
        setCinemaFormError(`Duplicate bundle size ${num} is not allowed.`);
        return;
      }
      seen.add(num);
      parsedSizes.push(num);
    }

    setCreatingCinema(true);
    try {
      const created = await api.createCinema({
        name: trimmedName,
        bundleSizes: parsedSizes,
      });
      setCinemaName('');
      setBundleInput('');
      setCinemaFormSuccess(`Added cinema "${created.name}".`);
      await onRefreshCinemas();
      setSelectedCinemaId(created.id);
      setQuote(null);
    } catch (err) {
      setCinemaFormError(formatFriendlyError(err));
    } finally {
      setCreatingCinema(false);
    }
  }

  return (
    <div className="view-grid">
      {/* Booking Quote Calculator */}
      <section className="card">
        <div className="card-header">
          <h2>Opening-Night Watch Party Booking</h2>
          <p className="muted">
            Find the fewest seat bundles that match your group size with zero empty seats.
          </p>
        </div>

        {loadingCinemas && cinemas.length === 0 ? (
          <div className="state-box">
            <div className="spinner" aria-hidden="true" />
            <p>Loading cinemas...</p>
          </div>
        ) : errorCinemas ? (
          <div className="alert alert-error" role="alert">
            {errorCinemas}
          </div>
        ) : cinemas.length === 0 ? (
          <div className="state-box">
            <p className="state-title">No cinemas available</p>
            <p className="muted">Create a cinema using the form to start calculating bookings.</p>
          </div>
        ) : (
          <>
            <form className="form-stack" onSubmit={handleBookingSubmit} noValidate>
              <div className="field">
                <label htmlFor="cinema-select">Select Cinema</label>
                <select
                  id="cinema-select"
                  value={selectedCinemaId}
                  onChange={(e) => {
                    setSelectedCinemaId(e.target.value);
                    setQuote(null);
                    setQuoteError('');
                  }}
                >
                  {cinemas.map((cinema) => (
                    <option key={cinema.id} value={cinema.id}>
                      {cinema.name} — Bundles: [{cinema.bundleSizes.join(', ')}]
                    </option>
                  ))}
                </select>
              </div>

              {selectedCinema && (
                <div className="selected-bundles">
                  <span className="prereq-label">Available Bundles:</span>
                  <div className="chip-list">
                    {selectedCinema.bundleSizes.map((size) => (
                      <span key={size} className="chip chip-accent">
                        {size} {size === 1 ? 'seat' : 'seats'}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="field">
                <label htmlFor="group-size-input">Group Size (1 – 10,000)</label>
                <div className="input-with-btn">
                  <input
                    id="group-size-input"
                    type="number"
                    min="1"
                    max="10000"
                    value={groupSize}
                    onChange={(e) => setGroupSize(e.target.value)}
                    placeholder="Enter number of fans"
                    disabled={loadingQuote}
                  />
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={loadingQuote}
                  >
                    {loadingQuote ? 'Calculating...' : 'Calculate Bundles'}
                  </button>
                </div>
              </div>

              <div className="preset-row">
                <span className="muted small">Quick test:</span>
                {PRESET_GROUPS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    className="btn btn-ghost btn-xs"
                    onClick={() => {
                      setGroupSize(String(preset));
                      runBookingQuote(selectedCinemaId, preset);
                    }}
                    disabled={loadingQuote}
                  >
                    Group of {preset}
                  </button>
                ))}
              </div>
            </form>

            {quoteError && (
              <div className="alert alert-error" role="alert">
                {quoteError}
              </div>
            )}

            {quote && (
              <div
                className={`quote-result ${
                  quote.possible ? 'quote-possible' : 'quote-impossible'
                }`}
                role="region"
                aria-live="polite"
              >
                {quote.possible ? (
                  <>
                    <div className="quote-badge">Exact Match Found</div>
                    <h3 className="quote-headline">
                      {formatBundleSummary(quote.breakdown, quote.totalBundles)}
                    </h3>
                    <p className="muted small">
                      {quote.cinema.name} &bull; Exactly {quote.groupSize}{' '}
                      {quote.groupSize === 1 ? 'seat' : 'seats'} with zero empty seats.
                    </p>

                    <div className="breakdown-grid">
                      {quote.breakdown.map((item) => (
                        <div key={item.size} className="breakdown-card">
                          <span className="breakdown-size">{item.size}-seat bundle</span>
                          <span className="breakdown-count">&times; {item.count}</span>
                          <span className="muted small">
                            = {item.size * item.count} seats
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="quote-badge quote-badge-error">Not Possible</div>
                    <h3 className="quote-headline">Cannot seat {quote.groupSize} exactly</h3>
                    <p className="quote-message">{quote.message}</p>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </section>

      {/* Add Cinema Panel */}
      <section className="card">
        <div className="card-header">
          <h2>Add a Cinema</h2>
          <p className="muted">
            Register a theater with 1 to 10 unique seat bundle sizes (1–500 each).
          </p>
        </div>

        <form className="form-stack" onSubmit={handleCreateCinema} noValidate>
          <div className="field">
            <label htmlFor="cinema-name-input">Cinema Name</label>
            <input
              id="cinema-name-input"
              type="text"
              placeholder="e.g. Sanctum Dolby Theater"
              value={cinemaName}
              onChange={(e) => setCinemaName(e.target.value)}
              disabled={creatingCinema}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="cinema-bundles-input">
              Bundle Sizes (comma-separated integers)
            </label>
            <input
              id="cinema-bundles-input"
              type="text"
              placeholder="e.g. 2, 5, 10"
              value={bundleInput}
              onChange={(e) => setBundleInput(e.target.value)}
              disabled={creatingCinema}
              required
            />
            <span className="muted small">
              1–10 distinct integers between 1 and 500. Duplicate sizes are rejected.
            </span>
          </div>

          {cinemaFormError && (
            <div className="alert alert-error" role="alert">
              {cinemaFormError}
            </div>
          )}

          {cinemaFormSuccess && (
            <div className="alert alert-success" role="status">
              {cinemaFormSuccess}
            </div>
          )}

          <button type="submit" className="btn btn-secondary" disabled={creatingCinema}>
            {creatingCinema ? 'Creating Cinema...' : 'Add Cinema'}
          </button>
        </form>

        <div className="cinema-directory">
          <h3>Registered Cinemas ({cinemas.length})</h3>
          {cinemas.length === 0 ? (
            <p className="muted small">None registered yet.</p>
          ) : (
            <ul className="cinema-mini-list">
              {cinemas.map((c) => (
                <li
                  key={c.id}
                  className={`cinema-mini-item ${
                    c.id === selectedCinemaId ? 'active' : ''
                  }`}
                >
                  <button
                    type="button"
                    className="cinema-mini-btn"
                    onClick={() => {
                      setSelectedCinemaId(c.id);
                      setQuote(null);
                      setQuoteError('');
                    }}
                  >
                    <span className="cinema-mini-name">{c.name}</span>
                    <span className="muted small">[{c.bundleSizes.join(', ')}]</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
