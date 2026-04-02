import { useEffect, useMemo, useState } from "react";
import { Gebruiker, Opdracht, OpdrachtStatus } from "../types";
import { OpdrachtenBord } from "./OpdrachtenBord";
import { Kalender } from "./Kalender";
import { OpdrachtDialoog } from "./OpdrachtDialoog";
import { createOpdracht, updateOpdracht, deleteOpdracht } from "../api";

interface Props {
  gebruiker: Gebruiker;
  isEigenaar: boolean;
  opdrachten: Opdracht[];
  onOpdrachtenWijzig: (opdrachten: Opdracht[]) => void;
}

interface BeheerGebruiker {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
}

type DialoogMode = "toevoegen" | "bewerken" | "bekijken" | null;

export function Dashboard({
  gebruiker,
  isEigenaar,
  opdrachten,
  onOpdrachtenWijzig
}: Props) {
  const [dialoogMode, setDialoogMode] = useState<DialoogMode>(null);
  const [geselecteerdeOpdracht, setGeselecteerdeOpdracht] = useState<Opdracht | null>(null);
  const [beheerGebruikers, setBeheerGebruikers] = useState<BeheerGebruiker[]>([]);
  const [ladenGebruikers, setLadenGebruikers] = useState(false);
  const [beheerFout, setBeheerFout] = useState<string | null>(null);
  const [opdrachtFout, setOpdrachtFout] = useState<string | null>(null);

  const draftOpdracht = useMemo((): Opdracht => {
    const vandaag = new Date().toISOString().slice(0, 10);
    return {
      id: "",
      klantNaam: "",
      omschrijving: "",
      datumAangemaakt: vandaag,
      status: OpdrachtStatus.Nieuw,
      prioriteit: 2,
      behandelaarUserId: null,
      behandelaarNaam: null,
      notities: "",
      categorie: "",
      bestanden: []
    };
  }, []);

  useEffect(() => {
    if (!isEigenaar) return;
    const token = window.localStorage.getItem("la-solucion-token");
    if (!token) return;
    let isCancelled = false;
    const fetchUsers = async () => {
      try {
        setLadenGebruikers(true);
        const res = await fetch("/api/admin/users", {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
        const data = await res.json();
        if (!res.ok) {
          if (!isCancelled) {
            setBeheerFout(data.error || "Kon gebruikerslijst niet ophalen.");
          }
          return;
        }
        if (!isCancelled) {
          setBeheerGebruikers(data.users || []);
        }
      } catch {
        if (!isCancelled) {
          setBeheerFout("Er is een fout opgetreden bij het ophalen van gebruikers.");
        }
      } finally {
        if (!isCancelled) {
          setLadenGebruikers(false);
        }
      }
    };
    fetchUsers();
    return () => {
      isCancelled = true;
    };
  }, [isEigenaar]);

  const toggleUserActive = async (userId: string) => {
    const token = window.localStorage.getItem("la-solucion-token");
    if (!token) return;
    try {
      const res = await fetch(`/api/admin/users/${userId}/toggle-active`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (!res.ok) {
        setBeheerFout(data.error || "Kon de status van de gebruiker niet wijzigen.");
        return;
      }
      setBeheerGebruikers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, active: data.active } : u))
      );
    } catch {
      setBeheerFout("Er is een fout opgetreden bij het wijzigen van de gebruikersstatus.");
    }
  };

  const zichtbareOpdrachten = useMemo(
    () =>
      isEigenaar
        ? opdrachten
        : opdrachten.filter(
            (o) =>
              o.behandelaarNaam &&
              o.behandelaarNaam.toLocaleLowerCase() === gebruiker.naam.toLocaleLowerCase()
          ),
    [isEigenaar, opdrachten, gebruiker.naam]
  );

  const belangrijksteOpdrachten = useMemo(
    () =>
      [...zichtbareOpdrachten]
        .filter((o) => o.status !== OpdrachtStatus.Afgerond)
        .sort((a, b) => a.prioriteit - b.prioriteit)
        .slice(0, 5),
    [zichtbareOpdrachten]
  );

  const aantallen = useMemo(() => {
    return {
      totaal: zichtbareOpdrachten.length,
      nieuw: zichtbareOpdrachten.filter((o) => o.status === OpdrachtStatus.Nieuw).length,
      lopend: zichtbareOpdrachten.filter(
        (o) => o.status === OpdrachtStatus.InBehandeling
      ).length,
      afgerond: zichtbareOpdrachten.filter(
        (o) => o.status === OpdrachtStatus.Afgerond
      ).length
    };
  }, [zichtbareOpdrachten]);

  const vandaagIso = new Date().toISOString().slice(0, 10);
  const vandaagDue = zichtbareOpdrachten.filter((o) => o.datumDeadline === vandaagIso);

  const handleOpdrachtUpdate = async (opdracht: Opdracht) => {
    try {
      setOpdrachtFout(null);
      const saved = await updateOpdracht(opdracht);
      const updated = opdrachten.map((o) => (o.id === saved.id ? saved : o));
      onOpdrachtenWijzig(updated);
      setGeselecteerdeOpdracht(saved);
      return saved;
    } catch (e) {
      setOpdrachtFout("Opslaan mislukt. Controleer je verbinding en probeer opnieuw.");
      throw e;
    }
  };

  const openOpdrachtToevoegen = () => {
    setDialoogMode("toevoegen");
    setGeselecteerdeOpdracht(draftOpdracht);
  };

  const openOpdracht = (opdracht: Opdracht) => {
    setDialoogMode(isEigenaar ? "bewerken" : "bekijken");
    setGeselecteerdeOpdracht(opdracht);
  };

  const sluitDialoog = () => {
    setDialoogMode(null);
    setGeselecteerdeOpdracht(null);
  };

  const handleCreateOpdracht = async (draft: Opdracht) => {
    try {
      setOpdrachtFout(null);
      const nieuw = await createOpdracht({
        klantNaam: draft.klantNaam || "Naam klant",
        omschrijving: draft.omschrijving || "Omschrijving",
        datumAangemaakt: draft.datumAangemaakt,
        datumDeadline: draft.datumDeadline || undefined,
        status: draft.status,
        prioriteit: draft.prioriteit,
        behandelaarUserId: draft.behandelaarUserId || (isEigenaar ? null : gebruiker.id),
        behandelaarNaam: draft.behandelaarNaam || null,
        notities: draft.notities || "",
        categorie: draft.categorie || "",
        bestanden: []
      });
      onOpdrachtenWijzig([nieuw, ...opdrachten]);
      sluitDialoog();
    } catch {
      setOpdrachtFout("Kon opdracht niet aanmaken. Controleer de backend/database.");
      throw new Error("Create failed");
    }
  };

  const handleDeleteOpdracht = async (opdrachtId: string) => {
    try {
      setOpdrachtFout(null);
      await deleteOpdracht(opdrachtId);
      const updated = opdrachten.filter((o) => o.id !== opdrachtId);
      onOpdrachtenWijzig(updated);
      sluitDialoog();
    } catch (err) {
      const message =
        err instanceof Error && err.message ? err.message : "Kon opdracht niet verwijderen. Controleer de backend.";
      setOpdrachtFout(message);
    }
  };

  return (
    <>
      {opdrachtFout && (
        <div className="card" style={{ marginBottom: 12 }}>
          <p className="muted" style={{ color: "#fecaca" }}>
            {opdrachtFout}
          </p>
        </div>
      )}
      <div className="dashboard-grid">
        <section className="card metric-card metric-main">
          <div className="metric-header">
            <h2>Belangrijkste taken</h2>
            {isEigenaar && (
              <button className="btn-secondary" onClick={openOpdrachtToevoegen}>
                Opdracht toevoegen
              </button>
            )}
          </div>
          <p className="metric-subtitle">
            De hoogst geprioriteerde opdrachten die nog openstaan.
          </p>
          <div className="important-list">
            {belangrijksteOpdrachten.map((o) => (
              <button
                key={o.id}
                className="important-item"
                onClick={() => openOpdracht(o)}
              >
                <div className="important-main">
                  <span className="important-client">{o.klantNaam}</span>
                  <span className={`pill pill-prio-${o.prioriteit}`}>
                    Prioriteit {o.prioriteit}
                  </span>
                </div>
                <div className="important-sub">
                  <span>{o.omschrijving}</span>
                  {o.datumDeadline && (
                    <span className="important-deadline">
                      Deadline: {new Date(o.datumDeadline).toLocaleDateString("nl-NL")}
                    </span>
                  )}
                </div>
              </button>
            ))}
            {belangrijksteOpdrachten.length === 0 && (
              <p className="muted">Geen openstaande opdrachten met hoge prioriteit.</p>
            )}
          </div>
        </section>

        <section className="card metric-card">
          <h2>Overzicht opdrachten</h2>
          <div className="metric-row">
            <div className="metric-badge">
              <span className="metric-label">Totaal</span>
              <span className="metric-value">{aantallen.totaal}</span>
            </div>
            <div className="metric-badge">
              <span className="metric-label">Nieuw</span>
              <span className="metric-value">{aantallen.nieuw}</span>
            </div>
            <div className="metric-badge">
              <span className="metric-label">Lopend</span>
              <span className="metric-value">{aantallen.lopend}</span>
            </div>
            <div className="metric-badge">
              <span className="metric-label">Afgerond</span>
              <span className="metric-value">{aantallen.afgerond}</span>
            </div>
          </div>
          {isEigenaar && (
            <p className="muted">
              Als eigenaar kun je dit overzicht gebruiken om de werkdruk in het team te verdelen.
            </p>
          )}
        </section>

        <section className="card metric-card">
          <h2>Vandaag in de gaten houden</h2>
          {vandaagDue.length === 0 ? (
            <p className="muted">Geen opdrachten met deadline vandaag.</p>
          ) : (
            <ul className="today-list">
              {vandaagDue.map((o) => (
                <li key={o.id}>
                  <button
                    className="link-btn"
                    onClick={() => openOpdracht(o)}
                  >
                    {o.klantNaam} – {o.omschrijving}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="layout-split">
        <section className="card split-left">
          <div className="section-header">
            <h2>Opdrachtenbord</h2>
            <p className="muted">
              Sleep niets; klik een kaart om details, documenten en status te beheren.
            </p>
          </div>
          <OpdrachtenBord
            opdrachten={zichtbareOpdrachten}
            isEigenaar={isEigenaar}
            onOpdrachtKlik={openOpdracht}
            onOpdrachtWijzig={handleOpdrachtUpdate}
          />
        </section>

        <section className="card split-right">
          <div className="section-header">
            <h2>Kalender</h2>
            <p className="muted">Afspraken en opdrachten op basis van hun deadline.</p>
          </div>
          <Kalender
            opdrachten={zichtbareOpdrachten}
            onSelectOpdracht={openOpdracht}
          />
        </section>
      </div>

      {isEigenaar && (
        <section className="card owner-panel">
          <div className="section-header">
            <h2>Teamoverzicht (alleen eigenaar)</h2>
            <p className="muted">
              Beheer welke medewerkers actief zijn en zie in één oogopslag de verdeling.
            </p>
          </div>
          {beheerFout && <p className="muted" style={{ color: "#fecaca" }}>{beheerFout}</p>}
          {ladenGebruikers ? (
            <p className="muted">Gebruikers laden...</p>
          ) : (
            <div className="owner-table-wrapper">
              <table className="owner-table">
                <thead>
                  <tr>
                    <th>Naam</th>
                    <th>E-mailadres</th>
                    <th>Rol</th>
                    <th>Status</th>
                    <th>Actie</th>
                  </tr>
                </thead>
                <tbody>
                  {beheerGebruikers.map((u) => (
                    <tr key={u.id}>
                      <td>{u.name}</td>
                      <td>{u.email}</td>
                      <td>{u.role === "EIGENAAR" ? "Eigenaar" : "Medewerker"}</td>
                      <td>{u.active ? "Actief" : "Gedeactiveerd"}</td>
                      <td>
                        {u.role === "EIGENAAR" ? (
                          <span className="muted">Hoofdaccount</span>
                        ) : (
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => toggleUserActive(u.id)}
                          >
                            {u.active ? "Zet op non‑actief" : "Activeer"}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {beheerGebruikers.length === 0 && (
                    <tr>
                      <td colSpan={5}>
                        <span className="muted">
                          Er zijn nog geen andere gebruikers geregistreerd.
                        </span>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {dialoogMode !== null && geselecteerdeOpdracht && (
        <OpdrachtDialoog
          mode={dialoogMode}
          opdracht={geselecteerdeOpdracht}
          isEigenaar={isEigenaar}
          teamGebruikers={beheerGebruikers}
          onSluit={sluitDialoog}
          onBewaar={handleOpdrachtUpdate}
          onCreate={handleCreateOpdracht}
          onDelete={handleDeleteOpdracht}
        />
      )}
    </>
  );
}

