export type HelpSlide = {
  id: string;
  titel: string;
  ondertitel: string;
  kicker?: string;
  kop?: string;
  lead?: string;
  stappen?: string[];
  menu?: { items: string[]; actief: string };
  chips?: { items: string[]; actief?: string };
  nr?: string;
  vraag?: string;
  bedrag?: { waarde: string; valuta?: string };
  tegels?: string[];
  knoppen?: { secundair?: string; primair?: string };
  lijst?: { label: string; extra?: string }[];
  actie?: string;
  pijl?: string;
};

export type HelpVideoGids = {
  id: string;
  titel: string;
  slides: HelpSlide[];
};

export const HELP_VIDEOS: Record<string, HelpVideoGids> = {
  inloggen: {
    id: "inloggen",
    titel: "Inloggen",
    slides: [
      {
        id: "start",
        titel: "Inloggen",
        ondertitel: "Open het portaal in je browser. Je ziet het inlogscherm van La-Solución.",
        kicker: "La-Solución",
        kop: "Inloggen",
        lead: "E-mail en wachtwoord. Klaar."
      },
      {
        id: "invullen",
        titel: "Vul je gegevens in",
        ondertitel: "Vul je e-mailadres en wachtwoord in. Zet een vinkje bij E-mailadres onthouden als je de volgende keer sneller wilt binnenkomen.",
        vraag: "E-mail en wachtwoord",
        knoppen: { primair: "Inloggen" }
      },
      {
        id: "vergeten",
        titel: "Wachtwoord vergeten",
        ondertitel: "Wachtwoord vergeten? Gebruik de link op het inlogscherm. Je krijgt een herstelmail. Kijk ook in spam.",
        actie: "Wachtwoord vergeten?"
      },
      {
        id: "nieuw",
        titel: "Nieuw account",
        ondertitel: "Nog geen account? Klik op Registreren, vul je gegevens in en wacht tot de eigenaar je goedkeurt.",
        knoppen: { secundair: "Registreren", primair: "Inloggen" }
      }
    ]
  },
  opdracht: {
    id: "opdracht",
    titel: "Opdracht aanmaken",
    slides: [
      {
        id: "start",
        titel: "Nieuwe opdracht",
        ondertitel: "Als eigenaar maak je een opdracht aan via Beheer, Nieuwe opdracht, of via de knop op Home.",
        kicker: "Beheer",
        kop: "Nieuwe opdracht",
        actie: "+ Nieuwe opdracht"
      },
      {
        id: "bord",
        titel: "Of via het bord",
        ondertitel: "Op het opdrachtenbord kun je ook kiezen: Voeg nieuwe opdracht toe.",
        menu: { items: ["Home", "Opdrachtenbord", "Kalender"], actief: "Opdrachtenbord" },
        pijl: "← Tik hier"
      },
      {
        id: "velden",
        titel: "Vul de opdracht in",
        ondertitel: "Klantnaam en omschrijving zijn verplicht. Kies een categorie, zoals Visa of Vergunning, en een prioriteit: P1, P2 of P3.",
        vraag: "Klant + omschrijving",
        chips: { items: ["P1", "P2", "P3"], actief: "P1" }
      },
      {
        id: "opslaan",
        titel: "Opslaan",
        ondertitel: "Wijs optioneel een medewerker toe en stel een deadline in. Klik op Opslaan. De opdracht staat daarna in de kolom Nieuw.",
        knoppen: { primair: "Opslaan" }
      }
    ]
  },
  prioriteiten: {
    id: "prioriteiten",
    titel: "Prioriteiten",
    slides: [
      {
        id: "start",
        titel: "Drie prioriteiten",
        ondertitel: "Elke opdracht heeft P1, P2 of P3. Zo ziet iedereen wat eerst moet.",
        kicker: "Opdrachten",
        kop: "Prioriteit",
        chips: { items: ["P1 Hoog", "P2 Normaal", "P3 Laag"], actief: "P1 Hoog" }
      },
      {
        id: "p1",
        titel: "P1 is urgent",
        ondertitel: "P1 is hoog: het moet snel. Die opdrachten zie je ook op Home en bij Meldingen. Gebruik P1 alleen voor urgente zaken.",
        nr: "P1",
        vraag: "Hoog — moet snel"
      },
      {
        id: "p2p3",
        titel: "P2 en P3",
        ondertitel: "P2 is normaal, de standaard werkdruk. P3 is laag en kan wachten tot er ruimte is.",
        chips: { items: ["P2 Normaal", "P3 Laag"], actief: "P2 Normaal" }
      },
      {
        id: "aanpassen",
        titel: "Later aanpassen",
        ondertitel: "Open een opdracht om de prioriteit te wijzigen. Op het bord kun je sorteren op prioriteit, zodat het belangrijkste bovenaan staat.",
        actie: "Open de opdrachtkaart"
      }
    ]
  },
  bewerken: {
    id: "bewerken",
    titel: "Opdracht bewerken",
    slides: [
      {
        id: "start",
        titel: "Open de kaart",
        ondertitel: "Klik op een kaart op het opdrachtenbord. Het detailvenster gaat open.",
        vraag: "Opdrachtenbord",
        lijst: [
          { label: "Visa — Perez", extra: "Nieuw" },
          { label: "Vergunning — Gomez", extra: "In behandeling" }
        ]
      },
      {
        id: "velden",
        titel: "Pas aan wat nodig is",
        ondertitel: "Je kunt klant, omschrijving, notities, behandelaar en deadline aanpassen. Bij Taak toegewezen aan kies je iedereen met een login, ook de eigenaar.",
        vraag: "Taak toegewezen aan",
        chips: { items: ["Natasha", "Vanessa"], actief: "Natasha" }
      },
      {
        id: "status",
        titel: "Status wijzigen",
        ondertitel: "De eigenaar zet een opdracht op Ingediend of Afgerond. Dat vak blijft groen zolang die status geldt, ook bij bewerken.",
        stappen: ["Nieuw", "In behandeling", "Ingediend", "Afgerond"]
      },
      {
        id: "opslaan",
        titel: "Bewaar de wijziging",
        ondertitel: "Klik op Opslaan of op Sluiten. Wijzigingen worden bewaard.",
        knoppen: { secundair: "Sluiten", primair: "Opslaan" }
      }
    ]
  },
  documenten: {
    id: "documenten",
    titel: "Documenten uploaden",
    slides: [
      {
        id: "start",
        titel: "Open de opdracht",
        ondertitel: "Open een opdracht die aan jou is toegewezen. De eigenaar mag bij elke opdracht.",
        kicker: "Opdracht",
        kop: "Documenten",
        lead: "PDF, foto of Word"
      },
      {
        id: "toevoegen",
        titel: "Bestanden kiezen",
        ondertitel: "Scroll naar Documenten toevoegen. Sleep de bestanden in het vak, of tik op Bestand kiezen. PDF, foto of Word mag.",
        actie: "Documenten toevoegen"
      },
      {
        id: "opslaan",
        titel: "Opslaan",
        ondertitel: "Klik op Opslaan. De bestanden horen nu bij de opdracht.",
        knoppen: { primair: "Opslaan" }
      },
      {
        id: "bekijken",
        titel: "Bekijken",
        ondertitel: "Klik op Bekijken. Foto’s blijven in de app. PDF’s openen in Chrome. De eigenaar ziet alle bijlagen ook onder Documenten in het menu.",
        knoppen: { secundair: "Bekijken", primair: "Opslaan" }
      }
    ]
  },
  prullenbak: {
    id: "prullenbak",
    titel: "Verwijderen en prullenbak",
    slides: [
      {
        id: "start",
        titel: "Alleen de eigenaar verwijdert",
        ondertitel: "Open de opdracht en kies Verwijderen. Dat mag alleen de eigenaar.",
        vraag: "Opdracht",
        knoppen: { secundair: "Verwijderen" }
      },
      {
        id: "bak",
        titel: "Niet meteen weg",
        ondertitel: "De opdracht gaat naar de prullenbak. Hij is niet direct permanent weg.",
        menu: { items: ["Documenten", "Prullenbak", "Export"], actief: "Prullenbak" },
        pijl: "← Hier komt hij terecht"
      },
      {
        id: "herstel",
        titel: "Herstellen",
        ondertitel: "Ga naar Beheer, Prullenbak. Daar kun je een opdracht herstellen als je je bedenkt.",
        actie: "Herstellen"
      },
      {
        id: "dagen",
        titel: "Na 30 dagen",
        ondertitel: "Na 30 dagen worden opdrachten en bijlagen permanent verwijderd. Twijfel je? Herstel liever eerst.",
        nr: "30",
        vraag: "dagen in de prullenbak"
      }
    ]
  },
  statistieken: {
    id: "statistieken",
    titel: "Statistieken",
    slides: [
      {
        id: "start",
        titel: "Alleen voor de eigenaar",
        ondertitel: "Ga in het menu naar Statistieken. Daar zie je de werkdruk van het team.",
        menu: { items: ["Home", "Statistieken", "Klanten"], actief: "Statistieken" }
      },
      {
        id: "druk",
        titel: "Werkdruk",
        ondertitel: "Bekijk hoeveel opdrachten open zijn, afgerond, en per status.",
        lijst: [
          { label: "Open", extra: "12" },
          { label: "Afgerond", extra: "40" }
        ]
      },
      {
        id: "deadlines",
        titel: "Deadlines",
        ondertitel: "Controleer wat deze week of deze maand afloopt, zodat niets wordt vergeten.",
        vraag: "Deze week",
        chips: { items: ["Week", "Maand"], actief: "Week" }
      },
      {
        id: "team",
        titel: "Teamverdeling",
        ondertitel: "Zie welke medewerker hoeveel opdrachten heeft. Gebruik de trends per maand voor planning.",
        lijst: [
          { label: "Natasha", extra: "8" },
          { label: "Vanessa", extra: "5" }
        ]
      }
    ]
  },
  "kas-doorgeven": {
    id: "kas-doorgeven",
    titel: "Kas doorgeven",
    slides: [
      {
        id: "start",
        titel: "Kas doorgeven",
        ondertitel:
          "Elke dag geef je door wat er met het geld in je kas is gebeurd. Je hoeft geen boekhouding te kennen. Tik wat je deed, vul het bedrag in, en stuur de dag door.",
        kicker: "La-Solución",
        kop: "Kas doorgeven",
        lead: "Elke dag, in vier stappen",
        stappen: ["Vanochtend", "Tik wat je deed", "Je lijst", "Tel en stuur"]
      },
      {
        id: "menu",
        titel: "Open Kas doorgeven",
        ondertitel: "Tik in het menu op Kas doorgeven. Bovenaan die pagina staat ook een knop Hulp. Die brengt je hier terug.",
        menu: { items: ["Home", "Opdrachtenbord", "Kas doorgeven", "Help"], actief: "Kas doorgeven" },
        pijl: "← Tik hier"
      },
      {
        id: "munt",
        titel: "Kies de munt",
        ondertitel: "Kies de munt waarin je telt. Meestal is dat de Surinaamse dollar, SRD.",
        vraag: "In welke munt tel je vandaag?",
        chips: { items: ["SRD", "USD", "EUR"], actief: "SRD" }
      },
      {
        id: "ochtend",
        titel: "Stap 1. Vanochtend",
        ondertitel: "Vul in hoeveel er vanochtend in je kas lag. Weet je het niet? Sla dit over.",
        nr: "1",
        vraag: "Hoeveel lag er vanochtend in je kas?",
        bedrag: { waarde: "500", valuta: "SRD" }
      },
      {
        id: "tegels",
        titel: "Stap 2. Tik wat je deed",
        ondertitel:
          "Tik op een grote knop, bijvoorbeeld Benzine, Uitprinten, Taxi of Eten. Zo weet de eigenaar waar het geld naartoe ging.",
        nr: "2",
        tegels: ["⛽ Benzine", "🖨 Uitprinten", "🚕 Taxi", "🍽 Eten"]
      },
      {
        id: "bedrag",
        titel: "Vul één bedrag in",
        ondertitel:
          "Vul alleen dit bedrag in. Een foto van de bon mag, hoeft niet. Heb je nog een apart bedrag? Tik Bedrag toevoegen of Nog een bedrag. Tel ze niet bij elkaar op.",
        vraag: "⛽ Benzine",
        bedrag: { waarde: "80", valuta: "SRD" },
        knoppen: { secundair: "Nog een bedrag", primair: "Bedrag toevoegen" }
      },
      {
        id: "lijst",
        titel: "Jouw dag tot nu toe",
        ondertitel:
          "Alles komt op je lijst. Je kunt de hele dag bijhouden zonder steeds te versturen. Tik Nu sturen alleen als je één regel alvast wilt doorgeven.",
        vraag: "Jouw dag tot nu toe",
        lijst: [
          { label: "⛽ Benzine", extra: "80 SRD" },
          { label: "🖨 Uitprinten", extra: "45 SRD" }
        ]
      },
      {
        id: "einde",
        titel: "Stap 4. Tel en stuur",
        ondertitel:
          "Tel hoeveel er nu nog in je kas ligt. Tik daarna op Dag doorgeven. Alles gaat in één keer naar de eigenaar. Klaar.",
        nr: "4",
        vraag: "Hoeveel ligt er nu nog?",
        bedrag: { waarde: "375", valuta: "SRD" },
        actie: "Dag doorgeven"
      }
    ]
  },
  financieel: {
    id: "financieel",
    titel: "Financiën",
    slides: [
      {
        id: "start",
        titel: "Alleen de eigenaar",
        ondertitel: "Financiën staat in het menu, alleen voor de eigenaar. Daar beheer je kas, inkomsten en uitgaven.",
        menu: { items: ["Team", "Financiën", "Prullenbak"], actief: "Financiën" }
      },
      {
        id: "periode",
        titel: "Periode en munt",
        ondertitel: "Kies bovenaan de periode en de valuta: SRD, USD, EUR, en meer.",
        chips: { items: ["SRD", "USD", "EUR"], actief: "SRD" }
      },
      {
        id: "tabs",
        titel: "Overzicht en Follow the money",
        ondertitel: "Overzicht toont dagcijfers. Follow the money toont kas per dag, per medewerker, en het totaal in kas.",
        tegels: ["Overzicht", "Follow the money", "Inzendingen", "Dagboek"]
      },
      {
        id: "post",
        titel: "Nieuwe post",
        ondertitel: "Registreer inkomst, uitgave, kasgeld, gepind, overdracht of openingskas. Gepind is contant uit de pin en telt mee in de kas. Openingskas is de telling van vanochtend en vervangt het restant van gisteren.",
        actie: "Nieuwe post"
      },
      {
        id: "inzendingen",
        titel: "Inzendingen van het team",
        ondertitel: "Bij Inzendingen open je wat medewerkers via Kas doorgeven hebben gestuurd, en neem je dat over in het dagboek. Muntenbak telt niet mee in totaal in kas.",
        vraag: "Inzendingen",
        lijst: [
          { label: "Benzine — Natasha", extra: "Nieuw" },
          { label: "Eindtelling kas", extra: "Nieuw" }
        ]
      }
    ]
  },
  "bestand-toevoegen": {
    id: "bestand-toevoegen",
    titel: "Bestand toevoegen bij opdracht",
    slides: [
      {
        id: "start",
        titel: "Bestand bij de opdracht",
        ondertitel:
          "Een paspoort, formulier of foto hoort bij de opdracht zelf. Open eerst de opdracht, en voeg het bestand daar toe.",
        kicker: "Opdracht",
        kop: "Bestand toevoegen",
        lead: "PDF, foto of Word"
      },
      {
        id: "openen",
        titel: "Open de opdracht",
        ondertitel:
          "Ga naar Opdrachtenbord of Mijn opdrachten. Tik op de kaart van de klant. Het detailvenster gaat open.",
        menu: { items: ["Home", "Opdrachtenbord", "Mijn opdrachten"], actief: "Mijn opdrachten" },
        pijl: "← Open de kaart"
      },
      {
        id: "kiezen",
        titel: "Kies het bestand",
        ondertitel:
          "Scroll naar Documenten toevoegen. Sleep de bestanden in het vak, of tik op Bestand kiezen. PDF, foto of Word mag.",
        vraag: "Documenten toevoegen",
        knoppen: { primair: "Bestand kiezen" }
      },
      {
        id: "opslaan",
        titel: "Opslaan",
        ondertitel:
          "Het bestand staat klaar bij de opdracht. Pas de naam aan als dat helpt. Tik daarna op Opslaan. Pas dan is het gekoppeld.",
        lijst: [{ label: "paspoort-perez.pdf", extra: "Nieuw" }],
        knoppen: { primair: "Opslaan" }
      },
      {
        id: "bekijken",
        titel: "Bekijken",
        ondertitel:
          "Tik op Bekijken. Foto’s blijven in de app. PDF’s openen in Chrome. Verwijderen mag ook, als het verkeerde bestand is.",
        knoppen: { secundair: "Bekijken", primair: "Opslaan" }
      }
    ]
  }
};

export const HELP_VIDEO_VOLGORDE = [
  "inloggen",
  "opdracht",
  "prioriteiten",
  "bewerken",
  "documenten",
  "prullenbak",
  "statistieken",
  "kas-doorgeven",
  "bestand-toevoegen",
  "financieel"
] as const;
