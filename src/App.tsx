import { useEffect, useMemo, useState } from "react";
import { LoginScherm } from "./components/LoginScherm";
import { Dashboard } from "./components/Dashboard";
import { OpdrachtenbordPagina } from "./components/OpdrachtenbordPagina";
import { KalenderPagina } from "./components/KalenderPagina";
import { MijnOpdrachtenPagina } from "./components/MijnOpdrachtenPagina";
import { MeldingenPagina } from "./components/MeldingenPagina";
import { DeadlinesPagina } from "./components/DeadlinesPagina";
import { StatistiekenPagina } from "./components/StatistiekenPagina";
import { KlantenPagina } from "./components/KlantenPagina";
import { DocumentenPagina } from "./components/DocumentenPagina";
import { ActiviteitPagina } from "./components/ActiviteitPagina";
import { PrullenbakPagina } from "./components/PrullenbakPagina";
import { TeamPagina } from "./components/TeamPagina";
import { ExportPagina } from "./components/ExportPagina";
import { ProfielPagina } from "./components/ProfielPagina";
import { InstellingenPagina } from "./components/InstellingenPagina";
import { HelpPagina } from "./components/HelpPagina";
import { ContactPagina } from "./components/ContactPagina";
import { AppLayout } from "./components/layout/AppLayout";
import { Gebruiker, Opdracht, Rol } from "./types";
import { clearToken, fetchMe, fetchOpdrachten, fetchPrullenbak, getToken } from "./api";
import { AppPagina, isEigenaarPagina } from "./appPages";
import { getOpgeslagenThema, pasThemaToe, Thema, wisselThema } from "./theme";
import { useOpdrachtenWerkruimte } from "./hooks/useOpdrachtenWerkruimte";
import { berekenMeldingen, telDeadlinesBadge } from "./opdrachtenUtils";

function IngelogdeApp({
  gebruiker,
  opdrachten,
  onOpdrachtenWijzig,
  prullenbakAantal,
  onPrullenbakAantalWijzig,
  thema,
  onThemaWijzig,
  onLogout
}: {
  gebruiker: Gebruiker;
  opdrachten: Opdracht[];
  onOpdrachtenWijzig: (opdrachten: Opdracht[]) => void;
  prullenbakAantal: number;
  onPrullenbakAantalWijzig: (aantal: number) => void;
  thema: Thema;
  onThemaWijzig: (thema: Thema) => void;
  onLogout: () => void;
}) {
  const [huidigePagina, setHuidigePagina] = useState<AppPagina>("home");
  const isEigenaar = gebruiker.rol === Rol.Eigenaar;

  const werkruimte = useOpdrachtenWerkruimte({
    gebruiker,
    isEigenaar,
    opdrachten,
    onOpdrachtenWijzig
  });

  const navBadges = useMemo(
    () => ({
      meldingen: berekenMeldingen(werkruimte.zichtbareOpdrachten).length,
      deadlines: telDeadlinesBadge(werkruimte.zichtbareOpdrachten),
      prullenbak: prullenbakAantal
    }),
    [werkruimte.zichtbareOpdrachten, prullenbakAantal]
  );

  const handleNavigeer = (pagina: AppPagina) => {
    if (isEigenaarPagina(pagina) && !isEigenaar) {
      setHuidigePagina("home");
      return;
    }
    setHuidigePagina(pagina);
  };

  const handleNieuweOpdracht = () => {
    if (!isEigenaar) return;
    werkruimte.openNieuweOpdracht();
    setHuidigePagina("home");
  };

  const handleThemaWissel = () => {
    onThemaWijzig(wisselThema(thema));
  };

  const vernieuwOpdrachten = async () => {
    const lijst = await fetchOpdrachten();
    onOpdrachtenWijzig(lijst);
    if (isEigenaar) {
      const prullenbak = await fetchPrullenbak();
      onPrullenbakAantalWijzig(prullenbak.length);
    }
  };

  return (
    <AppLayout
      gebruiker={gebruiker}
      huidigePagina={huidigePagina}
      isEigenaar={isEigenaar}
      thema={thema}
      navBadges={navBadges}
      onNavigeer={handleNavigeer}
      onNieuweOpdracht={handleNieuweOpdracht}
      onThemaWissel={handleThemaWissel}
      onLogout={onLogout}
    >
      {huidigePagina === "home" && (
        <Dashboard
          werkruimte={werkruimte}
          isEigenaar={isEigenaar}
          onNieuweOpdracht={handleNieuweOpdracht}
        />
      )}
      {huidigePagina === "bord" && (
        <OpdrachtenbordPagina werkruimte={werkruimte} isEigenaar={isEigenaar} />
      )}
      {huidigePagina === "kalender" && <KalenderPagina werkruimte={werkruimte} />}
      {huidigePagina === "mijn-opdrachten" && <MijnOpdrachtenPagina werkruimte={werkruimte} />}
      {huidigePagina === "meldingen" && <MeldingenPagina werkruimte={werkruimte} />}
      {huidigePagina === "deadlines" && <DeadlinesPagina werkruimte={werkruimte} />}
      {huidigePagina === "statistieken" && isEigenaar && (
        <StatistiekenPagina werkruimte={werkruimte} />
      )}
      {huidigePagina === "klanten" && isEigenaar && <KlantenPagina werkruimte={werkruimte} />}
      {huidigePagina === "documenten" && isEigenaar && (
        <DocumentenPagina werkruimte={werkruimte} />
      )}
      {huidigePagina === "activiteit" && isEigenaar && (
        <ActiviteitPagina werkruimte={werkruimte} />
      )}
      {huidigePagina === "prullenbak" && isEigenaar && (
        <PrullenbakPagina
          opdrachten={opdrachten}
          onOpdrachtenWijzig={onOpdrachtenWijzig}
          onAantalWijzig={onPrullenbakAantalWijzig}
        />
      )}
      {huidigePagina === "team" && isEigenaar && <TeamPagina />}
      {huidigePagina === "export" && isEigenaar && <ExportPagina werkruimte={werkruimte} />}
      {huidigePagina === "profiel" && <ProfielPagina gebruiker={gebruiker} />}
      {huidigePagina === "instellingen" && (
        <InstellingenPagina
          thema={thema}
          onThemaKies={onThemaWijzig}
          onVernieuwOpdrachten={vernieuwOpdrachten}
        />
      )}
      {huidigePagina === "help" && <HelpPagina />}
      {huidigePagina === "contact" && <ContactPagina />}
      {werkruimte.dialoog}
    </AppLayout>
  );
}

export function App() {
  const [ingelogdeGebruiker, setIngelogdeGebruiker] = useState<Gebruiker | null>(null);
  const [opdrachten, setOpdrachten] = useState<Opdracht[]>([]);
  const [laden, setLaden] = useState(true);
  const [fout, setFout] = useState<string | null>(null);
  const [thema, setThema] = useState<Thema>(() => getOpgeslagenThema());
  const [prullenbakAantal, setPrullenbakAantal] = useState(0);

  useEffect(() => {
    pasThemaToe(thema);
  }, [thema]);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLaden(false);
      return;
    }

    let isCancelled = false;
    const SESSION_TIMEOUT_MS = 15000;

    const withTimeout = <T,>(promise: Promise<T>, label: string): Promise<T> =>
      Promise.race([
        promise,
        new Promise<T>((_, reject) =>
          setTimeout(() => reject(new Error(`${label} duurde te lang.`)), SESSION_TIMEOUT_MS)
        )
      ]);

    const init = async () => {
      try {
        const me = await withTimeout(fetchMe(), "Sessie");
        const lijst = await withTimeout(fetchOpdrachten(), "Opdrachten");
        if (isCancelled) return;
        setIngelogdeGebruiker(me);
        setOpdrachten(
          lijst.map((o) => ({
            ...o,
            bestanden: o.bestanden ?? []
          }))
        );
        if (me.rol === Rol.Eigenaar) {
          void fetchPrullenbak()
            .then((prullenbak) => {
              if (!isCancelled) setPrullenbakAantal(prullenbak.length);
            })
            .catch(() => {
              // prullenbak is optioneel bij opstarten
            });
        }
      } catch {
        clearToken();
        if (!isCancelled) {
          setIngelogdeGebruiker(null);
          setOpdrachten([]);
        }
      } finally {
        setLaden(false);
      }
    };

    void init();
    return () => {
      isCancelled = true;
    };
  }, []);

  const handleLogout = () => {
    clearToken();
    setIngelogdeGebruiker(null);
    setOpdrachten([]);
    setPrullenbakAantal(0);
  };

  const handleThemaWijzig = (gekozen: Thema) => {
    pasThemaToe(gekozen);
    setThema(gekozen);
  };

  if (!ingelogdeGebruiker) {
    return (
      <AppLayout thema={thema}>
        {laden ? (
          <div className="card">
            <h2>Even laden...</h2>
            <p className="muted">Bezig met sessie herstellen.</p>
          </div>
        ) : (
          <>
            {fout && (
              <div className="card" style={{ marginBottom: 12 }}>
                <p className="muted page-error">{fout}</p>
              </div>
            )}
            <LoginScherm
              onLogin={async (g) => {
                setIngelogdeGebruiker(g);
                try {
                  const lijst = await fetchOpdrachten();
                  setOpdrachten(
                    lijst.map((o) => ({
                      ...o,
                      bestanden: o.bestanden ?? []
                    }))
                  );
                  if (g.rol === Rol.Eigenaar) {
                    void fetchPrullenbak()
                      .then((prullenbak) => setPrullenbakAantal(prullenbak.length))
                      .catch(() => {
                        // optioneel
                      });
                  }
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
    <IngelogdeApp
      gebruiker={ingelogdeGebruiker}
      opdrachten={opdrachten}
      onOpdrachtenWijzig={setOpdrachten}
      prullenbakAantal={prullenbakAantal}
      onPrullenbakAantalWijzig={setPrullenbakAantal}
      thema={thema}
      onThemaWijzig={handleThemaWijzig}
      onLogout={handleLogout}
    />
  );
}
