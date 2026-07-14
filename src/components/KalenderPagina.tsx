import { useMemo } from "react";
import { Kalender } from "./Kalender";
import { OpdrachtenWerkruimte } from "../hooks/useOpdrachtenWerkruimte";
import { useLijstGezienStatus } from "../hooks/useLijstGezienStatus";
import { kalenderItemIds } from "../badgeItems";

interface Props {
  werkruimte: OpdrachtenWerkruimte;
  userId: string;
  onGezien: () => void;
}

export function KalenderPagina({ werkruimte, userId, onGezien }: Props) {
  const { zichtbareOpdrachten, openOpdracht } = werkruimte;
  const itemIds = useMemo(() => kalenderItemIds(zichtbareOpdrachten), [zichtbareOpdrachten]);
  const { isOngelezen, markeerGeopend } = useLijstGezienStatus(
    "kalender",
    userId,
    itemIds,
    onGezien
  );

  return (
    <section className="card page-card">
      <Kalender
        opdrachten={zichtbareOpdrachten}
        isOngelezen={isOngelezen}
        onSelectOpdracht={(o) => {
          markeerGeopend(o.id);
          openOpdracht(o);
        }}
      />
    </section>
  );
}
