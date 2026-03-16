const express = require("express");
const router = express.Router();

const AdmDashBoardInfoRoute = require("./controllers/admindata/dashboard/dashboard.route");
const AdmNotification = require("./controllers/admindata/notification/notification.route");
const AdmActivityInfoRoute = require("./controllers/admindata/activityinfo/activity/activity.route");
const AdmActivityTripInfoRoute = require("./controllers/admindata/activityinfo/trip/trip.route");
const AdmActivityPaymentInfoRoute = require("./controllers/admindata/payment/payment.route");
const PushNotificationRoute = require("./controllers/pushmsg/pushmsg.route");

// ✅ ADD THIS (matches your folder in the screenshot)
const ProductsRoute = require("./controllers/membership/products/products.route");

router.use("/admindata/dashboard", AdmDashBoardInfoRoute);
router.use("/admindata/notification", AdmNotification);
router.use("/admindata/activityinfo/activity", AdmActivityInfoRoute);
router.use("/admindata/activityinfo/trip", AdmActivityTripInfoRoute);
router.use("/admindata/payment", AdmActivityPaymentInfoRoute);
router.use("/admindata/pushmsg", PushNotificationRoute);

 
router.use("/product", ProductsRoute);

module.exports = router;
