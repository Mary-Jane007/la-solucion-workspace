import { FormEvent, useMemo, useState } from "react";
import { Opdracht, OpdrachtStatus, Prioriteit } from "../types";
import { downloadBestand, uploadBestand } from "../api";

type DialoogMode = "toevoegen" | "bewerken" | "bekijken";

interface OpdrachtDialoogProps {
  mode: DialoogMode;
  opdracht: Opdracht;
  isEigenaar: boolean;
  teamGebruikers: { id: string; name: string; role: string; active: boolean }[];
  onSluit: () => void;
  onBewaar: (opdracht: Opdracht) => Promise<Opdracht>;
  onCreate?: (draft: Opdracht) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}

export function OpdrachtDialoog({
  mode,
  opdracht,
  isEigenaar,
  teamGebruikers,
  onSluit,
  onBewaar,
  onCreate,
  onDelete
}: OpdrachtDialoogProps) {
  const [bewerkt, setBewerkt] = useState<Opdracht>(opdracht);
  const [isBezig, setIsBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);

  /** Alle medewerkersaccounts (niet-eigenaar), ook als het account op non-actief staat. */
  const medewerkersVoorToewijzing = useMemo(
    () => teamGebruikers.filter((u) => u.role !== "EIGENAAR"),
    [teamGebruikers]
  );

  const isToevoegen = mode === "toevoegen";
  const isBekijken = mode === "bekijken";
  const alleenLezen = isBekijken;
  const kanBestandenToevoegen = mode === "bewerken" && bewerkt.id;
  const kanVerwijderen = isEigenaar && mode === "bewerken" && Boolean(bewerkt.id);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      setFout(null);
      setIsBezig(true);
      if (isToevoegen && onCreate) {
        await onCreate(bewerkt);
        onSluit();
      } else {
        const saved = await onBewaar(bewerkt);
        setBewerkt(saved);
        onSluit();
      }
    } catch {
      setFout(
        isToevoegen
          ? "Aanmaken mislukt. Vul verplichte velden in en probeer opnieuw."
          : "Opslaan mislukt. Controleer je invoer en probeer opnieuw."
      );
    } finally {
      setIsBezig(false);
    }
  };

  const handleMarkeerUitgevoerd = async () => {
    try {
      setFout(null);
      setIsBezig(true);
      await onBewaar({ ...bewerkt, status: OpdrachtStatus.Afgerond });
      onSluit();
    } catch {
      setFout("Status bijwerken mislukt. Probeer opnieuw.");
    } finally {
      setIsBezig(false);
    }
  };

  const handleBestanden = async (files: FileList | null) => {
    if (!files?.length || !bewerkt.id) return;
    try {
      setFout(null);
      setIsBezig(true);
      for (const file of Array.from(files)) {
        await uploadBestand(bewerkt.id, file);
      }
      const refreshed = await onBewaar(bewerkt);
      setBewerkt(refreshed);
    } catch {
      setFout("Upload mislukt. Controleer bestandstype (PDF/JPG/PNG/DOC/DOCX) en probeer opnieuw.");
    } finally {
      setIsBezig(false);
    }
  };

  const titel =
    mode === "toevoegen"
      ? "Opdracht toevoegen"
      : mode === "bewerken"
        ? "Opdracht bewerken"
        : "Opdracht bekijken";

  return (
    <div className="modal-backdrop" onClick={onSluit}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <div>
            <h2>{titel}</h2>
            <p className="muted">
              {isToevoegen &&
                "Vul alle gegevens in. Na opslaan kun je via Bewerken bestanden toevoegen."}
              {mode === "bewerken" && "Pas gegevens, toegewezen medewerker en documenten aan."}
              {isBekijken &&
                "Je kunt alleen aangeven of je deze opdracht hebt uitgevoerd (status op Afgerond zetten)."}
            </p>
          </div>
          <button type="button" className="btn-ghost" onClick={onSluit}>
            Sluiten
          </button>
        </header>
        <form className="modal-body form" onSubmit={handleSubmit}>
          <div className="modal-columns">
            <div className="modal-col">
              <label className="form-label">Naam klant</label>
              <input
                className="form-input"
                value={bewerkt.klantNaam}
                onChange={(e) => setBewerkt({ ...bewerkt, klantNaam: e.target.value })}
                readOnly={alleenLezen}
                disabled={alleenLezen}
              />
              <label className="form-label">Omschrijving opdracht</label>
              <textarea
                className="form-input"
                rows={4}
                value={bewerkt.omschrijving}
                onChange={(e) => setBewerkt({ ...bewerkt, omschrijving: e.target.value })}
                placeholder="Bijv. Verlenging paspoort, legalisatie geboorteakte..."
                readOnly={alleenLezen}
                disabled={alleenLezen}
              />
              <label className="form-label">Categorie</label>
              <input
                className="form-input"
                value={bewerkt.categorie ?? ""}
                onChange={(e) => setBewerkt({ ...bewerkt, categorie: e.target.value })}
                placeholder="Paspoort, Vergunning, Legalisatie, Intake..."
                readOnly={alleenLezen}
                disabled={alleenLezen}
              />
              <label className="form-label">Notities intern</label>
              <textarea
                className="form-input"
                rows={4}
                value={bewerkt.notities ?? ""}
                onChange={(e) => setBewerkt({ ...bewerkt, notities: e.target.value })}
                placeholder="Details, afspraken met klant..."
                readOnly={alleenLezen}
                disabled={alleenLezen}
              />
            </div>

            <div className="modal-col">
              <label className="form-label">Status</label>
              <select
                className="form-input"
                value={bewerkt.status}
                onChange={(e) =>
                  setBewerkt({ ...bewerkt, status: e.target.value as OpdrachtStatus })
                }
                disabled={alleenLezen}
              >
                <option value={OpdrachtStatus.Nieuw}>Nieuw</option>
                <option value={OpdrachtStatus.InBehandeling}>In behandeling</option>
                <option value={OpdrachtStatus.Afgerond}>Afgerond</option>
              </select>
              <label className="form-label">Prioriteit</label>
              <select
                className="form-input"
                value={bewerkt.prioriteit}
                onChange={(e) =>
                  setBewerkt({ ...bewerkt, prioriteit: Number(e.target.value) as Prioriteit })
                }
                disabled={alleenLezen}
              >
                <option value={1}>1 – Hoog</option>
                <option value={2}>2 – Normaal</option>
                <option value={3}>3 – Laag</option>
              </select>
              <label className="form-label">Taak toegewezen aan</label>
              {isEigenaar && !alleenLezen ? (
                <select
                  className="form-input"
                  value={bewerkt.behandelaarUserId ?? ""}
                  onChange={(e) => {
                    const nextId = e.target.value || null;
                    const nextNaam =
                      medewerkersVoorToewijzing.find((u) => u.id === nextId)?.name || null;
                    setBewerkt({
                      ...bewerkt,
                      behandelaarUserId: nextId,
                      behandelaarNaam: nextNaam
                    });
                  }}
                >
                  <option value="">Niet toegewezen</option>
                  {medewerkersVoorToewijzing.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                      {!u.active ? " (account niet actief)" : ""}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  className="form-input"
                  value={bewerkt.behandelaarNaam ?? "—"}
                  disabled
                  readOnly
                />
              )}
              <label className="form-label">Deadline</label>
              <input
                type="date"
                className="form-input"
                value={bewerkt.datumDeadline ?? ""}
                onChange={(e) =>
                  setBewerkt({
                    ...bewerkt,
                    datumDeadline: e.target.value || undefined
                  })
                }
                readOnly={alleenLezen}
                disabled={alleenLezen}
              />

              {kanBestandenToevoegen && (
                <>
                  <label className="form-label">Documenten uploaden</label>
                  <input
                    type="file"
                    multiple
                    className="form-input"
                    onChange={(e) => handleBestanden(e.target.files)}
                  />
                  <span className="help-text">
                    PDF, JPG, PNG, DOC. Alleen zichtbaar voor toegewezen medewerker en eigenaar.
                  </span>
                </>
              )}
              {isToevoegen && (
                <p className="muted">
                  Na het opslaan kun je bij Bewerken bestanden aan deze opdracht koppelen.
                </p>
              )}
              <div className="files-list">
                {bewerkt.bestanden?.length ? (
                  <ul>
                    {bewerkt.bestanden.map((b) => (
                      <li key={b.id} className="file-row">
                        <span className="file-name">{b.origineleNaam}</span>
                        <span className="file-meta">
                          {(b.grootte / 1024).toFixed(1)} kB
                          <button
                            type="button"
                            className="link-btn file-download-btn"
                            onClick={async () => {
                              try {
                                await downloadBestand(b.id, b.origineleNaam);
                              } catch {
                                setFout("Download mislukt. Controleer je rechten of probeer opnieuw.");
                              }
                            }}
                          >
                            Download
                          </button>
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted">Nog geen documenten gekoppeld.</p>
                )}
              </div>
            </div>
          </div>

          <footer className="modal-footer">
            {fout && (
              <span className="help-text" style={{ color: "#fecaca", marginRight: "auto" }}>
                {fout}
              </span>
            )}
            <button type="button" className="btn-ghost" onClick={onSluit}>
              {isBekijken ? "Sluiten" : "Annuleren"}
            </button>
            {kanVerwijderen && onDelete && (
              <button
                type="button"
                className="btn-secondary"
                disabled={isBezig}
                onClick={async () => {
                  try {
                    setFout(null);
                    setIsBezig(true);
                    await onDelete(bewerkt.id);
                  } catch {
                    setFout("Verwijderen mislukt. Probeer opnieuw.");
                  } finally {
                    setIsBezig(false);
                  }
                }}
              >
                Opdracht verwijderen
              </button>
            )}
            {isBekijken ? (
              <button
                type="button"
                className="btn-primary"
                disabled={isBezig || bewerkt.status === OpdrachtStatus.Afgerond}
                onClick={handleMarkeerUitgevoerd}
              >
                {isBezig ? "Bezig..." : "Markeer als uitgevoerd"}
              </button>
            ) : (
              <button type="submit" className="btn-primary" disabled={isBezig}>
                {isBezig ? "Bezig..." : isToevoegen ? "Opdracht opslaan" : "Opslaan"}
              </button>
            )}
          </footer>
        </form>
      </div>
    </div>
  );
}

