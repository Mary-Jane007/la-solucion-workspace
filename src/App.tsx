import { useEffect, useMemo, useState } from "react";
import { LoginScherm } from "./components/LoginScherm";
import { Dashboard } from "./components/Dashboard";
import { AppLayout } from "./components/layout/AppLayout";
import { Gebruiker, Opdracht, Rol } from "./types";
import { clearToken, fetchMe, fetchOpdrachten, getToken } from "./api";

export function App() {
  const [ingelogdeGebruiker, setIngelogdeGebruiker] = useState<Gebruiker | null>(null);
  const [opdrachten, setOpdrachten] = useState<Opdracht[]>([]);
  const [laden, setLaden] = useState(true);
  const [fout, setFout] = useState<string | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLaden(false);
      return;
    }
    let isCancelled = false;
    const init = async () => {
      try {
        setLaden(true);
        setFout(null);
        const me = await fetchMe();
        const lijst = await fetchOpdrachten();
        if (!isCancelled) {
          setIngelogdeGebruiker(me);
          setOpdrachten(lijst);
        }
      } catch {
        if (!isCancelled) {
          setFout(null);
        }
      } finally {
        if (!isCancelled) {
          setLaden(false);
        }
      }
    };
    init();
    return () => {
      isCancelled = true;
    };
  }, []);

  const isEigenaar = useMemo(
    () => ingelogdeGebruiker?.rol === Rol.Eigenaar,
    [ingelogdeGebruiker]
  );

  const handleLogout = () => {
    clearToken();
    setIngelogdeGebruiker(null);
    setOpdrachten([]);
  };

  if (!ingelogdeGebruiker) {
    return (
      <AppLayout>
        {laden ? (
          <div className="card">
            <h2>Even laden...</h2>
            <p className="muted">Bezig met sessie herstellen.</p>
          </div>
        ) : (
          <>
            {fout && (
              <div className="card" style={{ marginBottom: 12 }}>
                <p className="muted" style={{ color: "#fecaca" }}>
                  {fout}
                </p>
              </div>
            )}
            <LoginScherm
              onLogin={async (g) => {
                setIngelogdeGebruiker(g);
                try {
                  const lijst = await fetchOpdrachten();
                  setOpdrachten(lijst);
                } catch {
                  setFout("Ingelogd, maar opdrachten konden niet geladen worden.");
                }
              }}
            />
          </>
        )}
      </AppLayout>
    );
  }

  return (
    <AppLayout gebruiker={ingelogdeGebruiker} onLogout={handleLogout}>
      <Dashboard
        isEigenaar={isEigenaar}
        gebruiker={ingelogdeGebruiker}
        opdrachten={opdrachten}
        onOpdrachtenWijzig={setOpdrachten}
      />
    </AppLayout>
  );
}

