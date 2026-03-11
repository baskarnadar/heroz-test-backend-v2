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

exports.getvdrsummary = async (req, res, next) => {
  try {
    const db = await connectToMongoDB();
    const { VendorID } = req.body;

    if (!VendorID) {
      return res.status(400).json({ message: "VendorID is required." });
    }

    const today = new Date().toISOString().split("T")[0];

    // Aggregation pipeline for activity stats
    const pipeline = [
      {
        $match: { VendorID }
      },
      {
        $facet: {
          TotalActivity: [{ $count: "count" }],
          TotalApproved: [
            { $match: { actRequestStatus: "APPROVED" } },
            { $count: "count" }
          ],
          TotalPending: [
            { $match: { actRequestStatus: "WAITING-FOR-APPROVAL" } },
            { $count: "count" }
          ],
          TotalRejected: [
            { $match: { actRequestStatus: "REJECTED" } },
            { $count: "count" }
          ],
          TotalProposalCreated: [
            { $match: { actRequestStatus: "TRIP-BOOKED" } },
            { $count: "count" }
          ],
            totalCompletedTrip: [
            { $match: { actRequestStatus: "COMPLETED" } },
            { $count: "count" }
          ],
            totalCompletedTrip: [
            { $match: { actRequestStatus: "CANCELLED" } },
            { $count: "count" }
          ],
          TotalTodayTrip: [
            {
              $match: {
                actRequestStatus: "TRIP-BOOKED",
                actRequestDate: today
              }
            },
            { $count: "count" }
          ]
        }
      },
      {
        $project: {
          TotalActivity: { $ifNull: [{ $arrayElemAt: ["$TotalActivity.count", 0] }, 0] },
          TotalApproved: { $ifNull: [{ $arrayElemAt: ["$TotalApproved.count", 0] }, 0] },
          TotalPending: { $ifNull: [{ $arrayElemAt: ["$TotalPending.count", 0] }, 0] },
          TotalRejected: { $ifNull: [{ $arrayElemAt: ["$TotalRejected.count", 0] }, 0] },
             totalCompletedTrip: { $ifNull: [{ $arrayElemAt: ["$totalCompletedTrip.count", 0] }, 0] },
          TotalProposalCreated: { $ifNull: [{ $arrayElemAt: ["$TotalProposalCreated.count", 0] }, 0] },
          TotalTodayTrip: { $ifNull: [{ $arrayElemAt: ["$TotalTodayTrip.count", 0] }, 0] }
        }
      }
    ];

    const activityStats = await db.collection("tblactivityrequest").aggregate(pipeline).toArray();

    // Get RequestIDs for TRIP-BOOKED
    const proposalRequests = await db.collection("tblactivityrequest")
      .find({ VendorID, actRequestStatus: "TRIP-BOOKED" })
      .project({ RequestID: 1 })
      .toArray();

    const requestIDs = proposalRequests.map(item => item.RequestID);

    let totalFood = 0;
    let totalPrice = 0;

    if (requestIDs.length > 0) {
      const foodResult = await db.collection("tblschrequestfoodinfo").aggregate([
        { $match: { RequestID: { $in: requestIDs } } },
        { $group: { _id: null, total: { $sum: "$FoodSchoolPrice" } } }
      ]).toArray();

      const priceResult = await db.collection("tblschrequestpriceinfo").aggregate([
        { $match: { RequestID: { $in: requestIDs } } },
        { $group: { _id: null, total: { $sum: "$SchoolPrice" } } }
      ]).toArray();

      totalFood = foodResult[0]?.total || 0;
      totalPrice = priceResult[0]?.total || 0;
    }

    const TotalPayableSchoolAmount = totalFood + totalPrice;

    res.status(200).json({
      status: "success",
      data: {
        ...activityStats[0],
        TotalPayableSchoolAmount
      }
    });

  } catch (error) {
    console.error("Error in getActivityTotals:", error);
    next(error);
  }
};
