const dashboard = require("./operation.controller");
 const express = require("express");
const router = express.Router(); 
const { protectAPI  } = require("../../middleware/auth");
router.post("/signup", dashboard.signup);   
router.post("/getotp",  dashboard.getotp);  
router.post("/changepwd", protectAPI, dashboard.changepwd);   
router.post("/resetpwd",    dashboard.resetpwd);  
router.post("/isUserExist", dashboard.isUserExist);  
router.post("/IsOtpVerified", dashboard.IsOtpVerified);  
router.post("/herozagreement", dashboard.herozagreement); 
router.post("/getagree", dashboard.getagree); 
router.post("/genSchReport",protectAPI, dashboard.genSchReport); 
module.exports = router;

