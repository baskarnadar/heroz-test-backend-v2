const { connectToMongoDB } = require("../../database/mongodb");
const crypto = require("crypto");

const { v4: uuidv4 } = require("uuid");
// Helper function to send responses
function sendResponse(res, message, error, results) {
  res.status(error ? 400 : 200).json({
    statusCode: error ? 400 : 200,
    message: message,
    data: results,
    error: error,
  });
}

exports.getsubadminall = async (req, res, next) => {
  try {
    const db = await connectToMongoDB();
    const items = await db.collection("tblprtusers").find().toArray();
    sendResponse(res, "Data fetched successfully .", null, items);
  } catch (error) {
    console.log(error);
    next(error);
  }
};

exports.getsubadmin = async (req, res, next) => {
  try {
    const db = await connectToMongoDB();
    const { prtuserid } = req.body;

    if (!prtuserid) {
      return sendResponse(res, "prtuserid is required.", true);
    }

    const user = await db.collection("tblprtuser").findOne({ prtuserid });

    if (!user) {
      return sendResponse(res, "User not found.", true);
    }

    sendResponse(res, "User fetched successfully.", null, user);
  } catch (error) {
    console.error(error);
    next(error);
  }
};
exports.deletesubadmin = async (req, res, next) => {
  try {
    const db = await connectToMongoDB();
    const { prtuserid } = req.body;
    console.log("prtuserid");
    console.log(prtuserid);

    if (!prtuserid) {
      return sendResponse(res, "prtuserid is required.", true);
    }

    const result = await db.collection("tblprtusers").deleteOne({ prtuserid });
    console.log(result);
    if (result.deletedCount === 0) {
      return sendResponse(res, "User not found or already deleted.", true);
    }

    sendResponse(res, "User deleted successfully.", null, result);
  } catch (error) {
    console.error(error);
    next(error);
  }
};

function generateUniqueId() {
  length = 25;
  const uuid = uuidv4().replace(/-/g, "");
  return uuid.substring(0, length);
}

exports.createsubadmin = async (req, res, next) => {
  const userfullnameVal = req.body.userfullname;
  const usernameVal = req.body.username;
  const passwordVal = req.body.password;
  const usertypeVal = req.body.usertype;
  var pwdkey = "";

  var value = usernameVal + passwordVal;
  let md5Key = crypto.createHash("md5").update(value, "utf-8").digest();
  //md5KeyVal = Buffer.concat([md5Key]);
  console.log(md5Key.length);
  for (let i = 0; i < md5Key.length; i++) {
    pwdkey += md5Key[i];
  }

  const Useritem = {
    userfullname: userfullnameVal,
    username: usernameVal,
    password: pwdkey,
    prtuserid: generateUniqueId(),
    userstatus: "ACTIVE",
    usertype: usertypeVal,
    CreatedBy: req.body.CreatedBy,
    CreatedDate: new Date(),
    ModifyBy: req.body.ModifyBy,
    ModifyDate: new Date(),
  };

  try {
    const db = await connectToMongoDB();
    const result = await db.collection("tblprtusers").insertOne(Useritem);
    sendResponse(res, "User inserted successfully.", null, result);
  } catch (error) {
    console.log(error);
    next(error);
  }
};
// adjust path as needed
exports.signin = async (req, res, next) => {
  const jwt = require("jsonwebtoken");
  const crypto = require("crypto");

  const SECRET = process.env.JWT_SECRET;

  const usernameval = String(req.body?.username || "").trim();
  const passwordval = String(req.body?.password || "").trim();

  if (!usernameval || !passwordval) {
    return sendResponse(res, "Username and password required.", null, null);
  }

  let ProfileImageName = "";
  let ProfileName = "";
  let loggedusername = "";

  try {
    const combinedValue = usernameval + passwordval;
    const md5Buffer = crypto
      .createHash("md5")
      .update(combinedValue, "utf-8")
      .digest();

    let pwdkey = "";
    for (let i = 0; i < md5Buffer.length; i++) {
      pwdkey += md5Buffer[i];
    }

    const db = await connectToMongoDB();

    console.log("---------2-------------");
    console.log(usernameval);
    console.log(passwordval);
    console.log(pwdkey);
    console.log("--------------2--------");

    const user = await db.collection("tblprtusers").findOne(
      {
        username: usernameval,
        password: pwdkey,
        userstatus: "ACTIVE",
      },
      {
        projection: { password: 0 },
      }
    );

    if (!user) {
      return sendResponse(
        res,
        "Invalid credentials, not an admin, or inactive account.",
        null,
        null
      );
    }
 console.log("usertype=");
console.log(user?.usertype ?? "");
    const prtuserid = user?.prtuserid ? String(user.prtuserid) : "";
    const usertype = String(user?.usertype ?? "").trim().toUpperCase();
    console.log("usertype=");
console.log(usertype);
    if (usertype === "SCHOOL-SUBADMIN") {
      const school = await db.collection("tblschoolinfo").findOne({
        SchoolID: prtuserid,
      });

      if (school?.schName) {
        loggedusername = school.schName || "";
        ProfileName = school.schName || "";
      }

      if (process.env.SchoolImageUrl && school?.schImageName) {
        ProfileImageName = `${process.env.SchoolImageUrl}/${school.schImageName}`;
      }
    } else if ((usertype === "VENDOR-SUBADMIN") || (usertype === "VENDOR-SUBADMIN")) {
      const vendor = await db.collection("tblvendorinfo").findOne({
        VendorID: prtuserid,
      });

      if (vendor?.vdrName) {
        loggedusername = vendor.vdrName || "";
        ProfileName = vendor.vdrName || "";
      }

      if (process.env.VendorImageUrl && vendor?.vdrImageName) {
        ProfileImageName = `${process.env.VendorImageUrl}/${vendor.vdrImageName}`;
      }

    } 
    else if (usertype === "MEMBERSHIP-PARENT") {
      const vendor = await db.collection("tblMemRegInfo").findOne({
        prtuserid: prtuserid,
      });

      if (vendor?.RegUserFullName) {
        loggedusername = vendor.RegUserFullName || "";
        ProfileName = vendor.RegUserFullName || "";
      }

      if ( member?.RegUserImageName) {
        ProfileImageName = `${process.env.PosUserImageUrl}/${member.RegUserImageName}`;
      }

    }
     

    const lokSetting = await db.collection("tblloksetting").findOne(
      { IsActive: { $in: ["YES", "Yes", "yes"] } },
      { projection: { VatAmount: 1 } }
    );

    let VatAmountSetting = null;
    if (lokSetting && lokSetting.VatAmount != null) {
      VatAmountSetting = lokSetting.VatAmount;
    }

    const token = jwt.sign(
      { prtuserid, sub: prtuserid },
      SECRET,
      {
        expiresIn: "1d",
        issuer: "heroz-auth",
        audience: "heroz-clients",
        algorithm: "HS256",
      }
    );

    const userWithToken = {
      ...user,
      token,
      loggedusername,
      ProfileName,
      ProfileImageName,
      VatAmount: VatAmountSetting,
    };

    return sendResponse(res, "Login successful", null, userWithToken);
  } catch (error) {
    console.error("Login error:", error);
    return next(error);
  }
};
