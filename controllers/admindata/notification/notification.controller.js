const { connectToMongoDB } = require("../../../database/mongodb");
const {
  generateUniqueId,
} = require("../../../controllers/operation/operation");

// ✅ Helper function to send responses
function sendResponse(res, message, error, results = null, totalCount = null) {
  res.status(error ? 400 : 200).json({
    statusCode: error ? 400 : 200,
    message: message,
    data: results,
    error: error,
    totalCount: totalCount,
  });
}

// ✅ Get total count of notifications for vendor subadmin
exports.getnote = async (req, res, next) => {
  try {
    const { VendorID } = req.body;
    if (!VendorID) {
      return sendResponse(res, "VendorID is required", true);
    }

    const db = await connectToMongoDB();
    const collection = db.collection("tblnotification");

    const filter = {
      VendorID: VendorID,
      noteTo: 'VENDOR-SUBADMIN',
       noteStatus: 'NEW'
    };

    const totalCount = await collection.countDocuments(filter);

    return sendResponse(res, "Notification count fetched successfully", null, totalCount, totalCount);
  } catch (error) {
    console.error("Error fetching notification count:", error);
    return sendResponse(res, "Server error", true);
  }
};

// ✅ Get all specific notifications
exports.getnoteall = async (req, res, next) => {
  try {
    const { VendorID } = req.body;

    if (!VendorID) {
      return sendResponse(res, "VendorID is required", true);
    }

    const db = await connectToMongoDB();
    const collection = db.collection("tblnotification");

    const filter = {
      VendorID: VendorID,
      noteKeyWord: 'ACTIVITY-WAITING-FOR-REQUEST-APPROVAL'
    };

    const projection = {
      _id: 0,
      NoteID: 1,
      VendorID: 1,
      noteKeyWord: 1,
      ActivityID: 1,
      SchoolID: 1,
      noteType: 1,
      noteFrom: 1,
      noteTo: 1,
      noteStatus: 1,
      RequestID:1,
    };

    const notifications = await collection.find(filter).project(projection).toArray();

    return sendResponse(res, "Filtered notifications fetched successfully", null, notifications);
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return sendResponse(res, "Server error", true);
  }
};

exports.updatenote = async (req, res, next) => {
  try {
    const { NoteID, noteStatus } = req.body;

    if (!NoteID || !noteStatus) {
      return sendResponse(res, "NoteID and noteStatus are required", true);
    }

    const db = await connectToMongoDB();
    const collection = db.collection("tblnotification");

    const filter = { NoteID };
    const update = { $set: { noteStatus } };

    const result = await collection.updateOne(filter, update);

    if (result.matchedCount === 0) {
      return sendResponse(res, "Notification not found", true);
    }

    return sendResponse(res, "Note status updated successfully", null, { updated: true });
  } catch (error) {
    console.error("Error updating note:", error);
    return sendResponse(res, "Server error", true);
  }
};