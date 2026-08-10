import { useEffect, useMemo, useState } from "react";
import { Opdracht } from "../types";
import { fetchPrullenbak, herstelOpdracht } from "../api";
import { permanentVerwijderDatum, PRULLENBAK_BEWAAR_DAGEN } from "../opdrachtVerwijderen";
import { useLijstGezienStatus } from "../hooks/useLijstGezienStatus";

interface Props {
  opdrachten: Opdracht[];
  userId: string;
  onOpdrachtenWijzig: (opdrachten: Opdracht[]) => void;
  onPrullenbakIdsWijzig: (ids: string[]) => void;
  onGezien: () => void;
}

export function PrullenbakPagina({
  opdrachten,
  userId,
  onOpdrachtenWijzig,
  onPrullenbakIdsWijzig,
  onGezien
}: Props) {
  const [prullenbak, setPrullenbak] = useState<Opdracht[]>([]);
  const [laden, setLaden] = useState(true);
  const [fout, setFout] = useState<string | null>(null);

  const itemIds = useMemo(() => prullenbak.map((o) => o.id), [prullenbak]);
  const { isOngelezen, markeerGeopend } = useLijstGezienStatus(
    "prullenbak",
    userId,
    itemIds,
    onGezien
  );

  const laadPrullenbak = async () => {
    try {
      setLaden(true);
      setFout(null);
      const items = await fetchPrullenbak();
      setPrullenbak(items);
      onPrullenbakIdsWijzig(items.map((o) => o.id));
    } catch {
      setFout("Kon de prullenbak niet laden.");
    } finally {
      setLaden(false);
    }
  };

  useEffect(() => {
    void laadPrullenbak();
  }, []);

  const handleHerstel = async (opdrachtId: string) => {
    try {
      setFout(null);
      markeerGeopend(opdrachtId);
      const hersteld = await herstelOpdracht(opdrachtId);
      setPrullenbak((prev) => {
        const next = prev.filter((o) => o.id !== opdrachtId);
        onPrullenbakIdsWijzig(next.map((o) => o.id));
        return next;
      });
      onOpdrachtenWijzig([hersteld, ...opdrachten]);
    } catch {
      setFout("Herstellen mislukt. Probeer opnieuw.");
    }
  };

  return (
    <section className="card page-card">
      <div className="section-header">
        <h2>Verwijderde opdrachten</h2>
        <p className="muted">
          Opdrachten blijven {PRULLENBAK_BEWAAR_DAGEN} dagen bewaard en worden daarna permanent
          verwijderd, inclusief bijlagen.
        </p>
      </div>

      {fout && <p className="muted page-error">{fout}</p>}

      {laden ? (
        <p className="muted">Prullenbak laden...</p>
      ) : prullenbak.length === 0 ? (
        <p className="muted">De prullenbak is leeg.</p>
      ) : (
        <div className="owner-table-wrapper">
          <table className="owner-table">
            <thead>
              <tr>
                <th>Klant</th>
                <th>Omschrijving</th>
                <th>Verwijderd op</th>
                <th>Permanent op</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {prullenbak.map((o) => {
                const ongelezen = isOngelezen(o.id);
                return (
                  <tr
                    key={o.id}
                    className={ongelezen ? "prullenbak-rij-ongelezen" : undefined}
                    onClick={() => markeerGeopend(o.id)}
                  >
                    <td>{o.klantNaam}</td>
                    <td>{o.omschrijving}</td>
                    <td>
                      {o.verwijderdOp
                        ? new Date(o.verwijderdOp).toLocaleDateString("nl-NL")
                        : "—"}
                    </td>
                    <td>{o.verwijderdOp ? permanentVerwijderDatum(o.verwijderdOp) : "—"}</td>
                    <td>
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleHerstel(o.id);
                        }}
                      >
                        Herstellen
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
