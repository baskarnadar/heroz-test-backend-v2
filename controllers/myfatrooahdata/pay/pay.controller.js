// pay.controller.js
const { connectToMongoDB } = require("../../../database/mongodb");
const axios = require("axios");
require("dotenv").config();

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

// ===== Environment Setup =====
const MF_BASE = (process.env.MF_BASE || "").trim().replace(/\/+$/, "");
const MF_TOKEN = (process.env.MF_TOKEN || "").trim();
const CALLBACK_URL = (process.env.CALLBACK_URL || "").trim();
const ERROR_URL = (process.env.ERROR_URL || "").trim();

if (!MF_BASE || !MF_TOKEN) {
  console.error("❌ Missing MF_BASE or MF_TOKEN in .env");
}

// ===== Axios client (MyFatoorah API) =====
const mf = axios.create({
  baseURL: `${MF_BASE}/v2`,
  headers: { Authorization: `Bearer ${MF_TOKEN}` },
  timeout: 90000,
});

// Optional: Interceptor to detect timeout before main catch
mf.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.code === "ECONNABORTED") {
      console.error("⏰ MyFatoorah request timed out after", mf.defaults.timeout, "ms");
      try {
        const db = await connectToMongoDB();
        const timeoutError = {
          errorDate: new Date(),
          endpoint: "MyFatoorah Timeout",
          message: "Request timeout - MyFatoorah did not respond in time.",
          stack: error.stack || "",
          config: error.config || {},
          code: error.code,
          timeoutValue: mf.defaults.timeout,
        };
        await db.collection("tblMyFatroorahPayErrorIssue").insertOne(timeoutError);
        console.log("⚠️ Timeout error saved to tblMyFatroorahPayErrorIssue");
      } catch (saveErr) {
        console.error("Failed to log timeout error:", saveErr.message);
      }
    }
    return Promise.reject(error);
  }
);

// ===== Helpers =====
const urlOk = (u) => {
  try {
    const x = new URL(String(u).trim());
    if (!/^https?:$/i.test(x.protocol)) return false;
    if (!x.hostname) return false;
    if (x.hash) return false; // MF rejects fragment (#...)
    return true;
  } catch {
    return false;
  }
};

// Centralized log helper (keeps your style)
async function savePayLog({
  APISTATUS,
  endpoint,
  statusCode,
  sentPayload,
  apiResponse,
  apiHeaders,
  errorMeta,
}) {
  try {
    const db = await connectToMongoDB();
    await db.collection("tblMyFatroorahPayLog").insertOne({
      setLocation: "Back-end",
      createdAt: new Date(),
      endpoint,
      APISTATUS,
      statusCode,
      sentPayload: sentPayload || {},
      apiResponse: apiResponse ?? null,
      apiHeaders: apiHeaders ?? null,
      errorMeta: errorMeta ?? null,
    });
  } catch (e) {
    console.error("⚠️ Failed to save pay log:", e.message);
  }
}

// ==========================================================
// (0) Initiate Session ✅ (Embedded Integration)
// ==========================================================
exports.initiateSession = async (req, res) => {
  let payload = {};
  try {
    payload = {}; // no required body per MF docs
    const r = await mf.post("/InitiateSession", payload);

    await savePayLog({
      APISTATUS: "success",
      endpoint: "/InitiateSession",
      statusCode: r?.status ?? 200,
      sentPayload: payload,
      apiResponse: r?.data ?? null,
      apiHeaders: r?.headers ?? null,
    });

    return res.json(r.data);
  } catch (e) {
    console.error("🔴 INITIATE SESSION error:", e?.response?.data || e.message);

    await savePayLog({
      APISTATUS: "fail",
      endpoint: "/InitiateSession",
      statusCode: e?.response?.status || 400,
      sentPayload: payload,
      apiResponse: e?.response?.data || (e?.message ? { message: e.message } : null),
      apiHeaders: e?.response?.headers || null,
      errorMeta: {
        message: e?.message || "",
        code: e?.code || null,
        stack: e?.stack || "",
      },
    });

    return res.status(e?.response?.status || 400).json({
      error: e?.response?.data || e.message,
    });
  }
};

// ==========================================================
// (1) Initiate Payment: Get available payment methods
// NOTE: still needed to get "PaymentCurrencyIso" for widget config
// ==========================================================
exports.initiatePayment = async (req, res) => {
  try {
    const { amount, currency } = req.body;

    if (!amount || Number(amount) <= 0) {
      return sendResponse(res, "Invalid amount provided.", true);
    }

    const r = await mf.post("/InitiatePayment", {
      InvoiceAmount: Number(amount),
      CurrencyIso: currency || "SAR",
    });

    return res.json(r.data);
  } catch (e) {
    console.error("INITIATE error:", e?.response?.data || e.message);
    return res
      .status(e?.response?.status || 400)
      .json({ error: e?.response?.data || e.message });
  }
};

// ==========================================================
// (2) Execute Payment (EMBEDDED SESSION) ✅ CORRECT
// Docs say: DO NOT pass PaymentMethodId, use SessionId.
// BODY accepted:
//   { SessionId, InvoiceValue }
//   { sessionId, amount }
// ==========================================================
exports.executeSession = async (req, res) => {
  let sentToMF = {};

  try {
    const {
      // accept both key styles
      SessionId,
      sessionId,

      InvoiceValue,
      invoiceValue,
      amount,

      customer = {},
      language = "EN",
      displayCurrency = "SAR",
      currency = "SAR",
      userDefinedField,
      customerReference,
    } = req.body;

    const finalSessionId = String(SessionId || sessionId || "").trim();
    const finalAmount = Number(
      amount ?? InvoiceValue ?? invoiceValue ?? 0
    );

    // === Input Validation ===
    if (!finalSessionId) {
      return res.status(400).json({
        Message: "SessionId is required for embedded payment (from widget callback).",
      });
    }
    if (!finalAmount || finalAmount <= 0) {
      return res.status(400).json({ Message: "amount must be > 0" });
    }

    // === Callback URL validation ===
    if (!urlOk(CALLBACK_URL) || !urlOk(ERROR_URL)) {
      return res.status(400).json({
        Message:
          "CALLBACK_URL or ERROR_URL invalid. They must be absolute http(s) URLs without # fragment.",
        Provided: { CALLBACK_URL, ERROR_URL },
      });
    }

    // ✅ IMPORTANT:
    // Embedded ExecutePayment request should include ONLY SessionId + InvoiceValue (plus customer & urls).
    // DO NOT send PaymentMethodId (it overwrites SessionId).
    sentToMF = {
      SessionId: finalSessionId,
      InvoiceValue: finalAmount,
      CurrencyIso: currency || "SAR",
      CustomerName: customer?.name || "Guest",
      CustomerEmail: customer?.email || "",
      CustomerMobile: customer?.mobile || "",
      DisplayCurrencyIso: displayCurrency,
      Language: language,
      CallBackUrl: CALLBACK_URL,
      ErrorUrl: ERROR_URL,
      UserDefinedField: userDefinedField || "",
      CustomerReference: customerReference || "",
    };

    console.log("🟢 MF Execute (Embedded) payload:", sentToMF);

    const r = await mf.post("/ExecutePayment", sentToMF);

    await savePayLog({
      APISTATUS: "success",
      endpoint: "/ExecutePayment",
      statusCode: r?.status ?? 200,
      sentPayload: sentToMF,
      apiResponse: r?.data ?? null,
      apiHeaders: r?.headers ?? null,
    });

    return res.json(r.data);
  } catch (e) {
    console.error("🔴 EXECUTE error:", e?.response?.data || e.message);

    await savePayLog({
      APISTATUS: "fail",
      endpoint: "/ExecutePayment",
      statusCode: e?.response?.status || 400,
      sentPayload: sentToMF || req.body || {},
      apiResponse: e?.response?.data || (e?.message ? { message: e.message } : null),
      apiHeaders: e?.response?.headers || null,
      errorMeta: {
        message: e?.message || "",
        code: e?.code || null,
        stack: e?.stack || "",
      },
    });

    return res
      .status(e?.response?.status || 400)
      .json({ error: e?.response?.data || e.message });
  }
};

// ==========================================================
// (3) Get Payment Status (CALLBACK verification)
// ==========================================================
exports.getPaymentStatus = async (req, res) => {
  let payload = {};

  try {
    const key =
      req.body?.key ??
      req.body?.Key ??
      req.query?.key ??
      req.query?.paymentId ??
      req.query?.PaymentId ??
      "";

    const keyType =
      req.body?.keyType ??
      req.body?.KeyType ??
      req.query?.keyType ??
      "PaymentId";

    if (!key) {
      return res.status(400).json({
        Message:
          "key is required (PaymentId or InvoiceId). Send body: { key: '...', keyType: 'PaymentId' }",
      });
    }

    payload = {
      Key: String(key),
      KeyType: String(keyType),
    };

    const r = await mf.post("/GetPaymentStatus", payload);

    await savePayLog({
      APISTATUS: "success",
      endpoint: "/GetPaymentStatus",
      statusCode: r?.status ?? 200,
      sentPayload: payload,
      apiResponse: r?.data ?? null,
      apiHeaders: r?.headers ?? null,
    });

    return res.json(r.data);
  } catch (e) {
    console.error("🔴 GET STATUS error:", e?.response?.data || e.message);

    await savePayLog({
      APISTATUS: "fail",
      endpoint: "/GetPaymentStatus",
      statusCode: e?.response?.status || 400,
      sentPayload: payload || req.body || {},
      apiResponse: e?.response?.data || (e?.message ? { message: e.message } : null),
      apiHeaders: e?.response?.headers || null,
      errorMeta: {
        message: e?.message || "",
        code: e?.code || null,
        stack: e?.stack || "",
      },
    });

    return res.status(e?.response?.status || 400).json({
      error: e?.response?.data || e.message,
    });
  }
};

// ==========================================================
// (4) Save Pay Log (Front-End)
// ==========================================================
exports.paylog = async (req, res) => {
  try {
    const db = await connectToMongoDB();
    await db.collection("tblMyFatroorahPayLog").insertOne({
      createdAt: new Date(),
      setLocation: "Front-End",
      ...req.body.PayLogData,
    });
    res.json({ status: "success", message: "Pay log saved" });
  } catch (e) {
    console.error("paylog error:", e.message);
    res.status(500).json({ status: "error", message: e.message });
  }
};
