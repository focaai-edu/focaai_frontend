import { useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../hooks/useTheme';

const NAV_ITEMS = {
  teacher: [
    {
      to: '/teacher/dashboard',
      label: 'Minhas Aulas',
      icon: (
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      ),
    },
    {
      to: '/room',
      label: 'Câmera da Sala',
      icon: (
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      ),
    },
  ],
  student: [
    {
      to: '/student/dashboard',
      label: 'Minhas Aulas',
      icon: (
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
      ),
    },
  ],
};

export default function Sidebar({ role = 'student' }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const items = NAV_ITEMS[role] || NAV_ITEMS.student;

  const isActive = (path) => {
    if (path === `/${role}/dashboard`) return location.pathname === path;
    return location.pathname.startsWith(path);
  };

  const handleLogout = useCallback(async () => {
    await logout();
    navigate('/login');
  }, [logout, navigate]);

  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
    : '?';

  return (
    <aside
      className="w-[240px] min-h-screen flex flex-col fixed left-0 top-0 z-30"
      style={{ backgroundColor: '#1B4F81' }}
      role="navigation"
      aria-label="Navegação principal"
    >
      {/* Logo */}
      <div className="px-5 pt-6 pb-5">
        <Link to={`/${role}/dashboard`} className="no-underline flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}>
            <img src="/cerebro.png" alt="" className="w-5 h-5 brightness-0 invert" />
          </div>
          <div>
            <span className="text-lg font-bold tracking-tight" style={{ color: '#FFFFFF' }}>
              foca<span style={{ color: '#7DB8F0' }}>.</span>ai
            </span>
            <p className="text-xs m-0 mt-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>
              Cada momento importa.
            </p>
          </div>
        </Link>
      </div>

      {/* Divider */}
      <div className="mx-5 mb-4" style={{ height: '1px', backgroundColor: 'rgba(255,255,255,0.1)' }} />

      {/* Nav */}
      <nav className="flex-1 px-3" style={{ background: 'none', border: 'none' }}>
        <ul className="list-none p-0 m-0 space-y-0.5">
          {items.map((item) => {
            const active = isActive(item.to);
            return (
              <li key={item.to}>
                <Link
                  to={item.to}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg no-underline text-sm font-medium transition-all"
                  style={{
                    color: active ? '#FFFFFF' : 'rgba(255,255,255,0.65)',
                    backgroundColor: active ? 'rgba(255,255,255,0.15)' : 'transparent',
                    fontWeight: active ? 600 : 500,
                  }}
                  aria-current={active ? 'page' : undefined}
                >
                  <span
                    className="w-5 h-5 flex-shrink-0"
                    style={{ color: active ? '#FFFFFF' : 'rgba(255,255,255,0.55)' }}
                  >
                    {item.icon}
                  </span>
                  {item.label}
                  {active && (
                    <span className="ml-auto w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: '#7DB8F0' }} />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Bottom section */}
      <div className="p-3 mt-auto">
        <div className="mx-1 mb-2" style={{ height: '1px', backgroundColor: 'rgba(255,255,255,0.1)' }} />

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          aria-label={`Mudar para modo ${theme === 'dark' ? 'claro' : 'escuro'}`}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all cursor-pointer border-none"
          style={{
            backgroundColor: 'transparent',
            color: 'rgba(255,255,255,0.65)',
          }}
        >
          <span className="w-5 h-5 flex-shrink-0 flex items-center justify-center text-base">
            {theme === 'dark' ? '☀️' : '🌙'}
          </span>
          <span>{theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}</span>
        </button>

        {/* User + Logout */}
        {user && (
          <div
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg mt-0.5"
            style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold"
              style={{ backgroundColor: 'rgba(255,255,255,0.2)', color: '#FFFFFF' }}
            >
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold m-0 truncate" style={{ color: '#FFFFFF' }}>
                {user.name}
              </p>
              <p className="text-xs m-0 mt-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>
                {user.role === 'teacher' ? 'Professor' : 'Aluno'}
              </p>
            </div>
            <button
              onClick={handleLogout}
              title="Sair"
              className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer border-none transition-all"
              style={{ backgroundColor: 'transparent', color: 'rgba(255,255,255,0.5)' }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
