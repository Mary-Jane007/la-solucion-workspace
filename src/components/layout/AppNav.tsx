import { AppPagina } from "../../appPages";
import { BadgeLijst } from "../../meldingenStatus";
import { Thema } from "../../theme";

export type NavBadgeKey = BadgeLijst | "financieel";
export type NavBadges = Partial<Record<NavBadgeKey, number>>;

interface Props {
  huidigePagina: AppPagina;
  isEigenaar: boolean;
  thema: Thema;
  badges: NavBadges;
  onNavigeer: (pagina: AppPagina) => void;
  onNieuweOpdracht: () => void;
  onThemaWissel: () => void;
  onLogout: () => void;
  onVernieuw?: () => void;
  vernieuwen?: boolean;
}

type NavItem = {
  id: AppPagina;
  label: string;
  badgeKey?: NavBadgeKey;
  alleenEigenaar?: boolean;
  alleenMedewerker?: boolean;
};

type NavGroep = {
  titel: string;
  items: NavItem[];
  alleenEigenaar?: boolean;
};

const NAV_GROEPEN: NavGroep[] = [
  {
    titel: "Werk",
    items: [
      { id: "home", label: "Home", badgeKey: "home" },
      { id: "bord", label: "Opdrachtenbord", badgeKey: "bord" },
      { id: "kalender", label: "Kalender", badgeKey: "kalender" },
      { id: "mijn-opdrachten", label: "Mijn opdrachten", badgeKey: "mijn-opdrachten" },
      { id: "meldingen", label: "Meldingen", badgeKey: "meldingen" },
      { id: "deadlines", label: "Deadlines", badgeKey: "deadlines" },
      { id: "kas-doorgeven", label: "Kas doorgeven", alleenMedewerker: true }
    ]
  },
  {
    titel: "Beheer",
    alleenEigenaar: true,
    items: [
      { id: "statistieken", label: "Statistieken", alleenEigenaar: true },
      { id: "klanten", label: "Klanten", badgeKey: "klanten", alleenEigenaar: true },
      { id: "documenten", label: "Documenten", badgeKey: "documenten", alleenEigenaar: true },
      { id: "activiteit", label: "Activiteit", badgeKey: "activiteit", alleenEigenaar: true },
      { id: "team", label: "Team", alleenEigenaar: true },
      { id: "financieel", label: "Financiën", badgeKey: "financieel", alleenEigenaar: true },
      { id: "prullenbak", label: "Prullenbak", badgeKey: "prullenbak", alleenEigenaar: true },
      { id: "export", label: "Export", alleenEigenaar: true }
    ]
  },
  {
    titel: "Account",
    items: [
      { id: "profiel", label: "Profiel" },
      { id: "instellingen", label: "Instellingen" },
      { id: "help", label: "Help" },
      { id: "contact", label: "Contact" }
    ]
  }
];

function NavBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return <span className="sidebar-nav-badge">{count > 99 ? "99+" : count}</span>;
}

export function AppNav({
  huidigePagina,
  isEigenaar,
  thema,
  badges,
  onNavigeer,
  onNieuweOpdracht,
  onThemaWissel,
  onLogout,
  onVernieuw,
  vernieuwen = false
}: Props) {
  const groepen = NAV_GROEPEN.filter((g) => !g.alleenEigenaar || isEigenaar);

  return (
    <nav className="sidebar-nav" aria-label="Hoofdmenu">
      {groepen.map((groep) => {
        const items = groep.items.filter(
          (item) =>
            (!item.alleenEigenaar || isEigenaar) && (!item.alleenMedewerker || !isEigenaar)
        );
        if (items.length === 0) return null;

        return (
          <div key={groep.titel} className="sidebar-nav-group">
            <p className="sidebar-nav-heading">{groep.titel}</p>
            <ul className="sidebar-nav-list">
              {groep.titel === "Beheer" && isEigenaar && (
                <li>
                  <button
                    type="button"
                    className="sidebar-nav-link sidebar-nav-action-link"
                    onClick={onNieuweOpdracht}
                  >
                    + Nieuwe opdracht
                  </button>
                </li>
              )}
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className={`sidebar-nav-link${huidigePagina === item.id ? " is-active" : ""}`}
                    aria-current={huidigePagina === item.id ? "page" : undefined}
                    onClick={() => onNavigeer(item.id)}
                  >
                    <span>{item.label}</span>
                    {item.badgeKey && <NavBadge count={badges[item.badgeKey] ?? 0} />}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        );
      })}

      <div className="sidebar-nav-utilities">
        {onVernieuw && (
          <button
            type="button"
            className="sidebar-nav-utility"
            onClick={onVernieuw}
            disabled={vernieuwen}
          >
            {vernieuwen ? "Bezig met vernieuwen…" : "Vernieuwen"}
          </button>
        )}
        <button
          type="button"
          className="sidebar-nav-utility"
          onClick={onThemaWissel}
          title={thema === "donker" ? "Schakel naar licht thema" : "Schakel naar donker thema"}
        >
          {thema === "donker" ? "Licht thema" : "Donker thema"}
        </button>
        <button type="button" className="sidebar-nav-utility sidebar-nav-logout" onClick={onLogout}>
          Uitloggen
        </button>
      </div>
    </nav>
  );
}
