// pay.controller.js
const crypto = require("crypto");
const { connectToMongoDB } = require("../../../database/mongodb");
const {
  generateUniqueId,
  generateactivityNo,
} = require("../../../controllers/operation/operation");

const { createUser, updatepassword } = require("../../service/userService");

// ============================
// Config
// ============================
const API_TIMEOUT_MS = Number(process.env.API_TIMEOUT_MS || 20000);
const MONGO_MAX_TIME_MS = Number(process.env.MONGO_MAX_TIME_MS || 8000);

// ============================
// Helper: send response
// ============================
function sendResponse(
  res,
  statusCode,
  message,
  error,
  results = null,
  totalCount = null
) {
  if (res.headersSent) return;

  return res.status(statusCode).json({
    statusCode,
    message,
    data: results,
    error: !!error,
    totalCount: totalCount,
  });
}

exports.memsignup = async (req, res, next) => {
  const prtuseridVal = generateUniqueId();

  try {
    const db = await connectToMongoDB();
    const { RegUserFullName, RegUserEmailAddress, password } = req.body;
    const username = req.body.RegUserMobileNo;
    const usertype = req.body.RegUserType;

    const NowISO = new Date();

    if (!RegUserFullName || String(RegUserFullName).trim() === "") {
      return sendResponse(res, 400, "RegUserFullName is required.", true);
    }

    if (!username || String(username).trim() === "") {
      return sendResponse(res, 400, "username is required.", true);
    }

    if (!password || String(password).trim() === "") {
      return sendResponse(res, 400, "password is required.", true);
    }

    if (!usertype || String(usertype).trim() === "") {
      return sendResponse(res, 400, "usertype is required.", true);
    }

    const existingUser = await db.collection("tblprtusers").findOne({
      username: { $regex: `^${String(username).trim()}$`, $options: "i" },
    });

    if (existingUser) {
      return sendResponse(res, 400, "duplicate mobile no or username", true);
    }

    if (RegUserEmailAddress && String(RegUserEmailAddress).trim() !== "") {
      const existingEmail = await db.collection("tblMemRegInfo").findOne({
        RegUserEmailAddress: {
          $regex: `^${String(RegUserEmailAddress).trim()}$`,
          $options: "i",
        },
      });

      if (existingEmail) {
        return sendResponse(res, 400, "duplicate email address", true);
      }
    }

    let pwdkey = "";
    const value = String(username).trim() + String(password).trim();
    const md5Key = crypto.createHash("md5").update(value, "utf-8").digest();

    for (let i = 0; i < md5Key.length; i++) {
      pwdkey += md5Key[i];
    }

    const schoolDoc = {
      prtuserid: prtuseridVal,
      RegUserFullName: String(RegUserFullName).trim(),
      RegUserStatus: "NOTACTIVE",
      IsDataStatus: "1",
      RegUserEmailAddress:
        RegUserEmailAddress && String(RegUserEmailAddress).trim() !== ""
          ? String(RegUserEmailAddress).trim()
          : null,
      RegUserMobileNo: String(username).trim(),
      CreatedAt: NowISO,
      UpdatedAt: NowISO,
      CreatedBy: prtuseridVal,
      ModifyBy: prtuseridVal,
      RegUserImageName: "logo.png",
    };

    const schoolInsertResult = await db
      .collection("tblMemRegInfo")
      .insertOne(schoolDoc);

    await createUser({
      prtuserid: prtuseridVal,
      username: String(username).trim(),
      password: String(password).trim(),
      usertype: "MEMBERSHIP-PARENT",
      userstatus: "NOTACTIVE",
      CreatedBy: prtuseridVal,
      ModifyBy: prtuseridVal,
    });

    return sendResponse(
      res,
      200,
      "Registration Inserted.",
      false,
      {
        schoolMongoId: schoolInsertResult.insertedId,
        prtuserid: prtuseridVal,
        username: String(username).trim(),
        usertype: String(usertype).trim(),
      }
    );
  } catch (error) {
    return sendResponse(
      res,
      500,
      "Error in Registration Inserted.",
      true,
      { error: String(error?.message || error) }
    );
  }
};