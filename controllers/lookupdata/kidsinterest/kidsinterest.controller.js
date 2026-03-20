const { connectToMongoDB } = require("../../../database/mongodb");
const { generateUniqueId } = require("../../../controllers/operation/operation");
// Helper function to send responses
function sendResponse(res, message, error, results,totalCount) {
  res.status(error ? 400 : 200).json({
    'statusCode': error ? 400 : 200,
    'message': message,
    'data': results,
    'error': error,
    'totalCount':totalCount
  });
} 

exports.getkidsinterestList = async (req, res, next) => {
  try {
    const { page = 1, limit = 5 } = req.body;

    const db = await connectToMongoDB();
    const collection = db.collection("tbllokkidsinterest");

    const skip = (page - 1) * limit;

    const kidsinterest = await collection.aggregate([
      {
        $project: {
          kidsinterestID: 1,
          EnkidsinterestName: 1,
          ArkidsinterestName: 1,
          IsDataStatus: 1,
          CreatedDate: 1,
          CreatedBy: 1,
          ModifyDate: 1,
          ModifyBy: 1,

          // ✅ ADDED FIELD FROM DB
          kidsinterestImageName: 1,

          // ✅ ADDED IMAGE URL FIELD
          kidsinterestImageNameUrl: {
            $concat: [
              process.env.ActivityGalleryUrl,
              "/",
              { $ifNull: ["$kidsinterestImageName", ""] }
            ]
          }
        }
      },
      { $sort: { CreatedDate: -1 } },  // ✅ descending order
      { $skip: skip },
      { $limit: parseInt(limit) }
    ]).toArray();

    const totalCount = await collection.countDocuments();

    sendResponse(res, "kidsinterest found.", null, kidsinterest, totalCount);
  } catch (error) {
    console.error("Error in getAllkidsinterestList:", error);
    next(error);
  }
};

exports.getkidsinterestAllList = async (req, res, next) => {
  try {
    const db = await connectToMongoDB();
    const collection = db.collection("tbllokkidsinterest");

    const kidsinterest = await collection.aggregate([
      {
        $project: {
          kidsinterestID: 1,
          EnkidsinterestName: 1,
          ArkidsinterestName: 1,
          IsDataStatus: 1,
          CreatedDate: 1,
          CreatedBy: 1,
          ModifyDate: 1,
          ModifyBy: 1,
        }
      },
      { $sort: { CreatedDate: -1 } }  // ✅ Sort by newest
    ]).toArray();

    const totalCount = kidsinterest.length;

    sendResponse(res, "kidsinterest found.", null, kidsinterest, totalCount);
  } catch (error) {
    console.error("Error in getAllkidsinterestList:", error);
    next(error);
  }
};

exports.getkidsinterest = async (req, res, next) => {
  try {
    const { kidsinterestID } = req.body;

    const db = await connectToMongoDB();
    const collection = db.collection("tbllokkidsinterest");

    // Build filter for kidsinterestID only
    const filter = {};
    if (kidsinterestID) {
      filter.kidsinterestID = kidsinterestID;
    }

    const kidsinterest = await collection.findOne(filter, {
      projection: {
        kidsinterestID: 1,
        EnkidsinterestName: 1,
        ArkidsinterestName: 1,
        IsDataStatus: 1,
        CreatedDate: 1,
        CreatedBy: 1,
        ModifyDate: 1,
        ModifyBy: 1,
      }
    });

    if (!kidsinterest) {
      return res.status(404).json({ success: false, message: "kidsinterest not found" });
    }

    sendResponse(res, "kidsinterest found.", null, kidsinterest, 1);
  } catch (error) {
    console.error("Error in getkidsinterest:", error);
    next(error);
  }
};

exports.createkidsinterest = async (req, res, next) => {
  try {
    const db = await connectToMongoDB();

    const kidsinterestItem = {
      kidsinterestID: generateUniqueId(),
      EnkidsinterestName: req.body.EnkidsinterestName,
      ArkidsinterestName: req.body.ArkidsinterestName,
      kidsinterestImageName: req.body.kidsinterestImageName,
      IsDataStatus: req.body.IsDataStatus,
      CreatedDate: new Date(),
      CreatedBy: req.body.CreatedBy || null,
      ModifyDate: new Date(),
      ModifyBy: req.body.ModifyBy || null,
    };

    const result = await db.collection('tbllokkidsinterest').insertOne(kidsinterestItem);
    sendResponse(res, "kidsinterest inserted successfully.", null, result, null);
  } catch (error) {
    console.error("Error in createkidsinterest:", error);
    next(error);
  }
};

exports.updatekidsinterest = async (req, res, next) => {
  try {
    const db = await connectToMongoDB();
    const collection = db.collection('tbllokkidsinterest');

    const { kidsinterestID } = req.body;

    if (!kidsinterestID) {
      return res.status(400).json({ success: false, message: "kidsinterestID is required" });
    }

    const updateFields = {
      EnkidsinterestName: req.body.EnkidsinterestName,
      ArkidsinterestName: req.body.ArkidsinterestName,
       kidsinterestImageName: req.body.kidsinterestImageName,
      IsDataStatus: req.body.IsDataStatus,
      ModifyDate: new Date(),
      ModifyBy: req.body.ModifyBy || null,
    };

    const updateResult = await collection.updateOne(
      { kidsinterestID: kidsinterestID },
      { $set: updateFields }
    );

    if (updateResult.matchedCount === 0) {
      return res.status(404).json({ success: false, message: "No kidsinterest found to update" });
    }

    return res.status(200).json({ success: true, message: "kidsinterest updated successfully" });
  } catch (error) {
    console.error("Update kidsinterest Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

exports.delkidsinterest = async (req, res, next) => {
  const { kidsinterestID } = req.body;
  if (!kidsinterestID) {
    return sendResponse(res, "kidsinterestID is required", null, null, 400);
  }

  try {
    const db = await connectToMongoDB();

    const orderDetailExists = await db.collection('tblOrderDetails').findOne({ kidsinterestID });

    if (orderDetailExists) {
      return sendResponse(res, "kidsinterest cannot be deleted. It exists in order details.", null, null, 400);
    }

    await db.collection('tbllokkidsinterest').deleteOne({ kidsinterestID });

    return sendResponse(res, "kidsinterest deleted successfully", null, null, 200);
  } catch (error) {
    console.error("Error in delkidsinterestByID:", error);
    return sendResponse(res, "Internal Server Error", null, error.message, 500);
  }
};
