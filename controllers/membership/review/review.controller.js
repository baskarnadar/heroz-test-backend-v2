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

// ✅ GET REG INFO ONLY ( )
 exports.getreviewlist = async (req, res, next) => {
  try {
    const ActivityID = String(req.body?.ActivityID ?? "").trim();

    if (!ActivityID) {
      return sendResponse(res, "ActivityID is required.", true, [], 0);
    }

    const db = await connectToMongoDB();
    const reviewCol = db.collection("tblMemReview");

    const reviewList = await reviewCol
      .aggregate([
        {
          $match: {
            $expr: {
              $eq: [
                { $trim: { input: { $toString: "$ActivityID" }, chars: " ," } },
                { $trim: { input: { $toString: ActivityID }, chars: " ," } },
              ],
            },
          },
        },

        // ✅ Link with tblMemRegInfo using ParentsID -> prtuserid
        {
          $lookup: {
            from: "tblMemRegInfo",
            let: {
              parentsId: {
                $trim: { input: { $toString: "$ParentsID" }, chars: " ," },
              },
            },
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
                      "$$parentsId",
                    ],
                  },
                },
              },
              {
                $project: {
                  _id: 0,
                  RegUserFullName: 1,
                  prtuserid: 1,
                },
              },
            ],
            as: "regInfo",
          },
        },

        // ✅ Link with tblvendorinfo using VendorID -> VendorID
        {
          $lookup: {
            from: "tblvendorinfo",
            let: {
              vendorId: {
                $trim: { input: { $toString: "$VendorID" }, chars: " ," },
              },
            },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $eq: [
                      {
                        $trim: {
                          input: { $toString: "$VendorID" },
                          chars: " ,",
                        },
                      },
                      "$$vendorId",
                    ],
                  },
                },
              },
              {
                $project: {
                  _id: 0,
                  vdrName: 1,
                  VendorID: 1,
                },
              },
            ],
            as: "vendorInfo",
          },
        },

        {
          $addFields: {
            RegUserFullName: {
              $ifNull: [{ $arrayElemAt: ["$regInfo.RegUserFullName", 0] }, ""],
            },
            vdrName: {
              $ifNull: [{ $arrayElemAt: ["$vendorInfo.vdrName", 0] }, ""],
            },
          },
        },

        {
          $project: {
            _id: 0,
            ReviewID: 1,
            ParentsID: 1,
            VendorID: 1,
            ActivityID: 1,
            reviewDesc: 1,
            reviewRatingCountNo: 1,
            CreatedDate: 1,
            RegUserFullName: 1,
            vdrName: 1,
          },
        },

        {
          $sort: { CreatedDate: -1 },
        },
      ])
      .toArray();

    if (!reviewList || reviewList.length === 0) {
      return sendResponse(res, "No review found.", false, [], 0);
    }

    // ✅ reviewRatingValue = sum(reviewRatingCountNo) / total count
    const totalReviewCount = reviewList.length;

    const totalReviewRating = reviewList.reduce((sum, item) => {
      const rating = Number(item.reviewRatingCountNo || 0);
      return sum + (isNaN(rating) ? 0 : rating);
    }, 0);

    const reviewRatingValue =
      totalReviewCount > 0
        ? Number((totalReviewRating / totalReviewCount).toFixed(1))
        : 0;

    return sendResponse(
      res,
      "Review list found successfully.",
      false,
      {
        reviewRatingValue,
        totalReviewCount,
        reviewList,
      },
      totalReviewCount
    );
  } catch (error) {
    console.error("Error in getreviewlist:", error);
    next(error);
  }
};
 
 exports.addreview = async (req, res, next) => {
  try {
    const db = await connectToMongoDB();
    const reviewCol = db.collection("tblMemReview");

    const ReviewID = generateUniqueId();
    const ParentsID = String(req.body?.ParentsID ?? "").trim();
    const VendorID = String(req.body?.VendorID ?? "").trim();
    const ActivityID = String(req.body?.ActivityID ?? "").trim();
    const reviewDesc = String(req.body?.reviewDesc ?? "").trim();
    const CreatedBy = String(req.body?.CreatedBy ?? req.body?.PrtUserdID ?? "").trim();

    let reviewRatingCountNo = req.body?.reviewRatingCountNo;

    if (!ParentsID) {
      return sendResponse(res, "ParentsID is required.", true, [], 0);
    }

    if (!VendorID) {
      return sendResponse(res, "VendorID is required.", true, [], 0);
    }

    if (!ActivityID) {
      return sendResponse(res, "ActivityID is required.", true, [], 0);
    }

    if (!reviewDesc) {
      return sendResponse(res, "reviewDesc is required.", true, [], 0);
    }

    if (reviewRatingCountNo === undefined || reviewRatingCountNo === null || String(reviewRatingCountNo).trim() === "") {
      return sendResponse(res, "reviewRatingCountNo is required.", true, [], 0);
    }

    reviewRatingCountNo = Number(reviewRatingCountNo);

    if (isNaN(reviewRatingCountNo)) {
      return sendResponse(res, "reviewRatingCountNo must be a valid number.", true, [], 0);
    }

    if (reviewRatingCountNo < 1 || reviewRatingCountNo > 5) {
      return sendResponse(res, "reviewRatingCountNo must be between 1 and 5.", true, [], 0);
    }

    if (!CreatedBy) {
      return sendResponse(res, "CreatedBy is required.", true, [], 0);
    }

    const now = new Date();

    const newReview = {
      ReviewID: ReviewID || `REV${Date.now()}`,
      ParentsID,
      VendorID,
      ActivityID,
      reviewDesc,
      reviewRatingCountNo,
      CreatedBy,
      CreatedDate: now,
      ModifyBy: CreatedBy,
      ModifyDate: now,
    };

    const insertResult = await reviewCol.insertOne(newReview);

    if (!insertResult?.insertedId) {
      return sendResponse(res, "Failed to add review.", true, [], 0);
    }

    return sendResponse(
      res,
      "Review added successfully.",
      false,
      newReview,
      1
    );
  } catch (error) {
    console.error("Error in addreview:", error);
    next(error);
  }
};
 
 
 exports.isallowtoaddreview = async (req, res, next) => {
  try {
    const ActivityID = String(req.body?.ActivityID ?? "").trim();
    const ParentsID = String(req.body?.ParentsID ?? "").trim();

    if (!ActivityID) {
      return sendResponse(res, "ActivityID is required.", true, null, 0);
    }

    if (!ParentsID) {
      return sendResponse(res, "ParentsID is required.", true, null, 0);
    }

    const db = await connectToMongoDB();
    const reviewCol = db.collection("tblMemShipBookingInfo");

    const existingReview = await reviewCol.findOne({
      $expr: {
        $and: [
          {
            $eq: [
              { $trim: { input: { $toString: "$BookingActivityID" }, chars: " ," } },
              { $trim: { input: { $toString: ActivityID }, chars: " ," } },
            ],
          },
          {
            $eq: [
              { $trim: { input: { $toString: "$BookingParentsID" }, chars: " ," } },
              { $trim: { input: { $toString: ParentsID }, chars: " ," } },
            ],
          },
        ],
      },
    });

    if (existingReview) {
      return sendResponse(
        res,
        "Review already added.",
        false,
        {
          isAllowAddReview: "YES",
          isReviewAdded: "YES",
        },
        1
      );
    }

    return sendResponse(
      res,
      "Review not added.",
      false,
      {
        isAllowAddReview: "NO",
        isReviewAdded: "NO",
      },
      0
    );
  } catch (error) {
    console.error("Error in isallowtoaddreview:", error);
    next(error);
  }
};