import { FormEvent, useEffect, useMemo, useState } from "react";
import { login } from "../api";
import { Gebruiker, Rol } from "../types";
import {
  getRememberedEmailForLogin,
  isRememberEmailEnabled,
  removeRememberedEmail,
  saveRememberedEmail
} from "../rememberedEmail";

interface Props {
  onLogin: (gebruiker: Gebruiker) => void;
}

async function loginMetGegevens(
  email: string,
  password: string,
  onLogin: (g: Gebruiker) => void
) {
  const data = await login(email, password);
  if (data.token) {
    window.localStorage.setItem("la-solucion-token", data.token);
  }
  onLogin({
    id: data.user.id,
    naam: data.user.naam,
    email: data.user.email,
    rol: data.user.rol as Rol
  });
}

export function LoginScherm({ onLogin }: Props) {
  const [isRegistreren, setIsRegistreren] = useState(false);
  const [naam, setNaam] = useState("");
  const [email, setEmail] = useState("");
  const [wachtwoord, setWachtwoord] = useState("");
  const [nieuwWachtwoord, setNieuwWachtwoord] = useState("");
  const [onthoudEmail, setOnthoudEmail] = useState(isRememberEmailEnabled);
  const [wordtEigenaar, setWordtEigenaar] = useState(false);
  const [foutmelding, setFoutmelding] = useState<string | null>(null);
  const [registratieSucces, setRegistratieSucces] = useState<string | null>(null);
  const [isBezig, setIsBezig] = useState(false);
  const [serverOk, setServerOk] = useState<boolean | null>(null);
  const [databaseOk, setDatabaseOk] = useState<boolean | null>(null);

  const resetToken = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("resetToken");
  }, []);

  useEffect(() => {
    const saved = getRememberedEmailForLogin();
    if (saved) setEmail(saved);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer = 0;
    const checkServer = async () => {
      const ac = new AbortController();
      const abortTimer = window.setTimeout(() => ac.abort(), 8000);
      try {
        const res = await fetch("/api/health", { cache: "no-store", signal: ac.signal });
        const text = await res.text();
        let data: { ok?: boolean; db?: boolean } = {};
        try {
          data = JSON.parse(text) as { ok?: boolean; db?: boolean };
        } catch {
          data = {};
        }
        const ok = res.ok && data.ok === true;
        if (!cancelled) {
          setServerOk(ok);
          setDatabaseOk(ok ? data.db === true : false);
        }
        if (!cancelled) timer = window.setTimeout(checkServer, ok && data.db === true ? 60000 : 8000);
      } catch {
        if (!cancelled) setServerOk(false);
        if (!cancelled) timer = window.setTimeout(checkServer, 8000);
      } finally {
        window.clearTimeout(abortTimer);
      }
    };
    void checkServer();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (!isRegistreren || !email.trim()) {
      setWordtEigenaar(false);
      return;
    }
    let cancelled = false;
    const check = async () => {
      try {
        const res = await fetch(
          `/api/auth/registration-info?email=${encodeURIComponent(email.trim())}`
        );
        const data = await res.json();
        if (!cancelled && res.ok) {
          setWordtEigenaar(Boolean(data.willBeOwner));
        }
      } catch {
        if (!cancelled) setWordtEigenaar(false);
      }
    };
    check();
    return () => {
      cancelled = true;
    };
  }, [isRegistreren, email]);

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
            password: wachtwoord
          })
        });

        const data = await response.json();
        if (!response.ok && response.status !== 200) {
          setFoutmelding(data.error || "Registratie mislukt.");
          return;
        }

        const isEigenaar = data.role === "EIGENAAR";
        setRegistratieSucces(data.message || "Registratie gelukt.");

        if (isEigenaar && wachtwoord.trim()) {
          try {
            await loginMetGegevens(email, wachtwoord, (gebruiker) => {
              if (onthoudEmail) {
                saveRememberedEmail(email);
              }
              onLogin(gebruiker);
            });
            return;
          } catch {
            setRegistratieSucces(
              `${data.message} Log nu in met je e-mailadres en wachtwoord.`
            );
          }
        }

        setWachtwoord("");
        if (!isEigenaar) {
          setIsRegistreren(false);
        }
      } catch (err) {
        setFoutmelding("Er is een fout opgetreden bij registreren. Probeer het opnieuw.");
      } finally {
        setIsBezig(false);
      }

      return;
    }

    if (!email.trim() || !wachtwoord.trim()) return;

    try {
      setIsBezig(true);
      await loginMetGegevens(email, wachtwoord, (gebruiker) => {
        if (onthoudEmail) {
          saveRememberedEmail(email);
        } else {
          removeRememberedEmail();
        }
        onLogin(gebruiker);
      });
    } catch (err) {
      setFoutmelding(
        err instanceof Error ? err.message : "Er is een fout opgetreden bij inloggen. Probeer het opnieuw."
      );
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
          {serverOk === false && (
            <p className="login-hint login-error" role="alert">
              {["localhost", "127.0.0.1"].includes(window.location.hostname)
                ? "De backend is offline. Start lokaal met npm run dev en ververs de pagina."
                : "De server start nog of is even in slaap (Render). Wacht tot een minuut en ververs de pagina. Je kunt intussen al inloggen."}
            </p>
          )}
          {serverOk === true && databaseOk === false && (
            <p className="login-hint login-error" role="alert">
              De database is even niet bereikbaar. Wacht een paar seconden en probeer opnieuw in te loggen.
            </p>
          )}
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
            {isRegistreren && wordtEigenaar && (
              <p className="login-hint login-success">
                Dit account wordt geregistreerd als <strong>eigenaar</strong>. Je gegevens worden
                opgeslagen in de database.
              </p>
            )}
            {isRegistreren && !wordtEigenaar && email.trim() && (
              <p className="login-hint">
                Dit account wordt geregistreerd als <strong>medewerker</strong>.
              </p>
            )}
              </>
            )}
            {!resetToken && !isRegistreren && (
              <label className="form-label remember-row">
                <input
                  type="checkbox"
                  checked={onthoudEmail}
                  onChange={(e) => setOnthoudEmail(e.target.checked)}
                />
                <span>E-mailadres onthouden</span>
              </label>
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
              {isRegistreren
                ? wordtEigenaar
                  ? "Als eigenaar beheer je alle opdrachten en het team."
                  : "Medewerkers zien alleen hun eigen toegewezen opdrachten."
                : "Nog geen account? Registreer je hieronder."}
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

