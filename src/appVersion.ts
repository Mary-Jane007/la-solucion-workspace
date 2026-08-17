const RELOAD_KEY = "la-solucion-boot-reload";

async function wisOudeCaches() {
  if ("serviceWorker" in navigator) {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map((reg) => reg.unregister()));
  }
  if (typeof caches !== "undefined") {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
  }
}

async function remoteVersie(): Promise<string | null> {
  const res = await fetch(`/version.json?t=${Date.now()}`, {
    cache: "no-store",
    headers: { "Cache-Control": "no-cache", Pragma: "no-cache" }
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { version?: string };
  return data.version || null;
}

async function laadNieuwsteVersie() {
  const huidig = typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "";
  let remote: string | null = null;
  try {
    remote = await remoteVersie();
  } catch {
    return;
  }
  if (!remote || remote === huidig) {
    sessionStorage.removeItem(RELOAD_KEY);
    return;
  }
  if (sessionStorage.getItem(RELOAD_KEY) === remote) return;
  sessionStorage.setItem(RELOAD_KEY, remote);
  window.location.reload();
}

/** Zorgt dat een herstart van de app de nieuwste build pakt, zonder handmatige hard refresh. */
export function startAppVersieBewaking() {
  void wisOudeCaches().then(() => laadNieuwsteVersie());

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void laadNieuwsteVersie();
  });

  window.addEventListener("pageshow", (event) => {
    if (event.persisted) window.location.reload();
  });

  window.addEventListener("focus", () => {
    void laadNieuwsteVersie();
  });
}
