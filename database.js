import { MongoClient } from "mongodb";

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || "weatheradmin";

let clientPromise;

export async function getSavedLocations() {
  const { savedLocations } = await getCollections();
  return savedLocations.find({}, { projection: { _id: 0 } }).sort({ savedAt: -1 }).limit(12).toArray();
}

export async function saveLocation(location) {
  const { savedLocations } = await getCollections();
  const normalized = normalizeLocation(location);
  const now = new Date();

  await savedLocations.updateOne(
    { id: normalized.id },
    {
      $set: {
        ...normalized,
        updatedAt: now,
      },
      $setOnInsert: {
        savedAt: now,
      },
    },
    { upsert: true }
  );

  return getSavedLocations();
}

export async function deleteLocation(id) {
  const { savedLocations } = await getCollections();
  await savedLocations.deleteOne({ id: String(id) });
  return getSavedLocations();
}

export async function addRecentSearch(query) {
  const { recentSearches } = await getCollections();
  const trimmed = String(query || "").trim();

  if (!trimmed) {
    return getRecentSearches();
  }

  await recentSearches.updateOne(
    { normalizedQuery: trimmed.toLowerCase() },
    {
      $set: {
        query: trimmed,
        normalizedQuery: trimmed.toLowerCase(),
        searchedAt: new Date(),
      },
    },
    { upsert: true }
  );

  return getRecentSearches();
}

export async function getRecentSearches() {
  const { recentSearches } = await getCollections();
  return recentSearches
    .find({}, { projection: { _id: 0, normalizedQuery: 0 } })
    .sort({ searchedAt: -1 })
    .limit(10)
    .toArray();
}

export async function checkDatabaseConnection() {
  const { db } = await getCollections();
  await db.command({ ping: 1 });
  return {
    ok: true,
    provider: "mongodb",
    database: MONGODB_DB_NAME,
  };
}

async function getCollections() {
  if (!MONGODB_URI) {
    throw new Error("Missing MONGODB_URI. Add your MongoDB connection string to .env.");
  }

  const client = await getClient();
  const db = client.db(MONGODB_DB_NAME);
  const savedLocations = db.collection("saved_locations");
  const recentSearches = db.collection("recent_searches");

  await Promise.all([
    savedLocations.createIndex({ id: 1 }, { unique: true }),
    recentSearches.createIndex({ normalizedQuery: 1 }, { unique: true }),
    savedLocations.createIndex({ savedAt: -1 }),
    recentSearches.createIndex({ searchedAt: -1 }),
  ]);

  return { db, savedLocations, recentSearches };
}

function getClient() {
  if (!clientPromise) {
    const client = new MongoClient(MONGODB_URI);
    clientPromise = client.connect();
  }

  return clientPromise;
}

function normalizeLocation(location) {
  const latitude = Number(location.latitude);
  const longitude = Number(location.longitude);
  const id = String(location.id || `${location.name}-${latitude}-${longitude}`);

  if (!location.name || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new Error("Location needs a name, latitude, and longitude.");
  }

  return {
    id,
    name: String(location.name),
    region: String(location.region || ""),
    country: String(location.country || ""),
    latitude,
    longitude,
    timezone: String(location.timezone || "auto"),
  };
}
