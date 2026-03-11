// outcome.controller.js
const { connectToMongoDB } = require("../../../database/mongodb");
const { generateUniqueId } = require("../../../controllers/operation/operation");

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

// -----------------------------------------------------
// 🔹 Get Outcome List (Paged)
// -----------------------------------------------------
exports.getOutcomeList = async (req, res, next) => {
  try {
    let { page = 1, limit = 5 } = req.body;

    page = parseInt(page) || 1;
    limit = parseInt(limit) || 5;

    const db = await connectToMongoDB();
    const collection = db.collection("tbllokoutcome");

    const skip = (page - 1) * limit;

    const outcomes = await collection
      .aggregate([
        {
          $project: {
            _id: 0,
            OutComeID: 1,
            EnOutCome: 1,
            ArOutCome: 1,
            OrderID: 1,
            IsDataStatus: 1,
            CreatedDate: 1,
            CreatedBy: 1,
            ModifyBy: 1,
            ModifyDate: 1,
          },
        },
        { $sort: { CreatedDate: -1 } }, // newest first
        { $skip: skip },
        { $limit: limit },
      ])
      .toArray();

    const totalCount = await collection.countDocuments();

    sendResponse(res, "Outcome list found.", null, outcomes, totalCount);
  } catch (error) {
    console.error("Error in getOutcomeList:", error);
    next(error);
  }
};

// -----------------------------------------------------
// 🔹 Get All Outcomes (No Paging)
// -----------------------------------------------------
exports.getOutcomeAllList = async (req, res, next) => {
  try {
    const db = await connectToMongoDB();
    const collection = db.collection("tbllokoutcome");

    const outcomes = await collection
      .aggregate([
        {
          $project: {
            _id: 0,
            OutComeID: 1,
            EnOutCome: 1,
            ArOutCome: 1,
            OrderID: 1,
            IsDataStatus: 1,
            CreatedDate: 1,
            CreatedBy: 1,
            ModifyBy: 1,
            ModifyDate: 1,
          },
        },
        { $sort: { CreatedDate: -1 } }, // newest first
      ])
      .toArray();

    const totalCount = outcomes.length;

    sendResponse(res, "All outcomes found.", null, outcomes, totalCount);
  } catch (error) {
    console.error("Error in getOutcomeAllList:", error);
    next(error);
  }
};

// -----------------------------------------------------
// 🔹 Get Single Outcome By OutComeID
// -----------------------------------------------------
exports.getOutcome = async (req, res, next) => {
  try {
    const { OutComeID } = req.body;

    if (!OutComeID) {
      return res
        .status(400)
        .json({ success: false, message: "OutComeID is required" });
    }

    const db = await connectToMongoDB();
    const collection = db.collection("tbllokoutcome");

    const outcome = await collection.findOne(
      { OutComeID: OutComeID },
      {
        projection: {
          _id: 0,
          OutComeID: 1,
          EnOutCome: 1,
          ArOutCome: 1,
          OrderID: 1,
          IsDataStatus: 1,
          CreatedDate: 1,
          CreatedBy: 1,
          ModifyBy: 1,
          ModifyDate: 1,
        },
      }
    );

    if (!outcome) {
      return res
        .status(404)
        .json({ success: false, message: "Outcome not found" });
    }

    sendResponse(res, "Outcome found.", null, outcome, 1);
  } catch (error) {
    console.error("Error in getOutcome:", error);
    next(error);
  }
};

// -----------------------------------------------------
// 🔹 Create Outcome
// tbllokoutcome fields:
// OutComeID (PK), EnOutCome, ArOutCome, OrderID,
// CreatedBy, CreatedDate, ModifyBy, ModifyDate, IsDataStatus (default 1)
// -----------------------------------------------------
exports.createOutcome = async (req, res, next) => {
  try {
    const db = await connectToMongoDB();
    const collection = db.collection("tbllokoutcome");

    const now = new Date();

    const outcomeItem = {
      OutComeID: generateUniqueId(),
      EnOutCome: req.body.EnOutCome || null,
      ArOutCome: req.body.ArOutCome || null,
      OrderID: req.body.OrderID || null,
      IsDataStatus:
        typeof req.body.IsDataStatus === "number"
          ? req.body.IsDataStatus
          : 1, // default 1
      CreatedDate: now,
      CreatedBy: req.body.CreatedBy || null,
      ModifyDate: now,
      ModifyBy: req.body.ModifyBy || null,
    };

    const result = await collection.insertOne(outcomeItem);

    sendResponse(res, "Outcome inserted successfully.", null, result, null);
  } catch (error) {
    console.error("Error in createOutcome:", error);
    next(error);
  }
};

// -----------------------------------------------------
// 🔹 Update Outcome
// -----------------------------------------------------
exports.updateOutcome = async (req, res, next) => {
  try {
    const db = await connectToMongoDB();
    const collection = db.collection("tbllokoutcome");

    const { OutComeID } = req.body;

    if (!OutComeID) {
      return res
        .status(400)
        .json({ success: false, message: "OutComeID is required" });
    }

    const updateFields = {
      EnOutCome: req.body.EnOutCome,
      ArOutCome: req.body.ArOutCome,
      OrderID: req.body.OrderID,
      ModifyDate: new Date(),
      ModifyBy: req.body.ModifyBy || null,
    };

    // if IsDataStatus provided, update it
    if (req.body.IsDataStatus !== undefined) {
      updateFields.IsDataStatus = req.body.IsDataStatus;
    }

    const updateResult = await collection.updateOne(
      { OutComeID: OutComeID },
      { $set: updateFields }
    );

    if (updateResult.matchedCount === 0) {
      return res
        .status(404)
        .json({ success: false, message: "No outcome found to update" });
    }

    return res
      .status(200)
      .json({ success: true, message: "Outcome updated successfully" });
  } catch (error) {
    console.error("Update Outcome Error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

// -----------------------------------------------------
// 🔹 Delete Outcome
// -----------------------------------------------------
exports.delOutcome = async (req, res, next) => {
  try {
    const { OutComeID } = req.body;

    if (!OutComeID) {
      return res
        .status(400)
        .json({ success: false, message: "OutComeID is required" });
    }

    const db = await connectToMongoDB();
    const collection = db.collection("tbllokoutcome");

    // If you later have a reference check (like order details),
    // you can add that here similar to city delete logic.

    const deleteResult = await collection.deleteOne({ OutComeID: OutComeID });

    if (deleteResult.deletedCount === 0) {
      return res
        .status(404)
        .json({ success: false, message: "No outcome found to delete" });
    }

    return res
      .status(200)
      .json({ success: true, message: "Outcome deleted successfully" });
  } catch (error) {
    console.error("Error in delOutcome:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};
