const calendar = require("./calendar.controller");
const express = require("express");
const router = express.Router();
const { protectAPI  } = require("../../middleware/auth");
router.post("/vdrgetallactstatus",protectAPI, calendar.vdrgetallactstatus); 
router.post("/vdrTripLockDate",protectAPI, calendar.vdrTripLockDate); 
module.exports = router;
