This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## Location notifications and Web Push

The dashboard notifies about BMKG tsunami statements and nearby BMKG earthquakes / MAGMA
eruptions as browser notifications (service worker `public/sw.js`). With Web Push the server
keeps sending them while every dashboard tab is closed. Push needs these server variables
(in `.env.local` for development; never commit the private key):

| Variable | Meaning |
| --- | --- |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | Key pair, generate with `npx web-push generate-vapid-keys` |
| `VAPID_SUBJECT` | Contact for push services: your own `mailto:` or `https:` address |
| `PUSH_STORE_PATH` | Optional; default `.data/push-subscriptions.json` |
| `CRON_SECRET` | Optional; enables `GET /api/push/check` (Bearer token) for hosts without a long-running process |

Without the keys, notifications still work while a tab is open. A long-running server
(`next start`, Docker) checks the feeds every minute on its own (`src/instrumentation.ts`);
in Docker, mount a volume on `/app/.data` so subscriptions survive a restart. A serverless
host has no lasting disk or process: it needs a database for the subscriptions and a
scheduler calling `/api/push/check`.

The server stores, per subscribed browser, only the push address, radius, kinds and either a
chosen city or the browser position rounded to ±20 km; it is deleted when notifications are
switched off.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
