const { connectToMongoDB } = require("../../../database/mongodb");
const { generateUniqueId } = require("../../../controllers/operation/operation");

// Helper
function sendResponse(res, message, error, results, totalCount) {
  res.status(error ? 400 : 200).json({
    statusCode: error ? 400 : 200,
    message: message,
    data: results,
    error: error,
    totalCount: totalCount ?? 0,
  });
}

// ===========================
// ADD FAVOURITE
// ===========================
exports.memaddfavourite = async (req, res, next) => {
  try {
    const db = await connectToMongoDB();
    const collection = db.collection("tblFavourite");

    const { ParentsID, ActivityID } = req.body || {};

    if (!ParentsID || String(ParentsID).trim() === "") {
      return sendResponse(res, "ParentsID is required.", true);
    }

    if (!ActivityID || String(ActivityID).trim() === "") {
      return sendResponse(res, "ActivityID is required.", true);
    }

    const filter = {
      ParentsID: String(ParentsID).trim(),
      ActivityID: String(ActivityID).trim(),
    };

    // ✅ prevent duplicate
    const existing = await collection.findOne(filter);
    if (existing) {
      return sendResponse(res, "Already added to favourite.", null, existing);
    }

    const now = new Date();

    const newFav = {
      FavID: generateUniqueId(),
      ParentsID: String(ParentsID).trim(),
      ActivityID: String(ActivityID).trim(),
      CreatedDate: now,
      CreatedBy: String(ParentsID).trim(),
      ModifyBy: String(ParentsID).trim(),
      ModifyDate: now,
    };

    console.log("🚀 memaddfavourite =", newFav);

    const result = await collection.insertOne(newFav);

    return sendResponse(res, "Favourite added.", null, {
      insertedId: result.insertedId,
      ...newFav,
    });
  } catch (error) {
    console.error("Error in memaddfavourite:", error);
    next(error);
  }
};

// ===========================
// LIST FAVOURITE
// ===========================
exports.memgetfavouritelist = async (req, res, next) => {
  try {
    const db = await connectToMongoDB();
    const collection = db.collection("tblFavourite");

    const { ParentsID } = req.body || {};

    if (!ParentsID || String(ParentsID).trim() === "") {
      return sendResponse(res, "ParentsID is required.", true);
    }

    const filter = {
      ParentsID: String(ParentsID).trim(),
    };

    console.log("🚀 memgetfavouritelist filter =", filter);

    const result = await collection
      .find(filter)
      .sort({ CreatedDate: -1 })
      .toArray();

    return sendResponse(
      res,
      result.length > 0 ? "Favourite list found." : "No favourites found.",
      null,
      result,
      result.length
    );
  } catch (error) {
    console.error("Error in memgetfavouritelist:", error);
    next(error);
  }
};

// ===========================
// DELETE FAVOURITE
// ===========================
exports.memdeletfavourite = async (req, res, next) => {
  try {
    const db = await connectToMongoDB();
    const collection = db.collection("tblFavourite");

    const { FavID, ParentsID, ActivityID } = req.body || {};

    if (!FavID || String(FavID).trim() === "") {
      return sendResponse(res, "FavID is required.", true);
    }

    if (!ParentsID || String(ParentsID).trim() === "") {
      return sendResponse(res, "ParentsID is required.", true);
    }

    if (!ActivityID || String(ActivityID).trim() === "") {
      return sendResponse(res, "ActivityID is required.", true);
    }

    const filter = {
      FavID: String(FavID).trim(),
      ParentsID: String(ParentsID).trim(),
      ActivityID: String(ActivityID).trim(),
    };

    console.log("🚀 memdeletfavourite filter =", filter);

    const deleteResult = await collection.deleteOne(filter);

    if (deleteResult.deletedCount === 0) {
      return sendResponse(res, "No favourite found.", true);
    }

    return sendResponse(res, "Favourite deleted.", null, {
      deletedCount: deleteResult.deletedCount,
      FavID: String(FavID).trim(),
    });
  } catch (error) {
    console.error("Error in memdeletfavourite:", error);
    next(error);
  }
};