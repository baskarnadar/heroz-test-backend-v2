const express = require('express');
const fs = require('fs');
const { google } = require('googleapis');
const app = express();

// === CONFIG ===
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET; 
  
 
app.use(express.json());
  


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
