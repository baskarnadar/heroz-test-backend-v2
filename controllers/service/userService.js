// services/userService.js

const { connectToMongoDB } = require("../../database/mongodb");
const crypto = require("crypto");
const { generatePassWord,generateOtp } = require("../operation/operation");

 const createUser = async (userData, req) => {
  var pwdkey = "";
  try {
    const db = await connectToMongoDB();

    // ✅ Use password from req.body if provided, else generate one
    var passwordval = (userData.password && String(userData.password).trim() !== "")
      ? userData.password
      : generatePassWord();
   console.log("passwordval");
console.log(passwordval);
    var usernameval = userData.username;
    console.log("username");
    console.log(usernameval);
    var value = usernameval + passwordval;
    let md5Key = crypto.createHash("md5").update(value, "utf-8").digest();
    for (let i = 0; i < md5Key.length; i++) {
      pwdkey += md5Key[i];
    }
    console.log("pwdkey");
console.log(pwdkey);
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
      userotp : generateOtp()
    };

    const result = await db.collection("tblprtusers").insertOne(newUser);
    return result;
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
