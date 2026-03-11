const activity = require("./activity.controller");
const express = require("express");
const router = express.Router();
const { protectAPI  } = require("../../../middleware/auth");
router.post("/createActivity", protectAPI,activity.createActivity);

router.post("/activityList",protectAPI, activity.activityList);
router.post("/deleteActivity", protectAPI,activity.deleteActivity);
router.post("/updateActivity",protectAPI, activity.updateActivity);
router.post("/updateSchoolPrice",protectAPI, activity.updateSchoolPrice);
router.post("/activityAllList", protectAPI,activity.activityAllList);


router.post("/getAllActivityRequest", protectAPI,activity.getAllActivityRequest);
router.post("/getActivityRequest", protectAPI,activity.getActivityRequest);
router.post("/updateActivityRequest",protectAPI, activity.updateActivityRequest);
router.post("/vdrgetAllActivityRequest",protectAPI, activity.vdrgetAllActivityRequest);

router.post("/attachImages", protectAPI,activity.attachImages);
router.post("/getattachImages", protectAPI,activity.getattachImages);
router.post("/removeattachImages", protectAPI,activity.removeattachImages);
//API Without Token
router.post("/getActivity", protectAPI,activity.getActivity);

module.exports = router;
