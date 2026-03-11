const subadmin = require("./subadmin.controller");
const express = require("express");
const router = express.Router();
const { protectAPI  } = require("../middleware/auth");

router.post("/getsubadminall",protectAPI, subadmin.getsubadminall);
router.post("/getsubadmin", protectAPI,subadmin.getsubadmin);
router.post("/createsubadmin", protectAPI,subadmin.createsubadmin);
 router.post("/signin", subadmin.signin);
 router.post("/deletesubadmin", protectAPI,subadmin.deletesubadmin);

module.exports = router;

