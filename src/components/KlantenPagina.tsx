import { useMemo, useState } from "react";
import { groepeerPerKlant } from "../opdrachtenUtils";
import { OpdrachtenWerkruimte } from "../hooks/useOpdrachtenWerkruimte";

interface Props {
  werkruimte: OpdrachtenWerkruimte;
}

export function KlantenPagina({ werkruimte }: Props) {
  const [zoekterm, setZoekterm] = useState("");
  const { alleOpdrachten, openOpdracht } = werkruimte;

  const klanten = useMemo(() => {
    const groepen = groepeerPerKlant(alleOpdrachten);
    const q = zoekterm.trim().toLowerCase();
    if (!q) return groepen;
    return groepen.filter((k) => k.klantNaam.toLowerCase().includes(q));
  }, [alleOpdrachten, zoekterm]);

  return (
    <section className="card page-card">
      <div className="section-header">
        <h2>Klantenoverzicht</h2>
        <p className="muted">{klanten.length} klant{klanten.length === 1 ? "" : "en"}.</p>
      </div>
      <input
        type="search"
        className="form-input board-search-input"
        placeholder="Zoek op klantnaam..."
        value={zoekterm}
        onChange={(e) => setZoekterm(e.target.value)}
      />
      <div className="klanten-grid">
        {klanten.map((k) => (
          <article key={k.klantNaam} className="klant-kaart">
            <h3>{k.klantNaam}</h3>
            <p className="muted">
              {k.open} open · {k.afgerond} afgerond · {k.opdrachten.length} totaal
            </p>
            <ul className="klant-opdrachten">
              {k.opdrachten.slice(0, 4).map((o) => (
                <li key={o.id}>
                  <button type="button" className="link-btn" onClick={() => openOpdracht(o)}>
                    {o.omschrijving}
                  </button>
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}
