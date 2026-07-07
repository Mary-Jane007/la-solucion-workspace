import { Gebruiker, Rol } from "../types";

interface Props {
  gebruiker: Gebruiker;
}

export function ProfielPagina({ gebruiker }: Props) {
  return (
    <section className="card page-card">
      <h2>Jouw profiel</h2>
      <dl className="settings-list settings-list-wide">
        <div>
          <dt>Naam</dt>
          <dd>{gebruiker.naam}</dd>
        </div>
        <div>
          <dt>E-mailadres</dt>
          <dd>{gebruiker.email}</dd>
        </div>
        <div>
          <dt>Rol</dt>
          <dd>{gebruiker.rol === Rol.Eigenaar ? "Eigenaar" : "Medewerker"}</dd>
        </div>
        <div>
          <dt>Gebruikers-ID</dt>
          <dd className="muted mono-id">{gebruiker.id}</dd>
        </div>
      </dl>
      <p className="muted settings-note">
        Wachtwoord wijzigen kan via &quot;Wachtwoord vergeten&quot; op het inlogscherm.
      </p>
    </section>
  );
}
