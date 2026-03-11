// pay.route
const PayStatus = require("./pay.controller");
const express = require("express");

const router = express.Router();

router.post("/UpdateParentsPaySuccess", PayStatus.UpdateParentsPaySuccess);
router.post("/UpdateParentsPayFail", PayStatus.UpdateParentsPayFail);

module.exports = router;
