import { Opdracht, OpdrachtStatus } from "./types";
import { berekenActiviteit, berekenMeldingen, deadlineBadgeIds, flattenDocumenten } from "./opdrachtenUtils";
import { BadgeLijst } from "./meldingenStatus";

function uniqueIds(ids: string[]): string[] {
  return [...new Set(ids.filter(Boolean))];
}

export function homeItemIds(opdrachten: Opdracht[]): string[] {
  const vandaag = new Date().toISOString().slice(0, 10);
  return uniqueIds([
    ...opdrachten
      .filter((o) => o.status !== OpdrachtStatus.Afgerond && o.prioriteit === 1)
      .map((o) => o.id),
    ...opdrachten.filter((o) => o.datumDeadline === vandaag).map((o) => o.id)
  ]);
}

export function bordItemIds(opdrachten: Opdracht[]): string[] {
  return uniqueIds(
    opdrachten.filter((o) => o.status !== OpdrachtStatus.Afgerond).map((o) => o.id)
  );
}

export function kalenderItemIds(opdrachten: Opdracht[]): string[] {
  return uniqueIds(
    opdrachten
      .filter((o) => o.status !== OpdrachtStatus.Afgerond && o.datumDeadline)
      .map((o) => o.id)
  );
}

export function mijnOpdrachtenItemIds(opdrachten: Opdracht[]): string[] {
  return uniqueIds(
    opdrachten.filter((o) => o.status !== OpdrachtStatus.Afgerond).map((o) => o.id)
  );
}

export function activiteitItemIds(opdrachten: Opdracht[]): string[] {
  return uniqueIds(berekenActiviteit(opdrachten).map((a) => a.id));
}

export function klantenItemIds(opdrachten: Opdracht[]): string[] {
  return uniqueIds(
    [...new Set(opdrachten.map((o) => o.klantNaam.trim().toLowerCase()))].filter(Boolean)
  );
}

export function documentenItemIds(opdrachten: Opdracht[]): string[] {
  return uniqueIds(flattenDocumenten(opdrachten).map((d) => d.id));
}

export function meldingenItemIds(opdrachten: Opdracht[]): string[] {
  return uniqueIds(berekenMeldingen(opdrachten).map((m) => m.id));
}

export function badgeIdsVoorPagina(
  lijst: BadgeLijst,
  context: {
    zichtbare: Opdracht[];
    alle: Opdracht[];
    mijn: Opdracht[];
    prullenbakIds: string[];
  }
): string[] {
  switch (lijst) {
    case "home":
      return homeItemIds(context.zichtbare);
    case "bord":
      return bordItemIds(context.zichtbare);
    case "kalender":
      return kalenderItemIds(context.zichtbare);
    case "mijn-opdrachten":
      return mijnOpdrachtenItemIds(context.mijn);
    case "meldingen":
      return meldingenItemIds(context.zichtbare);
    case "deadlines":
      return deadlineBadgeIds(context.zichtbare);
    case "activiteit":
      return activiteitItemIds(context.alle);
    case "klanten":
      return klantenItemIds(context.alle);
    case "documenten":
      return documentenItemIds(context.alle);
    case "prullenbak":
      return uniqueIds(context.prullenbakIds);
    default:
      return [];
  }
}
