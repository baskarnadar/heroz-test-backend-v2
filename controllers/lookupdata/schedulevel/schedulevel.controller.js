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

exports.getSchedulevelList = async (req, res, next) => {
  try {
    const { page = 1, limit = 5 } = req.body;

    const db = await connectToMongoDB();
    const collection = db.collection("tbllokschedulevel");

    const skip = (page - 1) * limit;

    const schedulevel = await collection.aggregate([
      {
        $project: {
          SchEduLevelID: 1,
          EnSchEduLevelName: 1,
          ArSchEduLevelName: 1,
          IsDataStatus: 1,
          CreatedDate: 1,
          CreatedBy: 1,
          ModifyBy: 1,
          ModifyBy: 1,
        }
      },
      { $sort: { CreatedDate: -1 } },  // ✅ descending order
      { $skip: skip },
      { $limit: parseInt(limit) }
    ]).toArray();

    const totalCount = await collection.countDocuments();

    sendResponse(res, "schedulevel found.", null, schedulevel, totalCount);
  } catch (error) {
    console.error("Error in getAllschedulevelList:", error);
    next(error);
  }
};

exports.getSchedulevelAllList = async (req, res, next) => {
  try {
    const db = await connectToMongoDB();
    const collection = db.collection("tbllokschedulevel");

    const schedulevel = await collection.aggregate([
      {
        $project: {
          SchEduLevelID: 1,
          EnSchEduLevelName: 1,
          ArSchEduLevelName: 1,
          IsDataStatus: 1,
          CreatedDate: 1,
          CreatedBy: 1,
          ModifyBy: 1,
          ModifyBy: 1,
        }
      },
      { $sort: { CreatedDate: -1 } }  // ✅ Sort by newest
    ]).toArray();

    const totalCount = schedulevel.length;

    sendResponse(res, "schedulevel found.", null, schedulevel, totalCount);
  } catch (error) {
    console.error("Error in getAllschedulevelList:", error);
    next(error);
  }
};

exports.getSchedulevel = async (req, res, next) => {
  try {
    const { SchEduLevelID } = req.body;

    const db = await connectToMongoDB();
    const collection = db.collection("tbllokschedulevel");

    // Build filter for SchEduLevelID only
    const filter = {};
    if (SchEduLevelID) {
      filter.SchEduLevelID = SchEduLevelID;
    }

    const schedulevel = await collection.findOne(filter, {
      projection: {
        SchEduLevelID: 1,
        EnSchEduLevelName: 1,
        ArSchEduLevelName: 1,
        IsDataStatus: 1,
        CreatedDate: 1,
        CreatedBy: 1,
        ModifyBy: 1,
        ModifyBy: 1,
      }
    });

    if (!schedulevel) {
      return res.status(404).json({ success: false, message: "schedulevel not found" });
    }

    sendResponse(res, "schedulevel found.", null, schedulevel, 1);
  } catch (error) {
    console.error("Error in getschedulevel:", error);
    next(error);
  }
};

exports.createSchedulevel = async (req, res, next) => {
  try {
    const db = await connectToMongoDB();

    const schedulevelItem = {
      SchEduLevelID: generateUniqueId(),
      EnSchEduLevelName: req.body.EnSchEduLevelName,
      ArSchEduLevelName: req.body.ArSchEduLevelName,
      IsDataStatus: req.body.IsDataStatus,
      CreatedDate: new Date(),
      CreatedBy: req.body.CreatedBy || null,
      ModifyBy: new Date(),
      ModifyBy: req.body.ModifyBy || null,
    };

    const result = await db.collection('tbllokschedulevel').insertOne(schedulevelItem);
    sendResponse(res, "schedulevel inserted successfully.", null, result, null);
  } catch (error) {
    console.error("Error in createschedulevel:", error);
    next(error);
  }
};

exports.updateSchedulevel = async (req, res, next) => {
  try {
    const db = await connectToMongoDB();
    const collection = db.collection('tbllokschedulevel');

    const { SchEduLevelID } = req.body;

    if (!SchEduLevelID) {
      return res.status(400).json({ success: false, message: "SchEduLevelID is required" });
    }

    const updateFields = {
      EnSchEduLevelName: req.body.EnSchEduLevelName,
      ArSchEduLevelName: req.body.ArSchEduLevelName,
      IsDataStatus: req.body.IsDataStatus,
      ModifyBy: new Date(),
      ModifyBy: req.body.ModifyBy || null,
    };

    const updateResult = await collection.updateOne(
      { SchEduLevelID: SchEduLevelID },
      { $set: updateFields }
    );

    if (updateResult.matchedCount === 0) {
      return res.status(404).json({ success: false, message: "No schedulevel found to update" });
    }

    return res.status(200).json({ success: true, message: "schedulevel updated successfully" });
  } catch (error) {
    console.error("Update schedulevel Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

exports.delSchedulevel = async (req, res, next) => {
  const { SchEduLevelID } = req.body;
  if (!SchEduLevelID) {
    return sendResponse(res, "SchEduLevelID is required", null, null, 400);
  }

  try {
    const db = await connectToMongoDB();

    const orderDetailExists = await db.collection('tblOrderDetails').findOne({ SchEduLevelID });

    if (orderDetailExists) {
      return sendResponse(res, "schedulevel cannot be deleted. It exists in order details.", null, null, 400);
    }

    await db.collection('tbllokschedulevel').deleteOne({ SchEduLevelID });

    return sendResponse(res, "schedulevel deleted successfully", null, null, 200);
  } catch (error) {
    console.error("Error in delschedulevelByID:", error);
    return sendResponse(res, "Internal Server Error", null, error.message, 500);
  }
};
