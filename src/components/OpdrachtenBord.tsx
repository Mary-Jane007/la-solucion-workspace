import { Opdracht, OpdrachtStatus } from "../types";
import { OpdrachtKaart } from "./OpdrachtKaart";

export interface OpdrachtenBordProps {
  opdrachten: Opdracht[];
  isEigenaar: boolean;
  onOpdrachtKlik: (opdracht: Opdracht) => void;
  onOpdrachtWijzig: (opdracht: Opdracht) => void | Promise<Opdracht>;
}

export function OpdrachtenBord({
  opdrachten,
  isEigenaar,
  onOpdrachtKlik,
  onOpdrachtWijzig
}: OpdrachtenBordProps) {
  const kolommen: { key: OpdrachtStatus; titel: string }[] = [
    { key: OpdrachtStatus.Nieuw, titel: "Nieuw" },
    { key: OpdrachtStatus.InBehandeling, titel: "In behandeling" },
    { key: OpdrachtStatus.Afgerond, titel: "Afgerond" }
  ];

  const veranderStatus = (opdracht: Opdracht, status: OpdrachtStatus) => {
    onOpdrachtWijzig({ ...opdracht, status });
  };

  return (
    <div className="board-grid">
      {kolommen.map((kolom) => {
        const items = opdrachten.filter((o) => o.status === kolom.key);
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
                />
              ))}
              {items.length === 0 && (
                <p className="board-empty">Nog geen opdrachten in deze kolom.</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

