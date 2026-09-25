import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Opdracht, OpdrachtStatus, Prioriteit } from "../types";
import { downloadBestand, fetchBestandBlob, hernoemBestand, uploadBestand, verwijderBestand } from "../api";
import { isAfbeeldingBestand, isBekijkbaarBestand } from "../bestandUtils";
import { opdrachtVerwijderBevestiging } from "../opdrachtVerwijderen";
import { statusLabel, vindOvereenkomstigeOpdrachten } from "../opdrachtenUtils";
import { BestandViewer, BestandViewerItem } from "./BestandViewer";
import { DocumentenToevoegen } from "./DocumentenToevoegen";

type DialoogMode = "toevoegen" | "bewerken" | "bekijken";

type WachtendBestand = {
  id: string;
  file: File;
  url: string;
};

function nieuwWachtendId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `wachtend-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normaliseerBestandsnaam(huidigeNaam: string, nieuweNaam: string): string {
  const trimmed = nieuweNaam.trim().replace(/[\\/:*?"<>|]/g, "_");
  if (!trimmed) return huidigeNaam;
  const oudeExtMatch = huidigeNaam.match(/(\.[a-z0-9]{1,8})$/i);
  const oudeExt = oudeExtMatch ? oudeExtMatch[1] : "";
  const heeftExt = /\.[a-z0-9]{1,8}$/i.test(trimmed);
  return (heeftExt ? trimmed : `${trimmed}${oudeExt}`).slice(0, 200);
}

function hernoemFile(file: File, nieuweNaam: string): File {
  const naam = normaliseerBestandsnaam(file.name, nieuweNaam);
  if (naam === file.name) return file;
  return new File([file], naam, { type: file.type, lastModified: file.lastModified });
}

function BestandNaamVeld({
  naam,
  disabled,
  onOpslaan
}: {
  naam: string;
  disabled?: boolean;
  onOpslaan: (naam: string) => void;
}) {
  const [waarde, setWaarde] = useState(naam);

  useEffect(() => {
    setWaarde(naam);
  }, [naam]);

  return (
    <input
      className="form-input file-rename-input"
      value={waarde}
      disabled={disabled}
      aria-label="Bestandsnaam"
      onChange={(e) => setWaarde(e.target.value)}
      onBlur={() => onOpslaan(waarde)}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          (e.currentTarget as HTMLInputElement).blur();
        }
      }}
    />
  );
}

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
  const [wachtendeBestanden, setWachtendeBestanden] = useState<WachtendBestand[]>([]);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const wachtendeBestandenRef = useRef<WachtendBestand[]>([]);
  wachtendeBestandenRef.current = wachtendeBestanden;

  const viewerItems = useMemo<BestandViewerItem[]>(() => {
    const wachtend = wachtendeBestanden
      .filter((item) => isBekijkbaarBestand(item.file.name, item.file.type))
      .map((item) => ({
        id: item.id,
        naam: item.file.name,
        mimeType: item.file.type,
        url: item.url
      }));
    const gekoppeld = (bewerkt.bestanden || [])
      .filter((b) => isBekijkbaarBestand(b.origineleNaam, b.mimeType))
      .map((b) => ({
        id: b.id,
        naam: b.origineleNaam,
        mimeType: b.mimeType,
        fetchBlob: () => fetchBestandBlob(b.id)
      }));
    return [...wachtend, ...gekoppeld];
  }, [wachtendeBestanden, bewerkt.bestanden]);

  useEffect(() => {
    return () => {
      wachtendeBestandenRef.current.forEach((item) => URL.revokeObjectURL(item.url));
    };
  }, []);

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
          for (const item of wachtendeBestanden) {
            await uploadBestand(created.id, item.file);
          }
          await onBewaar(created);
        }
        wisWachtendeBestanden();
        onSluit();
      } else {
        let saved = await onBewaar(bewerkt);
        if (wachtendeBestanden.length) {
          for (const item of wachtendeBestanden) {
            await uploadBestand(saved.id, item.file);
          }
          saved = await onBewaar(saved);
        }
        wisWachtendeBestanden();
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

  const wisWachtendeBestanden = () => {
    wachtendeBestandenRef.current.forEach((item) => URL.revokeObjectURL(item.url));
    setWachtendeBestanden([]);
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

  const uploadBestanden = (files: File[]) => {
    if (!files.length) return;
    setWachtendeBestanden((huidig) => [
      ...huidig,
      ...files.map((file) => ({
        id: nieuwWachtendId(),
        file,
        url: URL.createObjectURL(file)
      }))
    ]);
  };

  const hernoemWachtendBestand = (id: string, nieuweNaam: string) => {
    setWachtendeBestanden((huidig) =>
      huidig.map((item) => {
        if (item.id !== id) return item;
        const file = hernoemFile(item.file, nieuweNaam);
        return file === item.file ? item : { ...item, file };
      })
    );
  };

  const verwijderWachtendBestand = (id: string) => {
    setWachtendeBestanden((huidig) => {
      const item = huidig.find((x) => x.id === id);
      if (item) URL.revokeObjectURL(item.url);
      return huidig.filter((x) => x.id !== id);
    });
  };

  const hernoemGekoppeldBestand = async (bestandId: string, nieuweNaam: string) => {
    const huidig = bewerkt.bestanden.find((b) => b.id === bestandId);
    if (!huidig) return;
    const naam = normaliseerBestandsnaam(huidig.origineleNaam, nieuweNaam);
    if (naam === huidig.origineleNaam) return;
    try {
      setFout(null);
      setIsBezig(true);
      const result = await hernoemBestand(bestandId, naam);
      const next = {
        ...bewerkt,
        bestanden: bewerkt.bestanden.map((b) =>
          b.id === bestandId ? { ...b, origineleNaam: result.bestand.origineleNaam } : b
        )
      };
      setBewerkt(next);
      try {
        setBewerkt(await onBewaar(next));
      } catch {
        /* naam is al op de server aangepast */
      }
    } catch {
      setFout("Hernoemen mislukt. Probeer opnieuw.");
    } finally {
      setIsBezig(false);
    }
  };

  const verwijderGekoppeldBestand = async (bestandId: string, naam: string) => {
    const bevestigd = window.confirm(`Bestand “${naam}” verwijderen?`);
    if (!bevestigd) return;
    try {
      setFout(null);
      setIsBezig(true);
      await verwijderBestand(bestandId);
      const next = {
        ...bewerkt,
        bestanden: bewerkt.bestanden.filter((b) => b.id !== bestandId)
      };
      setBewerkt(next);
      try {
        setBewerkt(await onBewaar(next));
      } catch {
        /* bestand is al op de server verwijderd */
      }
    } catch {
      setFout("Verwijderen mislukt. Probeer opnieuw.");
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
    <>
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
                {wachtendeBestanden.length > 0 && (
                  <div className="documenten-wachtrij">
                    <p className="muted">
                      {isToevoegen
                        ? "Wordt gekoppeld na opslaan. Pas de naam aan of verwijder een bestand."
                        : "Nieuw toegevoegd — wordt gekoppeld na opslaan. Pas de naam aan of verwijder een bestand."}
                    </p>
                    <ul className="files-edit-list">
                      {wachtendeBestanden.map((item) => (
                        <li key={item.id} className="file-row file-row-edit">
                          {isAfbeeldingBestand(item.file.name, item.file.type) ? (
                            <button
                              type="button"
                              className="file-row-thumb-btn"
                              onClick={() => setViewerId(item.id)}
                              title="Foto bekijken"
                            >
                              <img
                                className="file-row-thumb"
                                src={item.url}
                                alt={item.file.name}
                              />
                            </button>
                          ) : (
                            <span className="file-row-icon" aria-hidden>
                              📄
                            </span>
                          )}
                          <BestandNaamVeld
                            naam={item.file.name}
                            disabled={isBezig}
                            onOpslaan={(naam) => hernoemWachtendBestand(item.id, naam)}
                          />
                          {isBekijkbaarBestand(item.file.name, item.file.type) && (
                            <button
                              type="button"
                              className="link-btn file-download-btn"
                              onClick={() => setViewerId(item.id)}
                            >
                              Bekijken
                            </button>
                          )}
                          <button
                            type="button"
                            className="link-btn file-row-verwijder"
                            disabled={isBezig}
                            onClick={() => verwijderWachtendBestand(item.id)}
                          >
                            Verwijderen
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {bewerkt.bestanden?.length ? (
                  <ul className="files-edit-list">
                    {bewerkt.bestanden.map((b) => (
                      <li key={b.id} className="file-row file-row-edit">
                        <span className="file-row-icon" aria-hidden>
                          📄
                        </span>
                        {kanDocumentenToevoegen ? (
                          <BestandNaamVeld
                            naam={b.origineleNaam}
                            disabled={isBezig}
                            onOpslaan={(naam) => void hernoemGekoppeldBestand(b.id, naam)}
                          />
                        ) : (
                          <span className="file-name">{b.origineleNaam}</span>
                        )}
                        <span className="file-meta">
                          {(b.grootte / 1024).toFixed(1)} kB
                          {isBekijkbaarBestand(b.origineleNaam, b.mimeType) && (
                            <button
                              type="button"
                              className="link-btn file-download-btn"
                              onClick={() => setViewerId(b.id)}
                            >
                              Bekijken
                            </button>
                          )}
                          <button
                            type="button"
                            className="link-btn file-download-btn"
                            onClick={async () => {
                              try {
                                setFout(null);
                                await downloadBestand(b.id, b.origineleNaam);
                              } catch (err) {
                                setFout(
                                  err instanceof Error
                                    ? err.message
                                    : "Download mislukt. Controleer je rechten of probeer opnieuw."
                                );
                              }
                            }}
                          >
                            Download
                          </button>
                          {kanDocumentenToevoegen && (
                            <button
                              type="button"
                              className="link-btn file-row-verwijder"
                              disabled={isBezig}
                              onClick={() => void verwijderGekoppeldBestand(b.id, b.origineleNaam)}
                            >
                              Verwijderen
                            </button>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  wachtendeBestanden.length === 0 && (
                    <p className="muted">Nog geen documenten gekoppeld.</p>
                  )
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
    {viewerId && viewerItems.length > 0 && (
      <BestandViewer
        items={viewerItems}
        startId={viewerId}
        onClose={() => setViewerId(null)}
        onDownload={async (item) => {
          if (item.fetchBlob) {
            try {
              setFout(null);
              await downloadBestand(item.id, item.naam);
            } catch (err) {
              setFout(
                err instanceof Error
                  ? err.message
                  : "Download mislukt. Controleer je rechten of probeer opnieuw."
              );
            }
          }
        }}
      />
    )}
    </>
  );
}
