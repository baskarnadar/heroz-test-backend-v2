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

 

exports.schCreateTripData = async (req, res, next) => {
  try {
    const {
      schCreateTripData,
      RequestID,
      VendorID,
      SchoolID,          // REQUIRED
      ActivityID,
      PaymentDueDate,
      ProposalMessage,
      SchoolTerms,       // <-- NEW (optional)
      StudentPrice = [],
      FoodPrice = [],
      // Optional overrides for audit fields. If not provided, default to VendorID.
      CreatedBy,
      ModifyBy,
    } = req.body || {};

    // ---- basic validation
    const errors = [];
    if (!RequestID) errors.push("RequestID is required.");
    if (!VendorID) errors.push("VendorID is required.");
    if (!SchoolID) errors.push("SchoolID is required.");
    if (!ActivityID) errors.push("ActivityID is required.");
    if (!PaymentDueDate) errors.push("PaymentDueDate is required.");
    if (ProposalMessage == null) errors.push("ProposalMessage is required.");
    if (PaymentDueDate && !/^\d{4}-\d{2}-\d{2}$/.test(PaymentDueDate)) {
      errors.push("PaymentDueDate must be in YYYY-MM-DD format.");
    }
    if (errors.length) {
      return res.status(400).json({ ok: false, errors });
    }

    const db = await connectToMongoDB();

    // -----------------------
    // Update: tblactivityrequest
    // -----------------------
    const arFilter = { RequestID, VendorID, SchoolID };

    // Build $set dynamically so we only touch SchoolTerms when provided
    const setFields = {
      actRequestStatus: "TRIP-BOOKED",
      PaymentDueDate,                        // keep as YYYY-MM-DD string
      ProposalMessage: String(ProposalMessage),
      UpdateDate: new Date(),                // audit
    };
    if (SchoolTerms !== undefined) {
      setFields.SchoolTerms = String(SchoolTerms);
    }

    const arUpdate = { $set: setFields };

    const arResult = await db
      .collection("tblactivityrequest")
      .updateOne(arFilter, arUpdate);

    // Prepare audit values (defaults to VendorID when not provided)
    const _createdBy = String(CreatedBy ?? VendorID);
    const _modifyBy  = String(ModifyBy  ?? VendorID);
    const now = new Date();

    // -----------------------
    // INSERT 1: StudentPrice -> tblschrequestpriceinfo
    // -----------------------
    let studentPriceInserted = 0;
    if (Array.isArray(StudentPrice) && StudentPrice.length) {
      const docs = StudentPrice
        .filter(p => p && p.PriceID != null)
        .map(p => ({
          RequestID: String(RequestID),
          VendorID: String(VendorID),
          SchoolID: String(SchoolID),
          ActivityID: String(ActivityID),

          PriceID: String(p.PriceID),
          IsSelected: Boolean(p.IsSelected),

          SchoolPrice: Number(p.SchoolPrice),
          SchoolPriceVatPercentage: Number(p.SchoolPriceVatPercentage),
          SchoolPriceVatAmount: Number(p.SchoolPriceVatAmount),

          CreatedBy: _createdBy,
          CreatedDate: now,
          ModifyBy: _modifyBy,
          ModifyDate: now,
        }));

      if (docs.length) {
        try {
          const result = await db
            .collection("tblschrequestpriceinfo")
            .insertMany(docs, { ordered: false });
          studentPriceInserted = result.insertedCount || 0;
        } catch (e) {
          if (e.result && typeof e.result.insertedCount === "number") {
            studentPriceInserted = e.result.insertedCount;
          } else {
            throw e;
          }
        }
      }
    }

    // -----------------------
    // INSERT 2: FoodPrice -> tblschrequestfoodinfo
    // -----------------------
    let foodPriceInserted = 0;
    if (Array.isArray(FoodPrice) && FoodPrice.length) {
      const docs = FoodPrice
        .filter(f => f && f.FoodID != null)
        .map(f => ({
          RequestID: String(RequestID),
          VendorID: String(VendorID),
          SchoolID: String(SchoolID),
          ActivityID: String(ActivityID), 
          FoodID: String(f.FoodID),

          FoodSchoolPrice: Number(f.FoodSchoolPrice), 
          FoodSchoolPriceVatPercentage: Number(f.FoodSchoolPriceVatPercentage),
          FoodSchoolPriceVatAmount: Number(f.FoodSchoolPriceVatAmount),

           FoodVendorPrice: Number(f.FoodVendorPrice), //Might be removed from here
           FoodHerozPrice: Number(f.FoodHerozPrice),  //Might be removed from here
          CreatedBy: _createdBy,
          CreatedDate: now,
          ModifyBy: _modifyBy,
          ModifyDate: now,
        }));

      if (docs.length) {
        try {
          const result = await db
            .collection("tblschrequestfoodinfo")
            .insertMany(docs, { ordered: false });
          foodPriceInserted = result.insertedCount || 0;
        } catch (e) {
          if (e.result && typeof e.result.insertedCount === "number") {
            foodPriceInserted = e.result.insertedCount;
          } else {
            throw e;
          }
        }
      }
    }

    // Compose response
    return res.status(200).json({
      ok: true,
      message: "schCreateTripData update + inserts completed.",
      result: {
        activityRequestMatched:  arResult.matchedCount || 0,
        activityRequestModified: arResult.modifiedCount || 0,
        studentPriceInserted,
        foodPriceInserted,
      },
    });
  } catch (error) {
    console.error("Error in schCreateTripData:", error);
    return next(error);
  }
};

exports.tripPaidList = async (req, res, next) => {
  try {
    const db = await connectToMongoDB();
    const { RequestID, SchoolID } = req.body;

    if (!RequestID || !SchoolID) {
      return res
        .status(400)
        .json({ message: "RequestID and SchoolID are required." });
    }

    // 0) Fetch actTotalNoStudents from tblactivityrequest
    const activityRequest = await db
      .collection("tblactivityrequest")
      .findOne({ RequestID }, { projection: { actTotalNoStudents: 1 } });

    const actTotalNoStudents = activityRequest?.actTotalNoStudents ?? 0;

    // 1) Fetch kids for this Request & School, but ONLY those with APPROVED payment
    // where tblBookTripKidsInfo.RequestID = tblBookTripPayInfo.RequestID
    // and tblBookTripPayInfo.KidsID = tblBookTripKidsInfo.KidsID
    // and tblBookTripPayInfo.PayStatus = "APPROVED"
    const kids = await db
      .collection("tblBookTripKidsInfo")
      .aggregate([
        { $match: { RequestID } },
        {
          $lookup: {
            from: "tblBookTripPayInfo",
            let: { kidId: "$KidsID", reqId: "$RequestID" },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$KidsID", "$$kidId"] },
                      { $eq: ["$RequestID", "$$reqId"] },
                      { $eq: ["$PayStatus", "APPROVED"] },
                    ],
                  },
                },
              },
              { $sort: { CreatedDate: -1 } },
              { $limit: 1 }, // latest approved record for this kid
            ],
            as: "pay",
          },
        },
        // Keep only kids that have at least one APPROVED payment
        { $match: { pay: { $ne: [] } } },
        // (optional) drop the joined "pay" if you don't need it later
        // { $project: { pay: 0 } }
      ])
      .toArray();

    // Single top-level count from filtered kids (i.e., paid students)
    const actTotalPaidStudents = kids.length;

    if (kids.length === 0) {
      return res.status(200).json({
        status: "success",
        total: 0,
        actTotalPaidStudents,
        actTotalNoStudents,
        data: []
      });
    }

    // 2) Collect ParentIDs and KidsIDs
    const parentIDs = [...new Set(kids.map(k => k.ParentsID))];
    const kidsIDs = kids.map(k => k.KidsID);

    // 3) Fetch parents
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

    // 4) Fetch payments by RequestID + KidsID (latest per kid), APPROVED only
    const paymentsAgg = await db.collection("tblBookTripPayInfo").aggregate([
      { 
        $match: { 
          RequestID, 
          KidsID: { $in: kidsIDs },
          PayStatus: "APPROVED" // ✅ filter approved here as well
        } 
      },
      { $sort: { KidsID: 1, CreatedDate: -1 } },
      {
        $group: {
          _id: "$KidsID",
          doc: { $first: "$$ROOT" } // latest per kid after sort
        }
      }
    ]).toArray();

    const paymentsByKid = {};
    paymentsAgg.forEach(p => {
      paymentsByKid[p._id] = p.doc; // latest per kid
    });

    // 5) Fetch included/extra food mappings
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

    // 6) Fetch food info details
    const foodInfo = foodIDs.length
      ? await db.collection("tblactfoodinfo").find({ FoodID: { $in: foodIDs } }).toArray()
      : [];

    const foodMap = {};
    foodInfo.forEach(f => { foodMap[f.FoodID] = f; });

    // 7) Build per-kid list
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
        tripKidsSchoolNo: kid.TripKidsSchoolNo,
        tripKidsName: kid.TripKidsName,
        tripKidsClassName: kid.tripKidsClassName,
        tripKidsSchoolNo: kid.TripKidsSchoolNo, // (kept as in your snippet)
        tripParentsName: parent.tripParentsName || "",
        tripParentsMobileNo: parent.tripParentsMobileNo || "",
        tripParentsNote: parent.tripParentsNote || "",

        PayRefNo: pay?.PayRefNo ?? null,
        PayTypeID: pay?.PayTypeID ?? null,
        tripPaymentTypeID: pay?.tripPaymentTypeID ?? null,
        TripCost: pay?.TripCost ?? null,
        TripFoodCost: pay?.TripFoodCost ?? null,
        TripTaxAmount: pay?.TripTaxAmount ?? null,
        TripFullAmount: pay?.TripFullAmount ?? null,
        TripVendorCost: pay?.TripVendorCost ?? null,
TripHerozCost: pay?.TripHerozCost ?? null,
        TripSchoolPrice: pay?.TripSchoolPrice ?? null,
        tripPaidList: pay?.tripPaidList ?? null,
        PayStatus: pay?.PayStatus ?? null,
        InvoiceNo: pay?.InvoiceNo ?? null,
        MyFatrooahRefNo: pay?.MyFatrooahRefNo ?? null,
        PayDate: pay?.PayDate ?? null,
        CreatedDate: pay?.CreatedDate ?? null,

        IncFoodInfo: kidIncludedFoods,
        ExtraFoodInfo: kidExtraFoods,
      };
    });

    // 8) Final response
    res.status(200).json({
      status: "success",
      total: finalList.length,
      actTotalPaidStudents,
      actTotalNoStudents,
      data: finalList
    });
  } catch (error) {
    console.error("Error in tripPaidList:", error);
    next(error);
  }
};



 exports.schtripStuOnOff = async (req, res, next) => {
  try {
    const db = await connectToMongoDB();
    const { RequestID, KidsID, tripKidsStatus } = req.body || {};

    if (!RequestID || !KidsID || !tripKidsStatus) {
      return res.status(400).json({
        ok: false,
        message: "RequestID, KidsID, and tripKidsStatus are required.",
      });
    }

    const status = String(tripKidsStatus).toUpperCase().trim();
    if (!["PRESENT", "ABSENT"].includes(status)) {
      return res.status(400).json({
        ok: false,
        message: "tripKidsStatus must be either 'PRESENT' or 'ABSENT'.",
      });
    }

    const col = db.collection("tblBookTripKidsInfo");
    const filter = {
      RequestID: String(RequestID).trim(),
      KidsID: String(KidsID).trim(),
    };

    const updateRes = await col.updateOne(filter, {
      $set: { tripKidsStatus: status, ModifyDate: new Date() },
    });

    if (updateRes.matchedCount === 0) {
      return res.status(404).json({
        ok: false,
        message: "Record not found for the given RequestID and KidsID.",
      });
    }

    const doc = await col.findOne(filter);
    return res.status(200).json({
      ok: true,
      message: "tripKidsStatus updated successfully.",
      data: doc,
    });
  } catch (err) {
    console.error("schtripStuOnOff error:", err);
    return res.status(500).json({
      ok: false,
      message: "Internal server error.",
      error: err.message,
    });
  }
};

// controllers/schoolController.js
const QRCode = require("qrcode");

// POST body:
// { "RequestID": "REQ-12345", "mode": "json" | "image" }  // mode optional; default "json"
exports.schQR = async (req, res, next) => {
  try {
    const { RequestID, mode = "json" } = req.body || {};
    if (!RequestID) {
      return res.status(400).json({ ok: false, message: "RequestID is required." });
    }

    const text = `REQ:${String(RequestID).trim()}`; // what gets encoded in the QR
    const opts = {
      errorCorrectionLevel: "M",
      width: 512,   // change if you want a smaller/larger QR
      margin: 1
    };

    if (String(mode).toLowerCase() === "image") {
      // Return raw PNG bytes
      const pngBuffer = await QRCode.toBuffer(text, { ...opts, type: "png" });
      res.setHeader("Content-Type", "image/png");
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).send(pngBuffer);
    }

    // Default: return Data URL in JSON (easy to render in apps)
    const dataUrl = await QRCode.toDataURL(text, { ...opts, type: "image/png" });
    return res.status(200).json({
      ok: true,
      RequestID: String(RequestID).trim(),
      qrDataUrl: dataUrl, // "data:image/png;base64,...."
    });
  } catch (err) {
    console.error("schQR error:", err);
    return res.status(500).json({ ok: false, message: "Internal server error.", error: err.message });
  }
};


 function sendResponse(res, message, error = null, results = null, totalCount = null) {
  res.status(error ? 400 : 200).json({
    statusCode: error ? 400 : 200,
    message,
    data: results,
    error,
    totalCount,
  });
}

exports.schupdateSendToVendor = async (req, res, next) => {
  try {
    const db = await connectToMongoDB();
    const { RequestID, SchoolID, actTripSendToVendorNotes,actTripNoteSendBy } = req.body || {};

    if (!RequestID || !SchoolID || !actTripSendToVendorNotes) {
      return sendResponse(
        res,
        "RequestID, SchoolID, and actTripSendToVendorNotes are required.",
        "Missing required fields"
      );
    }

    const col = db.collection("tblactivityrequest");
    const filter = {
      RequestID: String(RequestID).trim(),
      SchoolID: String(SchoolID).trim(),
    };

    const update = {
      $set: {
        actTripSendToVendorNotes: String(actTripSendToVendorNotes).trim(),
        actTripSendToVendor: "YES",
         actTripNoteSendBy: actTripNoteSendBy,
        actTripNoteDate: new Date(),
      },
    };

    const updateRes = await col.updateOne(filter, update);

    if (updateRes.matchedCount === 0) {
      return sendResponse(
        res,
        "Activity request not found for the given RequestID and SchoolID.",
        "Not Found"
      );
    }

    const doc = await col.findOne(filter, { projection: { _id: 0 } });
    return sendResponse(res, "Send To Vendor updated successfully.", null, doc);
  } catch (err) {
    console.error("schupdateSendToVendor error:", err);
    return sendResponse(res, "Internal server error.", err.message);
  }
};

 exports.getVdrTripLockDateList = async (req, res, next) => {
  try {
    const db = await connectToMongoDB();

    const { VendorID, vdrLockDateMonth, vdrLockDateYear } = req.body;

    // ✅ Validation
    if (!VendorID) {
      return res.status(400).json({ message: "VendorID is required." });
    }
    if (!vdrLockDateMonth || !vdrLockDateYear) {
      return res.status(400).json({
        message: "vdrLockDateMonth and vdrLockDateYear are required.",
      });
    }

    // ✅ Convert to numbers
    const monthInt = parseInt(vdrLockDateMonth, 10);
    const yearInt = parseInt(vdrLockDateYear, 10);

    // ✅ Query filter (VendorID + month/year extracted from vdrLockDate STRING)
    const filter = {
      VendorID,
      $expr: {
        $and: [
          { $eq: [{ $month: { $toDate: "$vdrLockDate" } }, monthInt] },
          { $eq: [{ $year: { $toDate: "$vdrLockDate" } }, yearInt] },
        ],
      },
    };

    // ✅ Fetch data sorted by CreatedDate descending
    const lockList = await db
      .collection("tblvdrLockBookTripDate")
      .find(filter)
      .sort({ CreatedDate: -1 })
      .toArray();

    res.status(200).json({
      status: "success",
      total: lockList.length,
      data: lockList,
    });
  } catch (error) {
    console.error("Error in getVdrTripLockDateList:", error);
    next(error);
  }
};

 exports.updateSchProposal = async (req, res, next) => {
  try {
    const db = await connectToMongoDB();

    const { SchoolID, RequestID, ProposalMessage } = req.body;

    // ============================
    // ✅ Basic validation
    // ============================
    if (!SchoolID) {
      return res.status(400).json({ message: "SchoolID is required." });
    }

    if (!RequestID) {
      return res.status(400).json({ message: "RequestID is required." });
    }

    if (ProposalMessage === undefined || ProposalMessage === null) {
      return res.status(400).json({ message: "ProposalMessage is required." });
    }

    // ============================
    // ✅ Filter: SchoolID + RequestID
    // ============================
    const filter = { SchoolID, RequestID };

    // ============================
    // ✅ Update Fields
    // ============================
    const updateDoc = {
      $set: {
        ProposalMessage: ProposalMessage,  // only update message
        UpdatedAt: new Date(),
      },
    };

    const result = await db
      .collection("tblactivityrequest")
      .updateOne(filter, updateDoc);

    // ============================
    // ❗ If nothing matched
    // ============================
    if (result.matchedCount === 0) {
      return res.status(404).json({
        status: "fail",
        message: "No proposal found for the given SchoolID and RequestID.",
      });
    }

    // ============================
    // 🎉 Success
    // ============================
    return res.status(200).json({
      status: "success",
      message: "ProposalMessage updated successfully.",
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount,
    });

  } catch (error) {
    console.error("Error in updateSchProposal:", error);
    return next(error);
  }
};

