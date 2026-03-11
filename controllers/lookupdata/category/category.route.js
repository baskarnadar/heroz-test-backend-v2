const category = require("./category.controller");
 const express = require("express");
const router = express.Router();
const { protectAPI  } = require("../../middleware/auth");
router.post("/getcategorylist",protectAPI, category.getCategoryList);
router.post("/getcategoryalllist",protectAPI, category.getCategoryAllList);
router.post("/updatecategory",protectAPI, category.updateCategory);
router.post("/createcategory",protectAPI, category.createCategory); 
router.post("/delcategory", protectAPI,category.delCategory);
router.post("/getcategory",protectAPI, category.getCategory);
module.exports = router;

