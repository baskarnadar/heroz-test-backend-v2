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

exports.getcitylist = async (req, res, next) => {
  try {
    const { page = 1, limit = 5 } = req.body;

    const db = await connectToMongoDB();
    const collection = db.collection("tbllokcity");

    const skip = (page - 1) * limit;

    const City = await collection.aggregate([
      {
        $project: {
          CityID: 1,
          EnCityName: 1,
          ArCityName: 1,
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

    sendResponse(res, "City found.", null, City, totalCount);
  } catch (error) {
    console.error("Error in getAllCityList:", error);
    next(error);
  }
};

exports.getcitylistonly = async (req, res, next) => {
  try {
    const db = await connectToMongoDB();
    const collection = db.collection("tbllokcity");

    const City = await collection.aggregate([
      {
        $project: {
          CityID: 1,
          EnCityName: 1,
          ArCityName: 1,
          IsDataStatus: 1,
          CreatedDate: 1,
          CreatedBy: 1,
          ModifyBy: 1,
          ModifyBy: 1,
        }
      },
      { $sort: { CreatedDate: -1 } }  // ✅ Sort by newest
    ]).toArray();

    const totalCount = City.length;

    sendResponse(res, "City found.", null, City, totalCount);
  } catch (error) {
    console.error("Error in getAllCityList:", error);
    next(error);
  }
};


exports.getcityalllist = async (req, res, next) => {
  try {
    const db = await connectToMongoDB();
    const collection = db.collection("tbllokcity");

    const City = await collection.aggregate([
      {
        $project: {
          CityID: 1,
          EnCityName: 1,
          ArCityName: 1,
          IsDataStatus: 1,
          CreatedDate: 1,
          CreatedBy: 1,
          ModifyBy: 1,
          ModifyBy: 1,
        }
      },
      { $sort: { CreatedDate: -1 } }  // ✅ Sort by newest
    ]).toArray();

    const totalCount = City.length;

    sendResponse(res, "City found.", null, City, totalCount);
  } catch (error) {
    console.error("Error in getAllCityList:", error);
    next(error);
  }
};

exports.getCity = async (req, res, next) => {
  try {
    const { CityID } = req.body;

    const db = await connectToMongoDB();
    const collection = db.collection("tbllokcity");

    // Build filter for CityID only
    const filter = {};
    if (CityID) {
      filter.CityID = CityID;
    }

    const City = await collection.findOne(filter, {
      projection: {
        CityID: 1,
        EnCityName: 1,
        ArCityName: 1,
        IsDataStatus: 1,
        CreatedDate: 1,
        CreatedBy: 1,
        ModifyBy: 1,
        ModifyBy: 1,
      }
    });

    if (!City) {
      return res.status(404).json({ success: false, message: "City not found" });
    }

    sendResponse(res, "City found.", null, City, 1);
  } catch (error) {
    console.error("Error in getCity:", error);
    next(error);
  }
};

exports.createCity = async (req, res, next) => {
  try {
    const db = await connectToMongoDB();

    const CityItem = {
      CityID: generateUniqueId(),
      EnCityName: req.body.EnCityName,
      ArCityName: req.body.ArCityName,
      IsDataStatus: req.body.IsDataStatus,
      CreatedDate: new Date(),
      CreatedBy: req.body.CreatedBy || null,
      ModifyBy: new Date(),
      ModifyBy: req.body.ModifyBy || null,
    };

    const result = await db.collection('tbllokcity').insertOne(CityItem);
    sendResponse(res, "City inserted successfully.", null, result, null);
  } catch (error) {
    console.error("Error in createCity:", error);
    next(error);
  }
};

exports.updateCity = async (req, res, next) => {
  try {
    const db = await connectToMongoDB();
    const collection = db.collection('tbllokcity');

    const { CityID } = req.body;

    if (!CityID) {
      return res.status(400).json({ success: false, message: "CityID is required" });
    }

    const updateFields = {
      EnCityName: req.body.EnCityName,
      ArCityName: req.body.ArCityName,
      IsDataStatus: req.body.IsDataStatus,
      ModifyBy: new Date(),
      ModifyBy: req.body.ModifyBy || null,
    };

    const updateResult = await collection.updateOne(
      { CityID: CityID },
      { $set: updateFields }
    );

    if (updateResult.matchedCount === 0) {
      return res.status(404).json({ success: false, message: "No City found to update" });
    }

    return res.status(200).json({ success: true, message: "City updated successfully" });
  } catch (error) {
    console.error("Update City Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

exports.delCity = async (req, res, next) => {
  const { CityID } = req.body;
  if (!CityID) {
    return sendResponse(res, "CityID is required", null, null, 400);
  }

  try {
    const db = await connectToMongoDB();

    const orderDetailExists = await db.collection('tblOrderDetails').findOne({ CityID });

    if (orderDetailExists) {
      return sendResponse(res, "City cannot be deleted. It exists in order details.", null, null, 400);
    }

    await db.collection('tbllokcity').deleteOne({ CityID });

    return sendResponse(res, "City deleted successfully", null, null, 200);
  } catch (error) {
    console.error("Error in delCityByID:", error);
    return sendResponse(res, "Internal Server Error", null, error.message, 500);
  }
};
