/**
 * Chrome / Edge / Samsung Internet offer "install this site" once per page
 * load, often before any button is on screen. We catch that offer as soon as
 * the site starts and keep it here, so an "Přidat na plochu" button anywhere
 * can use it later with a single tap.
 */
type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

let deferred: InstallEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

/** Inline in <head>: catches the offer even before the page's scripts have started. */
export const EARLY_CATCH =
  "addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__octoInstall=e})";

export function catchInstallPrompt() {
  const early = (window as { __octoInstall?: InstallEvent }).__octoInstall;
  if (early && !deferred) {
    deferred = early;
    notify();
  }
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // keep the browser's own mini-bar away – our button asks instead
    deferred = e as InstallEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    installed = true;
    deferred = null;
    notify();
  });
}

export const subscribeInstall = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
export const canPromptInstall = () => !!deferred;
export const justInstalled = () => installed;

/** Shows the browser's install dialog; true when the visitor confirmed. */
export async function promptInstall() {
  if (!deferred) return false;
  const e = deferred;
  deferred = null;
  notify();
  await e.prompt();
  const { outcome } = await e.userChoice;
  if (outcome === "accepted") {
    installed = true;
    notify();
  }
  return outcome === "accepted";
}

/** Running as the app from the home screen. */
export const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches || !!(navigator as { standalone?: boolean }).standalone;
