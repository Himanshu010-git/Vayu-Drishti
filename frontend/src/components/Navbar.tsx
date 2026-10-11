import React, { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Wind, PlusCircle, FileText, Map, Activity, Menu, X } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';

export const Navbar: React.FC = () => {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);
  const location = useLocation();
  const menuRef = useRef<HTMLDivElement>(null);

  // Detect scroll to add elevated shadow
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  // Close mobile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  // Health-check the backend once on mount
  useEffect(() => {
    const baseUrl = API_BASE.replace('/api/v1', '');
    fetch(`${baseUrl}/health`, { signal: AbortSignal.timeout(4000) })
      .then((r) => setApiOnline(r.ok))
      .catch(() => setApiOnline(false));
  }, []);

  const navLinks = [
    { to: '/submit',     label: 'Submit Report', icon: <PlusCircle size={16} /> },
    { to: '/my-reports', label: 'My Reports',     icon: <FileText size={16} />   },
    { to: '/map',        label: 'Live Map',       icon: <Map size={16} />         },
  ];

  return (
    <header className={`navbar ${scrolled ? 'navbar-scrolled' : ''}`} ref={menuRef}>
      <div className="navbar-inner">
        {/* Brand */}
        <NavLink to="/submit" className="brand-wrapper">
          <div className="brand-logo-icon">
            <Wind size={22} strokeWidth={2.5} />
          </div>
          <div>
            <div className="brand-title">
              Vayu<span className="accent">Drishti</span>
            </div>
            <div className="brand-tagline">Urban Air Quality &amp; Dust Intelligence</div>
          </div>
        </NavLink>

        {/* Desktop nav */}
        <nav className="nav-links nav-links-desktop">
          {navLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            >
              {link.icon}
              <span>{link.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Right side */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {/* API status badge */}
          <div
            className="nav-status-badge"
            title={`Backend API: ${apiOnline === null ? 'checking…' : apiOnline ? 'online' : 'offline'}`}
            style={
              apiOnline === false
                ? {
                    background: 'rgba(244,63,94,0.12)',
                    borderColor: 'rgba(244,63,94,0.3)',
                    color: '#fb7185',
                  }
                : {}
            }
          >
            <div
              className="nav-status-dot"
              style={
                apiOnline === false
                  ? { background: '#f43f5e', boxShadow: '0 0 8px #f43f5e' }
                  : apiOnline === null
                  ? { background: '#fbbf24', boxShadow: '0 0 8px #fbbf24', animationName: 'none' }
                  : {}
              }
            />
            <Activity size={13} />
            <span>
              {apiOnline === null ? 'Checking…' : apiOnline ? 'API Online' : 'API Offline'}
            </span>
          </div>

          {/* Mobile hamburger */}
          <button
            type="button"
            className="btn-icon nav-hamburger"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Toggle navigation menu"
          >
            {menuOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {menuOpen && (
        <nav className="nav-mobile-drawer">
          {navLinks.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              className={({ isActive }) => `nav-mobile-link ${isActive ? 'active' : ''}`}
            >
              {link.icon}
              <span>{link.label}</span>
            </NavLink>
          ))}
        </nav>
      )}
    </header>
  );
};
