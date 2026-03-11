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
  try {
    const prtuserid = String(req.body?.prtuserid ?? "").trim()

    if (!prtuserid) {
      return sendResponse(res, "prtuserid is required.", true, [], 0)
    }

    const db = await connectToMongoDB()
    const regCol = db.collection("tblMemRegInfo")
    const usersCol = db.collection("tblprtusers")

    const now = new Date()

    const filterExpr = {
      $expr: {
        $eq: [
          { $trim: { input: { $toString: "$prtuserid" }, chars: " ," } },
          { $trim: { input: { $toString: prtuserid }, chars: " ," } },
        ],
      },
    }

    const regUpdate = await regCol.findOneAndUpdate(
      filterExpr,
      { $set: { RegUserStatus: "NOTACTIVE", UpdateDate: now } },
      { returnDocument: "after", projection: { _id: 0 } }
    )

    const userUpdate = await usersCol.findOneAndUpdate(
      filterExpr,
      { $set: { userstatus: "NOTACTIVE", UpdateDate: now } },
      { returnDocument: "after", projection: { _id: 0 } }
    )

    const regDoc = regUpdate?.value || null
    const userDoc = userUpdate?.value || null

    if (!regDoc && !userDoc) {
      return sendResponse(res, "User not found.", true, [], 0)
    }

    sendResponse(
      res,
      "account closed successfully.",
      null,
      {
        prtuserid,
        RegInfoUpdated: Boolean(regDoc),
        PrtUserUpdated: Boolean(userDoc),
        RegInfo: regDoc,
        PrtUser: userDoc,
      },
      1
    )
  } catch (error) {
    console.error("Error in closeMemProfileAccount:", error)
    next(error)
  }
}

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

 

 