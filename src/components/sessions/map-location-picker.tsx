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
  Search,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DEFAULT_GEOFENCE_RADIUS_METERS, matchKnownVenueByName } from "@/lib/geo-fence";
import { toast } from "sonner";
import type {
  Map as LeafletMap,
  Marker as LeafletMarker,
  Circle as LeafletCircle,
} from "leaflet";

export interface SelectedLocationData {
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
}

interface MapLocationPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectLocation: (data: SelectedLocationData) => void | Promise<void | boolean>;
  initialLocation?: {
    name?: string;
    latitude?: number | null;
    longitude?: number | null;
    radiusMeters?: number | null;
  };
  title?: string;
  confirmLabel?: string;
}

export const PRESET_VENUES = [
  {
    name: "Bandaranayake College Swimming Pool Complex, Gampaha",
    shortName: "Bandaranayake Pool (Gampaha)",
    latitude: 7.0917,
    longitude: 79.9996,
    radiusMeters: DEFAULT_GEOFENCE_RADIUS_METERS,
  },
  {
    name: "Ranaviru Apparels Swimming Pool, Yakkala",
    shortName: "Ranaviru Apparels Pool (Yakkala)",
    latitude: 7.0785,
    longitude: 80.036,
    radiusMeters: DEFAULT_GEOFENCE_RADIUS_METERS,
  },
];

interface NominatimSearchResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  name?: string;
}

function resolveInitialCoordinates(initialLocation?: MapLocationPickerModalProps["initialLocation"]) {
  const matched = matchKnownVenueByName(initialLocation?.name);
  const lat =
    initialLocation?.latitude != null && Number.isFinite(Number(initialLocation.latitude))
      ? Number(initialLocation.latitude)
      : matched?.latitude ?? 7.0917;
  const lng =
    initialLocation?.longitude != null && Number.isFinite(Number(initialLocation.longitude))
      ? Number(initialLocation.longitude)
      : matched?.longitude ?? 79.9996;
  const radius =
    initialLocation?.radiusMeters != null && Number.isFinite(Number(initialLocation.radiusMeters))
      ? Math.min(250, Math.max(25, Number(initialLocation.radiusMeters)))
      : matched?.radiusMeters ?? DEFAULT_GEOFENCE_RADIUS_METERS;
  const name =
    initialLocation?.name?.trim() ||
    "Bandaranayake College Swimming Pool Complex, Gampaha";

  return { name, lat, lng, radius };
}

function isPresetVenueName(name: string): boolean {
  const clean = name.trim().toLowerCase();
  if (!clean) return true;
  if (clean.startsWith("pinned pool location") || clean.startsWith("test pool location")) {
    return true;
  }
  return PRESET_VENUES.some((p) => p.name.toLowerCase() === clean);
}

export function MapLocationPickerModal({
  isOpen,
  onClose,
  onSelectLocation,
  initialLocation,
  title = "Select Pool Location on Map",
  confirmLabel,
}: MapLocationPickerModalProps) {
  const mapContainerRef = React.useRef<HTMLDivElement>(null);
  const mapInstanceRef = React.useRef<LeafletMap | null>(null);
  const markerRef = React.useRef<LeafletMarker | null>(null);
  const circleRef = React.useRef<LeafletCircle | null>(null);

  const initial = React.useMemo(
    () => resolveInitialCoordinates(initialLocation),
    [
      initialLocation?.name,
      initialLocation?.latitude,
      initialLocation?.longitude,
      initialLocation?.radiusMeters,
    ]
  );

  const [locationName, setLocationName] = React.useState(initial.name);
  const [lat, setLat] = React.useState(initial.lat);
  const [lng, setLng] = React.useState(initial.lng);
  const [radius, setRadius] = React.useState(initial.radius);
  const [isLocating, setIsLocating] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isReverseGeocoding, setIsReverseGeocoding] = React.useState(false);
  const [hasCustomNameEdit, setHasCustomNameEdit] = React.useState(false);

  // Place search state
  const [searchQuery, setSearchQuery] = React.useState("");
  const [isSearching, setIsSearching] = React.useState(false);
  const [searchResults, setSearchResults] = React.useState<NominatimSearchResult[]>([]);

  const locationNameRef = React.useRef(locationName);
  const hasCustomNameEditRef = React.useRef(hasCustomNameEdit);
  React.useEffect(() => {
    locationNameRef.current = locationName;
  }, [locationName]);
  React.useEffect(() => {
    hasCustomNameEditRef.current = hasCustomNameEdit;
  }, [hasCustomNameEdit]);

  // Re-synchronize state whenever modal opens or initialLocation changes
  React.useEffect(() => {
    if (!isOpen) return;
    const resolved = resolveInitialCoordinates(initialLocation);
    setLocationName(resolved.name);
    setLat(resolved.lat);
    setLng(resolved.lng);
    setRadius(resolved.radius);
    setHasCustomNameEdit(false);
    setSearchQuery("");
    setSearchResults([]);
  }, [isOpen, initial]);

  // Reverse geocode helper when pin is moved on map
  const reverseGeocodeCoordinates = React.useCallback(
    async (targetLat: number, targetLng: number, forceUpdateName = false) => {
      const shouldUpdateName =
        forceUpdateName ||
        !hasCustomNameEditRef.current ||
        isPresetVenueName(locationNameRef.current);

      if (!shouldUpdateName) return;

      // Check if close to a known preset venue (< 60m)
      for (const preset of PRESET_VENUES) {
        const dLat = Math.abs(targetLat - preset.latitude);
        const dLng = Math.abs(targetLng - preset.longitude);
        if (dLat < 0.0005 && dLng < 0.0005) {
          setLocationName(preset.name);
          return;
        }
      }

      setIsReverseGeocoding(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${targetLat}&lon=${targetLng}&zoom=18&addressdetails=1`,
          {
            headers: {
              Accept: "application/json",
            },
          }
        );
        if (res.ok) {
          const data = await res.json();
          if (data && data.display_name) {
            const parts = String(data.display_name)
              .split(",")
              .map((s: string) => s.trim())
              .filter(Boolean);
            const conciseName = parts.slice(0, 3).join(", ");
            if (conciseName) {
              setLocationName(conciseName);
              return;
            }
          }
        }
      } catch {
        // Fallback below if offline or rate-limited
      } finally {
        setIsReverseGeocoding(false);
      }

      if (isPresetVenueName(locationNameRef.current)) {
        setLocationName(`Pinned Pool Location (${targetLat.toFixed(4)}, ${targetLng.toFixed(4)})`);
      }
    },
    []
  );

  // Initialize or update Leaflet map when modal opens
  React.useEffect(() => {
    if (!isOpen || !mapContainerRef.current) return;

    let isMounted = true;
    let resizeObserver: ResizeObserver | null = null;
    const startCoords = resolveInitialCoordinates(initialLocation);

    import("leaflet").then((L) => {
      if (!isMounted || !mapContainerRef.current) return;

      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      const map = L.map(mapContainerRef.current, {
        center: [startCoords.lat, startCoords.lng],
        zoom: 17,
        zoomControl: false,
      });
      mapInstanceRef.current = map;

      // Place zoom control at bottom-left so top-left hint badge never blocks it
      L.control.zoom({ position: "bottomleft" }).addTo(map);

      // OpenStreetMap Tiles
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);

      // Responsive 40x40 Aquatic Swimming Marker DivIcon with proper hitbox
      const createPinIcon = () =>
        L.divIcon({
          className: "custom-pool-marker !bg-transparent !border-0",
          html: `
            <div style="position: relative; width: 40px; height: 40px; cursor: grab; touch-action: none; user-select: none;">
              <div style="pointer-events: none; position: absolute; inset: 2px; background: rgba(34, 199, 216, 0.35); border-radius: 9999px; animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
              <div style="pointer-events: none; position: relative; width: 40px; height: 40px; background: linear-gradient(135deg, #22C7D8, #5BE6CD); border: 2.5px solid #071B2B; border-radius: 50% 50% 50% 0; transform: rotate(-45deg); display: flex; align-items: center; justify-content: center; box-shadow: 0 6px 16px rgba(0,0,0,0.45);">
                <div style="transform: rotate(45deg); color: #071B2B; font-weight: bold; font-size: 18px; line-height: 1;">🏊</div>
              </div>
            </div>
          `,
          iconSize: [40, 40],
          iconAnchor: [20, 40],
        });

      const marker = L.marker([startCoords.lat, startCoords.lng], {
        icon: createPinIcon(),
        draggable: true,
        autoPan: true,
      }).addTo(map);
      markerRef.current = marker;

      const circle = L.circle([startCoords.lat, startCoords.lng], {
        radius: startCoords.radius,
        color: "#22C7D8",
        weight: 2,
        fillColor: "#5BE6CD",
        fillOpacity: 0.25,
        dashArray: "4, 6",
      }).addTo(map);
      circleRef.current = circle;

      // Live circle tracking while dragging marker
      marker.on("drag", () => {
        const pos = marker.getLatLng();
        circle.setLatLng(pos);
      });

      // Finalize coordinates when marker drag ends
      marker.on("dragend", () => {
        const pos = marker.getLatLng();
        const roundedLat = Number(pos.lat.toFixed(6));
        const roundedLng = Number(pos.lng.toFixed(6));
        setLat(roundedLat);
        setLng(roundedLng);
        circle.setLatLng([roundedLat, roundedLng]);
        reverseGeocodeCoordinates(roundedLat, roundedLng);
      });

      // Move pin & circle when clicking anywhere on the map
      map.on("click", (e) => {
        const { lat: clickLat, lng: clickLng } = e.latlng;
        const roundedLat = Number(clickLat.toFixed(6));
        const roundedLng = Number(clickLng.toFixed(6));
        setLat(roundedLat);
        setLng(roundedLng);
        marker.setLatLng([roundedLat, roundedLng]);
        circle.setLatLng([roundedLat, roundedLng]);
        reverseGeocodeCoordinates(roundedLat, roundedLng);
      });

      // Ensure tiles and viewport size are accurate across mobile/desktop layout changes
      setTimeout(() => {
        if (isMounted && mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize();
        }
      }, 150);

      if (typeof ResizeObserver !== "undefined" && mapContainerRef.current) {
        resizeObserver = new ResizeObserver(() => {
          if (isMounted && mapInstanceRef.current) {
            mapInstanceRef.current.invalidateSize();
          }
        });
        resizeObserver.observe(mapContainerRef.current);
      }
    });

    return () => {
      isMounted = false;
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Synchronize circle radius when slider/preset changes
  React.useEffect(() => {
    if (circleRef.current) {
      circleRef.current.setRadius(radius);
    }
  }, [radius]);

  // Search for a place / pool on OpenStreetMap
  async function handleSearchPlace(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;

    setIsSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          q
        )}&limit=5&addressdetails=1`,
        {
          headers: { Accept: "application/json" },
        }
      );
      if (!res.ok) throw new Error("Search failed");
      const results = (await res.json()) as NominatimSearchResult[];
      setSearchResults(results);

      if (results.length === 0) {
        toast.info("No matching places found. Try a broader town or pool name, or click directly on the map.");
      } else if (results.length === 1) {
        handlePickSearchResult(results[0]);
      }
    } catch {
      toast.error("Could not search map places right now. You can still drag the pin or enter coordinates.");
    } finally {
      setIsSearching(false);
    }
  }

  function handlePickSearchResult(item: NominatimSearchResult) {
    const newLat = Number(parseFloat(item.lat).toFixed(6));
    const newLng = Number(parseFloat(item.lon).toFixed(6));
    if (!Number.isFinite(newLat) || !Number.isFinite(newLng)) return;

    const parts = item.display_name
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const cleanName = parts.slice(0, 3).join(", ") || item.display_name;

    setLocationName(cleanName);
    setHasCustomNameEdit(true);
    setLat(newLat);
    setLng(newLng);
    setSearchResults([]);

    if (mapInstanceRef.current && markerRef.current && circleRef.current) {
      mapInstanceRef.current.flyTo([newLat, newLng], 17);
      markerRef.current.setLatLng([newLat, newLng]);
      circleRef.current.setLatLng([newLat, newLng]);
    }
    toast.success(`Moved pin to ${cleanName}`);
  }

  // Quick preset jumper
  function handleSelectPreset(preset: (typeof PRESET_VENUES)[0]) {
    setLocationName(preset.name);
    setHasCustomNameEdit(false);
    setLat(preset.latitude);
    setLng(preset.longitude);
    setRadius(preset.radiusMeters);
    setSearchResults([]);

    if (mapInstanceRef.current && markerRef.current && circleRef.current) {
      mapInstanceRef.current.flyTo([preset.latitude, preset.longitude], 17);
      markerRef.current.setLatLng([preset.latitude, preset.longitude]);
      circleRef.current.setLatLng([preset.latitude, preset.longitude]);
      circleRef.current.setRadius(preset.radiusMeters);
    }
  }

  // Use current device GPS with automatic high->standard accuracy fallback
  function handleLocateMe() {
    if (!("geolocation" in navigator)) {
      toast.error("Geolocation is not supported by your browser.");
      return;
    }

    setIsLocating(true);

    const onSuccess = (position: GeolocationPosition) => {
      setIsLocating(false);
      const myLat = Number(position.coords.latitude.toFixed(6));
      const myLng = Number(position.coords.longitude.toFixed(6));

      setLat(myLat);
      setLng(myLng);
      if (!hasCustomNameEditRef.current || isPresetVenueName(locationNameRef.current)) {
        setLocationName("Pinned Pool Location (My GPS)");
      }
      reverseGeocodeCoordinates(myLat, myLng, true);

      if (mapInstanceRef.current && markerRef.current && circleRef.current) {
        mapInstanceRef.current.flyTo([myLat, myLng], 18);
        markerRef.current.setLatLng([myLat, myLng]);
        circleRef.current.setLatLng([myLat, myLng]);
      }
      toast.success("Placed pool pin at your current GPS location!");
    };

    navigator.geolocation.getCurrentPosition(
      onSuccess,
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setIsLocating(false);
          toast.error("Location permission was denied. Please allow location access in your browser.");
          return;
        }
        // Fallback to standard accuracy (Wi-Fi / network) for laptops & indoor desktops
        navigator.geolocation.getCurrentPosition(
          onSuccess,
          () => {
            setIsLocating(false);
            toast.error("Could not get GPS fix. You can also search a place or click directly on the map.");
          },
          { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
        );
      },
      { enableHighAccuracy: true, timeout: 7000, maximumAge: 0 }
    );
  }

  // Handle manual Lat/Lng coordinate edit
  function handleCoordinateChange(newLat: number, newLng: number) {
    const safeLat = Math.max(-90, Math.min(90, newLat));
    const safeLng = Math.max(-180, Math.min(180, newLng));
    setLat(safeLat);
    setLng(safeLng);
    if (mapInstanceRef.current && markerRef.current && circleRef.current) {
      mapInstanceRef.current.panTo([safeLat, safeLng]);
      markerRef.current.setLatLng([safeLat, safeLng]);
      circleRef.current.setLatLng([safeLat, safeLng]);
    }
  }

  async function handleConfirm() {
    if (!locationName.trim()) {
      toast.error("Please enter a name for this swimming venue or location.");
      return;
    }

    setIsSaving(true);
    try {
      const result = await onSelectLocation({
        name: locationName.trim(),
        latitude: Number(lat.toFixed(6)),
        longitude: Number(lng.toFixed(6)),
        radiusMeters: Math.min(250, Math.max(25, Math.round(radius))),
      });
      if (result === false) {
        return;
      }
      onClose();
    } finally {
      setIsSaving(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSaving) onClose();
      }}
    >
      <div className="w-full max-w-2xl bg-card border-t sm:border border-border/90 rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[95dvh] sm:max-h-[92vh] overflow-hidden">
        {/* Sticky Header */}
        <div className="px-4 sm:px-5 py-3.5 border-b border-border/80 flex items-center justify-between bg-card shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-aqua/20 border border-aqua/40 text-aqua flex items-center justify-center shrink-0">
              <MapPin className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-extrabold text-foreground flex flex-wrap items-center gap-2">
                <span className="truncate">{title}</span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-aqua/10 text-aqua border border-aqua/30 shrink-0">
                  {radius}m Radius
                </span>
              </h3>
              <p className="text-[11px] text-muted-foreground truncate">
                Tap anywhere on the map, drag the 🏊 pin, or search a pool venue.
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={isSaving}
            onClick={onClose}
            aria-label="Close map location picker"
            className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body (ensures full responsiveness on mobile & compact screens) */}
        <div className="flex-1 overflow-y-auto min-h-0 flex flex-col">
          {/* Quick Venue Presets, Search & Current Location */}
          <div className="px-4 sm:px-5 py-2.5 bg-secondary/30 border-b border-border/60 space-y-2 shrink-0">
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-[11px] font-bold text-muted-foreground flex items-center gap-1 mr-1">
                <Sparkles className="w-3 h-3 text-aqua" />
                <span>Presets:</span>
              </span>

              {PRESET_VENUES.map((preset) => {
                const isSelected =
                  Math.abs(lat - preset.latitude) < 0.0002 &&
                  Math.abs(lng - preset.longitude) < 0.0002;
                return (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => handleSelectPreset(preset)}
                    className={cn(
                      "px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition-all",
                      isSelected
                        ? "bg-aqua/20 text-aqua border-aqua/50 shadow-sm"
                        : "bg-secondary/60 hover:bg-secondary text-foreground border-border"
                    )}
                  >
                    🏊 {preset.shortName}
                  </button>
                );
              })}

              <button
                type="button"
                onClick={handleLocateMe}
                disabled={isLocating}
                className="sm:ml-auto px-2.5 py-1 rounded-lg border border-seafoam/40 bg-seafoam/10 hover:bg-seafoam/20 text-seafoam text-[11px] font-bold flex items-center gap-1 transition-all active:scale-95"
              >
                <Crosshair className={cn("w-3 h-3", isLocating && "animate-spin")} />
                <span>{isLocating ? "Locating..." : "📍 Pin My Location"}</span>
              </button>
            </div>

            {/* Map Place Search Bar */}
            <div className="relative">
              <div className="flex items-center gap-1.5">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleSearchPlace();
                      }
                    }}
                    placeholder="Search pool, school, or town (e.g. Gampaha, Yakkala, Colombo)..."
                    className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-border bg-card text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-aqua"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleSearchPlace()}
                  disabled={isSearching || !searchQuery.trim()}
                  className="px-3 py-1.5 rounded-xl bg-secondary hover:bg-secondary/80 border border-border text-xs font-bold text-foreground disabled:opacity-50 flex items-center gap-1 shrink-0 transition-all"
                >
                  {isSearching ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-aqua" />
                  ) : (
                    <Search className="w-3.5 h-3.5 text-aqua" />
                  )}
                  <span>Find</span>
                </button>
              </div>

              {searchResults.length > 0 && (
                <div className="mt-1.5 rounded-xl border border-border bg-card shadow-xl divide-y divide-border/60 max-h-40 overflow-y-auto z-20 relative">
                  {searchResults.map((item) => (
                    <button
                      key={item.place_id}
                      type="button"
                      onClick={() => handlePickSearchResult(item)}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-secondary/60 flex items-start gap-2 transition-colors"
                    >
                      <MapPin className="w-3.5 h-3.5 text-aqua shrink-0 mt-0.5" />
                      <span className="truncate text-foreground">{item.display_name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Leaflet Map Interactive Viewport */}
          <div className="relative h-[230px] sm:h-[310px] w-full bg-ocean-950 shrink-0">
            <div ref={mapContainerRef} className="w-full h-full absolute inset-0 z-0" />

            {/* Floating map hint (top-left, while zoom controls are bottom-left) */}
            <div className="absolute top-2.5 left-2.5 right-2.5 sm:right-auto z-[400] bg-card/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-border/80 text-[11px] font-medium text-foreground shadow-lg flex items-center gap-1.5 pointer-events-none">
              <Info className="w-3.5 h-3.5 text-aqua shrink-0" />
              <span className="truncate">
                Tap map or drag 🏊 pin • {lat.toFixed(4)}, {lng.toFixed(4)}
              </span>
            </div>

            {/* Floating geofence indicator */}
            <div className="absolute bottom-2.5 right-2.5 z-[400] bg-card/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-aqua/40 text-[11px] font-bold text-aqua shadow-lg flex items-center gap-1.5 pointer-events-none">
              <Waves className="w-3.5 h-3.5" />
              <span>Geofence: {radius}m</span>
            </div>
          </div>

          {/* Location Details & Parameters Form */}
          <div className="p-4 sm:p-5 bg-card space-y-3">
            {/* Location Name */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-bold text-foreground">
                  Venue / Pool Name *
                </label>
                {isReverseGeocoding && (
                  <span className="text-[10px] text-aqua flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    <span>Detecting place name...</span>
                  </span>
                )}
              </div>
              <input
                type="text"
                value={locationName}
                onChange={(e) => {
                  setLocationName(e.target.value);
                  setHasCustomNameEdit(true);
                }}
                placeholder="e.g. Ranaviru Apparels Swimming Pool, Yakkala"
                className="w-full px-3 py-2 rounded-xl border border-border bg-secondary/50 text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-aqua"
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {/* Latitude */}
              <div>
                <label className="block text-[10px] font-semibold text-muted-foreground mb-1">
                  Latitude (Exact)
                </label>
                <input
                  type="number"
                  step="0.000001"
                  value={lat}
                  onChange={(e) => {
                    const parsed = parseFloat(e.target.value);
                    if (Number.isFinite(parsed)) {
                      handleCoordinateChange(parsed, lng);
                    }
                  }}
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
                  onChange={(e) => {
                    const parsed = parseFloat(e.target.value);
                    if (Number.isFinite(parsed)) {
                      handleCoordinateChange(lat, parsed);
                    }
                  }}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-secondary/40 text-foreground font-mono text-xs"
                />
              </div>

              {/* Geofence Radius */}
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-[10px] font-semibold text-muted-foreground mb-1 flex items-center justify-between">
                  <span>Check-in Radius</span>
                  <span className="text-aqua font-bold">{radius}m</span>
                </label>
                <div className="flex items-center gap-1">
                  {[50, DEFAULT_GEOFENCE_RADIUS_METERS, 100, 150].map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRadius(r)}
                      className={cn(
                        "flex-1 py-1.5 rounded-lg border text-[11px] font-bold transition-all",
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
          </div>
        </div>

        {/* Sticky Footer Action Buttons (Always visible on mobile & desktop) */}
        <div className="px-4 sm:px-5 py-3 bg-card border-t border-border/80 flex items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            disabled={isSaving}
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-border text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-secondary transition-all"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={handleConfirm}
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-aqua to-seafoam text-ocean-950 text-xs font-extrabold flex items-center gap-1.5 shadow-md hover:opacity-95 active:scale-95 transition-all disabled:opacity-60"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Saving Location...</span>
              </>
            ) : (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>{confirmLabel || `Use This Pool Location (${radius}m)`}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
