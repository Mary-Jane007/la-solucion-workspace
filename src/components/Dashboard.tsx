import { useMemo } from "react";
import { Opdracht, OpdrachtStatus } from "../types";
import { isOpdrachtOpen, isP1Rood, klantWeergave } from "../opdrachtenUtils";
import { OpdrachtenWerkruimte } from "../hooks/useOpdrachtenWerkruimte";
import { useLijstGezienStatus } from "../hooks/useLijstGezienStatus";
import { homeItemIds } from "../badgeItems";

import { EigenaarFinancieelNotificaties } from "./EigenaarFinancieelNotificaties";
import { AppPagina } from "../appPages";

interface Props {
  werkruimte: OpdrachtenWerkruimte;
  isEigenaar: boolean;
  userId: string;
  onNieuweOpdracht: () => void;
  onGezien: () => void;
  onNavigeer?: (pagina: AppPagina) => void;
}

export function Dashboard({
  werkruimte,
  isEigenaar,
  userId,
  onNieuweOpdracht,
  onGezien,
  onNavigeer
}: Props) {
  const { zichtbareOpdrachten, openOpdracht, opdrachtFout } = werkruimte;

  const belangrijksteOpdrachten = [...zichtbareOpdrachten]
    .filter((o) => isOpdrachtOpen(o.status) && o.prioriteit === 1)
    .sort((a, b) => {
      if (a.datumDeadline && b.datumDeadline) return a.datumDeadline.localeCompare(b.datumDeadline);
      if (a.datumDeadline) return -1;
      if (b.datumDeadline) return 1;
      return a.klantNaam.localeCompare(b.klantNaam);
    });

  const aantallen = {
    totaal: zichtbareOpdrachten.length,
    nieuw: zichtbareOpdrachten.filter((o) => o.status === OpdrachtStatus.Nieuw).length,
    afwachting: zichtbareOpdrachten.filter((o) => o.status === OpdrachtStatus.Afwachting).length,
    lopend: zichtbareOpdrachten.filter((o) => o.status === OpdrachtStatus.InBehandeling).length,
    ingediend: zichtbareOpdrachten.filter((o) => o.status === OpdrachtStatus.Ingediend).length,
    onHold: zichtbareOpdrachten.filter((o) => o.status === OpdrachtStatus.OnHold).length,
    oud: zichtbareOpdrachten.filter((o) => o.status === OpdrachtStatus.Oud).length,
    afgerond: zichtbareOpdrachten.filter((o) => o.status === OpdrachtStatus.Afgerond).length
  };

  const vandaagIso = new Date().toISOString().slice(0, 10);
  const vandaagDue = zichtbareOpdrachten.filter((o) => o.datumDeadline === vandaagIso);
  const itemIds = useMemo(() => homeItemIds(zichtbareOpdrachten), [zichtbareOpdrachten]);
  const { markeerGeopend } = useLijstGezienStatus("home", userId, itemIds, onGezien);

  const openMetGezien = (o: Opdracht) => {
    markeerGeopend(o.id);
    openOpdracht(o);
  };

  return (
    <div className="info-stack">
      {opdrachtFout && (
        <div className="card">
          <p className="muted page-error">{opdrachtFout}</p>
        </div>
      )}
      {isEigenaar && onNavigeer && (
        <EigenaarFinancieelNotificaties onOpenFinancieel={() => onNavigeer("financieel")} />
      )}
      <div className="dashboard-grid">
        <section className="card metric-card metric-main">
          <div className="metric-header">
            <h2>Belangrijkste taken</h2>
            {isEigenaar && (
              <button type="button" className="btn-secondary" onClick={onNieuweOpdracht}>
                Opdracht toevoegen
              </button>
            )}
          </div>
          <p className="metric-subtitle">Alleen openstaande opdrachten met hoge prioriteit (P1).</p>
          <div className="important-list">
            {belangrijksteOpdrachten.map((o) => {
              return (
                <button
                  key={o.id}
                  type="button"
                  className={`important-item${isP1Rood(o.status, o.prioriteit) ? " important-item-prio-1" : ""}`}
                  onClick={() => openMetGezien(o)}
                >
                  <div className="important-main">
                    <span className="important-client">{klantWeergave(o.klantNaam, o.klantNummer)}</span>
                    <span className={`pill pill-prio-${o.prioriteit}`}>Prioriteit {o.prioriteit}</span>
                  </div>
                  <div className="important-sub">
                    <span>{o.omschrijving}</span>
                    {o.datumDeadline && (
                      <span className="important-deadline">
                        Deadline: {new Date(o.datumDeadline).toLocaleDateString("nl-NL")}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
            {belangrijksteOpdrachten.length === 0 && (
              <p className="muted">Geen openstaande opdrachten met hoge prioriteit.</p>
            )}
          </div>
        </section>

        <section className="card metric-card">
          <h2>Overzicht opdrachten</h2>
          <div className="metric-row">
            <div className="metric-badge">
              <span className="metric-label">Nieuw</span>
              <span className="metric-value">{aantallen.nieuw}</span>
            </div>
            <div className="metric-badge">
              <span className="metric-label">Afwachting</span>
              <span className="metric-value">{aantallen.afwachting}</span>
            </div>
            <div className="metric-badge">
              <span className="metric-label">Lopend</span>
              <span className="metric-value">{aantallen.lopend}</span>
            </div>
            <div className="metric-badge">
              <span className="metric-label">Ingediend</span>
              <span className="metric-value">{aantallen.ingediend}</span>
            </div>
            <div className="metric-badge">
              <span className="metric-label">On hold</span>
              <span className="metric-value">{aantallen.onHold}</span>
            </div>
            <div className="metric-badge">
              <span className="metric-label">Oud</span>
              <span className="metric-value">{aantallen.oud}</span>
            </div>
            <div className="metric-badge">
              <span className="metric-label">Afgerond</span>
              <span className="metric-value">{aantallen.afgerond}</span>
            </div>
          </div>
        </section>

        <section className="card metric-card">
          <h2>Vandaag in de gaten houden</h2>
          {vandaagDue.length === 0 ? (
            <p className="muted">Geen opdrachten met deadline vandaag.</p>
          ) : (
            <ul className="today-list">
              {vandaagDue.map((o) => (
                <li key={o.id}>
                  <button
                    type="button"
                    className="link-btn"
                    onClick={() => openMetGezien(o)}
                  >
                    {klantWeergave(o.klantNaam, o.klantNummer)} – {o.omschrijving}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
