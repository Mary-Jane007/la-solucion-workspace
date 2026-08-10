export function HelpPagina() {
  return (
    <div className="info-stack">
      <section className="card page-card">
        <h2>Opdracht aanmaken</h2>
        <p className="muted">
          Als eigenaar kies je in het menu <strong>Beheer → Nieuwe opdracht</strong>, de knop op
          het dashboard, of <strong>Voeg nieuwe opdracht toe</strong> op het opdrachtenbord.
          Vul klant, omschrijving, prioriteit en optioneel een deadline in.
        </p>
      </section>
      <section className="card page-card">
        <h2>Prioriteiten</h2>
        <p className="muted">
          <strong>P1</strong> is het belangrijkst en verschijnt op Home en bij Meldingen. P2 is
          normaal, P3 kan wachten.
        </p>
      </section>
      <section className="card page-card">
        <h2>Documenten uploaden</h2>
        <p className="muted">
          Open een opdracht en gebruik het uploadveld in de dialoog. Bestanden zijn ook terug te
          vinden onder <strong>Documenten</strong> in het menu.
        </p>
      </section>
      <section className="card page-card">
        <h2>Verwijderen &amp; prullenbak</h2>
        <p className="muted">
          Verwijderde opdrachten gaan 30 dagen naar de prullenbak. Daarna worden ze permanent
          verwijderd inclusief bijlagen.
        </p>
      </section>
      <section className="card page-card">
        <h2>Statistieken</h2>
        <p className="muted">
          Onder <strong>Statistieken</strong> zie je werkdruk, deadlines, teamverdeling en trends per
          maand — handig voor planning.
        </p>
      </section>
    </div>
  );
}
