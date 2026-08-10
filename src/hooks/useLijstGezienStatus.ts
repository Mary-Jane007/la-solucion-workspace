import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BadgeLijst,
  leesGeopendeIds,
  markeerIdGeopend,
  markeerIdsGezien
} from "../meldingenStatus";

export function useLijstGezienStatus(
  lijst: BadgeLijst,
  userId: string,
  itemIds: string[],
  onGezien: () => void
) {
  const idsKey = useMemo(
    () =>
      [...itemIds]
        .filter(Boolean)
        .sort()
        .join("|"),
    [itemIds]
  );

  const [geopendIds, setGeopendIds] = useState(() => leesGeopendeIds(lijst, userId));

  useEffect(() => {
    setGeopendIds(leesGeopendeIds(lijst, userId));
  }, [lijst, userId]);

  useEffect(() => {
    const ids = idsKey ? idsKey.split("|") : [];
    markeerIdsGezien(lijst, userId, ids);
    onGezien();
  }, [lijst, userId, idsKey, onGezien]);

  const markeerGeopend = useCallback(
    (itemId: string) => {
      setGeopendIds(markeerIdGeopend(lijst, userId, itemId));
    },
    [lijst, userId]
  );

  const isOngelezen = useCallback((itemId: string) => !geopendIds.has(itemId), [geopendIds]);

  return { isOngelezen, markeerGeopend, geopendIds };
}
