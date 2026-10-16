import { useEffect, useMemo, useRef, useState } from "react";
import { HelpSlide, HelpVideoGids } from "../helpVideos";

const PLAY_EVENT = "la-solucion-help-play";

function kiesNederlandseStem(stemmen: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const nl = stemmen.filter((stem) => /^nl(-|$)/i.test(stem.lang));
  return (
    nl.find((stem) => /fenna|colette|laura|anna|daphne|nld/i.test(stem.name)) ||
    nl[0] ||
    null
  );
}

function SlideBeeld({ slide }: { slide: HelpSlide }) {
  return (
    <div className={slide.kop ? "kasvid-beeld kasvid-start" : "kasvid-beeld"}>
      {slide.kicker && <p className="kasvid-kicker">{slide.kicker}</p>}
      {slide.kop && <h3>{slide.kop}</h3>}
      {slide.lead && <p>{slide.lead}</p>}
      {slide.nr && <p className="kasvid-nr">{slide.nr}</p>}
      {slide.vraag && <p className="kasvid-vraag">{slide.vraag}</p>}
      {slide.bedrag && (
        <p className="kasvid-bedrag">
          {slide.bedrag.waarde}
          {slide.bedrag.valuta ? <small> {slide.bedrag.valuta}</small> : null}
        </p>
      )}
      {slide.menu && (
        <div className="kasvid-menu">
          {slide.menu.items.map((item) =>
            item === slide.menu?.actief ? <strong key={item}>{item}</strong> : <span key={item}>{item}</span>
          )}
        </div>
      )}
      {slide.pijl && <p className="kasvid-pijl">{slide.pijl}</p>}
      {slide.chips && (
        <div className="kasvid-chips">
          {slide.chips.items.map((item) => (
            <span key={item} className={item === slide.chips?.actief ? "is-actief" : undefined}>
              {item}
            </span>
          ))}
        </div>
      )}
      {slide.stappen && (
        <ol>
          {slide.stappen.map((stap) => (
            <li key={stap}>{stap}</li>
          ))}
        </ol>
      )}
      {slide.tegels && (
        <div className="kasvid-tegels">
          {slide.tegels.map((tegel) => (
            <span key={tegel}>{tegel}</span>
          ))}
        </div>
      )}
      {slide.lijst && (
        <ul className="kasvid-lijst">
          {slide.lijst.map((rij) => (
            <li key={rij.label}>
              <span>{rij.label}</span>
              {rij.extra ? <b>{rij.extra}</b> : null}
            </li>
          ))}
        </ul>
      )}
      {slide.knoppen && (
        <div className="kasvid-knoppen">
          {slide.knoppen.secundair && <em>{slide.knoppen.secundair}</em>}
          {slide.knoppen.primair && <strong>{slide.knoppen.primair}</strong>}
        </div>
      )}
      {slide.actie && <p className="kasvid-actie">{slide.actie}</p>}
    </div>
  );
}

export function HelpStappenVideo({ gids, ingebouwd = false }: { gids: HelpVideoGids; ingebouwd?: boolean }) {
  const [index, setIndex] = useState(0);
  const [spelen, setSpelen] = useState(false);
  const [geluid, setGeluid] = useState(true);
  const [stemmen, setStemmen] = useState<SpeechSynthesisVoice[]>([]);
  const timerRef = useRef<number | null>(null);
  const runId = useRef(0);

  const slide = gids.slides[index];
  const nederlands = useMemo(() => kiesNederlandseStem(stemmen), [stemmen]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const laad = () => setStemmen(window.speechSynthesis.getVoices());
    laad();
    window.speechSynthesis.addEventListener("voiceschanged", laad);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", laad);
  }, []);

  useEffect(() => {
    const onAnder = (event: Event) => {
      const id = (event as CustomEvent<string>).detail;
      if (id === gids.id) return;
      setSpelen(false);
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (window.speechSynthesis) window.speechSynthesis.cancel();
    };
    window.addEventListener(PLAY_EVENT, onAnder);
    return () => window.removeEventListener(PLAY_EVENT, onAnder);
  }, [gids.id]);

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
    setIndex(Math.max(0, Math.min(gids.slides.length - 1, volgende)));
  };

  useEffect(() => {
    if (!spelen) return;
    const huidig = gids.slides[index];
    if (!huidig) {
      setSpelen(false);
      return;
    }
    const my = ++runId.current;
    const klaar = () => {
      if (runId.current !== my) return;
      if (index >= gids.slides.length - 1) {
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
  }, [spelen, index, geluid, nederlands, gids.slides]);

  const toggleSpelen = () => {
    if (spelen) {
      setSpelen(false);
      stopSpraak();
      if (timerRef.current) window.clearTimeout(timerRef.current);
      return;
    }
    window.dispatchEvent(new CustomEvent(PLAY_EVENT, { detail: gids.id }));
    setSpelen(true);
  };

  const bediening = (
    <>
      <div className="kasvid-podium" aria-live="polite">
        {slide && <SlideBeeld slide={slide} />}
        {slide && (
          <p className="kasvid-ondertitel">
            <strong>{slide.titel}</strong>
            <span>{slide.ondertitel}</span>
          </p>
        )}
      </div>
      <div className="kasvid-bediening">
        <button type="button" className="kasvid-play" onClick={toggleSpelen}>
          {spelen ? "Pauzeren" : "Afspelen"}
        </button>
        <button type="button" className="kasdag-mini" onClick={() => naar(index - 1)} disabled={index === 0}>
          Vorige
        </button>
        <button
          type="button"
          className="kasdag-mini"
          onClick={() => naar(index + 1)}
          disabled={index === gids.slides.length - 1}
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
          {index + 1} / {gids.slides.length}
        </span>
      </div>
    </>
  );

  if (ingebouwd) {
    return <div className="kasvid kasvid-ingebouwd">{bediening}</div>;
  }

  return (
    <section className="card page-card help-video-section kasvid">
      <div className="section-header">
        <h2>Video: {gids.titel}</h2>
        <p className="muted">
          Speel de uitleg af. Ondertitels staan altijd onder het beeld. Zet geluid aan voor
          gesproken Nederlands.
        </p>
      </div>
      {bediening}
    </section>
  );
}
