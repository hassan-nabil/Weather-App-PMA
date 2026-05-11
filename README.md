# Weather Atlas - PM Accelerator Assessment

A full-stack weather application built with Next.js (App Router), MongoDB, and real-time external APIs. The app lets users search locations, fetch current conditions and 5-day forecasts, save results, update or delete records, and export stored data as JSON. It also integrates YouTube videos for each location and includes the required PM Accelerator description and author name in the UI.

## Features

- Search by city, zip code, landmark, or coordinates
- Use current location (browser geolocation)
- Current weather + 5-day forecast
- Date range validation (next 5 days only)
- MongoDB CRUD: create, read, update, delete
- JSON export for stored data
- YouTube travel videos per location
- Responsive, web-first layout with error handling

## Tech Stack

- Next.js (App Router)
- React 19
- Tailwind CSS v4
- MongoDB + Mongoose
- OpenWeatherMap API
- YouTube Data API

## Setup

1. Install dependencies:

```bash
npm install
```

1. Create a `.env.local` file in the project root:

```bash
MONGODB_URI=your_mongodb_connection_string
OPENWEATHER_API_KEY=your_openweather_api_key
YOUTUBE_API_KEY=your_youtube_api_key
```

> YouTube API is optional. If missing, the UI will show a friendly message instead of videos.

1. Start the development server:

```bash
npm run dev
```

Open <http://localhost:3000>

## API Routes

- `GET /api/weather` - list saved searches
- `POST /api/weather` - create a new record + fetch weather
- `GET /api/weather/[id]` - fetch a single record
- `PUT /api/weather/[id]` - refresh/update a record
- `DELETE /api/weather/[id]` - delete a record
- `GET /api/weather/export` - download JSON export

## Notes

- The date range is limited to the next 5 days due to free forecast API limits.
- The footer includes the required PM Accelerator description and the author name.

## Demo

Record a 1-2 minute walkthrough (UI + code) and paste the shareable link in your submission form.
