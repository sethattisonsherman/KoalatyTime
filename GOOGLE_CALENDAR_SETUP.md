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
3. Open **Google Auth platform → Branding** and configure the app name (Sunday), support email, and contact email.
4. Under **Audience**, choose **External** if using a personal Gmail account. Keep publishing status **Testing** and add your Google email as a test user. An organization may instead permit Internal access.
5. Under **Data Access**, add `https://www.googleapis.com/auth/calendar.events.readonly`.
6. Under **Clients**, create a client with application type **Web application**.
7. Add these **Authorized JavaScript origins**: `http://localhost` and `http://localhost:5173`. No redirect URI is needed for this popup token flow.
8. Copy the public client ID ending in `.apps.googleusercontent.com` into the empty `googleClientId` value in **config.js**. Do not copy a client secret. Save and refresh the page. Google configuration changes can take a few minutes to apply.

Official setup: https://developers.google.com/workspace/calendar/api/quickstart/js
Token flow: https://developers.google.com/identity/oauth2/web/guides/use-token-model

## 3. Try real plans

1. Click **Plan this week**, then **Connect Google Calendar**. The first click loads Google's sign-in library; click Connect again when prompted to open the account chooser.
2. Choose your test account and approve calendar reading. If access is denied, check your test-user list, Calendar API enablement, and exact localhost origin.
3. Continue to **Plans**, select days, and click **Check selected days**.
4. The primary Google calendar's events for the displayed upcoming Monday–Sunday week appear. All dates and times use the browser's time zone, shown beside the week. Recurring events are expanded; overnight and all-day events are split across days. Cancelled events and invitations you declined are omitted. Events marked free start excluded.
5. Check again to refresh those days. Imports replace prior Google results for the checked days without duplicating them; your exclude/tentative choices are retained for matching events. A failed request leaves previous results intact.

Tokens and plans stay in this tab's memory. Refreshing clears them. Expired tokens require connecting again. Disconnect revokes access and removes imported Google plans from this draft. This reads only the primary calendar; additional calendars and writing approved plans are future work. The final publishing screen remains a prototype and does not write to Google.

For public release, complete Google's consent/verification requirements for the audience and scopes, publish privacy and data-deletion information, and deploy on an authorized HTTPS origin. This local setup does not claim to cover those production steps.

## Review plans

The Plans page reviews existing Google Calendar events. A full week calendar sits above day accordions ordered Monday through Sunday. Within each day, all-day events come first, followed by timed events in start-time order. Excluding or marking an event tentative changes only this draft. Manual plan entry and screenshot uploads are not currently offered.

## Alternative without a Google Cloud project

A private `.ics` calendar export can be imported locally without OAuth or API calls, but this requires implementing an importer with recurrence/time-zone support and asking the user to re-export for fresh events. It is not live synchronization. Do not make a private calendar public to avoid OAuth.
