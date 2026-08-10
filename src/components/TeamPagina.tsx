import { useEffect, useState } from "react";

interface BeheerGebruiker {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
}

export function TeamPagina() {
  const [gebruikers, setGebruikers] = useState<BeheerGebruiker[]>([]);
  const [laden, setLaden] = useState(true);
  const [fout, setFout] = useState<string | null>(null);

  useEffect(() => {
    const token = window.localStorage.getItem("la-solucion-token");
    if (!token) return;

    let isCancelled = false;
    const fetchUsers = async () => {
      try {
        setLaden(true);
        const res = await fetch("/api/admin/users", {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (!res.ok) {
          if (!isCancelled) setFout(data.error || "Kon gebruikerslijst niet ophalen.");
          return;
        }
        if (!isCancelled) setGebruikers(data.users || []);
      } catch {
        if (!isCancelled) setFout("Er is een fout opgetreden bij het ophalen van gebruikers.");
      } finally {
        if (!isCancelled) setLaden(false);
      }
    };

    void fetchUsers();
    return () => {
      isCancelled = true;
    };
  }, []);

  const toggleUserActive = async (userId: string) => {
    const token = window.localStorage.getItem("la-solucion-token");
    if (!token) return;
    try {
      const res = await fetch(`/api/admin/users/${userId}/toggle-active`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) {
        setFout(data.error || "Kon de status van de gebruiker niet wijzigen.");
        return;
      }
      setGebruikers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, active: data.active } : u))
      );
    } catch {
      setFout("Er is een fout opgetreden bij het wijzigen van de gebruikersstatus.");
    }
  };

  return (
    <section className="card page-card">
      <div className="section-header">
        <h2>Teamoverzicht</h2>
        <p className="muted">
          Beheer welke medewerkers actief zijn en zie in één oogopslag de verdeling.
        </p>
      </div>

      {fout && <p className="muted page-error">{fout}</p>}

      {laden ? (
        <p className="muted">Gebruikers laden...</p>
      ) : (
        <div className="owner-table-wrapper">
          <table className="owner-table">
            <thead>
              <tr>
                <th>Naam</th>
                <th>E-mailadres</th>
                <th>Rol</th>
                <th>Status</th>
                <th>Actie</th>
              </tr>
            </thead>
            <tbody>
              {gebruikers.map((u) => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td>{u.role === "EIGENAAR" ? "Eigenaar" : "Medewerker"}</td>
                  <td>{u.active ? "Actief" : "Gedeactiveerd"}</td>
                  <td>
                    {u.role === "EIGENAAR" ? (
                      <span className="muted">Hoofdaccount</span>
                    ) : (
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() => void toggleUserActive(u.id)}
                      >
                        {u.active ? "Zet op non-actief" : "Activeer"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {gebruikers.length === 0 && (
                <tr>
                  <td colSpan={5}>
                    <span className="muted">Er zijn nog geen andere gebruikers geregistreerd.</span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
