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

 

 const { ObjectId } = require('mongodb'); // <-- add this

exports.getvendor = async (req, res, next) => {
  try {
    const db = await connectToMongoDB();
    const { VendorID } = req.body || {};

    if (!VendorID || String(VendorID).trim() === "") {
      return res.status(400).json({ message: "VendorID is required." });
    }

    // Normalize VendorID to string for matching
    const vidStr = String(VendorID).trim();

    // Match by VendorID field, and also by _id if the given value is a valid ObjectId
    const orMatch = [{ VendorID: vidStr }];
    if (ObjectId.isValid(vidStr)) {
      orMatch.push({ _id: new ObjectId(vidStr) });
    }

    const pipeline = [
      { $match: { $or: orMatch } },
      { $limit: 1 },

      // Country names
      {
        $lookup: {
          from: "tbllokcountry",
          localField: "schCountryID",
          foreignField: "CountryID",
          as: "countryInfo",
        },
      },
      { $unwind: { path: "$countryInfo", preserveNullAndEmptyArrays: true } },

      // City names
      {
        $lookup: {
          from: "tbllokcity",
          localField: "schCityID",
          foreignField: "CityID",
          as: "cityInfo",
        },
      },
      { $unwind: { path: "$cityInfo", preserveNullAndEmptyArrays: true } },

      // Derived fields
      {
        $addFields: {
          EnCountryName: "$countryInfo.EnCountryName",
          ArCountryName: "$countryInfo.ArCountryName",
          EnCityName: "$cityInfo.EnCityName",
          ArCityName: "$cityInfo.ArCityName",
          vdrImageNameURL: {
            $cond: [
              { $and: [{ $ne: ["$vdrImageName", null] }, { $ne: ["$vdrImageName", ""] }] },
              { $concat: [process.env.VendorImageUrl || "", "/", "$vdrImageName"] },
              null,
            ],
          },
        },
      },

      // Cleanup
      { $project: { countryInfo: 0, cityInfo: 0 } },
    ];

    const result = await db.collection("tblvendorinfo").aggregate(pipeline).toArray();

    if (!result.length) {
      return res.status(404).json({ message: "Vendor not found." });
    }

    return res.status(200).json({
      status: "success",
      data: result[0],
    });
  } catch (error) {
    console.error("Error in getvendor:", error);
    next(error);
  }
};
