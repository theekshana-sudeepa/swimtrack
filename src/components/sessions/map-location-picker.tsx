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
  Star,
  BookmarkPlus,
  Repeat,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DEFAULT_GEOFENCE_RADIUS_METERS,
  DEFAULT_VENUE,
  MAX_GEOFENCE_RADIUS_METERS,
  MIN_GEOFENCE_RADIUS_METERS,
  PRESET_VENUES as GEO_PRESET_VENUES,
  clampGeofenceRadiusMeters,
  deriveShortVenueName,
  matchKnownVenueByName,
  parseCoordinatesInput,
} from "@/lib/geo-fence";
import type { PoolVenue } from "@/types/database";
import { toast } from "sonner";
import type {
  Map as LeafletMap,
  Marker as LeafletMarker,
  Circle as LeafletCircle,
} from "leaflet";

export interface SelectedLocationData {
  name: string;
  shortName?: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  venueId?: string | null;
  notes?: string;
  saveAsVenue?: boolean;
  isDefault?: boolean;
  applyToSeries?: boolean;
  applyToUpcoming?: boolean;
}

interface QuickVenueOption {
  id?: string;
  name: string;
  shortName: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  isDefault?: boolean;
  notes?: string | null;
}

interface MapLocationPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectLocation: (data: SelectedLocationData) => void | Promise<void | boolean>;
  initialLocation?: {
    name?: string;
    shortName?: string;
    latitude?: number | null;
    longitude?: number | null;
    radiusMeters?: number | null;
    venueId?: string | null;
    notes?: string | null;
    isDefault?: boolean;
  };
  savedVenues?: PoolVenue[];
  mode?: "session" | "venue";
  allowSaveAsVenue?: boolean;
  showApplyToSeries?: boolean;
  showApplyToUpcoming?: boolean;
  title?: string;
  confirmLabel?: string;
}

export const PRESET_VENUES = GEO_PRESET_VENUES;

interface NominatimSearchResult {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  name?: string;
}

function buildQuickVenueOptions(savedVenues?: PoolVenue[]): QuickVenueOption[] {
  if (savedVenues && savedVenues.length > 0) {
    return savedVenues.map((v) => ({
      id: v.id,
      name: v.name,
      shortName: v.short_name || deriveShortVenueName(v.name),
      latitude: v.latitude,
      longitude: v.longitude,
      radiusMeters: clampGeofenceRadiusMeters(v.radius_meters),
      isDefault: v.is_default,
      notes: v.notes,
    }));
  }
  return GEO_PRESET_VENUES.map((v, idx) => ({
    name: v.name,
    shortName: v.shortName,
    latitude: v.latitude,
    longitude: v.longitude,
    radiusMeters: v.radiusMeters,
    isDefault: idx === 0,
  }));
}

function resolveInitialCoordinates(
  initialLocation: MapLocationPickerModalProps["initialLocation"],
  quickVenues: QuickVenueOption[],
  mode: "session" | "venue" = "session"
) {
  const defaultOption = quickVenues.find((v) => v.isDefault) || quickVenues[0] || DEFAULT_VENUE;
  const matched = matchKnownVenueByName(initialLocation?.name, quickVenues);
  const lat =
    initialLocation?.latitude != null && Number.isFinite(Number(initialLocation.latitude))
      ? Number(initialLocation.latitude)
      : matched?.latitude ?? defaultOption.latitude;
  const lng =
    initialLocation?.longitude != null && Number.isFinite(Number(initialLocation.longitude))
      ? Number(initialLocation.longitude)
      : matched?.longitude ?? defaultOption.longitude;
  const radius =
    initialLocation?.radiusMeters != null && Number.isFinite(Number(initialLocation.radiusMeters))
      ? clampGeofenceRadiusMeters(Number(initialLocation.radiusMeters))
      : matched?.radiusMeters ?? defaultOption.radiusMeters ?? DEFAULT_GEOFENCE_RADIUS_METERS;
  const isNewBlankVenue = mode === "venue" && initialLocation?.name === "";
  const name = isNewBlankVenue
    ? ""
    : initialLocation?.name?.trim() || defaultOption.name;
  const shortName = isNewBlankVenue
    ? ""
    : initialLocation?.shortName?.trim() || deriveShortVenueName(name);
  const notes = initialLocation?.notes?.trim() || "";
  const venueId = initialLocation?.venueId ?? null;
  const isDefault = Boolean(initialLocation?.isDefault);

  return { name, shortName, lat, lng, radius, notes, venueId, isDefault };
}

function isGenericOrKnownVenueName(name: string, quickVenues: QuickVenueOption[]): boolean {
  const clean = name.trim().toLowerCase();
  if (!clean) return true;
  if (clean.startsWith("pinned pool location") || clean.startsWith("test pool location")) {
    return true;
  }
  return quickVenues.some((p) => p.name.toLowerCase() === clean);
}

export function MapLocationPickerModal({
  isOpen,
  onClose,
  onSelectLocation,
  initialLocation,
  savedVenues,
  mode = "session",
  allowSaveAsVenue = mode === "session",
  showApplyToSeries = false,
  showApplyToUpcoming = false,
  title = "Select Pool Location on Map",
  confirmLabel,
}: MapLocationPickerModalProps) {
  const mapContainerRef = React.useRef<HTMLDivElement>(null);
  const mapInstanceRef = React.useRef<LeafletMap | null>(null);
  const markerRef = React.useRef<LeafletMarker | null>(null);
  const circleRef = React.useRef<LeafletCircle | null>(null);

  const quickVenues = React.useMemo(
    () => buildQuickVenueOptions(savedVenues),
    [savedVenues]
  );

  const initName = initialLocation?.name;
  const initShortName = initialLocation?.shortName;
  const initLat = initialLocation?.latitude;
  const initLng = initialLocation?.longitude;
  const initRadius = initialLocation?.radiusMeters;
  const initVenueId = initialLocation?.venueId;
  const initNotes = initialLocation?.notes;
  const initIsDefault = initialLocation?.isDefault;

  const initial = React.useMemo(
    () =>
      resolveInitialCoordinates(
        {
          name: initName,
          shortName: initShortName,
          latitude: initLat,
          longitude: initLng,
          radiusMeters: initRadius,
          venueId: initVenueId,
          notes: initNotes,
          isDefault: initIsDefault,
        },
        quickVenues,
        mode
      ),
    [
      initName,
      initShortName,
      initLat,
      initLng,
      initRadius,
      initVenueId,
      initNotes,
      initIsDefault,
      quickVenues,
      mode,
    ]
  );

  const [locationName, setLocationName] = React.useState(initial.name);
  const [shortName, setShortName] = React.useState(initial.shortName);
  const [hasCustomShortNameEdit, setHasCustomShortNameEdit] = React.useState(
    Boolean(initShortName)
  );
  const [notes, setNotes] = React.useState(initial.notes);
  const [selectedVenueId, setSelectedVenueId] = React.useState<string | null>(initial.venueId);
  const [lat, setLat] = React.useState(initial.lat);
  const [lng, setLng] = React.useState(initial.lng);
  const [latInput, setLatInput] = React.useState(String(initial.lat));
  const [lngInput, setLngInput] = React.useState(String(initial.lng));
  const [radius, setRadius] = React.useState(initial.radius);
  const [saveAsVenue, setSaveAsVenue] = React.useState(false);
  const [isDefault, setIsDefault] = React.useState(initial.isDefault);
  const [applyToSeries, setApplyToSeries] = React.useState(false);
  const [applyToUpcoming, setApplyToUpcoming] = React.useState(false);
  const [isLocating, setIsLocating] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isReverseGeocoding, setIsReverseGeocoding] = React.useState(false);
  const [hasCustomNameEdit, setHasCustomNameEdit] = React.useState(
    Boolean(mode === "venue" && initName)
  );
  const reverseGeocodeSeqRef = React.useRef(0);

  // Place search state
  const [searchQuery, setSearchQuery] = React.useState("");
  const [isSearching, setIsSearching] = React.useState(false);
  const [searchResults, setSearchResults] = React.useState<NominatimSearchResult[]>([]);

  const locationNameRef = React.useRef(locationName);
  const hasCustomNameEditRef = React.useRef(hasCustomNameEdit);
  const hasCustomShortNameEditRef = React.useRef(hasCustomShortNameEdit);
  const quickVenuesRef = React.useRef(quickVenues);

  React.useEffect(() => {
    locationNameRef.current = locationName;
  }, [locationName]);
  React.useEffect(() => {
    hasCustomNameEditRef.current = hasCustomNameEdit;
  }, [hasCustomNameEdit]);
  React.useEffect(() => {
    hasCustomShortNameEditRef.current = hasCustomShortNameEdit;
  }, [hasCustomShortNameEdit]);
  React.useEffect(() => {
    quickVenuesRef.current = quickVenues;
  }, [quickVenues]);

  // Re-synchronize state whenever modal opens or initialLocation changes
  React.useEffect(() => {
    if (!isOpen) return;
    setLocationName(initial.name);
    setShortName(initial.shortName);
    setHasCustomShortNameEdit(Boolean(initShortName));
    setNotes(initial.notes);
    setSelectedVenueId(initial.venueId);
    setLat(initial.lat);
    setLng(initial.lng);
    setLatInput(String(initial.lat));
    setLngInput(String(initial.lng));
    setRadius(initial.radius);
    setIsDefault(initial.isDefault);
    setSaveAsVenue(false);
    setApplyToSeries(false);
    setApplyToUpcoming(false);
    setHasCustomNameEdit(Boolean(mode === "venue" && initName));
    setSearchQuery("");
    setSearchResults([]);
  }, [isOpen, initial, initShortName, initName, mode]);

  // Determine if current coordinates already match one of the saved swimming places
  const matchedSavedVenue = React.useMemo(() => {
    return (
      quickVenues.find(
        (v) =>
          Math.abs(lat - v.latitude) < 0.00025 &&
          Math.abs(lng - v.longitude) < 0.00025
      ) || null
    );
  }, [quickVenues, lat, lng]);

  // Reverse geocode helper when pin is moved on map (sequence-guarded against out-of-order responses)
  const reverseGeocodeCoordinates = React.useCallback(
    async (targetLat: number, targetLng: number, forceUpdateName = false) => {
      const seq = ++reverseGeocodeSeqRef.current;
      const venuesList = quickVenuesRef.current;

      // In session mode, snap to a nearby saved swimming place (< ~55m)
      if (mode === "session") {
        for (const preset of venuesList) {
          const dLat = Math.abs(targetLat - preset.latitude);
          const dLng = Math.abs(targetLng - preset.longitude);
          if (dLat < 0.0005 && dLng < 0.0005) {
            setSelectedVenueId(preset.id ?? null);
            if (
              forceUpdateName ||
              !hasCustomNameEditRef.current ||
              isGenericOrKnownVenueName(locationNameRef.current, venuesList)
            ) {
              setLocationName(preset.name);
              if (!hasCustomShortNameEditRef.current) {
                setShortName(preset.shortName);
              }
            }
            return;
          }
        }
        setSelectedVenueId(null);
      }

      const shouldUpdateName =
        forceUpdateName ||
        !locationNameRef.current.trim() ||
        (!hasCustomNameEditRef.current &&
          isGenericOrKnownVenueName(locationNameRef.current, venuesList));

      if (!shouldUpdateName) return;

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
        if (seq !== reverseGeocodeSeqRef.current) return;
        if (res.ok) {
          const data = await res.json();
          if (seq !== reverseGeocodeSeqRef.current) return;
          if (data && data.display_name) {
            const parts = String(data.display_name)
              .split(",")
              .map((s: string) => s.trim())
              .filter(Boolean);
            const conciseName = parts.slice(0, 3).join(", ");
            if (conciseName && (!hasCustomNameEditRef.current || forceUpdateName)) {
              setLocationName(conciseName);
              if (!hasCustomShortNameEditRef.current) {
                setShortName(deriveShortVenueName(conciseName));
              }
              return;
            }
          }
        }
      } catch {
        // Fallback below if offline or rate-limited
      } finally {
        if (seq === reverseGeocodeSeqRef.current) {
          setIsReverseGeocoding(false);
        }
      }

      if (
        seq === reverseGeocodeSeqRef.current &&
        !hasCustomNameEditRef.current &&
        isGenericOrKnownVenueName(locationNameRef.current, venuesList)
      ) {
        const fallbackName = `Pinned Pool Location (${targetLat.toFixed(4)}, ${targetLng.toFixed(4)})`;
        setLocationName(fallbackName);
        if (!hasCustomShortNameEditRef.current) {
          setShortName("Pinned Pool");
        }
      }
    },
    [mode]
  );

  // Initialize or update Leaflet map when modal opens
  React.useEffect(() => {
    if (!isOpen || !mapContainerRef.current) return;

    let isMounted = true;
    let resizeObserver: ResizeObserver | null = null;
    const startCoords = resolveInitialCoordinates(initialLocation, quickVenues, mode);

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
        setLatInput(String(roundedLat));
        setLngInput(String(roundedLng));
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
        setLatInput(String(roundedLat));
        setLngInput(String(roundedLng));
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

  // Search for a place / pool on OpenStreetMap OR directly jump to pasted Google Maps coordinates/URL
  async function handleSearchPlace(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;

    // Instant support for pasted "lat, lng" or Google Maps URLs
    const parsedCoords = parseCoordinatesInput(q);
    if (parsedCoords) {
      setLat(parsedCoords.latitude);
      setLng(parsedCoords.longitude);
      setLatInput(String(parsedCoords.latitude));
      setLngInput(String(parsedCoords.longitude));
      setSelectedVenueId(null);
      setSearchResults([]);
      if (mapInstanceRef.current && markerRef.current && circleRef.current) {
        mapInstanceRef.current.flyTo([parsedCoords.latitude, parsedCoords.longitude], 18);
        markerRef.current.setLatLng([parsedCoords.latitude, parsedCoords.longitude]);
        circleRef.current.setLatLng([parsedCoords.latitude, parsedCoords.longitude]);
      }
      reverseGeocodeCoordinates(
        parsedCoords.latitude,
        parsedCoords.longitude,
        !hasCustomNameEditRef.current
      );
      toast.success(
        `Jumped pin to ${parsedCoords.latitude.toFixed(5)}, ${parsedCoords.longitude.toFixed(5)}`
      );
      return;
    }

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
        toast.info(
          "No matching places found. Try a broader town/pool name, paste Google Maps coordinates (e.g. 6.9056, 79.8614), or click directly on the map."
        );
      } else if (results.length === 1) {
        handlePickSearchResult(results[0]);
      }
    } catch {
      toast.error(
        "Could not search map places right now. You can still paste coordinates, drag the pin, or click the map."
      );
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
    if (!hasCustomShortNameEditRef.current) {
      setShortName(deriveShortVenueName(cleanName));
    }
    setHasCustomNameEdit(true);
    setSelectedVenueId(null);
    setLat(newLat);
    setLng(newLng);
    setLatInput(String(newLat));
    setLngInput(String(newLng));
    setSearchResults([]);

    if (mapInstanceRef.current && markerRef.current && circleRef.current) {
      mapInstanceRef.current.flyTo([newLat, newLng], 17);
      markerRef.current.setLatLng([newLat, newLng]);
      circleRef.current.setLatLng([newLat, newLng]);
    }
    toast.success(`Moved pin to ${cleanName}`);
  }

  // Quick saved-pool jumper
  function handleSelectQuickVenue(preset: QuickVenueOption) {
    setLocationName(preset.name);
    setShortName(preset.shortName);
    setHasCustomNameEdit(false);
    setHasCustomShortNameEdit(false);
    setSelectedVenueId(preset.id ?? null);
    setLat(preset.latitude);
    setLng(preset.longitude);
    setLatInput(String(preset.latitude));
    setLngInput(String(preset.longitude));
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
      setLatInput(String(myLat));
      setLngInput(String(myLng));
      setSelectedVenueId(null);
      if (
        !hasCustomNameEditRef.current ||
        isGenericOrKnownVenueName(locationNameRef.current, quickVenuesRef.current)
      ) {
        setLocationName("Pinned Pool Location (My GPS)");
      }
      reverseGeocodeCoordinates(myLat, myLng, !hasCustomNameEditRef.current);

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
          toast.error(
            "Location permission was denied. Please allow location access in your browser."
          );
          return;
        }
        // Fallback to standard accuracy (Wi-Fi / network) for laptops & indoor desktops
        navigator.geolocation.getCurrentPosition(
          onSuccess,
          () => {
            setIsLocating(false);
            toast.error(
              "Could not get GPS fix. You can also search a place or click directly on the map."
            );
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
    setSelectedVenueId(null);
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
      const clampedRadius = clampGeofenceRadiusMeters(radius);
      const result = await onSelectLocation({
        name: locationName.trim(),
        shortName: shortName.trim() || deriveShortVenueName(locationName),
        latitude: Number(lat.toFixed(6)),
        longitude: Number(lng.toFixed(6)),
        radiusMeters: clampedRadius,
        venueId: selectedVenueId ?? matchedSavedVenue?.id ?? null,
        notes: notes.trim() || undefined,
        saveAsVenue: mode === "session" && allowSaveAsVenue ? saveAsVenue : undefined,
        isDefault: mode === "venue" ? isDefault : undefined,
        applyToSeries: showApplyToSeries ? applyToSeries : undefined,
        applyToUpcoming: showApplyToUpcoming ? applyToUpcoming : undefined,
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

  const computedConfirmLabel = confirmLabel
    ? confirmLabel.includes("m)")
      ? confirmLabel
      : `${confirmLabel} (${radius}m)`
    : `Use This Pool Location (${radius}m)`;

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
                Pick from your saved swimming places, search any pool, tap the map, or drag the 🏊 pin.
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

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto min-h-0 flex flex-col">
          {/* Saved Swimming Places, Search & Current Location */}
          <div className="px-4 sm:px-5 py-2.5 bg-secondary/30 border-b border-border/60 space-y-2 shrink-0">
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-[11px] font-bold text-muted-foreground flex items-center gap-1 mr-1">
                <Sparkles className="w-3 h-3 text-aqua" />
                <span>{savedVenues && savedVenues.length > 0 ? "My Pools:" : "Presets:"}</span>
              </span>

              {quickVenues.map((preset) => {
                const isSelected =
                  Math.abs(lat - preset.latitude) < 0.00025 &&
                  Math.abs(lng - preset.longitude) < 0.00025;
                return (
                  <button
                    key={preset.id || preset.name}
                    type="button"
                    onClick={() => handleSelectQuickVenue(preset)}
                    className={cn(
                      "px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition-all inline-flex items-center gap-1",
                      isSelected
                        ? "bg-aqua/20 text-aqua border-aqua/50 shadow-sm"
                        : "bg-secondary/60 hover:bg-secondary text-foreground border-border"
                    )}
                  >
                    {preset.isDefault && (
                      <Star className="w-3 h-3 text-amber-400 fill-amber-400 shrink-0" />
                    )}
                    <span>{preset.shortName}</span>
                    <span className="text-[10px] opacity-70">({preset.radiusMeters}m)</span>
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
                <span>{isLocating ? "Locating..." : "Pin My GPS"}</span>
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
                    placeholder="Search pool, city, or paste Google Maps coords (e.g. 6.9056, 79.8614)..."
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
          <div className="relative h-[220px] sm:h-[290px] w-full bg-ocean-950 shrink-0">
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
            {/* Location Name (+ Short Label in venue mode) */}
            <div className={cn("grid gap-2.5", mode === "venue" ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-1")}>
              <div className={cn(mode === "venue" && "sm:col-span-2")}>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-bold text-foreground">
                    Swimming Place / Pool Name *
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
                    const val = e.target.value;
                    setLocationName(val);
                    setHasCustomNameEdit(true);
                    if (!hasCustomShortNameEdit) {
                      setShortName(deriveShortVenueName(val));
                    }
                  }}
                  placeholder="e.g. Royal College Aquatic Complex, Colombo"
                  className="w-full px-3 py-2 rounded-xl border border-border bg-secondary/50 text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-aqua"
                />
              </div>

              {mode === "venue" && (
                <div>
                  <label className="block text-[11px] font-bold text-foreground mb-1">
                    Short Label
                  </label>
                  <input
                    type="text"
                    value={shortName}
                    onChange={(e) => {
                      setShortName(e.target.value);
                      setHasCustomShortNameEdit(true);
                    }}
                    placeholder="e.g. Royal Pool"
                    className="w-full px-3 py-2 rounded-xl border border-border bg-secondary/50 text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-aqua"
                  />
                </div>
              )}
            </div>

            {mode === "venue" && (
              <div>
                <label className="block text-[11px] font-bold text-foreground mb-1">
                  Pool Notes (Optional)
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. 50m outdoor pool, enter via North Gate, lockers on left"
                  className="w-full px-3 py-2 rounded-xl border border-border bg-secondary/50 text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-aqua"
                />
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {/* Latitude */}
              <div>
                <label className="block text-[10px] font-semibold text-muted-foreground mb-1">
                  Latitude (Exact)
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={latInput}
                  onChange={(e) => {
                    const raw = e.target.value;
                    // Allow pasting "lat, lng" directly from Google Maps into the Latitude box
                    const pair = parseCoordinatesInput(raw);
                    if (pair) {
                      setLatInput(String(pair.latitude));
                      setLngInput(String(pair.longitude));
                      handleCoordinateChange(pair.latitude, pair.longitude);
                      return;
                    }
                    setLatInput(raw);
                    const parsed = parseFloat(raw);
                    if (Number.isFinite(parsed) && Math.abs(parsed) <= 90) {
                      handleCoordinateChange(parsed, lng);
                    }
                  }}
                  onBlur={() => setLatInput(String(lat))}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-secondary/40 text-foreground font-mono text-xs focus:outline-none focus:ring-1 focus:ring-aqua"
                />
              </div>

              {/* Longitude */}
              <div>
                <label className="block text-[10px] font-semibold text-muted-foreground mb-1">
                  Longitude (Exact)
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={lngInput}
                  onChange={(e) => {
                    const raw = e.target.value;
                    const pair = parseCoordinatesInput(raw);
                    if (pair) {
                      setLatInput(String(pair.latitude));
                      setLngInput(String(pair.longitude));
                      handleCoordinateChange(pair.latitude, pair.longitude);
                      return;
                    }
                    setLngInput(raw);
                    const parsed = parseFloat(raw);
                    if (Number.isFinite(parsed) && Math.abs(parsed) <= 180) {
                      handleCoordinateChange(lat, parsed);
                    }
                  }}
                  onBlur={() => setLngInput(String(lng))}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-secondary/40 text-foreground font-mono text-xs focus:outline-none focus:ring-1 focus:ring-aqua"
                />
              </div>

              {/* Geofence Radius Presets + Slider */}
              <div className="col-span-2">
                <label className="block text-[10px] font-semibold text-muted-foreground mb-1 flex items-center justify-between">
                  <span>Check-in Geofence Radius</span>
                  <span className="text-aqua font-bold font-mono">{radius}m</span>
                </label>
                <div className="flex items-center gap-1">
                  {[50, DEFAULT_GEOFENCE_RADIUS_METERS, 100, 150, 200].map((r) => (
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
                <input
                  type="range"
                  min={MIN_GEOFENCE_RADIUS_METERS}
                  max={MAX_GEOFENCE_RADIUS_METERS}
                  step={5}
                  value={radius}
                  onChange={(e) => setRadius(clampGeofenceRadiusMeters(Number(e.target.value)))}
                  aria-label="Fine-tune check-in radius in meters"
                  className="w-full mt-1.5 accent-aqua h-1.5 cursor-pointer"
                />
              </div>
            </div>

            {/* Contextual Checkboxes */}
            <div className="space-y-2 pt-1">
              {mode === "session" && allowSaveAsVenue && !matchedSavedVenue && (
                <label className="flex items-center gap-2 p-2.5 rounded-xl border border-seafoam/30 bg-seafoam/5 text-xs text-foreground cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={saveAsVenue}
                    onChange={(e) => setSaveAsVenue(e.target.checked)}
                    className="rounded border-border text-aqua focus:ring-aqua"
                  />
                  <BookmarkPlus className="w-3.5 h-3.5 text-seafoam shrink-0" />
                  <span>
                    Save <strong className="text-seafoam">&ldquo;{locationName.trim() || "this pool"}&rdquo;</strong> to <strong>My Swimming Places</strong> for 1-click reuse
                  </span>
                </label>
              )}

              {showApplyToSeries && (
                <label className="flex items-center gap-2 p-2.5 rounded-xl border border-aqua/30 bg-aqua/5 text-xs text-foreground cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={applyToSeries}
                    onChange={(e) => setApplyToSeries(e.target.checked)}
                    className="rounded border-border text-aqua focus:ring-aqua"
                  />
                  <Repeat className="w-3.5 h-3.5 text-aqua shrink-0" />
                  <span>
                    Also apply this pool location &amp; GPS pin to all upcoming sessions in this recurring series
                  </span>
                </label>
              )}

              {mode === "venue" && (
                <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isDefault}
                    onChange={(e) => setIsDefault(e.target.checked)}
                    className="rounded border-border text-aqua focus:ring-aqua"
                  />
                  <Star className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>Set as club&apos;s Default Swimming Place (used automatically for new sessions)</span>
                </label>
              )}

              {showApplyToUpcoming && (
                <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={applyToUpcoming}
                    onChange={(e) => setApplyToUpcoming(e.target.checked)}
                    className="rounded border-border text-aqua focus:ring-aqua"
                  />
                  <span>Also update pool location &amp; GPS pin on matching upcoming scheduled sessions</span>
                </label>
              )}
            </div>
          </div>
        </div>

        {/* Sticky Footer Action Buttons */}
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
                <span>{computedConfirmLabel}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
