// controllers/membership/misc/misc.route.js
const express = require("express");
const router = express.Router();
const misc = require("./misc.controller");
router.post("/getAllCategoryList", misc.getAllCategoryList); 
module.exports = router;
