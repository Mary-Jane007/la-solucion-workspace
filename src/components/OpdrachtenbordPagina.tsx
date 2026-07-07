import { OpdrachtenBord } from "./OpdrachtenBord";
import { OpdrachtenWerkruimte } from "../hooks/useOpdrachtenWerkruimte";

interface Props {
  werkruimte: OpdrachtenWerkruimte;
  isEigenaar: boolean;
}

export function OpdrachtenbordPagina({ werkruimte, isEigenaar }: Props) {
  const { zichtbareOpdrachten, openOpdracht, handleOpdrachtUpdate, handleVerwijderMetBevestiging, opdrachtFout } =
    werkruimte;

  return (
    <section className="card page-card">
      {opdrachtFout && <p className="muted page-error">{opdrachtFout}</p>}
      <div className="section-header">
        <h2>Alle opdrachten</h2>
        <p className="muted">Klik een kaart voor details, documenten en status.</p>
      </div>
      <OpdrachtenBord
        opdrachten={zichtbareOpdrachten}
        isEigenaar={isEigenaar}
        onOpdrachtKlik={openOpdracht}
        onOpdrachtWijzig={handleOpdrachtUpdate}
        onOpdrachtVerwijder={isEigenaar ? handleVerwijderMetBevestiging : undefined}
      />
    </section>
  );
}
