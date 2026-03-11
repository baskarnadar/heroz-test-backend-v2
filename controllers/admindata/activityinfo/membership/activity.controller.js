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

require('dotenv').config();
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
 exports.oldactivityList = async (req, res, next) => {
  try {
    const { page = 1, limit = 5 } = req.body;

    const db = await connectToMongoDB();
    const activityCollection = db.collection("tblactivityinfo");

    const skip = (page - 1) * limit;

    const pipeline = [];

    // Always approved; VendorID filter removed
    const match = {
      actStatus: { $in: ['APPROVED', 'WAITING-FOR-APPROVAL','PENDING'] }
    };
    pipeline.push({ $match: match });

    pipeline.push(
      { $sort: { CreatedDate: -1 } },
      { $skip: skip },
      { $limit: parseInt(limit, 10) },

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

      // NEW: per-activity TRIP-BOOKED count
      {
        $lookup: {
          from: "tblactivityrequest",
          let: { actID: "$ActivityID" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$ActivityID", "$$actID"] },
                    { $eq: ["$actRequestStatus", "TRIP-BOOKED"] },
                  ],
                },
              },
            },
          ],
          as: "proposalRequests",
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
                  process.env.VendorImageUrl, "/",
                  { $replaceOne: { input: "$vendorInfo.vdrImageName", find: "^/", replacement: "" } },
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
                  process.env.ActivityImageUrl, "/",
                  { $replaceOne: { input: "$actImageName1", find: "^/", replacement: "" } },
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
                    process.env.ActivityImageUrl, "/",
                    { $replaceOne: { input: "$actImageName1", find: "^/", replacement: "" } },
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
                    process.env.ActivityImageUrl, "/",
                    { $replaceOne: { input: "$actImageName2", find: "^/", replacement: "" } },
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
                    process.env.ActivityImageUrl, "/",
                    { $replaceOne: { input: "$actImageName3", find: "^/", replacement: "" } },
                  ],
                },
                else: null,
              },
            },
          ],

          // Embed the per-activity summary JSON
          "TRIP-BOOKED": {
            totalProposalCreatd: { $size: "$proposalRequests" }
          },
        },
      },

      // OPTIONAL: If you want to forcibly remove the temp arrays before projection,
      // uncomment this $unset stage (available in MongoDB 4.2+)
      // { $unset: ["proposalRequests", "categoryInfo", "vendorInfo", "cityInfo"] },

      // FINAL: Inclusion-only projection (no exclusions here!)
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
          "TRIP-BOOKED": 1,
          actOrderID:1,
        },
      }
    );

    const activity = await activityCollection.aggregate(pipeline).toArray();

    const countFilter = { actStatus: { $in: ['APPROVED', 'WAITING-FOR-APPROVAL'] } };
    const totalCount = await activityCollection.countDocuments(countFilter);

    return res.status(200).json({
      ok: true,
      message: "activity found.",
      totalCount,
      data: activity
    });
  } catch (error) {
    console.error("Error in getAllactivityList:", error);
    next(error);
  }
};
exports.activityList = async (req, res, next) => {
  try {
    const db = await connectToMongoDB();
    const activityCollection = db.collection("tblactivityinfo");

    const pipeline = [];

    // Always approved; VendorID filter removed
    const match = {
      actStatus: { $in: ['APPROVED', 'WAITING-FOR-APPROVAL', 'PENDING'] }
    };
    pipeline.push({ $match: match });

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

      // Per-activity TRIP-BOOKED count
      {
        $lookup: {
          from: "tblactivityrequest",
          let: { actID: "$ActivityID" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$ActivityID", "$$actID"] },
                    { $eq: ["$actRequestStatus", "TRIP-BOOKED"] },
                  ],
                },
              },
            },
          ],
          as: "proposalRequests",
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
                  process.env.VendorImageUrl, "/",
                  { $replaceOne: { input: "$vendorInfo.vdrImageName", find: "^/", replacement: "" } },
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
                  process.env.ActivityImageUrl, "/",
                  { $replaceOne: { input: "$actImageName1", find: "^/", replacement: "" } },
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
                    process.env.ActivityImageUrl, "/",
                    { $replaceOne: { input: "$actImageName1", find: "^/", replacement: "" } },
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
                    process.env.ActivityImageUrl, "/",
                    { $replaceOne: { input: "$actImageName2", find: "^/", replacement: "" } },
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
                    process.env.ActivityImageUrl, "/",
                    { $replaceOne: { input: "$actImageName3", find: "^/", replacement: "" } },
                  ],
                },
                else: null,
              },
            },
          ],

          // Embedded TRIP-BOOKED summary
          "TRIP-BOOKED": {
            totalProposalCreatd: { $size: "$proposalRequests" }
          },
        },
      },

      // Final projection
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
          "TRIP-BOOKED": 1,
          actOrderID: 1,
        },
      }
    );

    const activity = await activityCollection.aggregate(pipeline).toArray();

    const countFilter = { actStatus: { $in: ['APPROVED', 'WAITING-FOR-APPROVAL', 'PENDING'] } };
    const totalCount = await activityCollection.countDocuments(countFilter);

    return res.status(200).json({
      ok: true,
      message: "activity found.",
      totalCount,
      data: activity
    });
  } catch (error) {
    console.error("Error in getAllactivityList:", error);
    next(error);
  }
};

 exports.deleteActivity = async (req, res, next) => {
  try {
    const { ActivityID, VendorID, DeletedByID } = req.body;

    if (!ActivityID || !VendorID) {
      return res
        .status(400)
        .json({ message: "ActivityID and VendorID are required." });
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

    // Identify deleter (no DeletedByName)
    const deleterId = DeletedByID || req.user?.UserID || VendorID;

    // ---------- 0) Ownership check + compute IsDelete ----------
    const activityRow = await activityCollection.findOne({ ActivityID, VendorID });
    if (!activityRow) {
      return res
        .status(404)
        .json({ success: false, message: "Activity not found for this Vendor or already deleted." });
    }

    // IsDelete = "true" when actStatus is PENDING or DRAFT, else "false"
    const normActStatus = (activityRow?.actStatus ?? "").toString().trim().toUpperCase();
    const isDeleteBool = normActStatus === "PENDING" || normActStatus === "DRAFT";
    const IsDelete = isDeleteBool ? "true" : "false";

    if (!isDeleteBool) {
      // Block deletion
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

    // ---------- Helpers: log -> delete ----------
    const logDocs = async (tableName, docs, context = {}) => {
      if (!docs || docs.length === 0) return 0;
      const now = new Date();
      const payload = docs.map((doc) => ({
        tableName,
        deletedAt: now,
        // Always present
        ActivityID,
        VendorID,
        DeletedByID: String(deleterId),
        // Keep entire record for audit
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

    const logAndDeleteOne = async (collection, tableName, filter, context = {}) => {
      const doc = await collection.findOne(filter);
      if (!doc) {
        return { collection: tableName, matched: 0, logged: 0, deleted: 0 };
      }
      const loggedCount = await logDocs(tableName, [doc], context);
      const delRes = await collection.deleteOne({ _id: doc._id });
      return {
        collection: tableName,
        matched: 1,
        logged: loggedCount,
        deleted: delRes.deletedCount || 0,
      };
    };

    // ---------- 1) Delete the root activity row (must match VendorID) ----------
    const activityDelete = await logAndDeleteOne(
      activityCollection,
      "tblactivityinfo",
      { ActivityID, VendorID },
      { ActivityID }
    );

    if (activityDelete.deleted === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Activity not found for this Vendor or already deleted." });
    }

    // ---------- 2) Direct ActivityID-based deletes ----------
    const directDeletes = await Promise.all([
      logAndDeleteMany(priceCollection,        "tblactpriceinfo",         { ActivityID }, { ActivityID }),
      logAndDeleteMany(availCollection,        "tblactavaildayshours",    { ActivityID }, { ActivityID }),
      logAndDeleteMany(foodCollection,         "tblactfoodinfo",          { ActivityID }, { ActivityID }),
      logAndDeleteMany(schReqPriceCollection,  "tblschrequestpriceinfo",  { ActivityID }, { ActivityID }),
      logAndDeleteMany(schReqFoodCollection,   "tblschrequestfoodinfo",   { ActivityID }, { ActivityID }),
      logAndDeleteMany(notificationCollection, "tblnotification",         { ActivityID }, { ActivityID }),
    ]);

    // ---------- 3) Get RequestIDs for this Activity ----------
    const reqDocs = await actRequestCollection.find({ ActivityID }).toArray();
    const requestIds = reqDocs.map((d) => d.RequestID).filter(Boolean);

    // Delete tblactivityrequest using BOTH ActivityID and RequestID
    const actReqDelete = await logAndDeleteMany(
      actRequestCollection,
      "tblactivityrequest",
      { ActivityID, ...(requestIds.length ? { RequestID: { $in: requestIds } } : { RequestID: { $in: [] } }) },
      { ActivityID, requestIds }
    );

    // ---------- 4) Cascade by RequestID ----------
    let cascadeDeletes = [];
    if (requestIds.length > 0) {
      const reqFilter = { RequestID: { $in: requestIds } };

      cascadeDeletes = await Promise.all([
        logAndDeleteMany(payCollection,           "tblBookTripPayInfo",        reqFilter, { ActivityID, requestIds }),
        logAndDeleteMany(parentsCollection,       "tblBookTripParentsInfo",    reqFilter, { ActivityID, requestIds }),
        logAndDeleteMany(kidsCollection,          "tblBookTripKidsInfo",       reqFilter, { ActivityID, requestIds }),
        logAndDeleteMany(kidsFoodIncCollection,   "tblBookKidsFoodIncluded",   reqFilter, { ActivityID, requestIds }),
        logAndDeleteMany(kidsFoodExtraCollection, "tblBookKidsFoodExtra",      reqFilter, { ActivityID, requestIds }),
      ]);
    }

    // ---------- Summary ----------
    const summary = [
      activityDelete,
      ...directDeletes,
      actReqDelete,
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
      IsDelete: "true",
      message: "Activity and related data deleted successfully (each record logged to tbldeletereclog).",
      deletedSummary: summary,
      deleter: { id: String(deleterId) },
      context: { ActivityID, VendorID, requestIds, normActStatus },
    });
  } catch (error) {
    console.error("Error in deleteActivity:", error);
    next(error);
  }
};
// POST /admindata/activityinfo/activity/changeorder
exports.changeorder = async (req, res, next) => {
  try {
    const db = await connectToMongoDB()
    const coll = db.collection('tblactivityinfo')

    // Accept either { items:[{ActivityID,OrderID},...] } or single {ActivityID,OrderID}
    const items = Array.isArray(req.body?.items) ? req.body.items : [req.body]

    const ops = items
      .filter(x => x && x.ActivityID && x.OrderID !== undefined)
      .map(({ ActivityID, OrderID }) => ({
        updateOne: {
          filter: { ActivityID: String(ActivityID) },
          update: { $set: { actOrderID: Number(OrderID), UpdatedDate: new Date() } },
          upsert: false,
        },
      }))

    if (!ops.length) return res.status(400).json({ success: false, message: 'No valid items' })

    const r = await coll.bulkWrite(ops, { ordered: false })
    return res.json({
      success: true,
      message: 'Order ID updated',
      matchedCount: r.matchedCount || 0,
      modifiedCount: r.modifiedCount || 0,
    })
  } catch (err) {
    next(err)
  }
}
