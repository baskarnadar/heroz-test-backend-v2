const TripFinal = require("./trip.controller");
 const express = require("express");
const router = express.Router(); 
const { protectAPI  } = require("../../middleware/auth");
router.post("/updateTripCompleted", protectAPI,TripFinal.updateTripCompleted);
router.post("/getTripFinalNote", protectAPI,TripFinal.getTripFinalNote);
router.post("/impParentsMobileNo", protectAPI,TripFinal.impParentsMobileNo);

module.exports = router;

