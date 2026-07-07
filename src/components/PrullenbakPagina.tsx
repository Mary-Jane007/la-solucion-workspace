import { useEffect, useState } from "react";
import { Opdracht } from "../types";
import { fetchPrullenbak, herstelOpdracht } from "../api";
import { permanentVerwijderDatum, PRULLENBAK_BEWAAR_DAGEN } from "../opdrachtVerwijderen";

interface Props {
  opdrachten: Opdracht[];
  onOpdrachtenWijzig: (opdrachten: Opdracht[]) => void;
  onAantalWijzig?: (aantal: number) => void;
}

export function PrullenbakPagina({ opdrachten, onOpdrachtenWijzig, onAantalWijzig }: Props) {
  const [prullenbak, setPrullenbak] = useState<Opdracht[]>([]);
  const [laden, setLaden] = useState(true);
  const [fout, setFout] = useState<string | null>(null);

  const laadPrullenbak = async () => {
    try {
      setLaden(true);
      setFout(null);
      const items = await fetchPrullenbak();
      setPrullenbak(items);
      onAantalWijzig?.(items.length);
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
      const hersteld = await herstelOpdracht(opdrachtId);
      setPrullenbak((prev) => {
        const next = prev.filter((o) => o.id !== opdrachtId);
        onAantalWijzig?.(next.length);
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
              {prullenbak.map((o) => (
                <tr key={o.id}>
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
                      onClick={() => void handleHerstel(o.id)}
                    >
                      Herstellen
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
