const ParentsPay = require("./parentspay.controller");
 const express = require("express");
const router = express.Router(); 
const { protectAPI  } = require("../middleware/auth");
router.post("/ptrsPaySignin",   ParentsPay.ptrsPaySignin);
router.post("/ptrsPayTripList",ParentsPay.ptrsPayTripList);
module.exports = router;

