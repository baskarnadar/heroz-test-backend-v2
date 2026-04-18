// services/userService.js

const { connectToMongoDB } = require("../../database/mongodb");
const crypto = require("crypto");
const { generatePassWord,generateOtp } = require("../operation/operation");

const createUser = async (userData, req) => {
  var pwdkey = "";
  try {
    const db = await connectToMongoDB();

    // ✅ Use password from userData if provided, else generate one
    var passwordval =
      userData.password && String(userData.password).trim() !== ""
        ? String(userData.password).trim()
        : generatePassWord();

    console.log("passwordval");
    console.log(passwordval);

    var usernameval = String(userData.username || "").trim();
    console.log("username");
    console.log(usernameval);

    if (!usernameval) {
      throw new Error("username is required");
    }

    var value = usernameval + passwordval;
    let md5Key = crypto.createHash("md5").update(value, "utf-8").digest();

    for (let i = 0; i < md5Key.length; i++) {
      pwdkey += md5Key[i];
    }

    console.log("pwdkey");
    console.log(pwdkey);

    // ✅ generate OTP once and save same OTP in DB + send same OTP in SMS
    const generatedOtp = generateOtp();

    const newUser = {
      prtuserid: userData.prtuserid,
      username: usernameval,
      password: pwdkey,
      usertype: userData.usertype || "school",
      userstatus: userData.userstatus || "active",
      CreatedBy: userData.CreatedBy || "system",
      CreatedDate: new Date(),
      ModifyBy: userData.ModifyBy || "system",
      ModifyDate: new Date(),
      IsDataStatus: 1,
      userotp: generatedOtp,
    };

    const result = await db.collection("tblprtusers").insertOne(newUser);

    console.log("createUser insert result");
    console.log(result);

    // ✅ send OTP SMS only after successful insert
    let smsResult = null;

    if (result?.insertedId) {
      const smsMessage = `Your OTP is: ${generatedOtp}`;

      console.log("OTP SMS mobile");
      console.log(usernameval);
      console.log("OTP SMS message");
      console.log(smsMessage);

      smsResult = await herozsendsms(usernameval, "REGISTEROTP", "en", {
        req,
        message: smsMessage,
        enableIpRateLimit: true,
        enableMobileRateLimit: true,
      });

      console.log("OTP SMS result");
      console.log(smsResult);
    }

    // ✅ return both db result and sms result
    return {
      insertResult: result,
      otp: generatedOtp,
      smsResult: smsResult,
    };
  } catch (error) {
    console.error("Error in createUser:", error);
    throw error;
  }
};
const updatepassword = async (req, res, userdata) => {
  try {
    let pwdkey = "";
    const db = await connectToMongoDB();
    const collection = db.collection("tblprtusers");
    console.log(userdata);
    const usernameval = userdata.username;
    const passwordval = userdata.password; // 🔧 FIX: was `userdata.Password` (wrong case)
    const prtuseridval = userdata.prtuserid;
    const ModifyByVal = userdata.ModifyBy;

    if (!prtuseridval) {
      return res
        .status(400)
        .json({ success: false, message: "UserID is required" });
    }

   
    const value = usernameval + passwordval;
    const md5Key = crypto.createHash("md5").update(value, "utf-8").digest(); 
 
    for (let i = 0; i < md5Key.length; i++) {
      pwdkey += md5Key[i];
    }
  console.log("usernameval");
    console.log(usernameval);
    console.log("passwordval");
    console.log(passwordval);
     console.log("prtuseridval");
    console.log(prtuseridval);
    console.log(pwdkey);


    const updateFields = {
      password: pwdkey,
      ModifyBy: ModifyByVal,
      ModifyDate: new Date(),
    };
    console.log(updateFields);
    const updateResult = await collection.updateOne(
      { prtuserid: prtuseridval },
      { $set: updateFields }
    );

    if (updateResult.matchedCount === 0) {
      return res
        .status(404)
        .json({ success: false, message: "No UserID found to update" });
    }

    return res
      .status(200)
      .json({ success: true, message: "Password updated successfully" });
  } catch (error) {
    console.error("Update Password Error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

module.exports = {
  updatepassword,
};

module.exports = {
  createUser,
  updatepassword,
};
