import { lazy, Suspense } from 'react';

// Build-flavour boundary. __ANALYTICS__ is a compile-time constant defined in
// vite.config.ts. In the fdroid flavour it is false, this component returns
// null, and @vercel/analytics is excluded from the bundle entirely. Never
// replace this with a runtime toggle; F-Droid requires the dependency to be
// absent.

// Lazy load Analytics component only when analytics is enabled
const Analytics = __ANALYTICS__
  ? lazy(() =>
      import('@vercel/analytics/react').then((mod) => ({
        default: mod.Analytics,
      })),
    )
  : null;

export function AnalyticsProvider(): React.ReactElement | null {
  if (!__ANALYTICS__ || !Analytics) {
    return null;
  }

  return (
    <Suspense fallback={null}>
      <Analytics />
    </Suspense>
  );
}
