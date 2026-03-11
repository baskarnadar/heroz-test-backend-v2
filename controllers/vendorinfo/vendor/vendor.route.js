const vendor = require("./vendor.controller");
 const express = require("express");
const router = express.Router();

const { protectAPI  } = require("../../middleware/auth");
router.post("/getvendorlist",protectAPI,vendor.getvendorlist);
router.post("/updatevendor",protectAPI, vendor.updatevendor);
router.post("/createvendor",protectAPI, vendor.createvendor); 
router.post("/delvendor", protectAPI,vendor.delvendor);
router.post("/getvendor", protectAPI,vendor.getVendor);
router.post("/updatepwd", protectAPI,vendor.updatepwd);
module.exports = router;

