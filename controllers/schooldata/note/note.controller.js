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
    const { SchoolID } = req.body;
    if (!SchoolID) {
      return sendResponse(res, "SchoolID is required", true);
    }

    const db = await connectToMongoDB();
    const collection = db.collection("tblnotification");

    const filter = {
      SchoolID: SchoolID,
      noteTo: 'SCHOOL-SUBADMIN',
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
    const { SchoolID } = req.body;

    if (!SchoolID) {
      return sendResponse(res, "SchoolID is required", true);
    }

    const db = await connectToMongoDB();

    // Main notifications collection
    const collection = db.collection("tblnotification");

    // 🔍 Use aggregation so we can $lookup from TblLokNoteKeyWord and tblactivityinfo
    const notificationsRaw = await collection
      .aggregate([
        {
          $match: {
            SchoolID: SchoolID,
          },
        },
        {
          $lookup: {
            from: "TblLokNoteKeyWord", // keyword table
            localField: "noteKeyWord", // field in tblnotification
            foreignField: "NoteKeyWord", // field in TblLokNoteKeyWord
            as: "keywordInfo",
          },
        },
        {
          $unwind: {
            path: "$keywordInfo",
            preserveNullAndEmptyArrays: true, // keep notifications even if no match
          },
        },
        {
          // 🔍 lookup activity info to get actName
          $lookup: {
            from: "tblactivityinfo",
            localField: "ActivityID",   // from tblnotification
            foreignField: "ActivityID", // in tblactivityinfo
            as: "activityInfo",
          },
        },
        {
          $unwind: {
            path: "$activityInfo",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $project: {
            _id: 0,
            NoteID: 1,
            SchoolID: 1,
            noteKeyWord: 1,
            ActivityID: 1,
            noteType: 1,
            noteFrom: 1,
            noteTo: 1,
            noteStatus: 1,
            RequestID: 1,
            CreatedDate: 1,

            // 🆕 from TblLokNoteKeyWord
            NoteArMessage: "$keywordInfo.NoteArMessage",
            NoteEnMessage: "$keywordInfo.NoteEnMessage",

            // 🆕 from tblactivityinfo
            actName: "$activityInfo.actName",
          },
        },
        {
          $sort: { CreatedDate: -1 }, // ✅ Order by CreatedDate descending
        },
      ])
      .toArray();

    // 🧠 Replace [ACTNAME] placeholder in messages using actName
    const notifications = notificationsRaw.map((n) => {
      const actName = n.actName || "";

      const NoteArMessage = (n.NoteArMessage || "").replace("[ACTNAME]", actName);
      const NoteEnMessage = (n.NoteEnMessage || "").replace("[ACTNAME]", actName);

      return {
        ...n,
        NoteArMessage,
        NoteEnMessage,
      };
    });

    return sendResponse(
      res,
      "Filtered notifications fetched successfully",
      null,
      notifications
    );
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
exports.deletenote = async (req, res, next) => {
  try {
    const { NoteID } = req.body;

    if (!NoteID) {
      return sendResponse(res, "NoteID is required", true);
    }

    const db = await connectToMongoDB();
    const collection = db.collection("tblnotification");

    // If your schema stores NoteID as a plain field:
    const filter = { NoteID };

    // If you actually store MongoDB's _id instead of a NoteID field,
    // use this instead:
    // const { ObjectId } = require("mongodb");
    // const filter = { _id: new ObjectId(NoteID) };

    const result = await collection.deleteOne(filter);

    if (result.deletedCount === 0) {
      return sendResponse(res, "Notification not found", true);
    }

    return sendResponse(res, "Notification removed successfully", null, { deleted: true });
  } catch (error) {
    console.error("Error removing note:", error);
    return sendResponse(res, "Server error", true);
  }
};
