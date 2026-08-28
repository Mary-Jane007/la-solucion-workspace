import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  deleteHelpVideo,
  fetchHelpVideo,
  helpVideoStreamUrl,
  saveHelpVideoUrl,
  uploadHelpVideoFile
} from "../api";
import {
  HELP_VIDEO_ACCEPT,
  HELP_VIDEO_MAX_MB,
  HelpVideoInfo,
  helpVideoEmbed
} from "../helpConfig";

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

function HelpVideoBlok({
  isEigenaar,
  video,
  inputUrl,
  gekozenBestand,
  laden,
  bezig,
  fout,
  succes,
  onInputChange,
  onBestandChange,
  onOpslaanLink,
  onUploadBestand,
  onVerwijderen
}: {
  isEigenaar: boolean;
  video: HelpVideoInfo | null;
  inputUrl: string;
  gekozenBestand: File | null;
  laden: boolean;
  bezig: boolean;
  fout: string | null;
  succes: string | null;
  onInputChange: (url: string) => void;
  onBestandChange: (file: File | null) => void;
  onOpslaanLink: (e: FormEvent) => void;
  onUploadBestand: () => void;
  onVerwijderen: () => void;
}) {
  const streamUrl = useMemo(() => helpVideoStreamUrl(), [video?.source]);
  const embed = helpVideoEmbed(video, streamUrl);
  const linkOngeldig = Boolean(inputUrl.trim()) && !helpVideoEmbed(
    { source: "link", playbackUrl: inputUrl.trim() },
    streamUrl
  );
  const bestandTeGroot =
    gekozenBestand && gekozenBestand.size > HELP_VIDEO_MAX_MB * 1024 * 1024;

  return (
    <section className="card page-card help-video-section">
      <div className="section-header">
        <h2>Video: rondleiding door de app</h2>
        <p className="muted">
          Bekijk eerst deze uitlegvideo. Daarna vind je hieronder per onderwerp de stappen op een rij.
        </p>
      </div>

      {isEigenaar && (
        <div className="help-video-beheer">
          <div className="help-video-beheer-blok">
            <h3>Videobestand uploaden</h3>
            <p className="muted">Mp4, webm of mov — max. {HELP_VIDEO_MAX_MB} MB.</p>
            <label className="form-label">
              Kies bestand
              <input
                type="file"
                className="form-input"
                accept={HELP_VIDEO_ACCEPT}
                disabled={bezig || laden}
                onChange={(e) => onBestandChange(e.target.files?.[0] || null)}
              />
            </label>
            {gekozenBestand && (
              <p className="muted">
                Geselecteerd: <strong>{gekozenBestand.name}</strong> (
                {(gekozenBestand.size / (1024 * 1024)).toFixed(1)} MB)
              </p>
            )}
            {bestandTeGroot && (
              <p className="login-hint login-error">
                Bestand is te groot. Maximum is {HELP_VIDEO_MAX_MB} MB.
              </p>
            )}
            <button
              type="button"
              className="btn-primary"
              disabled={bezig || laden || !gekozenBestand || bestandTeGroot}
              onClick={onUploadBestand}
            >
              {bezig ? "Bezig met uploaden..." : "Videobestand uploaden"}
            </button>
          </div>

          <p className="help-video-of" aria-hidden="true">
            of
          </p>

          <form className="help-video-beheer-blok" onSubmit={onOpslaanLink}>
            <h3>Videolink plakken</h3>
            <p className="muted">YouTube, Vimeo of een directe mp4-link.</p>
            <label className="form-label">
              Link
              <input
                type="url"
                className="form-input"
                value={inputUrl}
                onChange={(e) => onInputChange(e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                disabled={bezig || laden}
              />
            </label>
            {linkOngeldig && (
              <p className="login-hint login-error">
                Deze link wordt niet herkend. Gebruik YouTube, Vimeo of een directe mp4/webm-link.
              </p>
            )}
            <button
              type="submit"
              className="btn-secondary"
              disabled={bezig || laden || linkOngeldig || !inputUrl.trim()}
            >
              {bezig ? "Bezig..." : "Link opslaan"}
            </button>
          </form>

          <div className="help-video-actions">
            {video && (
              <button type="button" className="btn-secondary" disabled={bezig || laden} onClick={onVerwijderen}>
                Video verwijderen
              </button>
            )}
          </div>
          {fout && <p className="login-hint login-error">{fout}</p>}
          {succes && <p className="login-hint login-success">{succes}</p>}
          <p className="muted help-video-beheer-hint">
            Upload een bestand of plak een link. Een nieuwe upload of link vervangt de vorige video.
            Medewerkers zien alleen de afgespeelde video.
          </p>
        </div>
      )}

      {laden ? (
        <p className="muted">Video laden...</p>
      ) : embed ? (
        <div className="help-video-frame">
          {video?.source === "file" && video.originalName && (
            <p className="muted help-video-bestandsnaam">{video.originalName}</p>
          )}
          {embed.kind === "file" ? (
            <video className="help-video-native" controls preload="metadata" src={embed.src}>
              Je browser ondersteunt deze video niet.
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
        <div className="help-video-placeholder" aria-label="Geen uitlegvideo">
          <p>
            <strong>Nog geen uitlegvideo</strong>
          </p>
          <p className="muted">
            {isEigenaar
              ? "Upload hierboven een videobestand of plak een link. Daarna verschijnt de speler op deze plek voor iedereen."
              : "De eigenaar kan een uitlegvideo toevoegen. Zodra die is geplaatst, zie je hem hier."}
          </p>
        </div>
      )}
    </section>
  );
}

export function HelpPagina({ isEigenaar }: { isEigenaar: boolean }) {
  const [video, setVideo] = useState<HelpVideoInfo | null>(null);
  const [inputUrl, setInputUrl] = useState("");
  const [gekozenBestand, setGekozenBestand] = useState<File | null>(null);
  const [laden, setLaden] = useState(true);
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const info = await fetchHelpVideo();
        if (!cancelled) {
          setVideo(info);
          setInputUrl(info?.source === "link" ? info.playbackUrl : "");
        }
      } catch (err) {
        if (!cancelled) {
          setFout(err instanceof Error ? err.message : "Kon uitlegvideo niet laden.");
        }
      } finally {
        if (!cancelled) setLaden(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleOpslaanLink = async (e: FormEvent) => {
    e.preventDefault();
    setFout(null);
    setSucces(null);
    try {
      setBezig(true);
      const saved = await saveHelpVideoUrl(inputUrl.trim());
      setVideo(saved);
      setGekozenBestand(null);
      setSucces("Videolink opgeslagen. Medewerkers zien hem nu op Help.");
    } catch (err) {
      setFout(err instanceof Error ? err.message : "Opslaan mislukt.");
    } finally {
      setBezig(false);
    }
  };

  const handleUploadBestand = async () => {
    if (!gekozenBestand) return;
    setFout(null);
    setSucces(null);
    try {
      setBezig(true);
      const saved = await uploadHelpVideoFile(gekozenBestand);
      setVideo(saved);
      setInputUrl("");
      setGekozenBestand(null);
      setSucces("Videobestand geüpload. Medewerkers kunnen het nu afspelen op Help.");
    } catch (err) {
      setFout(err instanceof Error ? err.message : "Upload mislukt.");
    } finally {
      setBezig(false);
    }
  };

  const handleVerwijderen = async () => {
    if (!window.confirm("Weet je zeker dat je de uitlegvideo wilt verwijderen?")) return;
    setFout(null);
    setSucces(null);
    try {
      setBezig(true);
      await deleteHelpVideo();
      setVideo(null);
      setInputUrl("");
      setGekozenBestand(null);
      setSucces("Uitlegvideo verwijderd.");
    } catch (err) {
      setFout(err instanceof Error ? err.message : "Verwijderen mislukt.");
    } finally {
      setBezig(false);
    }
  };

  return (
    <div className="info-stack help-page">
      <HelpVideoBlok
        isEigenaar={isEigenaar}
        video={video}
        inputUrl={inputUrl}
        gekozenBestand={gekozenBestand}
        laden={laden}
        bezig={bezig}
        fout={fout}
        succes={succes}
        onInputChange={setInputUrl}
        onBestandChange={setGekozenBestand}
        onOpslaanLink={handleOpslaanLink}
        onUploadBestand={handleUploadBestand}
        onVerwijderen={handleVerwijderen}
      />
      {HELP_ONDERWERPEN.map((onderwerp) => (
        <HelpOnderwerp key={onderwerp.titel} {...onderwerp} />
      ))}
    </div>
  );
}
