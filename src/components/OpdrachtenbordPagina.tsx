import { useMemo } from "react";
import { OpdrachtenBord } from "./OpdrachtenBord";
import { OpdrachtenWerkruimte } from "../hooks/useOpdrachtenWerkruimte";
import { useLijstGezienStatus } from "../hooks/useLijstGezienStatus";
import { bordItemIds } from "../badgeItems";

interface Props {
  werkruimte: OpdrachtenWerkruimte;
  isEigenaar: boolean;
  userId: string;
  onNieuweOpdracht: () => void;
  onGezien: () => void;
}

export function OpdrachtenbordPagina({
  werkruimte,
  isEigenaar,
  userId,
  onNieuweOpdracht,
  onGezien
}: Props) {
  const { zichtbareOpdrachten, openOpdracht, handleOpdrachtUpdate, handleVerwijderMetBevestiging, opdrachtFout } =
    werkruimte;
  const itemIds = useMemo(() => bordItemIds(zichtbareOpdrachten), [zichtbareOpdrachten]);
  const { isOngelezen, markeerGeopend } = useLijstGezienStatus("bord", userId, itemIds, onGezien);

  return (
    <section className="card page-card">
      {opdrachtFout && <p className="muted page-error">{opdrachtFout}</p>}
      <div className="section-header section-header-row">
        <div>
          <h2>Alle opdrachten</h2>
          <p className="muted">Klik een kaart voor details, documenten en status.</p>
        </div>
        {isEigenaar && (
          <button type="button" className="btn-primary" onClick={onNieuweOpdracht}>
            Voeg nieuwe opdracht toe
          </button>
        )}
      </div>
      <OpdrachtenBord
        opdrachten={zichtbareOpdrachten}
        isEigenaar={isEigenaar}
        isOngelezen={isOngelezen}
        onOpdrachtKlik={(o) => {
          markeerGeopend(o.id);
          openOpdracht(o);
        }}
        onOpdrachtWijzig={handleOpdrachtUpdate}
        onOpdrachtVerwijder={isEigenaar ? handleVerwijderMetBevestiging : undefined}
      />
    </section>
  );
}
