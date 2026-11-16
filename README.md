# KoalatyTime

KoalatyTime is a weekly planning website that makes room for existing plans, to-dos, fun activities, travel, and downtime. The planner interface is also referred to as **Sunday**.

The public website includes a [Privacy Policy](privacy.html). Calendar access is optional; the app has no account sign-in of its own.

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
- Export approved new activities and the weekly goal as one `.ics` file, or open prefilled Google Calendar links for individual events.
- Optionally contribute predefined activity families and rounded numeric corrections to a shared aggregate model. Event titles and account information are excluded from contributions.
- Spread new activities across the week, aiming for one fun activity per two to-dos per day where the list and available time allow.
- Reserve adjustable downtime, compare the week before and after, and move or remove activities in Review.
- Edit activities directly in their list rows, with Save and Cancel.
- Describe protected time in one field per day and a final whole-week field. Multiple windows combine (for example, “before 8 am and after 9 pm”). Overnight windows extend into the next day. Unclear rules must be corrected before building the week.
- Break homework, projects, and similar focused tasks into 30–45 minute parts while preserving the total requested time; the final part can be shorter. Fixed start times, travel, and requests for one sitting stay together. Parts that cannot fit are reported.
- Meet animated koala companions that wander along page elements and appear with varied motions on button hover or focus. Reduced-motion preferences keep the background and companions still.

Reading existing Google Calendar events is optional and requires the OAuth setup below. Saving a new plan uses an `.ics` download or individual Google Calendar links, so KoalatyTime does not need write access to a visitor's calendar. The `.ics` file can be imported into other calendar apps.

## Google Calendar

Follow [GOOGLE_CALENDAR_SETUP.md](GOOGLE_CALENDAR_SETUP.md) to register the localhost origin and configure OAuth. `config.js` contains a public browser client ID, which is not a client secret. Configure your own client ID when running your own copy. Never add a client secret or access token to this repository.

## Aggregate learning

See [CALIBRATION.md](CALIBRATION.md) for estimation rules, contribution fields, storage behavior, and limitations. Aggregates persist locally under `data/`, which is excluded from Git. Shared suggestions activate after five corrections per recognized activity family. This is a single-process local backend; it is not deployed by pushing this repository.

## Tests

Text interpretation runs locally using rules, rather than an external AI model. `parser-examples.json` is the regression corpus for activity and protected-time phrases. Add reported misinterpretations there with the intended constraints before adjusting the parser. Shared aggregate learning tunes activity estimates; it does not train a language model or collect raw requests.

```powershell
node --test planner.test.cjs estimate-backend.test.cjs review.test.cjs garden-motion.test.cjs
```
