import { Opdracht, OpdrachtStatus } from "./types";

export function laadOpdrachten(storageKey: string): Opdracht[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return [];
    return JSON.parse(raw) as Opdracht[];
  } catch {
    return [];
  }
}

export function slaOpdrachtenOp(storageKey: string, opdrachten: Opdracht[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey, JSON.stringify(opdrachten));
}

export function genereerMockData(): Opdracht[] {
  const nu = new Date();
  const vandaag = nu.toISOString().slice(0, 10);
  const morgen = new Date(nu.getTime() + 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const volgendeWeek = new Date(nu.getTime() + 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  return [
    {
      id: "1",
      klantNaam: "Familie Rodríguez",
      omschrijving: "Verlenging Dominicaanse paspoort gezin (4 personen).",
      datumAangemaakt: vandaag,
      datumDeadline: volgendeWeek,
      status: OpdrachtStatus.InBehandeling,
      prioriteit: 1,
      behandelaar: "Ana",
      categorie: "Paspoort",
      bestanden: []
    },
    {
      id: "2",
      klantNaam: "Carlos Gómez",
      omschrijving: "Nederlandse verblijfsvergunning verlengen (arbeid in loondienst).",
      datumAangemaakt: vandaag,
      datumDeadline: morgen,
      status: OpdrachtStatus.Nieuw,
      prioriteit: 1,
      behandelaar: "Marisol",
      categorie: "Vergunning",
      bestanden: []
    },
    {
      id: "3",
      klantNaam: "Consulaat Dominicaanse Republiek",
      omschrijving: "Legalisatie documenten voor huwelijk in Santo Domingo.",
      datumAangemaakt: vandaag,
      status: OpdrachtStatus.InBehandeling,
      prioriteit: 2,
      behandelaar: "Pedro",
      categorie: "Legalisatie",
      bestanden: []
    },
    {
      id: "4",
      klantNaam: "Julia Martínez",
      omschrijving: "Advies intake nieuwe verblijfsaanvraag partner.",
      datumAangemaakt: vandaag,
      datumDeadline: vandaag,
      status: OpdrachtStatus.Nieuw,
      prioriteit: 2,
      categorie: "Intake",
      bestanden: []
    },
    {
      id: "5",
      klantNaam: "Fam. Peña",
      omschrijving: "Legaliseer geboorteakte voor IND en consulaat.",
      datumAangemaakt: vandaag,
      status: OpdrachtStatus.Afgerond,
      prioriteit: 3,
      behandelaar: "Ana",
      categorie: "Legalisatie",
      bestanden: []
    }
  ];
}

