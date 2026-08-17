import { ReactNode, TouchEvent, useEffect, useRef, useState } from "react";
import { AppPagina, PAGINA_INFO } from "../../appPages";
import { Gebruiker } from "../../types";
import { Thema } from "../../theme";
import { AppNav, NavBadges } from "./AppNav";

function kanHoveren(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return true;
  return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
}

function isCompactScherm(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(max-width: 960px)").matches;
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
  onVernieuw?: () => Promise<void> | void;
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
  onLogout,
  onVernieuw
}: Props) {
  const paginaInfo = PAGINA_INFO[huidigePagina];
  const isIngelogd = Boolean(gebruiker);
  const [compact, setCompact] = useState(isCompactScherm);
  /** Na een paginakeuze (en altijd op compact scherm): content full screen, menu via knop/hover. */
  const [autoVerbergen, setAutoVerbergen] = useState(isCompactScherm);
  const [menuOpen, setMenuOpen] = useState(false);
  const [vernieuwen, setVernieuwen] = useState(false);
  const [pullPx, setPullPx] = useState(0);
  const contentRef = useRef<HTMLElement | null>(null);
  const pullStartY = useRef<number | null>(null);

  const fullscreen = isIngelogd && (autoVerbergen || compact);
  const sidebarOpen = !fullscreen || menuOpen;

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 960px)");
    const sync = () => {
      const nuCompact = mq.matches;
      setCompact(nuCompact);
      if (nuCompact) setAutoVerbergen(true);
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

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

  const handleVernieuw = async () => {
    if (!onVernieuw || vernieuwen) return;
    try {
      setVernieuwen(true);
      await onVernieuw();
    } finally {
      setVernieuwen(false);
      setPullPx(0);
    }
  };

  const onContentTouchStart = (e: TouchEvent) => {
    if (!onVernieuw || !compact) return;
    const el = contentRef.current;
    if (!el || el.scrollTop > 2) {
      pullStartY.current = null;
      return;
    }
    pullStartY.current = e.touches[0].clientY;
  };

  const onContentTouchMove = (e: TouchEvent) => {
    if (pullStartY.current == null || !compact) return;
    const el = contentRef.current;
    if (!el || el.scrollTop > 2) {
      pullStartY.current = null;
      setPullPx(0);
      return;
    }
    const delta = e.touches[0].clientY - pullStartY.current;
    setPullPx(delta > 0 ? Math.min(88, delta * 0.55) : 0);
  };

  const onContentTouchEnd = () => {
    if (pullStartY.current == null) return;
    const genoeg = pullPx >= 54;
    pullStartY.current = null;
    if (genoeg) void handleVernieuw();
    else setPullPx(0);
  };

  const vernieuwKnop = isIngelogd && onVernieuw && (
    <button
      type="button"
      className={`topbar-icon-btn${vernieuwen ? " is-busy" : ""}`}
      aria-label="Gegevens vernieuwen"
      title="Vernieuwen"
      disabled={vernieuwen}
      onClick={() => void handleVernieuw()}
    >
      <span aria-hidden="true">↻</span>
    </button>
  );

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
              onVernieuw={onVernieuw ? () => void handleVernieuw() : undefined}
              vernieuwen={vernieuwen}
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
                  {vernieuwKnop}
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

          <section
            ref={contentRef}
            className="app-content"
            onTouchStart={onContentTouchStart}
            onTouchMove={onContentTouchMove}
            onTouchEnd={onContentTouchEnd}
            onTouchCancel={onContentTouchEnd}
          >
            {compact && isIngelogd && onVernieuw && (
              <div
                className={`pull-refresh${pullPx >= 54 || vernieuwen ? " is-ready" : ""}`}
                style={{ height: vernieuwen && pullPx === 0 ? 40 : pullPx }}
                aria-hidden="true"
              >
                <span>{vernieuwen ? "Vernieuwen…" : pullPx >= 54 ? "Loslaten om te vernieuwen" : "Omlaag trekken om te vernieuwen"}</span>
              </div>
            )}
            {children}
          </section>
        </main>
      </div>
    </div>
  );
}
