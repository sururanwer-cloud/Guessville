import "dotenv/config";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  addRecentSearch,
  checkDatabaseConnection,
  deleteLocation,
  getRecentSearches,
  getSavedLocations,
  saveLocation,
} from "./database.js";

const PORT = process.env.PORT || 3001;
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || "http://localhost:5173";
const OPEN_METEO_BASE = "https://api.open-meteo.com/v1/forecast";
const GEOCODING_BASE = "https://geocoding-api.open-meteo.com/v1/search";

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.resolve(__dirname, "../dist");

app.use(express.json());
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", CLIENT_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "weather-api" });
});

app.get("/api/db/health", async (_req, res) => {
  try {
    res.json(await checkDatabaseConnection());
  } catch (error) {
    res.status(503).json({ ok: false, error: error.message });
  }
});

app.get("/api/search", async (req, res) => {
  const query = String(req.query.q || "").trim();

  if (query.length < 2) {
    res.status(400).json({ error: "Search needs at least 2 characters." });
    return;
  }

  try {
    await addRecentSearch(query);
    const data = await getJson(GEOCODING_BASE, {
      name: query,
      count: "8",
      language: "en",
      format: "json",
    });

    const locations = (data.results || []).map((place) => ({
      id: place.id,
      name: place.name,
      region: place.admin1 || "",
      country: place.country || "",
      latitude: place.latitude,
      longitude: place.longitude,
      timezone: place.timezone,
    }));

    res.json({ locations });
  } catch (error) {
    console.error("Location search failed:", error);
    res.status(502).json({ error: "Unable to search locations right now." });
  }
});

app.get("/api/recent-searches", async (_req, res) => {
  try {
    res.json({ searches: await getRecentSearches() });
  } catch (error) {
    res.status(503).json({ error: error.message });
  }
});

app.get("/api/saved-locations", async (_req, res) => {
  try {
    res.json({ locations: await getSavedLocations() });
  } catch (error) {
    res.status(503).json({ error: error.message });
  }
});

app.post("/api/saved-locations", async (req, res) => {
  try {
    const locations = await saveLocation(req.body);
    res.status(201).json({ locations });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete("/api/saved-locations/:id", async (req, res) => {
  try {
    const locations = await deleteLocation(req.params.id);
    res.json({ locations });
  } catch (error) {
    res.status(503).json({ error: error.message });
  }
});

app.get("/api/weather", async (req, res) => {
  const latitude = Number(req.query.lat);
  const longitude = Number(req.query.lon);
  const timezone = String(req.query.timezone || "auto");

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    res.status(400).json({ error: "Valid lat and lon query parameters are required." });
    return;
  }

  try {
    const data = await getJson(OPEN_METEO_BASE, {
      latitude: String(latitude),
      longitude: String(longitude),
      timezone,
      forecast_days: "7",
      current: [
        "temperature_2m",
        "relative_humidity_2m",
        "apparent_temperature",
        "is_day",
        "precipitation",
        "weather_code",
        "wind_speed_10m",
      ].join(","),
      hourly: [
        "temperature_2m",
        "precipitation_probability",
        "weather_code",
        "wind_speed_10m",
      ].join(","),
      daily: [
        "weather_code",
        "temperature_2m_max",
        "temperature_2m_min",
        "precipitation_probability_max",
        "wind_speed_10m_max",
        "sunrise",
        "sunset",
      ].join(","),
    });

    res.json(normalizeWeather(data));
  } catch (error) {
    console.error("Weather lookup failed:", error);
    res.status(502).json({ error: "Unable to load weather right now." });
  }
});

app.use(express.static(distPath));
app.get(/.*/, (_req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Weather API running on http://localhost:${PORT}`);
});

async function getJson(url, params) {
  const searchParams = new URLSearchParams(params);
  const response = await fetch(`${url}?${searchParams.toString()}`);

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }

  return response.json();
}

function normalizeWeather(data) {
  const daily = data.daily || {};
  const hourly = data.hourly || {};
  const nextHours = (hourly.time || []).slice(0, 24).map((time, index) => ({
    time,
    temperature: hourly.temperature_2m?.[index],
    precipitationProbability: hourly.precipitation_probability?.[index],
    weatherCode: hourly.weather_code?.[index],
    windSpeed: hourly.wind_speed_10m?.[index],
  }));

  return {
    timezone: data.timezone,
    units: {
      temperature: data.current_units?.temperature_2m || "C",
      windSpeed: data.current_units?.wind_speed_10m || "km/h",
      precipitation: data.current_units?.precipitation || "mm",
    },
    current: {
      time: data.current?.time,
      temperature: data.current?.temperature_2m,
      apparentTemperature: data.current?.apparent_temperature,
      humidity: data.current?.relative_humidity_2m,
      isDay: Boolean(data.current?.is_day),
      precipitation: data.current?.precipitation,
      weatherCode: data.current?.weather_code,
      windSpeed: data.current?.wind_speed_10m,
    },
    hourly: nextHours,
    daily: (daily.time || []).map((date, index) => ({
      date,
      weatherCode: daily.weather_code?.[index],
      high: daily.temperature_2m_max?.[index],
      low: daily.temperature_2m_min?.[index],
      precipitationProbability: daily.precipitation_probability_max?.[index],
      windSpeed: daily.wind_speed_10m_max?.[index],
      sunrise: daily.sunrise?.[index],
      sunset: daily.sunset?.[index],
    })),
  };
}
