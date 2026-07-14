import { ReactNode } from "react";
import { AppPagina, PAGINA_INFO } from "../../appPages";
import { Gebruiker } from "../../types";
import { Thema } from "../../theme";
import { AppNav, NavBadges } from "./AppNav";

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

  return (
    <div className="app-root">
      <div className="app-shell">
        <aside className="app-sidebar">
          <div className="sidebar-top">
            <div className="sidebar-header">
              <div className="logo-3d">
                <span className="logo-mark">LS</span>
              </div>
              <div className="sidebar-title">
                <div className="business-name">La-Solución</div>
                <div className="business-sub">Adviesbureau</div>
              </div>
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
              onNavigeer={onNavigeer}
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
                  <h1 className="topbar-title">{paginaInfo.titel}</h1>
                  <p className="topbar-subtitle">{paginaInfo.ondertitel}</p>
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
                <h1 className="topbar-title">La-Solución Portal</h1>
                <p className="topbar-subtitle">
                  Alle opdrachten, afspraken en documenten van uw klanten overzichtelijk bij
                  elkaar.
                </p>
              </div>
            )}
          </header>

          <section className="app-content">{children}</section>
        </main>
      </div>
    </div>
  );
}
