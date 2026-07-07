import { AppPagina } from "../../appPages";
import { Thema } from "../../theme";

export interface NavBadges {
  meldingen: number;
  deadlines: number;
  prullenbak: number;
}

interface Props {
  huidigePagina: AppPagina;
  isEigenaar: boolean;
  thema: Thema;
  badges: NavBadges;
  onNavigeer: (pagina: AppPagina) => void;
  onNieuweOpdracht: () => void;
  onThemaWissel: () => void;
  onLogout: () => void;
}

type NavItem = {
  id: AppPagina;
  label: string;
  badgeKey?: keyof NavBadges;
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
      { id: "home", label: "Home" },
      { id: "bord", label: "Opdrachtenbord" },
      { id: "kalender", label: "Kalender" },
      { id: "mijn-opdrachten", label: "Mijn opdrachten" },
      { id: "meldingen", label: "Meldingen", badgeKey: "meldingen" },
      { id: "deadlines", label: "Deadlines", badgeKey: "deadlines" }
    ]
  },
  {
    titel: "Beheer",
    alleenEigenaar: true,
    items: [
      { id: "statistieken", label: "Statistieken", alleenEigenaar: true },
      { id: "klanten", label: "Klanten", alleenEigenaar: true },
      { id: "documenten", label: "Documenten", alleenEigenaar: true },
      { id: "activiteit", label: "Activiteit", alleenEigenaar: true },
      { id: "team", label: "Team", alleenEigenaar: true },
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
  onLogout
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
                  <button type="button" className="sidebar-nav-link sidebar-nav-action-link" onClick={onNieuweOpdracht}>
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
                    {item.badgeKey && <NavBadge count={badges[item.badgeKey]} />}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        );
      })}

      <div className="sidebar-nav-utilities">
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
