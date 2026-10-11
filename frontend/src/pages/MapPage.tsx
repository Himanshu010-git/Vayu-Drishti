import React from 'react';
import { Link } from 'react-router-dom';
import { Map, PlusCircle } from 'lucide-react';

export const MapPage: React.FC = () => {
  return (
    <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center' }}>
      <div
        style={{
          width: '60px',
          height: '60px',
          borderRadius: '50%',
          background: 'rgba(6, 182, 212, 0.15)',
          color: 'var(--cyan-400)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 1.5rem',
        }}
      >
        <Map size={30} />
      </div>
      <h2 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: '0.75rem' }}>
        Live Incident Map
      </h2>
      <p style={{ color: 'var(--text-secondary)', maxWidth: '500px', margin: '0 auto 2rem' }}>
        Citywide high-density circle markers categorized by AI priority score will be enabled in Step 3.
      </p>
      <Link to="/submit" className="btn-primary" style={{ display: 'inline-flex', width: 'auto' }}>
        <PlusCircle size={18} />
        <span>Submit a New Report</span>
      </Link>
    </div>
  );
};
