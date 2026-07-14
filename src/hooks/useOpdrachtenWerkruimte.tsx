import { useEffect, useMemo, useState } from "react";
import { Gebruiker, Opdracht, OpdrachtStatus } from "../types";
import { createOpdracht, deleteOpdracht, updateOpdracht } from "../api";
import { opdrachtVerwijderBevestiging } from "../opdrachtVerwijderen";
import { filterMijnOpdrachten, filterZichtbareOpdrachten } from "../opdrachtenUtils";
import { OpdrachtDialoog } from "../components/OpdrachtDialoog";

interface BeheerGebruiker {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
}

type DialoogMode = "toevoegen" | "bewerken" | "bekijken" | null;

interface Params {
  gebruiker: Gebruiker;
  isEigenaar: boolean;
  opdrachten: Opdracht[];
  onOpdrachtenWijzig: (opdrachten: Opdracht[]) => void;
  onOpdrachtNaarPrullenbak?: (opdrachtId: string) => void;
}

export function useOpdrachtenWerkruimte({
  gebruiker,
  isEigenaar,
  opdrachten,
  onOpdrachtenWijzig,
  onOpdrachtNaarPrullenbak
}: Params) {
  const [dialoogMode, setDialoogMode] = useState<DialoogMode>(null);
  const [geselecteerdeOpdracht, setGeselecteerdeOpdracht] = useState<Opdracht | null>(null);
  const [beheerGebruikers, setBeheerGebruikers] = useState<BeheerGebruiker[]>([]);
  const [opdrachtFout, setOpdrachtFout] = useState<string | null>(null);

  const draftOpdracht = useMemo((): Opdracht => {
    const vandaag = new Date().toISOString().slice(0, 10);
    return {
      id: "",
      klantNaam: "",
      omschrijving: "",
      datumAangemaakt: vandaag,
      status: OpdrachtStatus.Nieuw,
      prioriteit: 2,
      behandelaarUserId: null,
      behandelaarNaam: null,
      notities: "",
      categorie: "",
      bestanden: []
    };
  }, []);

  useEffect(() => {
    if (!isEigenaar) return;
    const token = window.localStorage.getItem("la-solucion-token");
    if (!token) return;
    let isCancelled = false;
    const fetchUsers = async () => {
      try {
        const res = await fetch("/api/admin/users", {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (!res.ok || isCancelled) return;
        setBeheerGebruikers(data.users || []);
      } catch {
        // optioneel voor toewijzing
      }
    };
    void fetchUsers();
    return () => {
      isCancelled = true;
    };
  }, [isEigenaar]);

  const zichtbareOpdrachten = useMemo(
    () => filterZichtbareOpdrachten(opdrachten, gebruiker, isEigenaar),
    [opdrachten, gebruiker, isEigenaar]
  );

  const mijnOpdrachten = useMemo(
    () => filterMijnOpdrachten(opdrachten, gebruiker),
    [opdrachten, gebruiker]
  );

  const handleOpdrachtUpdate = async (opdracht: Opdracht) => {
    try {
      setOpdrachtFout(null);
      const saved = await updateOpdracht(opdracht);
      onOpdrachtenWijzig(opdrachten.map((o) => (o.id === saved.id ? saved : o)));
      setGeselecteerdeOpdracht(saved);
      return saved;
    } catch (e) {
      setOpdrachtFout("Opslaan mislukt. Controleer je verbinding en probeer opnieuw.");
      throw e;
    }
  };

  const openOpdracht = (opdracht: Opdracht) => {
    setDialoogMode(isEigenaar ? "bewerken" : "bekijken");
    setGeselecteerdeOpdracht(opdracht);
  };

  const openNieuweOpdracht = () => {
    setDialoogMode("toevoegen");
    setGeselecteerdeOpdracht(draftOpdracht);
  };

  const sluitDialoog = () => {
    setDialoogMode(null);
    setGeselecteerdeOpdracht(null);
  };

  const handleCreateOpdracht = async (draft: Opdracht) => {
    setOpdrachtFout(null);
    const nieuw = await createOpdracht({
      klantNaam: draft.klantNaam || "Naam klant",
      omschrijving: draft.omschrijving || "Omschrijving",
      datumAangemaakt: draft.datumAangemaakt,
      datumDeadline: draft.datumDeadline || undefined,
      status: draft.status,
      prioriteit: draft.prioriteit,
      behandelaarUserId: draft.behandelaarUserId || (isEigenaar ? null : gebruiker.id),
      behandelaarNaam: draft.behandelaarNaam || null,
      notities: draft.notities || "",
      categorie: draft.categorie || "",
      bestanden: []
    });
    onOpdrachtenWijzig([nieuw, ...opdrachten]);
    sluitDialoog();
  };

  const handleDeleteOpdracht = async (opdrachtId: string) => {
    setOpdrachtFout(null);
    await deleteOpdracht(opdrachtId);
    onOpdrachtenWijzig(opdrachten.filter((o) => o.id !== opdrachtId));
    onOpdrachtNaarPrullenbak?.(opdrachtId);
    sluitDialoog();
  };

  const handleVerwijderMetBevestiging = async (opdracht: Opdracht) => {
    const bevestigd = window.confirm(opdrachtVerwijderBevestiging(opdracht.klantNaam));
    if (!bevestigd) return;
    await handleDeleteOpdracht(opdracht.id);
  };

  const dialoog =
    dialoogMode !== null && geselecteerdeOpdracht ? (
      <OpdrachtDialoog
        key={
          dialoogMode === "toevoegen"
            ? "opdracht-nieuw"
            : `opdracht-${geselecteerdeOpdracht.id}`
        }
        mode={dialoogMode}
        opdracht={geselecteerdeOpdracht}
        isEigenaar={isEigenaar}
        teamGebruikers={beheerGebruikers}
        bestaandeOpdrachten={opdrachten}
        onSluit={sluitDialoog}
        onBewaar={handleOpdrachtUpdate}
        onCreate={handleCreateOpdracht}
        onDelete={isEigenaar ? handleDeleteOpdracht : undefined}
      />
    ) : null;

  return {
    zichtbareOpdrachten,
    mijnOpdrachten,
    alleOpdrachten: opdrachten,
    opdrachtFout,
    openOpdracht,
    openNieuweOpdracht,
    handleOpdrachtUpdate,
    handleVerwijderMetBevestiging,
    dialoog
  };
}

export type OpdrachtenWerkruimte = ReturnType<typeof useOpdrachtenWerkruimte>;
