"use client";

import * as React from "react";
import {
  MapPin,
  Crosshair,
  Waves,
  Check,
  X,
  Sparkles,
  Info,
  Navigation,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Map as LeafletMap, Marker as LeafletMarker, Circle as LeafletCircle } from "leaflet";

export interface SelectedLocationData {
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
}

interface MapLocationPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectLocation: (data: SelectedLocationData) => void;
  initialLocation?: {
    name?: string;
    latitude?: number | null;
    longitude?: number | null;
    radiusMeters?: number | null;
  };
}

const PRESET_VENUES = [
  {
    name: "Bandaranayake College Swimming Pool Complex, Gampaha",
    shortName: "Bandaranayake Pool (Gampaha)",
    latitude: 7.0917,
    longitude: 79.9996,
    radiusMeters: 30,
  },
  {
    name: "Ranaviru Apparels Swimming Pool, Yakkala",
    shortName: "Ranaviru Apparels Pool (Yakkala)",
    latitude: 7.0785,
    longitude: 80.036,
    radiusMeters: 30,
  },
];

export function MapLocationPickerModal({
  isOpen,
  onClose,
  onSelectLocation,
  initialLocation,
}: MapLocationPickerModalProps) {
  const mapContainerRef = React.useRef<HTMLDivElement>(null);
  const mapInstanceRef = React.useRef<LeafletMap | null>(null);
  const markerRef = React.useRef<LeafletMarker | null>(null);
  const circleRef = React.useRef<LeafletCircle | null>(null);

  // Initial state: fallback to Bandaranayake if not supplied
  const defaultLat = initialLocation?.latitude ?? 7.0917;
  const defaultLng = initialLocation?.longitude ?? 79.9996;
  const defaultRadius = initialLocation?.radiusMeters ?? 30;
  const defaultName =
    initialLocation?.name || "Bandaranayake College Swimming Pool Complex, Gampaha";

  const [locationName, setLocationName] = React.useState(defaultName);
  const [lat, setLat] = React.useState(defaultLat);
  const [lng, setLng] = React.useState(defaultLng);
  const [radius, setRadius] = React.useState(defaultRadius);
  const [isLocating, setIsLocating] = React.useState(false);

  // Initialize or update map when modal opens
  React.useEffect(() => {
    if (!isOpen || !mapContainerRef.current) return;

    let isMounted = true;

    // Dynamically import Leaflet to avoid SSR window errors
    import("leaflet").then((L) => {
      if (!isMounted || !mapContainerRef.current) return;

      // Clean up previous map instance if exists
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      const map = L.map(mapContainerRef.current, {
        center: [lat, lng],
        zoom: 17,
        zoomControl: true,
      });
      mapInstanceRef.current = map;

      // OpenStreetMap Tiles (Fast, completely free, no API key needed)
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      // Custom Aquatic Swimming Marker DivIcon
      const createPinIcon = () =>
        L.divIcon({
          className: "custom-pool-marker",
          html: `
            <div style="position: relative; width: 36px; height: 36px; transform: translate(-50%, -100%);">
              <div style="position: absolute; inset: 0; background: rgba(34, 199, 216, 0.4); border-radius: 9999px; animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
              <div style="position: relative; width: 36px; height: 36px; background: linear-gradient(135deg, #22C7D8, #5BE6CD); border: 2px solid #071B2B; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0,0,0,0.4);">
                <div style="transform: rotate(45deg); color: #071B2B; font-weight: bold; font-size: 16px;">🏊</div>
              </div>
            </div>
          `,
          iconSize: [0, 0],
          iconAnchor: [0, 0],
        });

      // Place Marker
      const marker = L.marker([lat, lng], {
        icon: createPinIcon(),
        draggable: true,
      }).addTo(map);
      markerRef.current = marker;

      // Draw 30m Geofence Circle
      const circle = L.circle([lat, lng], {
        radius: radius,
        color: "#22C7D8",
        weight: 2,
        fillColor: "#5BE6CD",
        fillOpacity: 0.28,
        dashArray: "4, 6",
      }).addTo(map);
      circleRef.current = circle;

      // Handle marker drag
      marker.on("dragend", () => {
        const pos = marker.getLatLng();
        setLat(Number(pos.lat.toFixed(6)));
        setLng(Number(pos.lng.toFixed(6)));
        circle.setLatLng(pos);
      });

      // Handle map click
      map.on("click", (e) => {
        const { lat: clickLat, lng: clickLng } = e.latlng;
        const roundedLat = Number(clickLat.toFixed(6));
        const roundedLng = Number(clickLng.toFixed(6));
        setLat(roundedLat);
        setLng(roundedLng);
        marker.setLatLng([roundedLat, roundedLng]);
        circle.setLatLng([roundedLat, roundedLng]);
      });

      // Invalidate size once rendered in modal
      setTimeout(() => {
        map.invalidateSize();
      }, 200);
    });

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Synchronize circle radius when slider/radius changes
  React.useEffect(() => {
    if (circleRef.current) {
      circleRef.current.setRadius(radius);
    }
  }, [radius]);

  // Quick preset jumper
  function handleSelectPreset(preset: (typeof PRESET_VENUES)[0]) {
    setLocationName(preset.name);
    setLat(preset.latitude);
    setLng(preset.longitude);
    setRadius(preset.radiusMeters);

    if (mapInstanceRef.current && markerRef.current && circleRef.current) {
      mapInstanceRef.current.flyTo([preset.latitude, preset.longitude], 17);
      markerRef.current.setLatLng([preset.latitude, preset.longitude]);
      circleRef.current.setLatLng([preset.latitude, preset.longitude]);
      circleRef.current.setRadius(preset.radiusMeters);
    }
  }

  // Use my current GPS
  function handleLocateMe() {
    if (!("geolocation" in navigator)) {
      toast.error("Geolocation is not supported by your browser.");
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setIsLocating(false);
        const myLat = Number(position.coords.latitude.toFixed(6));
        const myLng = Number(position.coords.longitude.toFixed(6));

        setLat(myLat);
        setLng(myLng);
        setLocationName("Test Pool Location (My GPS)");

        if (mapInstanceRef.current && markerRef.current && circleRef.current) {
          mapInstanceRef.current.flyTo([myLat, myLng], 18);
          markerRef.current.setLatLng([myLat, myLng]);
          circleRef.current.setLatLng([myLat, myLng]);
        }
        toast.success("Placed pool pin at your current GPS location!");
      },
      (error) => {
        setIsLocating(false);
        toast.error("Could not get GPS fix. Please ensure location is allowed.");
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  // Handle manual Lat/Lng coordinate edit
  function handleCoordinateChange(newLat: number, newLng: number) {
    setLat(newLat);
    setLng(newLng);
    if (mapInstanceRef.current && markerRef.current && circleRef.current) {
      mapInstanceRef.current.panTo([newLat, newLng]);
      markerRef.current.setLatLng([newLat, newLng]);
      circleRef.current.setLatLng([newLat, newLng]);
    }
  }

  function handleConfirm() {
    if (!locationName.trim()) {
      toast.error("Please enter a name for this swimming venue or location.");
      return;
    }

    onSelectLocation({
      name: locationName.trim(),
      latitude: lat,
      longitude: lng,
      radiusMeters: radius,
    });
    toast.success(`Location set: ${locationName} (${radius}m geofence)`);
    onClose();
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-card border border-border/90 rounded-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-border/80 flex items-center justify-between bg-card/90">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-aqua/20 border border-aqua/40 text-aqua flex items-center justify-center">
              <MapPin className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-extrabold text-foreground flex items-center gap-2">
                <span>Select Pool Location on Map</span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-aqua/10 text-aqua border border-aqua/30">
                  {radius}m Radius
                </span>
              </h3>
              <p className="text-[11px] text-muted-foreground">
                Click anywhere on the map or drag the pin to set the pool center.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Venue Presets & Current Location */}
        <div className="px-5 py-2.5 bg-secondary/30 border-b border-border/60 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-[11px] font-bold text-muted-foreground flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-aqua" />
            <span>Squad Venues:</span>
          </span>

          {PRESET_VENUES.map((preset) => (
            <button
              key={preset.name}
              type="button"
              onClick={() => handleSelectPreset(preset)}
              className={cn(
                "px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition-all",
                lat === preset.latitude && lng === preset.longitude
                  ? "bg-aqua/20 text-aqua border-aqua/50 shadow-sm"
                  : "bg-secondary/60 hover:bg-secondary text-foreground border-border"
              )}
            >
              🏊 {preset.shortName}
            </button>
          ))}

          <button
            type="button"
            onClick={handleLocateMe}
            disabled={isLocating}
            className="ml-auto px-2.5 py-1 rounded-lg border border-seafoam/40 bg-seafoam/10 hover:bg-seafoam/20 text-seafoam text-[11px] font-bold flex items-center gap-1 transition-all"
          >
            <Crosshair className={cn("w-3 h-3", isLocating && "animate-spin")} />
            <span>{isLocating ? "Getting GPS..." : "📍 Pin My Location"}</span>
          </button>
        </div>

        {/* Leaflet Map Interactive Viewport */}
        <div className="relative flex-1 min-h-[300px] sm:min-h-[360px] w-full bg-ocean-950">
          <div ref={mapContainerRef} className="w-full h-full absolute inset-0 z-0" />

          {/* Floating map hint */}
          <div className="absolute top-3 left-3 z-[400] bg-card/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-border/80 text-[11px] font-medium text-foreground shadow-lg flex items-center gap-1.5 pointer-events-none">
            <Info className="w-3.5 h-3.5 text-aqua shrink-0" />
            <span>Click map or drag 🏊 pin to position pool center</span>
          </div>

          {/* Floating 30m geofence indicator */}
          <div className="absolute bottom-3 right-3 z-[400] bg-card/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-aqua/40 text-[11px] font-bold text-aqua shadow-lg flex items-center gap-1.5 pointer-events-none">
            <Waves className="w-3.5 h-3.5" />
            <span>Geofence zone: {radius}m circle</span>
          </div>
        </div>

        {/* Location Details & Parameters Form */}
        <div className="p-4 sm:p-5 bg-card border-t border-border/80 space-y-3">
          {/* Location Name */}
          <div>
            <label className="block text-[11px] font-bold text-foreground mb-1">
              Venue / Pool Name *
            </label>
            <input
              type="text"
              value={locationName}
              onChange={(e) => setLocationName(e.target.value)}
              placeholder="e.g. Ranaviru Apparels Swimming Pool, Yakkala (or Friend's House)"
              className="w-full px-3 py-2 rounded-xl border border-border bg-secondary/50 text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-aqua"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {/* Latitude */}
            <div>
              <label className="block text-[10px] font-semibold text-muted-foreground mb-1">
                Latitude (Exact)
              </label>
              <input
                type="number"
                step="0.000001"
                value={lat}
                onChange={(e) =>
                  handleCoordinateChange(parseFloat(e.target.value) || 0, lng)
                }
                className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-secondary/40 text-foreground font-mono text-xs"
              />
            </div>

            {/* Longitude */}
            <div>
              <label className="block text-[10px] font-semibold text-muted-foreground mb-1">
                Longitude (Exact)
              </label>
              <input
                type="number"
                step="0.000001"
                value={lng}
                onChange={(e) =>
                  handleCoordinateChange(lat, parseFloat(e.target.value) || 0)
                }
                className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-secondary/40 text-foreground font-mono text-xs"
              />
            </div>

            {/* Geofence Radius */}
            <div>
              <label className="block text-[10px] font-semibold text-muted-foreground mb-1 flex items-center justify-between">
                <span>Check-in Radius</span>
                <span className="text-aqua font-bold">{radius}m</span>
              </label>
              <div className="flex items-center gap-1.5">
                {[30, 50, 80].map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRadius(r)}
                    className={cn(
                      "flex-1 py-1 rounded-lg border text-[11px] font-bold transition-all",
                      radius === r
                        ? "bg-aqua/20 text-aqua border-aqua/50"
                        : "bg-secondary/40 text-muted-foreground border-border hover:text-foreground"
                    )}
                  >
                    {r}m
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/70">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-aqua to-seafoam text-ocean-950 text-xs font-extrabold flex items-center gap-1.5 shadow-md hover:opacity-95 active:scale-95 transition-all"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Use This Pool Location ({radius}m)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
