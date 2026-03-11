const Common = require("./common.controller");
const express = require("express");
const router = express.Router();
 
router.post("/totnote", Common.totnote);
router.post("/IsUserExist", Common.IsUserExist);
router.post("/VdrIsUserEmailExist", Common.VdrIsUserEmailExist);
router.post("/SchIsUserEmailExist", Common.SchIsUserEmailExist);
module.exports = router;

