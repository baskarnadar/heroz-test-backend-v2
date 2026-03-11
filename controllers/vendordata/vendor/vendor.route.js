const vdrvendor = require("./vendor.controller");
 const express = require("express");
const router = express.Router(); 
const { protectAPI  } = require("../../middleware/auth");
router.post("/getvendor",protectAPI, vdrvendor.getvendor);
module.exports = router;

