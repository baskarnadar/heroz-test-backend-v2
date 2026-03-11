const { connectToMongoDB } = require("../../../database/mongodb");
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
  });
}

 // dashboard.controller.js

 exports.getDashboardSummary = async (req, res, next) => {
  try {
    console.log('Received request body:', req.body);

    const { VendorID } = req.body;
    if (!VendorID) {
      return res.status(400).json({ success: false, message: "VendorID is required" });
    }
    console.log('VendorID:', VendorID);

    const db = await connectToMongoDB();
    console.log('Connected to DB');

    const activityCollection = db.collection("tblactivityinfo");

    const totalActivities = await activityCollection.countDocuments({ VendorID: VendorID });
    console.log('totalActivities:', totalActivities);

    const [
      totalWaitingForApproval,
      totalApproved,
      totalPending,
      totalRejected,
    ] = await Promise.all([
      activityCollection.countDocuments({ VendorID: VendorID, actStatus: "WAITING-ADMIN-APPROVAL" }),
      activityCollection.countDocuments({ VendorID: VendorID, actStatus: "APPROVED" }),
      activityCollection.countDocuments({ VendorID: VendorID, actStatus: "PENDING" }),
      activityCollection.countDocuments({ VendorID: VendorID, actStatus: "REJECTED" }),
    ]);
    console.log('Counts by status:', {
      totalWaitingForApproval,
      totalApproved,
      totalPending,
      totalRejected,
    });

    const result = {
      TotalActivity: totalActivities,        // <-- renamed here
      totalWaitingForApproval,
      TotalApproved: totalApproved,
      TotalPending: totalPending,
      TotalRejected: totalRejected,
    };

    console.log('Sending response with result:', result);

    res.status(200).json({
      success: true,
      message: "Vendor info and activity stats found.",
      data: result,
      statusCode: 200,
    });
  } catch (error) {
    console.error("Error in getDashboardSummary:", error);
    next(error);
  }
};
 // controllers/dashboard.js
// Assumes you have: const { connectToMongoDB } = require('../db/mongo');

 // controllers/dashboard.js
// controllers/dashboard.js
exports.getdashboardtotal = async (req, res, next) => {
  try {
    const db = await connectToMongoDB();

    // Collections
    const kidsCollection     = db.collection("tblBookTripKidsInfo");
    const parentsCollection  = db.collection("tblBookTripParentsInfo");
    const activityCollection = db.collection("tblactivityinfo");
    const requestCollection  = db.collection("tblactivityrequest");

    // Parallel counts
    const [
      totalKids,
      totalParents,
      totalActivity,
      totalApproved,
      totalRejected,
      totalWaitingForApproval,
      totalTripBooked,
      totalCompleted
    ] = await Promise.all([
      kidsCollection.countDocuments({}),
      parentsCollection.countDocuments({}),
      activityCollection.countDocuments({}),
      requestCollection.countDocuments({ actRequestStatus: "APPROVED" }),
      requestCollection.countDocuments({ actRequestStatus: "REJECTED" }),
      requestCollection.countDocuments({ actRequestStatus: "WAITING-FOR-APPROVAL" }),
      requestCollection.countDocuments({ actRequestStatus: "TRIP-BOOKED" }),
      requestCollection.countDocuments({ actRequestStatus: "COMPLETED" }),
      requestCollection.countDocuments({ actRequestStatus: "CANCELLED" }),
    ]);

    // Response structure
    const result = {
      totalKids,
      totalParents,
      totalActivity,
      totalApproved,
      totalRejected,
      totalWaitingForApproval,
      totalTripBooked,
      totalCompleted,
    };

    return res.status(200).json({
      success: true,
      message: "Dashboard totals fetched successfully.",
      data: result,
      statusCode: 200,
    });

  } catch (error) {
    console.error("Error in getdashboardtotal:", error);
    return next(error);
  }
};


exports.getdashboardPaySummary = async (req, res, next) => {
  try {
    const db = await connectToMongoDB();
    const payCollection = db.collection("tblBookTripPayInfo");

    const summary = await payCollection
      .aggregate([
        // ✅ 1) Filter approved payments only
        { $match: { PayStatus: "APPROVED" } },

        // ✅ 2) Add Month and Year fields extracted from PayDate
        {
          $addFields: {
            PayMonth: { $month: { $toDate: "$PayDate" } },
            PayYear: { $year: { $toDate: "$PayDate" } },
          },
        },

        // 3) Group by RequestID and sum amounts
        {
          $group: {
            _id: "$RequestID",
            totalFullAmount: { $sum: { $ifNull: ["$TripFullAmount", 0] } },
            totalVendorAmount: { $sum: { $ifNull: ["$TripVendorCost", 0] } },
            totalHerozAmount: { $sum: { $ifNull: ["$TripHerozCost", 0] } },
            totalSchoolAmount: { $sum: { $ifNull: ["$TripSchoolPrice", 0] } },
            countPayments: { $sum: 1 },
            PayMonth: { $first: "$PayMonth" },
            PayYear: { $first: "$PayYear" },
          },
        },

        // 4) Add RequestID field
        { $set: { RequestID: "$_id" } },
        { $unset: "_id" },

        // 5) Join tblactivityrequest to get ActivityID
        {
          $lookup: {
            from: "tblactivityrequest",
            localField: "RequestID",
            foreignField: "RequestID",
            as: "req",
          },
        },
        { $unwind: { path: "$req", preserveNullAndEmptyArrays: true } },
        { $set: { ActivityID: "$req.ActivityID" } },

        // 6) Join tblactivityinfo to get actName
        {
          $lookup: {
            from: "tblactivityinfo",
            localField: "ActivityID",
            foreignField: "ActivityID",
            as: "act",
          },
        },
        { $unwind: { path: "$act", preserveNullAndEmptyArrays: true } },
        { $set: { actName: "$act.actName" } },

        // 7) Cleanup
        { $unset: ["req", "act"] },

        // 8) Sort optional
        { $sort: { PayYear: -1, PayMonth: -1, totalFullAmount: -1 } },
      ])
      .toArray();

    // ✅ Calculate overall totals
    const overallTotals = summary.reduce(
      (acc, cur) => {
        acc.totalFullAmount += cur.totalFullAmount || 0;
        acc.totalVendorAmount += cur.totalVendorAmount || 0;
        acc.totalHerozAmount += cur.totalHerozAmount || 0;
        acc.totalSchoolAmount += cur.totalSchoolAmount || 0;
        return acc;
      },
      {
        totalFullAmount: 0,
        totalVendorAmount: 0,
        totalHerozAmount: 0,
        totalSchoolAmount: 0,
      }
    );

    res.status(200).json({
      success: true,
      message:
        "Approved payment summary by RequestID with ActivityID, actName, and PayDate (Month/Year) fetched successfully.",
      totalRequests: summary.length,
      overallTotals,
      data: summary,
      statusCode: 200,
    });
  } catch (error) {
    console.error("Error in getdashboardPaySummary:", error);
    next(error);
  }
};
