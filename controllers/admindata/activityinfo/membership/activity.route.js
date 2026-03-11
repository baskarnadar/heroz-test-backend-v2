const activity = require("./activity.controller");
const express = require("express");
const router = express.Router(); 
 const { protectAPI  } = require("../../../middleware/auth");
router.post("/activityList", protectAPI, activity.activityList);
router.post("/changeorder", protectAPI, activity.changeorder);
 router.post("/deleteActivity",protectAPI, activity.deleteActivity);
module.exports = router;
