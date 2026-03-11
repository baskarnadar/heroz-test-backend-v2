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

exports.searchtripno = async (req, res, next) => {
  try {
    const { page = 1, limit = 5 } = req.body;

    const db = await connectToMongoDB();
    const collection = db.collection("tbllokcategory");

    const skip = (page - 1) * limit;

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
      { $sort: { CreatedDate: -1 } },  // ✅ descending order
      { $skip: skip },
      { $limit: parseInt(limit) }
    ]).toArray();

    const totalCount = await collection.countDocuments();

    sendResponse(res, "category found.", null, category, totalCount);
  } catch (error) {
    console.error("Error in getAllcategoryList:", error);
    next(error);
  }
};
 