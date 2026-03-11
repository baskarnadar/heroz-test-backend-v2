const activity = require("./activity.controller");
const express = require("express");
const router = express.Router();
 
const { protectAPI  } = require("../../../middleware/auth"); 
router.post("/actRequest", protectAPI,activity.actRequest);
router.post("/schgetAllActivityRequest", protectAPI,activity.schgetAllActivityRequest);
router.post("/schgetActivityRequest", protectAPI,activity.schgetActivityRequest); 
router.post("/schgetActivity", protectAPI,activity.schgetActivity); 
router.post("/getallactstatus", protectAPI,activity.getallactstatus); 
router.post("/getschool", protectAPI,activity.getschool); 

//Common API for ALL
router.post("/schgetApprovedActivityList", protectAPI,activity.schgetApprovedActivityList); 

module.exports = router;
