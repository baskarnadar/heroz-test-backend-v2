const schedulevel = require("./schedulevel.controller");
 const express = require("express");
const router = express.Router();
const { protectAPI  } = require("../../middleware/auth");
router.post("/getschedulevellist", protectAPI,schedulevel.getSchedulevelList);
router.post("/getschedulevelalllist", protectAPI,schedulevel.getSchedulevelAllList);
router.post("/updateschedulevel",protectAPI, schedulevel.updateSchedulevel);
router.post("/createschedulevel",protectAPI, schedulevel.createSchedulevel); 
router.post("/delschedulevel", protectAPI,schedulevel.delSchedulevel);
router.post("/getschedulevel", protectAPI,schedulevel.getSchedulevel);
module.exports = router;

