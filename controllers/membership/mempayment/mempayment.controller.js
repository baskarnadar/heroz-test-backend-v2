// pay.controller.js
const { connectToMongoDB } = require("../../../database/mongodb");

// ============================
// Config
// ============================
const API_TIMEOUT_MS = Number(process.env.API_TIMEOUT_MS || 20000);
const MONGO_MAX_TIME_MS = Number(process.env.MONGO_MAX_TIME_MS || 8000);

// ============================
// Helper: send response
// ============================
function sendResponse(res, statusCode, message, error, results = null, totalCount = null) {
  if (res.headersSent) return;
  return res.status(statusCode).json({
    statusCode,
    message,
    data: results,
    error: !!error,
    totalCount: totalCount,
  });
}

// ============================
// Helper: parse payload
// ============================
function getPayload(req) {
  try {
    const { PayRefNo, PaymentID, ParentsID } = req.body || {};
    return { PayRefNo, PaymentID, ParentsID };
  } catch {
    return { PayRefNo: null, PaymentID: null, ParentsID: null };
  }
}

// ============================
// MemPaySuccess
// ============================
exports.MemPaySucess = async (req, res, next) => {
  const requestPayload = getPayload(req);

  try {
    const { PayRefNo, PaymentID, ParentsID } = requestPayload || {};

    // ✅ Required
    if (!PayRefNo || !PaymentID || !ParentsID) {
      return sendResponse(
        res,
        400,
        "PayRefNo, PaymentID, and ParentsID are required.",
        true,
        { requestPayload },
        0
      );
    }

    const db = await connectToMongoDB();
    const col = db.collection("tblMemStars");

    const result = await col.updateOne(
      {
        PayRefNo: PayRefNo,
        PayPaymentID: PaymentID,
        ParentsID: ParentsID,
      },
      {
        $set: {
          PayParentsStatus: "SUCCESS",
        },
      }
    );

    if (!result || result.matchedCount === 0) {
      return sendResponse(res, 404, "No matching record found.", true, null, 0);
    }

    return sendResponse(
      res,
      200,
      "PayParentsStatus updated to SUCCESS.",
      false,
      {
        PayRefNo,
        PaymentID,
        ParentsID,
        PayParentsStatus: "SUCCESS",
        matchedCount: result.matchedCount,
        modifiedCount: result.modifiedCount,
      },
      result.modifiedCount || 0
    );

  } catch (err) {
    console.error("[MemPaySucess] ERROR:", err);
    return sendResponse(
      res,
      500,
      "Failed to update payment status.",
      true,
      { errorMessage: err?.message },
      0
    );
  }
};

// ============================
// MemPayFail
// ============================
 exports.MemPayFail = async (req, res, next) => {
  const requestPayload = getPayload(req);

  try {
    // ✅ Destructure required fields
    const { PayRefNo, PayInvoiceID, ParentsID } = req.body || {};

    // ✅ Required
    if (!PayRefNo || !PayInvoiceID || !ParentsID) {
      return sendResponse(
        res,
        400,
        "PayRefNo, PayInvoiceID, and ParentsID are required.",
        true,
        { requestPayload },
        0
      );
    }

    const db = await connectToMongoDB();

    // ✅ INSERT INTO THIS TABLE
    const colFail = db.collection("tblMemStarPayFail");

    // ✅ Build full document = EVERYTHING from req.body
    // + add server-side metadata for auditing/debugging
    const now = new Date();
    const doc = {
      ...req.body, // ✅ INSERT ALL received fields exactly as-is

      // ✅ Server metadata
      CreatedAt: now, // Date type
      CreatedAtISO: now.toISOString(),
      CreatedAtTS: now.getTime(),
      Ip:
        req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
        req.socket?.remoteAddress ||
        "",
      UserAgent: req.headers["user-agent"] || "",

      // ✅ Keep payload snapshot if you want (optional)
      RequestPayload: requestPayload,
    };

    // ✅ Use upsert so repeated calls do not create duplicates
    // Unique signature for a failure record:
    // PayRefNo + PayInvoiceID + ParentsID
    const result = await colFail.updateOne(
      {
        PayRefNo: String(PayRefNo),
        PayInvoiceID: String(PayInvoiceID),
        ParentsID: String(ParentsID),
      },
      {
        $set: doc,
        $setOnInsert: {
          InsertedAt: now,
        },
      },
      { upsert: true }
    );

    const inserted = !!result.upsertedId;
    const upsertedId = result.upsertedId ? String(result.upsertedId._id) : null;

    return sendResponse(
      res,
      200,
      inserted
        ? "Payment failure inserted into tblMemStarPayFail."
        : "Payment failure updated in tblMemStarPayFail.",
      false,
      {
        PayRefNo,
        PayInvoiceID,
        ParentsID,
        inserted,
        upsertedId,
        matchedCount: result.matchedCount || 0,
        modifiedCount: result.modifiedCount || 0,
      },
      inserted ? 1 : (result.modifiedCount || 0)
    );
  } catch (err) {
    console.error("[MemPayFail] ERROR:", err);
    return sendResponse(
      res,
      500,
      "Failed to insert payment failure.",
      true,
      { errorMessage: err?.message, requestPayload },
      0
    );
  }
};

