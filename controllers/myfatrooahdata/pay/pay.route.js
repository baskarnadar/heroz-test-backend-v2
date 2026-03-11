// pay.route.js
const pay = require("./pay.controller");
const express = require("express");
const router = express.Router();

// ==========================
// MyFatoorah Routes
// ==========================

// 0️⃣ Initiate Embedded Session ✅ NEW -- Active
router.post("/initiate-session", pay.initiateSession);

// 1️⃣ Get available payment methods (still useful for showing wallet availability)
router.post("/initiate-payment", pay.initiatePayment);

// 2️⃣ Execute payment (Embedded Session) NEW -- Active
// Frontend sends { SessionId, InvoiceValue } (or { sessionId, amount })
router.post("/execute-session", pay.executeSession);

// ✅ ALIAS (if frontend calls this path)
router.post("/execute-by-session", pay.executeSession);

// 3️⃣ Get final payment status (CALLBACK verification)
router.post("/get-payment-status", pay.getPaymentStatus);

// 4️⃣ Save front-end payment logs
router.post("/paylog", pay.paylog);

module.exports = router;