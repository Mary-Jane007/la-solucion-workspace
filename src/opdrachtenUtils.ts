import { Gebruiker, Opdracht, OpdrachtStatus } from "./types";

export function filterZichtbareOpdrachten(
  opdrachten: Opdracht[],
  gebruiker: Gebruiker,
  isEigenaar: boolean
): Opdracht[] {
  if (isEigenaar) return opdrachten;
  return opdrachten.filter(
    (o) =>
      o.behandelaarNaam &&
      o.behandelaarNaam.toLocaleLowerCase() === gebruiker.naam.toLocaleLowerCase()
  );
}

export function filterMijnOpdrachten(opdrachten: Opdracht[], gebruiker: Gebruiker): Opdracht[] {
  return opdrachten.filter(
    (o) =>
      o.behandelaarUserId === gebruiker.id ||
      (o.behandelaarNaam &&
        o.behandelaarNaam.toLocaleLowerCase() === gebruiker.naam.toLocaleLowerCase())
  );
}

function vandaagIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function morgenIso(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

function eindeWeekIso(): string {
  const d = new Date();
  const dag = d.getDay();
  const diff = dag === 0 ? 0 : 7 - dag;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

export function isTeLaat(opdracht: Opdracht): boolean {
  if (!opdracht.datumDeadline || opdracht.status === OpdrachtStatus.Afgerond) return false;
  return opdracht.datumDeadline < vandaagIso();
}

export interface MeldingItem {
  id: string;
  type: "p1" | "deadline-vandaag" | "deadline-morgen" | "te-laat";
  titel: string;
  opdracht: Opdracht;
}

export function berekenMeldingen(opdrachten: Opdracht[]): MeldingItem[] {
  const vandaag = vandaagIso();
  const morgen = morgenIso();
  const items: MeldingItem[] = [];

  for (const o of opdrachten) {
    if (o.status === OpdrachtStatus.Afgerond) continue;
    if (o.prioriteit === 1) {
      items.push({
        id: `p1-${o.id}`,
        type: "p1",
        titel: `Hoge prioriteit: ${o.klantNaam}`,
        opdracht: o
      });
    }
    if (o.datumDeadline === vandaag) {
      items.push({
        id: `vandaag-${o.id}`,
        type: "deadline-vandaag",
        titel: `Deadline vandaag: ${o.klantNaam}`,
        opdracht: o
      });
    } else if (o.datumDeadline === morgen) {
      items.push({
        id: `morgen-${o.id}`,
        type: "deadline-morgen",
        titel: `Deadline morgen: ${o.klantNaam}`,
        opdracht: o
      });
    } else if (isTeLaat(o)) {
      items.push({
        id: `laat-${o.id}`,
        type: "te-laat",
        titel: `Te laat: ${o.klantNaam}`,
        opdracht: o
      });
    }
  }

  return items;
}

export interface DeadlineGroep {
  label: string;
  opdrachten: Opdracht[];
}

export function groepeerDeadlines(opdrachten: Opdracht[]): DeadlineGroep[] {
  const vandaag = vandaagIso();
  const morgen = morgenIso();
  const week = eindeWeekIso();
  const open = opdrachten.filter((o) => o.status !== OpdrachtStatus.Afgerond && o.datumDeadline);

  const teLaat = open.filter((o) => o.datumDeadline! < vandaag);
  const vandaagLijst = open.filter((o) => o.datumDeadline === vandaag);
  const morgenLijst = open.filter((o) => o.datumDeadline === morgen);
  const dezeWeek = open.filter(
    (o) => o.datumDeadline! > morgen && o.datumDeadline! <= week
  );
  const later = open.filter((o) => o.datumDeadline! > week);

  return [
    { label: "Te laat", opdrachten: teLaat },
    { label: "Vandaag", opdrachten: vandaagLijst },
    { label: "Morgen", opdrachten: morgenLijst },
    { label: "Deze week", opdrachten: dezeWeek },
    { label: "Later", opdrachten: later }
  ].filter((g) => g.opdrachten.length > 0);
}

export interface StatistiekenData {
  totaal: number;
  nieuw: number;
  lopend: number;
  afgerond: number;
  p1: number;
  p2: number;
  p3: number;
  teLaat: number;
  deadlineVandaag: number;
  deadlineDezeWeek: number;
  documenten: number;
  klanten: number;
  perMedewerker: { naam: string; totaal: number; open: number; afgerond: number }[];
  perMaand: { label: string; aantal: number }[];
  perStatus: { label: string; waarde: number; kleur: string }[];
}

export function berekenStatistieken(opdrachten: Opdracht[]): StatistiekenData {
  const vandaag = vandaagIso();
  const week = eindeWeekIso();
  const open = opdrachten.filter((o) => o.status !== OpdrachtStatus.Afgerond);

  const medewerkerMap = new Map<string, { totaal: number; open: number; afgerond: number }>();
  for (const o of opdrachten) {
    const naam = o.behandelaarNaam || "Niet toegewezen";
    const entry = medewerkerMap.get(naam) || { totaal: 0, open: 0, afgerond: 0 };
    entry.totaal += 1;
    if (o.status === OpdrachtStatus.Afgerond) entry.afgerond += 1;
    else entry.open += 1;
    medewerkerMap.set(naam, entry);
  }

  const maandMap = new Map<string, number>();
  for (const o of opdrachten) {
    const maand = o.datumAangemaakt.slice(0, 7);
    maandMap.set(maand, (maandMap.get(maand) || 0) + 1);
  }
  const perMaand = [...maandMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([key, aantal]) => ({
      label: new Date(`${key}-01`).toLocaleDateString("nl-NL", { month: "short", year: "numeric" }),
      aantal
    }));

  const nieuw = opdrachten.filter((o) => o.status === OpdrachtStatus.Nieuw).length;
  const lopend = opdrachten.filter((o) => o.status === OpdrachtStatus.InBehandeling).length;
  const afgerond = opdrachten.filter((o) => o.status === OpdrachtStatus.Afgerond).length;

  return {
    totaal: opdrachten.length,
    nieuw,
    lopend,
    afgerond,
    p1: open.filter((o) => o.prioriteit === 1).length,
    p2: open.filter((o) => o.prioriteit === 2).length,
    p3: open.filter((o) => o.prioriteit === 3).length,
    teLaat: open.filter(isTeLaat).length,
    deadlineVandaag: open.filter((o) => o.datumDeadline === vandaag).length,
    deadlineDezeWeek: open.filter(
      (o) => o.datumDeadline && o.datumDeadline >= vandaag && o.datumDeadline <= week
    ).length,
    documenten: opdrachten.reduce((sum, o) => sum + (o.bestanden?.length ?? 0), 0),
    klanten: new Set(opdrachten.map((o) => o.klantNaam.toLowerCase().trim())).size,
    perMedewerker: [...medewerkerMap.entries()]
      .map(([naam, data]) => ({ naam, ...data }))
      .sort((a, b) => b.open - a.open),
    perMaand,
    perStatus: [
      { label: "Nieuw", waarde: nieuw, kleur: "#3b82f6" },
      { label: "In behandeling", waarde: lopend, kleur: "#f59e0b" },
      { label: "Afgerond", waarde: afgerond, kleur: "#22c55e" }
    ]
  };
}

export interface KlantGroep {
  klantNaam: string;
  opdrachten: Opdracht[];
  open: number;
  afgerond: number;
}

export function groepeerPerKlant(opdrachten: Opdracht[]): KlantGroep[] {
  const map = new Map<string, Opdracht[]>();
  for (const o of opdrachten) {
    const key = o.klantNaam.trim() || "Onbekend";
    const lijst = map.get(key) || [];
    lijst.push(o);
    map.set(key, lijst);
  }
  return [...map.entries()]
    .map(([klantNaam, lijst]) => ({
      klantNaam,
      opdrachten: lijst,
      open: lijst.filter((o) => o.status !== OpdrachtStatus.Afgerond).length,
      afgerond: lijst.filter((o) => o.status === OpdrachtStatus.Afgerond).length
    }))
    .sort((a, b) => a.klantNaam.localeCompare(b.klantNaam));
}

export interface DocumentItem {
  id: string;
  origineleNaam: string;
  grootte: number;
  klantNaam: string;
  opdrachtId: string;
  omschrijving: string;
}

export function flattenDocumenten(opdrachten: Opdracht[]): DocumentItem[] {
  const items: DocumentItem[] = [];
  for (const o of opdrachten) {
    for (const b of o.bestanden ?? []) {
      items.push({
        id: b.id,
        origineleNaam: b.origineleNaam,
        grootte: b.grootte,
        klantNaam: o.klantNaam,
        opdrachtId: o.id,
        omschrijving: o.omschrijving
      });
    }
  }
  return items.sort((a, b) => a.origineleNaam.localeCompare(b.origineleNaam));
}

export interface ActiviteitItem {
  id: string;
  datum: string;
  type: "aangemaakt" | "bijgewerkt";
  opdracht: Opdracht;
}

export function berekenActiviteit(opdrachten: Opdracht[]): ActiviteitItem[] {
  const items: ActiviteitItem[] = [];
  for (const o of opdrachten) {
    items.push({
      id: `new-${o.id}`,
      datum: o.datumAangemaakt,
      type: "aangemaakt",
      opdracht: o
    });
    if (o.bijgewerktOp && o.bijgewerktOp.slice(0, 10) !== o.datumAangemaakt) {
      items.push({
        id: `upd-${o.id}`,
        datum: o.bijgewerktOp,
        type: "bijgewerkt",
        opdracht: o
      });
    }
  }
  return items
    .sort((a, b) => new Date(b.datum).getTime() - new Date(a.datum).getTime())
    .slice(0, 40);
}

export function exportOpdrachtenCsv(opdrachten: Opdracht[]) {
  const headers = [
    "Klant",
    "Omschrijving",
    "Status",
    "Prioriteit",
    "Aangemaakt",
    "Deadline",
    "Behandelaar",
    "Categorie"
  ];
  const rows = opdrachten.map((o) => [
    o.klantNaam,
    o.omschrijving,
    o.status,
    String(o.prioriteit),
    o.datumAangemaakt,
    o.datumDeadline || "",
    o.behandelaarNaam || "",
    o.categorie || ""
  ]);
  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `opdrachten-${vandaagIso()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function telDeadlinesBadge(opdrachten: Opdracht[]): number {
  const vandaag = vandaagIso();
  const week = eindeWeekIso();
  return opdrachten.filter(
    (o) =>
      o.status !== OpdrachtStatus.Afgerond &&
      o.datumDeadline &&
      (o.datumDeadline < vandaag || (o.datumDeadline >= vandaag && o.datumDeadline <= week))
  ).length;
}
