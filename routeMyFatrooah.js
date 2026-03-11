// routeSchool.js
const express = require("express");
const router = express.Router(); 



const Admtrip = require("./controllers/myfatrooahdata/pay/pay.route");   
router.use("/myfatrooahdata/pay", Admtrip); 

module.exports = router;
