const admin = require("firebase-admin");
const path = require("path");

// Prevent "default app already exists" error
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(
      require(path.join(__dirname, "serviceAccountKey.json"))
    ),
  });
}

module.exports = admin;
