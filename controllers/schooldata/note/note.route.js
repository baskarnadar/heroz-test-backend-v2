const dashboard = require("./note.controller");
 const express = require("express");
const router = express.Router(); 

const { protectAPI  } = require("../../middleware/auth");

router.post("/getnote",protectAPI, dashboard.getnote);
router.post("/getnoteall", protectAPI,dashboard.getnoteall);
router.post("/updatenote", protectAPI,dashboard.updatenote);
router.post("/deletenote", protectAPI,dashboard.deletenote);
module.exports = router;

