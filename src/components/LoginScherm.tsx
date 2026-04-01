import { FormEvent, useMemo, useState } from "react";
import { Gebruiker, Rol } from "../types";

interface Props {
  onLogin: (gebruiker: Gebruiker) => void;
}

export function LoginScherm({ onLogin }: Props) {
  const [isRegistreren, setIsRegistreren] = useState(false);
  const [naam, setNaam] = useState("");
  const [email, setEmail] = useState("");
  const [wachtwoord, setWachtwoord] = useState("");
  const [nieuwWachtwoord, setNieuwWachtwoord] = useState("");
  const [rol, setRol] = useState<Rol>(Rol.Medewerker);
  const [foutmelding, setFoutmelding] = useState<string | null>(null);
  const [registratieSucces, setRegistratieSucces] = useState<string | null>(null);
  const [isBezig, setIsBezig] = useState(false);

  const resetToken = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("resetToken");
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFoutmelding(null);

    if (resetToken) {
      if (!nieuwWachtwoord.trim()) return;
      try {
        setIsBezig(true);
        const response = await fetch("/api/auth/reset-password", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token: resetToken,
            newPassword: nieuwWachtwoord
          })
        });
        const data = await response.json();
        if (!response.ok) {
          setFoutmelding(data.error || "Wachtwoord herstellen mislukt.");
          return;
        }
        alert("Wachtwoord succesvol hersteld. Je kunt nu inloggen met je nieuwe wachtwoord.");
        window.location.href = "/";
      } catch {
        setFoutmelding("Er is een fout opgetreden bij het herstellen. Probeer het opnieuw.");
      } finally {
        setIsBezig(false);
      }
      return;
    }

    if (isRegistreren) {
      if (!naam.trim() || !email.trim() || !wachtwoord.trim()) return;

      try {
        setIsBezig(true);
        setRegistratieSucces(null);
        setFoutmelding(null);
        const response = await fetch("/api/auth/register", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            name: naam.trim(),
            email: email.trim(),
            password: wachtwoord,
            role: rol
          })
        });

        const data = await response.json();
        if (!response.ok) {
          setFoutmelding(data.error || "Registratie mislukt.");
          return;
        }

        setRegistratieSucces(
          "Registratie gelukt. De eigenaar is per e-mail op de hoogte gesteld voor verificatie en toestemming. Je kunt inloggen zodra je account is goedgekeurd."
        );
        setWachtwoord("");
      } catch {
        setFoutmelding("Er is een fout opgetreden bij registreren. Probeer het opnieuw.");
      } finally {
        setIsBezig(false);
      }

      return;
    }

    if (!email.trim() || !wachtwoord.trim()) return;

    try {
      setIsBezig(true);
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          email: email.trim(),
          password: wachtwoord
        })
      });

      const data = await response.json();
      if (!response.ok) {
        setFoutmelding(data.error || "Inloggen mislukt.");
        return;
      }

      if (data.token) {
        window.localStorage.setItem("la-solucion-token", data.token);
      }

      onLogin({
        id: data.user.id,
        naam: data.user.naam,
        email: data.user.email,
        rol: data.user.rol as Rol
      });
    } catch {
      setFoutmelding("Er is een fout opgetreden bij inloggen. Probeer het opnieuw.");
    } finally {
      setIsBezig(false);
    }
  };

  return (
    <div className="login-grid">
      <div className="login-panel">
        <div className="login-card">
          <h2>
            {resetToken ? "Wachtwoord herstellen" : isRegistreren ? "Registreren" : "Inloggen"}
          </h2>
          <p className="login-subtitle">
            {resetToken
              ? "Kies een nieuw wachtwoord om je toegang te herstellen."
              : isRegistreren
              ? "Vraag een account aan voor toegang tot opdrachten, afspraken en klantdossiers."
              : "Meld je aan om de opdrachten, afspraken en klantdossiers te beheren."}
          </p>
          <form onSubmit={handleSubmit} className="form">
            {resetToken ? (
              <label className="form-label">
                Nieuw wachtwoord
                <input
                  type="password"
                  className="form-input"
                  placeholder="Minimaal 10 tekens"
                  value={nieuwWachtwoord}
                  onChange={(e) => setNieuwWachtwoord(e.target.value)}
                />
              </label>
            ) : (
              <>
            {isRegistreren && (
              <label className="form-label">
                Naam
                <input
                  className="form-input"
                  placeholder="Bijvoorbeeld: Marisol"
                  value={naam}
                  onChange={(e) => setNaam(e.target.value)}
                />
              </label>
            )}
            <label className="form-label">
              E-mailadres
              <input
                type="email"
                className="form-input"
                placeholder="Bijvoorbeeld: naam@voorbeeld.nl"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label className="form-label">
              Wachtwoord
              <input
                type="password"
                className="form-input"
                placeholder="Voer je wachtwoord in"
                value={wachtwoord}
                onChange={(e) => setWachtwoord(e.target.value)}
              />
            </label>
            <label className="form-label">
              Rol
              <select
                className="form-input"
                value={rol}
                onChange={(e) => setRol(e.target.value as Rol)}
              >
                <option value={Rol.Medewerker}>Medewerker</option>
                <option value={Rol.Eigenaar}>Eigenaar</option>
              </select>
            </label>
              </>
            )}
            <button type="submit" className="btn-primary">
              {isBezig
                ? resetToken
                  ? "Bezig met herstellen..."
                  : isRegistreren
                  ? "Bezig met registreren..."
                  : "Bezig met inloggen..."
                : resetToken
                ? "Wachtwoord opslaan"
                : isRegistreren
                ? "Registratie versturen"
                : "Ga naar het dashboard"}
            </button>
            {foutmelding && <p className="login-hint login-error">{foutmelding}</p>}
            {registratieSucces && <p className="login-hint login-success">{registratieSucces}</p>}
            <p className="login-hint">
              {isRegistreren ? (
                "Bij elke registratie wordt een e-mail naar de eigenaar gestuurd voor toestemming en verificatie."
              ) : (
                "Nog geen account? Registreer je hieronder; de eigenaar ontvangt een e-mail voor goedkeuring."
              )}
            </p>
            {!isRegistreren && !resetToken && (
              <button
                type="button"
                className="link-btn"
                onClick={async () => {
                  if (!email.trim()) {
                    alert("Vul eerst je e-mailadres in om een herstel-link te ontvangen.");
                    return;
                  }
                  try {
                    setIsBezig(true);
                    setFoutmelding(null);
                    await fetch("/api/auth/forgot-password", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ email: email.trim() })
                    });
                    alert(
                      "Als er een account bestaat, ontvang je zo een e-mail met een herstel-link."
                    );
                  } catch {
                    setFoutmelding("Kon herstel niet starten. Probeer het opnieuw.");
                  } finally {
                    setIsBezig(false);
                  }
                }}
              >
                Wachtwoord vergeten? Herstel aanvragen
              </button>
            )}
            {!resetToken && (
              <button
                type="button"
                className="link-btn"
                onClick={() => {
                  setRegistratieSucces(null);
                  setIsRegistreren((prev) => !prev);
                }}
              >
                {isRegistreren
                  ? "Heb je al een account? Inloggen"
                  : "Nog geen account? Registreren"}
              </button>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}

