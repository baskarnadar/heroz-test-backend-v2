const { connectToMongoDB } = require("../../../database/mongodb");

const {
  generateUniqueId,
  GetRefNo,
} = require("../../../controllers/operation/operation");
const { InsertNotification } = require("../../operation/component");

console.log("POST /actRequest hit 3");
require("dotenv").config();
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
 

 exports.vdrgetallactstatus = async (req, res, next) => {
  try {
    const db = await connectToMongoDB();
    const { VendorID } = req.body;

    if (!VendorID) {
      return res.status(400).json({ message: "VendorID is required." });
    }

    // Aggregation with lookups to fetch actName and vdrName
    const activityRequests = await db.collection("tblactivityrequest").aggregate([
      { $match: { VendorID } },
      { $sort: { CreatedDate: -1 } },

      // Lookup for actName from tblactivityinfo
      {
        $lookup: {
          from: "tblactivityinfo",
          localField: "ActivityID",
          foreignField: "ActivityID",
          as: "activityInfo"
        }
      },
      {
        $unwind: {
          path: "$activityInfo",
          preserveNullAndEmptyArrays: true
        }
      },

      // Lookup for vdrName from tblvendorinfo
      {
        $lookup: {
          from: "tblvendorinfo",
          localField: "VendorID",
          foreignField: "VendorID",
          as: "vendorInfo"
        }
      },
      {
        $unwind: {
          path: "$vendorInfo",
          preserveNullAndEmptyArrays: true
        }
      },

      // Project the desired fields
      {
        $project: {
          _id: 1,
           RequestID: 1,
          ActivityID: 1,
          VendorID: 1,
          VendorID: 1,
          actRequestDate: 1,
          actRequestStatus: 1,
          CreatedDate: 1,
          actName: "$activityInfo.actName",
          vdrName: "$vendorInfo.vdrName",
           vdrClubName: "$vendorInfo.vdrClubName"
          
        }
      }
    ]).toArray();

    res.status(200).json({
      status: "success",
      total: activityRequests.length,
      data: activityRequests,
    });

  } catch (error) {
    console.error("Error in getallactstatus:", error);
    next(error);
  }
};

 exports.vdrTripLockDate = async (req, res, next) => {
  try {
    const db = await connectToMongoDB();

    const {
      VendorID,
      vdrLockDate,
      vdrLockReason,
      vdrIsDateLock,
      CreatedBy,
      ModifyBy,
    } = req.body;

    // ✅ Validation
    if (!VendorID) {
      return res.status(400).json({ message: "VendorID is required." });
    }

    if (!vdrLockDate) {
      return res.status(400).json({ message: "vdrLockDate is required." });
    }

    // ✅ Normalize boolean (in case it comes as "true"/"false" string)
    let isDateLock = vdrIsDateLock;
    if (typeof isDateLock === "string") {
      isDateLock = isDateLock.toLowerCase() === "true";
    }
    if (typeof isDateLock !== "boolean") {
      isDateLock = false; // default
    }

    const now = new Date();

    // ✅ Filter: unique key (VendorID + vdrLockDate)
    const filter = {
      VendorID,
      vdrLockDate, // stored as string, e.g. "2025-11-15"
    };

    // ✅ Upsert: update if exists, insert if not
    const update = {
      $set: {
        vdrLockReason: vdrLockReason || "",
        vdrIsDateLock: isDateLock,
        ModifyDate: now,
        ModifyBy: ModifyBy || "system",
      },
      $setOnInsert: {
        VendorID,
        vdrLockDate,
        CreatedDate: now,
        CreatedBy: CreatedBy || "system",
      },
    };

    const options = {
      upsert: true,
      returnDocument: "after", // for newer Mongo driver
      // returnOriginal: false, // if you're on older driver, use this instead
    };

    const result = await db
      .collection("tblvdrLockBookTripDate")
      .findOneAndUpdate(filter, update, options);

    const wasUpdate =
      result.lastErrorObject && result.lastErrorObject.updatedExisting;

    res.status(200).json({
      status: "success",
      message: wasUpdate
        ? "Vendor trip lock date updated successfully."
        : "Vendor trip lock date inserted successfully.",
      mode: wasUpdate ? "updated" : "inserted",
      data: result.value,
    });
  } catch (error) {
    console.error("Error in vdrTripLockDate:", error);
    next(error);
  }
};
