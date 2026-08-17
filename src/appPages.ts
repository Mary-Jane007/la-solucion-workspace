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
    ondertitel: "P1-taken, deadlines en opdrachten die aandacht vragen."
  },
  deadlines: {
    titel: "Deadlines",
    ondertitel: "Overzicht van komende en verlopen deadlines."
  },
  klanten: {
    titel: "Klanten",
    ondertitel: "Alle klanten met hun opdrachten op één plek."
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
    ondertitel: "Korte uitleg over het gebruik van het portaal."
  },
  contact: {
    titel: "Contact",
    ondertitel: "Hulp nodig? Neem contact op met het kantoor."
  }
};

export function isEigenaarPagina(pagina: AppPagina): boolean {
  return EIGENAAR_PAGINAS.includes(pagina);
}
