// auth.js - create OAuth2 client and generate auth URL
const { google } = require('googleapis');
const credentials = require('./credentials.json');  // Your Google client secret json

function createOAuthClient() {
  const { client_id, client_secret, redirect_uris } = credentials.web;
  return new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
}

function generateAuthUrl(state) {
  const oauth2Client = createOAuthClient();
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/calendar.events'],
    state,
    prompt: 'consent',  // forces refresh_token every time
  });
}

module.exports = { createOAuthClient, generateAuthUrl };
