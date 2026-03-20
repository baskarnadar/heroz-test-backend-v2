const kidsinterest = require("./kidsinterest.controller");
 const express = require("express");
const router = express.Router();
const { protectAPI  } = require("../../middleware/auth");
router.post("/getkidsinterestlist", kidsinterest.getkidsinterestList);
router.post("/getkidsinterestalllist",protectAPI, kidsinterest.getkidsinterestAllList);
router.post("/updatekidsinterest",protectAPI, kidsinterest.updatekidsinterest);
router.post("/createkidsinterest",protectAPI, kidsinterest.createkidsinterest); 
router.post("/delkidsinterest", protectAPI,kidsinterest.delkidsinterest);
router.post("/getkidsinterest",protectAPI, kidsinterest.getkidsinterest);
module.exports = router;

