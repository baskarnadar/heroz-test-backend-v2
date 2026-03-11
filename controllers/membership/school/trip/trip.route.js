const category = require("./category.controller");
 const express = require("express");
const router = express.Router();
const { protectAPI  } = require("../../middleware/auth");
router.post("/searchtripno",protectAPI, category.searchtripno);
module.exports = router;

