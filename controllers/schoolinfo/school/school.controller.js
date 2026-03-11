const { connectToMongoDB } = require("../../../database/mongodb");
const { createUser, updatepassword } = require("../../service/userService");
const {
  generateUniqueId,
  generateSchoolNo,
} = require("../../../controllers/operation/operation");
// Helper function to send responses
function sendResponse(res, message, error, results, totalCount) {
  res.status(error ? 400 : 200).json({
    statusCode: error ? 400 : 200,
    message: message,
    data: results,
    error: error,
    totalCount: totalCount,
  });
}

 exports.getschoollist = async (req, res, next) => {
  try {
    const db = await connectToMongoDB();
    const schoolCollection = db.collection("tblschoolinfo");

    const school = await schoolCollection
      .aggregate([
        { $sort: { CreatedAt: -1 } }, // 🔁 Sort by CreatedAt DESC

        // 🧩 Join with tbllokcity (optional)
        {
          $lookup: {
            from: "tbllokcity",
            localField: "schCityID",
            foreignField: "CityID",
            as: "cityInfo",
          },
        },
        {
          $unwind: {
            path: "$cityInfo",
            preserveNullAndEmptyArrays: true,
          },
        },

        // 🧩 Join with tblprtusers (optional)
        {
          $lookup: {
            from: "tblprtusers",
            localField: "SchoolID",
            foreignField: "prtuserid",
            as: "userInfo",
          },
        },
        {
          $unwind: {
            path: "$userInfo",
            preserveNullAndEmptyArrays: true,
          },
        },

        // 🎯 Final projection
        {
          $project: {
            SchoolID: 1,
            schName: 1,
            schCityID: 1,
            EnCityName: "$cityInfo.EnCityName",
            CreatedBy: 1,
            SchoolNo: 1,
            schMobileNo1: 1,
            CreatedAt: 1,
            userstatus: "$userInfo.userstatus",
          },
        },
      ])
      .toArray();

    // 📊 Total count of all documents in tblschoolinfo
    const totalCount = await schoolCollection.countDocuments();

    sendResponse(res, "school found.", null, school, totalCount);
  } catch (error) {
    console.error("Error in getschoollist:", error);
    next(error);
  }
};


exports.getschool = async (req, res, next) => {
  try {
    const { SchoolID } = req.body;

    const db = await connectToMongoDB();
    const collection = db.collection("tblschoolinfo");

    const filter = {};
    if (SchoolID) {
      filter.SchoolID = SchoolID;
    }
    console.log(SchoolID);

    const school = await collection.findOne(filter);

    if (!school) {
      return res
        .status(404)
        .json({ success: false, message: "school not found" });
    }

    // ✅ Add schImageNameUrl dynamically
    school.schImageNameUrl =
      process.env.SchoolImageUrl + "/" + school.schImageName;
    school.schTaxFileNameUrl =
      process.env.SchoolImageUrl + "/" + school.schTaxFileName;
    school.schCertificateFileNameUrl =
      process.env.SchoolImageUrl + "/" + school.schCertificateFileName;

    sendResponse(res, "school found.", null, school, 1);
  } catch (error) {
    console.error("Error in getschool:", error);
    next(error);
  }
};

exports.createschool = async (req, res, next) => {
  try {
    var SchoolIDVal = generateUniqueId();
    const db = await connectToMongoDB();
    console.log("req.body.schName");
    console.log(req.body.schName);
    const schoolItem = {
      SchoolID: SchoolIDVal,
      SchoolNo: generateSchoolNo(),
      schImageName: req.body.schImageName,
      schTaxFileName: req.body.schTaxFileName,
      schCertificateFileName: req.body.schCertificateFileName,

      schName: req.body.schName,
      schEmailAddress: req.body.schEmailAddress,
      schMobileNo1: req.body.schMobileNo1,
      schMobileNo2: req.body.schMobileNo2,
      schDesc: req.body.schDesc,
      schLevel: req.body.schLevel,
      schEduLevel: req.body.schEduLevel,
      schCertificateName: req.body.schCertificateName,

      schGoogleMap: req.body.schGoogleMap,
      schGlat: req.body.schGlat,
      schGlan: req.body.schGlan,

      schAddress1: req.body.schAddress1,
      schAddress2: req.body.schAddress2,
      schCountryID: req.body.schCountryID,
      schCityID: req.body.schCityID,
      schRegionName: req.body.schRegionName,
      schZipCode: req.body.schZipCode,
      schWebsiteAddress: req.body.schWebsiteAddress,
      schInstagram: req.body.schInstagram,
      schFaceBook: req.body.schFaceBook,
      schX: req.body.schX,
      schSnapChat: req.body.schSnapChat,
      schTikTok: req.body.schTikTok,
      schYouTube: req.body.schYouTube,
      schBankName: req.body.schBankName,
      schAccHolderName: req.body.schAccHolderName,
      schAccIBANNo: req.body.schAccIBANNo,
      schTaxName: req.body.schTaxName,

      schAdminNotes: req.body.schAdminNotes,

      IsDataStatus: req.body.IsDataStatus,
      schStatus: "ACTIVE",
      CreatedDate: new Date(),
      CreatedBy: req.body.CreatedBy || null,
      ModifyDate: new Date(),
      ModifyBy: req.body.ModifyBy || null,
    };

    const result = await db.collection("tblschoolinfo").insertOne(schoolItem);

    // Call createUser and insert into tblprtusers
    await createUser({
      prtuserid: SchoolIDVal,
      username: req.body.schMobileNo1,
      usertype: "SCHOOL-SUBADMIN",
      userstatus: "ACTIVE", // or generate a default
      CreatedBy: req.body.CreatedBy,
      ModifyBy: req.body.ModifyBy,
    });

    sendResponse(res, "school inserted successfully.", null, result, null);
  } catch (error) {
    console.error("Error in createschool:", error);
    next(error);
  }
};
exports.updatepwd = async (req, res, next) => {
  try {
    const { username, password, prtuserid, ModifyBy } = req.body;

    if (!prtuserid) {
      return res
        .status(400)
        .json({ success: false, message: "UserID is required" });
    }
    console.log("username");
    console.log(username);
    console.log("password==");
    console.log(password);
    const userdata = {
      username,
      password,
      prtuserid,
      ModifyBy,
    };

    const result = await updatepassword(req, res, userdata); // ✅ FIXED

    return; // No need for more response here since it's handled inside service
  } catch (error) {
    console.error("Update Password Error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

exports.updateschool = async (req, res, next) => {
  try {
    const { SchoolID } = req.body;

    if (!SchoolID) {
      return res
        .status(400)
        .json({ success: false, message: "SchoolID is required for update." });
    }

    const db = await connectToMongoDB();
    console.log("Updating School:", SchoolID);

    const updateFields = {
      schImageName: req.body.schImageName,
      schName: req.body.schName,
      schEmailAddress: req.body.schEmailAddress,
      schMobileNo2: req.body.schMobileNo2,
      schDesc: req.body.schDesc,
      schLevel: req.body.schLevel,
      schEduLevel: req.body.schEduLevel,
      schCertificateName: req.body.schCertificateName,
      schCertificateFileName: req.body.schCertificateFileName,
      schAddress1: req.body.schAddress1,
      schAddress2: req.body.schAddress2,
      schCountryID: req.body.schCountryID,
      schCityID: req.body.schCityID,
      schRegionName: req.body.schRegionName,
      schGoogleMap: req.body.schGoogleMap || "",
      schGlat: req.body.schGlat || "",
      schGlan: req.body.schGlan || "",
      schZipCode: req.body.schZipCode,
      schWebsiteAddress: req.body.schWebsiteAddress,
      schInstagram: req.body.schInstagram,
      schFaceBook: req.body.schFaceBook,
      schX: req.body.schX,
      schSnapChat: req.body.schSnapChat,
      schTikTok: req.body.schTikTok,
      schYouTube: req.body.schYouTube,
      schBankName: req.body.schBankName,
      schAccHolderName: req.body.schAccHolderName,
      schAccIBANNo: req.body.schAccIBANNo,
      schTaxName: req.body.schTaxName,
      schTaxFileName: req.body.schTaxFileName,
      schAdminNotes: req.body.schAdminNotes,
      IsDataStatus: req.body.IsDataStatus,
      ModifyDate: new Date(),
      ModifyBy: req.body.ModifyBy || null,
    };
    console.log(updateFields);
    const result = await db
      .collection("tblschoolinfo")
      .updateOne({ SchoolID }, { $set: updateFields });

    if (result.matchedCount === 0) {
      return res
        .status(404)
        .json({ success: false, message: "School not found." });
    }

    sendResponse(res, "School updated successfully.", null, result, 1);
  } catch (error) {
    console.error("Error in updateschool:", error);
    next(error);
  }
};

// Controller: delschool
// Rules enforced:
// - IsDelete === "false" -> HTTP 400 (error object populated, data = null)
// - IsDelete === "true"  -> HTTP 200 (data object populated, error = null)
 exports.delschool = async (req, res, next) => {
  const SchoolID = req.body.SchoolID;

  // 0) Validate input
  if (!SchoolID) {
    return sendResponseV2(
      res,
      "SchoolID is required",
      null,
      { IsDelete: "false", reason: "Missing SchoolID" },
      400
    );
  }

  try {
    const db = await connectToMongoDB();

    const schoolColl = db.collection("tblschoolinfo");
    const usersColl  = db.collection("tblprtusers");
    const reqColl    = db.collection("tblactivityrequest");

    // 1) Ensure the school exists
    const schoolDoc = await schoolColl.findOne({ SchoolID });
    if (!schoolDoc) {
      // Failure → IsDelete=false, HTTP 400
      return sendResponseV2(
        res,
        "School not found",
        null,
        { IsDelete: "false", school: { exists: false, SchoolID } },
        400
      );
    }

    // 2) Block delete if any activity requests exist for this SchoolID
    const reqCount = await reqColl.countDocuments({ SchoolID });

    if (reqCount > 0) {
      const reqSample = await reqColl
        .find(
          { SchoolID },
          { projection: { _id: 0, RequestID: 1, actRequestStatus: 1 } }
        )
        .limit(5)
        .toArray();

      // Failure → IsDelete=false, HTTP 400
      return sendResponseV2(
        res,
        "Sorry school can not remove you have Event request is existing",
        null,
        {
          IsDelete: "false",
          policy: {
            rule: "IsDelete = (count(tblactivityrequest where SchoolID) == 0)",
            tableChecked: "tblactivityrequest",
          },
          school: {
            exists: true,
            SchoolID,
            schoolName: schoolDoc?.SchoolName ?? undefined,
          },
          requests: {
            total: reqCount,
            sample: reqSample,
          },
        },
        400
      );
    }

    // 3) Deletable → perform deletes
    const schoolDeleteResult = await schoolColl.deleteOne({ SchoolID });
    const userDeleteResult   = await usersColl.deleteOne({ prtuserid: SchoolID });

    // Optional logs
    console.log("School delete:", schoolDeleteResult.deletedCount);
    console.log("User delete:", userDeleteResult.deletedCount);

    // Success → IsDelete=true, HTTP 200
    return sendResponseV2(
      res,
      "School deleted successfully",
      {
        IsDelete: "true",
        deleted: {
          tblschoolinfo: schoolDeleteResult.deletedCount || 0,
          tblprtusers: userDeleteResult.deletedCount || 0,
        },
        school: { SchoolID },
      },
      null,
      200
    );
  } catch (error) {
    console.error("Error in delschool:", error);
    // Internal error → HTTP 500; keep IsDelete=false for consistency
    return sendResponseV2(
      res,
      "Internal Server Error",
      null,
      { IsDelete: "false", error: String(error?.message || error) },
      500
    );
  }
};


 
function sendResponseV2(res, message, data = null, error = null, statusCode = 200, totalCount = null) {
  return res.status(statusCode).json({
    statusCode,
    message,
    data,       // success payload (when IsDelete === "true")
    error,      // failure payload (when IsDelete === "false")
    totalCount, // optional: keep if other endpoints rely on it
  });
}