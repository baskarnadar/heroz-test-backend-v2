// pay.route
const MemLogin = require("./login.controller");
const express = require("express");

const router = express.Router();

router.post("/memsignup", MemLogin.memsignup);
router.post("/getmemdata", MemLogin.getmemdata);
 

module.exports = router;
