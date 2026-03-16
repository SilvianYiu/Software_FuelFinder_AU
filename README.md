# FuelFinder AU

Real-time fuel price comparison for Western Australia, powered by FuelWatch data.

## Features

- **Live fuel prices** — Unleaded 91, Premium 95, and Diesel from WA FuelWatch
- **Interactive map** — Browse stations with clustered markers and price-coded colors
- **Route planner** — Enter street addresses for origin and destination, find cheapest fuel along your route
- **Google Maps directions** — Click any station to open driving directions
- **Save routes** — Bookmark frequent routes for quick reuse
- **PWA support** — Install on Android, iOS, or desktop for quick access

## Tech Stack

- React + TypeScript + Tailwind CSS + shadcn/ui
- Express.js backend
- Leaflet + OpenStreetMap for maps
- Nominatim API for geocoding
- FuelWatch RSS API for real-time prices

## Getting Started

```bash
npm install --legacy-peer-deps
npm run dev
```

The app runs on `http://localhost:5000`.

## Build for Production

```bash
npm run build
NODE_ENV=production node dist/index.cjs
```

## Deploy

This app can be deployed to Vercel, Railway, Render, or any Node.js hosting platform. It includes PWA support — once hosted on a public URL, users can install it on their devices.

## Data Source

All fuel price data is sourced from [WA FuelWatch](https://www.fuelwatch.wa.gov.au/), updated daily at 2:30 PM AWST.
