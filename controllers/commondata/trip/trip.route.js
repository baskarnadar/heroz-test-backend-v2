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
 
router.post("/PosGetParentsKidsInfo", protectAPI, tripdata.PosGetParentsKidsInfo);

router.post("/closePayDueDate", protectAPI, tripdata.closePayDueDate);

const upload = require("../../middleware/uploadKidsImage"); // your multer config

// ✅ MUST be here, before controller
router.post(  "/PosGetKidsInfoOnly",     protectAPI, tripdata.PosGetKidsInfoOnly  );
router.post(  "/PosAddKidsOnly",protectAPI,  upload.single("KidsImage"),    tripdata.PosAddKidsOnly  );
router.post(  "/PosUpdateKidsOnly", protectAPI, upload.single("KidsImage"),    tripdata.PosUpdateKidsOnly  );
router.post(  "/PosDeleteKids", protectAPI,     tripdata.PosDeleteKids  );
module.exports = router;
