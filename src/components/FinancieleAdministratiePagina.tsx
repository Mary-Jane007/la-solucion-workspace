import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  createFinancieelPost,
  deleteFinancieelPost,
  fetchAdminUsers,
  fetchFinancieel,
  FinancieelPost,
  FinancieelStatus,
  FinancieelType,
  updateFinancieelPost
} from "../api";
import {
  berekenDossierSaldi,
  berekenKlantSaldi,
  dateTimeLocalNaarIso,
  DossierSaldo,
  exportDossierSaldiCsv,
  exportFinancieelPdf,
  exportFinancieelPostenCsv,
  exportKlantSaldiCsv,
  formatDatumTijd,
  formatEuro,
  KlantSaldo,
  naarDateTimeLocal,
  nuDateTimeLocal,
  opdrachtDossierLabel,
  SaldoCijfers
} from "../financieelUtils";
import { groepeerPerKlant, statusLabel } from "../opdrachtenUtils";
import { Opdracht } from "../types";

type FormState = {
  datum: string;
  type: FinancieelType;
  omschrijving: string;
  bedrag: string;
  categorie: string;
  referentie: string;
  klantNaam: string;
  opdrachtId: string;
  afgehandeldDoorUserId: string;
  afgehandeldDoorNaam: string;
  status: FinancieelStatus;
  notities: string;
};

interface Props {
  opdrachten: Opdracht[];
}

function leegFormulier(): FormState {
  return {
    datum: nuDateTimeLocal(),
    type: "INKOMST",
    omschrijving: "",
    bedrag: "",
    categorie: "",
    referentie: "",
    klantNaam: "",
    opdrachtId: "",
    afgehandeldDoorUserId: "",
    afgehandeldDoorNaam: "",
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
                <td className={row.teOntvangen > 0 ? "financieel-inkomst" : undefined}>
                  {formatEuro(row.teOntvangen)}
                </td>
                <td>{formatEuro(row.ontvangen)}</td>
                <td className={row.teBetalen > 0 ? "financieel-uitgave" : undefined}>
                  {formatEuro(row.teBetalen)}
                </td>
                <td>{formatEuro(row.uitbetaald)}</td>
                <td
                  className={
                    row.netto > 0
                      ? "financieel-inkomst"
                      : row.netto < 0
                        ? "financieel-uitgave"
                        : undefined
                  }
                >
                  {formatEuro(row.netto)}
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
  const dossierSaldi = useMemo(
    () => berekenDossierSaldi(posten, opdrachtenById),
    [posten, opdrachtenById]
  );

  const resetForm = () => {
    setForm(leegFormulier());
    setBewerkId(null);
  };

  const startBewerk = (post: FinancieelPost) => {
    setBewerkId(post.id);
    setForm({
      datum: naarDateTimeLocal(post.datum),
      type: post.type,
      omschrijving: post.omschrijving,
      bedrag: String(post.bedrag),
      categorie: post.categorie || "",
      referentie: post.referentie || "",
      klantNaam: post.klantNaam || "",
      opdrachtId: post.opdrachtId || "",
      afgehandeldDoorUserId: post.afgehandeldDoorUserId || "",
      afgehandeldDoorNaam: post.afgehandeldDoorNaam || "",
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
    const payload = {
      datum: datumIso,
      type: form.type,
      omschrijving: form.omschrijving.trim(),
      bedrag,
      categorie: form.categorie.trim(),
      referentie: form.referentie.trim(),
      klantNaam: (gekozen?.klantNaam || form.klantNaam).trim(),
      opdrachtId: form.opdrachtId || null,
      afgehandeldDoorUserId: form.afgehandeldDoorUserId || null,
      afgehandeldDoorNaam: medewerker?.name || handmatigeNaam,
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
          getKey={(row) => (row as DossierSaldo).opdrachtId}
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
            Totaal per klant over alle dossiers: wat nog openstaat en wat al betaald is.
          </p>
        </div>
        <SaldoTabel
          rows={klantSaldi}
          emptyText="Nog geen posten met een klant. Koppel bij inkomsten/uitgaven een klant of dossier."
          labelHeader="Klant"
          getKey={(row) => (row as KlantSaldo).klantNaam}
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
            <label className="form-label financieel-span-2">
              Opgehaald / afgehandeld door (medewerker)
              <select
                className="form-input"
                value={form.afgehandeldDoorUserId}
                onChange={(e) => {
                  const id = e.target.value;
                  const u = medewerkerOpties.find((m) => m.id === id);
                  setForm({
                    ...form,
                    afgehandeldDoorUserId: id,
                    afgehandeldDoorNaam: u?.name || ""
                  });
                }}
              >
                <option value="">— Geen medewerker gekozen —</option>
                {medewerkerOpties.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                    {!u.active ? " (inactief)" : ""}
                    {u.role === "EIGENAAR" ? " · eigenaar" : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-label financieel-span-2">
              Of typ een naam handmatig
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
                    afgehandeldDoorUserId: match?.id || ""
                  });
                }}
              />
              <datalist id="financieel-afgehandeld-door">
                {medewerkerOpties.map((u) => (
                  <option key={u.id} value={u.name} />
                ))}
              </datalist>
            </label>
            <label className="form-label financieel-span-2">
              {form.type === "INKOMST"
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
                  <th>Dossier</th>
                  <th>Afgehandeld door</th>
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
                          p.type === "INKOMST" ? "financieel-pill inkomst" : "financieel-pill uitgave"
                        }
                      >
                        {p.type === "INKOMST" ? "Inkomst" : "Uitgave"}
                      </span>
                    </td>
                    <td>{p.klantNaam || "—"}</td>
                    <td>{dossierLabelVoorPost(p)}</td>
                    <td>{p.afgehandeldDoorNaam || "—"}</td>
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
