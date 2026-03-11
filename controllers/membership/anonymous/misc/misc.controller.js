// controllers/membership/misc/misc.controller.js
const { connectToMongoDB } = require("../../../../database/mongodb")

// Helper function to send responses
function sendResponse(res, message, error, results, totalCount) {
  res.status(error ? 400 : 200).json({
    statusCode: error ? 400 : 200,
    message: message,
    data: results,
    error: error,
    totalCount: totalCount,
  })
}
 exports.getAllCategoryList = async (req, res, next) => {
  try {
    const db = await connectToMongoDB();
    const collection = db.collection("tbllokcategory");

    const category = await collection.aggregate([
      {
        $project: {
          CategoryID: 1,
          EnCategoryName: 1,
          ArCategoryName: 1,
          IsDataStatus: 1,
          CreatedDate: 1,
          CreatedBy: 1,
          ModifyDate: 1,
          ModifyBy: 1,
        }
      },
      { $sort: { CreatedDate: -1 } }  // ✅ Sort by newest
    ]).toArray();

    const totalCount = category.length;

    sendResponse(res, "category found.", null, category, totalCount);
  } catch (error) {
    console.error("Error in getAllcategoryList:", error);
    next(error);
  }
};
