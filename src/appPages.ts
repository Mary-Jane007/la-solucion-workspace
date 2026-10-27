export const APP_VERNIEUW_EVENT = "la-solucion-vernieuw";
export const FINANCIEEL_INZENDING_EVENT = "la-solucion-financieel-inzending";

export type AppPagina =
  | "home"
  | "bord"
  | "kalender"
  | "mijn-opdrachten"
  | "meldingen"
  | "deadlines"
  | "klanten"
  | "documenten"
  | "statistieken"
  | "activiteit"
  | "prullenbak"
  | "team"
  | "financieel"
  | "kas-doorgeven"
  | "export"
  | "profiel"
  | "instellingen"
  | "help"
  | "contact";

export const EIGENAAR_PAGINAS: AppPagina[] = [
  "statistieken",
  "activiteit",
  "klanten",
  "documenten",
  "team",
  "prullenbak",
  "financieel",
  "export"
];

export const PAGINA_INFO: Record<AppPagina, { titel: string; ondertitel: string }> = {
  home: {
    titel: "Werkdagoverzicht",
    ondertitel: "De belangrijkste taken en kerncijfers voor vandaag."
  },
  bord: {
    titel: "Opdrachtenbord",
    ondertitel: "Alle opdrachten per status, met zoeken en snelle acties."
  },
  kalender: {
    titel: "Kalender",
    ondertitel: "Opdrachten per aanmaakdatum en deadline."
  },
  "mijn-opdrachten": {
    titel: "Mijn opdrachten",
    ondertitel: "Opdrachten die aan jou zijn toegewezen."
  },
  meldingen: {
    titel: "Meldingen",
    ondertitel: "P1-taken, deadlines en financiële info van medewerkers."
  },
  deadlines: {
    titel: "Deadlines",
    ondertitel: "Overzicht van komende en verlopen deadlines."
  },
  klanten: {
    titel: "Klanten",
    ondertitel: "Alle klanten met kort nummer (K1, K2, …), van oud naar nieuw."
  },
  documenten: {
    titel: "Documenten",
    ondertitel: "Alle bijlagen uit opdrachten doorzoekbaar."
  },
  statistieken: {
    titel: "Statistieken",
    ondertitel: "Werkdruk, prioriteiten, teamverdeling én financiële kerncijfers."
  },
  activiteit: {
    titel: "Activiteit",
    ondertitel: "Recent aangemaakte en bijgewerkte opdrachten."
  },
  prullenbak: {
    titel: "Prullenbak",
    ondertitel: "Verwijderde opdrachten terugzetten of laten verlopen."
  },
  team: {
    titel: "Team",
    ondertitel: "Medewerkers beheren en actieve accounts bekijken."
  },
  financieel: {
    titel: "Financiële administratie",
    ondertitel: "Inkomsten, uitgaven en openstaande posten — alleen voor de eigenaar."
  },
  "kas-doorgeven": {
    titel: "Kas doorgeven",
    ondertitel: "Tik wat je vandaag deed. Aan het eind stuur je de hele dag in één keer door."
  },
  export: {
    titel: "Export",
    ondertitel: "Opdrachten en financiën exporteren voor rapportage."
  },
  profiel: {
    titel: "Profiel",
    ondertitel: "Je accountgegevens en rol in het systeem."
  },
  instellingen: {
    titel: "Instellingen",
    ondertitel: "Weergave en gegevens vernieuwen."
  },
  help: {
    titel: "Help",
    ondertitel: "Korte video’s met stappen en gesproken uitleg, per onderwerp."
  },
  contact: {
    titel: "Contact",
    ondertitel: "Hulp nodig? Neem contact op met het kantoor."
  }
};

export function isEigenaarPagina(pagina: AppPagina): boolean {
  return EIGENAAR_PAGINAS.includes(pagina);
}
