import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  createFinancieelPost,
  deleteFinancieelPost,
  fetchAdminUsers,
  fetchFinancieel,
  FinancieelBetalingswijze,
  FinancieelGebruikSoort,
  FinancieelPost,
  FinancieelStatus,
  FinancieelType,
  FinancieelValuta,
  updateFinancieelPost
} from "../api";
import {
  berekenDossierSaldi,
  berekenGeldBijTotalen,
  berekenKlantSaldi,
  BETALINGSWIJZE_LABELS,
  dateTimeLocalNaarIso,
  DossierSaldo,
  exportDossierSaldiCsv,
  exportFinancieelPdf,
  exportFinancieelPostenCsv,
  exportKlantSaldiCsv,
  FINANCIEEL_VALUTAS,
  financieelPostMatchtZoekterm,
  formatGeld,
  GEBRUIK_BANKSTORTING,
  GEBRUIK_OVERDRACHT_MEDEWERKER,
  isBankstorting,
  isOverdrachtMedewerker,
  bankUitWaaraan,
  medewerkerUitWaaraan,
  KlantSaldo,
  klantSaldoSamenvatting,
  naarDateTimeLocal,
  normalizeValuta,
  nieuweGebruikId,
  nuDateTimeLocal,
  opdrachtDossierLabel,
  restantBedrag,
  SaldoCijfers,
  SURINAAME_BANKEN,
  VALUTA_LABELS
} from "../financieelUtils";
import {
  berekenAging,
  berekenCashflow,
  berekenDagVerslag,
  berekenDashboardKpis,
  berekenFacturen,
  berekenFinancieleGezondheid,
  berekenFinancieleKalender,
  berekenFollowTheMoney,
  berekenOpenstaandeBetalingen,
  berekenPerCategorie,
  berekenPeriode,
  berekenSignaleringen,
  berekenTijdreeks,
  berekenWinstVerlies,
  bewaarAfsluiting,
  filterOpValuta,
  filterPostenInPeriode,
  FINANCIEEL_TABS,
  FinancieelTabId,
  INKOMST_DIENSTEN,
  laadAfsluitingen,
  lokaleDatumIso,
  maakDagAfsluiting,
  maakMaandAfsluiting,
  PERIODE_OPTIES,
  PeriodeSleutel,
  standaardValutaLaden,
  standaardValutaOpslaan,
  UITGAVE_CATEGORIEEN,
  vorigePeriode
} from "../financieelDashboardUtils";
import { groepeerPerKlant, statusLabel } from "../opdrachtenUtils";
import { APP_VERNIEUW_EVENT } from "../appPages";
import { Opdracht } from "../types";
import {
  AnalysesPanel,
  CashflowPanel,
  FacturenPanel,
  FollowTheMoneyPanel,
  InkomstenStats,
  InstellingenPanel,
  KlantbetalingenPanel,
  KostenPanel,
  OpenstaandPanel,
  OverzichtPanel,
  PostenTabel,
  RapportagesPanel,
  VandaagPanel,
  WinstVerliesPanel
} from "./financieel/FinancieelDashboardPanels";

type GebruikFormRij = {
  id: string;
  datum: string;
  soort: FinancieelGebruikSoort;
  bedrag: string;
  waaraan: string;
  bank: string;
  medewerker: string;
  toelichting: string;
};

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
  geldVanUserId: string;
  geldVanNaam: string;
  status: FinancieelStatus;
  notities: string;
  gebruikingen: GebruikFormRij[];
};

interface Props {
  opdrachten: Opdracht[];
}

function extraZoekvelden(p: FinancieelPost, opdrachtenById: Map<string, Opdracht>): string[] {
  if (!p.opdrachtId) return [];
  const opdracht = opdrachtenById.get(p.opdrachtId);
  if (!opdracht) return ["Dossier verwijderd"];
  return [opdrachtDossierLabel(opdracht), opdracht.klantNaam, opdracht.omschrijving || ""];
}

function legeGebruikRij(): GebruikFormRij {
  return {
    id: nieuweGebruikId(),
    datum: nuDateTimeLocal(),
    soort: "AF",
    bedrag: "",
    waaraan: "",
    bank: "",
    medewerker: "",
    toelichting: ""
  };
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
    geldVanUserId: "",
    geldVanNaam: "",
    status: "OPEN",
    notities: "",
    gebruikingen: []
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
  if (rows.length === 0) return <p className="muted">{emptyText}</p>;
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
                <td className={row.netto > 0 ? "financieel-inkomst" : row.netto < 0 ? "financieel-uitgave" : undefined}>
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
  const initValuta = standaardValutaLaden();
  const [posten, setPosten] = useState<FinancieelPost[]>([]);
  const [team, setTeam] = useState<Array<{ id: string; name: string; role: string; active: boolean }>>([]);
  const [form, setForm] = useState<FormState>(() => leegFormulier(initValuta));
  const [bewerkId, setBewerkId] = useState<string | null>(null);
  const [tab, setTab] = useState<FinancieelTabId>("overzicht");
  const [periode, setPeriode] = useState<PeriodeSleutel>("maand");
  const [customVan, setCustomVan] = useState("");
  const [customTot, setCustomTot] = useState("");
  const [afsluitingen, setAfsluitingen] = useState(laadAfsluitingen);
  const [filterType, setFilterType] = useState<"ALLE" | FinancieelType>("ALLE");
  const [filterValuta, setFilterValuta] = useState<FinancieelValuta>(initValuta);
  const [dashboardValuta, setDashboardValuta] = useState<FinancieelValuta>(initValuta);
  const [zoekterm, setZoekterm] = useState("");
  const [laden, setLaden] = useState(true);
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);
  const [followDag, setFollowDag] = useState(() => lokaleDatumIso(new Date()));
  const formulierRef = useRef<HTMLElement>(null);

  const opdrachtenById = useMemo(() => new Map(opdrachten.map((o) => [o.id, o])), [opdrachten]);
  const klanten = useMemo(
    () => groepeerPerKlant(opdrachten).map((k) => k.klantNaam).filter(Boolean),
    [opdrachten]
  );
  const klantOpties = useMemo(() => {
    const opties = new Set(klanten);
    if (form.klantNaam.trim()) opties.add(form.klantNaam.trim());
    posten.forEach((p) => p.klantNaam?.trim() && opties.add(p.klantNaam.trim()));
    return [...opties].sort((a, b) => a.localeCompare(b, "nl"));
  }, [klanten, form.klantNaam, posten]);
  const dossierOpties = useMemo(() => {
    const actief = opdrachten
      .filter((o) => !o.verwijderdOp)
      .slice()
      .sort((a, b) => a.klantNaam.localeCompare(b.klantNaam, "nl") || (b.datumAangemaakt || "").localeCompare(a.datumAangemaakt || ""));
    if (!form.opdrachtId || actief.some((o) => o.id === form.opdrachtId)) return actief;
    const gekoppeld = opdrachtenById.get(form.opdrachtId);
    return gekoppeld ? [gekoppeld, ...actief] : actief;
  }, [opdrachten, opdrachtenById, form.opdrachtId]);
  const gefilterdeDossiers = useMemo(() => {
    const klant = form.klantNaam.trim().toLowerCase();
    return klant ? dossierOpties.filter((o) => o.klantNaam.trim().toLowerCase() === klant) : dossierOpties;
  }, [dossierOpties, form.klantNaam]);
  const medewerkerOpties = useMemo(() => {
    const actief = team.filter((u) => u.active).slice().sort((a, b) => a.name.localeCompare(b.name, "nl"));
    if (!form.afgehandeldDoorUserId || actief.some((u) => u.id === form.afgehandeldDoorUserId)) return actief;
    const gekozen = team.find((u) => u.id === form.afgehandeldDoorUserId);
    if (gekozen) return [gekozen, ...actief];
    const naam = (bewerkId && posten.find((p) => p.id === bewerkId)?.afgehandeldDoorNaam) || "Onbekende medewerker";
    return [{ id: form.afgehandeldDoorUserId, name: naam, role: "", active: false }, ...actief];
  }, [team, form.afgehandeldDoorUserId, bewerkId, posten]);

  const laad = async () => {
    try {
      setLaden(true);
      setFout(null);
      const [postenLijst, users] = await Promise.all([fetchFinancieel(), fetchAdminUsers()]);
      setPosten(postenLijst);
      setTeam(users);
    } catch (error) {
      setFout(error instanceof Error ? error.message : "Kon financiële gegevens niet laden.");
    } finally {
      setLaden(false);
    }
  };

  useEffect(() => {
    void laad();
  }, []);
  useEffect(() => {
    const onVernieuw = () => {
      void laad();
    };
    window.addEventListener(APP_VERNIEUW_EVENT, onVernieuw);
    return () => window.removeEventListener(APP_VERNIEUW_EVENT, onVernieuw);
  }, []);
  useEffect(() => {
    setDashboardValuta(filterValuta);
  }, [filterValuta]);

  const zoekQuery = zoekterm.trim();
  const gezochtePosten = useMemo(
    () =>
      posten.filter((p) =>
        financieelPostMatchtZoekterm(p, zoekQuery, extraZoekvelden(p, opdrachtenById))
      ),
    [posten, zoekQuery, opdrachtenById]
  );
  const zichtbaar = useMemo(
    () =>
      filterOpValuta(gezochtePosten, filterValuta).filter(
        (p) => filterType === "ALLE" || p.type === filterType
      ),
    [gezochtePosten, filterValuta, filterType]
  );
  const inkomstenPosten = useMemo(
    () =>
      filterOpValuta(gezochtePosten, filterValuta).filter(
        (p) => p.type === "INKOMST" || p.type === "KASGELD"
      ),
    [gezochtePosten, filterValuta]
  );
  const uitgavenPosten = useMemo(
    () => filterOpValuta(gezochtePosten, filterValuta).filter((p) => p.type === "UITGAVE"),
    [gezochtePosten, filterValuta]
  );
  const bereik = useMemo(
    () => berekenPeriode(periode, new Date(), { van: customVan, tot: customTot }),
    [periode, customVan, customTot]
  );
  const vorige = useMemo(() => vorigePeriode(bereik), [bereik]);
  const periodePostenAllValuta = useMemo(
    () => filterPostenInPeriode(gezochtePosten, bereik),
    [gezochtePosten, bereik]
  );
  const periodePosten = useMemo(
    () => filterOpValuta(periodePostenAllValuta, dashboardValuta),
    [periodePostenAllValuta, dashboardValuta]
  );
  const vorigePosten = useMemo(
    () => filterOpValuta(filterPostenInPeriode(gezochtePosten, vorige), dashboardValuta),
    [gezochtePosten, vorige, dashboardValuta]
  );
  const dagenInPeriode = Math.max(1, Math.ceil((bereik.tot.getTime() - bereik.van.getTime()) / 86400000));
  const kpis = useMemo(
    () =>
      berekenDashboardKpis(
        periodePosten,
        vorigePosten,
        dashboardValuta,
        dagenInPeriode,
        filterOpValuta(posten, dashboardValuta)
      ),
    [periodePosten, vorigePosten, dashboardValuta, dagenInPeriode, posten]
  );
  const vorigeKpis = useMemo(
    () => berekenDashboardKpis(vorigePosten, [], dashboardValuta, dagenInPeriode),
    [vorigePosten, dashboardValuta, dagenInPeriode]
  );
  const dagVerslag = useMemo(
    () => berekenDagVerslag(gezochtePosten, new Date(), dashboardValuta),
    [gezochtePosten, dashboardValuta]
  );
  const followMoney = useMemo(
    () => berekenFollowTheMoney(posten, followDag, dashboardValuta),
    [posten, followDag, dashboardValuta]
  );
  const openstaand = useMemo(() => berekenOpenstaandeBetalingen(gezochtePosten), [gezochtePosten]);
  const facturen = useMemo(() => berekenFacturen(gezochtePosten), [gezochtePosten]);
  const wv = useMemo(() => berekenWinstVerlies(periodePosten, dashboardValuta), [periodePosten, dashboardValuta]);
  const cashflow = useMemo(
    () => berekenCashflow(periodePosten, gezochtePosten, bereik, dashboardValuta),
    [periodePosten, gezochtePosten, bereik, dashboardValuta]
  );
  const tijdreeks = useMemo(
    () => berekenTijdreeks(periodePosten, dashboardValuta, periode === "jaar" ? "maand" : "dag"),
    [periodePosten, dashboardValuta, periode]
  );
  const kosten = useMemo(() => berekenPerCategorie(periodePosten, "UITGAVE", dashboardValuta), [periodePosten, dashboardValuta]);
  const diensten = useMemo(() => berekenPerCategorie(periodePosten, "INKOMST", dashboardValuta), [periodePosten, dashboardValuta]);
  const aging = useMemo(() => berekenAging(openstaand, dashboardValuta), [openstaand, dashboardValuta]);
  const gezondheid = useMemo(
    () =>
      berekenFinancieleGezondheid(
        wv,
        cashflow,
        kpis.teOntvangen,
        vorigeKpis.teOntvangen,
        kpis.kaarten.find((kaart) => kaart.id === "inkomsten")?.deltaPct ?? null,
        kpis.kaarten.find((kaart) => kaart.id === "uitgaven")?.deltaPct ?? null
      ),
    [wv, cashflow, kpis, vorigeKpis]
  );
  const signaleringen = useMemo(
    () => berekenSignaleringen(gezochtePosten, periodePosten, dashboardValuta),
    [gezochtePosten, periodePosten, dashboardValuta]
  );
  const kalender = useMemo(
    () => berekenFinancieleKalender(gezochtePosten, dashboardValuta, bereik.van),
    [gezochtePosten, dashboardValuta, bereik]
  );
  const geldBijTotalen = useMemo(() => berekenGeldBijTotalen(gezochtePosten), [gezochtePosten]);
  const klantSaldi = useMemo(() => berekenKlantSaldi(gezochtePosten), [gezochtePosten]);
  const dossierSaldi = useMemo(
    () => berekenDossierSaldi(gezochtePosten, opdrachtenById),
    [gezochtePosten, opdrachtenById]
  );
  const actueelKlantSaldo = useMemo(() => {
    const naam = form.klantNaam.trim().toLowerCase();
    if (!naam) return undefined;
    return berekenKlantSaldi(posten).find(
      (saldo) => saldo.klantNaam.trim().toLowerCase() === naam && saldo.valuta === form.valuta
    );
  }, [posten, form.klantNaam, form.valuta]);

  const toontMedewerker = form.betalingswijze === "OPGEHAALD" || form.betalingswijze === "";
  const toontBank = form.betalingswijze === "OVERGEMAAKT" || form.betalingswijze === "GESTORT";
  const resetForm = () => {
    setForm(leegFormulier(form.valuta));
    setBewerkId(null);
  };
  const startBewerk = (post: FinancieelPost) => {
    setTab("dagboek");
    setBewerkId(post.id);
    setForm({
      datum: naarDateTimeLocal(post.datum),
      type: post.type,
      omschrijving: post.omschrijving,
      bedrag: String(post.bedrag),
      valuta: normalizeValuta(post.valuta),
      wisselkoers: post.wisselkoers == null ? "" : String(post.wisselkoers).replace(".", ","),
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
      geldVanUserId: post.geldVanUserId || "",
      geldVanNaam: post.geldVanNaam || "",
      status: post.status,
      notities: post.notities || "",
      gebruikingen: (post.gebruikingen || []).map((g) => ({
        id: g.id,
        datum: naarDateTimeLocal(g.datum),
        soort: g.soort,
        bedrag: String(g.bedrag).replace(".", ","),
        waaraan: isBankstorting(g.waaraan)
          ? GEBRUIK_BANKSTORTING
          : isOverdrachtMedewerker(g.waaraan)
            ? GEBRUIK_OVERDRACHT_MEDEWERKER
            : g.waaraan || "",
        bank: g.bank || bankUitWaaraan(g.waaraan),
        medewerker: g.medewerker || medewerkerUitWaaraan(g.waaraan),
        toelichting: g.toelichting || ""
      }))
    });
    window.setTimeout(() => formulierRef.current?.scrollIntoView({ behavior: "smooth" }), 0);
  };
  const kiesDossier = (opdrachtId: string) => {
    if (!opdrachtId) {
      setForm({ ...form, opdrachtId: "" });
      return;
    }
    const opdracht = opdrachtenById.get(opdrachtId);
    setForm({ ...form, opdrachtId, klantNaam: opdracht?.klantNaam || form.klantNaam });
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const bedrag = Number(String(form.bedrag).replace(",", "."));
    if (!Number.isFinite(bedrag) || bedrag < 0) {
      setFout("Vul een geldig bedrag in.");
      return;
    }
    if (!form.omschrijving.trim() && form.type !== "OVERDRACHT") {
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
    const wijze = form.betalingswijze || null;
    const medewerkerNaam =
      wijze === "OPGEHAALD" || !wijze
        ? medewerker?.name || form.afgehandeldDoorNaam.trim()
        : "";
    const geldBijPersoon = form.geldBijUserId
      ? team.find((u) => u.id === form.geldBijUserId)
      : undefined;
    const geldVanPersoonTeam = form.geldVanUserId
      ? team.find((u) => u.id === form.geldVanUserId)
      : undefined;
    const geldVanNaam = geldVanPersoonTeam?.name || form.geldVanNaam.trim();
    const geldBijNaam = geldBijPersoon?.name || form.geldBijNaam.trim();
    if (form.type === "OVERDRACHT" && (!geldVanNaam || !geldBijNaam)) {
      setFout("Bij een overdracht vul je in van wie het geld komt én bij wie het nu is.");
      return;
    }
    const omschrijving =
      form.omschrijving.trim() ||
      (form.type === "OVERDRACHT" ? `Overdracht ${geldVanNaam} → ${geldBijNaam}` : "");
    if (!omschrijving || !Number.isFinite(bedrag) || bedrag < 0) {
      setFout("Vul een omschrijving en een geldig bedrag in.");
      return;
    }
    const gebruikingen: Array<{
      id: string;
      datum: string;
      soort: FinancieelGebruikSoort;
      bedrag: number;
      waaraan: string;
      bank: string;
      medewerker: string;
      toelichting: string;
    }> = [];
    for (const rij of form.gebruikingen) {
      const heeftInhoud =
        rij.bedrag.trim() ||
        rij.waaraan.trim() ||
        rij.bank.trim() ||
        rij.medewerker.trim() ||
        rij.toelichting.trim();
      if (!heeftInhoud) continue;
      const gebruikBedrag = Number(String(rij.bedrag).replace(",", "."));
      if (!Number.isFinite(gebruikBedrag) || gebruikBedrag <= 0) {
        setFout("Vul bij elke gebruiksregel een geldig bedrag in (of verwijder de lege regel).");
        return;
      }
      if (isBankstorting(rij.waaraan) && !rij.bank.trim()) {
        setFout("Kies bij een bankstorting welke bank.");
        return;
      }
      if (isOverdrachtMedewerker(rij.waaraan) && !rij.medewerker.trim()) {
        setFout("Kies of schrijf bij een overdracht naar medewerker de naam.");
        return;
      }
      if (isOverdrachtMedewerker(rij.waaraan) && rij.soort !== "AF") {
        setFout("Overdracht medewerker kan alleen als ‘Afgetrokken / besteed’ (verplaatsing).");
        return;
      }
      let gebruikDatum: string;
      try {
        gebruikDatum = dateTimeLocalNaarIso(rij.datum || form.datum);
      } catch {
        setFout("Vul bij elke gebruiksregel een geldige datum in.");
        return;
      }
      gebruikingen.push({
        id: rij.id || nieuweGebruikId(),
        datum: gebruikDatum,
        soort: rij.soort,
        bedrag: gebruikBedrag,
        waaraan: isBankstorting(rij.waaraan)
          ? GEBRUIK_BANKSTORTING
          : isOverdrachtMedewerker(rij.waaraan)
            ? GEBRUIK_OVERDRACHT_MEDEWERKER
            : rij.waaraan.trim(),
        bank: isBankstorting(rij.waaraan) ? rij.bank.trim() : "",
        medewerker: isOverdrachtMedewerker(rij.waaraan) ? rij.medewerker.trim() : "",
        toelichting: rij.toelichting.trim()
      });
    }
    const payload = {
      datum: datumIso,
      type: form.type,
      omschrijving,
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
      geldVanUserId: form.geldVanUserId || null,
      geldVanNaam,
      status: form.type === "OVERDRACHT" || form.type === "KASGELD" ? "BETAALD" : form.status,
      notities: form.notities.trim(),
      gebruikingen
    };
    try {
      setBezig(true);
      setFout(null);
      if (bewerkId) {
        const updated = await updateFinancieelPost(bewerkId, payload);
        setPosten((huidig) =>
          huidig.map((p) =>
            p.id === updated.id
              ? { ...updated, valuta: normalizeValuta(updated.valuta || payload.valuta) }
              : p
          )
        );
      } else {
        const created = await createFinancieelPost(payload);
        setPosten((huidig) => [
          { ...created, valuta: normalizeValuta(created.valuta || payload.valuta) },
          ...huidig
        ]);
      }
      resetForm();
    } catch (error) {
      setFout(error instanceof Error ? error.message : "Opslaan mislukt.");
    } finally {
      setBezig(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Deze financiële post permanent verwijderen?")) return;
    try {
      setFout(null);
      await deleteFinancieelPost(id);
      setPosten((huidig) => huidig.filter((p) => p.id !== id));
      if (bewerkId === id) resetForm();
    } catch (error) {
      setFout(error instanceof Error ? error.message : "Verwijderen mislukt.");
    }
  };

  const openNieuwFormulier = () => {
    setTab("dagboek");
    if (!bewerkId) setForm(leegFormulier(filterValuta));
    window.setTimeout(() => formulierRef.current?.scrollIntoView({ behavior: "smooth" }), 0);
  };
  const sluitDagAf = () => {
    if (!window.confirm("Het dagverslag als afsluiting bewaren?")) return;
    setAfsluitingen(bewaarAfsluiting(maakDagAfsluiting(dagVerslag, dashboardValuta)));
  };
  const sluitMaandAf = () => {
    if (!window.confirm(`De geselecteerde periode “${bereik.label}” als maandafsluiting bewaren?`)) return;
    setAfsluitingen(bewaarAfsluiting(maakMaandAfsluiting(kpis, wv, bereik.label)));
  };
  const toonFormulier =
    tab === "dagboek" || tab === "inkomsten" || tab === "uitgaven" || tab === "followmoney" || bewerkId !== null;
  const categorieOpties = form.type === "UITGAVE" ? UITGAVE_CATEGORIEEN : INKOMST_DIENSTEN;

  return (
    <div className="fin-dashboard">
      <div className="fin-main">
        <nav className="fin-tabs" aria-label="Financiële navigatie">
          {FINANCIEEL_TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`fin-tab${tab === item.id ? " actief" : ""}`}
              onClick={() => setTab(item.id)}
              title={item.hint}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <header className="card page-card fin-toolbar">
          <div className="fin-toolbar-title">
            <h1>Financiën</h1>
            <p className="muted">{bereik.label} · {VALUTA_LABELS[dashboardValuta]}</p>
          </div>
          <label className="form-label">
            Periode
            <select className="form-input" value={periode} onChange={(e) => setPeriode(e.target.value as PeriodeSleutel)}>
              {PERIODE_OPTIES.map((optie) => <option key={optie.id} value={optie.id}>{optie.label}</option>)}
            </select>
          </label>
          {periode === "aangepast" && (
            <>
              <label className="form-label">Van<input type="date" className="form-input" value={customVan} onChange={(e) => setCustomVan(e.target.value)} /></label>
              <label className="form-label">Tot<input type="date" className="form-input" value={customTot} onChange={(e) => setCustomTot(e.target.value)} /></label>
            </>
          )}
          <label className="form-label">
            Valuta
            <select className="form-input" value={filterValuta} onChange={(e) => setFilterValuta(e.target.value as FinancieelValuta)}>
              {FINANCIEEL_VALUTAS.map((valuta) => <option key={valuta} value={valuta}>{VALUTA_LABELS[valuta]}</option>)}
            </select>
          </label>
          <label className="form-label fin-toolbar-search">
            Zoeken
            <input type="search" className="form-input" placeholder="Klant, dossier, categorie..." value={zoekterm} onChange={(e) => setZoekterm(e.target.value)} />
          </label>
          <button type="button" className="btn-primary" onClick={openNieuwFormulier}>Nieuwe post</button>
        </header>

        {fout && <p className="muted page-error">{fout}</p>}
        {laden && <section className="card page-card"><p className="muted">Financiële gegevens laden...</p></section>}

        {!laden && tab === "overzicht" && (
          <OverzichtPanel kpis={kpis} gezondheid={gezondheid} signaleringen={signaleringen} dag={dagVerslag} tijdreeks={tijdreeks} onOpenTab={(id) => setTab(id as FinancieelTabId)} />
        )}
        {!laden && tab === "vandaag" && <VandaagPanel dag={dagVerslag} valuta={dashboardValuta} />}
        {!laden && tab === "followmoney" && (
          <FollowTheMoneyPanel dag={followMoney} onDagWissel={setFollowDag} />
        )}
        {!laden && tab === "dagboek" && (
          <section className="card page-card">
            <div className="section-header section-header-row">
              <div><h2>Financieel dagboek</h2><p className="muted">{zichtbaar.length} post(en).</p></div>
              <select className="form-input financieel-filter" value={filterType} onChange={(e) => setFilterType(e.target.value as "ALLE" | FinancieelType)}>
                <option value="ALLE">Alle typen</option>
                <option value="INKOMST">Inkomsten</option>
                <option value="UITGAVE">Uitgaven</option>
                <option value="KASGELD">Kasgeld</option>
                <option value="OVERDRACHT">Overdracht</option>
              </select>
            </div>
            <PostenTabel posten={zichtbaar} opdrachtenById={opdrachtenById} onBewerk={startBewerk} onDelete={(id) => void handleDelete(id)} emptyText="Geen financiële posten gevonden." />
          </section>
        )}
        {!laden && tab === "inkomsten" && (
          <div className="fin-panel-stack">
            <InkomstenStats valuta={dashboardValuta} kpis={kpis} posten={periodePosten} />
            <section className="card page-card">
              <div className="section-header"><h2>Inkomsten en kasgeld</h2><p className="muted">Gebruik in het formulier type Inkomst of Kasgeld.</p></div>
              <PostenTabel posten={inkomstenPosten} opdrachtenById={opdrachtenById} onBewerk={startBewerk} onDelete={(id) => void handleDelete(id)} emptyText="Geen inkomsten gevonden." />
            </section>
          </div>
        )}
        {!laden && tab === "uitgaven" && (
          <section className="card page-card">
            <div className="section-header"><h2>Uitgaven</h2><p className="muted">Gebruik in het formulier type Uitgave.</p></div>
            <PostenTabel posten={uitgavenPosten} opdrachtenById={opdrachtenById} onBewerk={startBewerk} onDelete={(id) => void handleDelete(id)} emptyText="Geen uitgaven gevonden." />
          </section>
        )}
        {!laden && tab === "openstaand" && <OpenstaandPanel rijen={openstaand} valuta={dashboardValuta} />}
        {!laden && tab === "facturen" && <FacturenPanel facturen={facturen.filter((f) => f.valuta === dashboardValuta)} />}
        {!laden && tab === "klantbetalingen" && (
          <div className="fin-panel-stack">
            <KlantbetalingenPanel saldi={klantSaldi.filter((s) => s.valuta === dashboardValuta)} />
            <section className="card page-card">
              <div className="section-header"><h2>Dossiersaldo’s</h2><p className="muted">Openstaande en betaalde bedragen per gekoppeld dossier.</p></div>
              <SaldoTabel
                rows={dossierSaldi.filter((s) => s.valuta === dashboardValuta)}
                emptyText="Nog geen posten gekoppeld aan een dossier."
                labelHeader="Dossier"
                getKey={(row) => `${(row as DossierSaldo).opdrachtId}-${row.valuta}`}
                getLabel={(row) => {
                  const dossier = row as DossierSaldo;
                  return { title: dossier.klantNaam, subtitle: dossier.dossierLabel.replace(`${dossier.klantNaam} – `, "") };
                }}
              />
            </section>
          </div>
        )}
        {!laden && tab === "kosten" && <KostenPanel items={kosten} valuta={dashboardValuta} />}
        {!laden && tab === "winstverlies" && <WinstVerliesPanel wv={wv} />}
        {!laden && tab === "cashflow" && <CashflowPanel cf={cashflow} tijdreeks={tijdreeks} />}
        {!laden && tab === "analyses" && (
          <AnalysesPanel tijdreeks={tijdreeks} kosten={kosten} diensten={diensten} aging={aging} kalender={kalender} signaleringen={signaleringen} valuta={dashboardValuta} onDagKlik={(datum) => {
            setFollowDag(datum);
            setTab("followmoney");
          }} />
        )}
        {!laden && tab === "rapportages" && (
          <RapportagesPanel
            afsluitingen={afsluitingen}
            onDagAfsluiten={sluitDagAf}
            onMaandAfsluiten={sluitMaandAf}
            onExportPosten={() => exportFinancieelPostenCsv(posten, opdrachtenById)}
            onExportKlant={() => exportKlantSaldiCsv(posten)}
            onExportDossier={() => exportDossierSaldiCsv(posten, opdrachtenById)}
            onExportPdf={() => exportFinancieelPdf(posten, opdrachtenById)}
            disabled={laden || posten.length === 0}
          />
        )}
        {!laden && tab === "instellingen" && (
          <InstellingenPanel
            standaardValuta={dashboardValuta}
            geldBij={geldBijTotalen}
            onValuta={(valuta) => {
              standaardValutaOpslaan(valuta);
              setFilterValuta(valuta);
              setDashboardValuta(valuta);
              setForm((huidig) => ({ ...huidig, valuta }));
            }}
          />
        )}

        {toonFormulier && (
          <section ref={formulierRef} className="card page-card">
            <div className="section-header">
              <h2>{bewerkId ? "Post bewerken" : "Nieuwe post registreren"}</h2>
              <p className="muted">Koppel waar mogelijk een klant en dossier voor volledige saldo-overzichten.</p>
            </div>
            <form className="form financieel-form" onSubmit={handleSubmit}>
              <div className="financieel-form-grid">
                <label className="form-label">Datum & tijd<input type="datetime-local" className="form-input" value={form.datum} onChange={(e) => setForm({ ...form, datum: e.target.value })} required /></label>
                <label className="form-label">
                  Type
                  <select className="form-input" value={form.type} onChange={(e) => {
                    const type = e.target.value as FinancieelType;
                    setForm({
                      ...form,
                      type,
                      status: type === "KASGELD" || type === "OVERDRACHT" ? "BETAALD" : form.status
                    });
                  }}>
                    <option value="INKOMST">Inkomst</option>
                    <option value="UITGAVE">Uitgave</option>
                    <option value="KASGELD">Kasgeld (al in kas)</option>
                    <option value="OVERDRACHT">Overdracht (van A naar B)</option>
                  </select>
                </label>
                <label className="form-label">Bedrag<input className="form-input" inputMode="decimal" placeholder="0,00" value={form.bedrag} onChange={(e) => setForm({ ...form, bedrag: e.target.value })} required /></label>
                <label className="form-label">
                  Valuta
                  <select className="form-input" value={form.valuta} onChange={(e) => setForm({ ...form, valuta: e.target.value as FinancieelValuta })}>
                    {FINANCIEEL_VALUTAS.map((valuta) => <option key={valuta} value={valuta}>{VALUTA_LABELS[valuta]}</option>)}
                  </select>
                </label>
                <label className="form-label">Wisselkoers<input className="form-input" inputMode="decimal" placeholder="bijv. 40,5" value={form.wisselkoers} onChange={(e) => setForm({ ...form, wisselkoers: e.target.value })} /></label>
                <label className="form-label">
                  Status
                  <select className="form-input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as FinancieelStatus })} disabled={form.type === "KASGELD" || form.type === "OVERDRACHT"}>
                    {form.type === "KASGELD" ? <option value="BETAALD">In kas</option> : form.type === "OVERDRACHT" ? <option value="BETAALD">Overgedragen</option> : form.type === "INKOMST" ? <><option value="OPEN">Nog te betalen door klant</option><option value="BETAALD">Betaald door klant</option></> : <><option value="OPEN">Nog te betalen door ons</option><option value="BETAALD">Uitbetaald</option></>}
                  </select>
                </label>
                <label className="form-label financieel-span-2">
                  Dossier (opdracht)
                  <select className="form-input" value={form.opdrachtId} onChange={(e) => kiesDossier(e.target.value)}>
                    <option value="">— Geen dossier gekozen —</option>
                    {gefilterdeDossiers.map((o) => <option key={o.id} value={o.id}>{opdrachtDossierLabel(o)} ({statusLabel(o.status)})</option>)}
                  </select>
                </label>
                <label className="form-label">
                  Betalingswijze
                  <select className="form-input" value={form.betalingswijze} onChange={(e) => {
                    const betalingswijze = e.target.value as "" | FinancieelBetalingswijze;
                    setForm({
                      ...form,
                      betalingswijze,
                      bank: betalingswijze === "OVERGEMAAKT" || betalingswijze === "GESTORT" ? form.bank : "",
                      afgehandeldDoorUserId: betalingswijze === "OPGEHAALD" || betalingswijze === "" ? form.afgehandeldDoorUserId : "",
                      afgehandeldDoorNaam: betalingswijze === "OPGEHAALD" || betalingswijze === "" ? form.afgehandeldDoorNaam : ""
                    });
                  }}>
                    <option value="">— Niet gekozen —</option>
                    {(Object.keys(BETALINGSWIJZE_LABELS) as FinancieelBetalingswijze[]).map((wijze) => <option key={wijze} value={wijze}>{BETALINGSWIJZE_LABELS[wijze]}</option>)}
                  </select>
                </label>
                {toontBank ? (
                  <label className="form-label">Bank (Suriname)<select className="form-input" value={form.bank} onChange={(e) => setForm({ ...form, bank: e.target.value })}><option value="">— Kies bank —</option>{SURINAAME_BANKEN.map((bank) => <option key={bank} value={bank}>{bank}</option>)}</select></label>
                ) : (
                  <label className="form-label">Medewerker<select className="form-input" value={form.afgehandeldDoorUserId} onChange={(e) => {
                    const id = e.target.value;
                    const medewerker = medewerkerOpties.find((m) => m.id === id);
                    setForm({ ...form, afgehandeldDoorUserId: id, afgehandeldDoorNaam: medewerker?.name || "", betalingswijze: form.betalingswijze || "OPGEHAALD" });
                  }}><option value="">— Geen medewerker —</option>{medewerkerOpties.map((u) => <option key={u.id} value={u.id}>{u.name}{!u.active ? " (inactief)" : ""}{u.role === "EIGENAAR" ? " · eigenaar" : ""}</option>)}</select></label>
                )}
                {toontMedewerker && (
                  <label className="form-label financieel-span-2">Of typ medewerkernaam<input className="form-input" list="financieel-afgehandeld-door" value={form.afgehandeldDoorNaam} onChange={(e) => {
                    const naam = e.target.value;
                    const match = team.find((u) => u.name.trim().toLowerCase() === naam.trim().toLowerCase());
                    setForm({ ...form, afgehandeldDoorNaam: naam, afgehandeldDoorUserId: match?.id || "", betalingswijze: form.betalingswijze || (naam ? "OPGEHAALD" : "") });
                  }} /><datalist id="financieel-afgehandeld-door">{medewerkerOpties.map((u) => <option key={u.id} value={u.name} />)}</datalist></label>
                )}
                {(form.type === "OVERDRACHT" || form.type === "UITGAVE") && (
                  <>
                <label className="form-label">
                  {form.type === "OVERDRACHT"
                    ? "Van wie kwam het geld?"
                    : "Uit wiens kas is dit betaald?"}
                  <select className="form-input" value={form.geldVanUserId} onChange={(e) => {
                    const id = e.target.value;
                    const medewerker = medewerkerOpties.find((m) => m.id === id);
                    setForm({ ...form, geldVanUserId: id, geldVanNaam: medewerker?.name || "" });
                  }}>
                    <option value="">— Niet gekozen —</option>
                    {medewerkerOpties.map((u) => (
                      <option key={u.id} value={u.id}>{u.name}{!u.active ? " (inactief)" : ""}</option>
                    ))}
                  </select>
                </label>
                <label className="form-label">
                  Of typ van-wie-naam
                  <input className="form-input" list="financieel-geld-van" value={form.geldVanNaam} onChange={(e) => {
                    const naam = e.target.value;
                    const match = team.find((u) => u.name.trim().toLowerCase() === naam.trim().toLowerCase());
                    setForm({ ...form, geldVanNaam: naam, geldVanUserId: match?.id || "" });
                  }} />
                  <datalist id="financieel-geld-van">{medewerkerOpties.map((u) => <option key={u.id} value={u.name} />)}</datalist>
                </label>
                  </>
                )}
                {form.type !== "UITGAVE" && (
                  <>
                <label className="form-label">
                  {form.type === "OVERDRACHT" ? "Bij wie is het geld nu?" : "Bij wie is het geld?"}
                  <select className="form-input" value={form.geldBijUserId} onChange={(e) => {
                    const id = e.target.value;
                    const medewerker = medewerkerOpties.find((m) => m.id === id);
                    setForm({ ...form, geldBijUserId: id, geldBijNaam: medewerker?.name || "" });
                  }}><option value="">— Niet gekozen —</option>{medewerkerOpties.map((u) => <option key={u.id} value={u.id}>{u.name}{!u.active ? " (inactief)" : ""}</option>)}</select>
                </label>
                <label className="form-label">Of typ een naam<input className="form-input" list="financieel-geld-bij" value={form.geldBijNaam} onChange={(e) => {
                  const naam = e.target.value;
                  const match = team.find((u) => u.name.trim().toLowerCase() === naam.trim().toLowerCase());
                  setForm({ ...form, geldBijNaam: naam, geldBijUserId: match?.id || "" });
                }} /><datalist id="financieel-geld-bij">{medewerkerOpties.map((u) => <option key={u.id} value={u.name} />)}</datalist></label>
                  </>
                )}
                <label className="form-label financieel-span-2">
                  {form.type === "KASGELD"
                ? "Klant (optioneel)"
                : form.type === "OVERDRACHT"
                  ? "Klant (optioneel)"
                : form.type === "INKOMST"
                  ? "Klant (betaler / nog te betalen)"
                  : "Klant (ontvanger / nog uit te betalen)"}
                  <select className="form-input" value={form.klantNaam} onChange={(e) => {
                    const klantNaam = e.target.value;
                    const opdrachtPast = !form.opdrachtId || opdrachtenById.get(form.opdrachtId)?.klantNaam.trim() === klantNaam.trim();
                    setForm({ ...form, klantNaam, opdrachtId: opdrachtPast ? form.opdrachtId : "" });
                  }}><option value="">— Geen klant gekozen —</option>{klantOpties.map((naam) => <option key={naam} value={naam}>{naam}</option>)}</select>
                </label>
                <label className="form-label financieel-span-2">
                  Of typ een nieuwe klantnaam
                  <input className="form-input" list="financieel-klanten" value={form.klantNaam} onChange={(e) => {
                    const klantNaam = e.target.value;
                    const opdrachtPast = !form.opdrachtId || opdrachtenById.get(form.opdrachtId)?.klantNaam.trim().toLowerCase() === klantNaam.trim().toLowerCase();
                    setForm({ ...form, klantNaam, opdrachtId: opdrachtPast ? form.opdrachtId : "" });
                  }} />
                  <datalist id="financieel-klanten">{klantOpties.map((naam) => <option key={naam} value={naam} />)}</datalist>
                  {form.klantNaam.trim() && <p className={`financieel-klant-saldo-hint${actueelKlantSaldo && (actueelKlantSaldo.teOntvangen > 0 || actueelKlantSaldo.teBetalen > 0) ? " heeft-saldo" : ""}`}>{klantSaldoSamenvatting(actueelKlantSaldo, form.valuta)}</p>}
                </label>
                <label className="form-label financieel-span-2">Omschrijving<input className="form-input" value={form.omschrijving} onChange={(e) => setForm({ ...form, omschrijving: e.target.value })} required={form.type !== "OVERDRACHT"} placeholder={form.type === "OVERDRACHT" ? "Optioneel — anders: Overdracht A → B" : ""} /></label>
                <label className="form-label">
                  Categorie
                  <input className="form-input" list="financieel-categorieen" placeholder={form.type === "UITGAVE" ? "Kantoor, personeel..." : "Visa, advies..."} value={form.categorie} onChange={(e) => setForm({ ...form, categorie: e.target.value })} />
                  <datalist id="financieel-categorieen">{categorieOpties.map((categorie) => <option key={categorie} value={categorie} />)}</datalist>
                </label>
                <label className="form-label">Referentie<input className="form-input" placeholder="Factuurnummer" value={form.referentie} onChange={(e) => setForm({ ...form, referentie: e.target.value })} /></label>
                <div className="financieel-span-2 financieel-gebruik-blok">
                  <div className="section-header">
                    <h3>Van dit bedrag gebruikt</h3>
                    <p className="muted">Het originele bedrag blijft staan. Hier vul je in wat eraf ging of erbij kwam, en waaraan.</p>
                  </div>
                  {form.gebruikingen.map((rij, index) => (
                    <div key={rij.id} className="financieel-gebruik-rij">
                      <label className="form-label">
                        Wat gebeurde er?
                        <select
                          className="form-input"
                          value={rij.soort}
                          onChange={(e) => {
                            const gebruikingen = form.gebruikingen.slice();
                            gebruikingen[index] = { ...rij, soort: e.target.value as FinancieelGebruikSoort };
                            setForm({ ...form, gebruikingen });
                          }}
                        >
                          <option value="AF">Afgetrokken / besteed</option>
                          <option value="ERBIJ">Erbij gekomen</option>
                        </select>
                      </label>
                      <label className="form-label">
                        Bedrag
                        <input
                          className="form-input"
                          inputMode="decimal"
                          placeholder="0,00"
                          value={rij.bedrag}
                          onChange={(e) => {
                            const gebruikingen = form.gebruikingen.slice();
                            gebruikingen[index] = { ...rij, bedrag: e.target.value };
                            setForm({ ...form, gebruikingen });
                          }}
                        />
                      </label>
                      <label className="form-label">
                        {rij.soort === "AF" ? "Waaraan besteed?" : "Waar kwam het extra vandaan?"}
                        <select
                          className="form-input"
                          value={
                            isBankstorting(rij.waaraan)
                              ? GEBRUIK_BANKSTORTING
                              : isOverdrachtMedewerker(rij.waaraan)
                                ? GEBRUIK_OVERDRACHT_MEDEWERKER
                              : (UITGAVE_CATEGORIEEN as readonly string[]).includes(rij.waaraan)
                                ? rij.waaraan
                              : rij.waaraan
                                  ? "__anders__"
                                  : ""
                          }
                          onChange={(e) => {
                            const gekozen = e.target.value;
                            const gebruikingen = form.gebruikingen.slice();
                            if (gekozen === GEBRUIK_BANKSTORTING) {
                              gebruikingen[index] = {
                                ...rij,
                                waaraan: GEBRUIK_BANKSTORTING,
                                medewerker: "",
                                soort: rij.soort
                              };
                            } else if (gekozen === GEBRUIK_OVERDRACHT_MEDEWERKER) {
                              gebruikingen[index] = {
                                ...rij,
                                waaraan: GEBRUIK_OVERDRACHT_MEDEWERKER,
                                bank: "",
                                soort: "AF"
                              };
                            } else if (gekozen === "__anders__") {
                              gebruikingen[index] = {
                                ...rij,
                                waaraan: "Anders",
                                bank: "",
                                medewerker: ""
                              };
                            } else {
                              gebruikingen[index] = {
                                ...rij,
                                waaraan: gekozen,
                                bank: "",
                                medewerker: ""
                              };
                            }
                            setForm({ ...form, gebruikingen });
                          }}
                        >
                          <option value="">— Kies —</option>
                          <option value={GEBRUIK_BANKSTORTING}>Bankstorting</option>
                          <option value={GEBRUIK_OVERDRACHT_MEDEWERKER}>Overdracht medewerker</option>
                          {UITGAVE_CATEGORIEEN.map((categorie) => (
                            <option key={categorie} value={categorie}>{categorie}</option>
                          ))}
                          <option value="__anders__">Anders (zelf invullen)</option>
                        </select>
                      </label>
                      {((UITGAVE_CATEGORIEEN as readonly string[]).includes(rij.waaraan) ||
                      isBankstorting(rij.waaraan) ||
                      isOverdrachtMedewerker(rij.waaraan) ||
                      !rij.waaraan
                        ? false
                        : true) && (
                        <label className="form-label">
                          Zelf invullen
                          <input
                            className="form-input"
                            list="financieel-gebruik-waaraan"
                            placeholder={rij.soort === "AF" ? "Taxi, wisselgeld, eten..." : "Fooi, extra kas..."}
                            value={rij.waaraan}
                            onChange={(e) => {
                              const gebruikingen = form.gebruikingen.slice();
                              gebruikingen[index] = {
                                ...rij,
                                waaraan: e.target.value,
                                bank: "",
                                medewerker: ""
                              };
                              setForm({ ...form, gebruikingen });
                            }}
                          />
                        </label>
                      )}
                      {isBankstorting(rij.waaraan) && (
                        <label className="form-label">
                          Welke bank?
                          <select
                            className="form-input"
                            value={rij.bank}
                            onChange={(e) => {
                              const gebruikingen = form.gebruikingen.slice();
                              gebruikingen[index] = { ...rij, bank: e.target.value };
                              setForm({ ...form, gebruikingen });
                            }}
                          >
                            <option value="">— Kies bank —</option>
                            {SURINAAME_BANKEN.map((bank) => (
                              <option key={bank} value={bank}>{bank}</option>
                            ))}
                          </select>
                        </label>
                      )}
                      {isOverdrachtMedewerker(rij.waaraan) && (
                        <label className="form-label">
                          Naar welke medewerker?
                          <input
                            className="form-input"
                            list="financieel-gebruik-medewerker"
                            placeholder="Kies of typ een naam"
                            value={rij.medewerker}
                            onChange={(e) => {
                              const gebruikingen = form.gebruikingen.slice();
                              gebruikingen[index] = { ...rij, medewerker: e.target.value };
                              setForm({ ...form, gebruikingen });
                            }}
                          />
                        </label>
                      )}
                      {isOverdrachtMedewerker(rij.waaraan) && (
                        <p className="muted financieel-span-2">
                          Dit is een verplaatsing: het bedrag blijft in de kas, maar gaat naar deze medewerker.
                        </p>
                      )}
                      <label className="form-label">
                        Wanneer
                        <input
                          type="datetime-local"
                          className="form-input"
                          value={rij.datum}
                          onChange={(e) => {
                            const gebruikingen = form.gebruikingen.slice();
                            gebruikingen[index] = { ...rij, datum: e.target.value };
                            setForm({ ...form, gebruikingen });
                          }}
                        />
                      </label>
                      <label className="form-label financieel-span-2">
                        Toelichting
                        <input
                          className="form-input"
                          value={rij.toelichting}
                          onChange={(e) => {
                            const gebruikingen = form.gebruikingen.slice();
                            gebruikingen[index] = { ...rij, toelichting: e.target.value };
                            setForm({ ...form, gebruikingen });
                          }}
                        />
                      </label>
                      <button
                        type="button"
                        className="btn-ghost"
                        onClick={() =>
                          setForm({
                            ...form,
                            gebruikingen: form.gebruikingen.filter((g) => g.id !== rij.id)
                          })
                        }
                      >
                        Regel weg
                      </button>
                    </div>
                  ))}
                  <datalist id="financieel-gebruik-waaraan">
                    <option value={GEBRUIK_BANKSTORTING} />
                    <option value={GEBRUIK_OVERDRACHT_MEDEWERKER} />
                    {UITGAVE_CATEGORIEEN.map((categorie) => (
                      <option key={categorie} value={categorie} />
                    ))}
                  </datalist>
                  <datalist id="financieel-gebruik-medewerker">
                    {team
                      .filter((u) => u.active !== false)
                      .map((u) => (
                        <option key={u.id} value={u.name} />
                      ))}
                  </datalist>
                  <div className="financieel-gebruik-acties">
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => setForm({ ...form, gebruikingen: [...form.gebruikingen, legeGebruikRij()] })}
                    >
                      Regel toevoegen
                    </button>
                    <p className="muted financieel-gebruik-restant">
                      Origineel {formatGeld(Number(String(form.bedrag).replace(",", ".")) || 0, form.valuta)}
                      {" · "}
                      restant{" "}
                      <strong>
                        {formatGeld(
                          restantBedrag({
                            bedrag: Number(String(form.bedrag).replace(",", ".")) || 0,
                            gebruikingen: form.gebruikingen.map((rij) => ({
                              id: rij.id,
                              datum: rij.datum,
                              soort: rij.soort,
                              bedrag: Number(String(rij.bedrag).replace(",", ".")) || 0,
                              waaraan: rij.waaraan,
                              bank: rij.bank,
                              medewerker: rij.medewerker
                            }))
                          }),
                          form.valuta
                        )}
                      </strong>
                    </p>
                  </div>
                </div>
                <label className="form-label financieel-span-2">Notities<textarea className="form-input" rows={2} value={form.notities} onChange={(e) => setForm({ ...form, notities: e.target.value })} /></label>
              </div>
              <div className="financieel-form-actions">
                {bewerkId && <button type="button" className="btn-ghost" onClick={resetForm} disabled={bezig}>Annuleren</button>}
                <button type="submit" className="btn-primary" disabled={bezig}>{bezig ? "Bezig..." : bewerkId ? "Wijzigingen opslaan" : "Post toevoegen"}</button>
              </div>
            </form>
          </section>
        )}
      </div>
    </div>
  );
}
