// controllers/membership/note/note.route.js
const express = require("express");
const router = express.Router();

const note = require("./note.controller");
const { protectAPI } = require("../../middleware/auth");

router.post("/memaddnote",protectAPI, note.memaddnote);

module.exports = router;
// controllers/membership/favourite/favourite.route.js
const express = require("express");
const router = express.Router();

const favourite = require("./fav.controller"); // same controller file
const { protectAPI } = require("../../middleware/auth");

// ================= FAVOURITE =================
router.post("/memaddfavourite", protectAPI, favourite.memaddfavourite);
router.post("/memgetfavouritelist", protectAPI, favourite.memgetfavouritelist);
router.post("/memdeletfavourite", protectAPI, favourite.memdeletfavourite);

module.exports = router;