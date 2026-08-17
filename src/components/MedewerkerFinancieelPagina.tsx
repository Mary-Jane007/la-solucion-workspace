import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  createFinancieelInzending,
  fetchFinancieelInzendingen,
  FinancieelBetalingswijze,
  FinancieelInzending,
  FinancieelType,
  FinancieelValuta
} from "../api";
import { APP_VERNIEUW_EVENT, FINANCIEEL_INZENDING_EVENT } from "../appPages";
import {
  INKOMST_DIENSTEN,
  UITGAVE_CATEGORIEEN
} from "../financieelDashboardUtils";
import {
  BETALINGSWIJZE_LABELS,
  dateTimeLocalNaarIso,
  FINANCIEEL_VALUTAS,
  formatDatumTijd,
  formatGeld,
  nuDateTimeLocal,
  SURINAAME_BANKEN,
  typeLabel,
  VALUTA_LABELS
} from "../financieelUtils";
import { Gebruiker } from "../types";

interface Props {
  gebruiker: Gebruiker;
}

const STATUS_LABEL: Record<FinancieelInzending["status"], string> = {
  NIEUW: "Verzonden — eigenaar nog niet gezien",
  GEZIEN: "Gezien door eigenaar",
  VERWERKT: "Verwerkt in de administratie"
};

export function MedewerkerFinancieelPagina({ gebruiker }: Props) {
  const [datum, setDatum] = useState(nuDateTimeLocal);
  const [type, setType] = useState<FinancieelType>("KASGELD");
  const [bedrag, setBedrag] = useState("");
  const [valuta, setValuta] = useState<FinancieelValuta>("EUR");
  const [omschrijving, setOmschrijving] = useState("");
  const [categorie, setCategorie] = useState("");
  const [klantNaam, setKlantNaam] = useState("");
  const [referentie, setReferentie] = useState("");
  const [betalingswijze, setBetalingswijze] = useState<"" | FinancieelBetalingswijze>("");
  const [bank, setBank] = useState("");
  const [geldBijNaam, setGeldBijNaam] = useState(gebruiker.naam);
  const [geldVanNaam, setGeldVanNaam] = useState("");
  const [waaraan, setWaaraan] = useState("");
  const [notities, setNotities] = useState("");
  const [inzendingen, setInzendingen] = useState<FinancieelInzending[]>([]);
  const [bezig, setBezig] = useState(false);
  const [laden, setLaden] = useState(true);
  const [fout, setFout] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);

  const categorieOpties = type === "UITGAVE" ? UITGAVE_CATEGORIEEN : INKOMST_DIENSTEN;
  const toontBank = betalingswijze === "OVERGEMAAKT" || betalingswijze === "GESTORT";

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

  const resetForm = () => {
    setDatum(nuDateTimeLocal());
    setType("KASGELD");
    setBedrag("");
    setOmschrijving("");
    setCategorie("");
    setKlantNaam("");
    setReferentie("");
    setBetalingswijze("");
    setBank("");
    setGeldBijNaam(gebruiker.naam);
    setGeldVanNaam("");
    setWaaraan("");
    setNotities("");
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const bedragNr = Number(String(bedrag).replace(",", "."));
    if (!Number.isFinite(bedragNr) || bedragNr < 0) {
      setFout("Vul een geldig bedrag in.");
      return;
    }
    if (!omschrijving.trim()) {
      setFout("Vul een omschrijving in.");
      return;
    }
    let datumIso: string;
    try {
      datumIso = dateTimeLocalNaarIso(datum);
    } catch {
      setFout("Vul een geldige datum en tijd in.");
      return;
    }
    try {
      setBezig(true);
      setFout(null);
      setSucces(null);
      const created = await createFinancieelInzending({
        datum: datumIso,
        type,
        omschrijving: omschrijving.trim(),
        bedrag: bedragNr,
        valuta,
        categorie: categorie.trim(),
        referentie: referentie.trim(),
        klantNaam: klantNaam.trim(),
        betalingswijze: betalingswijze || null,
        bank: toontBank ? bank.trim() : "",
        geldBijNaam: geldBijNaam.trim() || gebruiker.naam,
        geldVanNaam: geldVanNaam.trim(),
        waaraan: waaraan.trim(),
        notities: notities.trim()
      });
      setInzendingen((huidig) => [created, ...huidig]);
      resetForm();
      setSucces("Verzonden naar de eigenaar. Je krijgt hier de status te zien.");
      window.dispatchEvent(new Event(FINANCIEEL_INZENDING_EVENT));
    } catch (error) {
      setFout(error instanceof Error ? error.message : "Verzenden mislukt.");
    } finally {
      setBezig(false);
    }
  };

  const eigenInzendingen = useMemo(() => inzendingen, [inzendingen]);

  return (
    <div className="fin-dashboard">
      <section className="card page-card">
        <div className="section-header">
          <h2>Financiële info doorgeven</h2>
          <p className="muted">
            Vul de velden in en verstuur naar de eigenaar. Alleen de eigenaar ziet de volledige
            financiënpagina; jij geeft hier kas- en transactie-info door.
          </p>
        </div>
        {fout && <p className="muted page-error">{fout}</p>}
        {succes && <p className="login-success">{succes}</p>}
        <form className="form financieel-form" onSubmit={handleSubmit}>
          <div className="financieel-form-grid">
            <label className="form-label">
              Datum & tijd
              <input
                type="datetime-local"
                className="form-input"
                value={datum}
                onChange={(e) => setDatum(e.target.value)}
                required
              />
            </label>
            <label className="form-label">
              Type
              <select
                className="form-input"
                value={type}
                onChange={(e) => setType(e.target.value as FinancieelType)}
              >
                <option value="KASGELD">Kasgeld (al in kas)</option>
                <option value="INKOMST">Inkomst</option>
                <option value="UITGAVE">Uitgave</option>
                <option value="OVERDRACHT">Overdracht naar medewerker</option>
              </select>
            </label>
            <label className="form-label">
              Bedrag
              <input
                className="form-input"
                inputMode="decimal"
                placeholder="0,00"
                value={bedrag}
                onChange={(e) => setBedrag(e.target.value)}
                required
              />
            </label>
            <label className="form-label">
              Valuta
              <select
                className="form-input"
                value={valuta}
                onChange={(e) => setValuta(e.target.value as FinancieelValuta)}
              >
                {FINANCIEEL_VALUTAS.map((code) => (
                  <option key={code} value={code}>
                    {VALUTA_LABELS[code]}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-label financieel-span-2">
              Omschrijving
              <input
                className="form-input"
                value={omschrijving}
                onChange={(e) => setOmschrijving(e.target.value)}
                required
                placeholder="Wat is er gebeurd met het geld?"
              />
            </label>
            <label className="form-label">
              Categorie
              <input
                className="form-input"
                list="medewerker-fin-categorie"
                value={categorie}
                onChange={(e) => setCategorie(e.target.value)}
                placeholder={type === "UITGAVE" ? "Taxi, kantoor..." : "Visa, advies..."}
              />
              <datalist id="medewerker-fin-categorie">
                {categorieOpties.map((item) => (
                  <option key={item} value={item} />
                ))}
              </datalist>
            </label>
            <label className="form-label">
              Klant (optioneel)
              <input
                className="form-input"
                value={klantNaam}
                onChange={(e) => setKlantNaam(e.target.value)}
              />
            </label>
            <label className="form-label">
              Referentie
              <input
                className="form-input"
                value={referentie}
                onChange={(e) => setReferentie(e.target.value)}
                placeholder="Bon, factuurnr..."
              />
            </label>
            <label className="form-label">
              Betalingswijze
              <select
                className="form-input"
                value={betalingswijze}
                onChange={(e) => {
                  const wijze = e.target.value as "" | FinancieelBetalingswijze;
                  setBetalingswijze(wijze);
                  if (wijze !== "OVERGEMAAKT" && wijze !== "GESTORT") setBank("");
                }}
              >
                <option value="">— Niet gekozen —</option>
                {(Object.keys(BETALINGSWIJZE_LABELS) as FinancieelBetalingswijze[]).map((wijze) => (
                  <option key={wijze} value={wijze}>
                    {BETALINGSWIJZE_LABELS[wijze]}
                  </option>
                ))}
              </select>
            </label>
            {toontBank && (
              <label className="form-label">
                Bank
                <select className="form-input" value={bank} onChange={(e) => setBank(e.target.value)}>
                  <option value="">— Kies bank —</option>
                  {SURINAAME_BANKEN.map((naam) => (
                    <option key={naam} value={naam}>
                      {naam}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="form-label">
              Bij wie is het geld nu?
              <input
                className="form-input"
                value={geldBijNaam}
                onChange={(e) => setGeldBijNaam(e.target.value)}
              />
            </label>
            {(type === "OVERDRACHT" || type === "UITGAVE") && (
              <label className="form-label">
                Van wie kwam het geld?
                <input
                  className="form-input"
                  value={geldVanNaam}
                  onChange={(e) => setGeldVanNaam(e.target.value)}
                />
              </label>
            )}
            <label className="form-label financieel-span-2">
              Waaraan besteed? (indien van toepassing)
              <input
                className="form-input"
                list="medewerker-fin-waaraan"
                value={waaraan}
                onChange={(e) => setWaaraan(e.target.value)}
                placeholder="Bankstorting, overdracht, taxi..."
              />
              <datalist id="medewerker-fin-waaraan">
                <option value="Bankstorting" />
                <option value="Overdracht medewerker" />
                {UITGAVE_CATEGORIEEN.map((item) => (
                  <option key={item} value={item} />
                ))}
              </datalist>
            </label>
            <label className="form-label financieel-span-2">
              Notities
              <textarea
                className="form-input"
                rows={2}
                value={notities}
                onChange={(e) => setNotities(e.target.value)}
              />
            </label>
          </div>
          <div className="financieel-form-actions">
            <button type="submit" className="btn-primary" disabled={bezig}>
              {bezig ? "Verzenden..." : "Verzenden naar eigenaar"}
            </button>
          </div>
        </form>
      </section>

      <section className="card page-card">
        <div className="section-header">
          <h2>Jouw verzonden info</h2>
          <p className="muted">Alleen jij en de eigenaar zien deze inzendingen.</p>
        </div>
        {laden ? (
          <p className="muted">Laden...</p>
        ) : eigenInzendingen.length === 0 ? (
          <p className="muted">Nog niets verzonden.</p>
        ) : (
          <ul className="page-list">
            {eigenInzendingen.map((item) => (
              <li key={item.id} className="page-list-item">
                <div className="page-list-main">
                  <strong>
                    {typeLabel(item.type)} · {formatGeld(item.bedrag, item.valuta)}
                  </strong>
                  <span className="melding-tag">{STATUS_LABEL[item.status]}</span>
                </div>
                <span className="muted">{item.omschrijving}</span>
                <span className="page-list-meta">
                  {formatDatumTijd(item.datum)} · verzonden {formatDatumTijd(item.createdAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
