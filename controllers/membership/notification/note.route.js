const express = require("express");
const router = express.Router();

const note = require("./note.controller");
const { protectAPI } = require("../../middleware/auth");

// ================= NOTE =================
router.post("/memaddnote", protectAPI, note.memaddnote);

// ================= FAVOURITE (ADDED) =================
router.post("/memaddnote", protectAPI, note.memaddnote);
router.post("/memgetnotelist", protectAPI, note.memgetnotelist);
router.post("/memupdatenoteStatus", protectAPI, note.memupdatenoteStatus);
router.post("/memdeletenote", protectAPI, note.memdeletenote);
router.post("/memdeleteallnote", protectAPI, note.memdeleteallnote);
module.exports = router;