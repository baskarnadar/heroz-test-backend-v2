// routeSchool.js
const express = require("express");
const router = express.Router();

const VendorDashBoardInfoRoute = require("./controllers/vendordata/dashboard/dashboard.route");
const VenNotification = require("./controllers/vendordata/notification/notification.route");
const VenCalendar = require("./controllers/vendordata/calendar/calendar.route");
const VdrActivityInfo = require("./controllers/vendordata/activityinfo/activity/activity.route");
const vdrVendor = require("./controllers/vendordata/vendor/vendor.route");
const VendorTripInfoRoute = require("./controllers/vendordata/trip/trip.route");

const VenBooking = require("./controllers/vendordata/booking/booking.route");
router.use("/vendordata/trip", VendorTripInfoRoute); 
router.use("/vendordata/dashboard", VendorDashBoardInfoRoute); 
router.use("/vendordata/notification", VenNotification); 
router.use("/vendordata/calendar", VenCalendar); 
router.use("/vendordata/activityinfo/activity", VdrActivityInfo); 
router.use("/vendordata/vendor", vdrVendor); 
router.use("/vendordata/booking", VenBooking); 

module.exports = router;
