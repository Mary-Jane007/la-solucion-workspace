import { useEffect, useMemo, useRef, useState } from "react";
import {
  createFinancieelInzending,
  fetchFinancieelInzendingen,
  fetchKasSuggesties,
  FinancieelInzending,
  FinancieelValuta
} from "../api";
import { APP_VERNIEUW_EVENT, FINANCIEEL_INZENDING_EVENT } from "../appPages";
import {
  bewaarKasConcept,
  bouwTegels,
  formatDagLang,
  gisterenIso,
  inzendingNaarRegel,
  isKasTellingInzending,
  KasDagConcept,
  KasDagRegel,
  KasTegel,
  leegKasConcept,
  leesKasConcept,
  lokaleDagIso,
  MAX_KAS_FOTO_BYTES,
  MAX_KAS_FOTOS,
  KAS_DAG_VALUTAS,
  VASTE_ANDERE_TEGELS,
  regelNaarPayload,
  tellingNaarPayload,
  verwachtRestant
} from "../kasDag";
import { BestandDropzone } from "./BestandDropzone";
import { bestandenUitLijst } from "../bestandUtils";
import {
  FINANCIEEL_VASTE_MEDEWERKERS,
  formatDatumTijd,
  formatGeld,
  nuDateTimeLocal,
  parseGeldInvoer,
  dateTimeLocalNaarIso,
  typeLabel,
  VALUTA_LABELS
} from "../financieelUtils";
import { Gebruiker } from "../types";
import { InzendingBijlagen } from "./financieel/InzendingBijlagen";

interface Props {
  gebruiker: Gebruiker;
  onNaarHelp?: () => void;
}

const STATUS_LABEL: Record<FinancieelInzending["status"], string> = {
  NIEUW: "Eigenaar heeft het nog niet gezien",
  GEZIEN: "Eigenaar heeft het gezien",
  VERWERKT: "Verwerkt in de administratie"
};

type BladStaat = {
  tegel: KasTegel;
  bedrag: string;
  extra: string;
  notitie: string;
  fotos: File[];
};

function nieuwId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `kas-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function bedragTekst(waarde: number, valuta: FinancieelValuta): string {
  return formatGeld(waarde, valuta);
}

function dagVanInzending(item: FinancieelInzending): string {
  const bron = item.datum || item.createdAt;
  const d = new Date(bron);
  if (Number.isNaN(d.getTime())) return String(bron).slice(0, 10);
  return lokaleDagIso(d);
}

export function MedewerkerFinancieelPagina({ gebruiker, onNaarHelp }: Props) {
  const vandaag = lokaleDagIso();
  const [concept, setConcept] = useState<KasDagConcept>(
    () => leesKasConcept(gebruiker.id, vandaag) || leegKasConcept(vandaag)
  );
  const [tegelsVaak, setTegelsVaak] = useState<KasTegel[]>(() => bouwTegels([]).vaak);
  const [tegelsOok, setTegelsOok] = useState<KasTegel[]>(() => bouwTegels([]).ook);
  const [fotosPerRegel, setFotosPerRegel] = useState<Record<string, File[]>>({});
  const [blad, setBlad] = useState<BladStaat | null>(null);
  const [inzendingen, setInzendingen] = useState<FinancieelInzending[]>([]);
  const [laden, setLaden] = useState(true);
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);
  const [toonOuder, setToonOuder] = useState(false);
  const cameraRef = useRef<HTMLInputElement | null>(null);
  const bladBedragRef = useRef<HTMLInputElement | null>(null);
  const overigTegel = VASTE_ANDERE_TEGELS.find((tegel) => tegel.id === "overig")!;

  const alleTegels = useMemo(() => [...tegelsVaak, ...tegelsOok], [tegelsVaak, tegelsOok]);

  useEffect(() => {
    bewaarKasConcept(gebruiker.id, concept);
  }, [gebruiker.id, concept]);

  useEffect(() => {
    void fetchKasSuggesties()
      .then((slim) => {
        const groepen = bouwTegels(slim);
        setTegelsVaak(groepen.vaak);
        setTegelsOok(groepen.ook);
      })
      .catch(() => {
        /* vaste tegels blijven staan */
      });
  }, []);

  const laad = async () => {
    try {
      const data = await fetchFinancieelInzendingen();
      setInzendingen(data.inzendingen);
    } catch (error) {
      setFout(error instanceof Error ? error.message : "Kon eerdere inzendingen niet laden.");
    } finally {
      setLaden(false);
    }
  };

  useEffect(() => {
    void laad();
    const onVernieuw = () => void laad();
    window.addEventListener(APP_VERNIEUW_EVENT, onVernieuw);
    return () => window.removeEventListener(APP_VERNIEUW_EVENT, onVernieuw);
  }, []);

  const vandaagVerzonden = useMemo(
    () => inzendingen.filter((item) => dagVanInzending(item) === vandaag),
    [inzendingen, vandaag]
  );
  const oudereInzendingen = useMemo(
    () => inzendingen.filter((item) => dagVanInzending(item) !== vandaag),
    [inzendingen, vandaag]
  );

  const restant = verwachtRestant(concept);
  const geteld = parseGeldInvoer(concept.eindkas);
  const openend = parseGeldInvoer(concept.openingskas);
  const openRegels = concept.regels.filter((r) => !r.verzondenId);
  const bladFotos = blad?.fotos;
  const bladPreviews = useMemo(
    () => (bladFotos ? bladFotos.map((file) => ({ naam: file.name, url: URL.createObjectURL(file) })) : []),
    [bladFotos]
  );
  useEffect(() => {
    return () => {
      for (const preview of bladPreviews) URL.revokeObjectURL(preview.url);
    };
  }, [bladPreviews]);

  const verzendDatum = () => {
    try {
      return dateTimeLocalNaarIso(nuDateTimeLocal());
    } catch {
      return new Date().toISOString();
    }
  };

  const openTegel = (tegel: KasTegel) => {
    setFout(null);
    setSucces(null);
    setBlad({ tegel, bedrag: "", extra: "", notitie: "", fotos: [] });
  };

  const voegFotosToe = (lijst: FileList | File[] | null, huidig: File[]) => {
    const gekozen = bestandenUitLijst(lijst);
    if (!gekozen.length) return huidig;
    const teGroot = gekozen.find((file) => file.size > MAX_KAS_FOTO_BYTES);
    if (teGroot) {
      setFout(`“${teGroot.name}” is groter dan 8 MB. Kies een kleinere foto.`);
      return huidig;
    }
    const samen = [...huidig, ...gekozen];
    if (samen.length > MAX_KAS_FOTOS) {
      setFout(`Je kunt maximaal ${MAX_KAS_FOTOS} foto’s bij één regel zetten.`);
      return samen.slice(0, MAX_KAS_FOTOS);
    }
    return samen;
  };

  const zetOpLijst = (nogEen = false) => {
    if (!blad) return;
    const bedrag = parseGeldInvoer(blad.bedrag);
    if (bedrag === null || bedrag < 0) {
      setFout("Vul het bedrag in. 0 mag als het niks kostte.");
      return;
    }
    if (blad.tegel.id === "overig" && !blad.extra.trim()) {
      setFout("Schrijf kort op wat het was.");
      return;
    }
    if (blad.tegel.soort === "OVERDRACHT" && !blad.extra.trim()) {
      setFout("Zeg aan wie je het geld gaf.");
      return;
    }
    const id = nieuwId();
    const regel: KasDagRegel = {
      id,
      tegelId: blad.tegel.id,
      label: blad.tegel.id === "overig" ? blad.extra.trim() : blad.tegel.label,
      soort: blad.tegel.soort,
      bedrag: blad.bedrag.trim(),
      extra: blad.extra.trim(),
      notitie: blad.notitie.trim()
    };
    const zelfdeTegel = blad.tegel;
    setConcept((huidig) => ({ ...huidig, regels: [...huidig.regels, regel] }));
    if (blad.fotos.length) {
      setFotosPerRegel((huidig) => ({ ...huidig, [id]: blad.fotos }));
    }
    setFout(null);
    if (nogEen) {
      setBlad({ tegel: zelfdeTegel, bedrag: "", extra: "", notitie: "", fotos: [] });
      setSucces(`${regel.label} staat op de lijst. Vul het volgende aparte bedrag in.`);
      window.setTimeout(() => bladBedragRef.current?.focus(), 40);
    } else {
      setBlad(null);
      setSucces(`${regel.label} staat op je lijst. Tik Bedrag toevoegen voor een apart bedrag.`);
    }
  };

  const verwijderRegel = (id: string) => {
    setConcept((huidig) => ({ ...huidig, regels: huidig.regels.filter((r) => r.id !== id) }));
    setFotosPerRegel((huidig) => {
      const kopie = { ...huidig };
      delete kopie[id];
      return kopie;
    });
  };

  const verstuurEen = async (regel: KasDagRegel) => {
    const payload = regelNaarPayload(regel, {
      datum: verzendDatum(),
      valuta: concept.valuta,
      medewerkerNaam: gebruiker.naam
    });
    if ("fout" in payload) {
      setFout(payload.fout);
      return;
    }
    const created = await createFinancieelInzending(payload, fotosPerRegel[regel.id] || []);
    setConcept((huidig) => ({
      ...huidig,
      regels: huidig.regels.map((r) => (r.id === regel.id ? { ...r, verzondenId: created.id } : r))
    }));
    setFotosPerRegel((huidig) => {
      const kopie = { ...huidig };
      delete kopie[regel.id];
      return kopie;
    });
    setInzendingen((huidig) => [created, ...huidig]);
    window.dispatchEvent(new Event(FINANCIEEL_INZENDING_EVENT));
  };

  const zelfdeAlsGisteren = () => {
    const gisteren = gisterenIso();
    const bron =
      inzendingen.filter((item) => dagVanInzending(item) === gisteren && !isKasTellingInzending(item));
    const bronLijst = bron.length
      ? bron
      : oudereInzendingen.filter((item) => !isKasTellingInzending(item)).slice(0, 8);
    if (!bronLijst.length) {
      setFout("Er is geen vorige dag om te kopiëren.");
      return;
    }
    const kopie = bronLijst
      .map(inzendingNaarRegel)
      .filter((regel): regel is KasDagRegel => Boolean(regel))
      .map((regel) => ({ ...regel, id: nieuwId(), bedrag: "" }));
    setConcept((huidig) => ({ ...huidig, regels: [...huidig.regels, ...kopie] }));
    setSucces("De regels van de vorige dag staan erin. Vul de bedragen van vandaag in.");
    setFout(null);
  };

  const dagDoorgeven = async () => {
    if (!openRegels.length && openend === null && geteld === null) {
      setFout("Tik eerst wat je deed, of vul hoeveel er nog in kas ligt.");
      return;
    }
    for (const regel of openRegels) {
      const check = regelNaarPayload(regel, {
        datum: verzendDatum(),
        valuta: concept.valuta,
        medewerkerNaam: gebruiker.naam
      });
      if ("fout" in check) {
        setFout(`${regel.label}: ${check.fout}`);
        return;
      }
    }
    try {
      setBezig(true);
      setFout(null);
      setSucces(null);
      if (openend !== null && !concept.openingVerzonden) {
        const payload = tellingNaarPayload("opening", concept.openingskas, {
          datum: verzendDatum(),
          valuta: concept.valuta,
          medewerkerNaam: gebruiker.naam
        });
        if ("fout" in payload) throw new Error(payload.fout);
        const created = await createFinancieelInzending(payload);
        setInzendingen((huidig) => [created, ...huidig]);
        setConcept((huidig) => ({ ...huidig, openingVerzonden: true }));
      }
      for (const regel of openRegels) {
        await verstuurEen(regel);
      }
      if (geteld !== null && !concept.tellingVerzonden) {
        const verschil =
          restant !== null ? `Volgens de lijst zou er ${bedragTekst(restant, concept.valuta)} overblijven.` : "";
        const payload = tellingNaarPayload("einde", concept.eindkas, {
          datum: verzendDatum(),
          valuta: concept.valuta,
          medewerkerNaam: gebruiker.naam,
          notitie: verschil
        });
        if ("fout" in payload) throw new Error(payload.fout);
        const created = await createFinancieelInzending(payload);
        setInzendingen((huidig) => [created, ...huidig]);
        setConcept((huidig) => ({ ...huidig, tellingVerzonden: true }));
      }
      window.dispatchEvent(new Event(FINANCIEEL_INZENDING_EVENT));
      setSucces("De dag is doorgestuurd naar de eigenaar. Vergeten iets? Tik het er alsnog bij.");
    } catch (error) {
      setFout(error instanceof Error ? error.message : "Verzenden mislukt. Probeer het opnieuw.");
    } finally {
      setBezig(false);
    }
  };

  return (
    <div className="kasdag">
      <header className="kasdag-top">
        <div>
          <p className="kasdag-kicker">Jouw kas van vandaag</p>
          <h2 className="kasdag-titel">{formatDagLang(vandaag)}</h2>
          <p className="kasdag-lead">
            Tik wat je deed. Aan het eind stuur je alles in één keer door. De eigenaar vult de
            boekhouding verder in.
          </p>
        </div>
        <button type="button" className="kasdag-hulp" onClick={onNaarHelp}>
          Hulp
        </button>
      </header>

      {fout && <p className="kasdag-fout">{fout}</p>}
      {succes && <p className="kasdag-ok">{succes}</p>}

      <section className="kasdag-kaart">
        <p className="kasdag-vraag">In welke munt tel je vandaag?</p>
        <div className="kasdag-chips">
          {KAS_DAG_VALUTAS.map((code) => (
            <button
              key={code}
              type="button"
              className={`kasdag-chip${concept.valuta === code ? " is-actief" : ""}`}
              onClick={() => setConcept((huidig) => ({ ...huidig, valuta: code }))}
            >
              {VALUTA_LABELS[code]}
            </button>
          ))}
        </div>
      </section>

      <section className="kasdag-kaart kasdag-stap">
        <span className="kasdag-nr" aria-hidden>
          1
        </span>
        <div className="kasdag-stap-body">
          <h3>Hoeveel lag er vanochtend in je kas?</h3>
          <p className="kasdag-hulptekst">Tel het geld waarmee je de dag begon. Weet je het niet? Sla over.</p>
          <label className="kasdag-bedrag-label">
            <span className="sr-only">Openingskas</span>
            <input
              className="kasdag-bedrag"
              inputMode="decimal"
              placeholder="0"
              value={concept.openingskas}
              onChange={(e) => setConcept((huidig) => ({ ...huidig, openingskas: e.target.value }))}
            />
            <span className="kasdag-valuta-tag">{concept.valuta}</span>
          </label>
        </div>
      </section>

      <section className="kasdag-kaart kasdag-stap">
        <span className="kasdag-nr" aria-hidden>
          2
        </span>
        <div className="kasdag-stap-body">
          <h3>Tik wat je deed</h3>
          <p className="kasdag-hulptekst">
            Grote knoppen voor wat jullie het meest doen. Elk apart bedrag is een eigen regel — tik
            zo vaak als je nodig hebt. Foto van de bon mag, hoeft niet.
          </p>
          <p className="kasdag-groepnaam">Vaak gebruikt</p>
          <div className="kasdag-tegels">
            {tegelsVaak.map((tegel) => (
              <button key={tegel.id} type="button" className="kasdag-tegel" onClick={() => openTegel(tegel)}>
                <span className="kasdag-tegel-icoon" aria-hidden>
                  {tegel.icoon}
                </span>
                <strong>{tegel.label}</strong>
                <span>{tegel.hint}</span>
              </button>
            ))}
          </div>
          <p className="kasdag-groepnaam">Ook doorgeven</p>
          <div className="kasdag-tegels kasdag-tegels-ook">
            {tegelsOok.map((tegel) => (
              <button
                key={tegel.id}
                type="button"
                className={`kasdag-tegel kasdag-tegel-${tegel.soort.toLowerCase()}`}
                onClick={() => openTegel(tegel)}
              >
                <span className="kasdag-tegel-icoon" aria-hidden>
                  {tegel.icoon}
                </span>
                <strong>{tegel.label}</strong>
                <span>{tegel.hint}</span>
              </button>
            ))}
          </div>
          <button type="button" className="kasdag-regel-toevoegen" onClick={() => openTegel(overigTegel)}>
            + Bedrag toevoegen
          </button>
        </div>
      </section>

      <section className="kasdag-kaart kasdag-stap">
        <span className="kasdag-nr" aria-hidden>
          3
        </span>
        <div className="kasdag-stap-body">
          <div className="kasdag-rij-kop">
            <h3>Jouw dag tot nu toe</h3>
            <button type="button" className="kasdag-tekstknop" onClick={zelfdeAlsGisteren}>
              Zelfde als gisteren
            </button>
          </div>
          <p className="kasdag-hulptekst">
            Benzine apart, printen apart, eten apart — niet optellen. Tik Bedrag toevoegen voor elk
            bedrag.
          </p>
          {concept.regels.length === 0 ? (
            <p className="kasdag-leeg">Nog niets. Tik hierboven op wat je deed, of op Bedrag toevoegen.</p>
          ) : (
            <ul className="kasdag-lijst">
              {concept.regels.map((regel) => {
                const tegel = alleTegels.find((t) => t.id === regel.tegelId);
                const fotos = fotosPerRegel[regel.id] || [];
                const bedragNr = parseGeldInvoer(regel.bedrag);
                return (
                  <li key={regel.id} className={`kasdag-regel${regel.verzondenId ? " is-verzonden" : ""}`}>
                    <span className="kasdag-regel-icoon" aria-hidden>
                      {tegel?.icoon || "•"}
                    </span>
                    <div className="kasdag-regel-main">
                      <strong>{regel.label}</strong>
                      <span>
                        {bedragNr === null ? "Bedrag invullen" : bedragTekst(bedragNr, concept.valuta)}
                        {regel.extra && regel.soort !== "UITGAVE" ? ` · ${regel.extra}` : ""}
                        {fotos.length ? ` · ${fotos.length} foto` : ""}
                      </span>
                      <em>{regel.verzondenId ? "Al doorgestuurd" : "Nog op je lijst"}</em>
                    </div>
                    <div className="kasdag-regel-acties">
                      <button
                        type="button"
                        className="kasdag-mini"
                        onClick={() => {
                          const tegel =
                            alleTegels.find((t) => t.id === regel.tegelId) || overigTegel;
                          openTegel(tegel);
                        }}
                      >
                        Nog een
                      </button>
                      {!regel.verzondenId && (
                        <button
                          type="button"
                          className="kasdag-mini"
                          disabled={bezig}
                          onClick={() => {
                            void (async () => {
                              try {
                                setBezig(true);
                                setFout(null);
                                await verstuurEen(regel);
                                setSucces(`${regel.label} is al doorgestuurd.`);
                              } catch (error) {
                                setFout(error instanceof Error ? error.message : "Verzenden mislukt.");
                              } finally {
                                setBezig(false);
                              }
                            })();
                          }}
                        >
                          Nu sturen
                        </button>
                      )}
                      {!regel.verzondenId && (
                        <button type="button" className="kasdag-mini kasdag-mini-weg" onClick={() => verwijderRegel(regel.id)}>
                          Weg
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          <button type="button" className="kasdag-regel-toevoegen" onClick={() => openTegel(overigTegel)}>
            + Bedrag toevoegen
          </button>
        </div>
      </section>

      <section className="kasdag-kaart kasdag-stap">
        <span className="kasdag-nr" aria-hidden>
          4
        </span>
        <div className="kasdag-stap-body">
          <h3>Hoeveel ligt er nu nog in je kas?</h3>
          <p className="kasdag-hulptekst">Tel wat je overhoudt. De eigenaar ziet dan of alles klopt.</p>
          <label className="kasdag-bedrag-label">
            <span className="sr-only">Eindtelling kas</span>
            <input
              className="kasdag-bedrag"
              inputMode="decimal"
              placeholder="0"
              value={concept.eindkas}
              onChange={(e) => setConcept((huidig) => ({ ...huidig, eindkas: e.target.value }))}
            />
            <span className="kasdag-valuta-tag">{concept.valuta}</span>
          </label>
          {restant !== null && (
            <p className="kasdag-check">
              Volgens je lijst zou er {bedragTekst(restant, concept.valuta)} overblijven.
              {geteld !== null && geteld !== restant
                ? " Dat is anders dan wat jij telt — geen probleem, stuur het toch door."
                : geteld !== null
                  ? " Dat klopt met jouw telling."
                  : ""}
            </p>
          )}
        </div>
      </section>

      <div className="kasdag-actiebar">
        <button type="button" className="kasdag-verstuur" disabled={bezig} onClick={() => void dagDoorgeven()}>
          {bezig ? "Bezig met versturen…" : "Dag doorgeven"}
        </button>
        <p>
          {openRegels.length
            ? `${openRegels.length} ${openRegels.length === 1 ? "regel gaat" : "regels gaan"} mee`
            : "Alleen de kas-telling gaat mee, als je die hebt ingevuld"}
        </p>
      </div>

      <section className="kasdag-kaart">
        <h3>Al verzonden vandaag</h3>
        {laden ? (
          <p className="kasdag-hulptekst">Laden…</p>
        ) : vandaagVerzonden.length === 0 ? (
          <p className="kasdag-hulptekst">Nog niets verstuurd vandaag.</p>
        ) : (
          <ul className="kasdag-verzonden">
            {vandaagVerzonden.map((item) => (
              <li key={item.id}>
                <strong>
                  {typeLabel(item.type, item)} · {formatGeld(item.bedrag, item.valuta)}
                </strong>
                <span>{item.omschrijving}</span>
                <span className="kasdag-status">{STATUS_LABEL[item.status]}</span>
                <span className="kasdag-meta">{formatDatumTijd(item.createdAt)}</span>
                <InzendingBijlagen bijlagen={item.bijlagen} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {oudereInzendingen.length > 0 && (
        <section className="kasdag-kaart">
          <button type="button" className="kasdag-tekstknop" onClick={() => setToonOuder((v) => !v)}>
            {toonOuder ? "Eerdere dagen verbergen" : "Eerdere dagen bekijken"}
          </button>
          {toonOuder && (
            <ul className="kasdag-verzonden">
              {oudereInzendingen.slice(0, 20).map((item) => (
                <li key={item.id}>
                  <strong>
                    {typeLabel(item.type, item)} · {formatGeld(item.bedrag, item.valuta)}
                  </strong>
                  <span>{item.omschrijving}</span>
                  <span className="kasdag-meta">{formatDatumTijd(item.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {blad && (
        <div className="kasdag-overlay" role="presentation" onClick={() => setBlad(null)}>
          <div
            className="kasdag-blad"
            role="dialog"
            aria-modal="true"
            aria-labelledby="kasdag-blad-titel"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="kasdag-blad-icoon" aria-hidden>
              {blad.tegel.icoon}
            </p>
            <h3 id="kasdag-blad-titel">{blad.tegel.label}</h3>
            <p className="kasdag-hulptekst">
              {blad.tegel.hint}. Alleen dit bedrag — heb je er nog een, tik daarna Nog een bedrag.
            </p>
            {fout && <p className="kasdag-fout">{fout}</p>}
            {succes && blad && <p className="kasdag-ok">{succes}</p>}

            {blad.tegel.id === "overig" && (
              <label className="kasdag-veld">
                Wat was het?
                <input
                  className="kasdag-invoer"
                  value={blad.extra}
                  onChange={(e) => setBlad((huidig) => (huidig ? { ...huidig, extra: e.target.value } : huidig))}
                  placeholder="Bijvoorbeeld: water, akte, belkaart"
                />
              </label>
            )}
            {blad.tegel.soort === "INKOMST" && (
              <label className="kasdag-veld">
                Van welke klant? (mag leeg)
                <input
                  className="kasdag-invoer"
                  value={blad.extra}
                  onChange={(e) => setBlad((huidig) => (huidig ? { ...huidig, extra: e.target.value } : huidig))}
                  placeholder="Naam klant"
                />
              </label>
            )}
            {blad.tegel.soort === "OVERDRACHT" && (
              <div className="kasdag-veld">
                <span>Aan wie gaf je het geld?</span>
                <div className="kasdag-chips">
                  {FINANCIEEL_VASTE_MEDEWERKERS.map((naam) => (
                    <button
                      key={naam}
                      type="button"
                      className={`kasdag-chip${blad.extra === naam ? " is-actief" : ""}`}
                      onClick={() => setBlad((huidig) => (huidig ? { ...huidig, extra: naam } : huidig))}
                    >
                      {naam}
                    </button>
                  ))}
                </div>
                <input
                  className="kasdag-invoer"
                  value={blad.extra}
                  onChange={(e) => setBlad((huidig) => (huidig ? { ...huidig, extra: e.target.value } : huidig))}
                  placeholder="Of typ een naam"
                />
              </div>
            )}

            <label className="kasdag-veld">
              {blad.tegel.soort === "INKOMST"
                ? "Hoeveel ontving je?"
                : blad.tegel.soort === "MUNTENBAK"
                  ? "Hoeveel legde je in de muntenbak?"
                  : "Hoeveel was het?"}
              <span className="kasdag-bedrag-label">
                <input
                  ref={bladBedragRef}
                  className="kasdag-bedrag"
                  inputMode="decimal"
                  placeholder="0"
                  value={blad.bedrag}
                  onChange={(e) => setBlad((huidig) => (huidig ? { ...huidig, bedrag: e.target.value } : huidig))}
                />
                <span className="kasdag-valuta-tag">{concept.valuta}</span>
              </span>
            </label>

            <div className="kasdag-veld">
              <span>Foto van de bon (mag)</span>
              <div className="kasdag-foto-rij">
                <button type="button" className="kasdag-mini" onClick={() => cameraRef.current?.click()}>
                  Foto maken
                </button>
              </div>
              <input
                ref={cameraRef}
                type="file"
                accept="image/*"
                capture="environment"
                hidden
                onChange={(e) => {
                  setBlad((huidig) =>
                    huidig ? { ...huidig, fotos: voegFotosToe(e.target.files, huidig.fotos) } : huidig
                  );
                  e.target.value = "";
                }}
              />
              <BestandDropzone
                compact
                accept="image/*"
                multiple
                knopLabel="Uit album"
                titel="Sleep de foto hierheen"
                onBestanden={(files) =>
                  setBlad((huidig) => (huidig ? { ...huidig, fotos: voegFotosToe(files, huidig.fotos) } : huidig))
                }
              />
              {bladPreviews.length > 0 && (
                <div className="kasdag-previews">
                  {bladPreviews.map((foto, index) => (
                    <figure key={`${foto.naam}-${index}`}>
                      <img src={foto.url} alt="" />
                      <button
                        type="button"
                        className="kasdag-tekstknop"
                        onClick={() =>
                          setBlad((huidig) =>
                            huidig ? { ...huidig, fotos: huidig.fotos.filter((_, i) => i !== index) } : huidig
                          )
                        }
                      >
                        Weg
                      </button>
                    </figure>
                  ))}
                </div>
              )}
            </div>

            <label className="kasdag-veld">
              Extra uitleg (mag)
              <input
                className="kasdag-invoer"
                value={blad.notitie}
                onChange={(e) => setBlad((huidig) => (huidig ? { ...huidig, notitie: e.target.value } : huidig))}
                placeholder="Alleen als het nodig is"
              />
            </label>

            <div className="kasdag-blad-acties">
              <button type="button" className="kasdag-mini" onClick={() => setBlad(null)}>
                Klaar
              </button>
              <button
                type="button"
                className="kasdag-secundair"
                onClick={() => zetOpLijst(true)}
              >
                Nog een bedrag
              </button>
              <button type="button" className="kasdag-verstuur kasdag-verstuur-blad" onClick={() => zetOpLijst(false)}>
                Op de lijst
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
