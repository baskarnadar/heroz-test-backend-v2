// controllers/membership/wallet/wallet.route.js
const express = require("express");
const router = express.Router();
const { protectAPI  } = require("../../middleware/auth");
const wallet = require("./wallet.controller");
 
router.post("/getMyWalletStarList", protectAPI,wallet.getMyWalletStarList);
router.post("/getMyWalletStar", protectAPI,wallet.getMyWalletStar);
router.post("/addMyWalletStar", protectAPI,wallet.addMyWalletStar); 
router.post("/getAvailableStar", protectAPI,wallet.getAvailableStar);
module.exports = router;
