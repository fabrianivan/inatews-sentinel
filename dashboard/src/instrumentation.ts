/**
 * Runs once when a Next.js server starts. On the Node.js runtime it starts the Web Push check
 * (see `lib/server/pushCheck`), which does nothing unless VAPID keys are configured.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startPushScheduler } = await import('./lib/server/pushCheck');
    startPushScheduler();
  }
}
