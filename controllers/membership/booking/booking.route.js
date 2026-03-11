// controllers/membership/booking/booking.route.js
const express = require("express");
const router = express.Router();

const booking = require("./booking.controller");
const { protectAPI } = require("../../middleware/auth");
router.post("/cancelbooking", protectAPI,booking.cancelbooking);
router.post("/getbookinglist", protectAPI,booking.getbookinglist);
router.post("/addBooking", protectAPI,booking.addBooking);
router.post("/getbookingqr",protectAPI,booking.getbookingqr);
router.post("/vdrgetbookingSummary",protectAPI, booking.vdrgetbookingSummary);
router.post("/vdrgetbookingSummaryList",booking.vdrgetbookingSummaryList);
router.post("/vdrgetOneBookingOnly",booking.vdrgetOneBookingOnly);
 router.post("/vdrupdateBookingStatus",protectAPI,booking.vdrupdateBookingStatus);
module.exports = router;
 

