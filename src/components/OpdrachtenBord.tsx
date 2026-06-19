import { useMemo, useState } from "react";
import { Opdracht, OpdrachtStatus } from "../types";
import { OpdrachtKaart } from "./OpdrachtKaart";

export interface OpdrachtenBordProps {
  opdrachten: Opdracht[];
  isEigenaar: boolean;
  onOpdrachtKlik: (opdracht: Opdracht) => void;
  onOpdrachtWijzig: (opdracht: Opdracht) => void | Promise<Opdracht>;
  onOpdrachtVerwijder?: (opdracht: Opdracht) => void | Promise<void>;
}

function opdrachtMatchtZoekterm(opdracht: Opdracht, zoekterm: string): boolean {
  const velden = [
    opdracht.klantNaam,
    opdracht.omschrijving,
    opdracht.categorie,
    opdracht.behandelaarNaam,
    opdracht.notities
  ];

  return velden.some((veld) => veld?.toLowerCase().includes(zoekterm));
}

export function OpdrachtenBord({
  opdrachten,
  isEigenaar,
  onOpdrachtKlik,
  onOpdrachtWijzig,
  onOpdrachtVerwijder
}: OpdrachtenBordProps) {
  const [zoekterm, setZoekterm] = useState("");

  const kolommen: { key: OpdrachtStatus; titel: string }[] = [
    { key: OpdrachtStatus.Nieuw, titel: "Nieuw" },
    { key: OpdrachtStatus.InBehandeling, titel: "In behandeling" },
    { key: OpdrachtStatus.Afgerond, titel: "Afgerond" }
  ];

  const gefilterdeOpdrachten = useMemo(() => {
    const query = zoekterm.trim().toLowerCase();
    if (!query) return opdrachten;
    return opdrachten.filter((o) => opdrachtMatchtZoekterm(o, query));
  }, [opdrachten, zoekterm]);

  const veranderStatus = (opdracht: Opdracht, status: OpdrachtStatus) => {
    onOpdrachtWijzig({ ...opdracht, status });
  };

  const isZoeken = zoekterm.trim().length > 0;
  const totaalResultaten = gefilterdeOpdrachten.length;

  return (
    <div className="board-wrap">
      <div className="board-search">
        <label className="board-search-label" htmlFor="opdrachten-zoeken">
          Zoeken
        </label>
        <input
          id="opdrachten-zoeken"
          type="search"
          className="form-input board-search-input"
          placeholder="Zoek op klant, omschrijving, categorie of behandelaar..."
          value={zoekterm}
          onChange={(e) => setZoekterm(e.target.value)}
        />
        {isZoeken && (
          <p className="board-search-meta muted">
            {totaalResultaten === 0
              ? "Geen opdrachten gevonden."
              : `${totaalResultaten} ${totaalResultaten === 1 ? "opdracht" : "opdrachten"} gevonden.`}
          </p>
        )}
      </div>
      <div className="board-grid">
        {kolommen.map((kolom) => {
          const items = gefilterdeOpdrachten.filter((o) => o.status === kolom.key);
          return (
            <div key={kolom.key} className="board-column">
              <div className="board-column-header">
                <h3>{kolom.titel}</h3>
                <span className="badge-count">{items.length}</span>
              </div>
              <div className="board-column-body">
                {items.map((o) => (
                  <OpdrachtKaart
                    key={o.id}
                    opdracht={o}
                    isEigenaar={isEigenaar}
                    onKlik={() => onOpdrachtKlik(o)}
                    onStatusWijzig={(status) => veranderStatus(o, status)}
                    onVerwijder={
                      onOpdrachtVerwijder ? () => onOpdrachtVerwijder(o) : undefined
                    }
                  />
                ))}
                {items.length === 0 && (
                  <p className="board-empty">
                    {isZoeken
                      ? "Geen overeenkomende opdrachten in deze kolom."
                      : "Nog geen opdrachten in deze kolom."}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

