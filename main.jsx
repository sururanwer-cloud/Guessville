import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSnow,
  Droplets,
  LocateFixed,
  MapPin,
  Search,
  Star,
  Trash2,
  Sun,
  ThermometerSun,
  Wind,
} from "lucide-react";
import "./styles.css";

const API_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:3001";
const DEFAULT_LOCATION = {
  id: 1275339,
  name: "Mumbai",
  region: "Maharashtra",
  country: "India",
  latitude: 19.076,
  longitude: 72.8777,
  timezone: "Asia/Kolkata",
};

function App() {
  const [query, setQuery] = useState("");
  const [locations, setLocations] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(() => {
    const saved = localStorage.getItem("weatherapp:location");
    return saved ? JSON.parse(saved) : DEFAULT_LOCATION;
  });
  const [weather, setWeather] = useState(null);
  const [savedLocations, setSavedLocations] = useState([]);
  const [recentSearches, setRecentSearches] = useState([]);
  const [loadingWeather, setLoadingWeather] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    loadDatabaseState();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadWeather(selectedLocation, controller.signal);
    localStorage.setItem("weatherapp:location", JSON.stringify(selectedLocation));
    return () => controller.abort();
  }, [selectedLocation]);

  useEffect(() => {
    if (query.trim().length < 2) {
      setLocations([]);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setSearching(true);
      try {
        const response = await fetch(`${API_URL}/api/search?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Location search failed.");
        }

        setLocations(data.locations || []);
        loadDatabaseState();
      } catch (err) {
        if (err.name !== "AbortError") {
          setLocations([]);
        }
      } finally {
        setSearching(false);
      }
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [query]);

  async function loadWeather(location, signal) {
    setLoadingWeather(true);
    setError("");

    try {
      const params = new URLSearchParams({
        lat: String(location.latitude),
        lon: String(location.longitude),
        timezone: location.timezone || "auto",
      });
      const response = await fetch(`${API_URL}/api/weather?${params.toString()}`, { signal });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Weather lookup failed.");
      }

      setWeather(data);
    } catch (err) {
      if (err.name !== "AbortError") {
        setWeather(null);
        setError(err.message);
      }
    } finally {
      setLoadingWeather(false);
    }
  }

  async function loadDatabaseState() {
    try {
      const [savedResponse, recentResponse] = await Promise.all([
        fetch(`${API_URL}/api/saved-locations`),
        fetch(`${API_URL}/api/recent-searches`),
      ]);
      const [savedData, recentData] = await Promise.all([savedResponse.json(), recentResponse.json()]);
      setSavedLocations(savedData.locations || []);
      setRecentSearches(recentData.searches || []);
    } catch {
      setSavedLocations([]);
      setRecentSearches([]);
    }
  }

  async function saveSelectedLocation() {
    try {
      const response = await fetch(`${API_URL}/api/saved-locations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(selectedLocation),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not save location.");
      }

      setSavedLocations(data.locations || []);
    } catch (err) {
      setError(err.message);
    }
  }

  async function removeSavedLocation(id) {
    try {
      const response = await fetch(`${API_URL}/api/saved-locations/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const data = await response.json();
      setSavedLocations(data.locations || []);
    } catch {
      setError("Could not remove saved location.");
    }
  }

  function useCurrentPosition() {
    if (!navigator.geolocation) {
      setError("Your browser does not support geolocation.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setSelectedLocation({
          id: "current",
          name: "Current location",
          region: "",
          country: "",
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        });
        setQuery("");
        setLocations([]);
      },
      () => setError("Location permission was not granted.")
    );
  }

  const currentSummary = useMemo(() => describeWeather(weather?.current?.weatherCode), [weather]);

  return (
    <main className="app-shell">
      <section className="weather-hero">
        <div className="hero-copy">
          <p className="eyebrow">Full stack weather dashboard</p>
          <h1>WeatherApp</h1>
          <p className="hero-text">
            Search any city, save your last place, and get live conditions plus a seven-day forecast.
          </p>
        </div>

        <div className="search-panel">
          <div className="search-row">
            <Search size={20} aria-hidden="true" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search city or place"
              aria-label="Search city or place"
            />
            <button type="button" className="icon-button" onClick={useCurrentPosition} aria-label="Use current location">
              <LocateFixed size={20} />
            </button>
          </div>

          <div className="quick-actions">
            <button type="button" onClick={saveSelectedLocation}>
              <Star size={17} />
              Save this place
            </button>
          </div>

          {(query.trim().length >= 2 || searching) && (
            <div className="results-list">
              {searching && <p className="muted">Searching...</p>}
              {!searching && locations.length === 0 && <p className="muted">No matching places found.</p>}
              {locations.map((location) => (
                <button
                  type="button"
                  key={`${location.id}-${location.latitude}-${location.longitude}`}
                  onClick={() => {
                    setSelectedLocation(location);
                    setQuery("");
                    setLocations([]);
                  }}
                >
                  <MapPin size={18} aria-hidden="true" />
                  <span>
                    <strong>{location.name}</strong>
                    <small>{formatPlace(location)}</small>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {error && <div className="error-banner">{error}</div>}

      <section className="database-grid">
        <article>
          <div className="section-heading compact">
            <h2>Saved places</h2>
            <p>Stored in the backend database.</p>
          </div>
          <div className="chip-list">
            {savedLocations.length === 0 && <span className="empty-chip">No saved places yet</span>}
            {savedLocations.map((location) => (
              <button
                className="location-chip"
                type="button"
                key={location.id}
                onClick={() => setSelectedLocation(location)}
              >
                <span>{formatPlace(location)}</span>
                <Trash2
                  size={16}
                  onClick={(event) => {
                    event.stopPropagation();
                    removeSavedLocation(location.id);
                  }}
                />
              </button>
            ))}
          </div>
        </article>

        <article>
          <div className="section-heading compact">
            <h2>Recent searches</h2>
            <p>Also persisted by the server.</p>
          </div>
          <div className="chip-list">
            {recentSearches.length === 0 && <span className="empty-chip">Search history will appear here</span>}
            {recentSearches.map((search) => (
              <button className="search-chip" type="button" key={search.searchedAt} onClick={() => setQuery(search.query)}>
                {search.query}
              </button>
            ))}
          </div>
        </article>
      </section>

      <section className="current-grid">
        <article className="current-card">
          {loadingWeather ? (
            <div className="skeleton-block" />
          ) : (
            <>
              <div className="place-line">
                <MapPin size={18} />
                <span>{formatPlace(selectedLocation)}</span>
              </div>
              <div className="current-main">
                <WeatherIcon code={weather?.current?.weatherCode} size={72} />
                <div>
                  <p className="temperature">{Math.round(weather?.current?.temperature ?? 0)}&deg;</p>
                  <p className="condition">{currentSummary}</p>
                </div>
              </div>
              <p className="updated">Updated {formatDateTime(weather?.current?.time)}</p>
            </>
          )}
        </article>

        <MetricCard
          icon={<ThermometerSun />}
          label="Feels like"
          value={`${Math.round(weather?.current?.apparentTemperature ?? 0)}&deg;`}
          loading={loadingWeather}
        />
        <MetricCard
          icon={<Droplets />}
          label="Humidity"
          value={`${weather?.current?.humidity ?? 0}%`}
          loading={loadingWeather}
        />
        <MetricCard
          icon={<Wind />}
          label="Wind"
          value={`${Math.round(weather?.current?.windSpeed ?? 0)} ${weather?.units?.windSpeed || "km/h"}`}
          loading={loadingWeather}
        />
      </section>

      <section className="forecast-section">
        <div className="section-heading">
          <h2>Next 24 hours</h2>
          <p>Temperature, rain chance, and wind at a glance.</p>
        </div>
        <div className="hourly-strip">
          {(weather?.hourly || []).map((hour) => (
            <article className="hour-card" key={hour.time}>
              <span>{formatHour(hour.time)}</span>
              <WeatherIcon code={hour.weatherCode} size={28} />
              <strong>{Math.round(hour.temperature)}&deg;</strong>
              <small>{hour.precipitationProbability ?? 0}% rain</small>
            </article>
          ))}
        </div>
      </section>

      <section className="forecast-section">
        <div className="section-heading">
          <h2>7-day forecast</h2>
          <p>Daily highs, lows, rain chances, and daylight times.</p>
        </div>
        <div className="daily-list">
          {(weather?.daily || []).map((day) => (
            <article className="daily-row" key={day.date}>
              <div>
                <strong>{formatDay(day.date)}</strong>
                <small>{describeWeather(day.weatherCode)}</small>
              </div>
              <WeatherIcon code={day.weatherCode} size={34} />
              <div className="range">
                <span>{Math.round(day.low)}&deg;</span>
                <div className="range-bar">
                  <span style={{ width: `${rangeWidth(day.low, day.high)}%` }} />
                </div>
                <span>{Math.round(day.high)}&deg;</span>
              </div>
              <div className="daily-extra">
                <span>{day.precipitationProbability ?? 0}% rain</span>
                <span>{formatHour(day.sunrise)} sunrise</span>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

function MetricCard({ icon, label, value, loading }) {
  return (
    <article className="metric-card">
      {loading ? (
        <div className="skeleton-block small" />
      ) : (
        <>
          <div className="metric-icon">{icon}</div>
          <span>{label}</span>
          <strong>{value}</strong>
        </>
      )}
    </article>
  );
}

function WeatherIcon({ code, size = 32 }) {
  const Icon = iconForCode(code);
  return <Icon size={size} strokeWidth={1.8} aria-hidden="true" />;
}

function iconForCode(code = 0) {
  if ([0, 1].includes(code)) return Sun;
  if ([2, 3].includes(code)) return Cloud;
  if ([45, 48].includes(code)) return CloudFog;
  if ([51, 53, 55, 56, 57].includes(code)) return CloudDrizzle;
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return CloudRain;
  if ([71, 73, 75, 77, 85, 86].includes(code)) return CloudSnow;
  if ([95, 96, 99].includes(code)) return CloudLightning;
  return Cloud;
}

function describeWeather(code = 0) {
  const descriptions = {
    0: "Clear sky",
    1: "Mostly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Fog",
    48: "Rime fog",
    51: "Light drizzle",
    53: "Drizzle",
    55: "Dense drizzle",
    61: "Light rain",
    63: "Rain",
    65: "Heavy rain",
    71: "Light snow",
    73: "Snow",
    75: "Heavy snow",
    80: "Rain showers",
    81: "Rain showers",
    82: "Heavy showers",
    95: "Thunderstorm",
    96: "Thunderstorm with hail",
    99: "Severe thunderstorm",
  };
  return descriptions[code] || "Mixed conditions";
}

function formatPlace(location) {
  return [location.name, location.region, location.country].filter(Boolean).join(", ");
}

function formatDateTime(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatHour(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
  }).format(new Date(value));
}

function formatDay(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function rangeWidth(low, high) {
  const width = Math.max(18, Math.min(100, (Number(high) - Number(low)) * 8));
  return Number.isFinite(width) ? width : 35;
}

createRoot(document.getElementById("root")).render(<App />);
