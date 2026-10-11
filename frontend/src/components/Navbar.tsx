import React from 'react';
import { NavLink } from 'react-router-dom';
import { Wind, PlusCircle, FileText, Map, Activity } from 'lucide-react';

export const Navbar: React.FC = () => {
  return (
    <header className="navbar">
      <div className="navbar-inner">
        <NavLink to="/submit" className="brand-wrapper">
          <div className="brand-logo-icon">
            <Wind size={22} strokeWidth={2.5} />
          </div>
          <div>
            <div className="brand-title">
              Vayu<span className="accent">Drishti</span>
            </div>
            <div className="brand-tagline">Urban Clean Air & Dust Intelligence</div>
          </div>
        </NavLink>

        <nav className="nav-links">
          <NavLink
            to="/submit"
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            <PlusCircle size={16} />
            <span>Submit Report</span>
          </NavLink>

          <NavLink
            to="/my-reports"
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            <FileText size={16} />
            <span>My Reports</span>
          </NavLink>

          <NavLink
            to="/map"
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            <Map size={16} />
            <span>Live Map</span>
          </NavLink>
        </nav>

        <div className="nav-status-badge">
          <div className="nav-status-dot" />
          <Activity size={13} />
          <span>System Online</span>
        </div>
      </div>
    </header>
  );
};
