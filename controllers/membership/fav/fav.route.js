const express = require("express");
const router = express.Router();

// ✅ Correct controller
const favController = require("./fav.controller");

// ✅ Middleware
const { protectAPI } = require("../../middleware/auth");

// ================= FAVOURITE =================
router.post("/memaddfavourite", protectAPI, favController.memaddfavourite);
router.post("/memgetfavouritelist", protectAPI, favController.memgetfavouritelist);
router.post("/memdeletfavourite", protectAPI, favController.memdeletfavourite);

module.exports = router;