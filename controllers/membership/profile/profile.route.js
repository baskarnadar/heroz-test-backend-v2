// controllers/membership/profile/profile.route.js
const express = require("express");
const router = express.Router();
const { protectAPI  } = require("../../middleware/auth");
const profile = require("./profile.controller");
 

router.post("/getMemProfileInfo",protectAPI, profile.getMemProfileInfo);
router.post("/updateMemProfileInfo", protectAPI,profile.updateMemProfileInfo);
router.post("/closeMemProfileAccount", protectAPI,profile.closeMemProfileAccount);

 
module.exports = router;
