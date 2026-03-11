// controllers/membership/profile/profile.controller.js
const { connectToMongoDB } = require("../../../database/mongodb")
const {
  generateUniqueId,
} = require("../../../controllers/operation/operation");

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

 
 exports.getMemPurchaseList = async (req, res, next) => {
  try {
    const db = await connectToMongoDB();
    const starsCol = db.collection("tblMemStars");

    // =========================================================
    // ✅ Read filter input
    // =========================================================
    const ParentsID = String(req.body?.ParentsID ?? "").trim();

    // =========================================================
    // ✅ Match filter for tblMemStars
    // =========================================================
    const matchStage = {};

    if (ParentsID) {
      matchStage.$expr = {
        $eq: [
          { $trim: { input: { $toString: "$ParentsID" }, chars: " ," } },
          ParentsID,
        ],
      };
    }

    const list = await starsCol
      .aggregate([
        // -------------------------------------------------
        // ✅ Filter by ParentsID from tblMemStars
        // -------------------------------------------------
        ...(Object.keys(matchStage).length ? [{ $match: matchStage }] : []),

        // -------------------------------------------------
        // ✅ Normalize fields
        // -------------------------------------------------
        {
          $addFields: {
            ParentsIDTrim: {
              $trim: { input: { $toString: "$ParentsID" }, chars: " ," },
            },
            ProductIDTrim: {
              $trim: { input: { $toString: "$ProductID" }, chars: " ," },
            },
          },
        },

        // -------------------------------------------------
        // ✅ JOIN tblMemRegInfo : prtuserid == ParentsIDTrim
        // -------------------------------------------------
        {
          $lookup: {
            from: "tblMemRegInfo",
            let: { pid: "$ParentsIDTrim" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $eq: [
                      {
                        $trim: {
                          input: { $toString: "$prtuserid" },
                          chars: " ,",
                        },
                      },
                      "$$pid",
                    ],
                  },
                },
              },
              {
                $project: {
                  _id: 0,
                  prtuserid: 1,
                  RegUserFullName: 1,
                  RegUserEmailAddress: 1,
                  RegUserMobileNo: 1,
                  RegUserGender: 1,
                },
              },
              { $limit: 1 },
            ],
            as: "RegInfo",
          },
        },
        {
          $addFields: {
            RegInfo: { $ifNull: [{ $arrayElemAt: ["$RegInfo", 0] }, null] },
          },
        },

        // -------------------------------------------------
        // ✅ JOIN tblproducts : ProductID == ProductIDTrim
        // -------------------------------------------------
        {
          $lookup: {
            from: "tblproducts",
            let: { prodid: "$ProductIDTrim" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $eq: [
                      {
                        $trim: {
                          input: { $toString: "$ProductID" },
                          chars: " ,",
                        },
                      },
                      "$$prodid",
                    ],
                  },
                },
              },
              {
                $project: {
                  _id: 0,
                  ProductID: 1,
                  ProductName: 1,
                  ProductAmount: 1,
                  ProductTotalStar: 1,
                  ProductImage: 1,
                  IsDataStatus: 1,
                  CreatedBy: 1,
                  CreatedDate: 1,
                  ModifyBy: 1,
                  ModifyDate: 1,
                },
              },
              { $limit: 1 },
            ],
            as: "ProductInfo",
          },
        },
        {
          $addFields: {
            ProductInfo: {
              $ifNull: [{ $arrayElemAt: ["$ProductInfo", 0] }, null],
            },
          },
        },

        // -------------------------------------------------
        // ✅ JOIN tblMemShipStarLedger
        // ✅ WHERE PurchasedParentsID = req.body.ParentsID
        // ✅ Get:
        //    PurchasedBookingID
        //    PurchasedActivityID
        //    PurchasedStar
        //    PurchasedDate
        //    tblactivityinfo.actName
        // -------------------------------------------------
        {
          $lookup: {
            from: "tblMemShipStarLedger",
            let: {
              pid: "$ParentsIDTrim",
            },
            pipeline: [
              {
                $addFields: {
                  PurchasedParentsIDTrim: {
                    $trim: {
                      input: { $toString: "$PurchasedParentsID" },
                      chars: " ,",
                    },
                  },
                  PurchasedActivityIDTrim: {
                    $trim: {
                      input: { $toString: "$PurchasedActivityID" },
                      chars: " ,",
                    },
                  },
                },
              },
              {
                $match: {
                  $expr: {
                    $eq: ["$PurchasedParentsIDTrim", "$$pid"],
                  },
                },
              },

              // ---------------------------------------------
              // ✅ JOIN tblactivityinfo
              //    ActivityID == PurchasedActivityID
              // ---------------------------------------------
              {
                $lookup: {
                  from: "tblactivityinfo",
                  let: { actid: "$PurchasedActivityIDTrim" },
                  pipeline: [
                    {
                      $match: {
                        $expr: {
                          $eq: [
                            {
                              $trim: {
                                input: { $toString: "$ActivityID" },
                                chars: " ,",
                              },
                            },
                            "$$actid",
                          ],
                        },
                      },
                    },
                    {
                      $project: {
                        _id: 0,
                        ActivityID: 1,
                        actName: 1,
                      },
                    },
                    { $limit: 1 },
                  ],
                  as: "ActivityInfo",
                },
              },
              {
                $addFields: {
                  ActivityInfo: {
                    $ifNull: [{ $arrayElemAt: ["$ActivityInfo", 0] }, null],
                  },
                  actName: {
                    $ifNull: [{ $arrayElemAt: ["$ActivityInfo.actName", 0] }, ""],
                  },
                },
              },
              {
                $project: {
                  _id: 0,
                  PurchasedBookingID: 1,
                  PurchasedActivityID: 1,
                  PurchasedStar: 1,
                  PurchasedDate: 1,
                  actName: 1,
                },
              },
              { $sort: { PurchasedDate: -1 } },
            ],
            as: "PurchasedLedgerInfo",
          },
        },

        // -------------------------------------------------
        // ✅ Clean helper fields
        // ✅ Removed root duplicate fields:
        //    PurchasedBookingID
        //    PurchasedActivityID
        //    PurchasedStar
        //    PurchasedDate
        //    actName
        // ✅ Keep only PurchasedLedgerInfo array
        // -------------------------------------------------
        {
          $project: {
            _id: 0,
            ParentsIDTrim: 0,
            ProductIDTrim: 0,
          },
        },

        // -------------------------------------------------
        // ✅ Sort newest first
        // -------------------------------------------------
        { $sort: { CreatedDate: -1 } },
      ])
      .toArray();

    return sendResponse(
      res,
      "All purchase star records found with RegInfo, ProductInfo and PurchasedLedgerInfo.",
      null,
      list,
      list.length
    );
  } catch (error) {
    console.error("Error in getMemPurchaseList:", error);
    next(error);
  }
};