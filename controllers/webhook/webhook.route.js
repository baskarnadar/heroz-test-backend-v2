const webhook = require("./webhook.controller");
 const express = require("express");
const router = express.Router(); 

router.post("/fetch-update", webhook.fetchUpdate);
module.exports = router;

