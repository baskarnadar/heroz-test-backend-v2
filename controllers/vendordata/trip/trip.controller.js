const { connectToMongoDB } = require("../../../database/mongodb");
const {
  generateUniqueId,
} = require("../../../controllers/operation/operation");

// ✅ Helper function to send responses
function sendResponse(res, message, error, results = null, totalCount = null) {
  res.status(error ? 400 : 200).json({
    statusCode: error ? 400 : 200,
    message: message,
    data: results,
    error: error,
    totalCount: totalCount,
  });
}

// ✅ Update trip final status to COMPLETED
exports.updateTripCompleted= async (req, res, next) => {
  try {
    const { RequestID } = req.body;
    if (!RequestID) {
      return sendResponse(res, "RequestID is required", true);
    }

    const db = await connectToMongoDB();
    const collection = db.collection("tblactivityrequest");

    // 🔹 Update only if RequestID matches
    const updateResult = await collection.updateOne(
      { RequestID: RequestID },
      { $set: { actRequestStatus: "COMPLETED" } }
    );

    return sendResponse(
      res,
      "Trip status updated to COMPLETED successfully",
      null,
      updateResult.modifiedCount
    );
  } catch (error) {
    console.error("Error updating trip final:", error);
    return sendResponse(res, "Server error", true);
  }
};
 

exports.getTripFinalNote = async (req, res, next) => {
  try {
    const { RequestID, VendorID } = req.body || {};
    if (!RequestID || !VendorID) {
      return sendResponse(res, "RequestID and VendorID are required", true);
    }

    const db = await connectToMongoDB();
    const reqCol = db.collection("tblactivityrequest");

    const pipeline = [
      // 1) Filter by RequestID & VendorID
      {
        $match: {
          RequestID: String(RequestID).trim(),
          VendorID: String(VendorID).trim(),
        },
      },

      // 2) Lookup actName from tblactivityinfo by ActivityID
      {
        $lookup: {
          from: "tblactivityinfo",
          let: { aID: "$ActivityID" },
          pipeline: [
            {
              $match: {
                $expr: {
                  // robust compare in case one side is number and the other is string
                  $eq: [{ $toString: "$ActivityID" }, { $toString: "$$aID" }],
                },
              },
            },
            { $project: { _id: 0, actName: 1 } },
          ],
          as: "activityInfo",
        },
      },

      // 3) Flatten actName onto the root doc
      {
        $addFields: {
          actName: {
            $ifNull: [{ $arrayElemAt: ["$activityInfo.actName", 0] }, null],
          },
        },
      },

      // 4) (Optional) Hide the temp array
      { $project: { activityInfo: 0 } },
    ];

    const tripDetails = await reqCol.aggregate(pipeline).toArray();

    if (!tripDetails || tripDetails.length === 0) {
      return sendResponse(res, "No trip found for this RequestID and VendorID", true);
    }

    return sendResponse(
      res,
      "Trip details fetched successfully",
      null,
      tripDetails.length,
      tripDetails
    );
  } catch (error) {
    console.error("Error fetching trip details:", error);
    return sendResponse(res, "Server error", true);
  }
};
 const crypto = require('crypto')

// Robust ID generator for ParentsPayID
 
exports.impParentsMobileNo = async (req, res) => {
  try {
    const { RequestID, VendorID, ActivityID } = req.body || {}

    if (!RequestID || !VendorID) {
      return sendResponse(res, 'RequestID and VendorID are required', true)
    }

    // Accept shapes:
    // 1) recipients: [{ mobile/Mobile/phone/Phone }]
    // 2) mobiles: ["055...", "+9665..."]
    // 3) mobile: "055..."
    let mobiles = []
    if (Array.isArray(req.body?.recipients)) {
      mobiles = req.body.recipients
        .map((r) => (r && (r.mobile ?? r.Mobile ?? r.phone ?? r.Phone)) || '')
        .filter(Boolean)
    } else if (Array.isArray(req.body?.mobiles)) {
      mobiles = req.body.mobiles
    } else if (typeof req.body?.mobile === 'string') {
      mobiles = [req.body.mobile]
    }

    // Normalize, dedupe, light validate
    const sanitizeDigits = (s) => (s || '').toString().replace(/[^\d+]/g, '')
    const looksLikeMobile = (s) => {
      const raw = sanitizeDigits(s).replace(/^\+/, '')
      return raw.length >= 9 && raw.length <= 12
    }

    const seen = new Set()
    const clean = []
    for (const m of mobiles) {
      const san = sanitizeDigits(m)
      if (!san) continue
      if (!looksLikeMobile(san)) continue
      const key = san.replace(/^\+/, '')
      if (seen.has(key)) continue
      seen.add(key)
      clean.push(key)
    }

    if (clean.length === 0) {
      return sendResponse(res, 'No valid mobile numbers found', true, { sentCount: 0 })
    }

    const db = await connectToMongoDB()
    const col = db.collection('tblBookTripParentsMobileNo')

    const reqKey = String(RequestID).trim()
    const vendKey = String(VendorID).trim()
    const actKey = ActivityID != null ? String(ActivityID).trim() : null

    // If you may have existing docs where ActivityID is missing/undefined,
    // consider using $in to treat null/undefined the same. Otherwise, keep exact match.
    const dupMatch = {
      RequestID: reqKey,
      // Use either of the following lines:
      ActivityID: actKey, // exact match (current behavior)
      // ActivityID: { $in: [actKey, null] }, // optional: match null/undefined consistently
      ParentsMobileNo: { $in: clean },
    }

    // Check duplicates across (RequestID, ActivityID, ParentsMobileNo)
    const existing = await col
      .find(dupMatch)
      .project({ ParentsMobileNo: 1, _id: 0 })
      .toArray()

    const now = new Date()

    if (existing.length > 0) {
      const existSet = new Set(existing.map((e) => e.ParentsMobileNo))
      const nonDupes = clean.filter((x) => !existSet.has(x))

      if (nonDupes.length === 0) {
        return sendResponse(res, 'Duplicate numbers for this activity', true, {
          duplicates: Array.from(existSet),
          sentCount: 0,
        })
      }

      // Insert only non-duplicates (WITH ParentsPayID)
      const docs = nonDupes.map((ParentsMobileNo) => ({
        ParentsPayID: generateUniqueId(),
        RequestID: reqKey,
        VendorID: vendKey,
        ActivityID: actKey,
        ParentsMobileNo,
        status: 'APPROVED',
        createdAt: now,
        lastImportedAt: now,
      }))

      const result = await col.insertMany(docs, { ordered: false })
      const inserted = typeof result?.insertedCount === 'number'
        ? result.insertedCount
        : Object.keys(result?.insertedIds || {}).length

      return sendResponse(res, 'Partially added (duplicates skipped)', false, {
        inserted,
        duplicates: Array.from(existSet),
      })
    }

    // All new (WITH ParentsPayID)
    const docs = clean.map((ParentsMobileNo) => ({
      ParentsPayID: generateUniqueId(),
      RequestID: reqKey,
      VendorID: vendKey,
      ActivityID: actKey,
      ParentsMobileNo,
      status: 'APPROVED',
      createdAt: now,
      lastImportedAt: now,
    }))

    const result = await col.insertMany(docs, { ordered: false })
    const inserted = typeof result?.insertedCount === 'number'
      ? result.insertedCount
      : Object.keys(result?.insertedIds || {}).length

    return sendResponse(res, 'Successfully added', false, { inserted })
  } catch (err) {
    console.error('impParentsMobileNo error:', err)
    return sendResponse(res, 'Server error', true)
  }
}

 
