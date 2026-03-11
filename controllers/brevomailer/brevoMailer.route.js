const brevoMailer = require("./brevoMailer.controller");
 const express = require("express");
const router = express.Router(); 
router.post("/sendemail", brevoMailer.sendemail);   
module.exports = router;

