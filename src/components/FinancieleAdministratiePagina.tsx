import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  createFinancieelPost,
  deleteFinancieelPost,
  fetchAdminUsers,
  fetchFinancieel,
  FinancieelBetalingswijze,
  FinancieelPost,
  FinancieelStatus,
  FinancieelType,
  FinancieelValuta,
  updateFinancieelPost
} from "../api";
import {
  berekenDossierSaldi,
  berekenKlantSaldi,
  berekenTotalenPerValuta,
  BETALINGSWIJZE_LABELS,
  betalingsLabel,
  dateTimeLocalNaarIso,
  DossierSaldo,
  exportDossierSaldiCsv,
  exportFinancieelPdf,
  exportFinancieelPostenCsv,
  exportKlantSaldiCsv,
  FINANCIEEL_VALUTAS,
  formatDatumTijd,
  formatGeld,
  KlantSaldo,
  klantSaldoSamenvatting,
  naarDateTimeLocal,
  normalizeValuta,
  nuDateTimeLocal,
  opdrachtDossierLabel,
  SaldoCijfers,
  SURINAAME_BANKEN,
  VALUTA_LABELS,
  typeLabel
} from "../financieelUtils";
import { groepeerPerKlant, statusLabel } from "../opdrachtenUtils";
import { Opdracht } from "../types";

type FormState = {
  datum: string;
  type: FinancieelType;
  omschrijving: string;
  bedrag: string;
  valuta: FinancieelValuta;
  wisselkoers: string;
  categorie: string;
  referentie: string;
  klantNaam: string;
  opdrachtId: string;
  betalingswijze: "" | FinancieelBetalingswijze;
  bank: string;
  afgehandeldDoorUserId: string;
  afgehandeldDoorNaam: string;
  geldBijUserId: string;
  geldBijNaam: string;
  status: FinancieelStatus;
  notities: string;
};

interface Props {
  opdrachten: Opdracht[];
}

function leegFormulier(valuta: FinancieelValuta = "EUR"): FormState {
  return {
    datum: nuDateTimeLocal(),
    type: "INKOMST",
    omschrijving: "",
    bedrag: "",
    valuta,
    wisselkoers: "",
    categorie: "",
    referentie: "",
    klantNaam: "",
    opdrachtId: "",
    betalingswijze: "",
    bank: "",
    afgehandeldDoorUserId: "",
    afgehandeldDoorNaam: "",
    geldBijUserId: "",
    geldBijNaam: "",
    status: "OPEN",
    notities: ""
  };
}

function SaldoTabel({
  rows,
  emptyText,
  labelHeader,
  getKey,
  getLabel
}: {
  rows: Array<
    SaldoCijfers & {
      valuta: FinancieelValuta;
      netto: number;
      statusLabel: string;
      statusClass: string;
    }
  >;
  emptyText: string;
  labelHeader: string;
  getKey: (row: (typeof rows)[number], index: number) => string;
  getLabel: (row: (typeof rows)[number]) => { title: string; subtitle?: string };
}) {
  if (rows.length === 0) {
    return <p className="muted">{emptyText}</p>;
  }

  return (
    <div className="owner-table-wrapper">
      <table className="owner-table">
        <thead>
          <tr>
            <th>{labelHeader}</th>
            <th>Valuta</th>
            <th>Nog te betalen (klant)</th>
            <th>Al betaald (klant)</th>
            <th>Nog te betalen (wij)</th>
            <th>Al uitbetaald</th>
            <th>Netto open</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const label = getLabel(row);
            return (
              <tr key={getKey(row, index)}>
                <td>
                  <strong>{label.title}</strong>
                  {label.subtitle && (
                    <>
                      <br />
                      <span className="muted">{label.subtitle}</span>
                    </>
                  )}
                </td>
                <td>{row.valuta}</td>
                <td className={row.teOntvangen > 0 ? "financieel-inkomst" : undefined}>
                  {formatGeld(row.teOntvangen, row.valuta)}
                </td>
                <td>{formatGeld(row.ontvangen, row.valuta)}</td>
                <td className={row.teBetalen > 0 ? "financieel-uitgave" : undefined}>
                  {formatGeld(row.teBetalen, row.valuta)}
                </td>
                <td>{formatGeld(row.uitbetaald, row.valuta)}</td>
                <td
                  className={
                    row.netto > 0
                      ? "financieel-inkomst"
                      : row.netto < 0
                        ? "financieel-uitgave"
                        : undefined
                  }
                >
                  {formatGeld(row.netto, row.valuta)}
                </td>
                <td>
                  <span className={`financieel-pill ${row.statusClass}`}>{row.statusLabel}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function FinancieleAdministratiePagina({ opdrachten }: Props) {
  const [posten, setPosten] = useState<FinancieelPost[]>([]);
  const [team, setTeam] = useState<Array<{ id: string; name: string; role: string; active: boolean }>>(
    []
  );
  const [form, setForm] = useState<FormState>(leegFormulier);
  const [bewerkId, setBewerkId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<"ALLE" | FinancieelType>("ALLE");
  const [filterValuta, setFilterValuta] = useState<"ALLE" | FinancieelValuta>("ALLE");
  const [laden, setLaden] = useState(true);
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);

  const opdrachtenById = useMemo(() => {
    const map = new Map<string, Opdracht>();
    for (const o of opdrachten) map.set(o.id, o);
    return map;
  }, [opdrachten]);

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

  const dossierOpties = useMemo(() => {
    const actief = opdrachten
      .filter((o) => !o.verwijderdOp)
      .slice()
      .sort((a, b) => {
        const naam = a.klantNaam.localeCompare(b.klantNaam, "nl");
        if (naam !== 0) return naam;
        return (b.datumAangemaakt || "").localeCompare(a.datumAangemaakt || "");
      });

    if (!form.opdrachtId) return actief;
    if (actief.some((o) => o.id === form.opdrachtId)) return actief;
    const gekoppeld = opdrachtenById.get(form.opdrachtId);
    return gekoppeld ? [gekoppeld, ...actief] : actief;
  }, [opdrachten, opdrachtenById, form.opdrachtId]);

  const gefilterdeDossiers = useMemo(() => {
    const klant = form.klantNaam.trim().toLowerCase();
    if (!klant) return dossierOpties;
    return dossierOpties.filter((o) => o.klantNaam.trim().toLowerCase() === klant);
  }, [dossierOpties, form.klantNaam]);

  const medewerkerOpties = useMemo(() => {
    const actief = team
      .filter((u) => u.active)
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, "nl"));
    if (!form.afgehandeldDoorUserId) return actief;
    if (actief.some((u) => u.id === form.afgehandeldDoorUserId)) return actief;
    const gekozen = team.find((u) => u.id === form.afgehandeldDoorUserId);
    if (gekozen) return [gekozen, ...actief];
    const naam =
      (bewerkId &&
        posten.find((p) => p.id === bewerkId)?.afgehandeldDoorNaam) ||
      "Onbekende medewerker";
    return [
      {
        id: form.afgehandeldDoorUserId,
        name: naam,
        role: "",
        active: false
      },
      ...actief
    ];
  }, [team, form.afgehandeldDoorUserId, bewerkId, posten]);

  const laad = async () => {
    try {
      setLaden(true);
      setFout(null);
      const [postenLijst, users] = await Promise.all([fetchFinancieel(), fetchAdminUsers()]);
      setPosten(postenLijst);
      setTeam(users);
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
    return posten.filter((p) => {
      if (filterType !== "ALLE" && p.type !== filterType) return false;
      if (filterValuta !== "ALLE" && normalizeValuta(p.valuta) !== filterValuta) return false;
      return true;
    });
  }, [posten, filterType, filterValuta]);

  const totalenPerValuta = useMemo(() => berekenTotalenPerValuta(posten), [posten]);

  const getoondeTotalen = useMemo(() => {
    if (filterValuta === "ALLE") return totalenPerValuta;
    return totalenPerValuta.filter((t) => t.valuta === filterValuta);
  }, [totalenPerValuta, filterValuta]);

  const klantSaldi = useMemo(() => {
    const basis = berekenKlantSaldi(posten);
    if (filterValuta === "ALLE") return basis;
    return basis.filter((s) => s.valuta === filterValuta);
  }, [posten, filterValuta]);

  const dossierSaldi = useMemo(() => {
    const basis = berekenDossierSaldi(posten, opdrachtenById);
    if (filterValuta === "ALLE") return basis;
    return basis.filter((s) => s.valuta === filterValuta);
  }, [posten, opdrachtenById, filterValuta]);

  const actueelKlantSaldo = useMemo(() => {
    const naam = form.klantNaam.trim().toLowerCase();
    if (!naam) return undefined;
    return berekenKlantSaldi(posten).find(
      (s) => s.klantNaam.trim().toLowerCase() === naam && s.valuta === form.valuta
    );
  }, [posten, form.klantNaam, form.valuta]);

  const toontMedewerker = form.betalingswijze === "OPGEHAALD" || form.betalingswijze === "";
  const toontBank = form.betalingswijze === "OVERGEMAAKT" || form.betalingswijze === "GESTORT";

  const resetForm = () => {
    setForm(leegFormulier(form.valuta));
    setBewerkId(null);
  };

  const startBewerk = (post: FinancieelPost) => {
    setBewerkId(post.id);
    setForm({
      datum: naarDateTimeLocal(post.datum),
      type: post.type,
      omschrijving: post.omschrijving,
      bedrag: String(post.bedrag),
      valuta: normalizeValuta(post.valuta),
      wisselkoers:
        post.wisselkoers === null || post.wisselkoers === undefined
          ? ""
          : String(post.wisselkoers).replace(".", ","),
      categorie: post.categorie || "",
      referentie: post.referentie || "",
      klantNaam: post.klantNaam || "",
      opdrachtId: post.opdrachtId || "",
      betalingswijze: post.betalingswijze || "",
      bank: post.bank || "",
      afgehandeldDoorUserId: post.afgehandeldDoorUserId || "",
      afgehandeldDoorNaam: post.afgehandeldDoorNaam || "",
      geldBijUserId: post.geldBijUserId || "",
      geldBijNaam: post.geldBijNaam || "",
      status: post.status,
      notities: post.notities || ""
    });
  };

  const kiesDossier = (opdrachtId: string) => {
    if (!opdrachtId) {
      setForm({ ...form, opdrachtId: "" });
      return;
    }
    const opdracht = opdrachtenById.get(opdrachtId);
    setForm({
      ...form,
      opdrachtId,
      klantNaam: opdracht?.klantNaam || form.klantNaam
    });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const bedrag = Number(String(form.bedrag).replace(",", "."));
    if (!form.omschrijving.trim() || !Number.isFinite(bedrag) || bedrag < 0) {
      setFout("Vul een omschrijving en een geldig bedrag in.");
      return;
    }

    let wisselkoers: number | null = null;
    if (form.wisselkoers.trim()) {
      wisselkoers = Number(String(form.wisselkoers).replace(",", "."));
      if (!Number.isFinite(wisselkoers) || wisselkoers < 0) {
        setFout("Vul een geldige wisselkoers in (of laat leeg).");
        return;
      }
    }

    let datumIso: string;
    try {
      datumIso = dateTimeLocalNaarIso(form.datum);
    } catch {
      setFout("Vul een geldige datum en tijd in.");
      return;
    }

    const gekozen = form.opdrachtId ? opdrachtenById.get(form.opdrachtId) : undefined;
    const medewerker = form.afgehandeldDoorUserId
      ? team.find((u) => u.id === form.afgehandeldDoorUserId)
      : undefined;
    const handmatigeNaam = form.afgehandeldDoorNaam.trim();
    const wijze = form.betalingswijze || null;
    const medewerkerNaam =
      wijze === "OPGEHAALD" || !wijze ? medewerker?.name || handmatigeNaam : "";
    const geldBijPersoon = form.geldBijUserId
      ? team.find((u) => u.id === form.geldBijUserId)
      : undefined;
    const geldBijNaam = geldBijPersoon?.name || form.geldBijNaam.trim();
    const payload = {
      datum: datumIso,
      type: form.type,
      omschrijving: form.omschrijving.trim(),
      bedrag,
      valuta: normalizeValuta(form.valuta),
      wisselkoers,
      categorie: form.categorie.trim(),
      referentie: form.referentie.trim(),
      klantNaam: (gekozen?.klantNaam || form.klantNaam).trim(),
      opdrachtId: form.opdrachtId || null,
      afgehandeldDoorUserId:
        wijze === "OPGEHAALD" || !wijze ? form.afgehandeldDoorUserId || null : null,
      afgehandeldDoorNaam: medewerkerNaam,
      betalingswijze: wijze,
      bank: toontBank ? form.bank.trim() : "",
      geldBijUserId: form.geldBijUserId || null,
      geldBijNaam,
      status: form.status,
      notities: form.notities.trim()
    };

    try {
      setBezig(true);
      setFout(null);
      if (bewerkId) {
        const updated = await updateFinancieelPost(bewerkId, payload);
        setPosten((prev) =>
          prev.map((p) =>
            p.id === updated.id
              ? { ...updated, valuta: normalizeValuta(updated.valuta || payload.valuta) }
              : p
          )
        );
      } else {
        const created = await createFinancieelPost(payload);
        setPosten((prev) => [
          { ...created, valuta: normalizeValuta(created.valuta || payload.valuta) },
          ...prev
        ]);
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

  const dossierLabelVoorPost = (p: FinancieelPost): string => {
    if (!p.opdrachtId) return "—";
    const o = opdrachtenById.get(p.opdrachtId);
    if (!o) return "Dossier verwijderd";
    const desc = (o.omschrijving || "").trim();
    const short = desc.length > 40 ? `${desc.slice(0, 37)}…` : desc || "Geen omschrijving";
    return short;
  };

  return (
    <div className="financieel-stack">
      <section className="card page-card">
        <div className="section-header section-header-row">
          <div>
            <h2>Financiële administratie</h2>
            <p className="muted">Alleen zichtbaar en bewerkbaar voor de eigenaar.</p>
          </div>
          <select
            className="form-input financieel-filter"
            value={filterValuta}
            onChange={(e) => setFilterValuta(e.target.value as "ALLE" | FinancieelValuta)}
            aria-label="Filter op valuta"
          >
            <option value="ALLE">Alle valuta’s</option>
            {FINANCIEEL_VALUTAS.map((v) => (
              <option key={v} value={v}>
                {VALUTA_LABELS[v]}
              </option>
            ))}
          </select>
        </div>

        {getoondeTotalen.length === 0 ? (
          <p className="muted">Nog geen posten om totalen te tonen.</p>
        ) : (
          getoondeTotalen.map((totalen) => (
            <div key={totalen.valuta} className="financieel-valuta-blok">
              <h3 className="financieel-valuta-titel">{VALUTA_LABELS[totalen.valuta]}</h3>
              <div className="metric-row financieel-metrics">
                <div className="metric-badge">
                  <span className="metric-label">Inkomsten</span>
                  <span className="metric-value financieel-inkomst">
                    {formatGeld(totalen.inkomsten, totalen.valuta)}
                  </span>
                </div>
                <div className="metric-badge">
                  <span className="metric-label">Kasgeld</span>
                  <span className="metric-value financieel-inkomst">
                    {formatGeld(totalen.kasgeld, totalen.valuta)}
                  </span>
                </div>
                <div className="metric-badge">
                  <span className="metric-label">Uitgaven</span>
                  <span className="metric-value financieel-uitgave">
                    {formatGeld(totalen.uitgaven, totalen.valuta)}
                  </span>
                </div>
                <div className="metric-badge">
                  <span className="metric-label">Saldo</span>
                  <span className="metric-value">{formatGeld(totalen.saldo, totalen.valuta)}</span>
                </div>
                <div className="metric-badge">
                  <span className="metric-label">Klanten moeten betalen</span>
                  <span className="metric-value financieel-inkomst">
                    {formatGeld(totalen.teOntvangen, totalen.valuta)}
                  </span>
                </div>
                <div className="metric-badge">
                  <span className="metric-label">Wij moeten betalen</span>
                  <span className="metric-value financieel-uitgave">
                    {formatGeld(totalen.teBetalen, totalen.valuta)}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </section>

      <section className="card page-card">
        <div className="section-header">
          <h2>Exporteren</h2>
          <p className="muted">
            CSV voor Excel/boekhouding, of PDF via het printvenster (“Opslaan als PDF”).
          </p>
        </div>
        <div className="financieel-export-actions">
          <button
            type="button"
            className="btn-primary"
            disabled={laden || posten.length === 0}
            onClick={() => exportFinancieelPostenCsv(posten, opdrachtenById)}
          >
            CSV posten ({posten.length})
          </button>
          <button
            type="button"
            className="btn-secondary"
            disabled={laden || klantSaldi.length === 0}
            onClick={() => exportKlantSaldiCsv(posten)}
          >
            CSV klantsaldo’s ({klantSaldi.length})
          </button>
          <button
            type="button"
            className="btn-secondary"
            disabled={laden || dossierSaldi.length === 0}
            onClick={() => exportDossierSaldiCsv(posten, opdrachtenById)}
          >
            CSV dossiersaldo’s ({dossierSaldi.length})
          </button>
          <button
            type="button"
            className="btn-secondary"
            disabled={laden || posten.length === 0}
            onClick={() => exportFinancieelPdf(posten, opdrachtenById)}
          >
            PDF / afdrukken
          </button>
        </div>
      </section>

      <section className="card page-card">
        <div className="section-header">
          <h2>Dossiersaldo’s</h2>
          <p className="muted">
            Per gekoppelde opdracht: openstaande en betaalde bedragen voor dat dossier.
          </p>
        </div>
        <SaldoTabel
          rows={dossierSaldi}
          emptyText="Nog geen posten gekoppeld aan een opdracht. Kies bij een post een dossier om saldo’s te zien."
          labelHeader="Dossier"
          getKey={(row) => `${(row as DossierSaldo).opdrachtId}-${(row as DossierSaldo).valuta}`}
          getLabel={(row) => {
            const d = row as DossierSaldo;
            return { title: d.klantNaam, subtitle: d.dossierLabel.replace(`${d.klantNaam} – `, "") };
          }}
        />
      </section>

      <section className="card page-card">
        <div className="section-header">
          <h2>Klantsaldo’s</h2>
          <p className="muted">
            Totaal per klant en valuta: wat nog openstaat en wat al betaald is.
          </p>
        </div>
        <SaldoTabel
          rows={klantSaldi}
          emptyText="Nog geen posten met een klant. Koppel bij inkomsten/uitgaven een klant of dossier."
          labelHeader="Klant"
          getKey={(row) => `${(row as KlantSaldo).klantNaam}-${(row as KlantSaldo).valuta}`}
          getLabel={(row) => ({ title: (row as KlantSaldo).klantNaam })}
        />
      </section>

      <section className="card page-card">
        <div className="section-header">
          <h2>{bewerkId ? "Post bewerken" : "Nieuwe post"}</h2>
          <p className="muted">
            Koppel een opdracht (dossier) voor saldo per dossier. De klantnaam wordt dan automatisch
            overgenomen.
          </p>
        </div>

        {fout && <p className="muted page-error">{fout}</p>}

        <form className="form financieel-form" onSubmit={handleSubmit}>
          <div className="financieel-form-grid">
            <label className="form-label">
              Datum & tijd
              <input
                type="datetime-local"
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
                onChange={(e) => {
                  const type = e.target.value as FinancieelType;
                  setForm({
                    ...form,
                    type,
                    status: type === "KASGELD" ? "BETAALD" : form.status
                  });
                }}
              >
                <option value="INKOMST">Inkomst</option>
                <option value="UITGAVE">Uitgave</option>
                <option value="KASGELD">Kasgeld (al in kas)</option>
              </select>
            </label>
            <label className="form-label">
              Bedrag
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
              Valuta
              <select
                className="form-input"
                value={form.valuta}
                onChange={(e) => setForm({ ...form, valuta: e.target.value as FinancieelValuta })}
              >
                {FINANCIEEL_VALUTAS.map((v) => (
                  <option key={v} value={v}>
                    {VALUTA_LABELS[v]}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-label">
              Wisselkoers
              <input
                className="form-input"
                inputMode="decimal"
                placeholder="bijv. 40,5"
                value={form.wisselkoers}
                onChange={(e) => setForm({ ...form, wisselkoers: e.target.value })}
              />
            </label>
            <label className="form-label">
              Status
              <select
                className="form-input"
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value as FinancieelStatus })}
                disabled={form.type === "KASGELD"}
              >
                {form.type === "KASGELD" ? (
                  <option value="BETAALD">In kas</option>
                ) : form.type === "INKOMST" ? (
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
              Dossier (opdracht)
              <select
                className="form-input"
                value={form.opdrachtId}
                onChange={(e) => kiesDossier(e.target.value)}
              >
                <option value="">— Geen dossier gekozen —</option>
                {gefilterdeDossiers.map((o) => (
                  <option key={o.id} value={o.id}>
                    {opdrachtDossierLabel(o)} ({statusLabel(o.status)})
                  </option>
                ))}
              </select>
            </label>
            <label className="form-label">
              Betalingswijze
              <select
                className="form-input"
                value={form.betalingswijze}
                onChange={(e) => {
                  const betalingswijze = e.target.value as "" | FinancieelBetalingswijze;
                  setForm({
                    ...form,
                    betalingswijze,
                    bank:
                      betalingswijze === "OVERGEMAAKT" || betalingswijze === "GESTORT"
                        ? form.bank
                        : "",
                    afgehandeldDoorUserId:
                      betalingswijze === "OPGEHAALD" || betalingswijze === ""
                        ? form.afgehandeldDoorUserId
                        : "",
                    afgehandeldDoorNaam:
                      betalingswijze === "OPGEHAALD" || betalingswijze === ""
                        ? form.afgehandeldDoorNaam
                        : ""
                  });
                }}
              >
                <option value="">— Niet gekozen —</option>
                {(Object.keys(BETALINGSWIJZE_LABELS) as FinancieelBetalingswijze[]).map((k) => (
                  <option key={k} value={k}>
                    {BETALINGSWIJZE_LABELS[k]}
                  </option>
                ))}
              </select>
            </label>
            {toontBank ? (
              <label className="form-label">
                Bank (Suriname)
                <select
                  className="form-input"
                  value={form.bank}
                  onChange={(e) => setForm({ ...form, bank: e.target.value })}
                >
                  <option value="">— Kies bank —</option>
                  {SURINAAME_BANKEN.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <label className="form-label">
                Medewerker
                <select
                  className="form-input"
                  value={form.afgehandeldDoorUserId}
                  onChange={(e) => {
                    const id = e.target.value;
                    const u = medewerkerOpties.find((m) => m.id === id);
                    setForm({
                      ...form,
                      afgehandeldDoorUserId: id,
                      afgehandeldDoorNaam: u?.name || "",
                      betalingswijze: form.betalingswijze || "OPGEHAALD"
                    });
                  }}
                >
                  <option value="">— Geen medewerker —</option>
                  {medewerkerOpties.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                      {!u.active ? " (inactief)" : ""}
                      {u.role === "EIGENAAR" ? " · eigenaar" : ""}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {toontMedewerker && (
              <label className="form-label financieel-span-2">
                Of typ medewerkernaam
                <input
                  className="form-input"
                  list="financieel-afgehandeld-door"
                  placeholder="Voor- en achternaam"
                  value={form.afgehandeldDoorNaam}
                  onChange={(e) => {
                    const naam = e.target.value;
                    const match = team.find(
                      (u) => u.name.trim().toLowerCase() === naam.trim().toLowerCase()
                    );
                    setForm({
                      ...form,
                      afgehandeldDoorNaam: naam,
                      afgehandeldDoorUserId: match?.id || "",
                      betalingswijze: form.betalingswijze || (naam ? "OPGEHAALD" : "")
                    });
                  }}
                />
                <datalist id="financieel-afgehandeld-door">
                  {medewerkerOpties.map((u) => (
                    <option key={u.id} value={u.name} />
                  ))}
                </datalist>
              </label>
            )}
            <label className="form-label">
              Bij wie is het geld?
              <select
                className="form-input"
                value={form.geldBijUserId}
                onChange={(e) => {
                  const id = e.target.value;
                  const u = medewerkerOpties.find((m) => m.id === id);
                  setForm({
                    ...form,
                    geldBijUserId: id,
                    geldBijNaam: u?.name || ""
                  });
                }}
              >
                <option value="">— Niet gekozen —</option>
                {medewerkerOpties.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                    {!u.active ? " (inactief)" : ""}
                    {u.role === "EIGENAAR" ? " · eigenaar" : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-label">
              Of typ een naam
              <input
                className="form-input"
                list="financieel-geld-bij"
                placeholder="Naam van de persoon"
                value={form.geldBijNaam}
                onChange={(e) => {
                  const naam = e.target.value;
                  const match = team.find(
                    (u) => u.name.trim().toLowerCase() === naam.trim().toLowerCase()
                  );
                  setForm({
                    ...form,
                    geldBijNaam: naam,
                    geldBijUserId: match?.id || ""
                  });
                }}
              />
              <datalist id="financieel-geld-bij">
                {medewerkerOpties.map((u) => (
                  <option key={u.id} value={u.name} />
                ))}
              </datalist>
            </label>
            <label className="form-label financieel-span-2">
              {form.type === "KASGELD"
                ? "Klant (optioneel)"
                : form.type === "INKOMST"
                  ? "Klant (betaler / nog te betalen)"
                  : "Klant (ontvanger / nog uit te betalen)"}
              <select
                className="form-input"
                value={form.klantNaam}
                onChange={(e) => {
                  const klantNaam = e.target.value;
                  const opdrachtPast =
                    !form.opdrachtId ||
                    opdrachtenById.get(form.opdrachtId)?.klantNaam.trim() === klantNaam.trim();
                  setForm({
                    ...form,
                    klantNaam,
                    opdrachtId: opdrachtPast ? form.opdrachtId : ""
                  });
                }}
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
                onChange={(e) => {
                  const klantNaam = e.target.value;
                  const opdrachtPast =
                    !form.opdrachtId ||
                    opdrachtenById
                      .get(form.opdrachtId)
                      ?.klantNaam.trim()
                      .toLowerCase() === klantNaam.trim().toLowerCase();
                  setForm({
                    ...form,
                    klantNaam,
                    opdrachtId: opdrachtPast ? form.opdrachtId : ""
                  });
                }}
              />
              <datalist id="financieel-klanten">
                {klantOpties.map((naam) => (
                  <option key={naam} value={naam} />
                ))}
              </datalist>
              {form.klantNaam.trim() && (
                <p
                  className={`financieel-klant-saldo-hint${
                    actueelKlantSaldo &&
                    (actueelKlantSaldo.teOntvangen > 0 || actueelKlantSaldo.teBetalen > 0)
                      ? " heeft-saldo"
                      : ""
                  }`}
                >
                  {klantSaldoSamenvatting(actueelKlantSaldo, form.valuta)}
                </p>
              )}
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
            <option value="KASGELD">Alleen kasgeld</option>
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
                  <th>Valuta</th>
                  <th>Klant</th>
                  <th>Dossier</th>
                  <th>Betaling</th>
                  <th>Bij wie</th>
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
                    <td>{formatDatumTijd(p.datum)}</td>
                    <td>
                      <span
                        className={
                          p.type === "UITGAVE"
                            ? "financieel-pill uitgave"
                            : "financieel-pill inkomst"
                        }
                      >
                        {typeLabel(p.type)}
                      </span>
                    </td>
                    <td>
                      {normalizeValuta(p.valuta)}
                      {p.wisselkoers != null && Number.isFinite(p.wisselkoers) && (
                        <>
                          <br />
                          <span className="muted">koers {String(p.wisselkoers).replace(".", ",")}</span>
                        </>
                      )}
                    </td>
                    <td>{p.klantNaam || "—"}</td>
                    <td>{dossierLabelVoorPost(p)}</td>
                    <td>{betalingsLabel(p) || "—"}</td>
                    <td>{p.geldBijNaam || "—"}</td>
                    <td>
                      <div>{p.omschrijving}</div>
                      {p.referentie && <span className="muted">{p.referentie}</span>}
                    </td>
                    <td>{p.categorie || "—"}</td>
                    <td className={p.type === "UITGAVE" ? "financieel-uitgave" : "financieel-inkomst"}>
                      {formatGeld(p.bedrag, p.valuta)}
                    </td>
                    <td>
                      {p.type === "KASGELD"
                        ? "In kas"
                        : p.status === "BETAALD"
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
