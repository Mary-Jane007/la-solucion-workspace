import { APP_UITLEG_VIDEO_URL, parseHelpVideoUrl } from "../helpConfig";

type HelpStap = {
  titel: string;
  stappen: string[];
  tip?: string;
};

const HELP_ONDERWERPEN: HelpStap[] = [
  {
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
    titel: "Opdracht bewerken & status",
    stappen: [
      "Klik op een kaart op het opdrachtenbord om het detailvenster te openen.",
      "Pas klant, omschrijving, notities, behandelaar of deadline aan.",
      "Wijzig status: Nieuw → In behandeling → Afgerond (sleep kaarten of kies status in het venster).",
      "Sla wijzigingen op met Opslaan of Sluiten (wijzigingen worden bewaard)."
    ]
  },
  {
    titel: "Documenten uploaden",
    stappen: [
      "Open de opdracht via het opdrachtenbord.",
      "Scroll in het detailvenster naar het uploadveld voor documenten.",
      "Kies een of meerdere bestanden (PDF, foto, Word, enz.).",
      "Wacht tot de upload klaar is; de bestandsnaam verschijnt in de lijst.",
      "Alle bijlagen van opdrachten vind je ook terug onder Documenten in het menu."
    ],
    tip: "Gebruik duidelijke bestandsnamen (bijv. paspoort-klantnaam.pdf) zodat je later sneller vindt wat je zoekt."
  },
  {
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
    titel: "Kas doorgeven (medewerkers)",
    stappen: [
      "Log in als medewerker.",
      "Kies Kas doorgeven in het menu (niet Financiën — dat is alleen voor de eigenaar).",
      "Vul bedrag, valuta, omschrijving en bij wie het geld ligt in.",
      "Voeg optioneel foto’s toe (bon, kas, betalingsbewijs).",
      "Klik op Versturen. De eigenaar krijgt een melding op Home, bij Meldingen en bij Financiën.",
      "De eigenaar verwerkt de inzending in Financiën → Inzendingen."
    ],
    tip: "Stuur kas op de dag zelf door — zo blijft Follow the money en het dagverslag kloppen."
  },
  {
    titel: "Financiën (eigenaar)",
    stappen: [
      "Ga naar Financiën in het menu (alleen zichtbaar voor de eigenaar).",
      "Kies bovenaan Periode en Valuta (SRD, USD, EUR, …).",
      "Overzicht: dagcijfers en KPI’s. Follow the money: kas per dag, per medewerker, totaal in kas.",
      "Nieuwe post: registreer inkomst, uitgave, kasgeld, overdracht of openingskas.",
      "Bij Inzendingen: open meldingen van medewerkers en neem ze over in het dagboek."
    ],
    tip: "Totaal in kas (alle medewerkers) staat in Follow the money — dat is het contante totaal einde van de gekozen dag."
  }
];

function HelpVideoBlok() {
  const embed = parseHelpVideoUrl(APP_UITLEG_VIDEO_URL);

  return (
    <section className="card page-card help-video-section">
      <div className="section-header">
        <h2>Video: rondleiding door de app</h2>
        <p className="muted">
          Bekijk eerst deze uitlegvideo. Daarna vind je hieronder per onderwerp de stappen op een rij.
        </p>
      </div>

      {embed ? (
        <div className="help-video-frame">
          {embed.kind === "file" ? (
            <video className="help-video-native" controls preload="metadata" src={embed.src}>
              Je browser ondersteunt deze video niet.{" "}
              <a href={embed.src} target="_blank" rel="noreferrer">
                Open de video in een nieuw tabblad
              </a>
              .
            </video>
          ) : (
            <iframe
              className="help-video-embed"
              src={embed.src}
              title="App-uitlegvideo"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          )}
        </div>
      ) : (
        <div className="help-video-placeholder" aria-label="Plaats voor uitlegvideo">
          <p>
            <strong>Uitlegvideo</strong>
          </p>
          <p className="muted">
            Hier komt de video waarin de app wordt uitgelegd. Zodra de link is ingesteld, verschijnt de
            speler automatisch op deze plek.
          </p>
          <p className="help-video-config muted">
            Eigenaar/beheerder: zet de videolink in <code>src/helpConfig.ts</code> (veld{" "}
            <code>CONFIG_URL</code>) of als <code>VITE_APP_UITLEG_VIDEO_URL</code> in je <code>.env</code>.
            YouTube-, Vimeo- en directe mp4-links werken.
          </p>
        </div>
      )}
    </section>
  );
}

function HelpOnderwerp({ titel, stappen, tip }: HelpStap) {
  return (
    <section className="card page-card help-section">
      <h2>{titel}</h2>
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

export function HelpPagina() {
  return (
    <div className="info-stack help-page">
      <HelpVideoBlok />
      {HELP_ONDERWERPEN.map((onderwerp) => (
        <HelpOnderwerp key={onderwerp.titel} {...onderwerp} />
      ))}
    </div>
  );
}
