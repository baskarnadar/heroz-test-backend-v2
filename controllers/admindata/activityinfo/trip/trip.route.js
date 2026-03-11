const trip = require("./trip.controller");
const express = require("express");
const router = express.Router(); 
 const { protectAPI  } = require("../../../middleware/auth");
 
router.post("/triplist",protectAPI, trip.triplist);
router.post("/gettrip", trip.gettrip);
router.post("/gettripview", trip.gettripview);
router.post("/tripAddParentsKidsInfo", trip.tripAddParentsKidsInfo);
router.post("/tripPaidList", protectAPI,trip.tripPaidList);
 router.post("/getalltriplist", protectAPI,trip.getalltriplist);
 router.post("/getmykidsstatus", protectAPI,trip.getmykidsstatus);
module.exports = router;
