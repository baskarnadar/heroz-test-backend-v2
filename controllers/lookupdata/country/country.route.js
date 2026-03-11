const country = require("./country.controller");
 const express = require("express");
const router = express.Router();
const { protectAPI  } = require("../../middleware/auth");
router.post("/getcountrylist", protectAPI,country.getcountrylist);
router.post("/getcountryalllist",protectAPI, country.getcountryalllist);
router.post("/updatecountry", protectAPI,country.updatecountry);
router.post("/createcountry",protectAPI, country.createcountry); 
router.post("/delcountry",protectAPI, country.delcountry);
router.post("/getcountry", protectAPI,country.getcountry);
module.exports = router;

