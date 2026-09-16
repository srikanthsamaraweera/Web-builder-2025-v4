"use client";

import { useEffect, useState } from "react";
import {
  CircleMarker,
  MapContainer,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";

const DEFAULT_CENTER = [7.8731, 80.7718];

function ClickSelector({ onChange }) {
  useMapEvents({
    click(event) {
      onChange({
        lat: Number(event.latlng.lat.toFixed(6)),
        lng: Number(event.latlng.lng.toFixed(6)),
      });
    },
  });
  return null;
}

function Recenter({ value }) {
  const map = useMap();
  useEffect(() => {
    if (value) map.setView([value.lat, value.lng], Math.max(map.getZoom(), 15));
  }, [map, value]);
  return null;
}

function ResizeMapWhenVisible() {
  const map = useMap();

  useEffect(() => {
    const container = map.getContainer();
    const refresh = () => map.invalidateSize({ animate: false });
    const observer = new ResizeObserver(refresh);
    observer.observe(container);
    const timer = window.setTimeout(refresh, 0);

    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
    };
  }, [map]);

  return null;
}

export default function MapLocationPicker({ value, onChange }) {
  const [locationError, setLocationError] = useState("");
  const [locating, setLocating] = useState(false);
  const center = value ? [value.lat, value.lng] : DEFAULT_CENTER;

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationError("Location access is not supported by this browser.");
      return;
    }
    setLocating(true);
    setLocationError("");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        onChange({
          lat: Number(coords.latitude.toFixed(6)),
          lng: Number(coords.longitude.toFixed(6)),
        });
        setLocating(false);
      },
      (error) => {
        setLocationError(error.message || "Unable to get your current location.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  };

  return (
    <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Map location</h3>
          <p className="mt-1 text-xs text-gray-600">
            Click the map to place the business marker. This is separate from the typed address.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={useCurrentLocation}
            disabled={locating}
            className="rounded border border-red-200 bg-white px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
          >
            {locating ? "Locating..." : "Use current location"}
          </button>
          {value ? (
            <button
              type="button"
              onClick={() => onChange(null)}
              className="rounded border border-gray-300 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-100"
            >
              Remove map location
            </button>
          ) : null}
        </div>
      </div>

      <div className="relative z-0 isolate overflow-hidden rounded-lg">
        <MapContainer
          center={center}
          zoom={value ? 15 : 7}
          scrollWheelZoom
          className="h-80 w-full"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ResizeMapWhenVisible />
          <ClickSelector onChange={onChange} />
          <Recenter value={value} />
          {value ? (
            <CircleMarker
              center={[value.lat, value.lng]}
              radius={9}
              pathOptions={{ color: "#991b1b", fillColor: "#dc2626", fillOpacity: 0.9 }}
            />
          ) : null}
        </MapContainer>
      </div>

      <p className="text-xs text-gray-600">
        {value
          ? `Selected coordinates: ${value.lat.toFixed(6)}, ${value.lng.toFixed(6)}`
          : "No map location selected. The published page will not display a map."}
      </p>
      {locationError ? <p className="text-xs text-red-600">{locationError}</p> : null}
    </div>
  );
}
