import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  createFinancieelPost,
  deleteFinancieelPost,
  fetchFinancieel,
  FinancieelPost,
  FinancieelStatus,
  FinancieelType,
  updateFinancieelPost
} from "../api";
import { groepeerPerKlant } from "../opdrachtenUtils";
import { Opdracht } from "../types";

type FormState = {
  datum: string;
  type: FinancieelType;
  omschrijving: string;
  bedrag: string;
  categorie: string;
  referentie: string;
  klantNaam: string;
  status: FinancieelStatus;
  notities: string;
};

interface Props {
  opdrachten: Opdracht[];
}

type KlantSaldo = {
  klantNaam: string;
  teOntvangen: number;
  ontvangen: number;
  teBetalen: number;
  uitbetaald: number;
  netto: number;
  statusLabel: string;
  statusClass: string;
};

function vandaagIso() {
  return new Date().toISOString().slice(0, 10);
}

function leegFormulier(): FormState {
  return {
    datum: vandaagIso(),
    type: "INKOMST",
    omschrijving: "",
    bedrag: "",
    categorie: "",
    referentie: "",
    klantNaam: "",
    status: "OPEN",
    notities: ""
  };
}

function formatEuro(bedrag: number): string {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR"
  }).format(bedrag);
}

function berekenKlantSaldi(posten: FinancieelPost[]): KlantSaldo[] {
  const map = new Map<
    string,
    { teOntvangen: number; ontvangen: number; teBetalen: number; uitbetaald: number }
  >();

  for (const p of posten) {
    const naam = (p.klantNaam || "").trim();
    if (!naam) continue;
    const entry = map.get(naam) || {
      teOntvangen: 0,
      ontvangen: 0,
      teBetalen: 0,
      uitbetaald: 0
    };
    if (p.type === "INKOMST") {
      if (p.status === "OPEN") entry.teOntvangen += p.bedrag;
      else entry.ontvangen += p.bedrag;
    } else if (p.status === "OPEN") {
      entry.teBetalen += p.bedrag;
    } else {
      entry.uitbetaald += p.bedrag;
    }
    map.set(naam, entry);
  }

  return [...map.entries()]
    .map(([klantNaam, s]) => {
      const netto = s.teOntvangen - s.teBetalen;
      let statusLabel = "Alles betaald";
      let statusClass = "saldo-ok";
      if (s.teOntvangen > 0 && s.teBetalen > 0) {
        statusLabel = "Open posten beide kanten";
        statusClass = "saldo-mix";
      } else if (s.teOntvangen > 0) {
        statusLabel = "Klant moet nog betalen";
        statusClass = "saldo-te-ontvangen";
      } else if (s.teBetalen > 0) {
        statusLabel = "Wij moeten nog betalen";
        statusClass = "saldo-te-betalen";
      }
      return { klantNaam, ...s, netto, statusLabel, statusClass };
    })
    .sort((a, b) => {
      const aOpen = a.teOntvangen + a.teBetalen;
      const bOpen = b.teOntvangen + b.teBetalen;
      if (aOpen !== bOpen) return bOpen - aOpen;
      return a.klantNaam.localeCompare(b.klantNaam, "nl");
    });
}

export function FinancieleAdministratiePagina({ opdrachten }: Props) {
  const [posten, setPosten] = useState<FinancieelPost[]>([]);
  const [form, setForm] = useState<FormState>(leegFormulier);
  const [bewerkId, setBewerkId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<"ALLE" | FinancieelType>("ALLE");
  const [laden, setLaden] = useState(true);
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);

  const klanten = useMemo(
    () => groepeerPerKlant(opdrachten).map((k) => k.klantNaam).filter(Boolean),
    [opdrachten]
  );

  const klantOpties = useMemo(() => {
    const set = new Set(klanten);
    if (form.klantNaam.trim()) set.add(form.klantNaam.trim());
    for (const p of posten) {
      if (p.klantNaam?.trim()) set.add(p.klantNaam.trim());
    }
    return [...set].sort((a, b) => a.localeCompare(b, "nl"));
  }, [klanten, form.klantNaam, posten]);

  const laad = async () => {
    try {
      setLaden(true);
      setFout(null);
      setPosten(await fetchFinancieel());
    } catch (e) {
      setFout(e instanceof Error ? e.message : "Kon financiële gegevens niet laden.");
    } finally {
      setLaden(false);
    }
  };

  useEffect(() => {
    void laad();
  }, []);

  const zichtbaar = useMemo(() => {
    if (filterType === "ALLE") return posten;
    return posten.filter((p) => p.type === filterType);
  }, [posten, filterType]);

  const totalen = useMemo(() => {
    const inkomsten = posten
      .filter((p) => p.type === "INKOMST")
      .reduce((sum, p) => sum + p.bedrag, 0);
    const uitgaven = posten
      .filter((p) => p.type === "UITGAVE")
      .reduce((sum, p) => sum + p.bedrag, 0);
    const teOntvangen = posten
      .filter((p) => p.type === "INKOMST" && p.status === "OPEN")
      .reduce((sum, p) => sum + p.bedrag, 0);
    const teBetalen = posten
      .filter((p) => p.type === "UITGAVE" && p.status === "OPEN")
      .reduce((sum, p) => sum + p.bedrag, 0);
    return {
      inkomsten,
      uitgaven,
      saldo: inkomsten - uitgaven,
      teOntvangen,
      teBetalen
    };
  }, [posten]);

  const klantSaldi = useMemo(() => berekenKlantSaldi(posten), [posten]);

  const resetForm = () => {
    setForm(leegFormulier());
    setBewerkId(null);
  };

  const startBewerk = (post: FinancieelPost) => {
    setBewerkId(post.id);
    setForm({
      datum: post.datum.slice(0, 10),
      type: post.type,
      omschrijving: post.omschrijving,
      bedrag: String(post.bedrag),
      categorie: post.categorie || "",
      referentie: post.referentie || "",
      klantNaam: post.klantNaam || "",
      status: post.status,
      notities: post.notities || ""
    });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const bedrag = Number(String(form.bedrag).replace(",", "."));
    if (!form.omschrijving.trim() || !Number.isFinite(bedrag) || bedrag < 0) {
      setFout("Vul een omschrijving en een geldig bedrag in.");
      return;
    }

    const payload = {
      datum: form.datum,
      type: form.type,
      omschrijving: form.omschrijving.trim(),
      bedrag,
      categorie: form.categorie.trim(),
      referentie: form.referentie.trim(),
      klantNaam: form.klantNaam.trim(),
      status: form.status,
      notities: form.notities.trim()
    };

    try {
      setBezig(true);
      setFout(null);
      if (bewerkId) {
        const updated = await updateFinancieelPost(bewerkId, payload);
        setPosten((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      } else {
        const created = await createFinancieelPost(payload);
        setPosten((prev) => [created, ...prev]);
      }
      resetForm();
    } catch (err) {
      setFout(err instanceof Error ? err.message : "Opslaan mislukt.");
    } finally {
      setBezig(false);
    }
  };

  const handleDelete = async (id: string) => {
    const ok = window.confirm("Deze financiële post permanent verwijderen?");
    if (!ok) return;
    try {
      setFout(null);
      await deleteFinancieelPost(id);
      setPosten((prev) => prev.filter((p) => p.id !== id));
      if (bewerkId === id) resetForm();
    } catch (err) {
      setFout(err instanceof Error ? err.message : "Verwijderen mislukt.");
    }
  };

  return (
    <div className="financieel-stack">
      <section className="card page-card">
        <div className="section-header">
          <h2>Financiële administratie</h2>
          <p className="muted">Alleen zichtbaar en bewerkbaar voor de eigenaar.</p>
        </div>

        <div className="metric-row financieel-metrics">
          <div className="metric-badge">
            <span className="metric-label">Inkomsten</span>
            <span className="metric-value financieel-inkomst">{formatEuro(totalen.inkomsten)}</span>
          </div>
          <div className="metric-badge">
            <span className="metric-label">Uitgaven</span>
            <span className="metric-value financieel-uitgave">{formatEuro(totalen.uitgaven)}</span>
          </div>
          <div className="metric-badge">
            <span className="metric-label">Saldo</span>
            <span className="metric-value">{formatEuro(totalen.saldo)}</span>
          </div>
          <div className="metric-badge">
            <span className="metric-label">Klanten moeten betalen</span>
            <span className="metric-value financieel-inkomst">{formatEuro(totalen.teOntvangen)}</span>
          </div>
          <div className="metric-badge">
            <span className="metric-label">Wij moeten betalen</span>
            <span className="metric-value financieel-uitgave">{formatEuro(totalen.teBetalen)}</span>
          </div>
        </div>
      </section>

      <section className="card page-card">
        <div className="section-header">
          <h2>Klantsaldo’s</h2>
          <p className="muted">
            Per klant: wat nog openstaat, wat al betaald is, en of er nog betaald moet worden.
          </p>
        </div>
        {klantSaldi.length === 0 ? (
          <p className="muted">
            Nog geen posten met een klant. Koppel bij inkomsten/uitgaven een klant om saldo’s te zien.
          </p>
        ) : (
          <div className="owner-table-wrapper">
            <table className="owner-table">
              <thead>
                <tr>
                  <th>Klant</th>
                  <th>Nog te betalen (klant)</th>
                  <th>Al betaald (klant)</th>
                  <th>Nog te betalen (wij)</th>
                  <th>Al uitbetaald</th>
                  <th>Netto open</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {klantSaldi.map((k) => (
                  <tr key={k.klantNaam}>
                    <td>
                      <strong>{k.klantNaam}</strong>
                    </td>
                    <td className={k.teOntvangen > 0 ? "financieel-inkomst" : undefined}>
                      {formatEuro(k.teOntvangen)}
                    </td>
                    <td>{formatEuro(k.ontvangen)}</td>
                    <td className={k.teBetalen > 0 ? "financieel-uitgave" : undefined}>
                      {formatEuro(k.teBetalen)}
                    </td>
                    <td>{formatEuro(k.uitbetaald)}</td>
                    <td
                      className={
                        k.netto > 0
                          ? "financieel-inkomst"
                          : k.netto < 0
                            ? "financieel-uitgave"
                            : undefined
                      }
                    >
                      {formatEuro(k.netto)}
                    </td>
                    <td>
                      <span className={`financieel-pill ${k.statusClass}`}>{k.statusLabel}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card page-card">
        <div className="section-header">
          <h2>{bewerkId ? "Post bewerken" : "Nieuwe post"}</h2>
          <p className="muted">
            Gebruik status “Nog te betalen…” voor openstaande bedragen, en koppel altijd een klant
            voor saldo’s.
          </p>
        </div>

        {fout && <p className="muted page-error">{fout}</p>}

        <form className="form financieel-form" onSubmit={handleSubmit}>
          <div className="financieel-form-grid">
            <label className="form-label">
              Datum
              <input
                type="date"
                className="form-input"
                value={form.datum}
                onChange={(e) => setForm({ ...form, datum: e.target.value })}
                required
              />
            </label>
            <label className="form-label">
              Type
              <select
                className="form-input"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as FinancieelType })}
              >
                <option value="INKOMST">Inkomst</option>
                <option value="UITGAVE">Uitgave</option>
              </select>
            </label>
            <label className="form-label">
              Bedrag (€)
              <input
                className="form-input"
                inputMode="decimal"
                placeholder="0,00"
                value={form.bedrag}
                onChange={(e) => setForm({ ...form, bedrag: e.target.value })}
                required
              />
            </label>
            <label className="form-label">
              Status
              <select
                className="form-input"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as FinancieelStatus })}
              >
                {form.type === "INKOMST" ? (
                  <>
                    <option value="OPEN">Nog te betalen door klant</option>
                    <option value="BETAALD">Betaald door klant</option>
                  </>
                ) : (
                  <>
                    <option value="OPEN">Nog te betalen door ons</option>
                    <option value="BETAALD">Uitbetaald</option>
                  </>
                )}
              </select>
            </label>
            <label className="form-label financieel-span-2">
              {form.type === "INKOMST"
                ? "Klant (betaler / nog te betalen)"
                : "Klant (ontvanger / nog uit te betalen)"}
              <select
                className="form-input"
                value={form.klantNaam}
                onChange={(e) => setForm({ ...form, klantNaam: e.target.value })}
              >
                <option value="">— Geen klant gekozen —</option>
                {klantOpties.map((naam) => (
                  <option key={naam} value={naam}>
                    {naam}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-label financieel-span-2">
              Of typ een nieuwe klantnaam
              <input
                className="form-input"
                list="financieel-klanten"
                placeholder="Bijv. achternaam of bedrijf"
                value={form.klantNaam}
                onChange={(e) => setForm({ ...form, klantNaam: e.target.value })}
              />
              <datalist id="financieel-klanten">
                {klantOpties.map((naam) => (
                  <option key={naam} value={naam} />
                ))}
              </datalist>
            </label>
            <label className="form-label financieel-span-2">
              Omschrijving
              <input
                className="form-input"
                value={form.omschrijving}
                onChange={(e) => setForm({ ...form, omschrijving: e.target.value })}
                required
              />
            </label>
            <label className="form-label">
              Categorie
              <input
                className="form-input"
                placeholder="Honorarium, kantoor, reiskosten..."
                value={form.categorie}
                onChange={(e) => setForm({ ...form, categorie: e.target.value })}
              />
            </label>
            <label className="form-label">
              Referentie
              <input
                className="form-input"
                placeholder="Factuurnummer"
                value={form.referentie}
                onChange={(e) => setForm({ ...form, referentie: e.target.value })}
              />
            </label>
            <label className="form-label financieel-span-2">
              Notities
              <textarea
                className="form-input"
                rows={2}
                value={form.notities}
                onChange={(e) => setForm({ ...form, notities: e.target.value })}
              />
            </label>
          </div>
          <div className="financieel-form-actions">
            {bewerkId && (
              <button type="button" className="btn-ghost" onClick={resetForm} disabled={bezig}>
                Annuleren
              </button>
            )}
            <button type="submit" className="btn-primary" disabled={bezig}>
              {bezig ? "Bezig..." : bewerkId ? "Wijzigingen opslaan" : "Post toevoegen"}
            </button>
          </div>
        </form>
      </section>

      <section className="card page-card">
        <div className="section-header section-header-row">
          <div>
            <h2>Overzicht</h2>
            <p className="muted">{zichtbaar.length} post(en).</p>
          </div>
          <select
            className="form-input financieel-filter"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as "ALLE" | FinancieelType)}
          >
            <option value="ALLE">Alles</option>
            <option value="INKOMST">Alleen inkomsten</option>
            <option value="UITGAVE">Alleen uitgaven</option>
          </select>
        </div>

        {laden ? (
          <p className="muted">Financiële posten laden...</p>
        ) : zichtbaar.length === 0 ? (
          <p className="muted">Nog geen financiële posten.</p>
        ) : (
          <div className="owner-table-wrapper">
            <table className="owner-table">
              <thead>
                <tr>
                  <th>Datum</th>
                  <th>Type</th>
                  <th>Klant</th>
                  <th>Omschrijving</th>
                  <th>Categorie</th>
                  <th>Bedrag</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {zichtbaar.map((p) => (
                  <tr key={p.id}>
                    <td>{new Date(p.datum).toLocaleDateString("nl-NL")}</td>
                    <td>
                      <span
                        className={
                          p.type === "INKOMST" ? "financieel-pill inkomst" : "financieel-pill uitgave"
                        }
                      >
                        {p.type === "INKOMST" ? "Inkomst" : "Uitgave"}
                      </span>
                    </td>
                    <td>{p.klantNaam || "—"}</td>
                    <td>
                      <div>{p.omschrijving}</div>
                      {p.referentie && <span className="muted">{p.referentie}</span>}
                    </td>
                    <td>{p.categorie || "—"}</td>
                    <td className={p.type === "INKOMST" ? "financieel-inkomst" : "financieel-uitgave"}>
                      {formatEuro(p.bedrag)}
                    </td>
                    <td>
                      {p.status === "BETAALD"
                        ? p.type === "INKOMST"
                          ? "Betaald door klant"
                          : "Uitbetaald"
                        : p.type === "INKOMST"
                          ? "Klant moet nog betalen"
                          : "Wij moeten nog betalen"}
                    </td>
                    <td className="financieel-row-actions">
                      <button type="button" className="btn-secondary" onClick={() => startBewerk(p)}>
                        Bewerken
                      </button>
                      <button
                        type="button"
                        className="btn-secondary btn-danger"
                        onClick={() => void handleDelete(p.id)}
                      >
                        Verwijderen
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
