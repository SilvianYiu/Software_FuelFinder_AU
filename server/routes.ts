import type { Express } from "express";
import { createServer, type Server } from "http";
import { parseStringPromise } from "xml2js";

// In-memory cache for fuel data
interface CacheEntry {
  data: any[];
  timestamp: number;
}

const cache: Map<string, CacheEntry> = new Map();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

// In-memory saved routes store
interface SavedRoute {
  id: string;
  name: string;
  from: { display_name: string; lat: number; lng: number };
  to: { display_name: string; lat: number; lng: number };
  radius: number;
  createdAt: string;
}

const savedRoutes: SavedRoute[] = [];

async function fetchFuelWatchData(product: string, region: string): Promise<any[]> {
  const cacheKey = `${product}-${region}`;
  const cached = cache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  try {
    const url = `https://www.fuelwatch.wa.gov.au/fuelwatch/fuelWatchRSS?Product=${product}&Region=${region}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'FuelFinder-AU/1.0',
        'Accept': 'application/xml, text/xml, application/rss+xml',
      },
    });

    if (!response.ok) {
      throw new Error(`FuelWatch API returned ${response.status}`);
    }

    const xml = await response.text();
    const result = await parseStringPromise(xml, { explicitArray: false });
    
    let items = result?.rss?.channel?.item;
    if (!items) return [];
    if (!Array.isArray(items)) items = [items];

    const stations = items
      .filter((item: any) => item.latitude && item.longitude && item.price)
      .map((item: any, index: number) => ({
        id: `${product}-${region}-${index}-${item['trading-name'] || ''}`,
        name: item['trading-name'] || 'Unknown',
        brand: item.brand || 'Independent',
        suburb: item.location || '',
        address: item.address || '',
        phone: item.phone || '',
        latitude: parseFloat(item.latitude),
        longitude: parseFloat(item.longitude),
        price: parseFloat(item.price),
        fuelType: product,
        date: item.date || new Date().toISOString().split('T')[0],
        siteFeatures: item['site-features'] || '',
      }));

    cache.set(cacheKey, { data: stations, timestamp: Date.now() });
    return stations;
  } catch (error) {
    console.error('FuelWatch fetch error:', error);
    // Return cached data even if expired, as fallback
    if (cached) return cached.data;
    return [];
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // Get fuel stations by product and region
  app.get("/api/stations", async (req, res) => {
    const product = (req.query.product as string) || "1"; // Default ULP
    const region = (req.query.region as string) || "25"; // Default All Metro
    
    try {
      const stations = await fetchFuelWatchData(product, region);
      res.json(stations);
    } catch (error) {
      console.error("Error fetching stations:", error);
      res.status(500).json({ error: "Failed to fetch fuel data" });
    }
  });

  // Get all fuel types for a region (batch fetch)
  app.get("/api/stations/all-types", async (req, res) => {
    const region = (req.query.region as string) || "25";
    
    try {
      const [ulp, premium, diesel] = await Promise.all([
        fetchFuelWatchData("1", region),
        fetchFuelWatchData("2", region),
        fetchFuelWatchData("4", region),
      ]);
      
      res.json({
        "1": ulp,
        "2": premium,
        "4": diesel,
      });
    } catch (error) {
      console.error("Error fetching all types:", error);
      res.status(500).json({ error: "Failed to fetch fuel data" });
    }
  });

  // Get statistics
  app.get("/api/stats", async (req, res) => {
    const product = (req.query.product as string) || "1";
    const region = (req.query.region as string) || "25";
    
    try {
      const stations = await fetchFuelWatchData(product, region);
      if (stations.length === 0) {
        return res.json({ min: 0, max: 0, avg: 0, count: 0 });
      }
      
      const prices = stations.map((s: any) => s.price);
      const min = Math.min(...prices);
      const max = Math.max(...prices);
      const avg = prices.reduce((a: number, b: number) => a + b, 0) / prices.length;
      
      res.json({
        min: min.toFixed(1),
        max: max.toFixed(1),
        avg: avg.toFixed(1),
        count: stations.length,
        cheapest: stations.find((s: any) => s.price === min),
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to compute stats" });
    }
  });

  // Saved routes CRUD
  app.get("/api/routes", (_req, res) => {
    res.json(savedRoutes);
  });

  app.post("/api/routes", (req, res) => {
    const { name, from, to, radius } = req.body;
    if (!name || !from || !to) {
      return res.status(400).json({ error: "name, from, and to are required" });
    }
    const route: SavedRoute = {
      id: `route-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name,
      from,
      to,
      radius: radius || 3,
      createdAt: new Date().toISOString(),
    };
    savedRoutes.push(route);
    res.json(route);
  });

  app.delete("/api/routes/:id", (req, res) => {
    const idx = savedRoutes.findIndex(r => r.id === req.params.id);
    if (idx === -1) {
      return res.status(404).json({ error: "Route not found" });
    }
    savedRoutes.splice(idx, 1);
    res.json({ ok: true });
  });

  // Geocode addresses via OpenStreetMap Nominatim (proxy to avoid CORS)
  app.get("/api/geocode", async (req, res) => {
    const query = (req.query.q as string) || "";
    if (!query || query.length < 3) {
      return res.json([]);
    }

    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&countrycodes=au&addressdetails=1&limit=5&viewbox=112.0,-38.0,129.0,-13.0&bounded=0`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'FuelFinder-AU/1.0 (fuel-price-comparison)',
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Nominatim returned ${response.status}`);
      }

      const data = await response.json();
      const results = (data as any[]).map((item: any) => ({
        display_name: item.display_name,
        lat: parseFloat(item.lat),
        lng: parseFloat(item.lon),
        type: item.type,
        address: item.address || {},
      }));

      res.json(results);
    } catch (error) {
      console.error('Geocoding error:', error);
      res.status(500).json({ error: 'Geocoding failed' });
    }
  });

  return httpServer;
}
