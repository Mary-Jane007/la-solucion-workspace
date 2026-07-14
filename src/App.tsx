import { useCallback, useEffect, useMemo, useState } from "react";
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
import { badgeIdsVoorPagina } from "./badgeItems";
import { BadgeLijst, leesGezieneIds, markeerIdsGezien, telNieuweIds } from "./meldingenStatus";
import { NavBadges } from "./components/layout/AppNav";

const BADGE_PAGINAS: BadgeLijst[] = [
  "home",
  "bord",
  "kalender",
  "mijn-opdrachten",
  "meldingen",
  "deadlines",
  "activiteit",
  "klanten",
  "documenten",
  "prullenbak"
];

function IngelogdeApp({
  gebruiker,
  opdrachten,
  onOpdrachtenWijzig,
  prullenbakIds,
  onPrullenbakIdsWijzig,
  thema,
  onThemaWijzig,
  onLogout
}: {
  gebruiker: Gebruiker;
  opdrachten: Opdracht[];
  onOpdrachtenWijzig: (opdrachten: Opdracht[]) => void;
  prullenbakIds: string[];
  onPrullenbakIdsWijzig: (ids: string[]) => void;
  thema: Thema;
  onThemaWijzig: (thema: Thema) => void;
  onLogout: () => void;
}) {
  const [huidigePagina, setHuidigePagina] = useState<AppPagina>("home");
  const [badgeGezienTick, setBadgeGezienTick] = useState(0);
  const isEigenaar = gebruiker.rol === Rol.Eigenaar;

  const werkruimte = useOpdrachtenWerkruimte({
    gebruiker,
    isEigenaar,
    opdrachten,
    onOpdrachtenWijzig,
    onOpdrachtNaarPrullenbak: (opdrachtId) => {
      onPrullenbakIdsWijzig([opdrachtId, ...prullenbakIds.filter((id) => id !== opdrachtId)]);
    }
  });

  const badgeContext = useMemo(
    () => ({
      zichtbare: werkruimte.zichtbareOpdrachten,
      alle: werkruimte.alleOpdrachten,
      mijn: werkruimte.mijnOpdrachten,
      prullenbakIds
    }),
    [
      werkruimte.zichtbareOpdrachten,
      werkruimte.alleOpdrachten,
      werkruimte.mijnOpdrachten,
      prullenbakIds
    ]
  );

  const navBadges = useMemo(() => {
    const badges: NavBadges = {};
    for (const lijst of BADGE_PAGINAS) {
      badges[lijst] = telNieuweIds(
        badgeIdsVoorPagina(lijst, badgeContext),
        leesGezieneIds(lijst, gebruiker.id)
      );
    }
    return badges;
  }, [badgeContext, gebruiker.id, badgeGezienTick]);

  const handleBadgeGezien = useCallback(() => {
    setBadgeGezienTick((n) => n + 1);
  }, []);

  const handleNavigeer = (pagina: AppPagina) => {
    if (isEigenaarPagina(pagina) && !isEigenaar) {
      setHuidigePagina("home");
      return;
    }
    if ((BADGE_PAGINAS as string[]).includes(pagina)) {
      const lijst = pagina as BadgeLijst;
      markeerIdsGezien(lijst, gebruiker.id, badgeIdsVoorPagina(lijst, badgeContext));
      setBadgeGezienTick((n) => n + 1);
    }
    setHuidigePagina(pagina);
  };

  const handleNieuweOpdracht = () => {
    if (!isEigenaar) return;
    werkruimte.openNieuweOpdracht();
  };

  const handleThemaWissel = () => {
    onThemaWijzig(wisselThema(thema));
  };

  const vernieuwOpdrachten = async () => {
    const lijst = await fetchOpdrachten();
    onOpdrachtenWijzig(lijst);
    if (isEigenaar) {
      const prullenbak = await fetchPrullenbak();
      onPrullenbakIdsWijzig(prullenbak.map((o) => o.id));
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
          userId={gebruiker.id}
          onNieuweOpdracht={handleNieuweOpdracht}
          onGezien={handleBadgeGezien}
        />
      )}
      {huidigePagina === "bord" && (
        <OpdrachtenbordPagina
          werkruimte={werkruimte}
          isEigenaar={isEigenaar}
          userId={gebruiker.id}
          onNieuweOpdracht={handleNieuweOpdracht}
          onGezien={handleBadgeGezien}
        />
      )}
      {huidigePagina === "kalender" && (
        <KalenderPagina
          werkruimte={werkruimte}
          userId={gebruiker.id}
          onGezien={handleBadgeGezien}
        />
      )}
      {huidigePagina === "mijn-opdrachten" && (
        <MijnOpdrachtenPagina
          werkruimte={werkruimte}
          userId={gebruiker.id}
          onGezien={handleBadgeGezien}
        />
      )}
      {huidigePagina === "meldingen" && (
        <MeldingenPagina
          werkruimte={werkruimte}
          userId={gebruiker.id}
          onGezien={handleBadgeGezien}
        />
      )}
      {huidigePagina === "deadlines" && (
        <DeadlinesPagina
          werkruimte={werkruimte}
          userId={gebruiker.id}
          onGezien={handleBadgeGezien}
        />
      )}
      {huidigePagina === "statistieken" && isEigenaar && (
        <StatistiekenPagina werkruimte={werkruimte} />
      )}
      {huidigePagina === "klanten" && isEigenaar && (
        <KlantenPagina
          werkruimte={werkruimte}
          userId={gebruiker.id}
          onGezien={handleBadgeGezien}
        />
      )}
      {huidigePagina === "documenten" && isEigenaar && (
        <DocumentenPagina
          werkruimte={werkruimte}
          userId={gebruiker.id}
          onGezien={handleBadgeGezien}
        />
      )}
      {huidigePagina === "activiteit" && isEigenaar && (
        <ActiviteitPagina
          werkruimte={werkruimte}
          userId={gebruiker.id}
          onGezien={handleBadgeGezien}
        />
      )}
      {huidigePagina === "prullenbak" && isEigenaar && (
        <PrullenbakPagina
          opdrachten={opdrachten}
          userId={gebruiker.id}
          onOpdrachtenWijzig={onOpdrachtenWijzig}
          onPrullenbakIdsWijzig={onPrullenbakIdsWijzig}
          onGezien={handleBadgeGezien}
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
  const [prullenbakIds, setPrullenbakIds] = useState<string[]>([]);

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
              if (!isCancelled) setPrullenbakIds(prullenbak.map((o) => o.id));
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
    setPrullenbakIds([]);
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
                      .then((prullenbak) => setPrullenbakIds(prullenbak.map((o) => o.id)))
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
      prullenbakIds={prullenbakIds}
      onPrullenbakIdsWijzig={setPrullenbakIds}
      thema={thema}
      onThemaWijzig={handleThemaWijzig}
      onLogout={handleLogout}
    />
  );
}
