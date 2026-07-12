// Build-flavour boundary. __ANALYTICS__ is a compile-time constant defined in
// vite.config.ts. In the fdroid flavour it is false, this branch is dead code,
// and @vercel/analytics is excluded from the bundle entirely. Never replace
// this with a runtime toggle; F-Droid requires the dependency to be absent.
export async function initAnalytics(): Promise<void> {
  if (__ANALYTICS__) {
    const { inject } = await import('@vercel/analytics');
    inject();
  }
}
