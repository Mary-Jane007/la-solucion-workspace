export type KasHelpSlide = {
  id: string;
  titel: string;
  ondertitel: string;
};

/** Beeld + gesproken tekst. Ondertitel is hetzelfde als de audio. */
export const KAS_HELP_SLIDES: KasHelpSlide[] = [
  {
    id: "start",
    titel: "Kas doorgeven",
    ondertitel:
      "Elke dag geef je door wat er met het geld in je kas is gebeurd. Je hoeft geen boekhouding te kennen. Tik wat je deed, vul het bedrag in, en stuur de dag door."
  },
  {
    id: "menu",
    titel: "Open Kas doorgeven",
    ondertitel: "Tik in het menu op Kas doorgeven. Bovenaan die pagina staat ook een knop Hulp. Die brengt je hier terug."
  },
  {
    id: "munt",
    titel: "Kies de munt",
    ondertitel: "Kies de munt waarin je telt. Meestal is dat de Surinaamse dollar, SRD."
  },
  {
    id: "ochtend",
    titel: "Stap 1. Vanochtend",
    ondertitel: "Vul in hoeveel er vanochtend in je kas lag. Weet je het niet? Sla dit over."
  },
  {
    id: "tegels",
    titel: "Stap 2. Tik wat je deed",
    ondertitel:
      "Tik op een grote knop, bijvoorbeeld Benzine, Uitprinten, Taxi of Eten. Zo weet de eigenaar waar het geld naartoe ging."
  },
  {
    id: "bedrag",
    titel: "Vul één bedrag in",
    ondertitel:
      "Vul alleen dit bedrag in. Een foto van de bon mag, hoeft niet. Heb je nog een apart bedrag? Tik Bedrag toevoegen of Nog een bedrag. Tel ze niet bij elkaar op."
  },
  {
    id: "lijst",
    titel: "Jouw dag tot nu toe",
    ondertitel:
      "Alles komt op je lijst. Je kunt de hele dag bijhouden zonder steeds te versturen. Tik Nu sturen alleen als je één regel alvast wilt doorgeven."
  },
  {
    id: "einde",
    titel: "Stap 4. Tel en stuur",
    ondertitel:
      "Tel hoeveel er nu nog in je kas ligt. Tik daarna op Dag doorgeven. Alles gaat in één keer naar de eigenaar. Klaar."
  }
];
