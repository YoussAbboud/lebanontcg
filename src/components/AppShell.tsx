import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../state/AppContext';
import { rememberReturnTo } from '../lib/returnTo';
import { UserSwitcher } from './UserSwitcher';
import { NotificationBell } from './NotificationBell';
import { AddToHomePrompt } from './AddToHomePrompt';
import { Avatar } from './Avatar';
import flagGif from '../assets/flag.gif';
import './appshell.css';
import { useBuildFreshness } from '../lib/freshness';
import '../styles/ui.css';

export function AppShell() {
  const { user, auth, unreadCount, pendingReviewCount, client } = useApp();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  useBuildFreshness();

  // Two one-time gates, in order: set a password (accounts that predate
  // passwords), then claim a handle (fresh accounts).
  const gate =
    user && auth.needsPassword
      ? '/set-password'
      : user && !user.username
        ? '/welcome'
        : null;
  const redirectTo = gate && gate !== location.pathname ? gate : null;

  // Remember where people were, so signing in brings them back here.
  useEffect(() => {
    rememberReturnTo(location.pathname, location.search);
  }, [location.pathname, location.search]);

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
        <span className="shell-navtab" aria-hidden="true" />
        Home
      </NavLink>
      <NavLink to="/browse" className="shell-navlink" onClick={() => setMobileNavOpen(false)}>
        <span className="shell-navtab" aria-hidden="true" />
        Browse
      </NavLink>
      <NavLink to="/sellers" className="shell-navlink" onClick={() => setMobileNavOpen(false)}>
        <span className="shell-navtab" aria-hidden="true" />
        Sellers
      </NavLink>
      <NavLink to="/chat" className="shell-navlink" onClick={() => setMobileNavOpen(false)}>
        <span className="shell-navtab" aria-hidden="true" />
        Messages
        {unreadCount > 0 && (
          <span className="shell-unread" aria-label={`${unreadCount} unread messages`}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </NavLink>
    </>
  );

  return (
    <div className="shell-frame">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <div className="shell-glow" aria-hidden="true" />

      <header className="shell-header">
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

        <Link to="/" className="shell-logo display" aria-label="LebanonTCG home">
          <img src={flagGif} alt="" width={38} height={38} className="shell-logo-gif" />
          LebanonTCG<span className="shell-logo-dot">.</span>
        </Link>

        <nav className="shell-nav" aria-label="Primary">
          {navLinks}
        </nav>

        <div className="shell-actions">
          <button
            type="button"
            aria-label="Search cards"
            className="btn-icon shell-search"
            onClick={() => navigate('/browse?focus=1')}
          >
            ⌕
          </button>
          {client.isMock && <UserSwitcher />}
          <NotificationBell />
          {user ? (
            <div className="shell-user" ref={menuRef}>
              <button
                className="shell-user-btn"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((v) => !v)}
              >
                <Avatar profile={user} size={34} />
              </button>
              {menuOpen && (
                <div className="shell-menu" role="menu">
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
                      navigate('/favorites');
                    }}
                  >
                    Watchlist
                  </button>
                  <button
                    role="menuitem"
                    className="shell-menu-item"
                    onClick={() => {
                      setMenuOpen(false);
                      navigate('/reviews');
                    }}
                  >
                    Reviews
                    {pendingReviewCount > 0 && (
                      <span className="shell-menu-badge" aria-label={`${pendingReviewCount} to rate`}>
                        {pendingReviewCount}
                      </span>
                    )}
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
                  {user.isAdmin && (
                    <button
                      role="menuitem"
                      className="shell-menu-item shell-menu-item-admin"
                      onClick={() => {
                        setMenuOpen(false);
                        navigate('/admin');
                      }}
                    >
                      Admin console
                    </button>
                  )}
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
            <Link to="/signin" className="btn-outline shell-signin">
              Sign in
            </Link>
          )}
          <Link to="/sell" className="btn-acid shell-sell">
            List a card
          </Link>
        </div>
      </header>

      {mobileNavOpen && (
        <nav className="shell-nav-mobile" aria-label="Primary mobile">
          {navLinks}
          <NavLink to="/favorites" className="shell-navlink" onClick={() => setMobileNavOpen(false)}>
            <span className="shell-navtab" aria-hidden="true" />
            Watchlist
          </NavLink>
          {/* On phones the acid CTA lives here instead of the header. */}
          <Link
            to="/sell"
            className="btn-acid shell-mobile-sell"
            onClick={() => setMobileNavOpen(false)}
          >
            List a card
          </Link>
        </nav>
      )}

      <main id="main" className="shell-main">
        {user?.suspendedAt && (
          // Appears the moment a moderator suspends (0032 follows the
          // profile live) and goes away the moment it's lifted.
          <div className="shell-suspended" role="alert">
            <strong>Your account is suspended.</strong>{' '}
            {user.suspendedReason ? `${user.suspendedReason}. ` : ''}
            You can browse and read your chats, but you can&apos;t list, message, like, bid,
            report or review. <Link to="/support">Contact support</Link> to appeal.
          </div>
        )}
        {redirectTo ? <Navigate to={redirectTo} replace /> : <Outlet />}
      </main>

      <footer className="shell-footer">
        <div className="mono-label">We connect collectors. You handle the deal.</div>
        <nav className="shell-footer-nav" aria-label="Footer">
          <Link to="/safety">Trading safely</Link>
          <Link to="/support">Support</Link>
          <Link to="/terms">Terms</Link>
          <Link to="/privacy">Privacy</Link>
          <Link to="/reviews">Reviews</Link>
          <Link to="/favorites">Watchlist</Link>
          <Link to="/settings">Settings</Link>
        </nav>
      </footer>
      <AddToHomePrompt />
    </div>
  );
}
