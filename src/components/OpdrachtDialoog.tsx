import { FormEvent, useEffect, useMemo, useState } from "react";
import { Opdracht, OpdrachtStatus, Prioriteit } from "../types";
import { downloadBestand, uploadBestand } from "../api";
import { opdrachtVerwijderBevestiging } from "../opdrachtVerwijderen";
import { statusLabel, vindOvereenkomstigeOpdrachten } from "../opdrachtenUtils";
import { DocumentenToevoegen } from "./DocumentenToevoegen";

type DialoogMode = "toevoegen" | "bewerken" | "bekijken";

interface OpdrachtDialoogProps {
  mode: DialoogMode;
  opdracht: Opdracht;
  isEigenaar: boolean;
  teamGebruikers: { id: string; name: string; role: string; active: boolean }[];
  bestaandeOpdrachten?: Opdracht[];
  onSluit: () => void;
  onBewaar: (opdracht: Opdracht) => Promise<Opdracht>;
  onCreate?: (draft: Opdracht) => Promise<Opdracht>;
  onDelete?: (id: string) => Promise<void>;
}

export function OpdrachtDialoog({
  mode,
  opdracht,
  isEigenaar,
  teamGebruikers,
  bestaandeOpdrachten = [],
  onSluit,
  onBewaar,
  onCreate,
  onDelete
}: OpdrachtDialoogProps) {
  const [bewerkt, setBewerkt] = useState<Opdracht>(opdracht);
  const [isBezig, setIsBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);
  const [wachtendeBestanden, setWachtendeBestanden] = useState<File[]>([]);
  const [wachtendePreviews, setWachtendePreviews] = useState<Array<{ url: string; naam: string }>>(
    []
  );

  useEffect(() => {
    const urls = wachtendeBestanden.map((file) => ({
      url: URL.createObjectURL(file),
      naam: file.name
    }));
    setWachtendePreviews(urls);
    return () => {
      urls.forEach((item) => URL.revokeObjectURL(item.url));
    };
  }, [wachtendeBestanden]);

  const actieveMedewerkers = useMemo(
    () => teamGebruikers.filter((u) => u.active && u.role !== "EIGENAAR"),
    [teamGebruikers]
  );

  const isToevoegen = mode === "toevoegen";
  const isBekijken = mode === "bekijken";
  const alleenLezen = isBekijken;
  const kanDocumentenToevoegen = !alleenLezen;
  const kanVerwijderen = isEigenaar && Boolean(bewerkt.id) && !isToevoegen && Boolean(onDelete);

  const overeenkomstigeOpdrachten = useMemo(() => {
    if (!isToevoegen) return [];
    return vindOvereenkomstigeOpdrachten(bestaandeOpdrachten, bewerkt);
  }, [isToevoegen, bestaandeOpdrachten, bewerkt.klantNaam]);

  const waarschuwingTitel = useMemo(() => {
    const naam = bewerkt.klantNaam.trim() || "Naam klant";
    return `Bestaande opdracht(en) voor “${naam}”`;
  }, [bewerkt.klantNaam]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      setFout(null);
      const matchesBijOpslaan = isToevoegen
        ? vindOvereenkomstigeOpdrachten(
            bestaandeOpdrachten,
            {
              klantNaam: bewerkt.klantNaam,
              omschrijving: bewerkt.omschrijving
            },
            undefined,
            { applyDefaults: true }
          )
        : [];
      if (matchesBijOpslaan.length > 0) {
        const voorbeelden = matchesBijOpslaan
          .slice(0, 3)
          .map((o) => `• ${o.klantNaam} – ${o.omschrijving} (${statusLabel(o.status)})`)
          .join("\n");
        const bevestigd = window.confirm(
          `Let op: er bestaan al ${matchesBijOpslaan.length} opdracht(en) met een herkenbaar gelijke klantnaam:\n\n${voorbeelden}${
            matchesBijOpslaan.length > 3 ? "\n• …" : ""
          }\n\nToch een nieuwe opdracht maken?`
        );
        if (!bevestigd) return;
      }
      setIsBezig(true);
      if (isToevoegen && onCreate) {
        const created = await onCreate(bewerkt);
        if (wachtendeBestanden.length) {
          for (const file of wachtendeBestanden) {
            await uploadBestand(created.id, file);
          }
          await onBewaar(created);
        }
        setWachtendeBestanden([]);
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

  const uploadBestanden = async (files: File[]) => {
    if (!files.length) return;
    if (bewerkt.id) {
      try {
        setFout(null);
        setIsBezig(true);
        for (const file of files) {
          await uploadBestand(bewerkt.id, file);
        }
        const refreshed = await onBewaar(bewerkt);
        setBewerkt(refreshed);
      } catch {
        setFout("Upload mislukt. Controleer bestandstype (PDF/JPG/PNG/DOC/DOCX) en probeer opnieuw.");
      } finally {
        setIsBezig(false);
      }
      return;
    }
    setWachtendeBestanden((huidig) => [...huidig, ...files]);
  };

  const verwijderWachtendBestand = (index: number) => {
    setWachtendeBestanden((huidig) => huidig.filter((_, i) => i !== index));
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
                "Vul alle gegevens in. Je kunt direct documenten uploaden of een foto maken."}
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
              <label className="form-label" htmlFor="opdracht-klantnaam">
                Naam klant
              </label>
              <input
                id="opdracht-klantnaam"
                className={`form-input${
                  isToevoegen && overeenkomstigeOpdrachten.length > 0 ? " form-input-waarschuwing" : ""
                }`}
                value={bewerkt.klantNaam}
                onChange={(e) => setBewerkt({ ...bewerkt, klantNaam: e.target.value })}
                readOnly={alleenLezen}
                disabled={alleenLezen}
                autoComplete="off"
                aria-describedby={
                  isToevoegen && overeenkomstigeOpdrachten.length > 0
                    ? "opdracht-klant-waarschuwing"
                    : undefined
                }
              />
              {isToevoegen && overeenkomstigeOpdrachten.length > 0 && (
                <div
                  id="opdracht-klant-waarschuwing"
                  className="opdracht-dubbel-waarschuwing"
                  role="alert"
                  aria-live="polite"
                >
                  <strong>{waarschuwingTitel}</strong>
                  <p>
                    Er {overeenkomstigeOpdrachten.length === 1 ? "bestaat" : "bestaan"} al{" "}
                    {overeenkomstigeOpdrachten.length} opdracht(en) met een herkenbaar gelijke
                    klantnaam.
                  </p>
                  <ul>
                    {overeenkomstigeOpdrachten.slice(0, 4).map((o) => (
                      <li key={o.id}>
                        <span>
                          {o.klantNaam} – {o.omschrijving || "Geen omschrijving"}
                        </span>
                        <span className="muted"> · {statusLabel(o.status)}</span>
                      </li>
                    ))}
                  </ul>
                  {overeenkomstigeOpdrachten.length > 4 && (
                    <p className="muted">+ {overeenkomstigeOpdrachten.length - 4} andere</p>
                  )}
                </div>
              )}
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
                <option value={OpdrachtStatus.Afwachting}>Afwachting</option>
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
                      actieveMedewerkers.find((u) => u.id === nextId)?.name || null;
                    setBewerkt({
                      ...bewerkt,
                      behandelaarUserId: nextId,
                      behandelaarNaam: nextNaam
                    });
                  }}
                >
                  <option value="">Niet toegewezen</option>
                  {actieveMedewerkers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
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

              {kanDocumentenToevoegen && (
                <DocumentenToevoegen disabled={isBezig} onBestanden={uploadBestanden} />
              )}
              <div className="files-list">
                {wachtendePreviews.length > 0 && (
                  <div className="documenten-wachtrij">
                    <p className="muted">
                      {isToevoegen
                        ? "Wordt gekoppeld na opslaan:"
                        : "Klaar om te uploaden:"}
                    </p>
                    <div className="inzending-fotos inzending-fotos-preview">
                      {wachtendePreviews.map((item, index) => (
                        <figure key={`${item.naam}-${index}`} className="inzending-foto">
                          {item.naam.match(/\.(jpe?g|png|webp|gif)$/i) ? (
                            <img src={item.url} alt={item.naam} />
                          ) : (
                            <div className="inzending-foto-placeholder">{item.naam}</div>
                          )}
                          <figcaption>
                            <span>{item.naam}</span>
                            <button
                              type="button"
                              className="link-btn"
                              onClick={() => verwijderWachtendBestand(index)}
                            >
                              Verwijderen
                            </button>
                          </figcaption>
                        </figure>
                      ))}
                    </div>
                  </div>
                )}
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
              <span className="help-text page-error" style={{ marginRight: "auto" }}>
                {fout}
              </span>
            )}
            <button type="button" className="btn-ghost" onClick={onSluit}>
              {isBekijken ? "Sluiten" : "Annuleren"}
            </button>
            {kanVerwijderen && (
              <button
                type="button"
                className="btn-secondary btn-danger"
                disabled={isBezig}
                onClick={async () => {
                  const bevestigd = window.confirm(
                    opdrachtVerwijderBevestiging(bewerkt.klantNaam)
                  );
                  if (!bevestigd) return;
                  try {
                    setFout(null);
                    setIsBezig(true);
                    await onDelete!(bewerkt.id);
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
