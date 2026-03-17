import { ReactNode } from "react";
import { Gebruiker } from "../../types";

interface Props {
  children?: ReactNode;
  gebruiker?: Gebruiker | null;
  onLogout?: () => void;
}

export function AppLayout({ children, gebruiker, onLogout }: Props) {
  return (
    <div className="app-root">
      <div className="app-shell">
        <aside className="app-sidebar">
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
            <br />
            Snel, discreet en betrouwbaar. Al meer dan 15 jaar.
          </p>
          <div className="sidebar-footer-flag">
            <span className="flag-block flag-blue" />
            <span className="flag-block flag-white" />
            <span className="flag-block flag-red" />
          </div>
        </aside>

        <main className="app-main">
          <header className="app-topbar">
            {gebruiker ? (
              <>
                <div className="topbar-left">
                  <h1 className="topbar-title">Werkdagoverzicht</h1>
                  <p className="topbar-subtitle">
                    Zie in één oogopslag wat nieuw is, wat loopt en wat vandaag af moet.
                  </p>
                </div>
                <div className="topbar-user">
                  <div className="user-pill">
                    <div className="user-avatar">
                      {gebruiker.naam.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="user-meta">
                      <span className="user-name">{gebruiker.naam}</span>
                      <span className="user-role">
                        {gebruiker.rol === "EIGENAAR" ? "Eigenaar" : "Medewerker"}
                      </span>
                    </div>
                  </div>
                  {onLogout && (
                    <button className="btn-ghost" onClick={onLogout}>
                      Uitloggen
                    </button>
                  )}
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

