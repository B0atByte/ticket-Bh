// Auto-reload the app when a newer build is deployed, so users (esp. on mobile)
// never have to clear their cache manually.
//
// The build id is baked in at build time (__BUILD_ID__). /__build returns the
// id of the version currently being served (no-store). On load, on tab focus,
// and periodically, we compare — if they differ, a new version is live → reload.

const CURRENT = typeof __BUILD_ID__ !== "undefined" ? __BUILD_ID__ : "";

export function startAutoUpdate() {
  if (!CURRENT) return;
  let reloading = false;

  async function check() {
    if (reloading) return;
    try {
      const res = await fetch("/__build", { cache: "no-store" });
      if (!res.ok) return;
      const latest = (await res.text()).trim();
      if (latest && latest !== CURRENT) {
        reloading = true;
        location.reload();
      }
    } catch {
      /* offline / unreachable — ignore */
    }
  }

  // Check when the user returns to the tab (common on mobile) and periodically.
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) check();
  });
  window.addEventListener("focus", check);
  setInterval(check, 60_000);
  check();
}
