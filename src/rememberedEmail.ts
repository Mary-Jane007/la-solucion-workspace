const EMAIL_KEY = "la-solucion-remembered-login-email";
const ENABLED_KEY = "la-solucion-remember-login";

function migrateLegacyStorage() {
  const current = window.localStorage.getItem(EMAIL_KEY);
  if (current) return;

  const legacy = window.localStorage.getItem("la-solucion-email");
  if (legacy) {
    window.localStorage.setItem(EMAIL_KEY, legacy.trim().toLowerCase());
    window.localStorage.setItem(ENABLED_KEY, "true");
    window.localStorage.removeItem("la-solucion-email");
    return;
  }

  const lastUserId = window.localStorage.getItem("la-solucion-last-remembered-user");
  const rawMap = window.localStorage.getItem("la-solucion-remembered-emails");
  if (!lastUserId || !rawMap) return;

  try {
    const map = JSON.parse(rawMap) as Record<string, string>;
    const email = map[lastUserId];
    if (email) {
      window.localStorage.setItem(EMAIL_KEY, email);
      window.localStorage.setItem(ENABLED_KEY, "true");
    }
  } catch {
    // negeer ongeldige oude data
  }
}

/** E-mail voor dit browserprofiel (apparaat / Google-account in Chrome). */
export function getRememberedEmailForLogin(): string {
  migrateLegacyStorage();
  if (window.localStorage.getItem(ENABLED_KEY) === "false") return "";
  return window.localStorage.getItem(EMAIL_KEY) || "";
}

export function isRememberEmailEnabled(): boolean {
  migrateLegacyStorage();
  return window.localStorage.getItem(ENABLED_KEY) !== "false";
}

export function saveRememberedEmail(email: string) {
  window.localStorage.setItem(EMAIL_KEY, email.trim().toLowerCase());
  window.localStorage.setItem(ENABLED_KEY, "true");
}

export function removeRememberedEmail() {
  window.localStorage.removeItem(EMAIL_KEY);
  window.localStorage.setItem(ENABLED_KEY, "false");
}
