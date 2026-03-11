const mongoose = require("mongoose");
const { Schema } = mongoose;

const MyFatoorahWebhookSchema = new Schema(
  {
    paymentId: { type: String, index: true },
    invoiceId: { type: String },
    customerName: { type: String },
    customerEmail: { type: String },
    invoiceValue: { type: Number },
    currency: { type: String },
    paymentGateway: { type: String },
    paymentStatus: { type: String }, // Example: 'SUCCESS', 'FAILED'
    paymentMethod: { type: String },
    responseData: { type: Object }, // Store full webhook payload
  },
  { timestamps: true }
);

module.exports = mongoose.model("MyFatoorahWebhook", MyFatoorahWebhookSchema);
