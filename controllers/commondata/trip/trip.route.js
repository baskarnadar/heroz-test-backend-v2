const tripdata = require("./trip.controller");
const express = require("express");
const router = express.Router();
const { protectAPI } = require("../../middleware/auth");

router.post("/gettripSummary", protectAPI, tripdata.gettripSummary);
router.post("/gettripdata", protectAPI, tripdata.gettripdata);
router.post(
  "/getAllTripBookedActivitiesStats",
  protectAPI,
  tripdata.getAllTripBookedActivitiesStats
);
router.post("/gettripPaymentSummary", protectAPI, tripdata.gettripPaymentSummary);

router.post("/getPosUserKidsInfo", protectAPI, tripdata.getPosUserKidsInfo);
router.post("/PosSignup", tripdata.PosSignup);
router.post("/PosGetParentsKidsInfo", protectAPI, tripdata.PosGetParentsKidsInfo);

router.post("/closePayDueDate", protectAPI, tripdata.closePayDueDate);

const upload = require("../../middleware/uploadKidsImage"); // your multer config

// ✅ MUST be here, before controller
router.post(
  "/PosAddKidsOnly",
  protectAPI, // ✅ keep/remove based on your requirement
  upload.single("KidsImage"), // ✅ must match Flutter field name
  tripdata.PosAddKidsOnly // ✅ FIX: use tripdata (not tripController)
);

module.exports = router;
