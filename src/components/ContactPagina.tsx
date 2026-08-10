export function ContactPagina() {
  return (
    <div className="info-stack">
      <section className="card page-card">
        <h2>La-Solución Adviesbureau</h2>
        <p className="muted">
          Hulp nodig bij het portaal of een technisch probleem? Neem contact op met het kantoor.
        </p>
        <dl className="settings-list settings-list-wide">
          <div>
            <dt>E-mail</dt>
            <dd>
              <a href="mailto:info@la-solucion.nl" className="link-btn-inline">
                info@la-solucion.nl
              </a>
            </dd>
          </div>
          <div>
            <dt>Telefoon</dt>
            <dd>Neem contact op via het kantoor</dd>
          </div>
          <div>
            <dt>Kantooruren</dt>
            <dd>Maandag t/m vrijdag, 09:00 – 17:00</dd>
          </div>
        </dl>
      </section>
      <section className="card page-card">
        <h2>Technische ondersteuning</h2>
        <p className="muted">
          Problemen met inloggen? Probeer je wachtwoord opnieuw in te stellen via het inlogscherm.
          Blijft het misgaan, vernieuw de pagina of neem contact op met de eigenaar van het account.
        </p>
      </section>
    </div>
  );
}
