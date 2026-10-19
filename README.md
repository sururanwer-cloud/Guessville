# WeatherApp

A full-stack weather dashboard built with React, Vite, Express, and MongoDB.

## Features

- Search cities and places with the Open-Meteo Geocoding API
- View live current weather, next 24 hours, and a 7-day forecast
- Use browser geolocation for local weather
- Save favorite locations in MongoDB
- Persist recent searches on the server
- No weather API key required

## Tech Stack

- Frontend: React, Vite, lucide-react
- Backend: Express
- Weather data: Open-Meteo
- Database: MongoDB Atlas or a local MongoDB instance

## Environment

Create a `.env` file from `.env.example`:

```bash
CLIENT_ORIGIN=http://localhost:5173
PORT=3001
VITE_SERVER_URL=http://localhost:3001
MONGODB_URI=mongodb+srv://username:password@cluster0.example.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0
MONGODB_DB_NAME=weatheradmin
```

For MongoDB Atlas, replace `username`, `password`, and `cluster0.example.mongodb.net` with your real Cluster0 connection string details. Keep `.env` private.

## Run Locally

```bash
npm install
npm run dev
```

The Vite client runs on `http://localhost:5173` and the Express API runs on `http://localhost:3001`.

If the server says `EADDRINUSE` or `address already in use`, another old dev process is still using the port:

```bash
npm run free:ports
npm run dev
```

## API Routes

- `GET /health`
- `GET /api/db/health`
- `GET /api/search?q=mumbai`
- `GET /api/weather?lat=19.076&lon=72.8777&timezone=Asia/Kolkata`
- `GET /api/saved-locations`
- `POST /api/saved-locations`
- `DELETE /api/saved-locations/:id`
- `GET /api/recent-searches`

## Production

Build the frontend and start the server:

```bash
npm run build
npm start
```

The Express server serves the Vite build from `dist`.
