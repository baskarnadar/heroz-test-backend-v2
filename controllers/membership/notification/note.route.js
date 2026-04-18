const express = require("express");
const router = express.Router();

const note = require("./note.controller");
const { protectAPI } = require("../../middleware/auth");

// ================= NOTE =================
router.post("/memaddnote", protectAPI, note.memaddnote);

// ================= FAVOURITE (ADDED) =================
router.post("/memaddfavourite", protectAPI, note.memaddfavourite);
router.post("/memgetfavouritelist", protectAPI, note.memgetfavouritelist);
router.post("/memdeletfavourite", protectAPI, note.memdeletfavourite);

module.exports = router;