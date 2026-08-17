import { ReactNode, useEffect, useState } from "react";
import { AppPagina, PAGINA_INFO } from "../../appPages";
import { Gebruiker } from "../../types";
import { Thema } from "../../theme";
import { AppNav, NavBadges } from "./AppNav";

function kanHoveren(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return true;
  return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
}

interface Props {
  children?: ReactNode;
  gebruiker?: Gebruiker | null;
  huidigePagina?: AppPagina;
  isEigenaar?: boolean;
  thema?: Thema;
  navBadges?: NavBadges;
  onNavigeer?: (pagina: AppPagina) => void;
  onNieuweOpdracht?: () => void;
  onThemaWissel?: () => void;
  onLogout?: () => void;
}

export function AppLayout({
  children,
  gebruiker,
  huidigePagina = "home",
  isEigenaar = false,
  thema = "donker",
  navBadges = {},
  onNavigeer,
  onNieuweOpdracht,
  onThemaWissel,
  onLogout
}: Props) {
  const paginaInfo = PAGINA_INFO[huidigePagina];
  const isIngelogd = Boolean(gebruiker);
  /** Na een paginakeuze: content full screen, menu via knop/hover. */
  const [autoVerbergen, setAutoVerbergen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const fullscreen = isIngelogd && autoVerbergen;
  const sidebarOpen = !fullscreen || menuOpen;

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const handleNavigeer = (pagina: AppPagina) => {
    onNavigeer?.(pagina);
    setAutoVerbergen(true);
    setMenuOpen(false);
  };

  const openMenu = () => setMenuOpen(true);
  const closeMenu = () => setMenuOpen(false);

  return (
    <div className={`app-root${fullscreen ? " app-root--fullscreen" : ""}`}>
      <div
        className={`app-shell${fullscreen ? " app-shell--fullscreen" : ""}${
          sidebarOpen ? " app-shell--sidebar-open" : " app-shell--sidebar-closed"
        }`}
      >
        {fullscreen && (
          <button
            type="button"
            className="sidebar-hover-rail"
            aria-label="Menu tonen"
            title="Menu tonen"
            onMouseEnter={openMenu}
            onFocus={openMenu}
            onClick={openMenu}
          />
        )}

        {fullscreen && menuOpen && (
          <button
            type="button"
            className="sidebar-backdrop"
            aria-label="Menu sluiten"
            onClick={closeMenu}
          />
        )}

        <aside
          className="app-sidebar"
          onMouseEnter={() => {
            if (fullscreen && kanHoveren()) setMenuOpen(true);
          }}
          onMouseLeave={() => {
            if (fullscreen && kanHoveren()) setMenuOpen(false);
          }}
        >
          <div className="sidebar-top">
            <div className="sidebar-header">
              <div className="logo-3d" title="Menu">
                <span className="logo-mark">LS</span>
              </div>
              <div className="sidebar-title">
                <div className="business-name">La-Solución</div>
                <div className="business-sub">Adviesbureau</div>
              </div>
              {fullscreen && (
                <button
                  type="button"
                  className="sidebar-close-btn"
                  aria-label="Menu sluiten"
                  onClick={closeMenu}
                >
                  ×
                </button>
              )}
            </div>
            <p className="sidebar-tagline">
              Wij helpen vreemdelingen en ingezetenen met visa, vergunningen en legalisaties.
              Snel, discreet en betrouwbaar. Al meer dan 15 jaar.
            </p>
          </div>

          {isIngelogd && onNavigeer && onNieuweOpdracht && onThemaWissel && onLogout && (
            <AppNav
              huidigePagina={huidigePagina}
              isEigenaar={isEigenaar}
              thema={thema}
              badges={navBadges}
              onNavigeer={handleNavigeer}
              onNieuweOpdracht={onNieuweOpdracht}
              onThemaWissel={onThemaWissel}
              onLogout={onLogout}
            />
          )}

          <div className="sidebar-bottom">
            <div className="sidebar-footer-flag">
              <span className="flag-block flag-blue" />
              <span className="flag-block flag-white" />
              <span className="flag-block flag-red" />
            </div>
          </div>
        </aside>

        <main className="app-main">
          <header className="app-topbar">
            {isIngelogd ? (
              <>
                <div className="topbar-left">
                  {fullscreen && (
                    <button
                      type="button"
                      className="topbar-menu-btn"
                      aria-label="Menu openen"
                      aria-expanded={menuOpen}
                      onClick={() => setMenuOpen((open) => !open)}
                    >
                      <span />
                      <span />
                      <span />
                    </button>
                  )}
                  <div className="topbar-copy">
                    <h1 className="topbar-title">{paginaInfo.titel}</h1>
                    <p className="topbar-subtitle">{paginaInfo.ondertitel}</p>
                  </div>
                </div>
                <div className="topbar-user">
                  <div className="user-pill">
                    <div className="user-avatar">
                      {(gebruiker!.naam || "?").slice(0, 2).toUpperCase()}
                    </div>
                    <div className="user-meta">
                      <span className="user-name">{gebruiker!.naam}</span>
                      <span className="user-role">
                        {gebruiker!.rol === "EIGENAAR" ? "Eigenaar" : "Medewerker"}
                      </span>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="topbar-left">
                <div className="topbar-copy">
                  <h1 className="topbar-title">La-Solución Portal</h1>
                  <p className="topbar-subtitle">
                    Alle opdrachten, afspraken en documenten van uw klanten overzichtelijk bij
                    elkaar.
                  </p>
                </div>
              </div>
            )}
          </header>

          <section className="app-content">{children}</section>
        </main>
      </div>
    </div>
  );
}
