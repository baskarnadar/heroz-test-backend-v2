// pay.route
const MemLogin = require("./login.controller");
const express = require("express");

const router = express.Router();

router.post("/memsignup", MemLogin.memsignup);
//router.post("/memsignin", MemLogin.memsignin);

module.exports = router;
