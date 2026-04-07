// controllers/membership/booking/booking.controller.js
const { connectToMongoDB } = require("../../../database/mongodb");
const { generateUniqueId,GetRefNo } = require("../../../controllers/operation/operation");

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
  
exports.cancelbooking = async (req, res, next) => {
  try {

    // =========================================================
    // ✅ Read Required Fields
    // =========================================================
    const BookingID = String(req.body?.BookingID ?? "").trim();
    const BookingParentsID = String(req.body?.BookingParentsID ?? "").trim();
    const BookingCancelReason = String(req.body?.BookingCancelReason ?? "").trim();

    // =========================================================
    // ✅ Validate Required Fields
    // =========================================================
    if (!BookingID) {
      return sendResponse(
        res,
        "BookingID1 is required.",
        "BookingID2 is required.",
        [],
        0
      );
    }

    if (!BookingParentsID) {
      return sendResponse(
        res,
        "BookingParentsID is required.",
        "BookingParentsID is required.",
        [],
        0
      );
    }

    // =========================================================
    // ✅ DB Connection
    // =========================================================
    const db = await connectToMongoDB();
    const collection = db.collection("tblMemShipBookingInfo");

    const now = new Date();

    // =========================================================
    // ✅ Update Booking
    // =========================================================
    const updateResult = await collection.updateOne(
      {
        $expr: {
          $eq: [
            { $trim: { input: { $toString: "$BookingID" }, chars: " ," } },
            BookingID,
          ],
        },
      },
      {
        $set: {
          BookingStatus: "CANCELED",
          ModifyDate: now,
          ModifyBy: BookingParentsID,
          BookingCancelReason: BookingCancelReason,
        },
      }
    );

    // =========================================================
    // ✅ If Booking Not Found
    // =========================================================
    if (!updateResult.matchedCount) {
      return sendResponse(
        res,
        "Booking not found.",
        "Booking not found.",
        [],
        0
      );
    }

    // =========================================================
    // ✅ Fetch Updated Record
    // =========================================================
    const updatedBooking = await collection.findOne(
      {
        $expr: {
          $eq: [
            { $trim: { input: { $toString: "$BookingID" }, chars: " ," } },
            BookingID,
          ],
        },
      },
      {
        projection: { _id: 0 },
      }
    );

    // =========================================================
    // ✅ Success Response
    // =========================================================
    return sendResponse(
      res,
      "Booking cancelled successfully.",
      null,
      updatedBooking ? [updatedBooking] : [],
      1
    );

  } catch (error) {
    console.error("Error in cancelbooking:", error);
    next(error);
  }
};
 exports.getbookinglist = async (req, res, next) => {
  try {
    const page = Math.max(parseInt(req.body?.page ?? 1, 10), 1);
    const limit = Math.max(parseInt(req.body?.limit ?? 10, 10), 1);
    const skip = (page - 1) * limit;

    const BookingParentsID = String(req.body?.BookingParentsID ?? "").trim();
    const BookingStatus = String(req.body?.BookingStatus ?? "").trim();

    const db = await connectToMongoDB();
    const collection = db.collection("tblMemShipBookingInfo");

    const QRCode = require("qrcode");

    const matchStage = {};
    if (BookingParentsID) matchStage.BookingParentsID = BookingParentsID;
    if (BookingStatus) matchStage.BookingStatus = BookingStatus;

    const rawActBaseUrl = String(process.env.ActivityImageUrl || "");
    const baseActivityImageUrl = rawActBaseUrl.endsWith("/")
      ? rawActBaseUrl
      : rawActBaseUrl + "/";

    const rawVendorBaseUrl = String(process.env.VendorImageUrl || "");
    const baseVendorImageUrl = rawVendorBaseUrl.endsWith("/")
      ? rawVendorBaseUrl
      : rawVendorBaseUrl + "/";

    const pipeline = [
      ...(Object.keys(matchStage).length ? [{ $match: matchStage }] : []),

      { $sort: { BookingDate: -1, CreatedDate: -1, _id: -1 } },

      // ✅ Parent info
      {
        $lookup: {
          from: "tblMemRegInfo",
          let: { pid: "$BookingParentsID" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: [
                    { $trim: { input: { $toString: "$prtuserid" }, chars: " ," } },
                    { $trim: { input: { $toString: "$$pid" }, chars: " ," } },
                  ],
                },
              },
            },
            { $sort: { CreatedDate: -1, UpdatedAt: -1, _id: -1 } },
            {
              $project: {
                _id: 0,
                RegUserFullName: 1,
                RegUserEmailAddress: 1,
                RegUserMobileNo: 1,
                RegUserImageName: 1,
              },
            },
            { $limit: 1 },
          ],
          as: "ParentsInfo",
        },
      },

      // ✅ Kid info
      {
        $lookup: {
          from: "tblMemKidsInfo",
          let: { kid: "$BookingKidsID" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: [
                    { $trim: { input: { $toString: "$KidsID" }, chars: " ," } },
                    { $trim: { input: { $toString: "$$kid" }, chars: " ," } },
                  ],
                },
              },
            },
            { $sort: { CreatedDate: -1, UpdatedAt: -1, _id: -1 } },
            {
              $project: {
                _id: 0,
                KidsID: 1,
                KidsName: 1,
                KidsClassName: 1,
                KidsSchoolName: 1,
                KidsDateOfBirth: 1,
                KidsAdditionalNote: 1,
                KidsImageName: 1,
              },
            },
            { $limit: 1 },
          ],
          as: "KidsInfo",
        },
      },

      // ✅ Full activity info using BookingActivityID -> tblactivityinfo.ActivityID
      {
        $lookup: {
          from: "tblactivityinfo",
          let: { aid: "$BookingActivityID" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: [
                    { $trim: { input: { $toString: "$ActivityID" }, chars: " ," } },
                    { $trim: { input: { $toString: "$$aid" }, chars: " ," } },
                  ],
                },
              },
            },
            { $sort: { CreatedDate: -1, UpdateDate: -1, _id: -1 } },
            {
              $project: {
                _id: 0,
              },
            },
            { $limit: 1 },
          ],
          as: "ActivityInfo",
        },
      },

      // ✅ Vendor info
      {
        $lookup: {
          from: "tblvendorinfo",
          let: { vid: "$BookingVendorID" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: [
                    { $trim: { input: { $toString: "$VendorID" }, chars: " ," } },
                    { $trim: { input: { $toString: "$$vid" }, chars: " ," } },
                  ],
                },
              },
            },
            { $sort: { CreatedDate: -1, UpdateDate: -1, _id: -1 } },
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

      // ✅ Available Time
      {
        $lookup: {
          from: "tblactavaildayshours",
          let: {
            activityId: "$BookingActivityID",
            vendorId: "$BookingVendorID",
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    {
                      $eq: [
                        { $trim: { input: { $toString: "$ActivityID" }, chars: " ," } },
                        { $trim: { input: { $toString: "$$activityId" }, chars: " ," } },
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
          let: { activityId: "$BookingActivityID" },
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

      // ✅ Flatten objects
      {
        $addFields: {
          ParentsInfo: { $ifNull: [{ $arrayElemAt: ["$ParentsInfo", 0] }, {}] },
          KidsInfo: { $ifNull: [{ $arrayElemAt: ["$KidsInfo", 0] }, {}] },
          ActivityInfo: { $ifNull: [{ $arrayElemAt: ["$ActivityInfo", 0] }, {}] },
          VendorInfo: { $ifNull: [{ $arrayElemAt: ["$VendorInfo", 0] }, {}] },
          ActivityRequestInfo: { $ifNull: [{ $arrayElemAt: ["$ActivityRequestInfo", 0] }, {}] },
        },
      },

      // ✅ Merge activity fields into root
      {
        $replaceRoot: {
          newRoot: {
            $mergeObjects: ["$$ROOT", "$ActivityInfo"],
          },
        },
      },

      // ✅ Add same JSON style fields
      {
        $addFields: {
          BookingType: "MEMBERSHIP",

          actImageName1Url: {
            $cond: [
              {
                $and: [
                  { $ne: ["$actImageName1", null] },
                  { $ne: ["$actImageName1", ""] },
                ],
              },
              { $concat: [baseActivityImageUrl, "$actImageName1"] },
              "",
            ],
          },
          actImageName2Url: {
            $cond: [
              {
                $and: [
                  { $ne: ["$actImageName2", null] },
                  { $ne: ["$actImageName2", ""] },
                ],
              },
              { $concat: [baseActivityImageUrl, "$actImageName2"] },
              "",
            ],
          },
          actImageName3Url: {
            $cond: [
              {
                $and: [
                  { $ne: ["$actImageName3", null] },
                  { $ne: ["$actImageName3", ""] },
                ],
              },
              { $concat: [baseActivityImageUrl, "$actImageName3"] },
              "",
            ],
          },

          actRequestRefNo: {
            $trim: {
              input: {
                $toString: {
                  $ifNull: ["$ActivityRequestInfo.actRequestRefNo", ""],
                },
              },
              chars: " ,",
            },
          },

          vdrName: { $ifNull: ["$VendorInfo.vdrName", ""] },
          vdrClubName: { $ifNull: ["$VendorInfo.vdrClubName", ""] },
          vdrMobileNo1: { $ifNull: ["$VendorInfo.vdrMobileNo1", ""] },
          vdrImageName: { $ifNull: ["$VendorInfo.vdrImageName", ""] },

          vdrImageNameUrl: {
            $let: {
              vars: {
                img: { $ifNull: ["$VendorInfo.vdrImageName", ""] },
              },
              in: {
                $cond: [
                  {
                    $and: [
                      { $ne: ["$$img", null] },
                      { $ne: ["$$img", ""] },
                    ],
                  },
                  { $concat: [baseVendorImageUrl, "$$img"] },
                  "",
                ],
              },
            },
          },

          RegUserFullName: { $ifNull: ["$ParentsInfo.RegUserFullName", ""] },
          RegUserEmailAddress: { $ifNull: ["$ParentsInfo.RegUserEmailAddress", ""] },
          RegUserMobileNo: { $ifNull: ["$ParentsInfo.RegUserMobileNo", ""] },
          RegUserImageName: { $ifNull: ["$ParentsInfo.RegUserImageName", ""] },

          KidsID: { $ifNull: ["$KidsInfo.KidsID", ""] },
          KidsName: { $ifNull: ["$KidsInfo.KidsName", ""] },
          KidsClassName: { $ifNull: ["$KidsInfo.KidsClassName", ""] },
          KidsSchoolName: { $ifNull: ["$KidsInfo.KidsSchoolName", ""] },
          KidsDateOfBirth: { $ifNull: ["$KidsInfo.KidsDateOfBirth", ""] },
          KidsAdditionalNote: { $ifNull: ["$KidsInfo.KidsAdditionalNote", ""] },
          KidsImageName: { $ifNull: ["$KidsInfo.KidsImageName", ""] },

          TotalStarForParents: "$TotalStarForParents",
          StarValue: "$StarValue",
        },
      },

      // ✅ Remove temp objects / unwanted fields
      {
        $unset: [
          "_id",
          "ParentsInfo",
          "KidsInfo",
          "ActivityInfo",
          "VendorInfo",
          "ActivityRequestInfo",
          "TotalStarValue",
        ],
      },

      // ✅ Paging + count
      {
        $facet: {
          data: [{ $skip: skip }, { $limit: limit }],
          totalCount: [{ $count: "count" }],
        },
      },
    ];

    const result = await collection.aggregate(pipeline).toArray();

    let data = result[0]?.data || [];
    const totalCount = result[0]?.totalCount?.[0]?.count || 0;

    // ✅ Add AvailableDay + QR JSON result to each row
    data = await Promise.all(
      data.map(async (a) => {
        const times = Array.isArray(a.AvalilableTime) ? a.AvalilableTime : [];
        const days = [];

        for (const t of times) {
          const dn = String(t?.DayName ?? "").trim().toLowerCase();
          if (dn && !days.includes(dn)) days.push(dn);
        }

        const qrPayloadObject = {
          BookingID: String(a?.BookingID ?? "").trim(),
          BookingRequestID: String(a?.BookingRequestID ?? "").trim(),
          BookingParentsID: String(a?.BookingParentsID ?? "").trim(),
          BookingActivityID: String(a?.BookingActivityID ?? "").trim(),
          BookingVendorID: String(a?.BookingVendorID ?? "").trim(),
        };

        const qrPayload = JSON.stringify(qrPayloadObject);

        let qrDataUrl = "";
        try {
          qrDataUrl = await QRCode.toDataURL(qrPayload, {
            errorCorrectionLevel: "M",
            margin: 1,
            width: 300,
          });
        } catch (qrErr) {
          console.error("QR generation failed for booking:", a?.BookingID, qrErr);
          qrDataUrl = "";
        }

        return {
          ...a,
          AvailableDay: days.join(", "),
          BookingQRInfo: {
            BookingID: qrPayloadObject.BookingID,
            BookingRequestID: qrPayloadObject.BookingRequestID,
            BookingParentsID: qrPayloadObject.BookingParentsID,
            BookingActivityID: qrPayloadObject.BookingActivityID,
            BookingVendorID: qrPayloadObject.BookingVendorID,
            qrDataUrl,
          },
        };
      })
    );

    return sendResponse(res, "booking list found.", null, data, totalCount);
  } catch (error) {
    console.error("Error in getbookinglist:", error);
    next(error);
  }
};
 exports.addBooking = async (req, res, next) => {
  try {
    const db = await connectToMongoDB()

    const reqParentsID = String(req.body?.ParentsID ?? '').trim()
    if (!reqParentsID) {
      return sendResponse(res, 'ParentsID is required.', 'ParentsID is required', [], 0)
    }

    const BookingID = GetRefNo();

    console.log("BookingID");
    console.log(BookingID);

    const PurchasedBookingID = String(req.body?.PurchasedBookingID ?? '').trim()  

    const insertResult = {
      insertedMembership: false,
      insertedLedger: false,
      membershipId: null,
      ledgerId: null,
    }

    const now = new Date()

    // =========================================================
    // ✅ INSERT MEMBERSHIP BOOKING
    // =========================================================
    let insertedBookingSnapshot = null
    const membershipCol = db.collection('tblMemShipBookingInfo')

    const BookMembershipInfoIDVal =  generateUniqueId(); 
    const BookingRequestID =  generateUniqueId();
    const BookingParentsID = String(req.body?.BookingParentsID ).trim()
    const BookingKidsID = String(req.body?.BookingKidsID).trim()

    const BookingStarPerKids = Number(req.body?.BookingStarPerKids)
    const BookingVendorID = String(req.body?.BookingVendorID ).trim()
    const BookingActivityID = String(req.body?.BookingActivityID ).trim()

    const BookingActivityDate = String(req.body?.BookingActivityDate ).trim()
    const BookingActivityTime = String(req.body?.BookingActivityTime ).trim()

    const BookingDate = String(req.body?.BookingDate ?? '').trim()
    const CreatedBy = String(req.body?.CreatedBy ?? '').trim() || 'system'

    if (!BookingID) return sendResponse(res, 'BookingID is required for membership insert.', 'BookingID is required', [], 0)
    if (!BookingRequestID) return sendResponse(res, 'BookingRequestID is required for membership insert.', 'BookingRequestID is required', [], 0)
    if (!BookingParentsID) return sendResponse(res, 'BookingParentsID is required for membership insert.', 'BookingParentsID is required', [], 0)
    if (!BookingKidsID) return sendResponse(res, 'BookingKidsID is required for membership insert.', 'BookingKidsID is required', [], 0)

    const membershipDoc = {
      BookMembershipInfoID: generateUniqueId(),
      BookingID: BookingID,
      BookingRequestID,
      BookingParentsID,
      BookingKidsID,
      BookingStarPerKids,
      BookingVendorID,
      BookingActivityID,
      BookingActivityDate,
      BookingActivityTime,
      BookingDate,
      BookingStatus: "BOOKED",
      CreatedDate: now,
      CreatedBy,
    }

    Object.keys(membershipDoc).forEach((k) => membershipDoc[k] === undefined && delete membershipDoc[k])

    const ins = await membershipCol.insertOne(membershipDoc)
    insertResult.insertedMembership = true
    insertResult.membershipId = membershipDoc.BookMembershipInfoID || ins?.insertedId || null

    insertedBookingSnapshot = membershipDoc

    // =========================================================
    // ✅ INSERT LEDGER
    // =========================================================
    const shouldAutoLedgerFromBooking = BookingID && !PurchasedBookingID

    if (PurchasedBookingID || shouldAutoLedgerFromBooking) {
      const ledgerCol = db.collection('tblMemShipStarLedger')

      const PurchasedStarIDRaw = generateUniqueId();
      const PurchasedParentsID = BookingParentsID ;
      const PurchasedActivityID = String(BookingActivityID).trim()
      const PurchasedKidsID = String(req.body?.PurchasedKidsID ?? insertedBookingSnapshot?.BookingKidsID ?? req.body?.KidsID ?? '').trim()
      const PurchasedRequestID = String(BookingRequestID).trim() 
      const PurchasedBookingID = String(BookingID).trim()

      const PurchasedStar = Number(req.body?.BookingStarPerKids)

      const PurchasedDateRaw = String(req.body?.PurchasedDate ?? '').trim()
      const PurchasedDate = PurchasedDateRaw ? PurchasedDateRaw : now.toISOString()

      const CreatedBy = String(req.body?.CreatedBy ?? '').trim() || 'system'

      if (!PurchasedBookingID) return sendResponse(res, 'PurchasedBookingID is required for ledger insert.', 'PurchasedBookingID is required', [], 0)
      if (!PurchasedParentsID) return sendResponse(res, 'PurchasedParentsID is required for ledger insert.', 'PurchasedParentsID is required', [], 0)
      if (!PurchasedRequestID) return sendResponse(res, 'PurchasedRequestID is required for ledger insert.', 'PurchasedRequestID is required', [], 0)
      if (!PurchasedKidsID) return sendResponse(res, 'PurchasedKidsID is required for ledger insert.', 'PurchasedKidsID is required', [], 0)

      const ledgerDoc = {
        PurchasedStarID: PurchasedStarIDRaw ? PurchasedStarIDRaw : generateUniqueId(),
        PurchasedParentsID,
        PurchasedActivityID,
        PurchasedKidsID,
        PurchasedRequestID,
        PurchasedBookingID,
        PurchasedStar,
        PurchasedDate,
        CreatedDate: now,
        CreatedBy,
      }

      Object.keys(ledgerDoc).forEach((k) => ledgerDoc[k] === undefined && delete ledgerDoc[k])

      const ins = await ledgerCol.insertOne(ledgerDoc)
      insertResult.insertedLedger = true
      insertResult.ledgerId = ledgerDoc.PurchasedStarID || ins?.insertedId || null
    }

    // =========================================================
    // ✅ LIST (NO FILTER / NO PAGINATION)
    // =========================================================
    const bookingCol = db.collection('tblBookMembershipInfo')

    const data = await bookingCol
      .find({}, { projection: { _id: 0 } })
      .sort({ CreatedDate: -1 })
      .toArray()

    const totalCount = data.length

    const message =
      insertResult.insertedMembership || insertResult.insertedLedger ? 'booking inserted.' : 'booking list fetched.'

    const responseData = {
      list: data,
      insertResult,
    }

    return sendResponse(res, message, null, responseData, totalCount)

  } catch (error) {
    console.error('Error in booking:', error)
    next(error)
  }
}
 exports.getbookingqr = async (req, res, next) => {
  try {
    // =========================================================
    // ✅ Get Required Fields Only
    // =========================================================
    const BookingID = String(req.body?.BookingID ?? '').trim()
    const BookingRequestID = String(req.body?.BookingRequestID ?? '').trim()
    const BookingParentsID = String(req.body?.BookingParentsID ?? '').trim() // ✅ ADDED
    const BookingActivityID = String(req.body?.BookingActivityID ?? '').trim()
    const BookingVendorID = String(req.body?.BookingVendorID ?? '').trim()

    // =========================================================
    // ✅ Validate Required Fields
    // =========================================================
    if (!BookingID)
      return sendResponse(res, 'BookingID is required.', 'BookingID is required', [], 0)

    if (!BookingRequestID)
      return sendResponse(res, 'BookingRequestID is required.', 'BookingRequestID is required', [], 0)

    if (!BookingParentsID)
      return sendResponse(res, 'BookingParentsID is required.', 'BookingParentsID is required', [], 0)

    if (!BookingActivityID)
      return sendResponse(res, 'BookingActivityID is required.', 'BookingActivityID is required', [], 0)

    if (!BookingVendorID)
      return sendResponse(res, 'BookingVendorID is required.', 'BookingVendorID is required', [], 0)

    // =========================================================
    // ✅ Generate QR Code
    // =========================================================
    const QRCode = require('qrcode')

    const qrPayload = JSON.stringify({
      BookingID,
      BookingRequestID,
      BookingParentsID, // ✅ ADDED
      BookingActivityID,
      BookingVendorID,
    })

    const qrDataUrl = await QRCode.toDataURL(qrPayload, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 300,
    })

    // =========================================================
    // ✅ Response
    // =========================================================
    return sendResponse(
      res,
      'QR generated successfully.',
      null,
      {
        BookingID,
        BookingRequestID,
        BookingParentsID, // ✅ ADDED
        BookingActivityID,
        BookingVendorID,
        qrDataUrl, // data:image/png;base64,...
      },
      1
    )
  } catch (error) {
    console.error('Error in getbookingqr:', error)
    next(error)
  }
}
 exports.vdrgetbookingSummary = async (req, res, next) => {
  try {
    const BookingVendorID = String(req.body?.BookingVendorID ?? "").trim()

    if (!BookingVendorID) {
      return sendResponse(res, "BookingVendorID is required.", true, null)
    }

    const db = await connectToMongoDB()
    const collection = db.collection("tblMemShipBookingInfo")

    const matchStage = { BookingVendorID }

    // =========================================================
    // ✅ Counts
    // =========================================================
    const totalCount = await collection.countDocuments(matchStage)

    const bookedCount = await collection.countDocuments({
      BookingVendorID,
      BookingStatus: "BOOKED",
    })

    const completedCount = await collection.countDocuments({
      BookingVendorID,
      BookingStatus: "COMPLETED",
    })

    // =========================================================
    // ✅ Structured Status Summary with Name field
    // =========================================================
    const statusSummary = [
      {
        Name: "BOOKED",
        BookingStatus: "BOOKED",
        Count: bookedCount,
      },
      {
        Name: "COMPLETED",
        BookingStatus: "COMPLETED",
        Count: completedCount,
      },
    ]

    return sendResponse(res, "booking summary found.", null, {
      BookingVendorID,
      totalCount,
      bookedCount,
      completedCount,
      statusSummary, // ✅ Added structured JSON with Name
    })
  } catch (error) {
    console.error("Error in vdrgetbookingSummary:", error)
    next(error)
  }
}
 
 
exports.vdrgetbookingSummaryList = async (req, res, next) => {
  try {
    // =========================================================
    // ✅ Pagination
    // =========================================================
    const page = Math.max(parseInt(req.body?.page ?? 1, 10), 1)
    const limit = Math.max(parseInt(req.body?.limit ?? 10, 10), 1)
    const skip = (page - 1) * limit

    // =========================================================
    // ✅ Required: BookingVendorID
    // =========================================================
    const BookingVendorID = String(req.body?.BookingVendorID ?? "").trim()
    if (!BookingVendorID) {
      return sendResponse(res, "BookingVendorID is required.", true, null, 0)
    }

    // =========================================================
    // ✅ Optional: BookingStatus filter (tblMemShipBookingInfo.BookingStatus)
    // =========================================================
    const BookingStatus = String(req.body?.BookingStatus ?? "").trim()

    const db = await connectToMongoDB()
    const collection = db.collection("tblMemShipBookingInfo")

    // =========================================================
    // ✅ Build match filter (Vendor required + Status optional)
    // =========================================================
    const matchStage = { BookingVendorID }
    if (BookingStatus) {
      matchStage.BookingStatus = BookingStatus
    }

    // =========================================================
    // ✅ Summary counts (statusSummary + bookedCount + completedCount)
    // =========================================================
    const statusSummaryAgg = await collection
      .aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: { $ifNull: ["$BookingStatus", ""] },
            Count: { $sum: 1 },
          },
        },
        { $sort: { Count: -1, _id: 1 } },
        {
          $project: {
            _id: 0,
            Name: "$_id",
            BookingStatus: "$_id",
            Count: 1,
          },
        },
      ])
      .toArray()

    const bookedCount =
      statusSummaryAgg.find((x) => String(x?.BookingStatus || "").toUpperCase() === "BOOKED")
        ?.Count ?? 0

    const completedCount =
      statusSummaryAgg.find((x) => String(x?.BookingStatus || "").toUpperCase() === "COMPLETED")
        ?.Count ?? 0

    const totalCount = await collection.countDocuments(matchStage)

    // =========================================================
    // ✅ Booking list pipeline (with lookups like your sample)
    // =========================================================
    const pipeline = [
      { $match: matchStage },

      // latest first
      { $sort: { BookingDate: -1, CreatedDate: -1, _id: -1 } },

      // -------------------------
      // Parents Information (ONE)
      // -------------------------
      {
        $lookup: {
          from: "tblMemRegInfo",
          let: { pid: "$BookingParentsID" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: [
                    { $trim: { input: { $toString: "$prtuserid" }, chars: " ," } },
                    { $trim: { input: { $toString: "$$pid" }, chars: " ," } },
                  ],
                },
              },
            },
            { $sort: { CreatedDate: -1, UpdatedAt: -1, _id: -1 } },
            {
              $project: {
                _id: 0,
                RegUserFullName: 1,
                RegUserEmailAddress: 1,
                RegUserMobileNo: 1,
              },
            },
            { $limit: 1 },
          ],
          as: "ParentsInfo",
        },
      },

      // -------------------------
      // Kids Information (ONE)
      // -------------------------
      {
        $lookup: {
          from: "tblMemKidsInfo",
          let: { kid: "$BookingKidsID" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: [
                    { $trim: { input: { $toString: "$KidsID" }, chars: " ," } },
                    { $trim: { input: { $toString: "$$kid" }, chars: " ," } },
                  ],
                },
              },
            },
            { $sort: { CreatedDate: -1, UpdatedAt: -1, _id: -1 } },
            {
              $project: {
                _id: 0,
                KidsName: 1,
              },
            },
            { $limit: 1 },
          ],
          as: "KidsInfo",
        },
      },

      // -------------------------
      // Activity Information (ONE)
      // -------------------------
      {
        $lookup: {
          from: "tblactivityinfo",
          let: { aid: "$BookingActivityID" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: [
                    { $trim: { input: { $toString: "$ActivityID" }, chars: " ," } },
                    { $trim: { input: { $toString: "$$aid" }, chars: " ," } },
                  ],
                },
              },
            },
            { $sort: { CreatedDate: -1, UpdateDate: -1, _id: -1 } },
            {
              $project: {
                _id: 0,
                actName: 1,
                // ✅ NEW: include TotalStarValue from tblactivityinfo
                TotalStarValue: 1,
              },
            },
            { $limit: 1 },
          ],
          as: "ActivityInfo",
        },
      },

      // -------------------------
      // Vendor Information (ONE)
      // -------------------------
      {
        $lookup: {
          from: "tblvendorinfo",
          let: { vid: "$BookingVendorID" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: [
                    { $trim: { input: { $toString: "$VendorID" }, chars: " ," } },
                    { $trim: { input: { $toString: "$$vid" }, chars: " ," } },
                  ],
                },
              },
            },
            { $sort: { CreatedDate: -1, UpdateDate: -1, _id: -1 } },
            {
              $project: {
                _id: 0,
                vdrName: 1,
              },
            },
            { $limit: 1 },
          ],
          as: "VendorInfo",
        },
      },

      // ✅ flatten lookups
      {
        $addFields: {
          ParentsInfo: { $ifNull: [{ $arrayElemAt: ["$ParentsInfo", 0] }, {}] },
          KidsInfo: { $ifNull: [{ $arrayElemAt: ["$KidsInfo", 0] }, {}] },
          ActivityInfo: { $ifNull: [{ $arrayElemAt: ["$ActivityInfo", 0] }, {}] },
          VendorInfo: { $ifNull: [{ $arrayElemAt: ["$VendorInfo", 0] }, {}] },
        },
      },

      // ✅ Pagination
      { $skip: skip },
      { $limit: limit },

      // -------------------------
      // ✅ Final Shape (includes BookingStatus)
      // -------------------------
      {
        $project: {
          _id: 0,
          BookingID: 1,
          BookingRequestID: 1,
          BookingParentsID: 1,
          BookingKidsID: 1,
          BookingStarPerKids: 1,
          BookingVendorID: 1,
          BookingActivityID: 1,
          BookingActivityDate: 1,
          BookingActivityTime: 1,
          BookingDate: 1,

          // ✅ from tblMemShipBookingInfo
          BookingStatus: { $ifNull: ["$BookingStatus", ""] },
          BookingStatusName: { $ifNull: ["$BookingStatus", ""] },

          vdrName: { $ifNull: ["$VendorInfo.vdrName", ""] },

          RegUserFullName: { $ifNull: ["$ParentsInfo.RegUserFullName", ""] },
          RegUserEmailAddress: { $ifNull: ["$ParentsInfo.RegUserEmailAddress", ""] },
          RegUserMobileNo: { $ifNull: ["$ParentsInfo.RegUserMobileNo", ""] },

          KidsName: { $ifNull: ["$KidsInfo.KidsName", ""] },

          actName: { $ifNull: ["$ActivityInfo.actName", ""] },

          // ✅ NEW: send TotalStarValue (default 0)
          TotalStarValue: { $ifNull: ["$ActivityInfo.TotalStarValue", 0] },
        },
      },
    ]

    const BookingList = await collection.aggregate(pipeline).toArray()

    // =========================================================
    // ✅ Final Response shape (data.BookingList instead of data.data)
    // =========================================================
    const payload = {
      page,
      limit,
      totalCount,
      bookedCount,
      completedCount,
      statusSummary: statusSummaryAgg,
      BookingList, // ✅ renamed from "data"
    }

    return sendResponse(res, "booking list found.", null, payload, totalCount)
  } catch (error) {
    console.error("Error in vdrgetbookingSummaryList:", error)
    next(error)
  }
}
 exports.vdrgetOneBookingOnly = async (req, res, next) => {
  try {
    const page = Math.max(parseInt(req.body?.page ?? 1, 10), 1)
    const limit = Math.max(parseInt(req.body?.limit ?? 10, 10), 1)
    const skip = (page - 1) * limit

    const BookingVendorID = String(req.body?.BookingVendorID ?? "").trim()
    if (!BookingVendorID) {
      return sendResponse(res, "BookingVendorID is required.", true, null, 0)
    }

    const BookingID = String(req.body?.BookingID ?? "").trim()
    const BookingRequestID = String(req.body?.BookingRequestID ?? "").trim()

    if (!BookingID) {
      return sendResponse(res, "BookingID is required.", true, null, 0)
    }

    if (!BookingRequestID) {
      return sendResponse(res, "BookingRequestID is required.", true, null, 0)
    }

    const db = await connectToMongoDB()
    const collection = db.collection("tblMemShipBookingInfo")

    const pipeline = [
      { $match: { BookingVendorID, BookingID, BookingRequestID } },
      { $sort: { BookingDate: -1, CreatedDate: -1, _id: -1 } },

      {
        $lookup: {
          from: "tblvendorinfo",
          let: { vid: "$BookingVendorID" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: [
                    { $trim: { input: { $toString: "$VendorID" }, chars: " ," } },
                    { $trim: { input: { $toString: "$$vid" }, chars: " ," } },
                  ],
                },
              },
            },
            { $sort: { CreatedDate: -1, UpdateDate: -1, _id: -1 } },
            { $project: { _id: 0, vdrName: 1 } },
            { $limit: 1 },
          ],
          as: "VendorInfo",
        },
      },

      {
        $lookup: {
          from: "tblMemRegInfo",
          let: { pid: "$BookingParentsID" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: [
                    { $trim: { input: { $toString: "$prtuserid" }, chars: " ," } },
                    { $trim: { input: { $toString: "$$pid" }, chars: " ," } },
                  ],
                },
              },
            },
            { $sort: { CreatedDate: -1, UpdatedAt: -1, _id: -1 } },
            {
              $project: {
                _id: 0,
                RegUserFullName: 1,
                RegUserEmailAddress: 1,
                RegUserMobileNo: 1,
                RegUserImageName: 1,
              },
            },
            { $limit: 1 },
          ],
          as: "ParentsInfo",
        },
      },

      {
        $lookup: {
          from: "tblMemKidsInfo",
          let: { kid: "$BookingKidsID" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: [
                    { $trim: { input: { $toString: "$KidsID" }, chars: " ," } },
                    { $trim: { input: { $toString: "$$kid" }, chars: " ," } },
                  ],
                },
              },
            },
            { $sort: { CreatedDate: -1, UpdatedAt: -1, _id: -1 } },
            {
              $project: {
                _id: 0,
                KidsName: 1,
                KidsClassName: 1,
                KidsSchoolName: 1,
                KidsDateOfBirth: 1,
                KidsAdditionalNote: 1,
                KidsImageName: 1,
              },
            },
            { $limit: 1 },
          ],
          as: "KidsInfo",
        },
      },

      {
        $lookup: {
          from: "tblactivityinfo",
          let: { aid: "$BookingActivityID" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $eq: [
                    { $trim: { input: { $toString: "$ActivityID" }, chars: " ," } },
                    { $trim: { input: { $toString: "$$aid" }, chars: " ," } },
                  ],
                },
              },
            },
            { $sort: { CreatedDate: -1, UpdateDate: -1, _id: -1 } },
            { $project: { _id: 0, actName: 1, actImageName1: 1 } },
            { $limit: 1 },
          ],
          as: "ActivityInfo",
        },
      },

      {
        $addFields: {
          VendorInfo: { $ifNull: [{ $arrayElemAt: ["$VendorInfo", 0] }, {}] },
          ParentsInfo: { $ifNull: [{ $arrayElemAt: ["$ParentsInfo", 0] }, {}] },
          KidsInfo: { $ifNull: [{ $arrayElemAt: ["$KidsInfo", 0] }, {}] },
          ActivityInfo: { $ifNull: [{ $arrayElemAt: ["$ActivityInfo", 0] }, {}] },
        },
      },

      {
        $project: {
          _id: 0,
          BookingRequestID: 1,
          BookingID: 1,
          BookingParentsID: 1,
          BookingKidsID: 1,
          BookingStarPerKids: 1,
          BookingVendorID: 1,
          BookingActivityID: 1,
          BookingActivityDate: 1,
          BookingActivityTime: 1,
          BookingDate: 1,
          BookingStatus: 1,

          // ✅ NEW: BookingStatusName (Name field)
          BookingStatusName: {
            $switch: {
              branches: [
                { case: { $eq: ["$BookingStatus", "BOOKED"] }, then: "BOOKED" },
                { case: { $eq: ["$BookingStatus", "COMPLETED"] }, then: "COMPLETED" },
              ],
              default: "$BookingStatus",
            },
          },

          vdrName: { $ifNull: ["$VendorInfo.vdrName", ""] },

          RegUserFullName: { $ifNull: ["$ParentsInfo.RegUserFullName", ""] },
          RegUserEmailAddress: { $ifNull: ["$ParentsInfo.RegUserEmailAddress", ""] },
          RegUserMobileNo: { $ifNull: ["$ParentsInfo.RegUserMobileNo", ""] },

          KidsName: { $ifNull: ["$KidsInfo.KidsName", ""] },

          actName: { $ifNull: ["$ActivityInfo.actName", ""] },
        },
      },

      { $skip: skip },
      { $limit: limit },
    ]

    const data = await collection.aggregate(pipeline).toArray()

    const baseFilter = { BookingVendorID, BookingID, BookingRequestID }

    const totalCount = await collection.countDocuments(baseFilter)

    const bookedCount = await collection.countDocuments({
      ...baseFilter,
      BookingStatus: "BOOKED",
    })

    const completedCount = await collection.countDocuments({
      ...baseFilter,
      BookingStatus: "COMPLETED",
    })

    // ✅ NEW: statusSummary with Name field
    const statusSummary = [
      { Name: "BOOKED", BookingStatus: "BOOKED", Count: bookedCount },
      { Name: "COMPLETED", BookingStatus: "COMPLETED", Count: completedCount },
    ]

    return sendResponse(res, "booking list found.", null, {
      page,
      limit,
      totalCount,
      bookedCount,
      completedCount,
      statusSummary, // ✅ added
      data,
    })
  } catch (error) {
    console.error("Error in vdrgetbookingSummaryList:", error)
    next(error)
  }
}

exports.vdrupdateBookingStatus = async (req, res, next) => {
  try {
    // =========================================================
    // ✅ Get Required Fields (ONLY 3)
    // =========================================================
    const BookingID = String(req.body?.BookingID ?? "").trim()
    const BookingRequestID = String(req.body?.BookingRequestID ?? "").trim()
    const BookingStatus = String(req.body?.BookingStatus ?? "").trim()

    // =========================================================
    // ✅ Validate Required Fields
    // =========================================================
    if (!BookingID) {
      return sendResponse(res, "BookingID is required.", true, null, 0)
    }

    if (!BookingRequestID) {
      return sendResponse(res, "BookingRequestID is required.", true, null, 0)
    }

    if (!BookingStatus) {
      return sendResponse(res, "BookingStatus is required.", true, null, 0)
    }

    // =========================================================
    // ✅ DB Connection
    // =========================================================
    const db = await connectToMongoDB()
    const collection = db.collection("tblMemShipBookingInfo")

    // =========================================================
    // ✅ Update ONLY ONE Record
    // =========================================================
    const result = await collection.updateOne(
      {
        BookingID,
        BookingRequestID,
      },
      {
        $set: {
          BookingStatus,
          UpdatedAt: new Date(),
        },
      }
    )

    // =========================================================
    // ✅ If No Record Found
    // =========================================================
    if (!result || result.matchedCount === 0) {
      return sendResponse(
        res,
        "No booking found for given BookingID and BookingRequestID.",
        null,
        { matchedCount: 0, modifiedCount: 0 },
        0
      )
    }

    return sendResponse(
      res,
      "BookingStatus updated successfully.",
      null,
      {
        matchedCount: result.matchedCount,
        modifiedCount: result.modifiedCount,
      },
      1
    )
  } catch (error) {
    console.error("Error in vdrupdateBookingStatus:", error)
    next(error)
  }
}

exports.isKidsBookedSameDateTIme = async (req, res, next) => {
  try {
    // =========================================================
    // ✅ Get Required Fields
    // =========================================================
    const bookingKidsRaw = req.body?.BookingKidsID
    const BookingActivityDate = String(req.body?.BookingActivityDate ?? "").trim()
    const BookingActivityTime = String(req.body?.BookingActivityTime ?? "").trim()

    // =========================================================
    // ✅ Normalize BookingKidsID (supports array / comma string / single value)
    // =========================================================
    let BookingKidsID = []

    if (Array.isArray(bookingKidsRaw)) {
      BookingKidsID = bookingKidsRaw
        .map((item) => String(item ?? "").trim())
        .filter((item) => item)
    } else if (typeof bookingKidsRaw === "string") {
      BookingKidsID = bookingKidsRaw
        .split(",")
        .map((item) => String(item ?? "").trim())
        .filter((item) => item)
    } else if (bookingKidsRaw !== undefined && bookingKidsRaw !== null) {
      BookingKidsID = [String(bookingKidsRaw).trim()].filter((item) => item)
    }

    // =========================================================
    // ✅ Validate Required Fields
    // =========================================================
    if (!BookingKidsID.length) {
      return sendResponse(res, "BookingKidsID is required.", true, null, 0)
    }

    if (!BookingActivityDate) {
      return sendResponse(res, "BookingActivityDate is required.", true, null, 0)
    }

    if (!BookingActivityTime) {
      return sendResponse(res, "BookingActivityTime is required.", true, null, 0)
    }

    // =========================================================
    // ✅ Date Parser
    // Supports:
    //  - YYYY-MM-DD
    //  - YYYY/MM/DD
    //  - DD-MM-YYYY
    //  - DD/MM/YYYY
    // =========================================================
    const parseDateValue = (value) => {
      const str = String(value ?? "").trim()
      if (!str) return null

      if (/^\d{4}-\d{2}-\d{2}$/.test(str) || /^\d{4}\/\d{2}\/\d{2}$/.test(str)) {
        const normalized = str.replace(/\//g, "-")
        const dt = new Date(`${normalized}T00:00:00`)
        return isNaN(dt.getTime()) ? null : dt
      }

      if (/^\d{2}-\d{2}-\d{4}$/.test(str) || /^\d{2}\/\d{2}\/\d{4}$/.test(str)) {
        const parts = str.replace(/\//g, "-").split("-")
        const day = parts[0]
        const month = parts[1]
        const year = parts[2]
        const dt = new Date(`${year}-${month}-${day}T00:00:00`)
        return isNaN(dt.getTime()) ? null : dt
      }

      const dt = new Date(str)
      return isNaN(dt.getTime()) ? null : dt
    }

    const requestDateObj = parseDateValue(BookingActivityDate)

    if (!requestDateObj) {
      return sendResponse(res, "Invalid BookingActivityDate format.", true, null, 0)
    }

    // =========================================================
    // ✅ DB Connection
    // =========================================================
    const db = await connectToMongoDB()
    const collection = db.collection("tblMemShipBookingInfo")

    // =========================================================
    // ✅ Find candidate bookings
    // - Same time
    // - Same kids (one or more)
    // =========================================================
    const candidateBookings = await collection
      .find({
        BookingActivityTime: BookingActivityTime,
        $or: [
          { BookingKidsID: { $in: BookingKidsID } },
          { BookingKidsID: { $elemMatch: { $in: BookingKidsID } } },
        ],
      })
      .project({
        _id: 0,
        BookingKidsID: 1,
        BookingActivityDate: 1,
        BookingActivityTime: 1,
      })
      .toArray()

    // =========================================================
    // ✅ Filter:
    // BookingActivityDate >= req.body.BookingActivityDate
    // and return same kid conflicts only
    // =========================================================
    const KidsBookedAlread = []

    for (const booking of candidateBookings) {
      const dbDateObj = parseDateValue(booking?.BookingActivityDate)
      if (!dbDateObj) continue

      if (dbDateObj >= requestDateObj) {
        const bookingKids = Array.isArray(booking?.BookingKidsID)
          ? booking.BookingKidsID.map((item) => String(item ?? "").trim()).filter((item) => item)
          : [String(booking?.BookingKidsID ?? "").trim()].filter((item) => item)

        for (const kidId of BookingKidsID) {
          if (bookingKids.includes(kidId)) {
            KidsBookedAlread.push({
              KidsID: kidId,
              BookingActivityDate: booking.BookingActivityDate ?? "",
              BookingActivityTime: booking.BookingActivityTime ?? "",
            })
          }
        }
      }
    }

    // =========================================================
    // ✅ Remove duplicate records
    // =========================================================
    const uniqueKidsBookedAlread = Array.from(
      new Map(
        KidsBookedAlread.map((item) => [
          `${item.KidsID}__${item.BookingActivityDate}__${item.BookingActivityTime}`,
          item,
        ])
      ).values()
    )

    // =========================================================
    // ✅ Response
    // =========================================================
    return res.status(200).json({
      statusCode: 200,
      message:
        uniqueKidsBookedAlread.length > 0
          ? "Some kids already have activity booked for same date/time."
          : "No same date/time booking found for given kids.",
      KidsBookedAlread: uniqueKidsBookedAlread,
    })
  } catch (error) {
    console.error("Error in isKidsBookedSameDateTIme:", error)
    next(error)
  }
}