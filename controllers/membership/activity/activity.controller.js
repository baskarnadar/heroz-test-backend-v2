// controllers/membership/activity/activity.controller.js
const { connectToMongoDB } = require("../../../database/mongodb");
const { generateUniqueId } = require("../../../controllers/operation/operation");

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
  
 exports.activitylist = async (req, res, next) => {
  try {
    const page = Math.max(parseInt(req.body?.page ?? 1, 10), 1);
    const limit = Math.max(parseInt(req.body?.limit ?? 5, 10), 1);
    const skip = (page - 1) * limit;

    const db = await connectToMongoDB();
    const collection = db.collection("tblactivityinfo");

    const reqActTypeID = String(req.body?.actTypeID ?? "").trim();
    const reqActTypeIDNorm = reqActTypeID.replace(/[,\s]+$/g, "");
    const effectiveActTypeID = reqActTypeIDNorm || "VENDOR-SUBADMIN";

    const rawActBaseUrl = String(process.env.ActivityImageUrl || "");
    const baseActivityImageUrl = rawActBaseUrl.endsWith("/")
      ? rawActBaseUrl
      : rawActBaseUrl + "/";

    const rawVendorBaseUrl = String(process.env.VendorImageUrl || "");
    const baseVendorImageUrl = rawVendorBaseUrl.endsWith("/")
      ? rawVendorBaseUrl
      : rawVendorBaseUrl + "/";

    const pipeline = [
      {
        $addFields: {
          _actTypeIDNorm: {
            $trim: { input: { $toString: "$actTypeID" }, chars: " ," },
          },
        },
      },
      { $match: { _actTypeIDNorm: effectiveActTypeID } },

      // ✅ Vendor info
      {
        $lookup: {
          from: "tblvendorinfo",
          let: { vendorId: "$VendorID" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: [
                    { $trim: { input: { $toString: "$VendorID" }, chars: " ," } },
                    { $trim: { input: { $toString: "$$vendorId" }, chars: " ," } },
                  ],
                },
              },
            },
            {
              $project: {
                _id: 0,
                vdrName: 1,
                vdrClubName: 1,
                vdrMobileNo1: 1,
                vdrImageName: 1,
              },
            },
            { $limit: 1 },
          ],
          as: "VendorInfo",
        },
      },

      // ✅ Available Time (match by VendorID + ActivityID) -> AvalilableTime
      {
        $lookup: {
          from: "tblactavaildayshours",
          let: { activityId: "$ActivityID", vendorId: "$VendorID" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    {
                      $eq: [
                        {
                          $trim: { input: { $toString: "$ActivityID" }, chars: " ," },
                        },
                        {
                          $trim: { input: { $toString: "$$activityId" }, chars: " ," },
                        },
                      ],
                    },
                    {
                      $eq: [
                        { $trim: { input: { $toString: "$VendorID" }, chars: " ," } },
                        { $trim: { input: { $toString: "$$vendorId" }, chars: " ," } },
                      ],
                    },
                  ],
                },
              },
            },
            {
              $project: {
                _id: 0,
                AvailDaysHoursID: 1,
                DayName: 1,
                StartTime: 1,
                EndTime: 1,
                Note: 1,
              },
            },
            { $sort: { DayName: 1, StartTime: 1 } },
          ],
          as: "AvalilableTime",
        },
      },

      // ✅ Latest request info
      {
        $lookup: {
          from: "tblactivityrequest",
          let: { activityId: "$ActivityID" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: [
                    { $trim: { input: { $toString: "$ActivityID" }, chars: " ," } },
                    { $trim: { input: { $toString: "$$activityId" }, chars: " ," } },
                  ],
                },
              },
            },
            {
              $project: {
                _id: 0,
                actRequestRefNo: 1,
                CreatedDate: 1,
                UpdateDate: 1,
                actRequestDate: 1,
              },
            },
            { $sort: { CreatedDate: -1, UpdateDate: -1, actRequestDate: -1 } },
            { $limit: 1 },
          ],
          as: "ActivityRequestInfo",
        },
      },

      // ✅ URLs + flatten fields
      {
        $addFields: {
          actImageName1Url: {
            $cond: [
              { $and: [{ $ne: ["$actImageName1", null] }, { $ne: ["$actImageName1", ""] }] },
              { $concat: [baseActivityImageUrl, "$actImageName1"] },
              "",
            ],
          },
          actImageName2Url: {
            $cond: [
              { $and: [{ $ne: ["$actImageName2", null] }, { $ne: ["$actImageName2", ""] }] },
              { $concat: [baseActivityImageUrl, "$actImageName2"] },
              "",
            ],
          },
          actImageName3Url: {
            $cond: [
              { $and: [{ $ne: ["$actImageName3", null] }, { $ne: ["$actImageName3", ""] }] },
              { $concat: [baseActivityImageUrl, "$actImageName3"] },
              "",
            ],
          },

          actRequestRefNo: {
            $trim: {
              input: {
                $toString: {
                  $ifNull: [{ $arrayElemAt: ["$ActivityRequestInfo.actRequestRefNo", 0] }, ""],
                },
              },
              chars: " ,",
            },
          },

          vdrName: { $ifNull: [{ $arrayElemAt: ["$VendorInfo.vdrName", 0] }, ""] },
          vdrClubName: { $ifNull: [{ $arrayElemAt: ["$VendorInfo.vdrClubName", 0] }, ""] },
          vdrMobileNo1: { $ifNull: [{ $arrayElemAt: ["$VendorInfo.vdrMobileNo1", 0] }, ""] },
          vdrImageName: { $ifNull: [{ $arrayElemAt: ["$VendorInfo.vdrImageName", 0] }, ""] },

          vdrImageNameUrl: {
            $let: {
              vars: {
                img: { $ifNull: [{ $arrayElemAt: ["$VendorInfo.vdrImageName", 0] }, ""] },
              },
              in: {
                $cond: [
                  { $and: [{ $ne: ["$$img", null] }, { $ne: ["$$img", ""] }] },
                  { $concat: [baseVendorImageUrl, "$$img"] },
                  "",
                ],
              },
            },
          },

          TotalStarForParents: "$TotalStarForParents",
          StarValue: "$StarValue",
        },
      },

      // ✅ Remove unwanted fields (including TotalStarValue)
      {
        $unset: ["ActivityRequestInfo", "VendorInfo", "_actTypeIDNorm", "TotalStarValue"],
      },

      { $sort: { CreatedDate: -1 } },
      { $skip: skip },
      { $limit: limit },
    ];

    const activity = await collection.aggregate(pipeline).toArray();

    // ✅ AvailableDay from AvalilableTime
    const updated = activity.map((a) => {
      const times = Array.isArray(a.AvalilableTime) ? a.AvalilableTime : [];
      const days = [];
      for (const t of times) {
        const dn = String(t?.DayName ?? "").trim().toLowerCase();
        if (dn && !days.includes(dn)) days.push(dn);
      }
      return { ...a, AvailableDay: days.join(", ") };
    });

    const totalCountArr = await collection
      .aggregate([
        {
          $addFields: {
            _actTypeIDNorm: {
              $trim: { input: { $toString: "$actTypeID" }, chars: " ," },
            },
          },
        },
        { $match: { _actTypeIDNorm: effectiveActTypeID } },
        { $count: "cnt" },
      ])
      .toArray();

    const totalCount = totalCountArr?.[0]?.cnt ?? 0;

    sendResponse(res, "activity found.", null, updated, totalCount);
  } catch (error) {
    console.error("Error in activitylist:", error);
    next(error);
  }
};

