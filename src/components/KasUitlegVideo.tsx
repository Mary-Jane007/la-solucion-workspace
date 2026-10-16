import { useEffect, useMemo, useRef, useState } from "react";
import { KAS_HELP_SLIDES, KasHelpSlide } from "../kasHelpVideo";

function kiesNederlandseStem(stemmen: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const nl = stemmen.filter((stem) => /^nl(-|$)/i.test(stem.lang));
  return (
    nl.find((stem) => /fenna|colette|laura|anna|daphne|nld/i.test(stem.name)) ||
    nl[0] ||
    null
  );
}

function SlideBeeld({ slide }: { slide: KasHelpSlide }) {
  if (slide.id === "start") {
    return (
      <div className="kasvid-beeld kasvid-start">
        <p className="kasvid-kicker">La-Solución</p>
        <h3>Kas doorgeven</h3>
        <p>Elke dag, in vier stappen</p>
        <ol>
          <li>Vanochtend</li>
          <li>Tik wat je deed</li>
          <li>Je lijst</li>
          <li>Tel en stuur</li>
        </ol>
      </div>
    );
  }
  if (slide.id === "menu") {
    return (
      <div className="kasvid-beeld">
        <div className="kasvid-menu">
          <span>Home</span>
          <span>Opdrachtenbord</span>
          <strong>Kas doorgeven</strong>
          <span>Help</span>
        </div>
        <p className="kasvid-pijl">← Tik hier</p>
      </div>
    );
  }
  if (slide.id === "munt") {
    return (
      <div className="kasvid-beeld">
        <p className="kasvid-vraag">In welke munt tel je vandaag?</p>
        <div className="kasvid-chips">
          <span className="is-actief">SRD</span>
          <span>USD</span>
          <span>EUR</span>
        </div>
      </div>
    );
  }
  if (slide.id === "ochtend") {
    return (
      <div className="kasvid-beeld">
        <p className="kasvid-nr">1</p>
        <p className="kasvid-vraag">Hoeveel lag er vanochtend in je kas?</p>
        <p className="kasvid-bedrag">500 <small>SRD</small></p>
      </div>
    );
  }
  if (slide.id === "tegels") {
    return (
      <div className="kasvid-beeld">
        <p className="kasvid-nr">2</p>
        <div className="kasvid-tegels">
          <span>⛽ Benzine</span>
          <span>🖨 Uitprinten</span>
          <span>🚕 Taxi</span>
          <span>🍽 Eten</span>
        </div>
      </div>
    );
  }
  if (slide.id === "bedrag") {
    return (
      <div className="kasvid-beeld">
        <p className="kasvid-vraag">⛽ Benzine</p>
        <p className="kasvid-bedrag">80 <small>SRD</small></p>
        <div className="kasvid-knoppen">
          <em>Nog een bedrag</em>
          <strong>Bedrag toevoegen</strong>
        </div>
      </div>
    );
  }
  if (slide.id === "lijst") {
    return (
      <div className="kasvid-beeld">
        <p className="kasvid-vraag">Jouw dag tot nu toe</p>
        <ul className="kasvid-lijst">
          <li>
            <span>⛽ Benzine</span>
            <b>80 SRD</b>
          </li>
          <li>
            <span>🖨 Uitprinten</span>
            <b>45 SRD</b>
          </li>
        </ul>
      </div>
    );
  }
  return (
    <div className="kasvid-beeld">
      <p className="kasvid-nr">4</p>
      <p className="kasvid-vraag">Hoeveel ligt er nu nog?</p>
      <p className="kasvid-bedrag">375 <small>SRD</small></p>
      <p className="kasvid-actie">Dag doorgeven</p>
    </div>
  );
}

export function KasUitlegVideo() {
  const [index, setIndex] = useState(0);
  const [spelen, setSpelen] = useState(false);
  const [geluid, setGeluid] = useState(true);
  const [stemmen, setStemmen] = useState<SpeechSynthesisVoice[]>([]);
  const timerRef = useRef<number | null>(null);
  const runId = useRef(0);

  const slide = KAS_HELP_SLIDES[index];
  const nederlands = useMemo(() => kiesNederlandseStem(stemmen), [stemmen]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const laad = () => setStemmen(window.speechSynthesis.getVoices());
    laad();
    window.speechSynthesis.addEventListener("voiceschanged", laad);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", laad);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const stopSpraak = () => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
  };

  const naar = (volgende: number) => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    stopSpraak();
    setIndex(Math.max(0, Math.min(KAS_HELP_SLIDES.length - 1, volgende)));
  };

  useEffect(() => {
    if (!spelen) return;
    const huidig = KAS_HELP_SLIDES[index];
    if (!huidig) {
      setSpelen(false);
      return;
    }
    const my = ++runId.current;
    const klaar = () => {
      if (runId.current !== my) return;
      if (index >= KAS_HELP_SLIDES.length - 1) {
        setSpelen(false);
        return;
      }
      timerRef.current = window.setTimeout(() => {
        if (runId.current !== my) return;
        setIndex(index + 1);
      }, 700);
    };

    if (geluid && typeof window !== "undefined" && window.speechSynthesis) {
      stopSpraak();
      const uiting = new SpeechSynthesisUtterance(`${huidig.titel}. ${huidig.ondertitel}`);
      uiting.lang = nederlands?.lang || "nl-NL";
      if (nederlands) uiting.voice = nederlands;
      uiting.rate = 0.92;
      uiting.onend = klaar;
      uiting.onerror = klaar;
      window.speechSynthesis.speak(uiting);
    } else {
      const ms = Math.min(10000, Math.max(5500, huidig.ondertitel.length * 70));
      timerRef.current = window.setTimeout(klaar, ms);
    }

    return () => {
      runId.current += 1;
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      stopSpraak();
    };
  }, [spelen, index, geluid, nederlands]);

  const toggleSpelen = () => {
    if (spelen) {
      setSpelen(false);
      stopSpraak();
      if (timerRef.current) window.clearTimeout(timerRef.current);
      return;
    }
    setSpelen(true);
  };

  return (
    <section id="help-kas-video" className="card page-card help-video-section kasvid">
      <div className="section-header">
        <h2>Video: Kas doorgeven</h2>
        <p className="muted">
          Speel de uitleg af. Ondertitels staan altijd onder het beeld. Zet geluid aan voor
          gesproken Nederlands.
        </p>
      </div>

      <div className="kasvid-podium" aria-live="polite">
        <SlideBeeld slide={slide} />
        <p className="kasvid-ondertitel">
          <strong>{slide.titel}</strong>
          <span>{slide.ondertitel}</span>
        </p>
      </div>

      <div className="kasvid-bediening">
        <button type="button" className="kasvid-play" onClick={toggleSpelen}>
          {spelen ? "Pauzeren" : "Afspelen"}
        </button>
        <button
          type="button"
          className="kasdag-mini"
          onClick={() => naar(index - 1)}
          disabled={index === 0}
        >
          Vorige
        </button>
        <button
          type="button"
          className="kasdag-mini"
          onClick={() => naar(index + 1)}
          disabled={index === KAS_HELP_SLIDES.length - 1}
        >
          Volgende
        </button>
        <button
          type="button"
          className={`kasdag-mini${geluid ? " kasvid-geluid-aan" : ""}`}
          onClick={() => {
            setGeluid((aan) => !aan);
            stopSpraak();
          }}
        >
          {geluid ? "Geluid aan" : "Alleen ondertitel"}
        </button>
        <span className="kasvid-voortgang">
          {index + 1} / {KAS_HELP_SLIDES.length}
        </span>
      </div>
    </section>
  );
}
