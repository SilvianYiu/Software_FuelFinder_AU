import { useEffect, useRef } from "react";
import { FuelStation } from "@shared/schema";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/leaflet.markercluster.js";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";

interface FuelMapProps {
  stations: FuelStation[];
  selectedStation: FuelStation | null;
  onStationSelect: (station: FuelStation) => void;
  center: [number, number];
  zoom: number;
  stats: { min: number; max: number; avg: number; count: number };
  routePath: [number, number][];
}

function getPriceClass(price: number, min: number, max: number): string {
  const range = max - min;
  if (range === 0) return "mid";
  const ratio = (price - min) / range;
  if (ratio <= 0.25) return "cheap";
  if (ratio <= 0.6) return "mid";
  return "expensive";
}

export function FuelMap({ stations, selectedStation, onStationSelect, center, zoom, stats, routePath }: FuelMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const clusterGroupRef = useRef<any>(null);
  const routeLayerRef = useRef<L.Polyline | null>(null);
  const selectedMarkerRef = useRef<L.CircleMarker | null>(null);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center,
      zoom,
      zoomControl: true,
      attributionControl: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    // @ts-ignore - markercluster types
    clusterGroupRef.current = L.markerClusterGroup({
      maxClusterRadius: 40,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      iconCreateFunction: (cluster: any) => {
        const childCount = cluster.getChildCount();
        const markers = cluster.getAllChildMarkers();
        // Get average price
        let totalPrice = 0;
        let count = 0;
        markers.forEach((m: any) => {
          if (m.options.stationPrice) {
            totalPrice += m.options.stationPrice;
            count++;
          }
        });
        const avgPrice = count > 0 ? totalPrice / count : 0;
        let colorClass = 'mid';
        if (stats.max - stats.min > 0) {
          const ratio = (avgPrice - stats.min) / (stats.max - stats.min);
          if (ratio <= 0.25) colorClass = 'cheap';
          else if (ratio > 0.6) colorClass = 'expensive';
        }
        
        return L.divIcon({
          html: `<div class="fuel-cluster ${colorClass}"><span class="cluster-price">${avgPrice.toFixed(0)}</span><span class="cluster-count">${childCount}</span></div>`,
          className: '',
          iconSize: [52, 32],
          iconAnchor: [26, 16],
        });
      },
    });
    
    map.addLayer(clusterGroupRef.current);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update center/zoom
  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.setView(center, zoom, { animate: true, duration: 0.5 });
  }, [center, zoom]);

  // Update route line
  useEffect(() => {
    if (!mapRef.current) return;
    
    if (routeLayerRef.current) {
      routeLayerRef.current.remove();
      routeLayerRef.current = null;
    }

    if (routePath.length > 1) {
      routeLayerRef.current = L.polyline(routePath, {
        color: '#3b82f6',
        weight: 4,
        opacity: 0.7,
        dashArray: '12, 6',
        className: 'route-path',
      }).addTo(mapRef.current);
    }
  }, [routePath]);

  // Update markers
  useEffect(() => {
    if (!mapRef.current || !clusterGroupRef.current) return;

    clusterGroupRef.current.clearLayers();
    if (selectedMarkerRef.current) {
      selectedMarkerRef.current.remove();
      selectedMarkerRef.current = null;
    }

    const { min, max } = stats;

    stations.forEach((station) => {
      if (!station.latitude || !station.longitude) return;
      
      const priceClass = getPriceClass(station.price, min, max);
      const isSelected = selectedStation?.id === station.id;
      
      const icon = L.divIcon({
        className: '',
        html: `<div class="fuel-marker ${priceClass}" style="${isSelected ? 'transform: scale(1.3); z-index: 1000;' : ''}">${station.price.toFixed(1)}</div>`,
        iconSize: [50, 24],
        iconAnchor: [25, 12],
      });

      const marker = L.marker([station.latitude, station.longitude], { 
        icon,
        // @ts-ignore - custom property for cluster price calculation
        stationPrice: station.price,
      });
      
      marker.bindPopup(`
        <div style="min-width: 200px; font-family: sans-serif;">
          <div style="font-weight: 600; font-size: 14px; margin-bottom: 4px;">${station.name}</div>
          <div style="font-size: 12px; color: #666; margin-bottom: 6px;">${station.brand}</div>
          <div style="font-size: 24px; font-weight: 700; color: ${priceClass === 'cheap' ? '#16a34a' : priceClass === 'mid' ? '#d97706' : '#dc2626'}; margin-bottom: 6px;">
            ${station.price.toFixed(1)}<span style="font-size: 12px; font-weight: 400;">¢/L</span>
          </div>
          <div style="font-size: 11px; color: #888;">
            📍 ${station.address}, ${station.suburb}<br/>
            ${station.phone ? '📞 ' + station.phone : ''}
          </div>
        </div>
      `, { closeButton: true, maxWidth: 280 });

      marker.on('click', () => onStationSelect(station));
      
      clusterGroupRef.current!.addLayer(marker);
    });

    // Add selected station highlight ring
    if (selectedStation) {
      selectedMarkerRef.current = L.circleMarker(
        [selectedStation.latitude, selectedStation.longitude],
        {
          radius: 18,
          color: '#3b82f6',
          weight: 3,
          fillColor: 'transparent',
          fillOpacity: 0,
          opacity: 0.8,
        }
      ).addTo(mapRef.current);
    }
  }, [stations, selectedStation, stats, onStationSelect]);

  return (
    <div ref={mapContainerRef} className="w-full h-full" data-testid="fuel-map" />
  );
}
