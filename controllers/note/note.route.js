const note = require("./note.controller");
 const express = require("express");
const router = express.Router(); 
const { protectAPI  } = require("../middleware/auth");
router.post("/getnote", protectAPI, note.getnote);
 router.post("/getnoteList", protectAPI, note.getnoteList);
  router.post("/updateNote",protectAPI,  note.updateNote);
    router.post("/delNote",protectAPI,  note.delNote);
module.exports = router;

