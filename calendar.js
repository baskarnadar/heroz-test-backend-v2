// calendar.js - create calendar event and handle token refresh
const { google } = require('googleapis');
const { createOAuthClient } = require('./auth');
const { updateTokensForUser } = require('./users');

async function createEvent(tokens, userId) {
  const oauth2Client = createOAuthClient();
  oauth2Client.setCredentials(tokens);

  // Refresh access token if expired
  if (tokens.expiry_date && tokens.expiry_date <= Date.now()) {
    console.log('Access token expired, refreshing...');
    const newTokenResponse = await oauth2Client.refreshAccessToken();
    const newTokens = newTokenResponse.credentials;
    oauth2Client.setCredentials(newTokens);

    // Update tokens in store
    updateTokensForUser(userId, newTokens);
  }

  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  const event = {
    summary: 'Test Event-bas300',
    start: {
      dateTime: new Date(Date.now() + 3600000).toISOString(),
      timeZone: 'UTC',
    },
    end: {
      dateTime: new Date(Date.now() + 7200000).toISOString(),
      timeZone: 'UTC',
    },
  };

  const response = await calendar.events.insert({
    calendarId: 'primary',
    requestBody: event,
  });

  return response.data.htmlLink;
}

module.exports = { createEvent };
