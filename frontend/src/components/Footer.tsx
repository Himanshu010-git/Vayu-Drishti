import React from 'react';
import { Wind, Code2, ExternalLink } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';

export const Footer: React.FC = () => {
  return (
    <footer className="app-footer">
      <div className="footer-inner">
        <div className="footer-brand">
          <div className="footer-brand-icon">
            <Wind size={16} strokeWidth={2.5} />
          </div>
          <div>
            <div className="footer-brand-name">VayuDrishti</div>
            <div className="footer-brand-sub">Urban Air Quality &amp; Dust Pollution Intelligence</div>
          </div>
        </div>

        <div className="footer-meta">
          <span className="footer-api-url">
            API: <code>{API_BASE}</code>
          </span>
          <div className="footer-links">
            <a
              href={`${API_BASE.replace('/api/v1', '')}/docs`}
              target="_blank"
              rel="noreferrer"
              className="footer-link"
            >
              <ExternalLink size={13} />
              <span>API Docs</span>
            </a>
            <a
              href="https://github.com/Krish01Cse/VayuDrishti"
              target="_blank"
              rel="noreferrer"
              className="footer-link"
            >
              <Code2 size={13} />
              <span>GitHub</span>
            </a>
          </div>
        </div>

        <div className="footer-copy">
          Built with React + Vite + Leaflet &bull; FastAPI backend on AWS
        </div>
      </div>
    </footer>
  );
};
