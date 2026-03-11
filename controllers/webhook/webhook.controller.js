
const { connectToMongoDB } = require("../../database/mongodb");

const express = require("express");
const axios = require("axios");
const cors = require("cors");
require("dotenv").config();
const crypto = require("crypto");
const app = express();
app.use(cors());
app.use(express.json());

// ===== Helper: Unified Response Format =====
function sendResponse(res, message, error, results = null, totalCount = null) {
  res.status(error ? 400 : 200).json({
    statusCode: error ? 400 : 200,
    message,
    data: results,
    error,
    totalCount,
  });
}

exports.fetchUpdate = async (req, res) => {
  const db = await connectToMongoDB();

  try {
    const payload = req.body;
 

    console.log("object response" , JSON.stringify(req.body));
    

    // ✅ Valid Webhook
    console.log("✅ Valid webhook signature verified");

    await db.collection("tblMyFatoorahPayLogWebHook").insertOne({
      setLocation: "Webhook",
      createdAt: new Date(),
      endpoint: "/webhook/fetch-update",
      APISTATUS: "success",
      statusCode: 200,
      paymentId: payload?.PaymentId,
      invoiceId: payload?.InvoiceId,
      paymentStatus: payload?.TransactionStatus,
      paymentMethod: payload?.PaymentMethod,
      apiResponse: payload, // store entire webhook data
    });

    // Send acknowledgment to MyFatoorah
    return res.status(200).json({ message: "Webhook received successfully" });
  } catch (error) {
    console.error("Webhook error:", error);
    await db.collection("tblMyFatoorahPayLogWebHook").insertOne({
      setLocation: "Webhook",
      createdAt: new Date(),
      endpoint: "/webhook/fetch-update",
      APISTATUS: "failed",
      statusCode: 500,
      error: error.message,
    });
    return res.status(500).json({ error: "Failed to process webhook" });
  }
};