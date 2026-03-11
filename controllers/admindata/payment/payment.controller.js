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
 
 // Save payment to School or Vendor (with optional SchoolID and VendorID)
exports.paytoSchVdr = async (req, res, next) => {
  try {
    const {
      RequestID = '',
      ActivityID = '',
      // Now optional (can be omitted; we’ll infer from Activity if possible)
      SchoolID,
      VendorID,

      schPaidAmount,
      schPaidDate = '',
      schPaidNote = '',
      schPaidPaymentType = '',

      CreatedDate,
      CreatedBy = '',
      ModifyDate,
      ModifyBy = '',
      PaySection = '',
    } = req.body || {};

    // --------- basic validations ---------
    if (!RequestID) return res.status(400).json({ success: false, message: 'RequestID is required' });
    if (!ActivityID) return res.status(400).json({ success: false, message: 'ActivityID is required' });

    const amount = Number(schPaidAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ success: false, message: 'schPaidAmount must be a positive number' });
    }

    // Accept YYYY-MM-DD or ISO; store YYYY-MM-DD for reporting
    const dateStr = (schPaidDate || '').trim();
    if (!dateStr) return res.status(400).json({ success: false, message: 'schPaidDate is required' });
    const paidDate = new Date(dateStr);
    if (Number.isNaN(paidDate.getTime())) {
      return res.status(400).json({ success: false, message: 'schPaidDate must be a valid date (YYYY-MM-DD or ISO)' });
    }

    const TYPE_SET = new Set(['CASH', 'BANK-TRANSFER', 'ONLINE', 'OTHER']);
    const type = (schPaidPaymentType || '').toUpperCase();
    if (!TYPE_SET.has(type)) {
      return res.status(400).json({
        success: false,
        message: 'schPaidPaymentType must be CASH, BANK-TRANSFER, ONLINE, or OTHER',
      });
    }

    const now = new Date();
    const createdISO = CreatedDate ? new Date(CreatedDate).toISOString() : now.toISOString();
    const modifyISO = ModifyDate ? new Date(ModifyDate).toISOString() : now.toISOString();

    const db = await connectToMongoDB();
    const payColl = db.collection('tblPayToSchVdrInfo');
    const activityColl = db.collection('tblactivityinfo');

    // ---- ensure activity exists (source of truth for SchoolID/VendorID) ----
    const actDoc = await activityColl.findOne({ ActivityID });
    if (!actDoc) {
      return res.status(400).json({ success: false, message: 'Activity not found for given ActivityID' });
    }

    // ---- infer optional IDs if not provided ----
    const schoolIdToUse =
      SchoolID ??
      actDoc.SchoolID ??
      actDoc.schoolId ??
      actDoc.SchID ??
      null;

    const vendorIdToUse =
      VendorID ??
      actDoc.VendorID ??
      actDoc.vendorId ??
      null;

    const PayID = generateUniqueId();
    const YearMonth = `${paidDate.getUTCFullYear()}-${String(paidDate.getUTCMonth() + 1).padStart(2, '0')}`;

    const doc = {
      _id: PayID,            // store UUID as primary id
      PayID,                 // redundant but convenient for queries/exports

      RequestID,
      ActivityID,

      // Optional; kept if present or inferred (can be null if unknown)
      SchoolID: schoolIdToUse,
      VendorID: vendorIdToUse,

      // Payment fields
      schPaidAmount: amount,
      schPaidDate: paidDate.toISOString().slice(0, 10), // yyyy-mm-dd
      schPaidNote: schPaidNote || '',
      schPaidPaymentType: type,
      PaySection,

      // Reporting helpers
      YearMonth,

      // Audit
      CreatedDate: createdISO,
      CreatedBy,
      ModifyDate: modifyISO,
      ModifyBy,

      // Soft-delete flag (ensure default false so aggregations can exclude deleted docs)
      Deleted: false,
    };

    // Insert payment
    await payColl.insertOne(doc);

    // Compute running totals for this RequestID
    const agg = await payColl
      .aggregate([
        { $match: { RequestID, Deleted: { $ne: true } } }, // exclude soft-deleted
        {
          $group: {
            _id: '$RequestID',
            totalPaid: { $sum: '$schPaidAmount' },
            count: { $sum: 1 },
          },
        },
      ])
      .toArray();

    const summary = agg[0] || { totalPaid: 0, count: 0 };

    return res.status(201).json({
      success: true,
      message: 'Payment saved successfully.',
      data: {
        payment: doc,
        summary: {
          RequestID,
          totalPaid: summary.totalPaid,
          paymentCount: summary.count,
        },
      },
      statusCode: 201,
    });
  } catch (error) {
    console.error('Error in paytoSchVdr:', error);
    return next(error);
  }
};


 exports.getSchVdr = async (req, res, next) => {
  try {
    const {
      RequestID = "",   // ✅ required
      ActivityID = "",  // ✅ required
      PaySection = "",  // ✅ required
      SchoolID = "",    // optional
      VendorID = "",    // optional
    } = req.body || {};

    // -------- validations --------
    if (!RequestID) {
      return res.status(400).json({ success: false, message: "RequestID is required" });
    }
    if (!ActivityID) {
      return res.status(400).json({ success: false, message: "ActivityID is required" });
    }
    if (!PaySection) {
      return res.status(400).json({ success: false, message: "PaySection is required" });
    }
    const section = (PaySection || "").toUpperCase().trim();
    if (!["SCHOOL", "VENDOR"].includes(section)) {
      return res.status(400).json({ success: false, message: "PaySection must be SCHOOL or VENDOR" });
    }

    // -------- build filter --------
    const filter = { RequestID, ActivityID, PaySection: section };
    if (SchoolID) filter.SchoolID = SchoolID;
    if (VendorID) filter.VendorID = VendorID;

    // -------- db connection --------
    const db = await connectToMongoDB();
    const coll = db.collection("tblPayToSchVdrInfo");

    // -------- fetch all records --------
    const records = await coll.find(filter).sort({ schPaidDate: -1 }).toArray();

    // -------- summary --------
    const agg = await coll.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          totalPaid: { $sum: "$schPaidAmount" },
          count: { $sum: 1 },
        },
      },
    ]).toArray();

    const summary = agg[0] || { totalPaid: 0, count: 0 };

    return res.status(200).json({
      success: true,
      data: {
        records,
        summary,
      },
      statusCode: 200,
    });
  } catch (error) {
    console.error("Error in getSchVdr:", error);
    return next(error);
  }
};

