import { FuelStation } from "@shared/schema";
import { MapPin, Phone, Clock, X, Navigation } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface StationListProps {
  stations: FuelStation[];
  isLoading: boolean;
  selectedStation: FuelStation | null;
  onSelect: (station: FuelStation) => void;
  showRouteStations: boolean;
  onClearRoute: () => void;
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

export function StationList({ stations, isLoading, selectedStation, onSelect, showRouteStations, onClearRoute }: StationListProps) {
  const prices = stations.map(s => s.price);
  const min = prices.length > 0 ? Math.min(...prices) : 0;
  const max = prices.length > 0 ? Math.max(...prices) : 0;

  if (isLoading) {
    return (
      <div className="p-3 space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="p-3 rounded-lg border border-border">
            <div className="flex justify-between items-start">
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
              <Skeleton className="h-8 w-16 rounded-md" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (stations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center">
        <MapPin className="w-10 h-10 text-muted-foreground/40 mb-3" />
        <p className="text-sm text-muted-foreground">No stations found for this selection.</p>
        <p className="text-xs text-muted-foreground mt-1">Try a different fuel type or region.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {showRouteStations && (
        <div className="px-3 pt-3">
          <div className="flex items-center justify-between bg-primary/10 dark:bg-primary/20 rounded-lg px-3 py-2">
            <div className="flex items-center gap-2">
              <Navigation className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs font-medium text-primary">{stations.length} stations along route</span>
            </div>
            <Button variant="ghost" size="icon" className="w-6 h-6" onClick={onClearRoute} data-testid="button-clear-route">
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      )}
      <div className="flex-1 overflow-y-auto">
        <div className="p-3 space-y-1.5">
          {stations.map((station, index) => {
            const isSelected = selectedStation?.id === station.id;
            const isLowest = station.price === min;
            return (
              <button
                key={station.id}
                onClick={() => onSelect(station)}
                className={`w-full text-left p-3 rounded-lg border transition-colors ${
                  isSelected 
                    ? 'border-primary bg-primary/5 dark:bg-primary/10' 
                    : 'border-border hover:border-primary/30 hover:bg-muted/50'
                }`}
                data-testid={`station-card-${index}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground font-medium tabular-nums w-5">
                        #{index + 1}
                      </span>
                      <span className="text-sm font-medium truncate">
                        {station.name}
                      </span>
                      {isLowest && (
                        <Badge variant="default" className="bg-green-600 hover:bg-green-600 text-[10px] px-1.5 py-0 h-4">
                          LOWEST
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1 mt-1 ml-7">
                      <MapPin className="w-3 h-3 text-muted-foreground shrink-0" />
                      <span className="text-xs text-muted-foreground truncate">
                        {station.address}, {station.suburb}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 ml-7">
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 font-normal">
                        {station.brand}
                      </Badge>
                      {station.phone && (
                        <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                          <Phone className="w-2.5 h-2.5" />
                          {station.phone}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className={`shrink-0 px-2 py-1 rounded-md border text-center ${getPriceBg(station.price, min, max)}`}>
                    <span className={`text-base font-bold tabular-nums leading-none ${getPriceColor(station.price, min, max)}`}>
                      {station.price.toFixed(1)}
                    </span>
                    <span className={`text-[10px] ${getPriceColor(station.price, min, max)}`}>¢</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
