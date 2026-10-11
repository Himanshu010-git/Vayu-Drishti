import React, { useEffect, useState, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Crosshair, MapPin, Navigation } from 'lucide-react';

interface MapPickerProps {
  position: { lat: number; lng: number } | null;
  onPositionChange: (pos: { lat: number; lng: number }) => void;
}

// Preset locations in Delhi NCR for quick pinpointing
const DELHI_PRESETS = [
  { name: 'Connaught Place', lat: 28.6315, lng: 77.2167 },
  { name: 'Anand Vihar', lat: 28.6469, lng: 77.3160 },
  { name: 'Rohini Sector 16', lat: 28.7360, lng: 77.1120 },
  { name: 'Gurugram Cyber Hub', lat: 28.4950, lng: 77.0895 },
  { name: 'Noida Sector 62', lat: 28.6270, lng: 77.3620 },
];

const DEFAULT_CENTER: [number, number] = [28.6139, 77.2090]; // Central New Delhi

// Inner component to capture click events on the map
function MapEventsHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(Number(e.latlng.lat.toFixed(5)), Number(e.latlng.lng.toFixed(5)));
    },
  });
  return null;
}

// Inner component to pan/fly map to selected coordinates
function MapFlyController({ center }: { center: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.flyTo(center, Math.max(map.getZoom(), 14), { duration: 0.8 });
    }
  }, [center, map]);
  return null;
}

export const MapPicker: React.FC<MapPickerProps> = ({ position, onPositionChange }) => {
  const [flyTarget, setFlyTarget] = useState<[number, number] | null>(null);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);

  // Custom futuristic glowing pin marker icon
  const customMarkerIcon = useMemo(() => {
    return L.divIcon({
      className: 'custom-pin-marker',
      html: `
        <div class="custom-pin-pulse"></div>
        <div class="custom-pin-core"></div>
      `,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
    });
  }, []);

  const handleMapClick = (lat: number, lng: number) => {
    onPositionChange({ lat, lng });
    setLocateError(null);
  };

  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      setLocateError('Geolocation is not supported by your browser.');
      return;
    }

    setLocating(true);
    setLocateError(null);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(5));
        const lng = Number(pos.coords.longitude.toFixed(5));
        onPositionChange({ lat, lng });
        setFlyTarget([lat, lng]);
        setLocating(false);
      },
      (err) => {
        setLocating(false);
        setLocateError(err.message || 'Unable to retrieve your current location.');
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  const handleSelectPreset = (lat: number, lng: number) => {
    onPositionChange({ lat, lng });
    setFlyTarget([lat, lng]);
  };

  return (
    <div className="map-panel glass-panel">
      <div className="map-header">
        <div className="map-header-title">
          <MapPin size={20} color="var(--cyan-400)" />
          <span>Interactive Location Picker</span>
        </div>
        <div className="map-tools">
          <button
            type="button"
            className="btn-tool"
            onClick={handleLocateMe}
            disabled={locating}
            title="Use Current Device GPS Location"
          >
            <Navigation size={14} className={locating ? 'spinning' : ''} />
            <span>{locating ? 'Locating...' : 'Locate Me'}</span>
          </button>
        </div>
      </div>

      <div className="map-container-box">
        <MapContainer
          center={position ? [position.lat, position.lng] : DEFAULT_CENTER}
          zoom={12}
          scrollWheelZoom={true}
          style={{ width: '100%', height: '100%' }}
        >
          {/* CartoDB Dark Matter tiles for ultra-sleek obsidian map look */}
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={19}
          />

          <MapEventsHandler onPick={handleMapClick} />
          <MapFlyController center={flyTarget} />

          {position && (
            <Marker
              position={[position.lat, position.lng]}
              icon={customMarkerIcon}
              draggable={true}
              eventHandlers={{
                dragend(e) {
                  const marker = e.target;
                  const pos = marker.getLatLng();
                  onPositionChange({
                    lat: Number(pos.lat.toFixed(5)),
                    lng: Number(pos.lng.toFixed(5)),
                  });
                },
              }}
            />
          )}
        </MapContainer>
      </div>

      {locateError && (
        <div style={{ color: 'var(--rose-500)', fontSize: '0.78rem', marginTop: '0.5rem' }}>
          {locateError}
        </div>
      )}

      <div className="map-pin-badge">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
          <Crosshair size={15} color="var(--emerald-400)" />
          <span>Selected Pin:</span>
        </div>
        {position ? (
          <span className="coords">
            {position.lat.toFixed(4)}° N, {position.lng.toFixed(4)}° E
          </span>
        ) : (
          <span style={{ color: 'var(--text-muted)' }}>Click map or drop a pin</span>
        )}
      </div>

      <div className="preset-pills">
        <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', alignSelf: 'center' }}>
          NCR Hotspots:
        </span>
        {DELHI_PRESETS.map((preset) => (
          <button
            key={preset.name}
            type="button"
            className="preset-pill"
            onClick={() => handleSelectPreset(preset.lat, preset.lng)}
          >
            {preset.name}
          </button>
        ))}
      </div>
    </div>
  );
};
