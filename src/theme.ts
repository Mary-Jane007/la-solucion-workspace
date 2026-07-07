export type Thema = "donker" | "licht";

const STORAGE_KEY = "la-solucion-thema";

export function getOpgeslagenThema(): Thema {
  const opgeslagen = window.localStorage.getItem(STORAGE_KEY);
  return opgeslagen === "licht" ? "licht" : "donker";
}

export function pasThemaToe(thema: Thema) {
  document.documentElement.dataset.theme = thema;
  window.localStorage.setItem(STORAGE_KEY, thema);
}

export function wisselThema(huidig: Thema): Thema {
  const volgend = huidig === "donker" ? "licht" : "donker";
  pasThemaToe(volgend);
  return volgend;
}
