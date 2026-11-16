# KoalatyTime

A weekly planning website, currently branded **Sunday**, that makes room for existing plans, to-dos, fun activities, travel, and downtime.

## Run locally

Install a current Node.js LTS release, then run this command from the project folder:

```powershell
node server.cjs
```

Open [http://localhost:5173](http://localhost:5173). No package installation is required. The server binds to localhost.

## What works

- Read existing events from your primary Google Calendar after OAuth setup.
- Review plans in a responsive seven-day calendar with expandable day details.
- Enter activities in plain language, with days, times, recurrence, durations, and travel buffers.
- Correct estimated categories, durations, and travel time.
- Add approved new activities and the weekly goal block to Google Calendar after confirmation.
- Optionally contribute predefined activity families and rounded numeric corrections to a shared aggregate model. Event titles and account information are excluded from contributions.
- Spread new activities across the week, aiming for one fun activity per two to-dos per day where the list and available time allow.
- Reserve adjustable downtime, compare the week before and after, and move or remove activities in Review.

Google Calendar reading and writing require the OAuth setup below. Tokens stay in tab memory. Apple Calendar and screenshot uploads are not currently supported.

## Google Calendar

Follow [GOOGLE_CALENDAR_SETUP.md](GOOGLE_CALENDAR_SETUP.md) to register the localhost origin and configure OAuth. `config.js` contains a public browser client ID, which is not a client secret. Configure your own client ID when running your own copy. Never add a client secret or access token to this repository.

## Aggregate learning

See [CALIBRATION.md](CALIBRATION.md) for estimation rules, contribution fields, storage behavior, and limitations. Aggregates persist locally under `data/`, which is excluded from Git. Shared suggestions activate after five corrections per recognized activity family. This is a single-process local backend; it is not deployed by pushing this repository.

## Tests

```powershell
node --test planner.test.cjs estimate-backend.test.cjs review.test.cjs
```
