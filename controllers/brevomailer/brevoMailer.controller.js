// controllers/brevomailer/brevoMailer.controller.js  (CommonJS)

const { connectToMongoDB } = require("../../database/mongodb");
const {
  generateUniqueId,
  generateOtp,
} = require("../../controllers/operation/operation");

// ✅ Helper function to send responses
function sendResponse(res, message, error, results = null, totalCount = null) {
  res.status(error ? 400 : 200).json({
    statusCode: error ? 400 : 200,
    message,
    data: results,
    error,
    totalCount,
  });
}

// Simple email validator (basic)
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

exports.sendemail = async (req, res, next) => {
  try {
    // Only needed if you actually need the DB connection here
    await connectToMongoDB();

    const { to, subject, html, text } = req.body;

    // ---- Validation ----
    const toStr = String(to || "").trim();
    const subjectStr = String(subject || "").trim();
    const htmlStr = typeof html === "string" ? html.trim() : "";
    const textStr = typeof text === "string" ? text.trim() : "";

    if (!toStr || !EMAIL_RE.test(toStr)) {
      return sendResponse(res, "Valid recipient email 'to' is required.", true);
    }
    if (!subjectStr) {
      return sendResponse(res, "Subject is required.", true);
    }
    if (!htmlStr && !textStr) {
      return sendResponse(res, "Email content (html or text) is required.", true);
    }

    // ---- Send via Brevo (load ESM mailer from CommonJS using dynamic import) ----
    const { sendHtml } = await import("../../controllers/brevomailer/brevoMailer.js");

    const brevoResult = await sendHtml({
      to: toStr,
      subject: subjectStr,
      html: htmlStr || undefined,
      text: textStr || undefined,
    });

    return sendResponse(res, "Email sent successfully.", null, { brevoResponse: brevoResult });
  } catch (error) {
    return sendResponse(res, "Error in sendemail.", true, {
      error: String(error?.message || error),
    });
  }
};
