// pay.route
const MemLogin = require("./login.controller");
const express = require("express");
const { protectAPI } = require("../../middleware/auth");
const router = express.Router();

router.post("/memsignup", MemLogin.memsignup);
router.post("/getmemdata", protectAPI,MemLogin.getmemdata);
 router.post("/updatememdata", protectAPI,MemLogin.updatememdata);

module.exports = router;
