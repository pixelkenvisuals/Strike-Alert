# Strike Alert Belgium

Live strike tracking for STIB/MIVB, NMBS/SNCB, and Brussels Airport, with browser push
notifications and a NL/FR/EN dashboard.

## How it works

- **NMBS/SNCB** — [iRail](https://docs.irail.be) `/disturbances` API (public, no key).
- **STIB/MIVB** — the "Travellers Information" JSON API on STIB's own open-data portal,
  [data.belgianmobility.io](https://data.belgianmobility.io) (public, no key).
- **Brussels Airport** — no public disruption API exists and the airport's own site
  blocks automated requests, so this is covered via keyword-filtered scans of Belgian
  news RSS feeds (VRT, RTBF, Bruzz) for "Brussels Airport" + strike mentions.
- All three feeds are filtered down to items that match strike-related keywords
  (`staking`/`grève`/`strike` and inflections) in `lib/sources/news.ts`'s
  `matchesStrikeKeywords` — this app deliberately only tracks strikes, not every minor
  service diversion.

New events are stored in a local SQLite database (`data/strike-alert.db`, created
automatically) and trigger a browser push notification to anyone subscribed.

## First-time setup

```bash
npm install
npm run generate-vapid-keys   # one-time: writes push notification keys to .env.local
npm run build
```

Open http://localhost:3000, click **Enable notifications**, and allow the browser
permission prompt.

## Running the dashboard server automatically

The server is already set up to start on its own — a shortcut at
`shell:startup` (`Strike Alert Server.lnk`, pointing to `scripts\start-server.bat`)
launches `next start` minimized whenever you log into Windows, so you don't need to
run `npm run dev` yourself each session.

- **Check if it's running:** open http://localhost:3000 — if it loads, it's up.
- **Start it manually** (e.g. right after plugging in the external drive):
  double-click `scripts\start-server.bat`, or run it from a terminal.
- **Stop it:** find the `node.exe` process serving port 3000 (Task Manager, or
  `Get-Process node`) and end it.
- Because the project lives on an external drive, the startup script will simply fail
  silently at login if the drive isn't plugged in yet — just run
  `scripts\start-server.bat` once the drive is connected.

(A Task Scheduler "run at logon" entry was the original plan, but this machine's
scheduler policy denies registering logon-triggered tasks from a non-elevated session
— the Startup-folder shortcut achieves the same result without needing elevation.)

## Fetching new data

The dashboard only *displays* what's already in the database — something has to
actually poll the sources. Two ways to trigger a poll:

- **While the dev/prod server is running:** `GET http://localhost:3000/api/cron/poll`
- **Standalone (no server needed):** `npm run poll`

### Running it automatically (Windows Task Scheduler)

To poll every 10 minutes without keeping a terminal open:

1. Open Task Scheduler → **Create Task…**
2. General tab: name it "Strike Alert Poll", check "Run whether user is logged on or not" if desired.
3. Triggers tab → New → **Daily**, recur every 1 day → Advanced settings: **Repeat task every 10 minutes** for a duration of **Indefinitely**.
4. Actions tab → New:
   - Program/script: `C:\Program Files\nodejs\node.exe`
   - Add arguments: `node_modules\tsx\dist\cli.mjs scripts\poll.ts`
   - Start in: `F:\Strike Alert`
5. Save. Since the project lives on an external drive, add a condition (Conditions tab)
   or accept that the task will simply fail harmlessly if the drive isn't plugged in.

You can also create this from an elevated PowerShell prompt with `schtasks /create`,
if you'd rather script it than use the GUI — ask and it can be set up for you.

## Notes / known limitations

- Notifications require the site to have been opened at least once in the browser
  used (to register the service worker and grant permission) — this is a browser
  requirement, not something the app can bypass.
- The STIB and Brussels Airport sources were discovered by hand during development;
  if either changes its API/site structure, `lib/sources/stib.ts` or
  `lib/sources/airport.ts` will need updating.
- This runs entirely locally/free — no third-party accounts (Firebase, OneSignal,
  etc.) are required for push notifications; VAPID keys are self-generated.

## Deploying beyond localhost

This is a standard Next.js app, deployable to Vercel/Render free tiers. If deployed,
you'll need an external scheduler (e.g. a free cron service, or GitHub Actions on a
schedule) to hit `/api/cron/poll` periodically, since there's no built-in cron in
Next.js itself.
