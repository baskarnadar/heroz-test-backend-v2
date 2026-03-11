// routeSchool.js
const express = require("express");
const router = express.Router(); 
 
const Admtrip = require("./controllers/commondata/trip/trip.route");   
router.use("/commondata/trip", Admtrip); 

const CommonDataOperation = require("./controllers/commondata/operation/operation.route");   
router.use("/commondata/operation", CommonDataOperation); 


const Admpay = require("./controllers/commondata/payment/pay.route");   
router.use("/commondata/payment", Admpay); 


const brevoMailerEmail = require("./controllers/brevomailer/brevoMailer.route");   
router.use("/brevomailer", brevoMailerEmail); 


const ParentsPayment = require("./controllers/parentspay/parentspay.route");   
router.use("/parentspay", ParentsPayment); 

module.exports = router;
