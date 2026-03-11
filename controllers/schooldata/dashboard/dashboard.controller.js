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

 
exports.getschsummary = async (req, res, next) => {
  try {
    const db = await connectToMongoDB();
    const { SchoolID } = req.body;

    if (!SchoolID) {
      return res.status(400).json({ message: "SchoolID is required." });
    }

    const today = new Date().toISOString().split("T")[0];

    // Aggregation pipeline for activity stats
    const pipeline = [
      {
        $match: { SchoolID }
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
           totalCompletedTrip: [
            { $match: { actRequestStatus: "COMPLETED" } },
            { $count: "count" }
          ],
          
           totalCancelledTrip: [
            { $match: { actRequestStatus: "CANCELLED" } },
            { $count: "count" }
          ],
          TotalProposalCreated: [
            { $match: { actRequestStatus: "TRIP-BOOKED" } },
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
            TotalCancelled: { $ifNull: [{ $arrayElemAt: ["$totalCancelledTrip.count", 0] }, 0] },
           totalCompletedTrip: { $ifNull: [{ $arrayElemAt: ["$totalCompletedTrip.count", 0] }, 0] },
          TotalProposalCreated: { $ifNull: [{ $arrayElemAt: ["$TotalProposalCreated.count", 0] }, 0] },
          TotalTodayTrip: { $ifNull: [{ $arrayElemAt: ["$TotalTodayTrip.count", 0] }, 0] }
        }
      }
    ];

    const activityStats = await db.collection("tblactivityrequest").aggregate(pipeline).toArray();

    // Get RequestIDs for TRIP-BOOKED
    const proposalRequests = await db.collection("tblactivityrequest")
      .find({ SchoolID, actRequestStatus: "TRIP-BOOKED" })
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


