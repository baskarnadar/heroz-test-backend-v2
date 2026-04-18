// controllers/membership/products/products.controller.js
const { connectToMongoDB } = require("../../../database/mongodb");
const { generateUniqueId } = require("../../../controllers/operation/operation");

// Helper function to send responses
function sendResponse(res, message, error, results, totalCount) {
  res.status(error ? 400 : 200).json({
    statusCode: error ? 400 : 200,
    message: message,
    data: results,
    error: error,
    totalCount: totalCount ?? 0,
  });
}



exports.memaddnote = async (req, res, next) => {
  try {
    const db = await connectToMongoDB();
    const collection = db.collection("tblnotification");

    const {
      RequestID,
      VendorID,
      noteKeyWord,
      ActivityID,
      SchoolID,
      ParentsID, // ✅ NEW FIELD ADDED
      noteType,
      noteFrom,
      noteTo,
      noteStatus,
      IsDataStatus,
      CreatedBy,
      ModifyBy,
    } = req.body || {};

    // ✅ basic validation
    if (!RequestID || String(RequestID).trim() === "") {
      return sendResponse(res, "RequestID is required.", true);
    }

    if (!VendorID || String(VendorID).trim() === "") {
      return sendResponse(res, "VendorID is required.", true);
    }

    if (!noteKeyWord || String(noteKeyWord).trim() === "") {
      return sendResponse(res, "noteKeyWord is required.", true);
    }

    if (!ActivityID || String(ActivityID).trim() === "") {
      return sendResponse(res, "ActivityID is required.", true);
    }

    if (!noteType || String(noteType).trim() === "") {
      return sendResponse(res, "noteType is required.", true);
    }

    if (!noteFrom || String(noteFrom).trim() === "") {
      return sendResponse(res, "noteFrom is required.", true);
    }

    if (!noteTo || String(noteTo).trim() === "") {
      return sendResponse(res, "noteTo is required.", true);
    }

    // ✅ NEW VALIDATION
    if (!ParentsID || String(ParentsID).trim() === "") {
      return sendResponse(res, "ParentsID is required.", true);
    }

    const now = new Date();

    const newNote = {
      NoteID: generateUniqueId(),

      RequestID: String(RequestID).trim(),
      VendorID: String(VendorID).trim(),
      noteKeyWord: String(noteKeyWord).trim(),
      ActivityID: String(ActivityID).trim(),

      // ✅ store SchoolID if provided
      ...(SchoolID && String(SchoolID).trim() !== ""
        ? { SchoolID: String(SchoolID).trim() }
        : {}),

      // ✅ NEW FIELD STORED
      ParentsID: String(ParentsID).trim(),

      noteType: String(noteType).trim(),
      noteFrom: String(noteFrom).trim(),
      noteTo: String(noteTo).trim(),
      noteStatus:
        noteStatus && String(noteStatus).trim() !== ""
          ? String(noteStatus).trim()
          : "NEW",

      IsDataStatus:
        IsDataStatus === 0 || IsDataStatus === false ? 0 : 1,

      CreatedDate: now,
      CreatedBy:
        CreatedBy && String(CreatedBy).trim() !== ""
          ? String(CreatedBy).trim()
          : String(ParentsID).trim(), // ✅ use ParentsID fallback

      ModifyDate: now,
      ModifyBy:
        ModifyBy && String(ModifyBy).trim() !== ""
          ? String(ModifyBy).trim()
          : String(ParentsID).trim(), // ✅ use ParentsID fallback
    };

    console.log("🚀 memaddnote payload =");
    console.log(JSON.stringify(req.body, null, 2));

    console.log("🚀 memaddnote insert object =");
    console.log(JSON.stringify(newNote, null, 2));

    const result = await collection.insertOne(newNote);

    console.log("✅ memaddnote insert result =");
    console.log(result);

    // ✅ return inserted object except SchoolID
    const responseData = { ...newNote };
    delete responseData.SchoolID;

    return sendResponse(
      res,
      "Notification note added successfully.",
      null,
      {
        insertedId: result.insertedId,
        ...responseData,
      }
    );
  } catch (error) {
    console.error("Error in memaddnote:", error);
    next(error);
  }
};
exports.memgetnotelist = async (req, res, next) => {
  try {
    const db = await connectToMongoDB();
    const collection = db.collection("tblnotification");

    const { ParentsID, noteTo, NoteID } = req.body || {};

    // ✅ basic validation
    if (!ParentsID || String(ParentsID).trim() === "") {
      return sendResponse(res, "ParentsID is required.", true);
    }

    if (!noteTo || String(noteTo).trim() === "") {
      return sendResponse(res, "noteTo is required.", true);
    }

    const filter = {
      noteFrom: String(ParentsID).trim(),
      noteTo: String(noteTo).trim(),
    };

    // ✅ optional filter by NoteID
    if (NoteID && String(NoteID).trim() !== "") {
      filter.NoteID = String(NoteID).trim();
    }

    console.log("🚀 memgetnotelist payload =");
    console.log(JSON.stringify(req.body, null, 2));

    console.log("🚀 memgetnotelist filter =");
    console.log(JSON.stringify(filter, null, 2));

    const result = await collection
      .find(filter)
      .sort({ CreatedDate: -1 })
      .toArray();

    console.log("✅ memgetnotelist result count =", result.length);
    console.log("✅ memgetnotelist result =");
    console.log(JSON.stringify(result, null, 2));

    const responseData = (result || []).map((item) => {
      const obj = { ...item };
      delete obj.SchoolID; // ✅ exclude SchoolID from response
      return obj;
    });

    return sendResponse(
      res,
      result.length > 0 ? "Notification notes found." : "No notification notes found.",
      null,
      responseData,
      responseData.length
    );
  } catch (error) {
    console.error("Error in memgetnotelist:", error);
    next(error);
  }
};
exports.memupdatenoteStatus = async (req, res, next) => {
  try {
    const db = await connectToMongoDB();
    const collection = db.collection("tblnotification");

    const { NoteID, noteStatus, ParentsID } = req.body || {};

    // ✅ required fields
    if (!NoteID || String(NoteID).trim() === "") {
      return sendResponse(res, "NoteID is required.", true);
    }

    if (!noteStatus || String(noteStatus).trim() === "") {
      return sendResponse(res, "noteStatus is required.", true);
    }

    if (!ParentsID || String(ParentsID).trim() === "") {
      return sendResponse(res, "ParentsID is required.", true);
    }

    const filter = {
      NoteID: String(NoteID).trim(),
      ParentsID: String(ParentsID).trim(), // ✅ added filter
    };

    console.log("🚀 memupdatenoteStatus payload =");
    console.log(JSON.stringify(req.body, null, 2));

    console.log("🚀 memupdatenoteStatus filter =");
    console.log(JSON.stringify(filter, null, 2));

    // ✅ update
    const updateResult = await collection.updateOne(
      filter,
      {
        $set: {
          noteStatus: String(noteStatus).trim(),
          ModifyDate: new Date(),
          ModifyBy: String(ParentsID).trim(),
        },
      }
    );

    console.log("✅ memupdatenoteStatus update result =");
    console.log(updateResult);

    if (updateResult.matchedCount === 0) {
      return sendResponse(res, "No record found to update.", true);
    }

    // ✅ fetch updated record
    const updatedRecord = await collection.findOne({
      NoteID: String(NoteID).trim(),
      ParentsID: String(ParentsID).trim(),
    });

    const responseData = { ...updatedRecord };
    delete responseData.SchoolID;

    return sendResponse(
      res,
      "Notification status updated successfully.",
      null,
      responseData
    );
  } catch (error) {
    console.error("Error in memupdatenoteStatus:", error);
    next(error);
  }
};
exports.memdeletenote = async (req, res, next) => {
  try {
    const db = await connectToMongoDB();
    const collection = db.collection("tblnotification");

    const { NoteID, ParentsID } = req.body || {};

    // ✅ validation
    if (!NoteID || String(NoteID).trim() === "") {
      return sendResponse(res, "NoteID is required.", true);
    }

    if (!ParentsID || String(ParentsID).trim() === "") {
      return sendResponse(res, "ParentsID is required.", true);
    }

    const filter = {
      NoteID: String(NoteID).trim(),
      ParentsID: String(ParentsID).trim(),
    };

    console.log("🚀 memdeletenote payload =");
    console.log(JSON.stringify(req.body, null, 2));

    console.log("🚀 memdeletenote filter =");
    console.log(JSON.stringify(filter, null, 2));

    // ✅ delete
    const deleteResult = await collection.deleteOne(filter);

    console.log("✅ memdeletenote delete result =");
    console.log(deleteResult);

    if (deleteResult.deletedCount === 0) {
      return sendResponse(res, "No record found to delete.", true);
    }

    return sendResponse(
      res,
      "Notification deleted successfully.",
      null,
      {
        deletedCount: deleteResult.deletedCount,
        NoteID: String(NoteID).trim(),
      }
    );
  } catch (error) {
    console.error("Error in memdeletenote:", error);
    next(error);
  }
};