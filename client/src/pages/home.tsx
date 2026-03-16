import { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { FuelStation, fuelTypeOptions, waRegions } from "@shared/schema";
import { FuelMap } from "@/components/FuelMap";
import { StationList } from "@/components/StationList";
import { RoutePanel } from "@/components/RoutePanel";
import { Header } from "@/components/Header";
import { StatsBar } from "@/components/StatsBar";
import { PerplexityAttribution } from "@/components/PerplexityAttribution";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Fuel, Map, Route, List } from "lucide-react";
import { InstallBanner } from "@/components/InstallPrompt";

export default function Home() {
  const [fuelType, setFuelType] = useState("1");
  const [region, setRegion] = useState("25");
  const [selectedStation, setSelectedStation] = useState<FuelStation | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number]>([-31.9505, 115.8605]); // Perth
  const [mapZoom, setMapZoom] = useState(11);
  const [activeTab, setActiveTab] = useState("map");
  const [routeStations, setRouteStations] = useState<FuelStation[]>([]);
  const [showRouteStations, setShowRouteStations] = useState(false);
  const [routePath, setRoutePath] = useState<[number, number][]>([]);
  const [isDark, setIsDark] = useState(() => 
    typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
  );

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  const { data: stations = [], isLoading } = useQuery<FuelStation[]>({
    queryKey: ['/api/stations', { product: fuelType, region }],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/stations?product=${fuelType}&region=${region}`);
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const sortedStations = useMemo(() => {
    return [...stations].sort((a, b) => a.price - b.price);
  }, [stations]);

  const displayStations = showRouteStations ? routeStations : sortedStations;

  const stats = useMemo(() => {
    if (stations.length === 0) return { min: 0, max: 0, avg: 0, count: 0 };
    const prices = stations.map(s => s.price);
    return {
      min: Math.min(...prices),
      max: Math.max(...prices),
      avg: prices.reduce((a, b) => a + b, 0) / prices.length,
      count: stations.length,
    };
  }, [stations]);

  const handleStationSelect = useCallback((station: FuelStation) => {
    setSelectedStation(station);
    setMapCenter([station.latitude, station.longitude]);
    setMapZoom(15);
  }, []);

  const handleRouteFound = useCallback((stns: FuelStation[], path: [number, number][]) => {
    setRouteStations(stns);
    setShowRouteStations(true);
    setRoutePath(path);

    if (path.length > 0) {
      // Center on midpoint of route
      const midIdx = Math.floor(path.length / 2);
      setMapCenter(path[midIdx]);
      setMapZoom(8);
    }
  }, []);

  const handleClearRoute = useCallback(() => {
    setShowRouteStations(false);
    setRouteStations([]);
    setRoutePath([]);
  }, []);

  const fuelLabel = fuelTypeOptions.find(f => f.value === fuelType)?.label || "Unleaded 91";

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header isDark={isDark} onToggleDark={() => setIsDark(!isDark)} />
      <InstallBanner />
      
      <main className="flex-1 flex flex-col">
        {/* Controls bar */}
        <div className="border-b border-border bg-card px-4 py-3">
          <div className="max-w-[1400px] mx-auto flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Fuel className="w-4 h-4 text-muted-foreground" />
              <Select value={fuelType} onValueChange={setFuelType}>
                <SelectTrigger className="w-[160px] h-9" data-testid="select-fuel-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {fuelTypeOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Map className="w-4 h-4 text-muted-foreground" />
              <Select value={region} onValueChange={setRegion}>
                <SelectTrigger className="w-[180px] h-9" data-testid="select-region">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {waRegions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <StatsBar stats={stats} isLoading={isLoading} fuelLabel={fuelLabel} />
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 flex flex-col lg:flex-row">
          {/* Sidebar */}
          <div className="w-full lg:w-[400px] xl:w-[440px] border-r border-border bg-card flex flex-col lg:h-[calc(100vh-120px)]">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col flex-1 min-h-0">
              <TabsList className="w-full rounded-none border-b border-border h-10 bg-transparent p-0 grid grid-cols-2">
                <TabsTrigger 
                  value="map" 
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none h-full"
                  data-testid="tab-stations"
                >
                  <List className="w-4 h-4 mr-1.5" />
                  Stations
                </TabsTrigger>
                <TabsTrigger 
                  value="route" 
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none h-full"
                  data-testid="tab-route"
                >
                  <Route className="w-4 h-4 mr-1.5" />
                  Route Planner
                </TabsTrigger>
              </TabsList>

              <TabsContent value="map" className="flex-1 overflow-auto mt-0 min-h-0">
                <StationList 
                  stations={displayStations} 
                  isLoading={isLoading}
                  selectedStation={selectedStation}
                  onSelect={handleStationSelect}
                  showRouteStations={showRouteStations}
                  onClearRoute={handleClearRoute}
                />
              </TabsContent>

              <TabsContent value="route" className="flex-1 overflow-auto mt-0 min-h-0">
                <RoutePanel
                  allStations={stations}
                  fuelType={fuelType}
                  onRouteFound={handleRouteFound}
                  onClearRoute={handleClearRoute}
                />
              </TabsContent>
            </Tabs>
          </div>

          {/* Map */}
          <div className="flex-1 min-h-[400px] lg:h-[calc(100vh-120px)]">
            <FuelMap
              stations={displayStations}
              selectedStation={selectedStation}
              onStationSelect={handleStationSelect}
              center={mapCenter}
              zoom={mapZoom}
              stats={stats}
              routePath={routePath}
            />
          </div>
        </div>
      </main>

      <footer className="border-t border-border bg-card px-4 py-3 text-center">
        <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-muted-foreground">
          <span>Data sourced from WA FuelWatch</span>
          <span className="hidden sm:inline">·</span>
          <span>Prices updated daily at 2:30 PM AWST</span>
          <span className="hidden sm:inline">·</span>
          <PerplexityAttribution />
        </div>
      </footer>
    </div>
  );
}
