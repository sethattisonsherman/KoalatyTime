# Activity estimates and a balanced week

The local planner uses editable activity profiles; it does not call an AI or routing service. These values are starting assumptions, not measured travel or personal pace.

## Estimates

- Specific leisure phrases (date night, climbing, wandering, and others) get a category, activity duration, and travel estimate per direction. Context such as “for work,” “homework,” or “appointment” can mark an activity as a to-do.
- Explicit activity durations take priority over shared defaults. “Travel 20 minutes each way” is parsed separately from activity duration. “Online,” “at home,” “from home,” “remote,” and “virtual” default to zero travel.
- **Adjust estimates** corrects all three values. The correction always updates the current draft. **Improve shared estimates with this correction** optionally sends only a predefined activity family, Fun/To-do category, and rounded duration/travel buckets to the local backend. No title, title hash, names, locations, dates, account IDs, Google tokens, or free text is sent in the contribution. Title-based browser preferences from the earlier version are removed on load.
- Unrecognized activities are labeled **Rough estimate** and start at 45 minutes. Corrections are the best way to improve their interpretation.
- Travel buffers are reserved on both sides of new outings and inferred from the titles of existing timed calendar plans. Calendar events marked all-day have no extra travel. There are no addresses or route-aware estimates, and neighboring outings currently each keep their own buffer.

## Shared learning backend

Run `node server.cjs` and open http://localhost:5173. The same Node server handles the website and learning endpoints; no paid API or database is needed. All instances served by this process share the learned defaults. File-based browsing still supports draft edits but cannot contribute to or fetch backend learning.

- `POST /api/estimate-feedback` accepts exactly `family`, `type`, `durationBucket`, and `travelBucket`. Fixed allowlists reject arbitrary text and extra fields. The client maps titles to families before sending anything; unknown activities and specially qualified activities (such as “for work,” “quick,” or “online”) do not contribute. It cannot learn new vocabulary from private titles it never receives.
- The backend increments independent category and numeric bucket histograms. It persists only these aggregate counts in `data/estimate-aggregates.json`, which is excluded from Git and not served as a static file. Writes are serialized and atomic within one Node process. Individual submissions, timestamps, identifiers, cookies, and IP addresses are not persisted or logged by this application. Separate web hosts or proxies could have their own logging policies; none are configured here.
- `GET /api/estimate-model` returns a family's learned majority category and median duration/travel buckets after at least five contributions. Before then the built-in estimates apply. A category tie leaves the built-in category in place. The threshold counts submissions, not distinct people, and is not a guarantee of anonymity or resistance to manipulated feedback.
- The browser fetches the model on startup and after a successful contribution. It changes suggestions for newly parsed activities; it does not silently overwrite a manually corrected draft. For example, corrections to climbing can improve future bouldering suggestions in the same activity family. Explicit durations and special contexts still take precedence.
- Only explicit user corrections contribute. Initial suggestions, automatically loaded calendars, and app-generated estimates are never fed back as observations. Nothing is queued in browser storage when the backend is unavailable.
- The development server binds to localhost, checks Host/Origin on contribution requests, limits request bodies to 1 KiB, and allows at most 120 attempted contributions per minute globally. This is a single-process local implementation; a public deployment needs a shared transactional database and abuse controls before accepting public feedback.

For future calibration from actual completion times, collect optional rounded activity-family statistics using the same approach. Current learning uses estimate corrections, not measured completion or route data.

## Scheduling

The planner places fixed appointments first, protects downtime where possible, then fills remaining openings. Travel counts against available time; travel and downtime do not count as new fun or to-do items. Default downtime is 30 minutes on each selected day, preferably in the evening; 0 disables it.

Flexible activities aim for daily groups of two to-dos and one fun activity. Smaller lists use days spaced across the week; larger lists use all selected days. Placement scores use the count of new activities and category balance, rather than treating the emptiest existing calendar as the preferred day. Fixed dates, recurrence, deadlines, exclusions, travel, and unavailable time take priority. The ratio is a target, not a hard requirement: no items are fabricated, duplicated, or silently dropped to force it. Requests without room appear as unscheduled.

Run regressions with `node --test planner.test.cjs estimate-backend.test.cjs`.
