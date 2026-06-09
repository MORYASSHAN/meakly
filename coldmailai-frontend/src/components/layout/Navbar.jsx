import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Braces, Menu, X } from 'lucide-react';
import useStore from '../../store/useStore';

const links = [
  { label: 'Product', path: '/' },
  { label: 'Generate', path: '/generate' },
  { label: 'History', path: '/history' },
  { label: 'Pricing', path: '/pricing' },
];

function Logo() {
  const letters = 'meakly'.split('');

  return (
    <span className="logo" aria-label="meakly">
      <span className="logo-mark wordmark-mark" aria-hidden="true">
        <Braces size={17} />
      </span>
      <span className="logo-text" aria-hidden="true">
        {letters.map((letter, index) => (
          <span
            className={`logo-letter ${index === 0 ? 'ai' : ''}`}
            style={{ animationDelay: `${0.2 + index * 0.04}s` }}
            key={`${letter}-${index}`}
          >
            {letter}
          </span>
        ))}
      </span>
    </span>
  );
}

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const magneticRef = useRef(null);
  const location = useLocation();
  const accessToken = useStore((state) => state.accessToken);
  const user = useStore((state) => state.user);
  
  useEffect(() => {
    document.documentElement.className = 'dark';
    localStorage.setItem('theme', 'dark');
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const initials =
    user?.name
      ?.split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase() || 'U';

  const handleMagneticMove = (event) => {
    const button = magneticRef.current;
    if (!button) return;
    const rect = button.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width - 0.5) * 12;
    const y = ((event.clientY - rect.top) / rect.height - 0.5) * 12;
    button.style.transform = `translate(${x}px, ${y}px)`;
  };

  const resetMagnetic = () => {
    if (magneticRef.current) magneticRef.current.style.transform = 'translate(0, 0)';
  };

  const navLinks = links.map((link) => (
    <Link key={link.path} className={`nav-link ${location.pathname === link.path ? 'active' : ''}`} to={link.path} onClick={() => setMobileOpen(false)}>
      {link.label}
    </Link>
  ));

  return (
    <nav className={`navbar ${scrolled ? 'scrolled' : ''}`}>
      <div className="nav-inner">
        <Link to="/" aria-label="meakly home">
          <Logo />
        </Link>

        <div className="nav-links">{navLinks}</div>

        <div className="nav-auth" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {accessToken ? (
            <Link className="avatar" to="/profile" aria-label="Profile">
              {initials}
            </Link>
          ) : (
            <>
              <Link className="btn btn-ghost btn-small" to="/login">
                Login
              </Link>
              <Link
                ref={magneticRef}
                className="btn btn-mint btn-small"
                to="/register"
                onMouseMove={handleMagneticMove}
                onMouseLeave={resetMagnetic}
              >
                Start Free
              </Link>
            </>
          )}
        </div>

        <button className="mobile-toggle" type="button" aria-label="Toggle menu" onClick={() => setMobileOpen((value) => !value)}>
          {mobileOpen ? <X size={19} /> : <Menu size={19} />}
        </button>
      </div>

      {mobileOpen && (
        <div className="mobile-menu">
          {navLinks}
          <div className="mobile-auth">
            {accessToken ? (
              <Link className="btn btn-ghost btn-full" to="/profile">
                Profile
              </Link>
            ) : (
              <>
                <Link className="btn btn-ghost btn-full" to="/login">
                  Login
                </Link>
                <Link className="btn btn-mint btn-full" to="/register">
                  Start Free
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
