const school = require("./school.controller");
 const express = require("express");
const router = express.Router();
const { protectAPI  } = require("../../middleware/auth"); 
router.post("/getschoollist",protectAPI, school.getschoollist);
router.post("/updateschool", protectAPI,school.updateschool);
router.post("/createschool", protectAPI,school.createschool); 
router.post("/delschool",protectAPI, school.delschool);
router.post("/getschool", protectAPI,school.getschool);
router.post("/updatepwd",protectAPI, school.updatepwd);

module.exports = router;

