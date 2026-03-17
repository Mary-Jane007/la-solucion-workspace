export enum Rol {
  Eigenaar = "EIGENAAR",
  Medewerker = "MEDEWERKER"
}

export interface Gebruiker {
  id: string;
  naam: string;
  email: string;
  rol: Rol;
}

export enum OpdrachtStatus {
  Nieuw = "NIEUW",
  InBehandeling = "IN_BEHANDELING",
  Afgerond = "AFGEROND"
}

export type Prioriteit = 1 | 2 | 3;

export interface BestandsKoppeling {
  id: string;
  origineleNaam: string;
  mimeType?: string;
  grootte: number;
  createdAt?: string;
}

export interface Opdracht {
  id: string;
  klantNaam: string;
  omschrijving: string;
  datumAangemaakt: string;
  datumDeadline?: string;
  status: OpdrachtStatus;
  prioriteit: Prioriteit;
  behandelaarUserId?: string | null;
  behandelaarNaam?: string | null;
  notities?: string;
  categorie?: string;
  bestanden: BestandsKoppeling[];
}

