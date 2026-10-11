import React from 'react';
import { Link } from 'react-router-dom';
import { FileText, PlusCircle } from 'lucide-react';

export const MyReportsPage: React.FC = () => {
  return (
    <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center' }}>
      <div
        style={{
          width: '60px',
          height: '60px',
          borderRadius: '50%',
          background: 'rgba(99, 102, 241, 0.15)',
          color: 'var(--indigo-500)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 1.5rem',
        }}
      >
        <FileText size={30} />
      </div>
      <h2 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: '0.75rem' }}>
        My Incident Reports
      </h2>
      <p style={{ color: 'var(--text-secondary)', maxWidth: '500px', margin: '0 auto 2rem' }}>
        Incident dashboard with AI analysis breakdowns and priority scoring will be enabled in Step 2.
      </p>
      <Link to="/submit" className="btn-primary" style={{ display: 'inline-flex', width: 'auto' }}>
        <PlusCircle size={18} />
        <span>Submit a New Report</span>
      </Link>
    </div>
  );
};
