import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  useMap,
} from 'react-leaflet';
import {
  Map,
  RefreshCw,
  AlertCircle,
  Layers,
  Target,
  Info,
  TrendingUp,
  Flame,
  Leaf,
  AlertTriangle,
} from 'lucide-react';
import { listReports } from '../services/api';
import type { DustReportResponse } from '../types/report';

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

const DEFAULT_CENTER: [number, number] = [28.6139, 77.209]; // New Delhi
const DEFAULT_ZOOM = 11;

function priorityColor(score: number): string {
  if (score > 70) return '#f43f5e';    // red   — critical
  if (score >= 40) return '#f59e0b';   // amber — medium
  return '#10b981';                    // green — low
}

function priorityLabel(score: number): { label: string; cls: string } {
  if (score > 70) return { label: 'High', cls: 'high' };
  if (score >= 40) return { label: 'Medium', cls: 'medium' };
  return { label: 'Low', cls: 'low' };
}

function circleRadius(score: number): number {
  // Larger circles for higher priority so hotspots pop out visually
  if (score > 70) return 14;
  if (score >= 40) return 10;
  return 7;
}

function truncate(str: string, n: number): string {
  return str.length > n ? str.slice(0, n) + '…' : str;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

// --------------------------------------------------------------------------
// Map auto-fit to markers
// --------------------------------------------------------------------------

const MapAutoFit: React.FC<{ reports: DustReportResponse[] }> = ({ reports }) => {
  const map = useMap();
  const fitted = useRef(false);

  useEffect(() => {
    if (reports.length === 0 || fitted.current) return;
    const latlngs = reports.map((r) => [r.latitude, r.longitude] as [number, number]);
    try {
      map.fitBounds(latlngs, { padding: [48, 48], maxZoom: 14, animate: true, duration: 0.8 });
      fitted.current = true;
    } catch {
      // bounds may fail if all points are identical
    }
  }, [reports, map]);

  return null;
};

// --------------------------------------------------------------------------
// Stats bar
// --------------------------------------------------------------------------

const StatsBar: React.FC<{ reports: DustReportResponse[] }> = ({ reports }) => {
  const high = reports.filter((r) => r.priority_score > 70).length;
  const medium = reports.filter((r) => r.priority_score >= 40 && r.priority_score <= 70).length;
  const low = reports.filter((r) => r.priority_score < 40).length;
  const avg =
    reports.length > 0
      ? reports.reduce((s, r) => s + r.priority_score, 0) / reports.length
      : 0;

  return (
    <div className="map-stats-bar glass-panel">
      <div className="map-stat">
        <div className="map-stat-icon" style={{ background: 'rgba(244,63,94,0.15)', color: '#f43f5e' }}>
          <Flame size={16} />
        </div>
        <div>
          <div className="map-stat-value" style={{ color: '#f87171' }}>{high}</div>
          <div className="map-stat-label">High Priority</div>
        </div>
      </div>

      <div className="map-stat-divider" />

      <div className="map-stat">
        <div className="map-stat-icon" style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>
          <AlertTriangle size={16} />
        </div>
        <div>
          <div className="map-stat-value" style={{ color: '#fbbf24' }}>{medium}</div>
          <div className="map-stat-label">Medium Priority</div>
        </div>
      </div>

      <div className="map-stat-divider" />

      <div className="map-stat">
        <div className="map-stat-icon" style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981' }}>
          <Leaf size={16} />
        </div>
        <div>
          <div className="map-stat-value" style={{ color: '#34d399' }}>{low}</div>
          <div className="map-stat-label">Low Priority</div>
        </div>
      </div>

      <div className="map-stat-divider" />

      <div className="map-stat">
        <div className="map-stat-icon" style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8' }}>
          <TrendingUp size={16} />
        </div>
        <div>
          <div className="map-stat-value" style={{ color: '#a5b4fc' }}>{avg.toFixed(1)}</div>
          <div className="map-stat-label">Avg Priority</div>
        </div>
      </div>

      <div className="map-stat-divider" />

      <div className="map-stat">
        <div className="map-stat-icon" style={{ background: 'rgba(6,182,212,0.15)', color: '#06b6d4' }}>
          <Layers size={16} />
        </div>
        <div>
          <div className="map-stat-value" style={{ color: '#22d3ee' }}>{reports.length}</div>
          <div className="map-stat-label">Total Reports</div>
        </div>
      </div>
    </div>
  );
};

// --------------------------------------------------------------------------
// Legend
// --------------------------------------------------------------------------

const MapLegend: React.FC = () => (
  <div className="map-legend glass-panel">
    <div className="map-legend-title">
      <Info size={13} />
      Priority Legend
    </div>
    <div className="map-legend-item">
      <span className="map-legend-dot" style={{ background: '#f43f5e', boxShadow: '0 0 8px #f43f5e' }} />
      <span>High &gt; 70</span>
    </div>
    <div className="map-legend-item">
      <span className="map-legend-dot" style={{ background: '#f59e0b', boxShadow: '0 0 8px #f59e0b' }} />
      <span>Medium 40–70</span>
    </div>
    <div className="map-legend-item">
      <span className="map-legend-dot" style={{ background: '#10b981', boxShadow: '0 0 8px #10b981' }} />
      <span>Low &lt; 40</span>
    </div>
  </div>
);

// --------------------------------------------------------------------------
// Main MapPage
// --------------------------------------------------------------------------

export const MapPage: React.FC = () => {
  const [reports, setReports] = useState<DustReportResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listReports(200);
      setReports(data);
      setLastRefresh(new Date());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load reports for map.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div className="page-badge">
          <Target size={13} />
          <span>Live Incident Intelligence</span>
        </div>
        <h1 className="page-title">Citywide Dust Incident Map</h1>
        <p className="page-subtitle">
          Real-time heatmap of all submitted pollution incidents across the NCR region,
          colour-coded by AI-computed priority score.
        </p>
      </div>

      {/* Stats Bar */}
      {!loading && !error && reports.length > 0 && (
        <StatsBar reports={reports} />
      )}

      {/* Map Card */}
      <div className="glass-panel map-page-card">
        {/* Toolbar */}
        <div className="map-page-toolbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Map size={18} color="var(--cyan-400)" />
            <span style={{ fontWeight: 700, fontSize: '1rem' }}>Live Incident Map</span>
            {!loading && (
              <span className="reports-count-pill">{reports.length} markers</span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {!loading && (
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Last updated: {lastRefresh.toLocaleTimeString('en-IN')}
              </span>
            )}
            <button
              type="button"
              className="btn-tool"
              onClick={fetchReports}
              disabled={loading}
              title="Refresh markers"
            >
              <RefreshCw size={14} className={loading ? 'spinning' : ''} />
              <span>{loading ? 'Loading…' : 'Refresh'}</span>
            </button>
          </div>
        </div>

        {/* Map Container */}
        <div className="map-page-container">
          {error ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                gap: '1rem',
                color: 'var(--text-secondary)',
              }}
            >
              <AlertCircle size={40} color="var(--rose-500)" />
              <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>Map Failed to Load</div>
              <div style={{ fontSize: '0.88rem', color: 'var(--text-muted)', textAlign: 'center', maxWidth: '380px' }}>
                {error}
              </div>
              <button type="button" className="btn-secondary" onClick={fetchReports}>
                <RefreshCw size={14} />
                <span>Retry</span>
              </button>
            </div>
          ) : (
            <MapContainer
              center={DEFAULT_CENTER}
              zoom={DEFAULT_ZOOM}
              scrollWheelZoom
              style={{ width: '100%', height: '100%' }}
            >
              {/* CartoDB Dark Matter tiles — matches our obsidian design */}
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                maxZoom={19}
              />

              {/* Auto-fit bounds once data loads */}
              {reports.length > 0 && <MapAutoFit reports={reports} />}

              {/* Circle Markers */}
              {reports.map((report) => {
                const color = priorityColor(report.priority_score);
                const radius = circleRadius(report.priority_score);
                const { label, cls } = priorityLabel(report.priority_score);

                return (
                  <CircleMarker
                    key={report.report_id}
                    center={[report.latitude, report.longitude]}
                    radius={radius}
                    pathOptions={{
                      color,
                      fillColor: color,
                      fillOpacity: 0.75,
                      weight: 2,
                      opacity: 0.9,
                    }}
                    eventHandlers={{
                      mouseover(e) {
                        e.target.setStyle({ fillOpacity: 1, weight: 3 });
                      },
                      mouseout(e) {
                        e.target.setStyle({ fillOpacity: 0.75, weight: 2 });
                      },
                    }}
                  >
                    <Popup
                      className="map-custom-popup"
                      maxWidth={300}
                      minWidth={240}
                    >
                      <div className="map-popup-inner">
                        {/* Header */}
                        <div className="map-popup-header">
                          <span
                            className="map-popup-dot"
                            style={{ background: color, boxShadow: `0 0 8px ${color}` }}
                          />
                          <span className="map-popup-id">
                            {report.report_id.slice(0, 8)}…{report.report_id.slice(-6)}
                          </span>
                          <span className={`status-badge ${report.status}`} style={{ fontSize: '0.68rem', padding: '0.18rem 0.55rem' }}>
                            {report.status}
                          </span>
                        </div>

                        {/* Priority Score */}
                        <div className="map-popup-priority">
                          <div className="map-popup-priority-label">
                            Priority Score
                          </div>
                          <div className="priority-meter" style={{ marginTop: '0.3rem' }}>
                            <div className="priority-meter-bar">
                              <div
                                className={`priority-meter-fill ${cls}`}
                                style={{ width: `${report.priority_score}%` }}
                              />
                            </div>
                            <span className={`priority-score-label ${cls}`}>
                              {report.priority_score.toFixed(1)}
                            </span>
                          </div>
                          <div
                            style={{
                              fontSize: '0.72rem',
                              color: color,
                              fontWeight: 700,
                              marginTop: '0.25rem',
                              textTransform: 'uppercase',
                              letterSpacing: '0.05em',
                            }}
                          >
                            {label} Priority
                          </div>
                        </div>

                        {/* Location */}
                        <div className="map-popup-row">
                          <span className="map-popup-key">Location</span>
                          <span className="map-popup-val">
                            {report.address
                              ? truncate(report.address, 40)
                              : `${report.latitude.toFixed(4)}° N, ${report.longitude.toFixed(4)}° E`}
                          </span>
                        </div>

                        {/* Description */}
                        {report.description && (
                          <div className="map-popup-row">
                            <span className="map-popup-key">Description</span>
                            <span className="map-popup-val">
                              {truncate(report.description, 80)}
                            </span>
                          </div>
                        )}

                        {/* AI Analysis summary */}
                        {report.analysis && !report.analysis.analysis_failed && (
                          <div className="map-popup-ai">
                            <span className="map-popup-key">AI Verdict</span>
                            <div style={{ marginTop: '0.3rem', display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                              <span
                                className={`severity-chip ${report.analysis.severity}`}
                                style={{ fontSize: '0.68rem' }}
                              >
                                {report.analysis.severity}
                              </span>
                              <span
                                style={{
                                  fontSize: '0.72rem',
                                  color: report.analysis.dust_detected
                                    ? 'var(--emerald-400)'
                                    : 'var(--text-muted)',
                                  fontWeight: 600,
                                }}
                              >
                                {report.analysis.dust_detected ? '✓ Dust Detected' : '✗ No Dust'}
                              </span>
                              <span
                                style={{
                                  fontSize: '0.72rem',
                                  color: 'var(--text-muted)',
                                  textTransform: 'capitalize',
                                }}
                              >
                                {report.analysis.dust_category.replace(/_/g, ' ')}
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Date */}
                        <div
                          style={{
                            fontSize: '0.72rem',
                            color: 'var(--text-muted)',
                            marginTop: '0.75rem',
                            borderTop: '1px solid rgba(255,255,255,0.06)',
                            paddingTop: '0.6rem',
                          }}
                        >
                          Submitted {formatDate(report.created_at)}
                        </div>
                      </div>
                    </Popup>
                  </CircleMarker>
                );
              })}
            </MapContainer>
          )}

          {/* Loading overlay */}
          {loading && (
            <div className="map-loading-overlay">
              <div className="map-loading-spinner" />
              <div className="map-loading-text">Fetching incident markers…</div>
            </div>
          )}

          {/* Legend */}
          <MapLegend />
        </div>
      </div>
    </div>
  );
};
