// controllers/membership/review/review.route.js
const express = require("express");
const router = express.Router();
const { protectAPI  } = require("../../middleware/auth");
const review = require("./review.controller");
 

router.post("/getreviewlist", review.getreviewlist);
router.post("/addreview", protectAPI,  review.addreview); 
 
module.exports = router;
