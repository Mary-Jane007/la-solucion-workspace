import { useMemo, useState } from "react";
import { groepeerPerKlant, klantMatchtZoekterm, klantNummerLabel } from "../opdrachtenUtils";
import { OpdrachtenWerkruimte } from "../hooks/useOpdrachtenWerkruimte";
import { useLijstGezienStatus } from "../hooks/useLijstGezienStatus";
import { klantenItemIds } from "../badgeItems";

interface Props {
  werkruimte: OpdrachtenWerkruimte;
  userId: string;
  onGezien: () => void;
}

export function KlantenPagina({ werkruimte, userId, onGezien }: Props) {
  const [zoekterm, setZoekterm] = useState("");
  const { alleOpdrachten, openOpdracht } = werkruimte;

  const klanten = useMemo(() => {
    const groepen = groepeerPerKlant(alleOpdrachten);
    const q = zoekterm.trim();
    if (!q) return groepen;
    return groepen.filter((k) => klantMatchtZoekterm(k.klantNaam, k.klantNummer, q));
  }, [alleOpdrachten, zoekterm]);

  const itemIds = useMemo(() => klantenItemIds(alleOpdrachten), [alleOpdrachten]);
  const { isOngelezen, markeerGeopend } = useLijstGezienStatus("klanten", userId, itemIds, onGezien);

  return (
    <section className="card page-card">
      <div className="section-header">
        <h2>Klantenoverzicht</h2>
        <p className="muted">{klanten.length} klant{klanten.length === 1 ? "" : "en"} · oud naar nieuw.</p>
      </div>
      <input
        type="search"
        className="form-input board-search-input"
        placeholder="Zoek op nummer of naam, bijv. 12, K12 of Rodríguez..."
        value={zoekterm}
        onChange={(e) => setZoekterm(e.target.value)}
      />
      <div className="klanten-grid">
        {klanten.map((k) => {
          const klantId = k.klantNummer
            ? `n:${k.klantNummer}`
            : k.klantNaam.trim().toLowerCase();
          const ongelezen = isOngelezen(klantId);
          return (
            <article
              key={klantId}
              className={`klant-kaart${ongelezen ? " klant-kaart-ongelezen" : ""}`}
              onClick={() => markeerGeopend(klantId)}
            >
              <h3>
                {k.klantNummer ? (
                  <span className="klant-nummer-pill">{klantNummerLabel(k.klantNummer)}</span>
                ) : null}
                {k.klantNaam}
              </h3>
              <p className="muted">
                {k.open} open · {k.afgerond} afgerond · {k.opdrachten.length} totaal
              </p>
              <ul className="klant-opdrachten">
                {k.opdrachten.slice(0, 4).map((o) => (
                  <li key={o.id}>
                    <button
                      type="button"
                      className={`link-btn${ongelezen ? " link-btn-ongelezen" : ""}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        markeerGeopend(klantId);
                        openOpdracht(o);
                      }}
                    >
                      {o.omschrijving}
                    </button>
                  </li>
                ))}
              </ul>
            </article>
          );
        })}
      </div>
    </section>
  );
}
