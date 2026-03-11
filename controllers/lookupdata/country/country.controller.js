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

exports.getcountrylist = async (req, res, next) => {
  try {
    const { page = 1, limit = 5 } = req.body;

    const db = await connectToMongoDB();
    const collection = db.collection("tbllokcountry");

    const skip = (page - 1) * limit;

    const country = await collection.aggregate([
      {
        $project: {
          CountryID: 1,
          EnCountryName: 1,
          ArCountryName: 1,
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

    sendResponse(res, "country found.", null, country, totalCount);
  } catch (error) {
    console.error("Error in getAllcountryList:", error);
    next(error);
  }
};

exports.getcountryalllist = async (req, res, next) => {
  try {
    const db = await connectToMongoDB();
    const collection = db.collection("tbllokcountry");

    const country = await collection.aggregate([
      {
        $project: {
          CountryID: 1,
          EnCountryName: 1,
          ArCountryName: 1,
          IsDataStatus: 1,
          CreatedDate: 1,
          CreatedBy: 1,
          ModifyDate: 1,
          ModifyBy: 1,
        }
      },
      { $sort: { CreatedDate: -1 } }  // ✅ Sort by newest
    ]).toArray();

    const totalCount = country.length;

    sendResponse(res, "country found.", null, country, totalCount);
  } catch (error) {
    console.error("Error in getAllcountryList:", error);
    next(error);
  }
};

exports.getcountry = async (req, res, next) => {
  try {
    const { CountryID } = req.body;

    const db = await connectToMongoDB();
    const collection = db.collection("tbllokcountry");

    // Build filter for CountryID only
    const filter = {};
    if (CountryID) {
      filter.CountryID = CountryID;
    }

    const country = await collection.findOne(filter, {
      projection: {
        CountryID: 1,
        EnCountryName: 1,
        ArCountryName: 1,
        IsDataStatus: 1,
        CreatedDate: 1,
        CreatedBy: 1,
        ModifyDate: 1,
        ModifyBy: 1,
      }
    });

    if (!country) {
      return res.status(404).json({ success: false, message: "country not found" });
    }

    sendResponse(res, "country found.", null, country, 1);
  } catch (error) {
    console.error("Error in getcountry:", error);
    next(error);
  }
};

exports.createcountry = async (req, res, next) => {
  try {
    const db = await connectToMongoDB();

    const countryItem = {
      CountryID: generateUniqueId(),
      EnCountryName: req.body.EnCountryName,
      ArCountryName: req.body.ArCountryName,
      IsDataStatus: req.body.IsDataStatus,
      CreatedDate: new Date(),
      CreatedBy: req.body.CreatedBy || null,
      ModifyDate: new Date(),
      ModifyBy: req.body.ModifyBy || null,
    };

    const result = await db.collection('tbllokcountry').insertOne(countryItem);
    sendResponse(res, "country inserted successfully.", null, result, null);
  } catch (error) {
    console.error("Error in createcountry:", error);
    next(error);
  }
};

exports.updatecountry = async (req, res, next) => {
  try {
    const db = await connectToMongoDB();
    const collection = db.collection('tbllokcountry');

    const { CountryID } = req.body;

    if (!CountryID) {
      return res.status(400).json({ success: false, message: "CountryID is required" });
    }

    const updateFields = {
      EnCountryName: req.body.EnCountryName,
      ArCountryName: req.body.ArCountryName,
      IsDataStatus: req.body.IsDataStatus,
      ModifyDate: new Date(),
      ModifyBy: req.body.ModifyBy || null,
    };

    const updateResult = await collection.updateOne(
      { CountryID: CountryID },
      { $set: updateFields }
    );

    if (updateResult.matchedCount === 0) {
      return res.status(404).json({ success: false, message: "No country found to update" });
    }

    return res.status(200).json({ success: true, message: "country updated successfully" });
  } catch (error) {
    console.error("Update country Error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

exports.delcountry = async (req, res, next) => {
  const { CountryID } = req.body;
  if (!CountryID) {
    return sendResponse(res, "CountryID is required", null, null, 400);
  }

  try {
    const db = await connectToMongoDB();

    const orderDetailExists = await db.collection('tblOrderDetails').findOne({ CountryID });

    if (orderDetailExists) {
      return sendResponse(res, "country cannot be deleted. It exists in order details.", null, null, 400);
    }

    await db.collection('tbllokcountry').deleteOne({ CountryID });

    return sendResponse(res, "country deleted successfully", null, null, 200);
  } catch (error) {
    console.error("Error in delcountryByID:", error);
    return sendResponse(res, "Internal Server Error", null, error.message, 500);
  }
};
