const { connectToMongoDB } = require("../../../../database/mongodb");
const { createUser, updatepassword } = require("../../../service/userService");
const { generateUniqueId } = require("../../../operation/operation");

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
exports.triplist = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 50, // you can raise this or remove paging entirely if you truly want "all"
      ActvityID, // spelling from your request body
      ActivityID, // accept both, in case of typo in caller
    } = req.body;

    const activityId = ActivityID ?? ActvityID;
    if (!activityId) {
      return res.status(400).json({
        ok: false,
        message: "ActivityID (or ActvityID) is required in request body.",
      });
    }

    const db = await connectToMongoDB();

    const requestCol = db.collection("tblactivityrequest");

    const skip = (Number(page) - 1) * Number(limit);

    const pipeline = [
      // Filter requests by the requested ActivityID
      { $match: { ActivityID: activityId } },

      // Sort newest first
      { $sort: { CreatedDate: -1 } },

      // Optional pagination — remove these two stages if you truly want ALL rows without paging
      { $skip: skip },
      { $limit: parseInt(limit, 10) },

      // Join to tblactivityinfo to get actName
      {
        $lookup: {
          from: "tblactivityinfo",
          localField: "ActivityID",
          foreignField: "ActivityID",
          as: "activityInfo",
        },
      },
      { $unwind: { path: "$activityInfo", preserveNullAndEmptyArrays: true } },

      // Surface actName (and anything else you want from activityInfo)
      {
        $addFields: {
          actName: "$activityInfo.actName",
        },
      },

      // Final shape
      {
        $project: {
          activityInfo: 0, // remove the joined doc; keep just actName
        },
      },
    ];

    const data = await requestCol.aggregate(pipeline).toArray();

    // Count ALL matching requests for this ActivityID (ignores pagination)
    const totalCount = await requestCol.countDocuments({
      ActivityID: activityId,
    });

    return res.status(200).json({
      ok: true,
      message: "activity requests found.",
      totalCount,
      data,
    });
  } catch (error) {
    console.error("Error in triplist:", error);
    next(error);
  }
};

 
exports.gettrip = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 50,
      RequestID,
      ActvityID, // backward-compat typo
      ActivityID,
    } = req.body;

    const activityId = ActivityID ?? ActvityID ?? null;

    // Decide which filter to use
    let matchFilter = null;
    if (RequestID) {
      matchFilter = { RequestID: RequestID };
    } else if (activityId) {
      matchFilter = { ActivityID: activityId };
    } else {
      return res.status(400).json({
        ok: false,
        message:
          "RequestID or ActivityID (ActvityID) is required in request body.",
      });
    }

    const db = await connectToMongoDB();
    const requestCol = db.collection("tblactivityrequest");

    // Ensure base URL is well-formed (adds trailing slash if missing)
    const schoolImageBase = (process.env.SchoolImageUrl || "").replace(/\/?$/, "/");

    const pipeline = [
      // Filter by RequestID (preferred) or ActivityID
      { $match: matchFilter },

      // Sort newest first
      { $sort: { CreatedDate: -1 } },

      // Only paginate when NOT querying by a specific RequestID
      ...(RequestID
        ? []
        : [
            { $skip: (Number(page) - 1) * Number(limit) },
            { $limit: parseInt(limit, 10) },
          ]),

      // Join to tblactivityinfo for actName (via ActivityID)
      {
        $lookup: {
          from: "tblactivityinfo",
          localField: "ActivityID",
          foreignField: "ActivityID",
          as: "activityInfo",
        },
      },
      { $unwind: { path: "$activityInfo", preserveNullAndEmptyArrays: true } },
      { $addFields: { actName: "$activityInfo.actName" } },

      // === NEW: Join vendor info using activityInfo.VendorID ===
      {
        $lookup: {
          from: "tblvendorinfo",
          localField: "activityInfo.VendorID",
          foreignField: "VendorID",
          as: "vendorInfo",
        },
      },
      { $unwind: { path: "$vendorInfo", preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          vdrName: "$vendorInfo.vdrName",
          vdrClubName: "$vendorInfo.vdrClubName",
        },
      },

      // Join school info by SchoolID
      {
        $lookup: {
          from: "tblschoolinfo",
          localField: "SchoolID",
          foreignField: "SchoolID",
          as: "schoolInfo",
        },
      },
      { $unwind: { path: "$schoolInfo", preserveNullAndEmptyArrays: true } },

      // Expose schName and schImageName from the joined school document
      {
        $addFields: {
          schName: "$schoolInfo.schName",
          schImageName: "$schoolInfo.schImageName",
        },
      },

      // Build absolute image URL from env + image name (null if no image)
      {
        $addFields: {
          schImageNameUrl: {
            $cond: [
              {
                $and: [
                  { $ne: ["$schImageName", null] },
                  { $ne: ["$schImageName", ""] },
                ],
              },
              { $concat: [schoolImageBase, "$schImageName"] },
              null,
            ],
          },
        },
      },

      // Join school food price info by RequestID
      {
        $lookup: {
          from: "tblschrequestfoodinfo",
          let: { reqId: "$RequestID" },
          pipeline: [
            { $match: { $expr: { $eq: ["$RequestID", "$$reqId"] } } },
            { $project: { _id: 0 } },
          ],
          as: "schoolreqfoodprice",
        },
      },

      // Join school trip price info by RequestID
      {
        $lookup: {
          from: "tblschrequestpriceinfo", // confirm this is the exact name
          let: { reqId: "$RequestID" },
          pipeline: [
            { $match: { $expr: { $eq: ["$RequestID", "$$reqId"] } } },
            { $project: { _id: 0 } },
          ],
          as: "schoolreqftripprice",
        },
      },

      // Drop bulky join docs we don't need in the response
      { $project: { activityInfo: 0, schoolInfo: 0, vendorInfo: 0 } },
    ];

    const data = await requestCol.aggregate(pipeline).toArray();
    const totalCount = await requestCol.countDocuments(matchFilter);

    return res.status(200).json({
      ok: true,
      message: "activity request(s) found.",
      totalCount,
      data,
    });
  } catch (error) {
    console.error("Error in gettrip:", error);
    next(error);
  }
};

 



exports.tripPaidList = async (req, res, next) => {
  try {
    const db = await connectToMongoDB();
    const { RequestID } = req.body;

    if (!RequestID) {
      return res.status(400).json({ message: "RequestID is required." });
    }

    // 1) Fetch kids for this request
    const kids = await db
      .collection("tblBookTripKidsInfo")
      .find({ RequestID })
      .toArray();

    // Top-level single count from tblBookTripKidsInfo by RequestID
    const actTotalPaidStudents = kids.length;

    if (kids.length === 0) {
      return res.status(200).json({
        status: "success",
        total: 0,
        actTotalPaidStudents,
        data: []
      });
    }

    // Collect IDs
    const parentIDs = [...new Set(kids.map(k => k.ParentsID))];
    const kidsIDs = kids.map(k => k.KidsID);

    // 2) Parents
    const parents = await db
      .collection("tblBookTripParentsInfo")
      .find({ RequestID, ParentsID: { $in: parentIDs } })
      .toArray();

    const parentsMap = {};
    parents.forEach(p => {
      parentsMap[p.ParentsID] = {
        tripParentsName: p.tripParentsName,
        tripParentsMobileNo: p.tripParentsMobileNo,
        tripParentsNote: p.tripParentsNote,
      };
    });

    // 3) Payments (by KidsID + RequestID). Keep latest per kid by CreatedDate.
    const paymentsAgg = await db.collection("tblBookTripPayInfo").aggregate([
      { $match: { RequestID, KidsID: { $in: kidsIDs } } },
      { $sort: { KidsID: 1, CreatedDate: -1 } },
      {
        $group: {
          _id: "$KidsID",
          doc: { $first: "$$ROOT" }
        }
      }
    ]).toArray();

    const paymentsByKid = {};
    paymentsAgg.forEach(p => {
      paymentsByKid[p._id] = p.doc;
    });

    // 4) Food mappings
    const [foodIncluded, foodExtra] = await Promise.all([
      db.collection("tblBookKidsFoodIncluded").find({ RequestID, KidsID: { $in: kidsIDs } }).toArray(),
      db.collection("tblBookKidsFoodExtra").find({ RequestID, KidsID: { $in: kidsIDs } }).toArray(),
    ]);

    const foodIDs = [
      ...new Set([
        ...foodIncluded.map(f => f.FoodID),
        ...foodExtra.map(f => f.FoodID),
      ]),
    ];

    const foodInfo = foodIDs.length
      ? await db.collection("tblactfoodinfo").find({ FoodID: { $in: foodIDs } }).toArray()
      : [];

    const foodMap = {};
    foodInfo.forEach(f => { foodMap[f.FoodID] = f; });

    // 5) Build per-kid output
    const finalList = kids.map(kid => {
      const parent = parentsMap[kid.ParentsID] || {};
      const pay = paymentsByKid[kid.KidsID] || {};

      const kidIncludedFoods = foodIncluded
        .filter(f => f.KidsID === kid.KidsID)
        .map(f => foodMap[f.FoodID])
        .filter(Boolean)
        .map(f => ({ FoodName: f.FoodName }));

      const kidExtraFoods = foodExtra
        .filter(f => f.KidsID === kid.KidsID)
        .map(f => foodMap[f.FoodID])
        .filter(Boolean)
        .map(f => ({ FoodName: f.FoodName }));

      return {
        TripKidsSchoolNo: kid.TripKidsSchoolNo,
        TripKidsName: kid.TripKidsName,
        tripKidsClassName: kid.tripKidsClassName,

        tripParentsName: parent.tripParentsName || "",
        tripParentsMobileNo: parent.tripParentsMobileNo || "",
        tripParentsNote: parent.tripParentsNote || "",

        // Payment fields (now also PayTypeID)
        PayRefNo: pay?.PayRefNo ?? null,
        PayTypeID: pay?.PayTypeID ?? null,          // <--- added
        tripPaymentTypeID: pay?.tripPaymentTypeID ?? null,
        TripCost: pay?.TripCost ?? null,
        TripFoodCost: pay?.TripFoodCost ?? null,
        TripTaxAmount: pay?.TripTaxAmount ?? null,
        TripFullAmount: pay?.TripFullAmount ?? null,
        PayStatus: pay?.PayStatus ?? null,
        InvoiceNo: pay?.InvoiceNo ?? null,
        MyFatrooahRefNo: pay?.MyFatrooahRefNo ?? null,
        PayDate: pay?.PayDate ?? null,
        CreatedDate: pay?.CreatedDate ?? null,

        IncFoodInfo: kidIncludedFoods,
        ExtraFoodInfo: kidExtraFoods,
      };
    });

    // 6) Respond with single actTotalPaidStudents at the top level
    res.status(200).json({
      status: "success",
      total: finalList.length,
      actTotalPaidStudents, // single number for this RequestID
      data: finalList
    });
  } catch (error) {
    console.error("Error in tripPaidList:", error);
    next(error);
  }
};


exports.getmykidsstatus = async (req, res, next) => {
  try {
    const refs = req.body.MyFatrooahRefNo;

    // ✅ Basic validation
    if (!Array.isArray(refs) || refs.length === 0) {
      return res.status(400).json({
        status: "error",
        message: "MyFatrooahRefNo must be a non-empty array",
      });
    }

    // ✅ Use same DB connection helper
    const db = await connectToMongoDB();
    const collection = db.collection("tblBookTripPayInfo");

    // ✅ Find all matching records
    const matchedDocs = await collection
      .find({ MyFatrooahRefNo: { $in: refs } })
      .project({ MyFatrooahRefNo: 1 })
      .toArray();

    // ✅ Extract found reference numbers
    const matchedValues = matchedDocs.map((d) => d.MyFatrooahRefNo);
    const matchedCount = matchedValues.length;

    // ✅ Determine which were not found
    const notMatched = refs.filter((r) => !matchedValues.includes(r));

    // ✅ Respond with results
    return res.status(200).json({
      status: "success",
      totalProvided: refs.length,
      matchedCount,
      notMatchedCount: notMatched.length,
      matchedList: matchedValues,
      notMatchedList: notMatched,
    });
  } catch (error) {
    console.error("Error in getmykidsstatus:", error);
    return res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
};
// getalltriplist
 // getalltriplist
exports.getalltriplist = async (req, res, next) => {
  try {
    const db = await connectToMongoDB();
    const { ObjectId } = require("mongodb");

    // ---------- Helper functions ----------
    const toArray = (v) =>
      Array.isArray(v)
        ? v.filter((x) => x !== undefined && x !== null && `${x}`.trim() !== "").map((x) => `${x}`.trim())
        : typeof v === "string"
        ? v.split(",").map((s) => s.trim()).filter((s) => s.length)
        : v != null
        ? [`${v}`.trim()]
        : [];

    const withObjectIds = (arr) => {
      const out = [];
      for (const s of arr) {
        out.push(s);
        if (/^[a-fA-F0-9]{24}$/.test(s)) {
          try {
            out.push(new ObjectId(s));
          } catch {}
        }
      }
      return out;
    };

    // ---------- Filters ----------
    const { RequestID, ActivityID, VendorID, SchoolID, actRequestStatus } = req.body || {};

    const reqIds = withObjectIds(toArray(RequestID));
    const actIds = withObjectIds(toArray(ActivityID));
    const vdrIds = withObjectIds(toArray(VendorID));
    const schIds = withObjectIds(toArray(SchoolID));
    const stsArr = toArray(actRequestStatus);

    const optionalFilter = {};
    if (reqIds.length) optionalFilter.RequestID = { $in: reqIds };
    if (actIds.length) optionalFilter.ActivityID = { $in: actIds };
    if (vdrIds.length) optionalFilter.VendorID = { $in: vdrIds };
    if (schIds.length) optionalFilter.SchoolID = { $in: schIds };
    if (stsArr.length) optionalFilter.actRequestStatus = { $in: stsArr };

    // ---------- Main Pipeline ----------
    const pipeline = [
      { $match: Object.keys(optionalFilter).length ? optionalFilter : {} },

      // 🔗 Join with tblschoolinfo → schName
      {
        $lookup: {
          from: "tblschoolinfo",
          localField: "SchoolID",
          foreignField: "SchoolID",
          pipeline: [{ $project: { _id: 0, schName: 1 } }],
          as: "school",
        },
      },
      { $addFields: { schName: { $arrayElemAt: ["$school.schName", 0] } } },

      // 🔗 Join with tblvendorinfo → vdrName
      {
        $lookup: {
          from: "tblvendorinfo",
          localField: "VendorID",
          foreignField: "VendorID",
          pipeline: [{ $project: { _id: 0, vdrName: 1 } }],
          as: "vendor",
        },
      },
      { $addFields: { vdrName: { $arrayElemAt: ["$vendor.vdrName", 0] } } },

      // 🔗 Join with tblactivityinfo → actName
      {
        $lookup: {
          from: "tblactivityinfo",
          localField: "ActivityID",
          foreignField: "ActivityID",
          pipeline: [{ $project: { _id: 0, actName: 1 } }],
          as: "activity",
        },
      },
      { $addFields: { actName: { $arrayElemAt: ["$activity.actName", 0] } } },

      // ---------- Final Fields ----------
      {
        $project: {
          _id: 1,
          RequestID: 1,
          ActivityID: 1,
          VendorID: 1,
          SchoolID: 1,
          actRequestRefNo: 1,
          actRequestDate: 1,
          actRequestTime: 1,
          actRequestMessage: 1,
          actRequestStatus: 1,
          actTotalNoStudents: 1,
          CreatedDate: 1,
          CreatedBy: 1,
          ModifyDate: 1,
          ModifyBy: 1,
          RequestRejectReason: 1,
          PaymentDueDate: 1,
          ProposalMessage: 1,
          SchoolTerms: 1,
          UpdateDate: 1,
          // joined fields
          actName: 1,
          schName: 1,
          vdrName: 1,
        },
      },

      // ---------- Sorting ----------
      { $sort: { actRequestDate: -1, actRequestTime: -1, RequestID: -1 } },
    ];

    const rows = await db.collection("tblactivityrequest").aggregate(pipeline).toArray();
    return res.status(200).json({ status: "success", data: rows });
  } catch (err) {
    console.error("Error in getAllTripList:", err?.message || err);
    return next(err);
  }
};

 exports.gettripview = async (req, res, next) => {
  try {
    // ✅ TripNo is OPTIONAL.
    // If TripNo is provided -> we will ONLY use TripNo to find ActivityID/VendorID (+ RequestID if available)
    // If TripNo is NOT provided -> keep existing logic (ActivityID & VendorID required; RequestID optional)

    const db = await connectToMongoDB();

    // ✅ accept common client key variants (your Postman screenshot uses TripNO)
    const tripNoRaw =
      req.body?.TripNo ??
      req.body?.TripNO ??
      req.body?.tripNo ??
      req.body?.tripno ??
      "";

    const tripNo = String(tripNoRaw || "").trim();

    // ✅ OPTIONAL: actRequestStatus filter from body
    const actRequestStatus =
      req.body?.actRequestStatus === undefined ||
      req.body?.actRequestStatus === null ||
      String(req.body?.actRequestStatus).trim() === ""
        ? null
        : String(req.body?.actRequestStatus).trim();

    // Existing body fields (used only if TripNo not provided)
    let ActivityID = req.body?.ActivityID;
    let VendorID = req.body?.VendorID;
    let RequestID = req.body?.RequestID;

    // ✅ NEW: fields to append from tblactivityrequest
    let actRequestRefNo = null;
    let actRequestDate = null;
    let actRequestTime = null;
    let actRequestMessage = null;
    let actTotalNoStudents = null;
    let PaymentDueDate = null;
    let ProposalMessage = null;
    let SchoolTerms = null;

    // ✅ NEW: school image fields (from tblschrequestpriceinfo -> tblschoolinfo)
    let SchoolID = null;
    let schImageName = null;
    let schImageNameUrl = null;

    // ============================================================
    // ✅ 1) If TripNo provided -> resolve from tblactivityrequest
    // ============================================================
    if (tripNo) {
      const actReqCol = db.collection("tblactivityrequest");

      // Match: actRequestRefNo = TripNo (CASE-INSENSITIVE)
      const tripQuery = {
        $expr: {
          $eq: [
            { $toUpper: { $ifNull: ["$actRequestRefNo", ""] } },
            tripNo.toUpperCase(),
          ],
        },
      };

      // ✅ OPTIONAL FILTER: apply only if actRequestStatus comes in req.body
      if (actRequestStatus) {
        tripQuery.actRequestStatus = actRequestStatus;
      }

      const tripRow = await actReqCol.findOne(tripQuery, {
        projection: {
          _id: 0,
          RequestID: 1,
          ActivityID: 1,
          VendorID: 1,

          // ✅ requested fields
          actRequestRefNo: 1,
          actRequestDate: 1,
          actRequestTime: 1,
          actRequestMessage: 1,
          actTotalNoStudents: 1,
          PaymentDueDate: 1,
          ProposalMessage: 1,
          SchoolTerms: 1,
        },
      });

      if (!tripRow) {
        return res.status(404).json({
          message: "TripNo not found.",
        });
      }

      // ✅ Override values from tblactivityrequest
      ActivityID = tripRow.ActivityID;
      VendorID = tripRow.VendorID;

      // ✅ IMPORTANT: ensure RequestID is returned/displayed
      RequestID = tripRow.RequestID ?? null;

      // ✅ store request fields
      actRequestRefNo = tripRow.actRequestRefNo ?? null;
      actRequestDate = tripRow.actRequestDate ?? null;
      actRequestTime = tripRow.actRequestTime ?? null;
      actRequestMessage = tripRow.actRequestMessage ?? null;
      actTotalNoStudents = tripRow.actTotalNoStudents ?? null;
      PaymentDueDate = tripRow.PaymentDueDate ?? null;
      ProposalMessage = tripRow.ProposalMessage ?? null;
      SchoolTerms = tripRow.SchoolTerms ?? null;
    } else {
      // ============================================================
      // ✅ 1b) If TripNo NOT provided:
      //     Keep existing logic but still TRY to fetch these fields
      //     when RequestID is provided (optional)
      // ============================================================
      if (RequestID) {
        const actReqCol = db.collection("tblactivityrequest");

        const reqQuery = {
          RequestID: String(RequestID).trim(),
        };

        // ✅ OPTIONAL FILTER: apply only if actRequestStatus comes in req.body
        if (actRequestStatus) {
          reqQuery.actRequestStatus = actRequestStatus;
        }

        const reqRow = await actReqCol.findOne(reqQuery, {
          projection: {
            _id: 0,
            RequestID: 1, // ✅ include
            actRequestRefNo: 1,
            actRequestDate: 1,
            actRequestTime: 1,
            actRequestMessage: 1,
            actTotalNoStudents: 1,
            PaymentDueDate: 1,
            ProposalMessage: 1,
            SchoolTerms: 1,
          },
        });

        if (reqRow) {
          // ✅ ensure RequestID is returned/displayed even in this path
          RequestID = reqRow.RequestID ?? RequestID ?? null;

          actRequestRefNo = reqRow.actRequestRefNo ?? null;
          actRequestDate = reqRow.actRequestDate ?? null;
          actRequestTime = reqRow.actRequestTime ?? null;
          actRequestMessage = reqRow.actRequestMessage ?? null;
          actTotalNoStudents = reqRow.actTotalNoStudents ?? null;
          PaymentDueDate = reqRow.PaymentDueDate ?? null;
          ProposalMessage = reqRow.ProposalMessage ?? null;
          SchoolTerms = reqRow.SchoolTerms ?? null;
        }
      }
    }

    // ============================================================
    // ✅ 2) Validation
    // - If TripNo exists: ActivityID/VendorID must come from tblactivityrequest
    // - If TripNo not exists: old requirement applies
    // ============================================================
    if (!ActivityID || !VendorID) {
      return res.status(400).json({
        message: "ActivityID and VendorID are required.",
      });
    }

    // ✅ Prepare RequestID as a clean string (or null if not provided)
    const reqIdStr =
      RequestID === undefined || RequestID === null
        ? null
        : String(RequestID).trim();

    const activityCollection = db.collection("tblactivityinfo");

    const activity = await activityCollection
      .aggregate(
        [
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
              let: {
                actId: "$ActivityID",
                vendorId: "$VendorID",
                reqId: reqIdStr,
              },
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

                // ✅ Pull matching SchoolPrice & SchoolPriceVatAmount for this price row and RequestID
                {
                  $lookup: {
                    from: "tblschrequestpriceinfo",
                    let: {
                      priceId: "$PriceID",
                      actId: "$ActivityID",
                      reqId: "$$reqId",
                    },
                    pipeline: [
                      {
                        $match: {
                          $expr: {
                            $and: [
                              { $ne: ["$$reqId", null] },
                              {
                                $eq: [
                                  { $toString: "$PriceID" },
                                  { $toString: "$$priceId" },
                                ],
                              },
                              {
                                $eq: [
                                  { $toString: "$ActivityID" },
                                  { $toString: "$$actId" },
                                ],
                              },
                              {
                                $eq: [{ $toString: "$RequestID" }, "$$reqId"],
                              },
                            ],
                          },
                        },
                      },
                      {
                        $project: {
                          _id: 0,
                          SchoolPrice: 1,
                          SchoolPriceVatAmount: 1,

                          // ✅ bring SchoolID from tblschrequestpriceinfo
                          SchoolID: 1,
                        },
                      },
                    ],
                    as: "reqPrice",
                  },
                },

                {
                  $addFields: {
                    RequestSchoolPrice: {
                      $ifNull: [{ $first: "$reqPrice.SchoolPrice" }, ""],
                    },
                    RequestSchoolPriceVatAmount: {
                      $ifNull: [
                        { $first: "$reqPrice.SchoolPriceVatAmount" },
                        "",
                      ],
                    },

                    // ✅ expose SchoolID per price row
                    RequestSchoolID: {
                      $ifNull: [{ $first: "$reqPrice.SchoolID" }, ""],
                    },
                  },
                },

                { $project: { reqPrice: 0 } },
              ],
              as: "priceList",
            },
          },

          // ============================================================
          // ✅ From tblschrequestpriceinfo -> get SchoolID
          // Then join tblschoolinfo -> get schImageName + build schImageNameUrl
          // ============================================================
          {
            $addFields: {
              SchoolID: {
                $ifNull: [{ $first: "$priceList.RequestSchoolID" }, ""],
              },
            },
          },
          {
            $lookup: {
              from: "tblschoolinfo",
              let: { schId: "$SchoolID" },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $and: [
                        { $ne: ["$$schId", ""] },
                        {
                          $eq: [
                            { $toString: "$SchoolID" },
                            { $toString: "$$schId" },
                          ],
                        },
                      ],
                    },
                  },
                },
                {
                  $project: {
                    _id: 0,
                    SchoolID: 1,
                    schName: 1,
                    schImageName: 1,
                  },
                },
              ],
              as: "schoolInfo",
            },
          },
          {
            $unwind: {
              path: "$schoolInfo",
              preserveNullAndEmptyArrays: true,
            },
          },
          {
            $addFields: {
              schImageName: "$schoolInfo.schImageName",

              // ✅ FIXED: must be .../school/<file>
              schImageNameUrl: {
                $cond: [
                  { $ifNull: ["$schoolInfo.schImageName", false] },
                  {
                    $concat: [
                      process.env.SchoolImageUrl, // ex: https://...amazonaws.com/school
                      "/",
                      "$schoolInfo.schImageName", // ex: 2_1754901223210.jpg
                    ],
                  },
                  null,
                ],
              },
            },
          },

          // 🔁 Join with tblactfoodinfo
          {
            $lookup: {
              from: "tblactfoodinfo",
              let: {
                actId: "$ActivityID",
                vendorId: "$VendorID",
                reqId: reqIdStr,
              },
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

                // ✅ Pull matching FoodSchoolPrice & FoodSchoolPriceVatAmount for this food row and RequestID
                {
                  $lookup: {
                    from: "tblschrequestfoodinfo",
                    let: {
                      foodId: "$FoodID",
                      actId: "$ActivityID",
                      reqId: "$$reqId",
                    },
                    pipeline: [
                      {
                        $match: {
                          $expr: {
                            $and: [
                              { $ne: ["$$reqId", null] },
                              {
                                $eq: [
                                  { $toString: "$FoodID" },
                                  { $toString: "$$foodId" },
                                ],
                              },
                              {
                                $eq: [
                                  { $toString: "$ActivityID" },
                                  { $toString: "$$actId" },
                                ],
                              },
                              {
                                $eq: [{ $toString: "$RequestID" }, "$$reqId"],
                              },
                            ],
                          },
                        },
                      },
                      {
                        $project: {
                          _id: 0,
                          FoodSchoolPrice: 1,
                          FoodSchoolPriceVatAmount: 1,
                        },
                      },
                    ],
                    as: "reqFood",
                  },
                },

                {
                  $addFields: {
                    RequestFoodSchoolPrice: {
                      $ifNull: [{ $first: "$reqFood.FoodSchoolPrice" }, ""],
                    },
                    RequestFoodSchoolPriceVatAmount: {
                      $ifNull: [
                        { $first: "$reqFood.FoodSchoolPriceVatAmount" },
                        "",
                      ],
                    },
                  },
                },

                { $project: { reqFood: 0 } },
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
                    vdrGlan: 1,
                    vdrGlat: 1,
                    vdrGoogleMap: 1,
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
              vdrGlan: "$vendorInfo.vdrGlan",
              vdrGlat: "$vendorInfo.vdrGlat",
              vdrGoogleMap: "$vendorInfo.vdrGoogleMap",
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
        ],
        { allowDiskUse: true }
      )
      .toArray();

    if (!activity.length) {
      return res.status(404).json({ message: "Activity not found." });
    }

    // ✅ Append tblactivityrequest fields into the returned activity object
    // ✅ ALSO: include RequestID so client can display it
    activity[0] = {
      ...activity[0],
      RequestID: reqIdStr, // ✅ display RequestID from tblactivityrequest (or body if provided)

      actRequestRefNo,
      actRequestDate,
      actRequestTime,
      actRequestMessage,
      actTotalNoStudents,
      PaymentDueDate,
      ProposalMessage,
      SchoolTerms,
    };

    // ✅ keep these values available too (optional)
    SchoolID = activity[0]?.SchoolID ?? null;
    schImageName = activity[0]?.schImageName ?? null;
    schImageNameUrl = activity[0]?.schImageNameUrl ?? null;

    sendResponse(res, "Activity found.", null, activity[0], null);
  } catch (error) {
    console.error("Error in getActivity:", error);
    next(error);
  }
};
exports.tripAddParentsKidsInfo = async (req, res, next) => {
  const { ObjectId } = require("mongodb");

  // Generate Mongo-compatible unique ID (kept for other IDs like PayID/Food IDs)
  const generateUniqueId = () => new ObjectId().toString();
  const sanitize = (obj) => JSON.parse(JSON.stringify(obj || {}));

  // ✅ small helpers (non-breaking additions)
  const s = (v) => String(v ?? "").trim();
  const normId = (v) => {
    const id = s(v);
    // allow Mongo ObjectId string or any non-empty id you use
    return id !== "" ? id : "";
  };

  // ✅ quantity helpers
  const toQty = (v, fallback = 1) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return fallback;
    const q = Math.floor(n);
    return q > 0 ? q : fallback;
  };

  // ✅ normalize FoodIncluded:
  // supports BOTH:
  // 1) old: ["FOOD1","FOOD2"]
  // 2) new: [{ FoodID:"FOOD1", Quantity:2 }, ...]
  // 3) new alt: [{ FoodID:"FOOD1", FoodQuantity:2 }, ...]
  const normalizeFoodIncluded = (arr) => {
    const list = Array.isArray(arr) ? arr : [];
    return list
      .map((x) => {
        if (x == null) return null;

        // old: "FOOD1"
        if (typeof x === "string" || typeof x === "number") {
          const FoodID = normId(x);
          if (!FoodID) return null;
          return { FoodID, FoodQuantity: 1 };
        }

        // object
        if (typeof x === "object") {
          const FoodID = normId(x.FoodID ?? x.foodId ?? x.id);
          if (!FoodID) return null;

          const FoodQuantity = toQty(
            x.FoodQuantity ?? x.Quantity ?? x.Qty ?? x.qty ?? 1,
            1
          );

          return { FoodID, FoodQuantity };
        }

        return null;
      })
      .filter(Boolean);
  };

  // ✅ normalize FoodExtra:
  // supports BOTH:
  // 1) old: [{ FoodID, FoodSchoolPrice, FoodVendorPrice, FoodHerozPrice }]
  // 2) new: same + Quantity
  // 3) new: same + FoodQuantity  ✅ (your new requirement)
  const normalizeFoodExtra = (arr) => {
    const list = Array.isArray(arr) ? arr : [];
    return list
      .map((x) => {
        if (!x || typeof x !== "object") return null;

        const FoodID = normId(x.FoodID ?? x.foodId ?? x.id);
        if (!FoodID) return null;

        const FoodQuantity = toQty(
          x.FoodQuantity ?? x.Quantity ?? x.Qty ?? x.qty ?? 1,
          1
        );

        return {
          FoodID,
          FoodSchoolPrice: x.FoodSchoolPrice,
          FoodVendorPrice: x.FoodVendorPrice,
          FoodHerozPrice: x.FoodHerozPrice,
          FoodQuantity,
        };
      })
      .filter(Boolean);
  };

  try {
    const db = await connectToMongoDB();

    const {
      RequestID,

      // ✅ NEW: read ParentsID from body (top-level)
      ParentsID,

      tripParentsName,
      tripParentsMobileNo,
      tripParentsNote,
      kidsInfo = [],
      tripPaymentTypeID, // request-level fallback
      FoodIncluded = [],
      FoodExtra = [],
    } = req.body;

    if (!RequestID) {
      return res.status(400).json({ message: "RequestID is required." });
    }

    // ✅ ParentsID must come from JSON (as per your request)
    const ParentIDVal = normId(ParentsID);
    if (!ParentIDVal) {
      return res.status(400).json({
        message:
          "ParentsID is required in request body (top-level). Please send ParentsID from JSON.",
      });
    }

    // ✅ NEW: normalized food arrays (with FoodQuantity)
    const FoodIncludedNorm = normalizeFoodIncluded(FoodIncluded);
    const FoodExtraNorm = normalizeFoodExtra(FoodExtra);

    // --- 0) Resolve Activity and Selected Price ---
    // 0.1 Get ActivityID from tblactivityrequest by RequestID
    const actReq = await db.collection("tblactivityrequest").findOne(
      { RequestID },
      { projection: { ActivityID: 1 } }
    );

    const ActivityID = actReq?.ActivityID;
    if (!ActivityID) {
      return res
        .status(404)
        .json({ message: "ActivityID not found for the given RequestID." });
    }

    // 0.2 From tblschrequestpriceinfo get the SELECTED row (IsSelected: true) for this RequestID
    const selectedSchoolPriceRow = await db
      .collection("tblschrequestpriceinfo")
      .findOne(
        { RequestID, IsSelected: true },
        { sort: { CreatedDate: -1 }, projection: { PriceID: 1, SchoolPrice: 1 } }
      );

    if (!selectedSchoolPriceRow) {
      return res.status(404).json({
        message:
          "No selected School price found (IsSelected=true) for the given RequestID in tblschrequestpriceinfo.",
      });
    }

    const SchoolSelectedPriceID = selectedSchoolPriceRow.PriceID;
    const TripSchoolPrice = Number(selectedSchoolPriceRow.SchoolPrice ?? 0);

    // 0.3 From tblactpriceinfo get record with ActivityID + PriceID = SchoolSelectedPriceID
    const actPrice = await db.collection("tblactpriceinfo").findOne(
      { ActivityID, PriceID: SchoolSelectedPriceID },
      { projection: { Price: 1, HerozStudentPrice: 1, CreatedDate: 1 } }
    );

    if (!actPrice) {
      return res.status(404).json({
        message:
          "No matching act price found in tblactpriceinfo for ActivityID and the selected PriceID.",
        details: { ActivityID, PriceID: SchoolSelectedPriceID },
      });
    }

    const TripVendorCost = Number(actPrice?.Price ?? 0);
    const TripHerozCost = Number(actPrice?.HerozStudentPrice ?? 0);

    // --- 1) Insert parent ---
    await db.collection("tblBookTripParentsInfo").insertOne({
      RequestID,
      ParentsID: ParentIDVal,
      tripParentsName,
      tripParentsMobileNo,
      tripParentsNote,
      CreatedDate: new Date(),
    });

    // --- 2) Prepare batch docs ---
    const kidsDocs = [];
    const payInfoDocs = [];
    const foodIncludedDocs = [];
    const foodExtraDocs = [];

    kidsInfo.forEach((originalKid) => {
      const kid = sanitize(originalKid);

      // ✅ UPDATED: use KidsID from kid JSON (no auto-generate)
      const KidsIDVal = normId(kid.KidsID);
      if (!KidsIDVal) {
        throw new Error(
          "KidsID is required for each kid inside kidsInfo[]. Please send KidsID in JSON."
        );
      }

      // 2.1 Kids info
      kidsDocs.push({
        RequestID,
        ParentsID: ParentIDVal,
        KidsID: KidsIDVal,
        TripKidsSchoolNo: kid.TripKidsSchoolNo,
        TripKidsName: kid.TripKidsName,
        tripKidsClassName: kid.tripKidsClassName,
        CreatedDate: new Date(),
        tripKidsStatus: "PRESENT",
      });

      // ---- PayStatus handling ----
      const effectivePayTypeID = (kid.PayTypeID ?? tripPaymentTypeID ?? "")
        .toString()
        .toUpperCase();

      const incomingStatus = kid.PayStatus ?? kid.PayStaus; // keep both spellings
      const computedPayStatus =
        effectivePayTypeID === "CASH"
          ? "APPROVED"
          : incomingStatus || "PENDING";

      // 2.2 Payment info (+ derived fields)
      payInfoDocs.push({
        PayID: generateUniqueId(),
        PayRefNo: kid.PayRefNo,
        RequestID,
        ParentsID: ParentIDVal,
        KidsID: KidsIDVal,

        PayTypeID: effectivePayTypeID,
        tripPaymentTypeID,

        TripCost: Number(kid.TripCost ?? 0),
        TripFoodCost: Number(kid.TripFoodCost ?? 0),
        TripTaxAmount: Number(kid.TripTaxAmount ?? 0),
        TripFullAmount: Number(kid.TripFullAmount ?? 0),

        TripVendorCost,
        TripHerozCost,
        TripSchoolPrice,

        CreatedDate: new Date(),
        PayDate: new Date(),
        PayStatus: computedPayStatus,
        MyFatrooahRefNo: kid.MyFatrooahRefNo,
        InvoiceNo: kid.InvoiceNo,
        InvVatValue: process.env.VAT_VALUE,
      });

      // 2.3 Food Included (NOW uses FoodQuantity)
      (FoodIncludedNorm || []).forEach(({ FoodID, FoodQuantity }) => {
        foodIncludedDocs.push({
          FooDIncID: generateUniqueId(),
          RequestID,
          KidsID: KidsIDVal,
          FoodID,
          FoodQuantity: toQty(FoodQuantity, 1), // ✅ renamed
          CreatedDate: new Date(),
        });
      });

      // 2.4 Food Extra (NOW uses FoodQuantity)
      (FoodExtraNorm || []).forEach(
        ({ FoodID, FoodSchoolPrice, FoodVendorPrice, FoodHerozPrice, FoodQuantity }) => {
          foodExtraDocs.push({
            FooDExtraID: generateUniqueId(),
            RequestID,
            KidsID: KidsIDVal,
            FoodID,
            FoodSchoolPrice,
            FoodVendorPrice,
            FoodHerozPrice,
            FoodQuantity: toQty(FoodQuantity, 1), // ✅ renamed
            CreatedDate: new Date(),
          });
        }
      );
    });

    // --- 3) Insert batches ---
    if (kidsDocs.length) {
      await db
        .collection("tblBookTripKidsInfo")
        .insertMany(kidsDocs, { ordered: false });
    }

    if (payInfoDocs.length) {
      await db
        .collection("tblBookTripPayInfo")
        .insertMany(payInfoDocs, { ordered: false });
    }

    if (foodIncludedDocs.length) {
      await db
        .collection("tblBookKidsFoodIncluded")
        .insertMany(foodIncludedDocs, { ordered: false });
    }

    if (foodExtraDocs.length) {
      await db
        .collection("tblBookKidsFoodExtra")
        .insertMany(foodExtraDocs, { ordered: false });
    }

    res.json({
      message: "Parent, kids, food (with FoodQuantity), and payment info saved successfully.",
      ActivityID,
      SchoolSelectedPriceID,
      TripVendorCost,
      TripHerozCost,
      TripSchoolPrice,
      ParentsID: ParentIDVal,
      kidsSaved: kidsDocs.length,
      paymentsSaved: payInfoDocs.length,
      foodIncludedSaved: foodIncludedDocs.length,
      foodExtraSaved: foodExtraDocs.length,
    });
  } catch (error) {
    next(error);
  }
};
