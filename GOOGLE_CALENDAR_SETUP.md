# Connect Google Calendar locally

This version uses Google Identity Services and the Calendar REST API directly from the browser. No paid integration service, API key, client secret, backend hosting, or database is needed. Google Cloud is used to register the app, even when running locally.

Google documents standard Calendar API usage as available at no additional cost, subject to quotas. Leave billing disabled and do not request paid quota increases for this prototype. Review current terms before launching publicly:
https://developers.google.com/workspace/calendar/api/guides/quota

## 1. Run Sunday locally

In PowerShell, from this folder:

```powershell
node server.cjs
```

Open http://localhost:5173. Keep PowerShell running. Opening index.html as a file still displays the interface, but Google OAuth needs an authorized HTTP origin.

## 2. Register your app with Google

1. Open https://console.cloud.google.com/ and create or select a project. Billing is not needed for this local prototype; skip paid trials.
2. In APIs & Services, enable **Google Calendar API**.
3. Open **Google Auth platform → Branding** and configure the app name (**KoalatyTime**), support email, and contact email. Keep this name consistent with the public website.
4. Under **Audience**, choose **External** if using a personal Gmail account. Keep publishing status **Testing** and add your Google email as a test user. An organization may instead permit Internal access.
5. Under **Data Access**, add `https://www.googleapis.com/auth/calendar.events.owned.readonly`. KoalatyTime uses this read-only permission to display existing plans from your primary calendar. Remove the older `calendar.events` scope if it is still listed. New plans are saved with a local `.ics` download or prefilled Google Calendar links; KoalatyTime does not write to calendars through the API.
6. Under **Clients**, create a client with application type **Web application**.
7. Add the exact **Authorized JavaScript origin** shown in your browser's address bar. For the local server, add `http://localhost:5173`. Origins must match the scheme, host, and port exactly; do not add a path or trailing slash. If you also use another hostname or port, add that exact origin too. No redirect URI is needed for this popup token flow.
8. Set the public client ID ending in `.apps.googleusercontent.com` as `googleClientId` in **config.js**. Do not use a client secret. Save and refresh the page. Google configuration changes can take a few minutes to apply.

Official setup: https://developers.google.com/workspace/calendar/api/quickstart/js
Token flow: https://developers.google.com/identity/oauth2/web/guides/use-token-model

## 3. Try real plans

1. Click **Plan this week**, then **Connect Google Calendar** once to open the account chooser. Sunday loads Google's sign-in library while you move through the planning flow.
2. Choose your test account and approve read-only calendar access. This lets KoalatyTime read existing plans from your primary calendar. If access is denied, check your test-user list, Calendar API enablement, and exact localhost origin. You can skip calendar connection and still try the planner and save the resulting plan.
3. Continue to **Plans**, select days, and click **Check selected days**.
4. The primary Google calendar's events for the displayed upcoming Monday–Sunday week appear. All dates and times use the browser's time zone, shown beside the week. Recurring events are expanded; overnight and all-day events are split across days. Cancelled events and invitations you declined are omitted. Events marked free start excluded.
5. Check again to refresh those days. Imports replace prior Google results for the checked days without duplicating them; your exclude/tentative choices are retained for matching events. A failed request leaves previous results intact.

Tokens and plans stay in this tab's memory. Refreshing clears them. Expired tokens require connecting again. Disconnect revokes access and removes imported Google plans from this draft. KoalatyTime reads only the primary calendar and never changes or deletes existing events. At Review, download the new activities and weekly goal as one `.ics` file, or add items to Google Calendar individually through prefilled event links. A downloaded/imported file is a snapshot and does not sync later edits.

For public release, complete Google's consent/verification requirements for the audience and scopes, publish privacy and data-deletion information, and deploy on an authorized HTTPS origin. This local setup does not claim to cover those production steps.

## Troubleshooting OAuth errors

`Error 400: origin_mismatch` means the page's origin does not exactly match an **Authorized JavaScript origin** on the OAuth web client used by `config.js`. Check the browser address bar and add its scheme, hostname, and port in Google Cloud Console under **Google Auth Platform → Clients → your Web client**. For example, `http://localhost:5173` and `http://127.0.0.1:5173` are different origins. For a hosted deployment, register its exact HTTPS origin as well. Google documents this error as an origin mismatch.

To let accounts beyond the test-user list connect, change **Audience → Publishing status** from **Testing** to **In production** (Google may label this **Publish app**). This makes the app available to Google accounts generally, but the calendar scope may require OAuth verification; until approval, Google can show an unverified-app warning or apply user limits. Follow Google's current [OAuth verification requirements](https://support.google.com/cloud/answer/13463073) before public launch.

## Review plans

The Plans page reviews existing Google Calendar events. A full week calendar sits above day accordions ordered Monday through Sunday. Within each day, all-day events come first, followed by timed events in start-time order. Excluding or marking an event tentative changes only this draft. Manual plan entry and screenshot uploads are not currently offered.

## Save a plan without Google OAuth

The Review page can generate a local `.ics` file containing the new activities and weekly goal. It does not upload the draft or use a Google access token. Import the file into Google Calendar on a computer, Apple Calendar, or Outlook. For a phone-friendly Google Calendar flow, open the prefilled link for each event and save it in Google Calendar. These are one-time additions; later edits in KoalatyTime do not sync automatically.
