// controllers/membership/activity/activity.route.js
const express = require("express");
const router = express.Router();

const activity = require("./activity.controller");
const { protectAPI } = require("../../middleware/auth");

router.post("/activitylist", activity.activitylist);

module.exports = router;
