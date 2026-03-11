const City = require("./city.controller");
 const express = require("express");
const router = express.Router();
const { protectAPI  } = require("../../middleware/auth");
router.post("/getcitylist",protectAPI, City.getcitylist);
router.post("/getcityalllist", protectAPI,City.getcityalllist);
router.post("/updateCity", protectAPI,City.updateCity);
router.post("/createCity",protectAPI, City.createCity); 
router.post("/delCity", protectAPI,City.delCity);
router.post("/getCity",protectAPI, City.getCity);
module.exports = router;

