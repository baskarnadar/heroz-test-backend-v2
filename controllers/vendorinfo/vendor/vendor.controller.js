const { connectToMongoDB } = require("../../../database/mongodb");
const { createUser, updatepassword } = require("../../service/userService");
const {
  generateUniqueId,
  generateNo,
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

exports.getvendorlist = async (req, res, next) => {
  try {
    const { page = 1, limit = 5 } = req.body;

    const db = await connectToMongoDB();
    const vendorCollection = db.collection("tblvendorinfo");

    const skip = (page - 1) * limit;

    const vendor = await vendorCollection
      .aggregate([
        { $sort: { CreatedDate: -1 } },
        { $skip: skip },
        { $limit: parseInt(limit) },

        // Join with tbllokcity
        {
          $lookup: {
            from: "tbllokcity",
            localField: "vdrCityID",
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

        // Join with tblprtusers
        {
          $lookup: {
            from: "tblprtusers",
            localField: "VendorID",
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

        // No $project stage — returns full data from base + lookups
      ])
      .toArray();

    const totalCount = await vendorCollection.countDocuments();

    sendResponse(res, "vendor found.", null, vendor, totalCount);
  } catch (error) {
    console.error("Error in getAllvendorList:", error);
    next(error);
  }
}; 

exports.getVendor = async (req, res, next) => {
  try {
    const { VendorID } = req.body || {};
    if (!VendorID) {
      return sendResponse(res, "VendorID is required", true, null, 0);
    }

    const db = await connectToMongoDB();

    // Normalize VendorID so it matches either number- or string-stored values
    const vendorIdValue = Number.isNaN(Number(VendorID)) ? VendorID : Number(VendorID);

    // --- 1) Fetch vendor ---
    const vendor = await db.collection("tblvendorinfo").findOne({ VendorID: vendorIdValue });
    if (!vendor) {
      return sendResponse(res, "vendor not found", true, null, 0);
    }

    // Add full URLs for files if filenames exist
    const baseUrl = process.env.VendorImageUrl;
    if (vendor.vdrImageName)   vendor.vdrImageNameUrl   = `${baseUrl}/${vendor.vdrImageName}`;
    if (vendor.vdrTaxFileName) vendor.vdrTaxFileNameUrl = `${baseUrl}/${vendor.vdrTaxFileName}`;
    if (vendor.vdrCRFileName)  vendor.vdrCRFileNameUrl  = `${baseUrl}/${vendor.vdrCRFileName}`;

    // --- 2) Fetch all opening hours linked by VendorID ---
    const hours = await db
      .collection("tblvendor_opening_hours")
      .find({ VendorID: vendorIdValue })
      .sort({ DayOrder: 1, _id: 1 })
      .toArray();

    // --- 3) Attach new field & remove old ---
    vendor.NewOfficeOpenHours = Array.isArray(hours) ? hours : [];
    delete vendor.OfficeOpenHours; // remove old key if exists in DB record

    return sendResponse(
      res,
      "vendor found.",
      null,
      vendor,
      vendor.NewOfficeOpenHours.length
    );
  } catch (error) {
    console.error("Error in getVendor:", error);
    return sendResponse(res, "Error fetching vendor", true, null, 0);
  }
};


exports.createvendor = async (req, res, next) => {
  try {
    const db = await connectToMongoDB();

    const VendorIDVal = generateUniqueId();
    const OfficeOpenHours = req.body.OfficeOpenHours || [];

    const vendorItem = {
      VendorID: VendorIDVal,
      vendorNo: generateNo(),
      vdrImageName: req.body.vdrImageName,
      vdrTaxFileName: req.body.vdrTaxFileName,
      vdrName: req.body.vdrName,
      vdrClubName: req.body.vdrClubName,
      vdrEmailAddress: req.body.vdrEmailAddress,
      vdrMobileNo1: req.body.vdrMobileNo1,
      vdrMobileNo2: req.body.vdrMobileNo2,
      vdrDesc: req.body.vdrDesc,
      vdrLevel: req.body.vdrLevel,
      vdrCategoryID: req.body.vdrCategoryID,
     
      vdrCvdrCRFileName: req.body.vdrCvdrCRFileName,
      vdrAddress1: req.body.vdrAddress1,
      vdrAddress2: req.body.vdrAddress2,
      vdrCountryID: req.body.vdrCountryID,
      vdrCityID: req.body.vdrCityID,
      vdrRegionName: req.body.vdrRegionName,
      vdrZipCode: req.body.vdrZipCode,
      vdrWebsiteAddress: req.body.vdrWebsiteAddress,
      vdrInstagram: req.body.vdrInstagram,
      vdrFaceBook: req.body.vdrFaceBook,
      vdrX: req.body.vdrX,
      vdrSnapChat: req.body.vdrSnapChat,
      vdrTikTok: req.body.vdrTikTok,
      vdrYouTube: req.body.vdrYouTube,
      vdrBankName: req.body.vdrBankName,
      vdrAccHolderName: req.body.vdrAccHolderName,
      vdrAccIBANNo: req.body.vdrAccIBANNo,
      vdrTaxName: req.body.vdrTaxName,
      vdrTaxFileName: req.body.vdrTaxFileName,
      vdrCRFileName:req.body.vdrCRFileName,
      vdrAdminNotes: req.body.vdrAdminNotes,
      vdrIsBirthDayService: req.body.vdrIsBirthDayService,
      vdrCapacity: req.body.vdrCapacity,
      vdrPricePerPerson: req.body.vdrPricePerPerson,
      OfficeOpenHours: req.body.OfficeOpenHours,
      IsDataStatus: req.body.IsDataStatus,
      vdrStatus: "ACTIVE",
      CreatedDate: new Date(),
      CreatedBy: req.body.CreatedBy || null,
      ModifyDate: new Date(),
      ModifyBy: req.body.ModifyBy || null,

      vdrGoogleMap: req.body.vdrGoogleMap,
       vdrGlat: req.body.vdrGlat,
        vdrGlan: req.body.vdrGlan,
        vdrCRNumber:req.body.vdrCRNumber
    };

    // Insert vendor
    const result = await db.collection("tblvendorinfo").insertOne(vendorItem);

    // Insert OfficeOpenHours
    // Office Hours
    const oh = req.body.OfficeOpenHours;
    const rows = Array.isArray(oh?.rows) ? oh.rows : [];

    // ✅ Filter out incomplete time entries
    const validRows = rows.filter((entry) => entry.StartTime && entry.EndTime);

    if (validRows.length > 0) {
      const officeHoursData = validRows.map((entry) => ({
        OpeningHrsID: generateUniqueId(),
        VendorID: VendorIDVal,
        vdrDayName: entry.DayName,
        vdrStartTime: entry.StartTime,
        vdrEndTime: entry.EndTime,
        vdrNote: entry.Note || "",
        CreatedDate: new Date(),
        CreatedBy: req.body.CreatedBy || null,
        ModifyDate: new Date(),
        ModifyBy: req.body.ModifyBy || null,
      }));

      await db
        .collection("tblvendor_opening_hours")
        .insertMany(officeHoursData);
    }

    // Create user
    await createUser({
      prtuserid: VendorIDVal,
      username: req.body.vdrMobileNo1,
      usertype: "VENDOR-SUBADMIN",
      userstatus: "ACTIVE",
      CreatedBy: req.body.CreatedBy,
      ModifyBy: req.body.ModifyBy,
    });

    sendResponse(res, "vendor inserted successfully.", null, result, null);
  } catch (error) {
    console.error("Error in createvendor:", error);
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

 

// Normalize OpeningHrsID to a clean string
function rowIdAsString(id) {
  return (id == null) ? '' : String(id).trim();
}

exports.updatevendor = async (req, res, next) => {
  try {
    const db = await connectToMongoDB();

    const VendorIDVal = req.body.VendorID;
    if (!VendorIDVal) {
      return sendResponse(res, "VendorID is required for update.", true, null, 400);
    }

    // ---- 1) Update vendor master fields ------------------------------------
    const updateFields = {
      vdrImageName: req.body.vdrImageName,
      vdrTaxFileName: req.body.vdrTaxFileName,
      vdrCvdrCRFileName: req.body.vdrCvdrCRFileName,

      vdrName: req.body.vdrName,
      vdrClubName: req.body.vdrClubName,
      vdrEmailAddress: req.body.vdrEmailAddress,
      vdrMobileNo1: req.body.vdrMobileNo1,
      vdrMobileNo2: req.body.vdrMobileNo2,
      vdrDesc: req.body.vdrDesc,
      vdrLevel: req.body.vdrLevel,
      vdrCategoryID: req.body.vdrCategoryID,

      vdrAddress1: req.body.vdrAddress1,
      vdrAddress2: req.body.vdrAddress2,
      vdrCountryID: req.body.vdrCountryID,
      vdrCityID: req.body.vdrCityID,
      vdrRegionName: req.body.vdrRegionName,
      vdrZipCode: req.body.vdrZipCode,
      vdrWebsiteAddress: req.body.vdrWebsiteAddress,

      vdrInstagram: req.body.vdrInstagram,
      vdrFaceBook: req.body.vdrFaceBook,
      vdrX: req.body.vdrX,
      vdrSnapChat: req.body.vdrSnapChat,
      vdrTikTok: req.body.vdrTikTok,
      vdrYouTube: req.body.vdrYouTube,

      vdrBankName: req.body.vdrBankName,
      vdrAccHolderName: req.body.vdrAccHolderName,
      vdrAccIBANNo: req.body.vdrAccIBANNo,
      vdrTaxName: req.body.vdrTaxName,
      vdrCRFileName: req.body.vdrCRFileName,

      vdrAdminNotes: req.body.vdrAdminNotes,
      vdrIsBirthDayService: req.body.vdrIsBirthDayService,
      vdrCapacity: req.body.vdrCapacity,
      vdrPricePerPerson: req.body.vdrPricePerPerson,

      // Keep raw hours on the vendor doc if you want it there too
      OfficeOpenHours: Array.isArray(req.body.OfficeOpenHours) ? req.body.OfficeOpenHours : [],

      IsDataStatus: req.body.IsDataStatus,
      vdrGoogleMap: req.body.vdrGoogleMap,
      vdrGlat: req.body.vdrGlat,
      vdrGlan: req.body.vdrGlan,
      vdrCRNumber: req.body.vdrCRNumber,

      ModifyDate: new Date(),
      ModifyBy: req.body.ModifyBy || null,
    };

    const result = await db.collection("tblvendorinfo").updateOne(
      { VendorID: VendorIDVal },
      { $set: updateFields }
    );

    if (result.matchedCount === 0) {
      return sendResponse(res, "Vendor not found.", true, null, 404);
    }

    // ---- 2) Upsert (update-or-insert) opening-hours rows -------------------
    const incoming = Array.isArray(req.body.OfficeOpenHours) ? req.body.OfficeOpenHours : [];
    const now = new Date();
    const createdBy = req.body.CreatedBy || null;
    const modifyBy = req.body.ModifyBy || null;

    console.log('[updatevendor] OfficeOpenHours received:', incoming.length);

    // Normalize & filter to complete rows
    const normalized = incoming
      .filter(r => r && r.vdrDayName && r.vdrStartTime && r.vdrEndTime)
      .map(r => ({
        OpeningHrsID: rowIdAsString(r.OpeningHrsID),               // may be empty for new
        vdrDayName: String(r.vdrDayName).trim().toLowerCase(),     // sunday..saturday
        vdrStartTime: String(r.vdrStartTime).trim(),               // "HH:mm"
        vdrEndTime: String(r.vdrEndTime).trim(),                   // "HH:mm"
        vdrNote: String(r.vdrNote || '').trim(),
      }));

    // Track which IDs we processed for pruning
    const processedIds = [];

    for (const r of normalized) {
      // If no OpeningHrsID: generate and insert
      if (!r.OpeningHrsID) {
        const newId = generateUniqueId();
        await db.collection("tblvendor_opening_hours").insertOne({
          VendorID: VendorIDVal,
          OpeningHrsID: newId,
          vdrDayName: r.vdrDayName,
          vdrStartTime: r.vdrStartTime,
          vdrEndTime: r.vdrEndTime,
          vdrNote: r.vdrNote,
          CreatedDate: now,
          CreatedBy: createdBy,
          ModifyDate: now,
          ModifyBy: modifyBy,
        });
        processedIds.push(newId);
        continue;
      }

      // Try to UPDATE by (VendorID, OpeningHrsID)
      const filt = { VendorID: VendorIDVal, OpeningHrsID: r.OpeningHrsID };
      const updRes = await db.collection("tblvendor_opening_hours").updateOne(
        filt,
        {
          $set: {
            vdrDayName: r.vdrDayName,
            vdrStartTime: r.vdrStartTime,
            vdrEndTime: r.vdrEndTime,
            vdrNote: r.vdrNote,
            ModifyDate: now,
            ModifyBy: modifyBy,
          },
        }
      );

      if (updRes.matchedCount === 0) {
        // No existing row → INSERT a new one using the provided OpeningHrsID
        await db.collection("tblvendor_opening_hours").insertOne({
          VendorID: VendorIDVal,
          OpeningHrsID: r.OpeningHrsID,
          vdrDayName: r.vdrDayName,
          vdrStartTime: r.vdrStartTime,
          vdrEndTime: r.vdrEndTime,
          vdrNote: r.vdrNote,
          CreatedDate: now,
          CreatedBy: createdBy,
          ModifyDate: now,
          ModifyBy: modifyBy,
        });
      }

      processedIds.push(r.OpeningHrsID);
    }

    // ---- 3) (Optional) Prune rows not in current payload -------------------
    // If you want the DB to exactly mirror what the client sent, keep this.
    // If you want to preserve old rows that the client didn’t include this time, remove it.
    if (processedIds.length) {
      await db.collection("tblvendor_opening_hours").deleteMany({
        VendorID: VendorIDVal,
        OpeningHrsID: { $nin: processedIds },
      });
    }

    return sendResponse(
      res,
      "Vendor updated successfully.",
      null,
      {
        vendorMatched: result.matchedCount,
        vendorModified: result.modifiedCount,
        hoursProcessed: processedIds.length,
      },
      200
    );
  } catch (error) {
    console.error("Error in updatevendor:", error);
    return next(error);
  }
};


 exports.delvendor = async (req, res, next) => {
  const IDVal = req.body.VendorID;

  if (!IDVal) {
    return sendResponse(res, "VendorID is required", null, null, 400);
  }

  try {
    const db = await connectToMongoDB();

    // ✅ Step 1: Check for pending activities in tblactivityrequest
    const pendingActivity = await db
      .collection("tblactivityrequest")
      .findOne({ VendorID: IDVal });

    if (pendingActivity) {
      return sendResponse(
        res,
        "Sorry, you cannot close accounts, you have activity.",
        null,
        null,
        400
      );
    }

    // ✅ Step 2: Check if the vendor exists
    const vendorExists = await db
      .collection("tblvendorinfo")
      .findOne({ VendorID: IDVal });

    if (!vendorExists) {
      return sendResponse(res, "Vendor not found", null, null, 404);
    }

    // ✅ Step 3: Delete vendor info
    const vendorDeleteResult = await db
      .collection("tblvendorinfo")
      .deleteOne({ VendorID: IDVal });

    // ✅ Step 4: Delete user linked to this vendor
    const userDeleteResult = await db
      .collection("tblprtusers")
      .deleteOne({ prtuserid: IDVal });

    // ✅ Step 5: Delete activities for this vendor
    const activityDeleteResult = await db
      .collection("tblactivityinfo")
      .deleteMany({ VendorID: IDVal });

    // 🧾 Log results
    console.log("Vendor delete:", vendorDeleteResult.deletedCount);
    console.log("User delete:", userDeleteResult.deletedCount);
    console.log("Activities delete:", activityDeleteResult.deletedCount);

    return sendResponse(res, "Vendor deleted successfully", null, null, 200);
  } catch (error) {
    console.error("Error in delvendor:", error);
    return sendResponse(res, "Internal Server Error", null, error.message, 500);
  }
};
