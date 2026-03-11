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

exports.getCategoryList = async (req, res, next) => {
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

exports.getCategoryAllList = async (req, res, next) => {
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

exports.getCategory = async (req, res, next) => {
  try {
    const { CategoryID } = req.body;

    const db = await connectToMongoDB();
    const collection = db.collection("tbllokcategory");

    // Build filter for CategoryID only
    const filter = {};
    if (CategoryID) {
      filter.CategoryID = CategoryID;
    }

    const category = await collection.findOne(filter, {
      projection: {
        CategoryID: 1,
        EnCategoryName: 1,
        ArCategoryName: 1,
        IsDataStatus: 1,
        CreatedDate: 1,
        CreatedBy: 1,
        ModifyDate: 1,
        ModifyBy: 1,
      }
    });

    if (!category) {
      return res.status(404).json({ success: false, message: "category not found" });
    }

    sendResponse(res, "category found.", null, category, 1);
  } catch (error) {
    console.error("Error in getcategory:", error);
    next(error);
  }
};

exports.createCategory = async (req, res, next) => {
  try {
    const db = await connectToMongoDB();

    const categoryItem = {
      CategoryID: generateUniqueId(),
      EnCategoryName: req.body.EnCategoryName,
      ArCategoryName: req.body.ArCategoryName,
      IsDataStatus: req.body.IsDataStatus,
      CreatedDate: new Date(),
      CreatedBy: req.body.CreatedBy || null,
      ModifyDate: new Date(),
      ModifyBy: req.body.ModifyBy || null,
    };

    const result = await db.collection('tbllokcategory').insertOne(categoryItem);
    sendResponse(res, "category inserted successfully.", null, result, null);
  } catch (error) {
    console.error("Error in createcategory:", error);
    next(error);
  }
};

exports.updateCategory = async (req, res, next) => {
  try {
    const db = await connectToMongoDB();
    const collection = db.collection('tbllokcategory');

    const { CategoryID } = req.body;

    if (!CategoryID) {
      return res.status(400).json({ success: false, message: "CategoryID is required" });
    }

    const updateFields = {
      EnCategoryName: req.body.EnCategoryName,
      ArCategoryName: req.body.ArCategoryName,
      IsDataStatus: req.body.IsDataStatus,
      ModifyDate: new Date(),
      ModifyBy: req.body.ModifyBy || null,
    };

    const updateResult = await collection.updateOne(
      { CategoryID: CategoryID },
      { $set: updateFields }
    );

    if (updateResult.matchedCount === 0) {
      return res.status(404).json({ success: false, message: "No category found to update" });
    }

    return res.status(200).json({ success: true, message: "category updated successfully" });
  } catch (error) {
    console.error("Update category Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

exports.delCategory = async (req, res, next) => {
  const { CategoryID } = req.body;
  if (!CategoryID) {
    return sendResponse(res, "CategoryID is required", null, null, 400);
  }

  try {
    const db = await connectToMongoDB();

    const orderDetailExists = await db.collection('tblOrderDetails').findOne({ CategoryID });

    if (orderDetailExists) {
      return sendResponse(res, "category cannot be deleted. It exists in order details.", null, null, 400);
    }

    await db.collection('tbllokcategory').deleteOne({ CategoryID });

    return sendResponse(res, "category deleted successfully", null, null, 200);
  } catch (error) {
    console.error("Error in delcategoryByID:", error);
    return sendResponse(res, "Internal Server Error", null, error.message, 500);
  }
};
