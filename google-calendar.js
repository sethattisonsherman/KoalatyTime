// Google Identity Services: tokens live only in memory for this tab.
const GoogleCalendar = (() => {
  const scope = 'https://www.googleapis.com/auth/calendar.events.owned.readonly';
  let token = '', expiresAt = 0, loading, client;
  function load() {
    if (window.google?.accounts?.oauth2) return Promise.resolve();
    return loading ||= new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.onload = resolve;
      script.onerror = () => { loading = null; script.remove(); reject(new Error('Google sign-in could not load. Check your connection and try again.')); };
      document.head.append(script);
    });
  }
  async function prepare() {
    if (location.protocol === 'file:') throw new Error('Open http://localhost:5173 to connect Google Calendar. See GOOGLE_CALENDAR_SETUP.md.');
    if (!window.SUNDAY_CONFIG?.googleClientId) throw new Error('Add your public Google OAuth client ID to config.js first. See GOOGLE_CALENDAR_SETUP.md.');
    await load();
  }
  function connect() {
    // Call directly from a click after prepare(), so the popup keeps its user gesture.
    return new Promise((resolve, reject) => {
      if (location.protocol === 'file:') { reject(new Error('Open http://localhost:5173 to connect Google Calendar. See GOOGLE_CALENDAR_SETUP.md.')); return; }
      if (!window.SUNDAY_CONFIG?.googleClientId) { reject(new Error('Add your public Google OAuth client ID to config.js first. See GOOGLE_CALENDAR_SETUP.md.')); return; }
      if (!window.google?.accounts?.oauth2) { reject(new Error('Google sign-in is still loading. Go back to the calendar step and try again.')); return; }
      client = google.accounts.oauth2.initTokenClient({
        client_id: window.SUNDAY_CONFIG.googleClientId, scope,
        callback: response => {
          if (response.error || !google.accounts.oauth2.hasGrantedAllScopes(response, scope)) {
            reject(new Error('Calendar access was not granted. Try connecting again and allow calendar reading.')); return;
          }
          token = response.access_token;
          expiresAt = Date.now() + Number(response.expires_in) * 1000;
          resolve();
        },
        error_callback: () => reject(new Error('Google sign-in was closed or blocked. Allow popups and try again.'))
      });
      client.requestAccessToken({prompt: 'select_account'});
    });
  }
  const connected = () => !!token && Date.now() < expiresAt - 30000;
  function disconnect() {
    if (token) google.accounts.oauth2.revoke(token, () => {});
    token = ''; expiresAt = 0;
  }
  function segments(events, start, selectedDays) {
    const result = [];
    for (const event of events) {
      if (event.status === 'cancelled' || event.attendees?.some(a => a.self && a.responseStatus === 'declined')) continue;
      const allDay = !!event.start?.date;
      const first = allDay ? new Date(event.start.date + 'T00:00:00') : new Date(event.start?.dateTime);
      const last = allDay ? new Date(event.end.date + 'T00:00:00') : new Date(event.end?.dateTime);
      if (!(last > first)) continue;
      for (const day of selectedDays) {
        const a = new Date(start); a.setDate(a.getDate() + day);
        const b = new Date(a); b.setDate(b.getDate() + 1);
        if (first >= b || last <= a) continue;
        const clipped = new Date(Math.max(first, a));
        const from = clipped.getHours() * 60 + clipped.getMinutes();
        const end = last >= b ? 1440 : last.getHours() * 60 + last.getMinutes();
        result.push({ googleId: `${event.id}:${a.getFullYear()}-${a.getMonth()}-${a.getDate()}`, source: 'google', title: event.summary || 'Busy', day,
          time: `${String(clipped.getHours()).padStart(2,'0')}:${String(clipped.getMinutes()).padStart(2,'0')}`,
          durationMinutes: Math.max(1, end - from), allDay, tentative: event.status === 'tentative', keep: event.transparency !== 'transparent' });
      }
    }
    return result;
  }
  async function readWeek(start, selectedDays) {
    if (!connected()) throw new Error('Your Google session expired. Connect Google Calendar again.');
    const end = new Date(start); end.setDate(end.getDate() + 7);
    let pageToken = '', events = [];
    do {
      const params = new URLSearchParams({ timeMin: start.toISOString(), timeMax: end.toISOString(), singleEvents: 'true', orderBy: 'startTime', maxResults: '2500', timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone });
      if (pageToken) params.set('pageToken', pageToken);
      const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) {
        if (response.status === 401) { token = ''; throw new Error('Your Google session expired. Connect Google Calendar again.'); }
        throw new Error(response.status === 403 ? 'Google denied calendar access. Enable the Calendar API and check consent permissions in your Google Cloud project.' : 'Could not read Google Calendar. Try again shortly.');
      }
      const data = await response.json(); events.push(...(data.items || [])); pageToken = data.nextPageToken || '';
    } while (pageToken);
    return segments(events, start, selectedDays);
  }
  return { prepare, connect, connected, disconnect, readWeek, segments };
})();
