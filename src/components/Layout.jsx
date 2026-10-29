import { useState, useRef, useEffect, useCallback } from 'react';
import Sidebar from './Sidebar';

export default function Layout({ children, role = 'student' }) {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const menuButtonRef = useRef(null);

  const closeMenu = useCallback(() => {
    setIsMobileOpen(false);
    menuButtonRef.current?.focus();
  }, []);

  const toggleMenu = useCallback(() => {
    setIsMobileOpen((prev) => !prev);
  }, []);

  useEffect(() => {
    if (!isMobileOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        closeMenu();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobileOpen, closeMenu]);

  return (
    <div className="min-h-screen bg-bg-light dark:bg-bg-dark flex flex-col md:flex-row">
      {/* Mobile Header */}
      <header className="md:hidden flex items-center justify-between px-4 py-3 bg-primary border-b border-white/10 text-white sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <button
            ref={menuButtonRef}
            type="button"
            onClick={toggleMenu}
            aria-label="Abrir menu"
            aria-expanded={isMobileOpen}
            className="p-2 rounded-lg text-white/80 hover:text-white hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-secondary cursor-pointer"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-white/15">
              <img src="/cerebro.png" alt="" className="w-4 h-4 brightness-0 invert" />
            </div>
            <span className="font-bold tracking-tight text-base text-white">
              foca<span className="text-secondary">.</span>ai
            </span>
          </div>
        </div>
      </header>

      {/* Overlay backdrop */}
      {isMobileOpen && (
        <div
          data-testid="sidebar-overlay"
          aria-hidden="true"
          onClick={closeMenu}
          className="fixed inset-0 bg-black/50 z-40 md:hidden transition-opacity"
        />
      )}

      {/* Sidebar */}
      <Sidebar role={role} isOpen={isMobileOpen} onNavigate={closeMenu} />

      {/* Main Content */}
      <main className="flex-1 ml-0 md:ml-[240px] p-4 md:p-8 text-slate-900 dark:text-text-primary-dark min-h-screen" role="main">
        {children}
      </main>
    </div>
  );
}
