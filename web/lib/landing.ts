// Where a visitor's first visit came from: a share-link tag (?ref=instagram) or the
// referring site. Kept in this browser only, and sent once, with the sign-up form.
const KEY = "eidothea.landing";

export function rememberLanding(ref: string | null, referrer: string) {
  try {
    if (localStorage.getItem(KEY)) return;
    let source = ref ?? "";
    if (!source && referrer) {
      const host = new URL(referrer).hostname.replace(/^(www|m)\./, "");
      if (host !== location.hostname) source = host;
    }
    localStorage.setItem(KEY, source || "direct");
  } catch {}
}

export function landing(): string | undefined {
  try {
    return localStorage.getItem(KEY) ?? undefined;
  } catch {
    return undefined;
  }
}
