const { connectToMongoDB } = require("../../../../database/mongodb");
const { createUser, updatepassword } = require("../../../service/userService");
const {
  generateUniqueId,
  generateactivityNo,
} = require("../../../../controllers/operation/operation");
const InsertFood = require("./InsertFood");
const InsertPrice = require("./InsertPrice");
const InsertDaysHours = require("./insertDaysHours");
const { InsertNotification } = require("../../../operation/component");

const UpdateFood = require("./UpdateFood");
const UpdatePrice = require("./UpdatePrice");
const UpdateDaysHours = require("./UpdateDaysHours");

const UpdateSchoolFoodPriceOnly = require("./UpdateSchoolFoodPriceOnly");
const UpdateStudentPriceOnly = require("./UpdateStudentPriceOnly");

require("dotenv").config();
// Helper function to send responses
function sendResponse(res, message, error, results, totalCount) {
  res.status(error ? 400 : 200).json({
    statusCode: error ? 400 : 200,
    message: message,
    data: results,
    error: error,
    totalCount: totalCount,
  });
}
exports.activityList = async (req, res, next) => {
  try {
    const { page = 1, limit = 5, VendorID } = req.body;

    const db = await connectToMongoDB();
    const activityCollection = db.collection("tblactivityinfo");

    const skip = (page - 1) * limit;

    // Build dynamic aggregation pipeline
    const pipeline = [];

    // Optional VendorID filter
    if (VendorID) {
      pipeline.push({
        $match: { VendorID },
      });
    }

    pipeline.push(
      { $sort: { CreatedDate: -1 } },
      { $skip: skip },
      { $limit: parseInt(limit) },

      {
        $lookup: {
          from: "tbllokcategory",
          localField: "actCategoryID",
          foreignField: "CategoryID",
          as: "categoryInfo",
        },
      },
      {
        $addFields: {
          EnCategoryNames: {
            $map: {
              input: "$categoryInfo",
              as: "cat",
              in: "$$cat.EnCategoryName",
            },
          },
        },
      },
      {
        $lookup: {
          from: "tblvendorinfo",
          localField: "VendorID",
          foreignField: "VendorID",
          as: "vendorInfo",
        },
      },
      {
        $unwind: {
          path: "$vendorInfo",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: "tbllokcity",
          localField: "actCityID",
          foreignField: "CityID",
          as: "cityInfo",
        },
      },
      {
        $unwind: {
          path: "$cityInfo",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: "tblactpriceinfo",
          let: { actID: "$ActivityID", vdrID: "$VendorID" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$ActivityID", "$$actID"] },
                    { $eq: ["$VendorID", "$$vdrID"] },
                  ],
                },
              },
            },
          ],
          as: "priceList",
        },
      },
      {
        $addFields: {
          CreatedDate: { $ifNull: ["$CreatedDate", null] },
          actStatus: { $ifNull: ["$actStatus", null] },
          vdrName: "$vendorInfo.vdrName",
          vdrClubName: "$vendorInfo.vdrClubName",
          EnCityName: "$cityInfo.EnCityName",
          vdrImageName: {
            $cond: {
              if: { $ifNull: ["$vendorInfo.vdrImageName", false] },
              then: {
                $concat: [
                  process.env.VendorImageUrl,
                  "/",
                  {
                    $replaceOne: {
                      input: "$vendorInfo.vdrImageName",
                      find: "^/",
                      replacement: "",
                    },
                  },
                ],
              },
              else: null,
            },
          },
          image: {
            $cond: {
              if: { $ifNull: ["$actImageName1", false] },
              then: {
                $concat: [
                  process.env.ActivityImageUrl,
                  "/",
                  {
                    $replaceOne: {
                      input: "$actImageName1",
                      find: "^/",
                      replacement: "",
                    },
                  },
                ],
              },
              else: null,
            },
          },
          images: [
            {
              $cond: {
                if: { $ifNull: ["$actImageName1", false] },
                then: {
                  $concat: [
                    process.env.ActivityImageUrl,
                    "/",
                    {
                      $replaceOne: {
                        input: "$actImageName1",
                        find: "^/",
                        replacement: "",
                      },
                    },
                  ],
                },
                else: null,
              },
            },
            {
              $cond: {
                if: { $ifNull: ["$actImageName2", false] },
                then: {
                  $concat: [
                    process.env.ActivityImageUrl,
                    "/",
                    {
                      $replaceOne: {
                        input: "$actImageName2",
                        find: "^/",
                        replacement: "",
                      },
                    },
                  ],
                },
                else: null,
              },
            },
            {
              $cond: {
                if: { $ifNull: ["$actImageName3", false] },
                then: {
                  $concat: [
                    process.env.ActivityImageUrl,
                    "/",
                    {
                      $replaceOne: {
                        input: "$actImageName3",
                        find: "^/",
                        replacement: "",
                      },
                    },
                  ],
                },
                else: null,
              },
            },
          ],
        },
      },
      {
        $project: {
          ActivityID: 1,
          VendorID: 1,
          actName: 1,
          actTypeID: 1,
          actDesc: 1,
          actAddress1: 1,
          actAddress2: 1,
          actMinAge: 1,
          actMaxAge: 1,
          actGender: 1,
          actMinStudent: 1,
          actMaxStudent: 1,
          EnCityName: 1,
          EnCategoryNames: 1,
          vdrName: 1,
          vdrClubName: 1,
          vdrImageName: 1,
          image: 1,
          images: 1,
          CreatedDate: 1,
          actStatus: 1,
          priceList: 1,
        },
      }
    );

    const activity = await activityCollection.aggregate(pipeline).toArray();

    const totalCount = VendorID
      ? await activityCollection.countDocuments({ VendorID })
      : await activityCollection.countDocuments();

    sendResponse(res, "activity found.", null, activity, totalCount);
  } catch (error) {
    console.error("Error in getAllactivityList:", error);
    next(error);
  }
};

exports.createActivity = async (req, res, next) => {
  console.log("yes---------------------------------------------");
  try {
    var SchoolIDVal = "0";
    var ActivityIDVal = generateUniqueId();
    var VendorIDVal = req.body.VendorID;
    const db = await connectToMongoDB();

    var actStatusVal = req.body.actStatus;
    const activityItem = {
      ActivityID: ActivityIDVal,
      VendorID: VendorIDVal,
      actName: req.body.actName,
      actTypeID: req.body.actTypeID,
      actCategoryID: req.body.actCategoryID,
      actKidsInterestID: req.body.actKidsInterestID,
      actDesc: req.body.actDesc,

      actImageName1: req.body.actImageName1, // file
      actImageName2: req.body.actImageName2, // file
      actImageName3: req.body.actImageName3, // file

      actYouTubeID1: req.body.actYouTubeID1,
      actYouTubeID2: req.body.actYouTubeID2,
      actYouTubeID3: req.body.actYouTubeID3,
      actRating: req.body.actRating,
      actGoogleMap: req.body.actGoogleMap,
      actGlat: req.body.actGlat,
      actGlan: req.body.actGlan,
      actCountryID: req.body.actCountryID,
      actCityID: req.body.actCityID,

      actAddress1: req.body.actAddress1,
      actAddress2: req.body.actAddress2,

      actMinAge: req.body.actMinAge,
      actMaxAge: req.body.actMaxAge,
      actGender: req.body.actGender,
      actMinStudent: req.body.actMinStudent,
      actMaxStudent: req.body.actMaxStudent,

      // ✅ NEW FIELDS (ADDED ONLY)
      actWhatsIncluded: req.body.actWhatsIncluded,
      actTripDetail: req.body.actTripDetail,

      actAdminNotes: req.body.actAdminNotes,
      IsDataStatus: req.body.IsDataStatus,
      actStatus: actStatusVal,
      CreatedDate: new Date(),
      CreatedBy: req.body.CreatedBy || null,
      ModifyDate: new Date(),
      ModifyBy: req.body.ModifyBy || null,
    };

    const result = await db
      .collection("tblactivityinfo")
      .insertOne(activityItem);

    await InsertFood({
      db,
      actFoodVal: req.body.actFood,
      VendorID: VendorIDVal,
      ActivityID: ActivityIDVal,
      IsDataStatus: req.body.IsDataStatus,
      CreatedBy: req.body.CreatedBy,
      ModifyBy: req.body.ModifyBy,
    });

    await InsertPrice({
      db,
      priceList: req.body.actPrice,
      actPriceVatPercentage:  req.body.actPriceVatPercentage, 
      actPriceVatAmount:  req.body.actPriceVatAmount, 
      VendorID: VendorIDVal,
      ActivityID: ActivityIDVal,
      IsDataStatus: req.body.IsDataStatus,
      CreatedBy: req.body.CreatedBy,
      ModifyBy: req.body.ModifyBy,
    });

    await InsertDaysHours({
      db,
      availData: req.body.actAvailDaysHours,
      VendorID: VendorIDVal,
      ActivityID: ActivityIDVal,
      IsDataStatus: req.body.IsDataStatus,
      CreatedBy: req.body.CreatedBy,
      ModifyBy: req.body.ModifyBy,
    });
    if (actStatusVal == "WAITING-FOR-APPROVAL") {
      await InsertNotification({
        db,
        VendorID: VendorIDVal,
        ActivityID: ActivityIDVal,
        SchoolID: SchoolIDVal,
        noteKeyWord: "ACTIVITY-WAITING-FOR-APPROVAL",
        noteType: "ACTIVITY",
        noteFrom: req.body.CreatedBy,
        noteTo: "ADMIN",
        IsDataStatus: req.body.IsDataStatus,
        CreatedBy: req.body.CreatedBy,
        ModifyBy: req.body.ModifyBy,
      });
    }
    console.log(result);
    sendResponse(res, "activity inserted successfully.", null, result, null);
  } catch (error) {
    console.error("Error in createctivity:", error);
    next(error);
  }
};

exports.updateSchoolPrice = async (req, res, next) => {
  try {
    const ActivityIDVal = req.body.ActivityID;
    const VendorIDVal = req.body.VendorID;
    const FoodPriceVal = req.body.FoodPrice;
    const StudentPriceVal = req.body.StudentPrice;
    const ProposalMessageVal = req.body.ProposalMessage;

    const db = await connectToMongoDB();

    // ✅ Update existing document in tblactivityinfo
    const result = await db.collection("tblactivityinfo").updateOne(
      {
        ActivityID: ActivityIDVal,
        VendorID: VendorIDVal,
      },
      {
        $set: {
          ProposalMessage: ProposalMessageVal,
        },
      }
    );

    // ✅ Update food price
    await UpdateSchoolFoodPriceOnly({
      db,
      SchoolFoodPrice: FoodPriceVal,
      VendorID: VendorIDVal,
      ActivityID: ActivityIDVal,
    });

    // ✅ Update student price
    await UpdateStudentPriceOnly({
      db,
      SchoolStudentPrice: StudentPriceVal,
      VendorID: VendorIDVal,
      ActivityID: ActivityIDVal,
    });

    sendResponse(res, "School Price Updated Successfully.", null, result, null);
  } catch (error) {
    console.error("Error in updateSchoolPrice:", error);
    next(error);
  }
};

exports.oldgetActivity = async (req, res, next) => {
  try {
    const { ActivityID, VendorID } = req.body;

    if (!ActivityID || !VendorID) {
      return res
        .status(400)
        .json({ message: "ActivityID and VendorID are required." });
    }

    const db = await connectToMongoDB();
    const activityCollection = db.collection("tblactivityinfo");

    const activity = await activityCollection
      .aggregate([
        {
          $match: {
            ActivityID,
            VendorID,
          },
        },

        // 🔁 Join with tblactpriceinfo
        {
          $lookup: {
            from: "tblactpriceinfo",
            let: { actId: "$ActivityID", vendorId: "$VendorID" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$ActivityID", "$$actId"] },
                      { $eq: ["$VendorID", "$$vendorId"] },
                    ],
                  },
                },
              },
            ],
            as: "priceList",
          },
        },

        // 🔁 Join with tblactfoodinfo
        {
          $lookup: {
            from: "tblactfoodinfo",
            let: { actId: "$ActivityID", vendorId: "$VendorID" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$ActivityID", "$$actId"] },
                      { $eq: ["$VendorID", "$$vendorId"] },
                    ],
                  },
                },
              },
            ],
            as: "foodList",
          },
        },

        // 🔁 Join with tblactavaildayshours
        {
          $lookup: {
            from: "tblactavaildayshours",
            let: { actId: "$ActivityID", vendorId: "$VendorID" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$ActivityID", "$$actId"] },
                      { $eq: ["$VendorID", "$$vendorId"] },
                    ],
                  },
                },
              },
            ],
            as: "availList",
          },
        },

        // 🌍 Join with tbllokcity
        {
          $lookup: {
            from: "tbllokcity",
            localField: "actCityID",
            foreignField: "CityID",
            as: "cityInfo",
          },
        },
        {
          $unwind: {
            path: "$cityInfo",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $addFields: {
            EnCityName: "$cityInfo.EnCityName",
          },
        },

        // 🌐 Join with tbllokcountry
        {
          $lookup: {
            from: "tbllokcountry",
            localField: "actCountryID",
            foreignField: "CountryID",
            as: "countryInfo",
          },
        },
        {
          $unwind: {
            path: "$countryInfo",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $addFields: {
            EnCountryName: "$countryInfo.EnCountryName",
          },
        },

        // 🏷️ Join with tbllokcategory
        {
          $lookup: {
            from: "tbllokcategory",
            localField: "actCategoryID",
            foreignField: "CategoryID",
            as: "categoryInfo",
          },
        },
        {
          $addFields: {
            EnCategoryNames: {
              $map: {
                input: "$categoryInfo",
                as: "cat",
                in: "$$cat.EnCategoryName",
              },
            },
          },
        },

        // 🏢 Join with tblvendorinfo (selective fields only)
        {
          $lookup: {
            from: "tblvendorinfo",
            let: { vendorId: "$VendorID" },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ["$VendorID", "$$vendorId"] },
                },
              },
              {
                $project: {
                  _id: 0,
                  vdrName: 1,
                  vdrClubName: 1,
                  vdrMobileNo1: 1,
                  // Add more fields here if needed
                },
              },
            ],
            as: "vendorInfo",
          },
        },
        {
          $unwind: {
            path: "$vendorInfo",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $addFields: {
            vdrName: "$vendorInfo.vdrName",
            vdrClubName: "$vendorInfo.vdrClubName",
            vdrMobileNo1: "$vendorInfo.vdrMobileNo1",
          },
        },

        // ✅ Append image URLs
        {
          $addFields: {
            actImageName1Url: {
              $cond: [
                { $ifNull: ["$actImageName1", false] },
                {
                  $concat: [
                    process.env.ActivityImageUrl,
                    "/",
                    "$actImageName1",
                  ],
                },
                null,
              ],
            },
            actImageName2Url: {
              $cond: [
                { $ifNull: ["$actImageName2", false] },
                {
                  $concat: [
                    process.env.ActivityImageUrl,
                    "/",
                    "$actImageName2",
                  ],
                },
                null,
              ],
            },
            actImageName3Url: {
              $cond: [
                { $ifNull: ["$actImageName3", false] },
                {
                  $concat: [
                    process.env.ActivityImageUrl,
                    "/",
                    "$actImageName3",
                  ],
                },
                null,
              ],
            },
          },
        },
        {
          $addFields: {
            activityImages: [
              {
                $cond: [
                  { $ifNull: ["$actImageName1", false] },
                  {
                    actImageNameUrl: {
                      $concat: [
                        process.env.ActivityImageUrl,
                        "/",
                        "$actImageName1",
                      ],
                    },
                  },
                  null,
                ],
              },
              {
                $cond: [
                  { $ifNull: ["$actImageName2", false] },
                  {
                    actImageNameUrl: {
                      $concat: [
                        process.env.ActivityImageUrl,
                        "/",
                        "$actImageName2",
                      ],
                    },
                  },
                  null,
                ],
              },
              {
                $cond: [
                  { $ifNull: ["$actImageName3", false] },
                  {
                    actImageNameUrl: {
                      $concat: [
                        process.env.ActivityImageUrl,
                        "/",
                        "$actImageName3",
                      ],
                    },
                  },
                  null,
                ],
              },
            ],
          },
        },
      ])
      .toArray();

    if (!activity.length) {
      return res.status(404).json({ message: "Activity not found." });
    }

    sendResponse(res, "Activity found.", null, activity[0], null);
  } catch (error) {
    console.error("Error in getActivity:", error);
    next(error);
  }
};

 exports.getActivity = async (req, res, next) => {
  try {
    const { ActivityID, VendorID } = req.body;

    if (!ActivityID || !VendorID) {
      return res
        .status(400)
        .json({ message: "ActivityID and VendorID are required." });
    }

    const db = await connectToMongoDB();
    const activityCollection = db.collection("tblactivityinfo");

    // ✅ base URL for gallery images (trim trailing slash once, reuse in pipeline)
    const galleryBaseRaw = process.env.ActivityGalleryUrl || "";
    const galleryBase = galleryBaseRaw.replace(/\/+$/, ""); // e.g., https://.../imagegallery

    const activity = await activityCollection
      .aggregate([
        {
          $match: {
            ActivityID,
            VendorID,
          },
        },

        // 🔁 Join with tblactpriceinfo
        {
          $lookup: {
            from: "tblactpriceinfo",
            let: { actId: "$ActivityID", vendorId: "$VendorID" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$ActivityID", "$$actId"] },
                      { $eq: ["$VendorID", "$$vendorId"] },
                    ],
                  },
                },
              },
            ],
            as: "priceList",
          },
        },

        // 🔁 Join with tblactfoodinfo
        {
          $lookup: {
            from: "tblactfoodinfo",
            let: { actId: "$ActivityID", vendorId: "$VendorID" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$ActivityID", "$$actId"] },
                      { $eq: ["$VendorID", "$$vendorId"] },
                    ],
                  },
                },
              },
            ],
            as: "foodList",
          },
        },

        // 🔁 Join with tblactavaildayshours
        {
          $lookup: {
            from: "tblactavaildayshours",
            let: { actId: "$ActivityID", vendorId: "$VendorID" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$ActivityID", "$$actId"] },
                      { $eq: ["$VendorID", "$$vendorId"] },
                    ],
                  },
                },
              },
            ],
            as: "availList",
          },
        },

        // 🌍 Join with tbllokcity
        {
          $lookup: {
            from: "tbllokcity",
            localField: "actCityID",
            foreignField: "CityID",
            as: "cityInfo",
          },
        },
        {
          $unwind: {
            path: "$cityInfo",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $addFields: {
            EnCityName: "$cityInfo.EnCityName",
          },
        },

        // 🌐 Join with tbllokcountry
        {
          $lookup: {
            from: "tbllokcountry",
            localField: "actCountryID",
            foreignField: "CountryID",
            as: "countryInfo",
          },
        },
        {
          $unwind: {
            path: "$countryInfo",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $addFields: {
            EnCountryName: "$countryInfo.EnCountryName",
          },
        },

        // 🏷️ Join with tbllokcategory
        {
          $lookup: {
            from: "tbllokcategory",
            localField: "actCategoryID",
            foreignField: "CategoryID",
            as: "categoryInfo",
          },
        },
        {
          $addFields: {
            EnCategoryNames: {
              $map: {
                input: "$categoryInfo",
                as: "cat",
                in: "$$cat.EnCategoryName",
              },
            },
          },
        },

        // ✅ NEW: Join with tbllokkidsinterest for Membership Interest
        {
          $lookup: {
            from: "tbllokkidsinterest",
            localField: "actKidsInterestID",
            foreignField: "kidsinterestID",
            as: "kidsInterestInfo",
          },
        },

        // ✅ NEW: Map kids interest image URLs
        {
          $addFields: {
            kidsInterestInfo: {
              $map: {
                input: "$kidsInterestInfo",
                as: "ki",
                in: {
                  kidsinterestID: "$$ki.kidsinterestID",
                  EnkidsinterestName: "$$ki.EnkidsinterestName",
                  ArkidsinterestName: "$$ki.ArkidsinterestName",
                  kidsinterestImageNameUrl: {
                    $cond: [
                      { $ifNull: ["$$ki.kidsinterestImageName", false] },
                      {
                        $concat: [
                          process.env.KidsInterestImageUrl || "",
                          "/",
                          "$$ki.kidsinterestImageName",
                        ],
                      },
                      null,
                    ],
                  },
                },
              },
            },
          },
        },

        // 🏢 Join with tblvendorinfo (selective fields only)
        {
          $lookup: {
            from: "tblvendorinfo",
            let: { vendorId: "$VendorID" },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ["$VendorID", "$$vendorId"] },
                },
              },
              {
                $project: {
                  _id: 0,
                  vdrName: 1,
                  vdrClubName: 1,
                  vdrMobileNo1: 1,
                  // Add more fields here if needed
                },
              },
            ],
            as: "vendorInfo",
          },
        },
        {
          $unwind: {
            path: "$vendorInfo",
            preserveNullAndEmptyArrays: true,
          },
        },
        {
          $addFields: {
            vdrName: "$vendorInfo.vdrName",
            vdrClubName: "$vendorInfo.vdrClubName",
            vdrMobileNo1: "$vendorInfo.vdrMobileNo1",
          },
        },

        // ✅ Append image URLs (your original code kept intact)
        {
          $addFields: {
            actImageName1Url: {
              $cond: [
                { $ifNull: ["$actImageName1", false] },
                {
                  $concat: [
                    process.env.ActivityImageUrl,
                    "/",
                    "$actImageName1",
                  ],
                },
                null,
              ],
            },
            actImageName2Url: {
              $cond: [
                { $ifNull: ["$actImageName2", false] },
                {
                  $concat: [
                    process.env.ActivityImageUrl,
                    "/",
                    "$actImageName2",
                  ],
                },
                null,
              ],
            },
            actImageName3Url: {
              $cond: [
                { $ifNull: ["$actImageName3", false] },
                {
                  $concat: [
                    process.env.ActivityImageUrl,
                    "/",
                    "$actImageName3",
                  ],
                },
                null,
              ],
            },
          },
        },
        {
          $addFields: {
            activityImages: [
              {
                $cond: [
                  { $ifNull: ["$actImageName1", false] },
                  {
                    actImageNameUrl: {
                      $concat: [
                        process.env.ActivityImageUrl,
                        "/",
                        "$actImageName1",
                      ],
                    },
                  },
                  null,
                ],
              },
              {
                $cond: [
                  { $ifNull: ["$actImageName2", false] },
                  {
                    actImageNameUrl: {
                      $concat: [
                        process.env.ActivityImageUrl,
                        "/",
                        "$actImageName2",
                      ],
                    },
                  },
                  null,
                ],
              },
              {
                $cond: [
                  { $ifNull: ["$actImageName3", false] },
                  {
                    actImageNameUrl: {
                      $concat: [
                        process.env.ActivityImageUrl,
                        "/",
                        "$actImageName3",
                      ],
                    },
                  },
                  null,
                ],
              },
            ],
          },
        },

        // 🔁 NEW: Join gallery images table by ActivityID
        {
          $lookup: {
            from: "tblactimagegallery",
            let: { actId: "$ActivityID" },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ["$ActivityID", "$$actId"] },
                },
              },
              { $project: { _id: 0, actImageName: 1 } },
            ],
            as: "galleryList",
          },
        },

        // 🔧 Map gallery items to URLs using ActivityGalleryUrl
        {
          $addFields: {
            galleryImages: {
              $map: {
                input: "$galleryList",
                as: "g",
                in: {
                  actImageNameUrl: {
                    $concat: [galleryBase, "/", "$$g.actImageName"],
                  },
                },
              },
            },
          },
        },

        // 🔗 Merge: keep your existing activityImages (filtered for non-null) + append galleryImages
        {
          $addFields: {
            activityImages: {
              $concatArrays: [
                {
                  $filter: {
                    input: "$activityImages",
                    as: "img",
                    cond: { $ne: ["$$img", null] },
                  },
                },
                "$galleryImages",
              ],
            },
          },
        },

        // ✅ NEW: ensure these two fields are included in final response (no removals)
        {
          $addFields: {
            actWhatsIncluded: { $ifNull: ["$actWhatsIncluded", ""] },
            actTripDetail: { $ifNull: ["$actTripDetail", ""] },
          },
        },

        // (Optional) keep payload tidy by hiding helper arrays
        {
          $project: {
            galleryList: 0,
            galleryImages: 0,
          },
        },
      ])
      .toArray();

    if (!activity.length) {
      return res.status(404).json({ message: "Activity not found." });
    }

    sendResponse(res, "Activity found.", null, activity[0], null);
  } catch (error) {
    console.error("Error in getActivity:", error);
    next(error);
  }
};

//-- Update Aug 30
exports.updateActivity = async (req, res, next) => {
  try {
    const db = await connectToMongoDB();
    const { ActivityID, VendorID } = req.body;

    // ✅ Required fields validation
    if (!ActivityID || !VendorID) {
      return res.status(400).json({
        message: "ActivityID and VendorID are required.",
      });
    }

    // ✅ Check if VendorID exists
    const vendorExists = await db
      .collection("tblvendorinfo")
      .findOne({ VendorID: VendorID });

    if (!vendorExists) {
      return res.status(404).json({
        message: "VendorID does not exist. Update operation aborted.",
      });
    }

    var actStatusVal = req.body.actStatus;
    var SchoolIDVal = req.body.SchoolID;

    // ✅ NEW (ADDED - no removals): fallback from first price row if top-level fields are missing
    const __price0 =
      Array.isArray(req.body.actPrice) && req.body.actPrice.length > 0
        ? req.body.actPrice[0]
        : {};

    const __TotalStarValueVal =
      req.body.TotalStarValue !== undefined &&
      req.body.TotalStarValue !== null &&
      String(req.body.TotalStarValue).trim() !== ""
        ? req.body.TotalStarValue
        : __price0.TotalStarValue !== undefined
          ? __price0.TotalStarValue
          : null;

    const __StarValueVal =
      req.body.StarValue !== undefined &&
      req.body.StarValue !== null &&
      String(req.body.StarValue).trim() !== ""
        ? req.body.StarValue
        : __price0.StarValue !== undefined
          ? __price0.StarValue
          : null;

    const __TotalStarForParentsVal =
      req.body.TotalStarForParents !== undefined &&
      req.body.TotalStarForParents !== null &&
      String(req.body.TotalStarForParents).trim() !== ""
        ? req.body.TotalStarForParents
        : __price0.TotalStarForParents !== undefined
          ? __price0.TotalStarForParents
          : null;

    // ✅ NEW (ADDED - no removals): for your two new fields
    const __actWhatsIncludedVal =
      req.body.actWhatsIncluded !== undefined &&
      req.body.actWhatsIncluded !== null
        ? req.body.actWhatsIncluded
        : "";

    const __actTripDetailVal =
      req.body.actTripDetail !== undefined && req.body.actTripDetail !== null
        ? req.body.actTripDetail
        : "";

    const updatedFields = {
      actName: req.body.actName,
      actTypeID: req.body.actTypeID,
      actCategoryID: req.body.actCategoryID,
      actKidsInterestID: req.body.actKidsInterestID,
      actDesc: req.body.actDesc,

      actImageName1: req.body.actImageName1,
      actImageName2: req.body.actImageName2,
      actImageName3: req.body.actImageName3,

      actYouTubeID1: req.body.actYouTubeID1,
      actYouTubeID2: req.body.actYouTubeID2,
      actYouTubeID3: req.body.actYouTubeID3,
      actRating: req.body.actRating,

      actGoogleMap: req.body.actGoogleMap,
      actGlat: req.body.actGlat,
      actGlan: req.body.actGlan,
      actCountryID: req.body.actCountryID,
      actCityID: req.body.actCityID,

      actAddress1: req.body.actAddress1,
      actAddress2: req.body.actAddress2,

      actMinAge: req.body.actMinAge,
      actMaxAge: req.body.actMaxAge,
      actGender: req.body.actGender,
      actMinStudent: req.body.actMinStudent,
      actMaxStudent: req.body.actMaxStudent,

      // ✅ NEW 3 FIELDS (YOUR CODE KEPT, but now values come from fallback variables)
      TotalStarValue: __TotalStarValueVal,
      StarValue: __StarValueVal,
      TotalStarForParents: __TotalStarForParentsVal,

      // ✅ NEW 2 FIELDS (ADDED - no removals)
      actWhatsIncluded: __actWhatsIncludedVal,
      actTripDetail: __actTripDetailVal,

      actAdminNotes: req.body.actAdminNotes,
      IsDataStatus: req.body.IsDataStatus,
      actStatus: actStatusVal,

      ModifyDate: new Date(),
      ModifyBy: req.body.ModifyBy || null,
    };

    // ✅ Update activity
    const result = await db
      .collection("tblactivityinfo")
      .updateOne(
        { ActivityID: ActivityID, VendorID: VendorID },
        { $set: updatedFields }
      );

    // ✅ Update related collections
    await UpdateFood({
      db,
      actFoodVal: req.body.actFood,
      VendorID,
      ActivityID,
      IsDataStatus: req.body.IsDataStatus,
      ModifyBy: req.body.ModifyBy,
    });

    await UpdatePrice({
      db,
      priceList: req.body.actPrice,
      actPriceVatPercentage: req.body.actPriceVatPercentage,
      actPriceVatAmount: req.body.actPriceVatAmount,

      // ✅ NEW (kept your pass-through, now also uses fallback)
      TotalStarValue: __TotalStarValueVal,
      StarValue: __StarValueVal,
      TotalStarForParents: __TotalStarForParentsVal,

      VendorID,
      ActivityID,
      IsDataStatus: req.body.IsDataStatus,
      ModifyBy: req.body.ModifyBy,
    });

    await UpdateDaysHours({
      db,
      availData: req.body.actAvailDaysHours,
      VendorID,
      ActivityID,
      IsDataStatus: req.body.IsDataStatus,
      ModifyBy: req.body.ModifyBy,
    });

    // ✅ Notification on approval wait
    if (actStatusVal === "WAITING-FOR-APPROVAL") {
      await InsertNotification({
        db,
        VendorID: VendorID,
        ActivityID: ActivityID,
        SchoolID: SchoolIDVal,
        noteKeyWord: "ACTIVITY-WAITING-FOR-APPROVAL",
        noteType: "ACTIVITY",
        noteFrom: req.body.CreatedBy,
        noteTo: "ADMIN",
        IsDataStatus: req.body.IsDataStatus,
        CreatedBy: req.body.CreatedBy,
        ModifyBy: req.body.ModifyBy,
      });
    }

    sendResponse(res, "Activity updated successfully.", null, result, null);
  } catch (error) {
    console.error("Error in udpated:", error);
    next(error);
  }
};



 exports.deleteActivity = async (req, res, next) => {
  try {
    const { ActivityID, VendorID, DeletedByID } = req.body;

    if (!ActivityID || !VendorID) {
      return res
        .status(400)
        .json({ success: false, message: "ActivityID and VendorID are required." });
    }

    const db = await connectToMongoDB();

    // Collections
    const activityCollection       = db.collection("tblactivityinfo");
    const priceCollection          = db.collection("tblactpriceinfo");
    const availCollection          = db.collection("tblactavaildayshours");
    const foodCollection           = db.collection("tblactfoodinfo");
    const schReqPriceCollection    = db.collection("tblschrequestpriceinfo");
    const schReqFoodCollection     = db.collection("tblschrequestfoodinfo");
    const notificationCollection   = db.collection("tblnotification");

    const actRequestCollection     = db.collection("tblactivityrequest");
    const payCollection            = db.collection("tblBookTripPayInfo");
    const parentsCollection        = db.collection("tblBookTripParentsInfo");
    const kidsCollection           = db.collection("tblBookTripKidsInfo");
    const kidsFoodIncCollection    = db.collection("tblBookKidsFoodIncluded");
    const kidsFoodExtraCollection  = db.collection("tblBookKidsFoodExtra");

    const deleteLogCollection      = db.collection("tbldeletereclog");

    // Identify deleter
    const deleterId = DeletedByID || req.user?.UserID || VendorID;

    // ---------- 0) Confirm activity exists for this vendor ----------
    const activityRow = await activityCollection.findOne({ ActivityID, VendorID });
    if (!activityRow) {
      return res
        .status(404)
        .json({ success: false, message: "Activity not found for this Vendor or already deleted." });
    }

    // ---------- RULE (only activity status matters) ----------
    // IsDelete = "true" when actStatus is PENDING or DRAFT, else "false"
    const normActStatus = (activityRow?.actStatus ?? "").toString().trim().toUpperCase();
    const isDeleteBool = normActStatus === "PENDING" || normActStatus === "DRAFT";
    const IsDelete = isDeleteBool ? "true" : "false";

    // If not allowed, do NOT delete — return 400
    if (!isDeleteBool) {
      return res.status(400).json({
        success: false,
        IsDelete, // "false"
        message: "Delete is not allowed. Activity actStatus must be PENDING or DRAFT.",
        activity: {
          ActivityID,
          VendorID,
          actName: activityRow?.actName ?? null,
          actStatus: activityRow?.actStatus ?? null,
          normActStatus,
        },
      });
    }

    // ---------- Helpers: logging + deleteMany ----------
    const logDocs = async (tableName, docs, context = {}) => {
      if (!docs || docs.length === 0) return 0;
      const now = new Date();
      const payload = docs.map((doc) => ({
        tableName,
        deletedAt: now,
        ActivityID,
        VendorID,
        DeletedByID: String(deleterId),
        context,
        record: doc,
      }));
      const ins = await deleteLogCollection.insertMany(payload);
      return ins.insertedCount || 0;
    };

    const logAndDeleteMany = async (collection, tableName, filter, context = {}) => {
      const docs = await collection.find(filter).toArray();
      const loggedCount = await logDocs(tableName, docs, context);
      const delRes = await collection.deleteMany(filter);
      return {
        collection: tableName,
        matched: docs.length,
        logged: loggedCount,
        deleted: delRes.deletedCount || 0,
      };
    };

    // ---------- Filters ----------
    const byActivity = { ActivityID };
    const byActivityVendor = { ActivityID, VendorID };

    // Get RequestIDs for cascading delete in booking tables
    const reqDocs = await actRequestCollection.find(byActivity, { projection: { RequestID: 1 } }).toArray();
    const requestIds = reqDocs.map(d => d?.RequestID).filter(Boolean);
    const byRequestIds = requestIds.length ? { RequestID: { $in: requestIds } } : null;

    // ---------- Perform deletes (treat every table as "many") ----------
    const activityDelete = await logAndDeleteMany(
      activityCollection,
      "tblactivityinfo",
      byActivityVendor,
      { ActivityID }
    );

    const directDeletes = await Promise.all([
      logAndDeleteMany(priceCollection,        "tblactpriceinfo",         byActivity, { ActivityID }),
      logAndDeleteMany(availCollection,        "tblactavaildayshours",    byActivity, { ActivityID }),
      logAndDeleteMany(foodCollection,         "tblactfoodinfo",          byActivity, { ActivityID }),
      logAndDeleteMany(schReqPriceCollection,  "tblschrequestpriceinfo",  byActivity, { ActivityID }),
      logAndDeleteMany(schReqFoodCollection,   "tblschrequestfoodinfo",   byActivity, { ActivityID }),
      logAndDeleteMany(notificationCollection, "tblnotification",         byActivity, { ActivityID }),
      logAndDeleteMany(actRequestCollection,   "tblactivityrequest",      byActivity, { ActivityID }),
    ]);

    // Cascade deletes by RequestID if any
    let cascadeDeletes = [];
    if (byRequestIds) {
      cascadeDeletes = await Promise.all([
        logAndDeleteMany(payCollection,           "tblBookTripPayInfo",        byRequestIds, { ActivityID, requestIds }),
        logAndDeleteMany(parentsCollection,       "tblBookTripParentsInfo",    byRequestIds, { ActivityID, requestIds }),
        logAndDeleteMany(kidsCollection,          "tblBookTripKidsInfo",       byRequestIds, { ActivityID, requestIds }),
        logAndDeleteMany(kidsFoodIncCollection,   "tblBookKidsFoodIncluded",   byRequestIds, { ActivityID, requestIds }),
        logAndDeleteMany(kidsFoodExtraCollection, "tblBookKidsFoodExtra",      byRequestIds, { ActivityID, requestIds }),
      ]);
    }

    // ---------- Summary ----------
    const summary = [
      activityDelete,
      ...directDeletes,
      ...cascadeDeletes,
    ].reduce((acc, cur) => {
      acc[cur.collection] = {
        matched: (acc[cur.collection]?.matched || 0) + cur.matched,
        logged:  (acc[cur.collection]?.logged  || 0) + cur.logged,
        deleted: (acc[cur.collection]?.deleted || 0) + cur.deleted,
      };
      return acc;
    }, {});

    return res.status(200).json({
      success: true,
      IsDelete, // "true"
      message: "Activity and related data deleted successfully (each record logged to tbldeletereclog).",
      deletedSummary: summary,
      deleter: { id: String(deleterId) },
      context: {
        ActivityID,
        VendorID,
        normActStatus, // e.g. "PENDING" or "DRAFT"
        requestIds,    // for reference
      },
    });
  } catch (error) {
    console.error("Error in deleteActivity:", error);
    next(error);
  }
};



 exports.getAllActivityRequest = async (req, res, next) => {
  try {
    const { VendorID, actRequestStatus } = req.body;

    if (!VendorID) {
      return res.status(400).json({ message: "VendorID is required." });
    }

    const db = await connectToMongoDB();

    // Base match
    const matchAnd = [{ VendorID }];
    if (actRequestStatus && actRequestStatus !== "ALL") {
      matchAnd.push({ actRequestStatus });
    }
    const matchCondition = matchAnd.length === 1 ? matchAnd[0] : { $and: matchAnd };

    const activityRequests = await db
      .collection("tblactivityrequest")
      .aggregate([
        { $match: matchCondition },

        // 🔽 Newest first
        { $sort: { CreatedDate: -1 } },

        // Join activity info for names/types
        {
          $lookup: {
            from: "tblactivityinfo",
            localField: "ActivityID",
            foreignField: "ActivityID",
            as: "activityInfo",
          },
        },
        {
          $unwind: {
            path: "$activityInfo",
            preserveNullAndEmptyArrays: true,
          },
        },

        // Count students (kids) for each RequestID from tblBookTripKidsInfo
        {
          $lookup: {
            from: "tblBookTripKidsInfo",
            let: { reqId: "$RequestID" },
            pipeline: [
              { $match: { $expr: { $eq: ["$RequestID", "$$reqId"] } } },
              { $count: "count" },
            ],
            as: "kidsCount",
          },
        },

        // Surface fields + totalPaidStudent (count of kids)
        {
          $addFields: {
            actName: "$activityInfo.actName",
            actTypeID: "$activityInfo.actTypeID",
            totalPaidStudent: { $ifNull: [{ $first: "$kidsCount.count" }, 0] },
          },
        },

        // Clean up helper arrays
        { $project: { activityInfo: 0, kidsCount: 0 } },
      ])
      .toArray();

    const message =
      activityRequests.length > 0
        ? "Activity requests retrieved successfully."
        : "No activity requests found.";

    sendResponse(res, message, null, activityRequests, 1);
  } catch (error) {
    console.error("Error in getAllActivityRequest:", error);
    next(error);
  }
};



exports.getActivityRequest = async (req, res, next) => {
  try {
    const { RequestID } = req.body;

    if (!RequestID) {
      return res.status(400).json({ message: "RequestID is required." });
    }

    const db = await connectToMongoDB();
    const activityRequest = await db
      .collection("tblactivityrequest")
      .findOne({ RequestID });

    if (!activityRequest) {
      return res.status(404).json({ message: "Activity request not found." });
    }

    sendResponse(res, "Activity request found.", null, activityRequest, 1);
  } catch (error) {
    console.error("Error in getActivityRequest:", error);
    next(error);
  }
};

 exports.updateActivityRequest = async (req, res, next) => {
  try {
    const { RequestID, RequestStatus, ModifyBy,RequestRejectReason } = req.body;

    if (!RequestID || !RequestStatus) {
      return res
        .status(400)
        .json({ message: "RequestID and RequestStatus are required." });
    }

    const db = await connectToMongoDB();
    const requestsCol = db.collection("tblactivityrequest");
    const notesCol = db.collection("tblnotification");

    // 1) Get the existing request so we can read VendorID/ActivityID/SchoolID
    const existing = await requestsCol.findOne({ RequestID });
    if (!existing) {
      return res.status(404).json({ message: "Activity request not found." });
    }

    // 2) Update the request status
    await requestsCol.updateOne(
      { RequestID },
      {
        $set: {
          actRequestStatus: RequestStatus,
          ModifyDate: new Date(),
          ModifyBy: ModifyBy ?? null,
          RequestRejectReason: RequestRejectReason
        },
      }
    );

    // 3) Prepare notification fields
    let noteKeyWord = null;
    let noteType = "ACTIVITY";
    let noteTo = "SCHOOL-SUBADMIN";

    if (RequestStatus === "APPROVED") {
      noteKeyWord = "ACTIVITY-APPROVED";
    } else if (RequestStatus === "REJECTED") {
      noteKeyWord = "ACTIVITY-REJECTED";
    }  

    const VendorID = existing.VendorID ?? null;
    const ActivityID = existing.ActivityID ?? null;
    const SchoolID = existing.SchoolID ?? null;
    const noteFrom = VendorID; // as requested

    // 4) Insert notification
    const docToInsert = {
      NoteID:   generateUniqueId (), 
      RequestID : RequestID,                      
      VendorID,
      noteKeyWord,
      ActivityID,
      SchoolID,
      noteType,
      noteFrom,
      noteTo,
      noteStatus: "NEW",
      IsDataStatus: 1,               // default to 1 as per your pattern
      CreatedDate: new Date(),
      CreatedBy: ModifyBy ?? null,   // or set to existing.CreatedBy if you prefer
      ModifyDate: new Date(),
      ModifyBy: ModifyBy ?? null,
    };

    await notesCol.insertOne(docToInsert);

    // 5) Return the updated request
    const updatedActivityRequest = await requestsCol.findOne({ RequestID });

    sendResponse(
      res,
      "Activity request updated successfully.",
      null,
      updatedActivityRequest,
      1
    );
  } catch (error) {
    console.error("Error in Update sucessfully:", error);
    next(error);
  }
};


exports.vdrgetAllActivityRequest = async (req, res, next) => {
  try {
    const { VendorID, actRequestStatus } = req.body;

    if (!VendorID) {
      return res.status(400).json({ message: "VendorID is required." });
    }

    const db = await connectToMongoDB();

    // Build match condition
    const matchCondition = { VendorID };
    if (actRequestStatus && actRequestStatus !== "ALL") {
      matchCondition.actRequestStatus = actRequestStatus;
    }

    const activityRequests = await db
      .collection("tblactivityrequest")
      .aggregate([
        // Filter by vendor and (optionally) status
        { $match: matchCondition },

        // 🔽 Newest first by request creation date
        { $sort: { CreatedDate: -1 } },

        // Join activity info for actName / actTypeID
        {
          $lookup: {
            from: "tblactivityinfo",
            localField: "ActivityID",
            foreignField: "ActivityID",
            as: "activityInfo",
          },
        },
        {
          $unwind: {
            path: "$activityInfo",
            preserveNullAndEmptyArrays: true,
          },
        },

        // 🔢 Count students (kids) for each RequestID from tblBookTripKidsInfo
        {
          $lookup: {
            from: "tblBookTripKidsInfo",
            let: { reqId: "$RequestID" },
            pipeline: [
              { $match: { $expr: { $eq: ["$RequestID", "$$reqId"] } } },
              { $count: "count" },
            ],
            as: "kidsCount",
          },
        },

        // Surface fields + totalPaidStudent (count of kids)
        {
          $addFields: {
            actName: "$activityInfo.actName",
            actTypeID: "$activityInfo.actTypeID",
            totalPaidStudent: { $ifNull: [{ $first: "$kidsCount.count" }, 0] },
          },
        },

        // Clean up helper arrays
        { $project: { activityInfo: 0, kidsCount: 0 } },
      ])
      .toArray();

    const message =
      activityRequests.length > 0
        ? "Activity requests retrieved successfully."
        : "No activity requests found.";

    sendResponse(res, message, null, activityRequests, 1);
  } catch (error) {
    console.error("Error in getAllActivityRequest:", error);
    next(error);
  }
};


exports.activityAllList = async (req, res, next) => {
  try {
    const { VendorID } = req.body;

    const db = await connectToMongoDB();
    const activityCollection = db.collection("tblactivityinfo");

    // Build dynamic aggregation pipeline
    const pipeline = [];

    // Optional VendorID filter
    if (VendorID) {
      pipeline.push({
        $match: { VendorID },
      });
    }

    pipeline.push(
      { $sort: { CreatedDate: -1 } },

      {
        $lookup: {
          from: "tbllokcategory",
          localField: "actCategoryID",
          foreignField: "CategoryID",
          as: "categoryInfo",
        },
      },
      {
        $addFields: {
          EnCategoryNames: {
            $map: {
              input: "$categoryInfo",
              as: "cat",
              in: "$$cat.EnCategoryName",
            },
          },
        },
      },
      {
        $lookup: {
          from: "tblvendorinfo",
          localField: "VendorID",
          foreignField: "VendorID",
          as: "vendorInfo",
        },
      },
      {
        $unwind: {
          path: "$vendorInfo",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: "tbllokcity",
          localField: "actCityID",
          foreignField: "CityID",
          as: "cityInfo",
        },
      },
      {
        $unwind: {
          path: "$cityInfo",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: "tblactpriceinfo",
          let: { actID: "$ActivityID", vdrID: "$VendorID" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$ActivityID", "$$actID"] },
                    { $eq: ["$VendorID", "$$vdrID"] },
                  ],
                },
              },
            },
          ],
          as: "priceList",
        },
      },
      {
        $addFields: {
          CreatedDate: { $ifNull: ["$CreatedDate", null] },
          actStatus: { $ifNull: ["$actStatus", null] },
          vdrName: "$vendorInfo.vdrName",
          vdrClubName: "$vendorInfo.vdrClubName",
          EnCityName: "$cityInfo.EnCityName",
          vdrImageName: {
            $cond: {
              if: { $ifNull: ["$vendorInfo.vdrImageName", false] },
              then: {
                $concat: [
                  process.env.VendorImageUrl,
                  "/",
                  {
                    $replaceOne: {
                      input: "$vendorInfo.vdrImageName",
                      find: "^/",
                      replacement: "",
                    },
                  },
                ],
              },
              else: null,
            },
          },
          image: {
            $cond: {
              if: { $ifNull: ["$actImageName1", false] },
              then: {
                $concat: [
                  process.env.ActivityImageUrl,
                  "/",
                  {
                    $replaceOne: {
                      input: "$actImageName1",
                      find: "^/",
                      replacement: "",
                    },
                  },
                ],
              },
              else: null,
            },
          },
          images: [
            {
              $cond: {
                if: { $ifNull: ["$actImageName1", false] },
                then: {
                  $concat: [
                    process.env.ActivityImageUrl,
                    "/",
                    {
                      $replaceOne: {
                        input: "$actImageName1",
                        find: "^/",
                        replacement: "",
                      },
                    },
                  ],
                },
                else: null,
              },
            },
            {
              $cond: {
                if: { $ifNull: ["$actImageName2", false] },
                then: {
                  $concat: [
                    process.env.ActivityImageUrl,
                    "/",
                    {
                      $replaceOne: {
                        input: "$actImageName2",
                        find: "^/",
                        replacement: "",
                      },
                    },
                  ],
                },
                else: null,
              },
            },
            {
              $cond: {
                if: { $ifNull: ["$actImageName3", false] },
                then: {
                  $concat: [
                    process.env.ActivityImageUrl,
                    "/",
                    {
                      $replaceOne: {
                        input: "$actImageName3",
                        find: "^/",
                        replacement: "",
                      },
                    },
                  ],
                },
                else: null,
              },
            },
          ],
        },
      },
      {
        $project: {
          ActivityID: 1,
          VendorID: 1,
          actName: 1,
          actTypeID: 1,
          actDesc: 1,
          actAddress1: 1,
          actAddress2: 1,
          actMinAge: 1,
          actMaxAge: 1,
          actGender: 1,
          actMinStudent: 1,
          actMaxStudent: 1,
          EnCityName: 1,
          EnCategoryNames: 1,
          vdrName: 1,
          vdrClubName: 1,
          vdrImageName: 1,
          image: 1,
          images: 1,
          CreatedDate: 1,
          actStatus: 1,
          priceList: 1,
          actRating: 1,
        },
      }
    );

    const activity = await activityCollection.aggregate(pipeline).toArray();

    const totalCount = VendorID
      ? await activityCollection.countDocuments({ VendorID })
      : await activityCollection.countDocuments();

    sendResponse(res, "activity found.", null, activity, totalCount);
  } catch (error) {
    console.error("Error in getAllactivityList:", error);
    next(error);
  }
};
exports.attachImages = async (req, res, next) => {
  try {
 
    var ActivityIDVal = req.body.ActivityID;
    var VendorIDVal = req.body.VendorID;
    const db = await connectToMongoDB();
    const activityItem = {
      actImageGalleryID:  generateUniqueId(),
      ActivityID: ActivityIDVal,
      VendorID: VendorIDVal,
      actImageName: req.body.actImageName, 
      IsDataStatus: 1,
      CreatedDate: new Date(),
      CreatedBy: req.body.CreatedBy || null,
      ModifyDate: new Date(),
      ModifyBy: req.body.ModifyBy || null,
    };

    const result = await db
      .collection("tblactimagegallery")
      .insertOne(activityItem);

  
    console.log(req.body.actAvailDaysHours);
    sendResponse(res, "activity image successfully.", null, result, null);
  } catch (error) {
    console.error("Error in activity image:", error);
    next(error);
  }
};
exports.getattachImages = async (req, res, next) => {
  try {
    const ActivityIDVal = req.body.ActivityID;
    const db = await connectToMongoDB();

    // Include actImageGalleryID so it doesn't become undefined/blank
    const galleryRecords = await db
      .collection("tblactimagegallery")
      .find({ ActivityID: ActivityIDVal })
      .project({ _id: 1, ActivityID: 1, actImageName: 1, actImageGalleryID: 1 })
      .toArray();

    const baseUrlRaw = process.env.ActivityGalleryUrl || "";
    const baseUrl = baseUrlRaw.replace(/\/+$/, ""); // trim trailing slash

    const imageObjects = galleryRecords.map((r) => {
      const file = String(r?.actImageName || "").replace(/^\/+/, "");
      // Prefer explicit actImageGalleryID, else fallback to Mongo _id
      const galleryId =
        (r?.actImageGalleryID && String(r.actImageGalleryID)) ||
        (r?._id && r._id.toString()) ||
        "";

      return {
        ActivityID: String(r?.ActivityID ?? ""),
        actImageGalleryID: galleryId,
        actimages: file,
        actimagesUrl: `${baseUrl}/${file}`,
      };
    });

    sendResponse(
      res,
      "Activity images fetched successfully.",
      null,
      imageObjects,
      imageObjects.length
    );
  } catch (error) {
    console.error("Error in getattachImages:", error);
    next(error);
  }
};


exports.removeattachImages = async (req, res, next) => {
  try {
    const ActivityIDVal = req.body.ActivityID
    const actImageGalleryIDVal = req.body.actImageGalleryID
    const db = await connectToMongoDB()

    // Delete the specific record
    const result = await db.collection("tblactimagegallery").deleteOne({
      ActivityID: ActivityIDVal,
      actImageGalleryID: actImageGalleryIDVal,
    })

    if (result.deletedCount === 0) {
      return sendResponse(res, "No matching image found to delete.", null, null, null)
    }

    sendResponse(res, "Activity image deleted successfully.", null, null, null)
  } catch (error) {
    console.error("Error in gremoveattachImages:", error)
    next(error)
  }
}

