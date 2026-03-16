import { useState, useCallback, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { FuelStation } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { MapPin, Navigation, Loader2, X, Info, Phone, ExternalLink, Bookmark, Trash2, Clock } from "lucide-react";
import L from "leaflet";

interface RoutePanelProps {
  allStations: FuelStation[];
  fuelType: string;
  onRouteFound: (stations: FuelStation[], path: [number, number][]) => void;
  onClearRoute: () => void;
}

interface GeoResult {
  display_name: string;
  lat: number;
  lng: number;
  type: string;
  address: Record<string, string>;
}

interface SelectedLocation {
  display_name: string;
  lat: number;
  lng: number;
}

interface SavedRoute {
  id: string;
  name: string;
  from: SelectedLocation;
  to: SelectedLocation;
  radius: number;
  createdAt: string;
}

function formatDisplayName(result: GeoResult): string {
  const parts = result.display_name.split(", ");
  const meaningful = parts.slice(0, Math.min(parts.length, 4));
  if (meaningful[meaningful.length - 1]?.toLowerCase().includes("australia")) {
    meaningful.pop();
  }
  return meaningful.join(", ");
}

function getDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function findStationsAlongRoute(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  stations: FuelStation[],
  radiusKm: number
): { stations: FuelStation[]; path: [number, number][] } {
  const numPoints = 20;
  const path: [number, number][] = [];
  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints;
    path.push([
      from.lat + t * (to.lat - from.lat),
      from.lng + t * (to.lng - from.lng),
    ]);
  }
  const matchedStations = new Map<string, FuelStation>();
  for (const station of stations) {
    for (const point of path) {
      const dist = getDistance(station.latitude, station.longitude, point[0], point[1]);
      if (dist <= radiusKm) {
        matchedStations.set(station.id, station);
        break;
      }
    }
  }
  // Sort by cheapest price
  const result = Array.from(matchedStations.values()).sort((a, b) => a.price - b.price);
  return { stations: result, path };
}

function getPriceColor(price: number, min: number, max: number): string {
  const range = max - min;
  if (range === 0) return "text-foreground";
  const ratio = (price - min) / range;
  if (ratio <= 0.25) return "text-green-600 dark:text-green-400";
  if (ratio <= 0.6) return "text-amber-600 dark:text-amber-400";
  return "text-red-500 dark:text-red-400";
}

function getPriceBg(price: number, min: number, max: number): string {
  const range = max - min;
  if (range === 0) return "bg-muted";
  const ratio = (price - min) / range;
  if (ratio <= 0.25) return "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800";
  if (ratio <= 0.6) return "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800";
  return "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800";
}

function getGoogleMapsUrl(station: FuelStation): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${station.latitude},${station.longitude}&destination_place_id=&travelmode=driving`;
}

// Inline route mini-map
function RouteMap({ stations, path, from, to }: {
  stations: FuelStation[];
  path: [number, number][];
  from: SelectedLocation;
  to: SelectedLocation;
}) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    const map = L.map(mapContainerRef.current, {
      zoomControl: true,
      attributionControl: false,
      scrollWheelZoom: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(map);

    if (path.length > 1) {
      L.polyline(path, {
        color: '#3b82f6', weight: 3, opacity: 0.7, dashArray: '10, 5',
      }).addTo(map);
    }

    L.circleMarker([from.lat, from.lng], {
      radius: 7, color: '#fff', weight: 2, fillColor: '#22c55e', fillOpacity: 1,
    }).addTo(map).bindTooltip('From', { permanent: false, direction: 'top', offset: [0, -8] });

    L.circleMarker([to.lat, to.lng], {
      radius: 7, color: '#fff', weight: 2, fillColor: '#ef4444', fillOpacity: 1,
    }).addTo(map).bindTooltip('To', { permanent: false, direction: 'top', offset: [0, -8] });

    const prices = stations.map(s => s.price);
    const min = prices.length > 0 ? Math.min(...prices) : 0;
    const max = prices.length > 0 ? Math.max(...prices) : 0;

    stations.forEach((station) => {
      const range = max - min;
      const ratio = range > 0 ? (station.price - min) / range : 0.5;
      let markerColor = '#f59e0b';
      if (ratio <= 0.25) markerColor = '#22c55e';
      else if (ratio > 0.6) markerColor = '#ef4444';

      L.circleMarker([station.latitude, station.longitude], {
        radius: 5, color: '#fff', weight: 1, fillColor: markerColor, fillOpacity: 0.9,
      }).addTo(map).bindPopup(
        `<b>${station.name}</b><br/>${station.price.toFixed(1)}¢/L<br/>${station.address}, ${station.suburb}`,
        { maxWidth: 200 }
      );
    });

    const allPoints: [number, number][] = [
      [from.lat, from.lng], [to.lat, to.lng],
      ...stations.map(s => [s.latitude, s.longitude] as [number, number]),
    ];
    if (allPoints.length >= 2) {
      const bounds = L.latLngBounds(allPoints.map(p => L.latLng(p[0], p[1])));
      map.fitBounds(bounds, { padding: [20, 20] });
    }

    mapRef.current = map;
    return () => {
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    };
  }, [stations, path, from, to]);

  return (
    <div ref={mapContainerRef} className="w-full h-[625px] rounded-lg overflow-hidden border border-border" data-testid="route-mini-map" />
  );
}

// Address autocomplete input
function AddressInput({
  id, label, dotColor, placeholder, value, selected, onTextChange, onSelect, onClear, testId,
}: {
  id: string; label: string; dotColor: string; placeholder: string;
  value: string; selected: SelectedLocation | null;
  onTextChange: (text: string) => void; onSelect: (loc: SelectedLocation) => void;
  onClear: () => void; testId: string;
}) {
  const [suggestions, setSuggestions] = useState<GeoResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchSuggestions = useCallback(async (query: string) => {
    if (query.length < 3) { setSuggestions([]); setShowDropdown(false); return; }
    setIsLoading(true);
    try {
      const resp = await apiRequest("GET", `/api/geocode?q=${encodeURIComponent(query + ", WA")}`);
      const data: GeoResult[] = await resp.json();
      setSuggestions(data);
      setShowDropdown(data.length > 0);
    } catch { setSuggestions([]); }
    setIsLoading(false);
  }, []);

  const handleInputChange = (text: string) => {
    onTextChange(text);
    if (selected) onClear();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(text), 400);
  };

  const handleSelect = (result: GeoResult) => {
    const shortName = formatDisplayName(result);
    onTextChange(shortName);
    onSelect({ display_name: shortName, lat: result.lat, lng: result.lng });
    setShowDropdown(false);
    setSuggestions([]);
  };

  return (
    <div className="space-y-1.5" ref={containerRef}>
      <Label htmlFor={id} className="text-xs font-medium flex items-center gap-1.5">
        <div className={`w-2 h-2 rounded-full ${dotColor}`} />
        {label}
      </Label>
      <div className="relative">
        <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground z-10" />
        {isLoading && (
          <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground animate-spin z-10" />
        )}
        {selected && !isLoading && (
          <button
            onClick={() => { onTextChange(""); onClear(); setSuggestions([]); inputRef.current?.focus(); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-muted hover:bg-muted-foreground/20 flex items-center justify-center z-10 transition-colors"
            aria-label="Clear"
          >
            <X className="w-2.5 h-2.5 text-muted-foreground" />
          </button>
        )}
        <Input
          ref={inputRef} id={id} placeholder={placeholder} value={value}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => { if (suggestions.length > 0 && !selected) setShowDropdown(true); }}
          className={`pl-8 ${selected ? "pr-8" : ""} h-9 text-sm ${selected ? "border-green-500/50 dark:border-green-500/40" : ""}`}
          data-testid={testId} autoComplete="off"
        />
        {showDropdown && suggestions.length > 0 && (
          <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg overflow-hidden">
            {suggestions.map((result, i) => (
              <button
                key={`${result.lat}-${result.lng}-${i}`}
                onClick={() => handleSelect(result)}
                className="w-full text-left px-3 py-2 text-xs hover:bg-muted/60 transition-colors flex items-start gap-2 border-b border-border/50 last:border-0"
                data-testid={`suggestion-${id}-${i}`}
              >
                <MapPin className="w-3 h-3 text-muted-foreground shrink-0 mt-0.5" />
                <span className="line-clamp-2 leading-relaxed">{formatDisplayName(result)}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      {selected && (
        <p className="text-[10px] text-green-600 dark:text-green-400 pl-1 flex items-center gap-1">
          <span className="w-1 h-1 rounded-full bg-green-500 inline-block" />
          Location set
        </p>
      )}
    </div>
  );
}

export function RoutePanel({ allStations, fuelType, onRouteFound, onClearRoute }: RoutePanelProps) {
  const [fromText, setFromText] = useState("");
  const [toText, setToText] = useState("");
  const [fromSelected, setFromSelected] = useState<SelectedLocation | null>(null);
  const [toSelected, setToSelected] = useState<SelectedLocation | null>(null);
  const [radius, setRadius] = useState([3]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState("");
  const [resultCount, setResultCount] = useState<number | null>(null);
  const [foundStations, setFoundStations] = useState<FuelStation[]>([]);
  const [foundPath, setFoundPath] = useState<[number, number][]>([]);
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [routeName, setRouteName] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Fetch saved routes
  const { data: savedRoutes = [] } = useQuery<SavedRoute[]>({
    queryKey: ['/api/routes'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/routes');
      return res.json();
    },
  });

  // Save route mutation
  const saveMutation = useMutation({
    mutationFn: async (data: { name: string; from: SelectedLocation; to: SelectedLocation; radius: number }) => {
      const res = await apiRequest('POST', '/api/routes', data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/routes'] });
      setShowSaveInput(false);
      setRouteName("");
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    },
  });

  // Delete route mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest('DELETE', `/api/routes/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/routes'] });
    },
  });

  const handleSearch = useCallback(async () => {
    setError("");
    setIsSearching(true);
    setFoundStations([]);
    setFoundPath([]);
    setSaveSuccess(false);

    if (!fromSelected) { setError("Please select a 'From' address from the suggestions."); setIsSearching(false); return; }
    if (!toSelected) { setError("Please select a 'To' address from the suggestions."); setIsSearching(false); return; }

    const from = { lat: fromSelected.lat, lng: fromSelected.lng };
    const to = { lat: toSelected.lat, lng: toSelected.lng };

    try {
      const [metroRes, countryRes] = await Promise.all([
        apiRequest('GET', `/api/stations?product=${fuelType}&region=25`),
        apiRequest('GET', `/api/stations?product=${fuelType}&region=26`),
      ]);
      const metroStations: FuelStation[] = await metroRes.json();
      const countryStations: FuelStation[] = await countryRes.json();

      const seen = new Set<string>();
      const combinedStations: FuelStation[] = [];
      for (const s of [...metroStations, ...countryStations, ...allStations]) {
        const key = `${s.name}-${s.suburb}`;
        if (!seen.has(key)) { seen.add(key); combinedStations.push(s); }
      }

      const { stations, path } = findStationsAlongRoute(from, to, combinedStations, radius[0]);
      setResultCount(stations.length);

      if (stations.length === 0) {
        setError("No stations found along this route. Try increasing the search radius.");
        setIsSearching(false);
        return;
      }

      setFoundStations(stations);
      setFoundPath(path);
      onRouteFound(stations, path);
      setTimeout(() => { resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 100);
    } catch (err) {
      const { stations, path } = findStationsAlongRoute(from, to, allStations, radius[0]);
      setResultCount(stations.length);
      if (stations.length === 0) {
        setError("No stations found along this route. Try increasing the search radius.");
      } else {
        setFoundStations(stations);
        setFoundPath(path);
        onRouteFound(stations, path);
        setTimeout(() => { resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 100);
      }
    }
    setIsSearching(false);
  }, [fromSelected, toSelected, radius, allStations, fuelType, onRouteFound]);

  const handleClear = useCallback(() => {
    setFromText(""); setToText("");
    setFromSelected(null); setToSelected(null);
    setError(""); setResultCount(null);
    setFoundStations([]); setFoundPath([]);
    setShowSaveInput(false); setSaveSuccess(false);
    onClearRoute();
  }, [onClearRoute]);

  const handleSaveRoute = useCallback(() => {
    if (!fromSelected || !toSelected || !routeName.trim()) return;
    saveMutation.mutate({
      name: routeName.trim(),
      from: fromSelected,
      to: toSelected,
      radius: radius[0],
    });
  }, [fromSelected, toSelected, routeName, radius, saveMutation]);

  const handleLoadSavedRoute = useCallback((route: SavedRoute) => {
    setFromText(route.from.display_name);
    setToText(route.to.display_name);
    setFromSelected(route.from);
    setToSelected(route.to);
    setRadius([route.radius]);
    setError("");
    setResultCount(null);
    setFoundStations([]);
    setFoundPath([]);
  }, []);



  const stationPrices = foundStations.map(s => s.price);
  const priceMin = stationPrices.length > 0 ? Math.min(...stationPrices) : 0;
  const priceMax = stationPrices.length > 0 ? Math.max(...stationPrices) : 0;

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/5 dark:bg-primary/10 border border-primary/20">
        <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          Type any street address, suburb, or town in WA. Select from the suggestions to set each location.
        </p>
      </div>

      <div className="space-y-3">
        <AddressInput
          id="from" label="From" dotColor="bg-green-500"
          placeholder="e.g. 123 St Georges Terrace, Perth"
          value={fromText} selected={fromSelected}
          onTextChange={setFromText} onSelect={setFromSelected}
          onClear={() => setFromSelected(null)} testId="input-from"
        />
        <AddressInput
          id="to" label="To" dotColor="bg-red-500"
          placeholder="e.g. 45 Victoria St, Bunbury"
          value={toText} selected={toSelected}
          onTextChange={setToText} onSelect={setToSelected}
          onClear={() => setToSelected(null)} testId="input-to"
        />
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-medium">Search radius</Label>
            <span className="text-xs text-muted-foreground tabular-nums">{radius[0]} km</span>
          </div>
          <Slider value={radius} onValueChange={setRadius} min={0} max={5} step={0.5} className="w-full" data-testid="slider-radius" />
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>0 km</span><span>5 km</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-2.5 rounded-md bg-destructive/10 border border-destructive/20 text-xs text-destructive">{error}</div>
      )}

      <div className="flex gap-2">
        <Button onClick={handleSearch} disabled={!fromSelected || !toSelected || isSearching} className="flex-1 h-9" data-testid="button-find-route">
          {isSearching ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Navigation className="w-4 h-4 mr-1.5" />}
          Find Stations
        </Button>
        <Button variant="outline" onClick={handleClear} className="h-9" data-testid="button-clear-route">
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Route results */}
      {foundStations.length > 0 && fromSelected && toSelected && (
        <div ref={resultsRef} className="space-y-3 pt-2 border-t border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Navigation className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs font-medium text-primary">
                {foundStations.length} stations along route
              </span>
            </div>
            <div className="flex items-center gap-1">
              {!showSaveInput && !saveSuccess && (
                <Button
                  variant="ghost" size="sm"
                  className="h-6 px-2 text-[10px] gap-1"
                  onClick={() => setShowSaveInput(true)}
                  data-testid="button-save-route"
                >
                  <Bookmark className="w-3 h-3" />
                  Save
                </Button>
              )}
              {saveSuccess && (
                <span className="text-[10px] text-green-600 dark:text-green-400 font-medium px-2">Saved</span>
              )}
              <Button variant="ghost" size="icon" className="w-6 h-6" onClick={handleClear}>
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          {/* Save route input */}
          {showSaveInput && (
            <div className="flex gap-1.5">
              <Input
                placeholder="Route name (e.g. Home to Work)"
                value={routeName}
                onChange={(e) => setRouteName(e.target.value)}
                className="h-7 text-xs flex-1"
                data-testid="input-route-name"
                autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveRoute(); }}
              />
              <Button size="sm" className="h-7 px-2 text-[10px]" onClick={handleSaveRoute} disabled={!routeName.trim() || saveMutation.isPending}>
                {saveMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Save"}
              </Button>
              <Button variant="ghost" size="sm" className="h-7 px-1.5" onClick={() => { setShowSaveInput(false); setRouteName(""); }}>
                <X className="w-3 h-3" />
              </Button>
            </div>
          )}

          {/* Mini-map */}
          <RouteMap stations={foundStations} path={foundPath} from={fromSelected} to={toSelected} />

          {/* Station list with Google Maps links */}
          <div className="space-y-1.5">
            {foundStations.map((station, index) => {
              const isLowest = station.price === priceMin;
              return (
                <a
                  key={station.id}
                  href={getGoogleMapsUrl(station)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-2.5 rounded-lg border border-border hover:border-primary/30 hover:bg-muted/50 transition-colors group cursor-pointer"
                  data-testid={`route-station-${index}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-muted-foreground font-medium tabular-nums w-4">#{index + 1}</span>
                        <span className="text-xs font-medium truncate">{station.name}</span>
                        {isLowest && (
                          <Badge variant="default" className="bg-green-600 hover:bg-green-600 text-[9px] px-1 py-0 h-3.5">LOWEST</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1 mt-0.5 ml-[22px]">
                        <MapPin className="w-2.5 h-2.5 text-muted-foreground shrink-0" />
                        <span className="text-[10px] text-muted-foreground truncate">{station.address}, {station.suburb}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 ml-[22px]">
                        <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5 font-normal">{station.brand}</Badge>
                        {station.phone && (
                          <span className="text-[9px] text-muted-foreground flex items-center gap-0.5">
                            <Phone className="w-2 h-2" />{station.phone}
                          </span>
                        )}
                        <span className="text-[9px] text-primary opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 ml-auto">
                          <ExternalLink className="w-2.5 h-2.5" />
                          Directions
                        </span>
                      </div>
                    </div>
                    <div className={`shrink-0 px-1.5 py-0.5 rounded border text-center ${getPriceBg(station.price, priceMin, priceMax)}`}>
                      <span className={`text-sm font-bold tabular-nums leading-none ${getPriceColor(station.price, priceMin, priceMax)}`}>
                        {station.price.toFixed(1)}
                      </span>
                      <span className={`text-[9px] ${getPriceColor(station.price, priceMin, priceMax)}`}>¢</span>
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
        </div>
      )}

      {/* Saved routes — only show when no results */}
      {foundStations.length === 0 && (
        <>
          {/* Saved routes */}
          {savedRoutes.length > 0 && (
            <div className="pt-2 border-t border-border">
              <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                <Bookmark className="w-3 h-3" />
                Saved routes
              </p>
              <div className="space-y-1">
                {savedRoutes.map(route => (
                  <div
                    key={route.id}
                    className="flex items-center gap-1.5 px-2.5 py-2 rounded-md hover:bg-muted/50 transition-colors group"
                  >
                    <button
                      onClick={() => handleLoadSavedRoute(route)}
                      className="flex-1 text-left min-w-0"
                      data-testid={`saved-route-${route.id}`}
                    >
                      <p className="text-xs font-medium truncate">{route.name}</p>
                      <p className="text-[10px] text-muted-foreground truncate flex items-center gap-1 mt-0.5">
                        <span className="text-green-600 dark:text-green-400">{route.from.display_name.split(',')[0]}</span>
                        <span>→</span>
                        <span className="text-red-500 dark:text-red-400">{route.to.display_name.split(',')[0]}</span>
                        <span className="ml-1 opacity-60">({route.radius} km)</span>
                      </p>
                    </button>
                    <button
                      onClick={() => deleteMutation.mutate(route.id)}
                      className="shrink-0 w-5 h-5 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 hover:bg-destructive/10 transition-all"
                      data-testid={`delete-route-${route.id}`}
                      aria-label="Delete route"
                    >
                      <Trash2 className="w-3 h-3 text-destructive" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}


        </>
      )}
    </div>
  );
}
