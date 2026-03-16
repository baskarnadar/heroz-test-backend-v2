// controllers/membership/products/products.route.js
const express = require("express");
const router = express.Router();

const products = require("./products.controller");
const { protectAPI } = require("../../middleware/auth");

router.post("/productslistonly", products.productslistonly);
// ✅ LIST PRODUCTS
router.post("/productslist", protectAPI, products.productslist);

// ✅ ADD PRODUCT
router.post("/productsadd", protectAPI, products.productsadd);

// ✅ MODIFY PRODUCT
router.post("/productsmodify", protectAPI, products.productsmodify);

// ✅ DELETE PRODUCT (soft delete)
router.post("/productsdelete", protectAPI, products.productsdelete);

// ✅ VIEW SINGLE PRODUCT
router.post("/productsview", protectAPI, products.productsview);

module.exports = router;
