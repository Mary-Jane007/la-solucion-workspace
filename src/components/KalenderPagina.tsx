import { Kalender } from "./Kalender";
import { OpdrachtenWerkruimte } from "../hooks/useOpdrachtenWerkruimte";

interface Props {
  werkruimte: OpdrachtenWerkruimte;
}

export function KalenderPagina({ werkruimte }: Props) {
  const { zichtbareOpdrachten, openOpdracht } = werkruimte;

  return (
    <section className="card page-card">
      <Kalender opdrachten={zichtbareOpdrachten} onSelectOpdracht={openOpdracht} />
    </section>
  );
}
