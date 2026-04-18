// controllers/membership/profile/profile.controller.js
const { connectToMongoDB } = require("../../../database/mongodb")
const {
  generateUniqueId,
} = require("../../../controllers/operation/operation");

// Helper function to send responses
function sendResponse(res, message, error, results, totalCount) {
  res.status(error ? 400 : 200).json({
    statusCode: error ? 400 : 200,
    message: message,
    data: results,
    error: error,
    totalCount: totalCount,
  })
}

exports.getMyWalletStar = async (req, res, next) => {
  try {
    const prtuserid = String(req.body?.prtuserid ?? "").trim();

    if (!prtuserid) {
      return sendResponse(res, "prtuserid is required.", true, [], 0);
    }

    const db = await connectToMongoDB();
    const starsCol = db.collection("tblMemStars");

    // ✅ SAME prtuserid TRIM FILTER (like your other code)
    const filter = {
      $expr: {
        $eq: [
          { $trim: { input: { $toString: "$ParentsID" }, chars: " ," } },
          { $trim: { input: { $toString: prtuserid }, chars: " ," } },
        ],
      },
    };

    const now = new Date();

    const activeFilter = {
      ...filter,
      StarIsActive: true,
      StarValidPeriodFrom: { $lte: now },
      $or: [
        { StarValidPeriodTo: { $gte: now } },
        { StarValidPeriodTo: null },
        { StarValidPeriodTo: { $exists: false } },
      ],
    };

    // ✅ Count + list (so you can see which rows)
    const activeCount = await starsCol.countDocuments(activeFilter);

    const activeStars = await starsCol
      .find(activeFilter, { projection: { _id: 0 } })
      .sort({ CreatedDate: -1 })
      .toArray();

    // ✅ Optional: total stars amount from active rows
    const totalActiveStars = activeStars.reduce(
      (sum, r) => sum + (Number(r.TotalStar) || 0),
      0
    );

    const totalActiveStarAmount = activeStars.reduce(
      (sum, r) => sum + (Number(r.TotalStarAmount) || 0),
      0
    );

    const result = {
      prtuserid,
      now,
      activeCount,
      totalActiveStars,
      totalActiveStarAmount,
      activeStars,
    };

    return sendResponse(res, "Active stars found.", null, result, activeCount);
  } catch (error) {
    console.error("Error in getMyWalletStarts:", error);
    next(error);
  }
};

 // controllers/membership/profile/profile.controller.js

exports.addMyWalletStar = async (req, res, next) => {
  try {
    console.log("✅ addMyWalletStar req.body =", req.body)

    const prtuserid = String(req.body?.prtuserid ?? "").trim()

    if (!prtuserid) {
      return sendResponse(res, "prtuserid is required.", true, [], 0)
    }

    const db = await connectToMongoDB()
    const starsCol = db.collection("tblMemStars")

    // ===============================
    // ✅ Read directly from req.body
    // ===============================
    const TotalStar = Number(req.body?.TotalStar ?? 0)
    const TotalStarAmount = Number(req.body?.TotalStarAmount ?? 0)

    // ✅ REQUIRED
    const PayRefNo = String(req.body?.PayRefNo ?? "").trim()
    const ProductID = String(req.body?.ProductID ?? "").trim()

    // ✅ NEW (ADDED)
    const PayInvoiceID = String(req.body?.PayInvoiceID ?? "").trim()
    const PayPaymentID = String(req.body?.PayPaymentID ?? "").trim()

    console.log("✅ PayRefNo =", PayRefNo)
    console.log("✅ ProductID =", ProductID)
    console.log("✅ PayInvoiceID =", PayInvoiceID)
    console.log("✅ PayPaymentID =", PayPaymentID)

    if (!PayRefNo) {
      return sendResponse(res, "PayRefNo is required.", true, [], 0)
    }

    if (!ProductID) {
      return sendResponse(res, "ProductID is required.", true, [], 0)
    }

    // ===============================
    // ✅ FIXED: AUTO CALCULATE VALIDITY (365 DAYS)
    // ===============================
    const StarValidPeriodFrom = new Date()

    const StarValidPeriodTo = new Date()
    StarValidPeriodTo.setDate(StarValidPeriodFrom.getDate() + 365)

    console.log("✅ StarValidPeriodFrom =", StarValidPeriodFrom)
    console.log("✅ StarValidPeriodTo =", StarValidPeriodTo)

    const StarIsActive = 1
    const ParentsID = String(req.body?.ParentsID ?? prtuserid).trim()
    const CreatedBy = String(req.body?.CreatedBy ?? prtuserid).trim()
    const ModifyBy = String(req.body?.ModifyBy ?? prtuserid).trim()

    const now = new Date()

    // ===============================
    // ✅ Build Insert Object
    // ===============================
    const starInsert = {
      StarID: generateUniqueId(), // auto generated

      // ✅ MUST SAVE
      PayRefNo,
      ProductID,

      // ✅ NEW SAVED FIELDS
      PayInvoiceID,
      PayPaymentID,

      TotalStar,
      TotalStarAmount,

      // ✅ UPDATED VALIDITY
      StarValidPeriodFrom,
      StarValidPeriodTo,

      StarIsActive,
      ParentsID,
      CreatedBy,
      CreatedDate: now,
      ModifyBy,
      ModifyDate: now,

      PayStatus: "APPROVED",
      PayParentsStatus: "NEW"
    }

    console.log("✅ starInsert =", starInsert)

    await starsCol.insertOne(starInsert)

    return sendResponse(
      res,
      "tblMemStars added successfully.",
      null,
      starInsert,
      1
    )
  } catch (error) {
    console.error("❌ Error in addMyWalletStars:", error)
    next(error)
  }
}


exports.getMyWalletStarList = async (req, res, next) => {
  try {
    const prtuserid = String(req.body?.prtuserid ?? "").trim();

    if (!prtuserid) {
      return sendResponse(res, "prtuserid is required.", true, [], 0);
    }

    const db = await connectToMongoDB();
    const starsCol = db.collection("tblMemStars");

    // ✅ SAME TRIM FILTER (like your other APIs)
    const filter = {
      $expr: {
        $eq: [
          { $trim: { input: { $toString: "$ParentsID" }, chars: " ," } },
          { $trim: { input: { $toString: prtuserid }, chars: " ," } },
        ],
      },
    };

    // ✅ Get ALL records
    const starsList = await starsCol
      .find(filter, { projection: { _id: 0 } })
      .sort({ CreatedDate: -1 })
      .toArray();

    return sendResponse(
      res,
      "Wallet star records found.",
      null,
      starsList,
      starsList.length
    );
  } catch (error) {
    console.error("Error in getMyWalletStarList:", error);
    next(error);
  }
};
exports.getAvailableStar = async (req, res, next) => {
  try {
    // ✅ Accept ParentsID (preferred) OR prtuserid (backward compatible)
    const ParentsID = String(req.body?.ParentsID ?? req.body?.prtuserid ?? "").trim()

    if (!ParentsID) {
      return sendResponse(res, "ParentsID is required.", true, [], 0)
    }

    const db = await connectToMongoDB()

    const starsCol = db.collection("tblMemStars")
    const ledgerCol = db.collection("tblMemShipStarLedger")

    const now = new Date()

    // =========================================================
    // ✅ SAME TRIM FILTER (ParentsID)
    // =========================================================
    const parentsMatchExpr = {
      $expr: {
        $eq: [
          { $trim: { input: { $toString: "$ParentsID" }, chars: " ," } },
          { $trim: { input: { $toString: ParentsID }, chars: " ," } },
        ],
      },
    }

    // =========================================================
    // ✅ ACTIVE STAR PACKAGES (valid now + active)
    // NOTE: StarIsActive in DB is Int32 (1/0) sometimes boolean
    // =========================================================
    const activeFilter = {
      ...parentsMatchExpr,
      StarValidPeriodFrom: { $lte: now },
      $or: [
        { StarValidPeriodTo: { $gte: now } },
        { StarValidPeriodTo: null },
        { StarValidPeriodTo: { $exists: false } },
      ],
      $or: [
        { StarIsActive: 1 },
        { StarIsActive: true },
        { StarIsActive: "1" },
      ],
    }

    const activeStars = await starsCol
      .find(activeFilter, { projection: { _id: 0 } })
      .sort({ CreatedDate: -1 })
      .toArray()

    const activeCount = activeStars.length

    // ✅ total purchased stars (only active + valid)
    const totalPurchasedStar = activeStars.reduce(
      (sum, r) => sum + (Number(r.TotalStar) || 0),
      0
    )

    const totalPurchasedStarAmount = activeStars.reduce(
      (sum, r) => sum + (Number(r.TotalStarAmount) || 0),
      0
    )

    // If no active packages, balance is zero
    if (activeCount === 0) {
      const result = {
        ParentsID,
        now,
        activeCount: 0,
        totalPurchasedStar: 0,
        totalPurchasedStarAmount: 0,
        totalUsedStar: 0,
        balanceStar: 0,
        activeStars: [],
      }
      return sendResponse(res, "No active star packages found.", null, result, 0)
    }

    // =========================================================
    // ✅ Compute USED stars from ledger INSIDE ACTIVE PERIODS
    // If you ever allow multiple active packages, we sum used stars
    // inside ANY active package window.
    // =========================================================
    const periods = activeStars.map((p) => ({
      from: p.StarValidPeriodFrom ? new Date(p.StarValidPeriodFrom) : null,
      to: p.StarValidPeriodTo ? new Date(p.StarValidPeriodTo) : null,
    })).filter(x => x.from) // must have from

    // Build $or time windows for CreatedDate
    const dateOr = periods.map((w) => {
      if (w.to) {
        return { CreatedDate: { $gte: w.from, $lte: w.to } }
      }
      // open-ended
      return { CreatedDate: { $gte: w.from } }
    })

    const ledgerAgg = await ledgerCol.aggregate([
      // ✅ match ParentsID by trimming PurchasedParentsID
      {
        $match: {
          $expr: {
            $eq: [
              { $trim: { input: { $toString: "$PurchasedParentsID" }, chars: " ," } },
              { $trim: { input: { $toString: ParentsID }, chars: " ," } },
            ],
          },
        }
      },
      // ✅ match only rows inside current active package validity window(s)
      ...(dateOr.length > 0 ? [{ $match: { $or: dateOr } }] : []),
      {
        $group: {
          _id: null,
          totalUsedStar: { $sum: { $toDouble: "$PurchasedStar" } },
          usedCount: { $sum: 1 },
        }
      }
    ]).toArray()

    const totalUsedStar = Number(ledgerAgg?.[0]?.totalUsedStar || 0)
    const usedCount = Number(ledgerAgg?.[0]?.usedCount || 0)

    // ✅ current balance
    const balanceStar = Number(totalPurchasedStar) - Number(totalUsedStar)

    const result = {
      ParentsID,
      now,
      activeCount,
      totalPurchasedStar,
      totalPurchasedStarAmount,
      totalUsedStar,
      usedCount,
      totalBalanceStar:balanceStar,
      
    }

    return sendResponse(res, "Star balance fetched successfully.", null, result, activeCount)
  } catch (error) {
    console.error("Error in getAvailableStar:", error)
    next(error)
  }
}
