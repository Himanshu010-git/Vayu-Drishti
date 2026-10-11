import React from 'react';
import { Link } from 'react-router-dom';
import { Wind, Home, PlusCircle } from 'lucide-react';

export const NotFoundPage: React.FC = () => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '5rem 2rem',
        gap: '1.5rem',
        animation: 'slide-up 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      <div
        style={{
          fontSize: '6rem',
          fontFamily: 'var(--font-heading)',
          fontWeight: 800,
          background: 'var(--gradient-brand)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          lineHeight: 1,
          letterSpacing: '-0.04em',
        }}
      >
        404
      </div>

      <div
        style={{
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          background: 'rgba(16,185,129,0.12)',
          border: '1px solid rgba(16,185,129,0.3)',
          color: 'var(--emerald-400)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 0 30px var(--emerald-glow)',
        }}
      >
        <Wind size={30} strokeWidth={1.5} />
      </div>

      <h1
        style={{
          fontSize: '1.75rem',
          fontWeight: 800,
          letterSpacing: '-0.02em',
        }}
      >
        Page Not Found
      </h1>
      <p
        style={{
          color: 'var(--text-secondary)',
          fontSize: '1rem',
          maxWidth: '420px',
        }}
      >
        The route you're looking for doesn't exist. Navigate back to the dashboard
        or submit a new pollution incident report.
      </p>

      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
        <Link to="/submit" className="btn-primary" style={{ width: 'auto' }}>
          <PlusCircle size={17} />
          <span>Submit Report</span>
        </Link>
        <Link to="/my-reports" className="btn-secondary">
          <Home size={17} />
          <span>My Reports</span>
        </Link>
      </div>
    </div>
  );
};
