const dashboard = require("./notification.controller");
 const express = require("express");
const router = express.Router(); 
const { protectAPI  } = require("../../middleware/auth");
router.post("/getnote", protectAPI,dashboard.getnote);
router.post("/getnoteall", protectAPI,dashboard.getnoteall);
router.post("/updatenote", protectAPI,dashboard.updatenote);
module.exports = router;

