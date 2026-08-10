export const PRULLENBAK_BEWAAR_DAGEN = 30;

export function opdrachtVerwijderBevestiging(klantNaam: string): string {
  return `Weet je zeker dat je de opdracht voor "${klantNaam}" wilt verwijderen?\n\nDe opdracht gaat naar de prullenbak en wordt na ${PRULLENBAK_BEWAAR_DAGEN} dagen permanent verwijderd. Je kunt deze binnen die periode nog herstellen.`;
}

export function permanentVerwijderDatum(verwijderdOp: string): string {
  const datum = new Date(verwijderdOp);
  datum.setDate(datum.getDate() + PRULLENBAK_BEWAAR_DAGEN);
  return datum.toLocaleDateString("nl-NL");
}
