const express = require("express");
const router = express.Router();
const Outcome = require("./outcome.controller");
const { protectAPI } = require("../../middleware/auth");

// List (paged)
router.post("/getoutcomelist", protectAPI, Outcome.getOutcomeList);

// List (all)
router.post("/getoutcomealllist", protectAPI, Outcome.getOutcomeAllList);

// Create
router.post("/createoutcome", protectAPI, Outcome.createOutcome);

// Update
router.post("/updateoutcome", protectAPI, Outcome.updateOutcome);

// Delete
router.post("/deloutcome", protectAPI, Outcome.delOutcome);

// Get single
router.post("/getoutcome", protectAPI, Outcome.getOutcome);

module.exports = router;
