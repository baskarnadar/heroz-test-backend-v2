// routeSchool.js
const express = require("express");
const router = express.Router();

const SchoolActivityInfoRoute = require("./controllers/schooldata/school/activity/activity.route");
const schNoteInfoRoute = require("./controllers/schooldata/note/note.route");
const schTripData = require("./controllers/schooldata/school/trip/trip.route");
const schDashBoard = require("./controllers/schooldata/dashboard/dashboard.route");

router.use("/schooldata/school/activity", SchoolActivityInfoRoute);
router.use("/schooldata/note", schNoteInfoRoute);
router.use("/schooldata/school/trip", schTripData);
 router.use("/schooldata/dashboard", schDashBoard);
module.exports = router;
