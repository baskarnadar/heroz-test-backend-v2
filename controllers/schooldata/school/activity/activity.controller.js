const { connectToMongoDB } = require("../../../../database/mongodb");

const {
  generateUniqueId,
  GetRefNo,
} = require("../../../../controllers/operation/operation");
const { InsertNotification } = require("../../../operation/component");

console.log("POST /actRequest hit 3");
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
 exports.actRequest = async (req, res, next) => {
  try {
    const RequestIDVal = generateUniqueId();
    const NoteIDVal = generateUniqueId();
    const ActivityIDVal = req.body.ActivityID;
    const VendorIDVal = req.body.VendorID;
    const SchoolIDVal = req.body.SchoolID;
    const actRequestRefNoVal = GetRefNo();

    const db = await connectToMongoDB();

    // Build the document to insert
    const activityItem = {
      RequestID: RequestIDVal,
      ActivityID: ActivityIDVal,
      VendorID: VendorIDVal,
      SchoolID: SchoolIDVal,
      actRequestRefNo: actRequestRefNoVal,
      actRequestDate: req.body.actRequestDate,
      actRequestTime: req.body.actRequestTime,
      actRequestMessage: req.body.actRequestMessage,
      actRequestStatus: req.body.actRequestStatus,
      actTotalNoStudents: req.body.actTotalNoStudents,
      CreatedDate: new Date(),
      CreatedBy: req.body.CreatedBy || null,
      ModifyDate: new Date(),
      ModifyBy: req.body.ModifyBy || null,
    };

    // Insert request
    await db.collection("tblactivityrequest").insertOne(activityItem);

    // Insert notification
    await InsertNotification({
      db,
      NoteID: NoteIDVal,
      RequestID: RequestIDVal,
      ActivityID: ActivityIDVal,
      VendorID: VendorIDVal,
      SchoolID: SchoolIDVal,
      noteType: "ACTIVITY",
      noteFrom: SchoolIDVal,
      noteTo: "VENDOR-SUBADMIN",
      noteStatus: "NEW",
      IsDataStatus: 1,
      CreatedBy: req.body.CreatedBy || null,
      ModifyBy: req.body.ModifyBy || null,
      noteKeyWord: req.body.actRequestStatus,
    });

    // Fetch vendor info for response
    const vendorInfo = await db.collection("tblvendorinfo").findOne(
      { VendorID: VendorIDVal },
      { projection: { vdrName: 1, vdrClubName: 1, _id: 0 } }
    );

    // Respond with RefNo + vendor fields
    sendResponse(
      res,
      "Record inserted successfully.",
      null,
      {
        RefNo: actRequestRefNoVal,
        vdrName: vendorInfo?.vdrName || null,
        vdrClubName: vendorInfo?.vdrClubName || null,
      },
      null
    );
  } catch (error) {
    console.error("Error in actRequest:", error);
    next(error);
  }
};


 exports.schgetAllActivityRequest = async (req, res, next) => {
  try {
    const { SchoolID, actRequestStatus } = req.body;

    if (!SchoolID) {
      return res.status(400).json({ message: "SchoolID is required." });
    }

    const db = await connectToMongoDB();

    // Build match condition
    const matchCondition = { SchoolID };
    if (actRequestStatus && actRequestStatus !== "ALL") {
      matchCondition.actRequestStatus = actRequestStatus;
    }

    const activityRequests = await db
      .collection("tblactivityrequest")
      .aggregate([
        // Filter
        { $match: matchCondition },

        // Newest first
        { $sort: { CreatedDate: -1 } },

        // Join activity info
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

        // Join vendor info
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

        // Count students (kids) for each RequestID
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

        // Expose fields
        {
          $addFields: {
            actName: "$activityInfo.actName",
            actTypeID: "$activityInfo.actTypeID",
            vdrName: "$vendorInfo.vdrName",
            vdrClubName: "$vendorInfo.vdrClubName",
            totalPaidStudent: { $ifNull: [{ $first: "$kidsCount.count" }, 0] },
          },
        },

        // Cleanup helper arrays
        { $project: { activityInfo: 0, kidsCount: 0, vendorInfo: 0 } },
      ])
      .toArray();

    const message =
      activityRequests.length > 0
        ? "Activity requests retrieved successfully."
        : "No activity requests found.";

    sendResponse(res, message, null, activityRequests, 1);
  } catch (error) {
    console.error("Error in schgetAllActivityRequest:", error);
    next(error);
  }
};


 exports.schgetActivity = async (req, res, next) => {
  try {
    const { ActivityID, RequestID } = req.body;

    if (!ActivityID) {
      const badReq = {
        statusCode: 400,
        message: "ActivityID is required.",
        data: null,
        error: null,
        totalCount: 0,
      };
      return res.status(400).json(badReq);
    }

    const db = await connectToMongoDB();
    const activityCollection = db.collection("tblactivityinfo");

    const activity = await activityCollection
      .aggregate([
        // --- Inputs ---
        { $match: { ActivityID } },
        // expose RequestID to lookups; may be null/empty
        { $addFields: { _requestId: RequestID } },

        // 🔁 Join with tblactpriceinfo
        {
          $lookup: {
            from: "tblactpriceinfo",
            localField: "ActivityID",
            foreignField: "ActivityID",
            as: "priceList",
          },
        },

        // 🔁 Join with tblactfoodinfo (base food list)
        {
          $lookup: {
            from: "tblactfoodinfo",
            localField: "ActivityID",
            foreignField: "ActivityID",
            as: "foodList",
          },
        },

        // 🔁 Join with tblactavaildayshours
        {
          $lookup: {
            from: "tblactavaildayshours",
            localField: "ActivityID",
            foreignField: "ActivityID",
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
        { $unwind: { path: "$cityInfo", preserveNullAndEmptyArrays: true } },
        { $addFields: { EnCityName: "$cityInfo.EnCityName" } },

        // 🌐 Join with tbllokcountry
        {
          $lookup: {
            from: "tbllokcountry",
            localField: "actCountryID",
            foreignField: "CountryID",
            as: "countryInfo",
          },
        },
        { $unwind: { path: "$countryInfo", preserveNullAndEmptyArrays: true } },
        { $addFields: { EnCountryName: "$countryInfo.EnCountryName" } },

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

        // 🏫 Join with tblvendorinfo (use VendorID)
        {
          $lookup: {
            from: "tblvendorinfo",
            localField: "VendorID",
            foreignField: "VendorID",
            pipeline: [{ $project: { _id: 0, vdrName: 1, vdrClubName: 1, vdrMobileNo1: 1 } }],
            as: "vendorInfo",
          },
        },
        { $unwind: { path: "$vendorInfo", preserveNullAndEmptyArrays: true } },
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
                { $concat: [process.env.ActivityImageUrl, "/", "$actImageName1"] },
                null,
              ],
            },
            actImageName2Url: {
              $cond: [
                { $ifNull: ["$actImageName2", false] },
                { $concat: [process.env.ActivityImageUrl, "/", "$actImageName2"] },
                null,
              ],
            },
            actImageName3Url: {
              $cond: [
                { $ifNull: ["$actImageName3", false] },
                { $concat: [process.env.ActivityImageUrl, "/", "$actImageName3"] },
                null,
              ],
            },
          },
        },
        {
          $addFields: {
            activityImages: {
              $filter: {
                input: [
                  {
                    $cond: [
                      { $ifNull: ["$actImageName1", false] },
                      { actImageNameUrl: { $concat: [process.env.ActivityImageUrl, "/", "$actImageName1"] } },
                      null,
                    ],
                  },
                  {
                    $cond: [
                      { $ifNull: ["$actImageName2", false] },
                      { actImageNameUrl: { $concat: [process.env.ActivityImageUrl, "/", "$actImageName2"] } },
                      null,
                    ],
                  },
                  {
                    $cond: [
                      { $ifNull: ["$actImageName3", false] },
                      { actImageNameUrl: { $concat: [process.env.ActivityImageUrl, "/", "$actImageName3"] } },
                      null,
                    ],
                  },
                ],
                as: "img",
                cond: { $ne: ["$$img", null] },
              },
            },
          },
        },

        // =========================
        // 🎯 Selected school price items by RequestID (optional)
        // =========================
        {
          $lookup: {
            from: "tblschrequestpriceinfo",
            let: { actId: "$ActivityID", reqId: "$_requestId" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$ActivityID", "$$actId"] },
                      {
                        $cond: [
                          { $and: [{ $ne: ["$$reqId", null] }, { $ne: ["$$reqId", ""] }] },
                          { $eq: ["$RequestID", "$$reqId"] },
                          false,
                        ],
                      },
                    ],
                  },
                },
              },
              { $project: { _id: 0, SchoolPrice: 1 } },
            ],
            as: "SelectedSchooPriceItems",
          },
        },

        // =========================
        // 🍔 Selected school food price items + names by RequestID (optional)
        // =========================
        {
          $lookup: {
            from: "tblschrequestfoodinfo",
            let: { actId: "$ActivityID", reqId: "$_requestId" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$ActivityID", "$$actId"] },
                      {
                        $cond: [
                          { $and: [{ $ne: ["$$reqId", null] }, { $ne: ["$$reqId", ""] }] },
                          { $eq: ["$RequestID", "$$reqId"] },
                          false,
                        ],
                      },
                    ],
                  },
                },
              },
              // join to food master to get the name
              {
                $lookup: {
                  from: "tblactfoodinfo",
                  localField: "FoodID",
                  foreignField: "FoodID",
                  as: "foodInfo",
                },
              },
              { $unwind: { path: "$foodInfo", preserveNullAndEmptyArrays: true } },
              {
                $project: {
                  _id: 0,
                  SchoolFoodName: { $ifNull: ["$foodInfo.FoodName", "$foodInfo.EnFoodName"] },
                  SchoolFoodPrice: "$FoodSchoolPrice",
                },
              },
            ],
            as: "SelectedSchooFoodPriceItems",
          },
        },

        // Cleanup & remove unwanted fields (including totals you asked to drop)
        {
          $project: {
            cityInfo: 0,
            countryInfo: 0,
            categoryInfo: 0,
            vendorInfo: 0,
            _requestId: 0,

            // remove totals (not returned)
            SelectedSchooPrice: 0,
            SelectedSchooFoodPrice: 0,

            // strip audit fields from root
            IsDataStatus: 0,
            CreatedBy: 0,
            ModifyDate: 0,
            ModifyBy: 0,

            // strip audit fields inside arrays
            "priceList.IsDataStatus": 0,
            "priceList.CreatedBy": 0,
            "priceList.ModifyDate": 0,
            "priceList.ModifyBy": 0,

            "foodList.IsDataStatus": 0,
            "foodList.CreatedBy": 0,
            "foodList.ModifyDate": 0,
            "foodList.ModifyBy": 0,

            "availList.IsDataStatus": 0,
            "availList.CreatedBy": 0,
            "availList.ModifyDate": 0,
            "availList.ModifyBy": 0,
          },
        },
      ])
      .toArray();

    // 🚩 NOT FOUND — force HTTP 404 with consistent payload (NO sendResponse)
    if (!activity.length) {
      const payload = {
        statusCode: 404,
        message: "Activity Not found.",
        data: null,
        error: null,
        totalCount: 0,
      };
      return res.status(404).json(payload);
    }

    // ✅ FOUND — return 200 with consistent payload (keep helper if you like)
    const result = activity[0];
    const ok = {
      statusCode: 200,
      message: "Activity found.",
      data: result,
      error: null,
      totalCount: 1,
    };

    if (typeof sendResponse === "function") {
      // keep your helper for success, but it's optional
      res.status(200);
      return sendResponse(res, ok.message, ok.error, ok.data, 1, 200, ok.totalCount, ok.statusCode);
    }

    return res.status(200).json(ok);
  } catch (error) {
    console.error("Error in schgetActivity:", error);
    return res.status(500).json({
      statusCode: 500,
      message: "Internal Server Error",
      error: error.message,
      data: null,
      totalCount: 0,
    });
  }
};



 exports.schgetActivityRequest = async (req, res, next) => {
  try {
    const { RequestID } = req.body;
console.log(RequestID);
    if (!RequestID) {
      return res.status(400).json({ message: "RequestID is required." });
    }

    const db = await connectToMongoDB();

    // 1) Base request
    const activityRequest = await db
      .collection("tblactivityrequest")
      .findOne({ RequestID });

    if (!activityRequest) {
      return res.status(404).json({ message: "Activity request not found." });
    }

    // 2) Students WITH approved payment
    //    Join tblBookTripKidsInfo -> tblBookTripPayInfo
    //    Keep only the *latest* payment per kid, and only if PayStatus === "APPROVED"
    const studentsWithApprovedPay = await db
      .collection("tblBookTripKidsInfo")
      .aggregate([
        { $match: { RequestID } },

        {
          $lookup: {
            from: "tblBookTripPayInfo",
            let: { rid: "$RequestID", kid: "$KidsID" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$RequestID", "$$rid"] },
                      { $eq: ["$KidsID", "$$kid"] }
                    ]
                  }
                }
              },
              { $sort: { CreatedDate: -1 } },  // newest first, in case multiple payments
              { $limit: 1 },                    // keep only the latest record
              { $match: { PayStatus: "APPROVED" } } // only approved
            ],
            as: "pay"
          }
        },

        // Keep only rows where there IS an approved pay doc
        { $unwind: "$pay" },

        // Shape the response (adjust fields as your UI needs)
        {
          $project: {
            _id: 0,
            RequestID: 1,
            KidsID: 1,
            TripKidsName: 1,
            tripKidsSchoolNo: 1,
            tripKidsClassName: 1,
            TripFullAmount: 1,            // from kids info (your stored full amount for the kid)
            PayRefNo: "$pay.PayRefNo",
            PayStatus: "$pay.PayStatus",
            PaidAmount: "$pay.TripFullAmount", // from payment doc if you store it there
            PayDate: "$pay.CreatedDate"
          }
        }
      ])
      .toArray();

    // 3) Count of approved students
    const actTotalPaidStudents = studentsWithApprovedPay.length;

    // 4) Merge into payload
    const payload = {
      ...activityRequest,
      actTotalPaidStudents,            // e.g. 4
      studentsApproved: studentsWithApprovedPay // detailed rows (Kids+latest APPROVED pay)
    };

    sendResponse(res, "Activity request found.", null, payload, 1);
  } catch (error) {
    console.error("Error in schgetActivityRequest:", error);
    next(error);
  }
};

// controller.js
exports.schgetApprovedActivityList = async (req, res, next) => {
  try {
    // ---- input ----
    let { page = 1, limit = 50 } = req.body || {};

    // normalize pagination
    page = parseInt(page, 10);
    limit = parseInt(limit, 10);
    if (!Number.isFinite(page) || page < 1) page = 1;
    if (!Number.isFinite(limit) || limit < 1) limit = 50;

    const db = await connectToMongoDB();
    const activityCollection = db.collection("tblactivityinfo");

    const skip = (page - 1) * limit;

    // only approved
    const baseMatch = { actStatus: "APPROVED" };

    // ---------- MAIN PIPELINE ----------
    const pipeline = [
      { $match: baseMatch },

      // ✅ order by actOrderID asc (then newest CreatedDate)
      { $sort: { actOrderID: 1, CreatedDate: -1 } },

      // paginate
      { $skip: skip },
      { $limit: limit },

      // joins
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
          // ✅ NEW: Arabic category names array
          arCategoryNames: {
            $map: {
              input: "$categoryInfo",
              as: "cat",
              in: "$$cat.ArCategoryName",
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
      { $unwind: { path: "$vendorInfo", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "tbllokcity",
          localField: "actCityID",
          foreignField: "CityID",
          as: "cityInfo",
        },
      },
      { $unwind: { path: "$cityInfo", preserveNullAndEmptyArrays: true } },

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

      // fields + SAFE image URL building + SAFE rating default
      {
        $addFields: {
          CreatedDate: { $ifNull: ["$CreatedDate", null] },
          actStatus: { $ifNull: ["$actStatus", null] },

          // ensure actRating present (default 0)
          actRating: {
            $cond: [
              { $or: [{ $eq: ["$actRating", null] }, { $not: ["$actRating"] }] },
              0,
              "$actRating",
            ],
          },

          vdrName: "$vendorInfo.vdrName",
          vdrClubName: "$vendorInfo.vdrClubName",
          EnCityName: "$cityInfo.EnCityName",

          vdrImageName: {
            $let: {
              vars: { v: { $ifNull: ["$vendorInfo.vdrImageName", ""] } },
              in: {
                $cond: [
                  { $eq: ["$$v", ""] },
                  null,
                  {
                    $concat: [
                      process.env.VendorImageUrl,
                      "/",
                      { $trim: { input: "$$v", chars: "/" } },
                    ],
                  },
                ],
              },
            },
          },

          image: {
            $let: {
              vars: { a1: { $ifNull: ["$actImageName1", ""] } },
              in: {
                $cond: [
                  { $eq: ["$$a1", ""] },
                  null,
                  {
                    $concat: [
                      process.env.ActivityImageUrl,
                      "/",
                      { $trim: { input: "$$a1", chars: "/" } },
                    ],
                  },
                ],
              },
            },
          },

          images: [
            {
              $let: {
                vars: { a: { $ifNull: ["$actImageName1", ""] } },
                in: {
                  $cond: [
                    { $eq: ["$$a", ""] },
                    null,
                    {
                      $concat: [
                        process.env.ActivityImageUrl,
                        "/",
                        { $trim: { input: "$$a", chars: "/" } },
                      ],
                    },
                  ],
                },
              },
            },
            {
              $let: {
                vars: { a: { $ifNull: ["$actImageName2", ""] } },
                in: {
                  $cond: [
                    { $eq: ["$$a", ""] },
                    null,
                    {
                      $concat: [
                        process.env.ActivityImageUrl,
                        "/",
                        { $trim: { input: "$$a", chars: "/" } },
                      ],
                    },
                  ],
                },
              },
            },
            {
              $let: {
                vars: { a: { $ifNull: ["$actImageName3", ""] } },
                in: {
                  $cond: [
                    { $eq: ["$$a", ""] },
                    null,
                    {
                      $concat: [
                        process.env.ActivityImageUrl,
                        "/",
                        { $trim: { input: "$$a", chars: "/" } },
                      ],
                    },
                  ],
                },
              },
            },
          ],
        },
      },

      // output
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
          arCategoryNames: 1, // ✅ expose Arabic categories
          vdrName: 1,
          vdrClubName: 1,
          vdrImageName: 1,
          image: 1,
          images: 1,
          CreatedDate: 1,
          actStatus: 1,
          priceList: 1,
          actRating: 1,
          actOrderID: 1, // ✅ include in output
        },
      },
    ];

    const activity = await activityCollection.aggregate(pipeline).toArray();

    // ---------- COUNT ----------
    const countPipeline = [{ $match: baseMatch }, { $count: "n" }];
    const countAgg = await activityCollection.aggregate(countPipeline).toArray();
    const totalCount = countAgg.length ? countAgg[0].n : 0;

    sendResponse(res, "activity found.", null, activity, totalCount);
  } catch (error) {
    console.error("Error in schgetApprovedActivityList:", error);
    next(error);
  }
};


 exports.getallactstatus = async (req, res, next) => {
  try {
    const db = await connectToMongoDB();
    const { SchoolID } = req.body;

    if (!SchoolID) {
      return res.status(400).json({ message: "SchoolID is required." });
    }

    // Aggregation with lookups to fetch actName and vdrName
    const activityRequests = await db.collection("tblactivityrequest").aggregate([
      { $match: { SchoolID } },
      { $sort: { CreatedDate: -1 } },

      // Lookup for actName from tblactivityinfo
      {
        $lookup: {
          from: "tblactivityinfo",
          localField: "ActivityID",
          foreignField: "ActivityID",
          as: "activityInfo"
        }
      },
      {
        $unwind: {
          path: "$activityInfo",
          preserveNullAndEmptyArrays: true
        }
      },

      // Lookup for vdrName from tblvendorinfo
      {
        $lookup: {
          from: "tblvendorinfo",
          localField: "VendorID",
          foreignField: "VendorID",
          as: "vendorInfo"
        }
      },
      {
        $unwind: {
          path: "$vendorInfo",
          preserveNullAndEmptyArrays: true
        }
      },

      // Project the desired fields
      {
        $project: {
          _id: 1,
           RequestID: 1,
          ActivityID: 1,
          VendorID: 1,
          SchoolID: 1,
          actRequestDate: 1,
          actRequestStatus: 1,
          CreatedDate: 1,
          actName: "$activityInfo.actName",
          vdrName: "$vendorInfo.vdrName",
           vdrClubName: "$vendorInfo.vdrClubName"
          
        }
      }
    ]).toArray();

    res.status(200).json({
      status: "success",
      total: activityRequests.length,
      data: activityRequests,
    });

  } catch (error) {
    console.error("Error in getallactstatus:", error);
    next(error);
  }
};
 const { ObjectId } = require("mongodb");

 

exports.getschool = async (req, res, next) => {
  try {
    const db = await connectToMongoDB();
    const { SchoolID } = req.body;

    if (!SchoolID) {
      return res.status(400).json({ message: "SchoolID is required." });
    }

    // Allow matching by string SchoolID or by _id if a valid ObjectId string is provided
    const orMatch = [{ SchoolID }];
    if (ObjectId.isValid(SchoolID)) {
      orMatch.push({ _id: new ObjectId(SchoolID) });
    }

    const pipeline = [
      { $match: { $or: orMatch } },
      { $limit: 1 },

      // 🎓 Education level names
      {
        $lookup: {
          from: "tbllokschedulevel",
          localField: "schEduLevel",         // tblschoolinfo.schEduLevel
          foreignField: "SchEduLevelID",     // tbllokschedulevel.SchEduLevelID
          as: "eduLevelInfo",
        },
      },
      { $unwind: { path: "$eduLevelInfo", preserveNullAndEmptyArrays: true } },

      // 🌍 Country names
      {
        $lookup: {
          from: "tbllokcountry",
          localField: "schCountryID",        // tblschoolinfo.schCountryID
          foreignField: "CountryID",         // tbllokcountry.CountryID
          as: "countryInfo",
        },
      },
      { $unwind: { path: "$countryInfo", preserveNullAndEmptyArrays: true } },

      // 🏙 City names
      {
        $lookup: {
          from: "tbllokcity",
          localField: "schCityID",           // tblschoolinfo.schCityID
          foreignField: "CityID",            // tbllokcity.CityID
          as: "cityInfo",
        },
      },
      { $unwind: { path: "$cityInfo", preserveNullAndEmptyArrays: true } },

      // ➕ Add derived fields
      {
        $addFields: {
          EnSchEduLevelName: "$eduLevelInfo.EnSchEduLevelName",
          ArSchEduLevelName: "$eduLevelInfo.ArSchEduLevelName",

          EnCountryName: "$countryInfo.EnCountryName",
          ArCountryName: "$countryInfo.ArCountryName",

          EnCityName: "$cityInfo.EnCityName",
          ArCityName: "$cityInfo.ArCityName",

          schImageNameURL: {
            $cond: [
              {
                $and: [
                  { $ne: ["$schImageName", null] },
                  { $ne: ["$schImageName", ""] },
                ],
              },
              { $concat: [process.env.SchoolImageUrl, "/", "$schImageName"] },
              null,
            ],
          },
        },
      },

      // 🧹 Remove temp arrays
      {
        $project: {
          eduLevelInfo: 0,
          countryInfo: 0,
          cityInfo: 0,
        },
      },
    ];

    const result = await db.collection("tblschoolinfo").aggregate(pipeline).toArray();

    if (!result.length) {
      return res.status(404).json({ message: "School not found." });
    }

    return res.status(200).json({
      status: "success",
      data: result[0],
    });
  } catch (error) {
    console.error("Error in getschool:", error);
    next(error);
  }
};

