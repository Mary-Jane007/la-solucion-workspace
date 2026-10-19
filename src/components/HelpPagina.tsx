import { useEffect } from "react";
import { HelpStappenVideo } from "./HelpStappenVideo";
import { HELP_VIDEOS } from "../helpVideos";

type HelpStap = {
  id: string;
  titel: string;
  stappen: string[];
  tip?: string;
  videoId?: keyof typeof HELP_VIDEOS;
};

const HELP_ONDERWERPEN: HelpStap[] = [
  {
    id: "inloggen",
    videoId: "inloggen",
    titel: "Inloggen",
    stappen: [
      "Open het portaal in je browser en ga naar het inlogscherm.",
      "Vul je e-mailadres en wachtwoord in.",
      "Klik op Inloggen. Bij “E-mailadres onthouden” hoef je je e-mail de volgende keer niet opnieuw in te typen.",
      "Wachtwoord vergeten? Gebruik de link op het inlogscherm; je ontvangt een herstelmail (controleer ook spam).",
      "Nieuw account? Klik op Registreren, vul je gegevens in en wacht op goedkeuring door de eigenaar indien nodig."
    ],
    tip: "Werkt inloggen niet? Controleer of de backend draait (lokaal: npm run dev). Zie de rode melding op het inlogscherm."
  },
  {
    id: "opdracht",
    videoId: "opdracht",
    titel: "Opdracht aanmaken",
    stappen: [
      "Ga als eigenaar naar Beheer → Nieuwe opdracht, of klik op het dashboard op Nieuwe opdracht.",
      "Alternatief: op het opdrachtenbord kies je Voeg nieuwe opdracht toe.",
      "Vul klantnaam en omschrijving in (verplicht).",
      "Kies categorie (bijv. Visa, Vergunning) en prioriteit P1, P2 of P3.",
      "Wijs optioneel een medewerker toe en stel een deadline in.",
      "Klik op Opslaan. De opdracht verschijnt in de kolom Nieuw op het opdrachtenbord."
    ],
    tip: "P1-opdrachten verschijnen ook op Home en bij Meldingen — gebruik P1 alleen voor urgente zaken."
  },
  {
    id: "prioriteiten",
    videoId: "prioriteiten",
    titel: "Prioriteiten",
    stappen: [
      "P1 — Hoog: urgent, moet snel. Verschijnt op Home en bij Meldingen.",
      "P2 — Normaal: standaard werkdruk.",
      "P3 — Laag: kan wachten tot er ruimte is.",
      "Open een opdracht om de prioriteit later aan te passen in het detailvenster.",
      "Sorteer op het opdrachtenbord op prioriteit om te zien wat het eerst aandacht vraagt."
    ]
  },
  {
    id: "bewerken",
    videoId: "bewerken",
    titel: "Opdracht bewerken & status",
    stappen: [
      "Klik op een kaart op het opdrachtenbord om het detailvenster te openen.",
      "Pas klant, omschrijving, notities, behandelaar of deadline aan. Bij Taak toegewezen aan kies je iedereen met een login, inclusief de eigenaar.",
      "Wijzig status: Nieuw → In behandeling → Afgerond (sleep kaarten of kies status in het venster).",
      "Sla wijzigingen op met Opslaan of Sluiten (wijzigingen worden bewaard)."
    ]
  },
  {
    id: "documenten",
    videoId: "documenten",
    titel: "Documenten uploaden",
    stappen: [
      "Open een toegewezen opdracht (eigenaar: elke opdracht).",
      "Scroll in het detailvenster naar Documenten toevoegen.",
      "Sleep de bestanden in het vak, of tik op Bestand kiezen (PDF, foto, Word, enz.).",
      "Klik op Opslaan om de bestanden te koppelen.",
      "Klik op Bekijken: foto’s blijven in de viewer. PDF’s openen in Chrome.",
      "Alle bijlagen van opdrachten vind je ook terug onder Documenten in het menu (eigenaar)."
    ],
    tip: "Iedereen met een login kan bestanden toevoegen aan opdrachten die aan hen zijn toegewezen. De eigenaar kan dat bij alle opdrachten."
  },
  {
    id: "prullenbak",
    videoId: "prullenbak",
    titel: "Verwijderen & prullenbak",
    stappen: [
      "Open de opdracht en kies Verwijderen (alleen eigenaar).",
      "De opdracht gaat naar de prullenbak — niet direct permanent weg.",
      "Ga naar Beheer → Prullenbak om verwijderde opdrachten te bekijken.",
      "Herstel een opdracht via Herstellen, of wacht tot automatische opruiming na 30 dagen.",
      "Na 30 dagen worden opdrachten en bijlagen permanent verwijderd."
    ],
    tip: "Twijfel je? Herstel liever eerst uit de prullenbak in plaats van opnieuw alles in te voeren."
  },
  {
    id: "statistieken",
    videoId: "statistieken",
    titel: "Statistieken",
    stappen: [
      "Ga in het menu naar Statistieken (eigenaar).",
      "Bekijk werkdruk: hoeveel opdrachten open, afgerond, en per status.",
      "Controleer deadlines en wat deze week of maand afloopt.",
      "Zie teamverdeling: welke medewerker hoeveel opdrachten heeft.",
      "Gebruik trends per maand voor planning en gesprekken met het team."
    ]
  },
  {
    id: "kas-doorgeven",
    videoId: "kas-doorgeven",
    titel: "Kas doorgeven (medewerkers)",
    stappen: [
      "Bekijk eerst de video hierboven. Ondertitels staan altijd aan; zet geluid aan voor gesproken uitleg.",
      "Kies Kas doorgeven in het menu. Bovenaan die pagina staat een knop Hulp — die brengt je hier terug.",
      "Kies de munt waarin je telt (meestal SRD).",
      "Stap 1: vul in hoeveel er vanochtend in je kas lag. Weet je het niet? Sla over.",
      "Stap 2: tik op een grote knop (Benzine, Uitprinten, Taxi, Eten, of wat jullie vaak doen). Vul het bedrag in. Foto van de bon mag.",
      "Elk apart bedrag is een eigen regel. Tik Bedrag toevoegen of Nog een bedrag als je nog iets hebt.",
      "De regels komen op “Jouw dag tot nu toe”. Zo kun je de hele dag bijhouden zonder steeds te versturen.",
      "Vergeten wat je gisteren doorgaf? Tik op Zelfde als gisteren en vul de nieuwe bedragen in.",
      "Wil je één regel alvast sturen? Tik bij die regel op Nu sturen. Anders wacht je tot het eind.",
      "Stap 4: tel hoeveel er nu nog in kas ligt.",
      "Tik op Dag doorgeven. Alles op de lijst plus de kas-telling gaat in één keer naar de eigenaar.",
      "De eigenaar ziet het bij Financiën → Inzendingen en maakt daar de boekhouding af."
    ],
    tip: "Je hoeft geen boekhoudwoorden in te vullen. Tik wat je deed, vul het bedrag in, stuur de dag door."
  },
  {
    id: "bestand-toevoegen",
    videoId: "bestand-toevoegen",
    titel: "Bestand toevoegen bij opdracht",
    stappen: [
      "Bekijk eerst de video hierboven. Ondertitels staan altijd aan; zet geluid aan voor gesproken uitleg.",
      "Ga naar Opdrachtenbord of Mijn opdrachten en tik op de kaart van de klant.",
      "Scroll in het detailvenster naar Documenten toevoegen.",
      "Sleep de bestanden in het vak, of tik op Bestand kiezen. PDF, foto of Word mag.",
      "Pas de bestandsnaam aan als dat duidelijker is. Tik Verwijderen als het het verkeerde bestand is.",
      "Tik op Opslaan. Pas dan is het bestand gekoppeld aan de opdracht.",
      "Tik op Bekijken: foto’s blijven in de app. PDF’s openen in Chrome.",
      "Heb je de opdracht nog niet opgeslagen? Het bestand wordt gekoppeld zodra je Opslaan tikt."
    ],
    tip: "Iedereen met een login kan bestanden toevoegen aan een opdracht die aan hen is toegewezen. De eigenaar kan dat bij alle opdrachten."
  },
  {
    id: "financieel",
    videoId: "financieel",
    titel: "Financiën (eigenaar)",
    stappen: [
      "Ga naar Financiën in het menu (alleen zichtbaar voor de eigenaar).",
      "Kies bovenaan Periode en Valuta (SRD, USD, EUR, …).",
      "Overzicht: dagcijfers en KPI’s. Follow the money: kas per dag, per medewerker, totaal in kas.",
      "Nieuwe post: registreer inkomst, uitgave, kasgeld, overdracht of openingskas. Openingskas is de telling van vanochtend en vervangt het restant van gisteren.",
      "Bij Inzendingen: open meldingen van medewerkers en neem ze over in het dagboek."
    ],
    tip: "Totaal in kas is het contante geld bij medewerkers, zonder muntenbak. Geld dat naar de muntenbak is verhuisd, zie je alleen bij Muntenbak."
  }
];

function HelpOnderwerp({ id, titel, stappen, tip, videoId }: HelpStap) {
  const gids = videoId ? HELP_VIDEOS[videoId] : undefined;
  return (
    <section id={`help-${id}`} className="card page-card help-section">
      <h2>{titel}</h2>
      {gids && <HelpStappenVideo gids={gids} ingebouwd />}
      <ol className="help-steps">
        {stappen.map((stap) => (
          <li key={stap}>{stap}</li>
        ))}
      </ol>
      {tip && (
        <p className="help-tip">
          <strong>Tip:</strong> {tip}
        </p>
      )}
    </section>
  );
}

export function HelpPagina({ isEigenaar: _isEigenaar }: { isEigenaar: boolean }) {
  useEffect(() => {
    try {
      const focus = sessionStorage.getItem("la-solucion-help-focus");
      if (focus) {
        sessionStorage.removeItem("la-solucion-help-focus");
        window.setTimeout(() => {
          document.getElementById(`help-${focus}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 80);
      }
    } catch {
      /* privémodus */
    }
  }, []);

  return (
    <div className="info-stack help-page">
      <section className="card page-card help-section">
        <h2>Uitlegvideo’s</h2>
        <p className="muted">
          Elk onderwerp hieronder heeft een korte video met stappen. Tik op Afspelen. Ondertitels
          blijven altijd zichtbaar. Zet Geluid aan voor gesproken Nederlands. Als je een andere
          video start, stopt de vorige vanzelf.
        </p>
      </section>
      {HELP_ONDERWERPEN.map((onderwerp) => (
        <HelpOnderwerp key={onderwerp.id} {...onderwerp} />
      ))}
    </div>
  );
}
