// route.js
const express = require("express");
const router = express.Router();

// Core route modules
const routeMyFatrooah = require("./routeMyFatrooah");
const routeCommon = require("./routeCommon");
const routeSchool = require("./routeSchool");
const routeVendor = require("./routeVendor");
const routeAdmin = require("./routeAdmin");

// ✅ ADD: Membership routes
const routeMembership = require("./routeMembership");

// Public/basic routes
const indexRouter = require("./routes/index");
const usersRouter = require("./routes/users");

// Feature routes
const SubAdminRoute = require("./controllers/subadmin/subadmin.route");
const upload = require("./controllers/upload/upload.route");
const CommonRoute = require("./controllers/common/common.route");

// Admin / Lookup data
const CityRoute = require("./controllers/lookupdata/city/city.route");
const OutComeRoute = require("./controllers/lookupdata/outcome/outcome.route");

const CountryRoute = require("./controllers/lookupdata/country/country.route");
const SchEduLevelRoute = require("./controllers/lookupdata/schedulevel/schedulevel.route");
const LookupCategoryRoute = require("./controllers/lookupdata/category/category.route");

// Info routes
const SchoolInfoRoute = require("./controllers/schoolinfo/school/school.route");
const VendorInfoRoute = require("./controllers/vendorinfo/vendor/vendor.route");

// Domain routes
const ActivityInfoRoute = require("./controllers/vendordata/activityinfo/activity/activity.route");
const NoteRoute = require("./controllers/note/note.route");

const webhookRoute = require("./controllers/webhook/webhook.route");

// -----------------------------------------------------------------------------
// Public/basic
// -----------------------------------------------------------------------------
router.use("/", indexRouter);
router.use("/users", usersRouter);

// -----------------------------------------------------------------------------
// Aggregated /api routers
// -----------------------------------------------------------------------------
router.use("/api", routeAdmin);
router.use("/api", routeVendor);
router.use("/api", routeSchool);
router.use("/api", routeCommon);
router.use("/api", routeMyFatrooah);

// ✅ FIX: mount membership under /api (NOT /api/membershop)
router.use("/api", routeMembership);

// Feature groups
router.use("/api/product/upload", upload);
router.use("/api/common", CommonRoute);
router.use("/api/subadmin", SubAdminRoute);

// Lookup / Admin data
router.use("/api/lookupdata/outcome", OutComeRoute);
router.use("/api/lookupdata/city", CityRoute);
router.use("/api/lookupdata/country", CountryRoute);
router.use("/api/lookupdata/category", LookupCategoryRoute);
router.use("/api/lookupdata/schedulevel", SchEduLevelRoute);

// Info
router.use("/api/schoolinfo/school", SchoolInfoRoute);
router.use("/api/vendorinfo/vendor", VendorInfoRoute);

// Domain-specific
router.use("/api/note", NoteRoute);
router.use("/api/vendordata/activityinfo/activity", ActivityInfoRoute);

// Webhook Api Response
router.use("/api/webhook", webhookRoute);

module.exports = router;
