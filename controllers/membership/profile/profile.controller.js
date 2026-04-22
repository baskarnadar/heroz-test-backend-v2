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

// ✅ GET REG INFO ONLY ( )
exports.getMemProfileInfo = async (req, res, next) => {
  try {
    const prtuserid = String(req.body?.prtuserid ?? "").trim()

    if (!prtuserid) {
      return sendResponse(res, "prtuserid is required.", true, [], 0)
    }

    const db = await connectToMongoDB()
    const regCol = db.collection("tblMemRegInfo")

    const regDoc = await regCol.findOne(
      {
        $expr: {
          $eq: [
            { $trim: { input: { $toString: "$prtuserid" }, chars: " ," } },
            { $trim: { input: { $toString: prtuserid }, chars: " ," } },
          ],
        },
      },
      { projection: { _id: 0 } }
    )

    if (!regDoc) {
      return sendResponse(res, "User not found.", true, [], 0)
    }

    sendResponse(res, "reg info found.", null, regDoc, 1)
  } catch (error) {
    console.error("Error in getMemProfileInfo:", error)
    next(error)
  }
}

// ✅ UPDATE REG INFO ONLY (NO IMAGE AT ALL)
 

// ✅ CLOSE ACCOUNT: set NOTACTIVE in   AND tblprtusers
 exports.closeMemProfileAccount = async (req, res, next) => {
  let db = null;
  let tblAccountDeleteLog = null;
  let logId = null;

  try {
    const prtuserid = String(req.body?.prtuserid ?? "").trim();

    if (!prtuserid) {
      return sendResponse(res, "prtuserid is required.", true, [], 0);
    }

    db = await connectToMongoDB();

    const tblprtusers = db.collection("tblprtusers");
    const tblMemRegInfo = db.collection("tblMemRegInfo");
    const tblnotification = db.collection("tblnotification");
    const tblMemStars = db.collection("tblMemStars");
    const tblMemStarPayFail = db.collection("tblMemStarPayFail");
    const tblMemShipStarLedger = db.collection("tblMemShipStarLedger");
    const tblMemShipBookingInfo = db.collection("tblMemShipBookingInfo");
    const tblMemReview = db.collection("tblMemReview");
    const tblMemKidsInfo = db.collection("tblMemKidsInfo");
    const tblFavourite = db.collection("tblFavourite");
    const tblBookTripPayInfo = db.collection("tblBookTripPayInfo");
    const tblBookTripParentsInfo = db.collection("tblBookTripParentsInfo");
    const tblBookTripKidsInfo = db.collection("tblBookTripKidsInfo");
    tblAccountDeleteLog = db.collection("tblAccountDeleteLog");

    const now = new Date();

    console.log("🚀 closeMemProfileAccount payload =");
    console.log(JSON.stringify(req.body, null, 2));

    // =========================================
    // COMMON FILTERS
    // =========================================
    const prtUserExprFilter = {
      $expr: {
        $eq: [
          { $trim: { input: { $toString: "$prtuserid" }, chars: " ," } },
          { $trim: { input: { $toString: prtuserid }, chars: " ," } },
        ],
      },
    };

    const parentsIdExprFilter = {
      $expr: {
        $eq: [
          { $trim: { input: { $toString: "$ParentsID" }, chars: " ," } },
          { $trim: { input: { $toString: prtuserid }, chars: " ," } },
        ],
      },
    };

    const bookingParentsExprFilter = {
      $expr: {
        $eq: [
          { $trim: { input: { $toString: "$BookingParentsID" }, chars: " ," } },
          { $trim: { input: { $toString: prtuserid }, chars: " ," } },
        ],
      },
    };

    const purchasedParentsExprFilter = {
      $expr: {
        $eq: [
          { $trim: { input: { $toString: "$PurchasedParentsID" }, chars: " ," } },
          { $trim: { input: { $toString: prtuserid }, chars: " ," } },
        ],
      },
    };

    // =========================================
    // CHECK USER EXISTS
    // =========================================
    const existingPrtUser = await tblprtusers.findOne(prtUserExprFilter, {
      projection: { _id: 0 },
    });

    const existingRegUser = await tblMemRegInfo.findOne(prtUserExprFilter, {
      projection: { _id: 0 },
    });

    if (!existingPrtUser && !existingRegUser) {
      return sendResponse(res, "User not found.", true, [], 0);
    }

    // =========================================
    // READ FULL SNAPSHOT BEFORE DELETE
    // =========================================
    const snapshot = {
      tblprtusers: await tblprtusers.find(prtUserExprFilter).toArray(),
      tblMemRegInfo: await tblMemRegInfo.find(prtUserExprFilter).toArray(),
      tblnotification: await tblnotification.find(parentsIdExprFilter).toArray(),
      tblMemStars: await tblMemStars.find(parentsIdExprFilter).toArray(),
      tblMemStarPayFail: await tblMemStarPayFail.find(parentsIdExprFilter).toArray(),
      tblMemShipStarLedger: await tblMemShipStarLedger.find(purchasedParentsExprFilter).toArray(),
      tblMemShipBookingInfo: await tblMemShipBookingInfo.find(bookingParentsExprFilter).toArray(),
      tblMemReview: await tblMemReview.find(parentsIdExprFilter).toArray(),
      tblMemKidsInfo: await tblMemKidsInfo.find(parentsIdExprFilter).toArray(),
      tblFavourite: await tblFavourite.find(parentsIdExprFilter).toArray(),
      tblBookTripPayInfo: await tblBookTripPayInfo.find(parentsIdExprFilter).toArray(),
      tblBookTripParentsInfo: await tblBookTripParentsInfo.find(parentsIdExprFilter).toArray(),
      tblBookTripKidsInfo: await tblBookTripKidsInfo.find(parentsIdExprFilter).toArray(),
    };

    const matchedCounts = {
      tblprtusers: snapshot.tblprtusers.length,
      tblMemRegInfo: snapshot.tblMemRegInfo.length,
      tblnotification: snapshot.tblnotification.length,
      tblMemStars: snapshot.tblMemStars.length,
      tblMemStarPayFail: snapshot.tblMemStarPayFail.length,
      tblMemShipStarLedger: snapshot.tblMemShipStarLedger.length,
      tblMemShipBookingInfo: snapshot.tblMemShipBookingInfo.length,
      tblMemReview: snapshot.tblMemReview.length,
      tblMemKidsInfo: snapshot.tblMemKidsInfo.length,
      tblFavourite: snapshot.tblFavourite.length,
      tblBookTripPayInfo: snapshot.tblBookTripPayInfo.length,
      tblBookTripParentsInfo: snapshot.tblBookTripParentsInfo.length,
      tblBookTripKidsInfo: snapshot.tblBookTripKidsInfo.length,
    };

    console.log("📌 matchedCounts before delete =");
    console.log(JSON.stringify(matchedCounts, null, 2));

    // =========================================
    // CREATE LOG FIRST WITH FULL SNAPSHOT
    // =========================================
    const logDoc = {
      prtuserid,
      deletedAt: now,
      deletedBy: req.body?.deletedBy || "SELF",
      deleteReason: req.body?.deleteReason || "User requested account closure",
      requestPayload: req.body,
      matchedCounts,
      deletedCounts: {},
      totalDeleted: 0,
      status: "STARTED",
      createdAt: now,
      updatedAt: now,

      // ✅ FULL DOCUMENT BACKUP
      snapshot,

      // optional metadata
      archiveMode: "LOG_SNAPSHOT_BEFORE_DELETE",
    };

    const logInsertResult = await tblAccountDeleteLog.insertOne(logDoc);
    logId = logInsertResult.insertedId;

    console.log("✅ delete log created =");
    console.log(String(logId));

    // =========================================
    // DELETE FROM ORIGINAL TABLES
    // =========================================
    const deletedCounts = {};

    const prtusersDelete = await tblprtusers.deleteMany(prtUserExprFilter);
    deletedCounts.tblprtusers = prtusersDelete.deletedCount;

    const memRegDelete = await tblMemRegInfo.deleteMany(prtUserExprFilter);
    deletedCounts.tblMemRegInfo = memRegDelete.deletedCount;

    const notificationDelete = await tblnotification.deleteMany(parentsIdExprFilter);
    deletedCounts.tblnotification = notificationDelete.deletedCount;

    const memStarsDelete = await tblMemStars.deleteMany(parentsIdExprFilter);
    deletedCounts.tblMemStars = memStarsDelete.deletedCount;

    const memStarPayFailDelete = await tblMemStarPayFail.deleteMany(parentsIdExprFilter);
    deletedCounts.tblMemStarPayFail = memStarPayFailDelete.deletedCount;

    const memShipStarLedgerDelete = await tblMemShipStarLedger.deleteMany(
      purchasedParentsExprFilter
    );
    deletedCounts.tblMemShipStarLedger = memShipStarLedgerDelete.deletedCount;

    const memShipBookingInfoDelete = await tblMemShipBookingInfo.deleteMany(
      bookingParentsExprFilter
    );
    deletedCounts.tblMemShipBookingInfo = memShipBookingInfoDelete.deletedCount;

    const memReviewDelete = await tblMemReview.deleteMany(parentsIdExprFilter);
    deletedCounts.tblMemReview = memReviewDelete.deletedCount;

    const memKidsInfoDelete = await tblMemKidsInfo.deleteMany(parentsIdExprFilter);
    deletedCounts.tblMemKidsInfo = memKidsInfoDelete.deletedCount;

    const favouriteDelete = await tblFavourite.deleteMany(parentsIdExprFilter);
    deletedCounts.tblFavourite = favouriteDelete.deletedCount;

    const bookTripPayInfoDelete = await tblBookTripPayInfo.deleteMany(parentsIdExprFilter);
    deletedCounts.tblBookTripPayInfo = bookTripPayInfoDelete.deletedCount;

    const bookTripParentsInfoDelete = await tblBookTripParentsInfo.deleteMany(
      parentsIdExprFilter
    );
    deletedCounts.tblBookTripParentsInfo = bookTripParentsInfoDelete.deletedCount;

    const bookTripKidsInfoDelete = await tblBookTripKidsInfo.deleteMany(parentsIdExprFilter);
    deletedCounts.tblBookTripKidsInfo = bookTripKidsInfoDelete.deletedCount;

    const totalDeleted = Object.values(deletedCounts).reduce(
      (sum, count) => sum + Number(count || 0),
      0
    );

    console.log("✅ deletedCounts =");
    console.log(JSON.stringify(deletedCounts, null, 2));

    // =========================================
    // UPDATE LOG AFTER SUCCESS
    // =========================================
    await tblAccountDeleteLog.updateOne(
      { _id: logId },
      {
        $set: {
          deletedCounts,
          totalDeleted,
          status: "SUCCESS",
          completedAt: new Date(),
          updatedAt: new Date(),
        },
      }
    );

    return sendResponse(
      res,
      "Account and all related data backed up in log and deleted successfully.",
      false,
      {
        prtuserid,
        logId,
        matchedCounts,
        deletedCounts,
        totalDeleted,
      },
      1
    );
  } catch (error) {
    console.error("❌ Error in closeMemProfileAccount:", error);

    try {
      if (tblAccountDeleteLog && logId) {
        await tblAccountDeleteLog.updateOne(
          { _id: logId },
          {
            $set: {
              status: "FAILED",
              errorMessage: error?.message || "Unknown error",
              updatedAt: new Date(),
              failedAt: new Date(),
            },
          }
        );
      }
    } catch (logError) {
      console.error("❌ Error while updating delete log:", logError);
    }

    next(error);
  }
};
 exports.updateMemProfileInfo = async (req, res, next) => {
  try {
    const prtuserid = String(req.body?.prtuserid ?? "").trim()

    if (!prtuserid) {
      return sendResponse(res, "prtuserid is required.", true, [], 0)
    }

    // ✅ Read fields from request
    const RegUserFullName = String(req.body?.RegUserFullName ?? "").trim()
    const RegUserEmailAddress = String(req.body?.RegUserEmailAddress ?? "").trim()

    if (!RegUserFullName && !RegUserEmailAddress) {
      return sendResponse(res, "No fields to update.", true, [], 0)
    }

    const db = await connectToMongoDB()
    const regCol = db.collection("tblMemRegInfo")

    // ✅ SAME FILTER (USED FOR FIND + UPDATE)
    const filter = {
      $expr: {
        $eq: [
          { $trim: { input: { $toString: "$prtuserid" }, chars: " ," } },
          { $trim: { input: { $toString: prtuserid }, chars: " ," } },
        ],
      },
    }

    // =====================================================
    // ✅ 1) FIND FIRST (DO NOT REMOVE)
    // =====================================================
    const regDoc = await regCol.findOne(filter, { projection: { _id: 0 } })

    if (!regDoc) {
      return sendResponse(res, "User not found.", true, [], 0)
    }

    // =====================================================
    // ✅ 2) UPDATE SAME TABLE
    // =====================================================
    const $set = {}
    if (RegUserFullName) $set.RegUserFullName = RegUserFullName
    if (RegUserEmailAddress) $set.RegUserEmailAddress = RegUserEmailAddress
    $set.UpdateDate = new Date()

    await regCol.updateOne(filter, { $set })

    // =====================================================
    // ✅ 3) RETURN UPDATED DATA (MERGED)
    // =====================================================
    const result = {
      ...regDoc,
      RegUserFullName: RegUserFullName || regDoc.RegUserFullName,
      RegUserEmailAddress: RegUserEmailAddress || regDoc.RegUserEmailAddress,
      UpdateDate: $set.UpdateDate,
    }

    sendResponse(res, "tblMemRegInfo updated successfully.", null, result, 1)
  } catch (error) {
    console.error("Error in updateMemProfileInfo:", error)
    next(error)
  }
}

 

 