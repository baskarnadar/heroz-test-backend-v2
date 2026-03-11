// pay.controller.js
const { connectToMongoDB } = require("../../../database/mongodb");
const { generateUniqueId } = require("../../../controllers/operation/operation");

// ============================
// Config (adjust as needed)
// ============================
const API_TIMEOUT_MS = Number(process.env.API_TIMEOUT_MS || 20000); // 20s
const MONGO_MAX_TIME_MS = Number(process.env.MONGO_MAX_TIME_MS || 8000); // 8s

// ✅ Helper: send response with explicit status code
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

// ✅ Helper: timeout wrapper for any promise
function promiseTimeout(promise, ms, label = "Operation") {
  let timer;
  const timeoutErr = new Error(`${label} timeout after ${ms}ms`);
  timeoutErr.code = "ETIMEDOUT";

  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(timeoutErr), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

// ✅ Helper: parse payload safely
function getPayload(req) {
  try {
    const { PayRefNo, PaymentID, id } = req.body || {};
    return { PayRefNo, PaymentID, id };
  } catch {
    return { PayRefNo: null, PaymentID: null, id: null };
  }
}

// ============================
// UpdateParentsPaySuccess
// ============================
exports.UpdateParentsPaySuccess = async (req, res, next) => {
  const requestPayload = getPayload(req);

  try {
    console.log("[UpdateParentsPaySuccess] Incoming body:", req.body);

    const { PayRefNo, PaymentID, id } = requestPayload || {};

    if (!PayRefNo || !PaymentID) {
      return sendResponse(
        res,
        400,
        "PayRefNo and PaymentID are required.",
        true,
        { requestPayload },
        0
      );
    }

    // ✅ connect with timeout protection (in case connectToMongoDB hangs)
    const db = await promiseTimeout(connectToMongoDB(), API_TIMEOUT_MS, "MongoDB connect");

    const col = db.collection("tblBookTripPayInfo");
    const now = new Date();

    // ✅ pre-check with maxTimeMS + global timeout
    const anyExisting = await promiseTimeout(
      col.findOne({ PayRefNo }, { maxTimeMS: MONGO_MAX_TIME_MS }),
      API_TIMEOUT_MS,
      "findOne(tblBookTripPayInfo)"
    );

    if (!anyExisting) {
      console.warn("[UpdateParentsPaySuccess] No record found for PayRefNo:", PayRefNo);
      return sendResponse(
        res,
        404,
        "No record found for the provided PayRefNo.",
        true,
        { requestPayload },
        0
      );
    }

    // Build update doc
    const updateDoc = {
      PayDate: now,
      MyFatrooahRefNo: PaymentID,
      payid: id ?? PaymentID,
      PayStatus: "APPROVED",
      UpdatedOn: now,
    };

    // ✅ updateMany with maxTimeMS + timeout wrapper
    const result = await promiseTimeout(
      col.updateMany(
        { PayRefNo },
        { $set: updateDoc },
        { upsert: false, maxTimeMS: MONGO_MAX_TIME_MS }
      ),
      API_TIMEOUT_MS,
      "updateMany(tblBookTripPayInfo)"
    );

    console.log("[UpdateParentsPaySuccess] updateMany result:", result);

    if (!result || result.matchedCount === 0) {
      return sendResponse(
        res,
        404,
        "No record found for the provided PayRefNo.",
        true,
        { requestPayload, updateResult: result },
        0
      );
    }

    // Fetch updated docs
    const updatedDocs = await promiseTimeout(
      col
        .find(
          { PayRefNo },
          {
            projection: {
              _id: 0,
              PayRefNo: 1,
              MyFatrooahRefNo: 1,
              payid: 1,
              PayStatus: 1,
              PayDate: 1,
              UpdatedOn: 1,
            },
          }
        )
        .maxTimeMS(MONGO_MAX_TIME_MS)
        .toArray(),
      API_TIMEOUT_MS,
      "find(toArray)(tblBookTripPayInfo)"
    );

    return sendResponse(
      res,
      200,
      `Payment marked as APPROVED for ${result.modifiedCount} document(s).`,
      false,
      {
        requestPayload,
        updateResult: {
          acknowledged: result.acknowledged,
          matchedCount: result.matchedCount,
          modifiedCount: result.modifiedCount,
        },
        saved: updatedDocs?.length
          ? updatedDocs
          : [
              {
                PayRefNo,
                MyFatrooahRefNo: PaymentID,
                payid: id ?? PaymentID,
                PayStatus: "APPROVED",
                PayDate: now,
                UpdatedOn: now,
              },
            ],
      },
      result.modifiedCount || 0
    );
  } catch (err) {
    // ✅ timeout returns 504
    if (err?.code === "ETIMEDOUT") {
      console.error("[UpdateParentsPaySuccess] TIMEOUT:", err?.message);
      return sendResponse(
        res,
        504,
        "Request timeout while updating payment status. Please retry.",
        true,
        { requestPayload, errorMessage: err?.message },
        0
      );
    }

    console.error("[UpdateParentsPaySuccess] ERROR:", err);
    return sendResponse(
      res,
      500,
      "Failed to update payment status.",
      true,
      { requestPayload, errorMessage: err?.message },
      0
    );
  }
};

// ============================
// UpdateParentsPayFail
// ============================
exports.UpdateParentsPayFail = async (req, res, next) => {
  const requestPayload = getPayload(req);

  try {
    console.log("[UpdateParentsPayFail] Incoming body:", req.body);

    const { PayRefNo, PaymentID, id } = requestPayload || {};

    if (!PayRefNo || !PaymentID) {
      return sendResponse(
        res,
        400,
        "PayRefNo and PaymentID are required.",
        true,
        { requestPayload },
        0
      );
    }

    // ✅ connect with timeout protection
    const db = await promiseTimeout(connectToMongoDB(), API_TIMEOUT_MS, "MongoDB connect");

    const col = db.collection("tblBookTripPayInfo");
    const now = new Date();

    // Check if any records exist
    const existingCount = await promiseTimeout(
      col.countDocuments({ PayRefNo }, { maxTimeMS: MONGO_MAX_TIME_MS }),
      API_TIMEOUT_MS,
      "countDocuments(tblBookTripPayInfo)"
    );

    if (!existingCount || existingCount === 0) {
      console.warn("[UpdateParentsPayFail] No record found for PayRefNo:", PayRefNo);
      return sendResponse(
        res,
        404,
        "No record found for the provided PayRefNo.",
        true,
        { requestPayload },
        0
      );
    }

    // Build update doc
    const updateDoc = {
      PayDate: now,
      MyFatrooahRefNo: PaymentID,
      payid: id ?? PaymentID,
      PayStatus: "FAILED",
      UpdatedOn: now,
    };

    const result = await promiseTimeout(
      col.updateMany(
        { PayRefNo },
        { $set: updateDoc },
        { upsert: false, maxTimeMS: MONGO_MAX_TIME_MS }
      ),
      API_TIMEOUT_MS,
      "updateMany(tblBookTripPayInfo)"
    );

    console.log("[UpdateParentsPayFail] updateMany result:", result);

    // Fetch updated docs
    const updatedDocs = await promiseTimeout(
      col
        .find(
          { PayRefNo },
          {
            projection: {
              _id: 0,
              PayRefNo: 1,
              MyFatrooahRefNo: 1,
              payid: 1,
              PayStatus: 1,
              PayDate: 1,
              UpdatedOn: 1,
            },
          }
        )
        .maxTimeMS(MONGO_MAX_TIME_MS)
        .toArray(),
      API_TIMEOUT_MS,
      "find(toArray)(tblBookTripPayInfo)"
    );

    return sendResponse(
      res,
      200,
      `Payment marked as FAILED for ${result.modifiedCount}/${result.matchedCount} record(s).`,
      false,
      {
        requestPayload,
        updateResult: {
          acknowledged: result.acknowledged,
          matchedCount: result.matchedCount,
          modifiedCount: result.modifiedCount,
        },
        saved: updatedDocs,
      },
      result.modifiedCount || 0
    );
  } catch (err) {
    if (err?.code === "ETIMEDOUT") {
      console.error("[UpdateParentsPayFail] TIMEOUT:", err?.message);
      return sendResponse(
        res,
        504,
        "Request timeout while updating payment status. Please retry.",
        true,
        { requestPayload, errorMessage: err?.message },
        0
      );
    }

    console.error("[UpdateParentsPayFail] ERROR:", err);
    return sendResponse(
      res,
      500,
      "Failed to update payment status.",
      true,
      { requestPayload, errorMessage: err?.message },
      0
    );
  }
};
