import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useApp } from '../state/AppContext';
import { UserSwitcher } from './UserSwitcher';
import { Avatar } from './Avatar';
import { FlagLogo } from './FlagLogo';
import './appshell.css';
import '../styles/ui.css';

export function AppShell() {
  const { user, unreadCount, client } = useApp();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const navLinks = (
    <>
      <NavLink to="/" end className="shell-navlink" onClick={() => setMobileNavOpen(false)}>
        Home
      </NavLink>
      <NavLink to="/sell" className="shell-navlink" onClick={() => setMobileNavOpen(false)}>
        Sell
      </NavLink>
      <NavLink to="/chat" className="shell-navlink" onClick={() => setMobileNavOpen(false)}>
        Chat
        {unreadCount > 0 && (
          <span className="shell-unread" aria-label={`${unreadCount} unread messages`}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </NavLink>
      <NavLink to="/favorites" className="shell-navlink" onClick={() => setMobileNavOpen(false)}>
        Favorites
      </NavLink>
    </>
  );

  return (
    <div className="shell">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <header className="shell-header">
        <div className="shell-header-inner">
          <button
            className="shell-burger"
            aria-label={mobileNavOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileNavOpen}
            onClick={() => setMobileNavOpen((v) => !v)}
          >
            <span />
            <span />
            <span />
          </button>

          <Link to="/" className="shell-logo" aria-label="LebanonTCG home">
            <FlagLogo size={38} />
            <span className="shell-logo-word display">
              Lebanon<span className="shell-logo-accent">TCG</span>
            </span>
          </Link>

          {/* R4's floating segmented pill nav */}
          <nav className="shell-nav glass" aria-label="Primary">
            {navLinks}
          </nav>

          <div className="shell-actions">
            {client.isMock && <UserSwitcher />}
            {user ? (
              <div className="shell-user" ref={menuRef}>
                <button
                  className="shell-user-btn"
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  onClick={() => setMenuOpen((v) => !v)}
                >
                  <Avatar profile={user} size={36} />
                </button>
                {menuOpen && (
                  <div className="shell-menu glass" role="menu">
                    <div className="shell-menu-id">
                      <strong>{user.displayName}</strong>
                      {user.username && <span className="shell-menu-handle">@{user.username}</span>}
                    </div>
                    {user.username && (
                      <button
                        role="menuitem"
                        className="shell-menu-item"
                        onClick={() => {
                          setMenuOpen(false);
                          navigate(`/u/${user.username}`);
                        }}
                      >
                        My profile
                      </button>
                    )}
                    <button
                      role="menuitem"
                      className="shell-menu-item"
                      onClick={() => {
                        setMenuOpen(false);
                        navigate('/my-listings');
                      }}
                    >
                      My listings
                    </button>
                    <button
                      role="menuitem"
                      className="shell-menu-item"
                      onClick={() => {
                        setMenuOpen(false);
                        navigate('/settings');
                      }}
                    >
                      Settings
                    </button>
                    <button
                      role="menuitem"
                      className="shell-menu-item shell-menu-item-danger"
                      onClick={async () => {
                        setMenuOpen(false);
                        await client.signOut();
                        navigate('/');
                      }}
                    >
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              !client.isMock && (
                <Link to="/signin" className="btn btn-primary btn-sm">
                  Sign in
                </Link>
              )
            )}
          </div>
        </div>
        {mobileNavOpen && (
          <nav className="shell-nav-mobile glass" aria-label="Primary mobile">
            {navLinks}
          </nav>
        )}
      </header>

      <main id="main" className="shell-main">
        <Outlet />
      </main>

      <footer className="shell-footer">
        <div className="shell-footer-inner">
          <span className="shell-footer-brand">
            <FlagLogo size={22} />
            <span className="microlabel">LebanonTCG — trade cards, not risks</span>
          </span>
          <nav className="shell-footer-nav" aria-label="Footer">
            <Link to="/safety">Safe trading tips</Link>
            <Link to="/">Browse</Link>
            <Link to="/sell">Sell a card</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
