// controllers/trip.controller.js

const { connectToMongoDB } = require("../../../database/mongodb");
const { generateUniqueId } = require("../../../controllers/operation/operation");
const crypto = require("crypto");
const { ObjectId } = require("mongodb");

const { createUser } = require("../../service/userService");

// S3 upload helpers (kids image)
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { v4: uuidv4 } = require("uuid");
const mime = require("mime-types");
const path = require("path"); // ✅ ADDED

// ✅ Helper function to send responses
function sendResponse(res, message, error, results = null, totalCount = null) {
  res.status(error ? 400 : 200).json({
    statusCode: error ? 400 : 200,
    message: message,
    data: results,
    error: error,
    totalCount: totalCount,
  });
}

// -------------------------------------------------------------
// ✅ S3 CONFIG (FIXED: no duplicate declarations / single source)
// -------------------------------------------------------------
const AWS_S3_BUCKET = String(process.env.AWS_BUCKET_NAME || "").trim(); // dev-heroz-assets
const AWS_S3_REGION = String(process.env.AWS_BUCKET_REGION || "").trim(); // me-central-1

const AWS_ACCESS_KEY = String(process.env.AWS_ACCESS_KEY || "").trim();
const AWS_SECRET_KEY = String(process.env.AWS_SECRET_KEY || "").trim();

// if you use IAM role on EC2, you can remove credentials block below
const s3 = new S3Client({
  region: AWS_S3_REGION || process.env.AWS_REGION,
  ...(AWS_ACCESS_KEY && AWS_SECRET_KEY
    ? {
        credentials: {
          accessKeyId: AWS_ACCESS_KEY,
          secretAccessKey: AWS_SECRET_KEY,
        },
      }
    : {}),
});

// ✅ Use region-specific URL
function buildS3PublicUrl(key) {
  if (!AWS_S3_BUCKET || !AWS_S3_REGION) return null;
  const k = String(key || "").replace(/^\/+/, "");
  return `https://${AWS_S3_BUCKET}.s3.${AWS_S3_REGION}.amazonaws.com/${k}`;
}

// ✅ ADDED: safer ext + content-type detection (prevents .bin)
function detectImageExt(file) {
  const allowed = new Set(["jpg", "jpeg", "png", "webp", "gif", "bmp", "heic", "heif"]);

  // 1) prefer original filename extension
  const extFromName = path.extname(file?.originalname || "").toLowerCase().replace(".", "");
  if (extFromName && allowed.has(extFromName)) return extFromName === "jpeg" ? "jpg" : extFromName;

  // 2) fallback to mimetype -> ext
  const mt = String(file?.mimetype || "").toLowerCase().trim();
  const extFromMime = mime.extension(mt); // could be "bin"
  if (extFromMime && allowed.has(String(extFromMime).toLowerCase())) {
    const e = String(extFromMime).toLowerCase();
    return e === "jpeg" ? "jpg" : e;
  }

  // 3) default
  return "jpg";
}

function detectContentType(file, chosenExt) {
  const mt = String(file?.mimetype || "").toLowerCase().trim();

  // if already proper image mime
  if (mt.startsWith("image/")) return mt;

  // try from filename
  const byName = mime.lookup(file?.originalname || "");
  if (byName && String(byName).startsWith("image/")) return String(byName);

  // fallback from ext
  const byExt = mime.lookup(`file.${chosenExt}`);
  if (byExt && String(byExt).startsWith("image/")) return String(byExt);

  // last resort
  return "image/jpeg";
}

async function uploadKidsImageToS3(file) {
  if (!file || !file.buffer) return null;
  if (!AWS_S3_BUCKET || !AWS_S3_REGION) return null;

  // ✅ FIXED: never allow "bin" extension
  const safeExt = detectImageExt(file);

  // ✅ FIXED: never store octet-stream as ContentType
  const contentType = detectContentType(file, safeExt);

  // ✅ Upload into "users/"
  const key = `users/${uuidv4()}.${safeExt}`;

  const cmd = new PutObjectCommand({
    Bucket: AWS_S3_BUCKET,
    Key: key,
    Body: file.buffer,
    ContentType: contentType,
    CacheControl: "public, max-age=31536000",
  });

  await s3.send(cmd);

  return { key, publicUrl: buildS3PublicUrl(key), contentType, ext: safeExt };
}

// -------------------------------------------------------------
// ✅ Common helpers (kept from your code, cleaned)
// -------------------------------------------------------------
const sanitize = (obj) => JSON.parse(JSON.stringify(obj || {}));

const normalizeImageName = (v) => {
  const s = String(v ?? "").trim();
  return s !== "" ? s : "logo.png";
};

const normalizeGender = (v) => {
  const s = String(v ?? "").trim().toUpperCase();
  if (!s) return null;
  if (["MALE", "M", "BOY"].includes(s)) return "MALE";
  if (["FEMALE", "F", "GIRL"].includes(s)) return "FEMALE";
  return s;
};

const normalizeText = (v, maxLen = null) => {
  const s = String(v ?? "").trim();
  if (!s) return "";
  if (maxLen && s.length > maxLen) return s.slice(0, maxLen);
  return s;
};

const normalizeDOB = (v) => {
  if (v === null || v === undefined || v === "") return null;

  if (v instanceof Date && !isNaN(v.getTime())) return v;

  if (typeof v === "number") {
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d;
  }

  const s = String(v).trim();
  if (!s) return null;

  let d = new Date(s);
  if (!isNaN(d.getTime())) return d;

  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    d = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00.000Z`);
    return isNaN(d.getTime()) ? null : d;
  }

  return null;
};

const numOrNull = (v) =>
  typeof v === "number" ? v : v !== undefined && v !== null && v !== "" ? Number(v) : null;

const safeNumber = (v) => (typeof v === "number" ? v : 0);

// -------------------------------------------------------------
// ✅ WorkinggettripSummary (kept; no changes except minor cleanup)
// -------------------------------------------------------------
exports.WorkinggettripSummary = async (req, res, next) => {
  try {
    const db = await connectToMongoDB();
    const { RequestID, SchoolID, VendorID } = req.body;

    if (!RequestID) return res.status(400).json({ message: "RequestID is required." });

    const activityRequest = await db.collection("tblactivityrequest").findOne(
      { RequestID },
      {
        projection: {
          actTotalNoStudents: 1,
          SchoolID: 1,
          VendorID: 1,
          vendorId: 1,
          VENDORID: 1,
        },
      }
    );

    const actTotalNoStudents = activityRequest?.actTotalNoStudents ?? 0;

    const emptyShape = (actTotalPaidStudents = 0) => ({
      status: "success",
      total: 0,
      actTotalPaidStudents,
      actTotalNoStudents,
      data: [],
      TripSummary: {
        SchoolPaymentSummary: { SchoolTotalTripCost: 0, SchoolTotalFoodExtraCost: 0 },
        VendorPaymentSummary: { TotalTripCost: 0, TotalFoodExtraCost: 0 },
        HerozPaymentSummary: { TotalTripCost: 0, TotalFoodExtraCost: 0 },
        FoodExtra: [{}],
        FoodInclude: [{}],
      },
      activeStudentSumamry: {
        TotalActiveStudents: 0,
        TotalActiveStudentsPaidByOnline: 0,
        TotalActiveStudentsPaidByCash: 0,
      },
    });

    if (SchoolID !== undefined && SchoolID !== null && SchoolID !== "") {
      const arSchool = activityRequest?.SchoolID ?? null;
      if (!arSchool || String(arSchool) !== String(SchoolID)) return res.status(200).json(emptyShape(0));
    }

    if (VendorID !== undefined && VendorID !== null && VendorID !== "") {
      const arVendor = activityRequest?.VendorID ?? activityRequest?.vendorId ?? activityRequest?.VENDORID ?? null;
      if (!arVendor || String(arVendor) !== String(VendorID)) return res.status(200).json(emptyShape(0));
    }

    const kids = await db.collection("tblBookTripKidsInfo").find({ RequestID }).toArray();
    const actTotalPaidStudents = kids.length;

    if (kids.length === 0) return res.status(200).json(emptyShape(0));

    const parentIDs = [...new Set(kids.map((k) => k.ParentsID))];
    const kidsIDs = kids.map((k) => k.KidsID);

    const parents = await db
      .collection("tblBookTripParentsInfo")
      .find({ RequestID, ParentsID: { $in: parentIDs } })
      .toArray();

    const parentsMap = {};
    parents.forEach((p) => {
      parentsMap[p.ParentsID] = {
        tripParentsName: p.tripParentsName,
        tripParentsMobileNo: p.tripParentsMobileNo,
        tripParentsNote: p.tripParentsNote,
      };
    });

    const paymentsAgg = await db
      .collection("tblBookTripPayInfo")
      .aggregate([
        { $match: { RequestID, KidsID: { $in: kidsIDs } } },
        { $sort: { KidsID: 1, CreatedDate: -1 } },
        { $group: { _id: "$KidsID", doc: { $first: "$$ROOT" } } },
      ])
      .toArray();

    const paymentsByKid = {};
    paymentsAgg.forEach((p) => (paymentsByKid[p._id] = p.doc));

    const [foodIncludedLinks, foodExtraLinks] = await Promise.all([
      db.collection("tblBookKidsFoodIncluded").find({ RequestID, KidsID: { $in: kidsIDs } }).toArray(),
      db.collection("tblBookKidsFoodExtra").find({ RequestID, KidsID: { $in: kidsIDs } }).toArray(),
    ]);

    const foodIDs = [
      ...new Set([
        ...foodIncludedLinks.map((f) => f.FoodID),
        ...foodExtraLinks.map((f) => f.FoodID),
      ]),
    ];

    const foodInfo = foodIDs.length
      ? await db.collection("tblactfoodinfo").find({ FoodID: { $in: foodIDs } }).toArray()
      : [];

    const foodMap = {};
    foodInfo.forEach((f) => (foodMap[f.FoodID] = f.FoodName || f.foodName || f.name || ""));

    const includedByKid = new Map();
    const extraByKid = new Map();

    for (const link of foodIncludedLinks) {
      if (!includedByKid.has(link.KidsID)) includedByKid.set(link.KidsID, []);
      includedByKid.get(link.KidsID).push(link);
    }
    for (const link of foodExtraLinks) {
      if (!extraByKid.has(link.KidsID)) extraByKid.set(link.KidsID, []);
      extraByKid.get(link.KidsID).push(link);
    }

    const includeCounts = {};
    const extraCounts = {};

    let totalTripSchoolPrice = 0;
    let totalFoodExtraSchoolPrice = 0;

    let totalTripVendorCost = 0;
    let totalFoodExtraVendorPrice = 0;

    let totalTripHerozCost = 0;
    let totalFoodExtraHerozPrice = 0;

    const ONLINE_TYPES = new Set([
      "ONLINE",
      "CARD",
      "VISA",
      "MASTER",
      "MASTERCARD",
      "MADA",
      "APPLEPAY",
      "STC_PAY",
      "KNET",
      "DEBIT",
      "CREDIT",
      "PAYMENT_GATEWAY",
      "TABBY",
      "TAMARA",
      "SADAD",
    ]);
    let totalActiveStudentsPaidByOnline = 0;
    let totalActiveStudentsPaidByCash = 0;

    const finalList = kids.map((kid) => {
      const parent = parentsMap[kid.ParentsID] || {};
      const pay = paymentsByKid[kid.KidsID] || {};

      const TripVendorCost = numOrNull(pay?.TripVendorCost);
      const TripHerozCost = numOrNull(pay?.TripHerozCost);
      const TripSchoolPrice = numOrNull(pay?.TripSchoolPrice);

      if (typeof TripSchoolPrice === "number") totalTripSchoolPrice += TripSchoolPrice;
      if (typeof TripVendorCost === "number") totalTripVendorCost += TripVendorCost;
      if (typeof TripHerozCost === "number") totalTripHerozCost += TripHerozCost;

      const payType = (pay?.PayTypeID || "").toString().trim().toUpperCase();
      if (payType) {
        if (payType === "CASH") totalActiveStudentsPaidByCash += 1;
        else totalActiveStudentsPaidByOnline += 1;
      }

      const kidIncludedFoods = (includedByKid.get(kid.KidsID) || [])
        .map((link) => {
          const FoodName = foodMap[link.FoodID] || "";
          if (FoodName) includeCounts[FoodName] = (includeCounts[FoodName] || 0) + 1;
          return {
            FoodName,
            FoodSchoolPrice: numOrNull(link?.FoodSchoolPrice),
            FoodVendorPrice: numOrNull(link?.FoodVendorPrice),
            FoodHerozPrice: numOrNull(link?.FoodHerozPrice),
          };
        })
        .filter((x) => x.FoodName);

      const kidExtraFoods = (extraByKid.get(kid.KidsID) || [])
        .map((link) => {
          const FoodName = foodMap[link.FoodID] || "";
          if (FoodName) extraCounts[FoodName] = (extraCounts[FoodName] || 0) + 1;

          const FoodSchoolPrice = numOrNull(link?.FoodSchoolPrice);
          const FoodVendorPrice = numOrNull(link?.FoodVendorPrice);
          const FoodHerozPrice = numOrNull(link?.FoodHerozPrice);

          if (typeof FoodSchoolPrice === "number") totalFoodExtraSchoolPrice += FoodSchoolPrice;
          if (typeof FoodVendorPrice === "number") totalFoodExtraVendorPrice += FoodVendorPrice;
          if (typeof FoodHerozPrice === "number") totalFoodExtraHerozPrice += FoodHerozPrice;

          return { FoodName, FoodSchoolPrice, FoodVendorPrice, FoodHerozPrice };
        })
        .filter((x) => x.FoodName);

      return {
        TripKidsSchoolNo: kid.TripKidsSchoolNo,
        KidsID: kid.KidsID,
        TripKidsName: kid.TripKidsName,
        tripKidsClassName: kid.tripKidsClassName,
        tripKidsStatus: kid.tripKidsStatus,
        tripParentsName: parent.tripParentsName || "",
        tripParentsMobileNo: parent.tripParentsMobileNo || "",
        tripParentsNote: parent.tripParentsNote || "",
        PayRefNo: pay?.PayRefNo ?? null,
        PayTypeID: pay?.PayTypeID ?? null,
        tripPaymentTypeID: pay?.tripPaymentTypeID ?? null,
        TripCost: numOrNull(pay?.TripCost),
        TripFoodCost: numOrNull(pay?.TripFoodCost),
        TripTaxAmount: numOrNull(pay?.TripTaxAmount),
        TripFullAmount: numOrNull(pay?.TripFullAmount),
        TripVendorCost,
        TripHerozCost,
        TripSchoolPrice,
        PayStatus: pay?.PayStatus ?? null,
        InvoiceNo: pay?.InvoiceNo ?? null,
        MyFatrooahRefNo: pay?.MyFatrooahRefNo ?? null,
        PayDate: pay?.PayDate ?? null,
        CreatedDate: pay?.CreatedDate ?? null,
        IncFoodInfo: kidIncludedFoods,
        ExtraFoodInfo: kidExtraFoods,
      };
    });

    const TripSummary = {
      SchoolPaymentSummary: {
        SchoolTotalTripCost: totalTripSchoolPrice,
        SchoolTotalFoodExtraCost: totalFoodExtraSchoolPrice,
      },
      VendorPaymentSummary: {
        TotalTripCost: totalTripVendorCost,
        TotalFoodExtraCost: totalFoodExtraVendorPrice,
      },
      HerozPaymentSummary: {
        TotalTripCost: totalTripHerozCost,
        TotalFoodExtraCost: totalFoodExtraHerozPrice,
      },
      FoodExtra: [extraCounts],
      FoodInclude: [includeCounts],
    };

    const activeStudentSumamry = {
      TotalActiveStudents: actTotalPaidStudents,
      TotalActiveStudentsPaidByOnline: totalActiveStudentsPaidByOnline,
      TotalActiveStudentsPaidByCash: totalActiveStudentsPaidByCash,
    };

    return res.status(200).json({
      status: "success",
      total: finalList.length,
      actTotalPaidStudents,
      actTotalNoStudents,
      data: finalList,
      TripSummary,
      activeStudentSumamry,
    });
  } catch (error) {
    console.error("Error in gettripSummary:", error);
    next(error);
  }
};

// -------------------------------------------------------------
// ✅ gettripSummary (your expanded one) — kept as-is, but cleaned
// -------------------------------------------------------------
exports.gettripSummary = async (req, res, next) => {
  try {
    const db = await connectToMongoDB();
    const { RequestID, SchoolID, VendorID, tripKidsStatus } = req.body;

    const ActivityImageUrl = (process.env.ActivityImageUrl || "").toString().trim();

    const joinUrl = (base, fileName) => {
      const b = (base || "").toString().trim();
      const f = (fileName || "").toString().trim();
      if (!b || !f) return null;
      const cleanBase = b.endsWith("/") ? b.slice(0, -1) : b;
      const cleanFile = f.startsWith("/") ? f.slice(1) : f;
      return `${cleanBase}/${cleanFile}`;
    };

    if (!RequestID) return res.status(400).json({ message: "RequestID is required." });

    const activityRequest = await db.collection("tblactivityrequest").findOne(
      { RequestID },
      {
        projection: {
          actTotalNoStudents: 1,
          SchoolID: 1,
          VendorID: 1,
          vendorId: 1,
          VENDORID: 1,
          actTripSendToVendor: 1,
          actTripSendToVendorNotes: 1,
          ActivityID: 1,
          actRequestRefNo: 1,
          actRequestDate: 1,
          actRequestTime: 1,
        },
      }
    );

    const actTotalNoStudents = activityRequest?.actTotalNoStudents ?? 0;
    const actTripSendToVendor = activityRequest?.actTripSendToVendor ?? null;
    const actTripSendToVendorNotes = activityRequest?.actTripSendToVendorNotes ?? null;

    let TripInformation = {
      actRequestRefNo: null,
      actRequestDate: null,
      actRequestTime: null,
      actTotalNoStudentsExpected: 0,
      actName: null,
      vdrName: null,
      schName: null,
      actImageName1: null,
      actImageName2: null,
      actImageName3: null,
      actImageName1Url: null,
      actImageName2Url: null,
      actImageName3Url: null,
    };

    if (activityRequest) {
      TripInformation.actRequestRefNo = activityRequest.actRequestRefNo ?? null;
      TripInformation.actRequestDate = activityRequest.actRequestDate ?? null;
      TripInformation.actRequestTime = activityRequest.actRequestTime ?? null;
      TripInformation.actTotalNoStudentsExpected = activityRequest.actTotalNoStudents ?? 0;

      let actName = null;
      let vdrName = null;
      let schName = null;

      let actImageName1 = null;
      let actImageName2 = null;
      let actImageName3 = null;

      if (activityRequest.ActivityID) {
        const actInfo = await db.collection("tblactivityinfo").findOne(
          { ActivityID: activityRequest.ActivityID },
          {
            projection: {
              actName: 1,
              VendorID: 1,
              actImageName1: 1,
              actImageName2: 1,
              actImageName3: 1,
            },
          }
        );

        if (actInfo) {
          actName = actInfo.actName ?? null;
          actImageName1 = actInfo.actImageName1 ?? null;
          actImageName2 = actInfo.actImageName2 ?? null;
          actImageName3 = actInfo.actImageName3 ?? null;

          const vendorIdFromActInfo = actInfo.VendorID ?? null;
          if (vendorIdFromActInfo) {
            const vendorDoc = await db.collection("tblvendorinfo").findOne(
              { VendorID: vendorIdFromActInfo },
              { projection: { vdrName: 1 } }
            );
            if (vendorDoc) vdrName = vendorDoc.vdrName ?? null;
          }
        }
      }

      if (activityRequest.SchoolID) {
        const schoolDoc = await db.collection("tblschoolinfo").findOne(
          { SchoolID: activityRequest.SchoolID },
          { projection: { schName: 1 } }
        );
        if (schoolDoc) schName = schoolDoc.schName ?? null;
      }

      TripInformation.actName = actName;
      TripInformation.vdrName = vdrName;
      TripInformation.schName = schName;

      TripInformation.actImageName1 = actImageName1;
      TripInformation.actImageName2 = actImageName2;
      TripInformation.actImageName3 = actImageName3;

      TripInformation.actImageName1Url = joinUrl(ActivityImageUrl, actImageName1);
      TripInformation.actImageName2Url = joinUrl(ActivityImageUrl, actImageName2);
      TripInformation.actImageName3Url = joinUrl(ActivityImageUrl, actImageName3);
    }

    const buildEmptyTripSummary = () => ({
      SchoolPaymentSummary: {
        SchoolBuyTripCost: 0,
        SchoolTotalTripCost: 0,
        SchoolTotalFoodExtraCost: 0,
        SchoolPriceVatAmount: 0,
        SchoolFoodPriceVatAmount: 0,
        SchoolTotalProfitWithOutVat: 0,
        SchoolTotalProfitWithVat: 0,
        SchoolTotalVatAmount: 0,
      },
      VendorPaymentSummary: {
        TotalTripCost: 0,
        TotalFoodExtraCost: 0,
        actPriceVatAmount: 0,
        VendorFoodPriceVatAmount: 0,
        VendorTotalProfitWithOutVat: 0,
        VendorTotalProfitWithVat: 0,
        VendorTotalVatAmount: 0,
      },
      HerozPaymentSummary: {
        TotalTripCost: 0,
        TotalFoodExtraCost: 0,
        HerozStudentPriceVatAmount: 0,
        HerozFoodPriceVatAmount: 0,
        HerozTotalProfitWithOutVat: 0,
        HerozTotalProfitWithVat: 0,
        HerozTotalVatAmount: 0,
      },
      FoodExtra: [{}],
      FoodInclude: [{}],
    });

    if (SchoolID !== undefined && SchoolID !== null && SchoolID !== "") {
      const arSchool = activityRequest?.SchoolID ?? null;
      if (!arSchool || String(arSchool) !== String(SchoolID)) {
        return res.status(200).json({
          status: "success",
          total: 0,
          actTotalPaidStudents: 0,
          actTotalNoStudents,
          data: [],
          TripSummary: buildEmptyTripSummary(),
          activeStudentSumamry: { TotalActiveStudents: 0, TotalActiveStudentsPaidByOnline: 0, TotalActiveStudentsPaidByCash: 0 },
          actTripSendToVendor,
          actTripSendToVendorNotes,
          actPriceVatAmount: 0,
          HerozStudentPriceVatAmount: 0,
          SchoolPriceVatAmount: 0,
          TripInformation,
        });
      }
    }

    if (VendorID !== undefined && VendorID !== null && VendorID !== "") {
      const arVendor = activityRequest?.VendorID ?? activityRequest?.vendorId ?? activityRequest?.VENDORID ?? null;
      if (!arVendor || String(arVendor) !== String(VendorID)) {
        return res.status(200).json({
          status: "success",
          total: 0,
          actTotalPaidStudents: 0,
          actTotalNoStudents,
          data: [],
          TripSummary: buildEmptyTripSummary(),
          activeStudentSumamry: { TotalActiveStudents: 0, TotalActiveStudentsPaidByOnline: 0, TotalActiveStudentsPaidByCash: 0 },
          actTripSendToVendor,
          actTripSendToVendorNotes,
          actPriceVatAmount: 0,
          HerozStudentPriceVatAmount: 0,
          SchoolPriceVatAmount: 0,
          TripInformation,
        });
      }
    }

    const approvedKidsIDs = await db.collection("tblBookTripPayInfo").distinct("KidsID", { RequestID, PayStatus: "APPROVED" });

    const kidsQuery = { RequestID, KidsID: { $in: approvedKidsIDs } };
    if (tripKidsStatus !== undefined && tripKidsStatus !== null && tripKidsStatus !== "") {
      kidsQuery.tripKidsStatus = String(tripKidsStatus).toUpperCase().trim();
    }

    const kids = await db.collection("tblBookTripKidsInfo").find(kidsQuery).toArray();
    const actTotalPaidStudents = kids.length;

    if (kids.length === 0) {
      return res.status(200).json({
        status: "success",
        total: 0,
        actTotalPaidStudents,
        actTotalNoStudents,
        data: [],
        TripSummary: buildEmptyTripSummary(),
        activeStudentSumamry: { TotalActiveStudents: 0, TotalActiveStudentsPaidByOnline: 0, TotalActiveStudentsPaidByCash: 0 },
        actTripSendToVendor,
        actTripSendToVendorNotes,
        actPriceVatAmount: 0,
        HerozStudentPriceVatAmount: 0,
        SchoolPriceVatAmount: 0,
        TripInformation,
      });
    }

    const parentIDs = [...new Set(kids.map((k) => k.ParentsID))];
    const kidsIDs = kids.map((k) => k.KidsID);

    const parents = await db.collection("tblBookTripParentsInfo").find(
      { RequestID, ParentsID: { $in: parentIDs } },
      { projection: { ParentsID: 1, tripParentsName: 1, tripParentsMobileNo: 1, tripParentsNote: 1, tripKidsClassName: 1 } }
    ).toArray();

    const parentsMap = {};
    parents.forEach((p) => {
      parentsMap[p.ParentsID] = {
        tripParentsName: p.tripParentsName,
        tripParentsMobileNo: p.tripParentsMobileNo,
        tripParentsNote: p.tripParentsNote,
        tripKidsClassName: p.tripKidsClassName,
      };
    });

    const paymentsAgg = await db.collection("tblBookTripPayInfo").aggregate([
      { $match: { RequestID, KidsID: { $in: kidsIDs }, PayStatus: "APPROVED" } },
      { $sort: { KidsID: 1, CreatedDate: -1 } },
      { $group: { _id: "$KidsID", doc: { $first: "$$ROOT" } } },
    ]).toArray();

    const paymentsByKid = {};
    paymentsAgg.forEach((p) => (paymentsByKid[p._id] = p.doc));

    const [foodIncludedLinks, foodExtraLinks] = await Promise.all([
      db.collection("tblBookKidsFoodIncluded").find({ RequestID, KidsID: { $in: kidsIDs } }).toArray(),
      db.collection("tblBookKidsFoodExtra").find({ RequestID, KidsID: { $in: kidsIDs } }).toArray(),
    ]);

    const foodIDs = [
      ...new Set([
        ...foodIncludedLinks.map((f) => f.FoodID),
        ...foodExtraLinks.map((f) => f.FoodID),
      ]),
    ];

    let foodInfo = [];
    let schRequestFoodInfo = [];
    if (foodIDs.length) {
      [foodInfo, schRequestFoodInfo] = await Promise.all([
        db.collection("tblactfoodinfo").find({ FoodID: { $in: foodIDs } }).toArray(),
        db.collection("tblschrequestfoodinfo").find({ RequestID, FoodID: { $in: foodIDs } }).toArray(),
      ]);
    }

    const foodMap = {};
    foodInfo.forEach((f) => {
      foodMap[f.FoodID] = {
        FoodName: f.FoodName || f.foodName || f.name || "",
        FoodPriceVatAmount: numOrNull(f?.FoodPriceVatAmount),
        FoodHerozPriceVatAmount: numOrNull(f?.FoodHerozPriceVatAmount),
      };
    });

    const schFoodVatMap = {};
    schRequestFoodInfo.forEach((r) => {
      schFoodVatMap[r.FoodID] = { FoodSchoolPriceVatAmount: numOrNull(r?.FoodSchoolPriceVatAmount) };
    });

    let actPriceVatAmount = null;
    let HerozStudentPriceVatAmount = null;
    let SchoolPriceVatAmount = null;

    if (activityRequest) {
      const arVendorForPrice = activityRequest?.VendorID ?? activityRequest?.vendorId ?? activityRequest?.VENDORID ?? null;

      if (activityRequest.ActivityID && arVendorForPrice) {
        const actPriceDoc = await db.collection("tblactpriceinfo").findOne(
          { ActivityID: activityRequest.ActivityID, VendorID: arVendorForPrice },
          { projection: { actPriceVatAmount: 1, HerozStudentPriceVatAmount: 1 } }
        );
        if (actPriceDoc) {
          actPriceVatAmount = numOrNull(actPriceDoc.actPriceVatAmount);
          HerozStudentPriceVatAmount = numOrNull(actPriceDoc.HerozStudentPriceVatAmount);
        }
      }

      const schReqPriceDoc = await db.collection("tblschrequestpriceinfo").findOne(
        { RequestID },
        { projection: { SchoolPriceVatAmount: 1 } }
      );
      if (schReqPriceDoc) SchoolPriceVatAmount = numOrNull(schReqPriceDoc.SchoolPriceVatAmount);
    }

    const includedByKid = new Map();
    const extraByKid = new Map();

    for (const link of foodIncludedLinks) {
      if (!includedByKid.has(link.KidsID)) includedByKid.set(link.KidsID, []);
      includedByKid.get(link.KidsID).push(link);
    }
    for (const link of foodExtraLinks) {
      if (!extraByKid.has(link.KidsID)) extraByKid.set(link.KidsID, []);
      extraByKid.get(link.KidsID).push(link);
    }

    const includeCounts = {};
    const extraCounts = {};

    let totalTripSchoolPrice = 0;
    let totalFoodExtraSchoolPrice = 0;

    let totalTripVendorCost = 0;
    let totalFoodExtraVendorPrice = 0;

    let totalTripHerozCost = 0;
    let totalFoodExtraHerozPrice = 0;

    let totalFoodVatSchool = 0;
    let totalFoodVatVendor = 0;
    let totalFoodVatHeroz = 0;

    const ONLINE_TYPES = new Set([
      "ONLINE",
      "CARD",
      "VISA",
      "MASTER",
      "MASTERCARD",
      "MADA",
      "APPLEPAY",
      "STC_PAY",
      "KNET",
      "DEBIT",
      "CREDIT",
      "PAYMENT_GATEWAY",
      "TABBY",
      "TAMARA",
      "SADAD",
    ]);
    let totalActiveStudentsPaidByOnline = 0;
    let totalActiveStudentsPaidByCash = 0;

    const finalList = kids.map((kid) => {
      const parent = parentsMap[kid.ParentsID] || {};
      const pay = paymentsByKid[kid.KidsID] || {};

      const TripCost = numOrNull(pay?.TripCost);
      const TripFoodCost = numOrNull(pay?.TripFoodCost);

      const TripFoodVatAmount = numOrNull(
        pay?.TripFoodVatAmount !== undefined ? pay?.TripFoodVatAmount : pay?.TripTaxAmount
      );

      const TripFullAmount = numOrNull(pay?.TripFullAmount);

      const TripVendorCost = numOrNull(pay?.TripVendorCost);
      const TripHerozCost = numOrNull(pay?.TripHerozCost);
      const TripSchoolPrice = numOrNull(pay?.TripSchoolPrice);

      if (typeof TripSchoolPrice === "number") totalTripSchoolPrice += TripSchoolPrice;
      if (typeof TripVendorCost === "number") totalTripVendorCost += TripVendorCost;
      if (typeof TripHerozCost === "number") totalTripHerozCost += TripHerozCost;

      const payType = (pay?.PayTypeID || "").toString().trim().toUpperCase();
      if (payType) {
        if (payType === "CASH") totalActiveStudentsPaidByCash += 1;
        else totalActiveStudentsPaidByOnline += 1;
      }

      const kidIncludedFoods = (includedByKid.get(kid.KidsID) || [])
        .map((link) => {
          const food = foodMap[link.FoodID] || {};
          const vatSchool = schFoodVatMap[link.FoodID] || {};

          const FoodName = food.FoodName || "";
          if (FoodName) includeCounts[FoodName] = (includeCounts[FoodName] || 0) + 1;

          const FoodSchoolPrice = numOrNull(link?.FoodSchoolPrice);
          const FoodVendorPrice = numOrNull(link?.FoodVendorPrice);
          const FoodHerozPrice = numOrNull(link?.FoodHerozPrice);

          const incFoodPriceVatAmount = food.FoodPriceVatAmount ?? null;
          const incFoodHerozPriceVatAmount = food.FoodHerozPriceVatAmount ?? null;
          const incFoodSchoolPriceVatAmount = vatSchool.FoodSchoolPriceVatAmount ?? null;

          if (typeof incFoodSchoolPriceVatAmount === "number") totalFoodVatSchool += incFoodSchoolPriceVatAmount;
          if (typeof incFoodPriceVatAmount === "number") totalFoodVatVendor += incFoodPriceVatAmount;
          if (typeof incFoodHerozPriceVatAmount === "number") totalFoodVatHeroz += incFoodHerozPriceVatAmount;

          return { FoodName, FoodSchoolPrice, FoodVendorPrice, FoodHerozPrice };
        })
        .filter((x) => x.FoodName);

      const kidExtraFoods = (extraByKid.get(kid.KidsID) || [])
        .map((link) => {
          const food = foodMap[link.FoodID] || {};
          const vatSchool = schFoodVatMap[link.FoodID] || {};

          const FoodName = food.FoodName || "";
          if (FoodName) extraCounts[FoodName] = (extraCounts[FoodName] || 0) + 1;

          const FoodSchoolPrice = numOrNull(link?.FoodSchoolPrice);
          const FoodVendorPrice = numOrNull(link?.FoodVendorPrice);
          const FoodHerozPrice = numOrNull(link?.FoodHerozPrice);

          if (typeof FoodSchoolPrice === "number") totalFoodExtraSchoolPrice += FoodSchoolPrice;
          if (typeof FoodVendorPrice === "number") totalFoodExtraVendorPrice += FoodVendorPrice;
          if (typeof FoodHerozPrice === "number") totalFoodExtraHerozPrice += FoodHerozPrice;

          const FoodPriceVatAmount = food.FoodPriceVatAmount ?? null;
          const FoodHerozPriceVatAmount = food.FoodHerozPriceVatAmount ?? null;
          const FoodSchoolPriceVatAmount = vatSchool.FoodSchoolPriceVatAmount ?? null;

          if (typeof FoodSchoolPriceVatAmount === "number") totalFoodVatSchool += FoodSchoolPriceVatAmount;
          if (typeof FoodPriceVatAmount === "number") totalFoodVatVendor += FoodPriceVatAmount;
          if (typeof FoodHerozPriceVatAmount === "number") totalFoodVatHeroz += FoodHerozPriceVatAmount;

          return {
            FoodName,
            FoodSchoolPrice,
            FoodVendorPrice,
            FoodHerozPrice,
            FoodPriceVatAmount,
            FoodHerozPriceVatAmount,
            FoodSchoolPriceVatAmount,
          };
        })
        .filter((x) => x.FoodName);

      return {
        TripKidsSchoolNo: kid.TripKidsSchoolNo,
        KidsID: kid.KidsID,
        TripKidsName: kid.TripKidsName,
        tripKidsClassName: parent.tripKidsClassName ?? kid.tripKidsClassName,
        tripKidsStatus: kid.tripKidsStatus,
        tripParentsName: parent.tripParentsName || "",
        tripParentsMobileNo: parent.tripParentsMobileNo || "",
        tripParentsNote: parent.tripParentsNote || "",
        PayRefNo: pay?.PayRefNo ?? null,
        PayTypeID: pay?.PayTypeID ?? null,
        tripPaymentTypeID: pay?.tripPaymentTypeID ?? null,
        TripCost,
        TripFoodCost,
        TripFoodVatAmount,
        TripFullAmount,
        TripVendorCost,
        TripHerozCost,
        TripSchoolPrice,
        actPriceVatAmount,
        HerozStudentPriceVatAmount,
        SchoolPriceVatAmount,
        PayStatus: pay?.PayStatus ?? null,
        InvoiceNo: pay?.InvoiceNo ?? null,
        MyFatrooahRefNo: pay?.MyFatrooahRefNo ?? null,
        PayDate: pay?.PayDate ?? null,
        CreatedDate: pay?.CreatedDate ?? null,
        IncFoodInfo: kidIncludedFoods,
        ExtraFoodInfo: kidExtraFoods,
      };
    });

    const totalSchoolPriceVatAmount =
      typeof SchoolPriceVatAmount === "number" ? SchoolPriceVatAmount * actTotalPaidStudents : null;

    const totalActPriceVatAmount =
      typeof actPriceVatAmount === "number" ? actPriceVatAmount * actTotalPaidStudents : null;

    const totalHerozStudentPriceVatAmount =
      typeof HerozStudentPriceVatAmount === "number" ? HerozStudentPriceVatAmount * actTotalPaidStudents : null;

    const schoolTotalWithoutVat = safeNumber(totalTripSchoolPrice) + safeNumber(totalFoodExtraSchoolPrice);

    const schoolTotalWithVat =
      schoolTotalWithoutVat + safeNumber(totalSchoolPriceVatAmount) + safeNumber(totalFoodVatSchool);

    const schoolTotalVatAmount = safeNumber(totalSchoolPriceVatAmount) + safeNumber(totalFoodVatSchool);

    let schoolBuyTripCost = 0;
    const totalBuyTripCost = safeNumber(totalTripVendorCost) + safeNumber(totalTripHerozCost);
    if (actTotalPaidStudents > 0) schoolBuyTripCost = totalBuyTripCost / actTotalPaidStudents;

    const vendorTotalWithoutVat = safeNumber(totalTripVendorCost) + safeNumber(totalFoodExtraVendorPrice);
    const vendorTotalWithVat = vendorTotalWithoutVat + safeNumber(totalActPriceVatAmount) + safeNumber(totalFoodVatVendor);
    const vendorTotalVatAmount = safeNumber(totalActPriceVatAmount) + safeNumber(totalFoodVatVendor);

    const herozTotalWithoutVat = safeNumber(totalTripHerozCost) + safeNumber(totalFoodExtraHerozPrice);
    const herozTotalWithVat =
      herozTotalWithoutVat + safeNumber(totalHerozStudentPriceVatAmount) + safeNumber(totalFoodVatHeroz);
    const herozTotalVatAmount = safeNumber(totalHerozStudentPriceVatAmount) + safeNumber(totalFoodVatHeroz);

    const TripSummary = {
      SchoolPaymentSummary: {
        SchoolBuyTripCost: schoolBuyTripCost,
        SchoolTotalTripCost: totalTripSchoolPrice,
        SchoolTotalFoodExtraCost: totalFoodExtraSchoolPrice,
        SchoolPriceVatAmount: totalSchoolPriceVatAmount,
        SchoolFoodPriceVatAmount: totalFoodVatSchool,
        SchoolTotalProfitWithOutVat: schoolTotalWithoutVat,
        SchoolTotalProfitWithVat: schoolTotalWithVat,
        SchoolTotalVatAmount: schoolTotalVatAmount,
      },
      VendorPaymentSummary: {
        TotalTripCost: totalTripVendorCost,
        TotalFoodExtraCost: totalFoodExtraVendorPrice,
        actPriceVatAmount: totalActPriceVatAmount,
        VendorFoodPriceVatAmount: totalFoodVatVendor,
        VendorTotalProfitWithOutVat: vendorTotalWithoutVat,
        VendorTotalProfitWithVat: vendorTotalWithVat,
        VendorTotalVatAmount: vendorTotalVatAmount,
      },
      HerozPaymentSummary: {
        TotalTripCost: totalTripHerozCost,
        TotalFoodExtraCost: totalFoodExtraHerozPrice,
        HerozStudentPriceVatAmount: totalHerozStudentPriceVatAmount,
        HerozFoodPriceVatAmount: totalFoodVatHeroz,
        HerozTotalProfitWithOutVat: herozTotalWithoutVat,
        HerozTotalProfitWithVat: herozTotalWithVat,
        HerozTotalVatAmount: herozTotalVatAmount,
      },
      FoodExtra: [extraCounts],
      FoodInclude: [includeCounts],
    };

    const activeStudentSumamry = {
      TotalActiveStudents: actTotalPaidStudents,
      TotalActiveStudentsPaidByOnline: totalActiveStudentsPaidByOnline,
      TotalActiveStudentsPaidByCash: totalActiveStudentsPaidByCash,
    };

    return res.status(200).json({
      status: "success",
      total: finalList.length,
      actTotalPaidStudents,
      actTotalNoStudents,
      data: finalList,
      TripSummary,
      activeStudentSumamry,
      actTripSendToVendor,
      actTripSendToVendorNotes,
      actPriceVatAmount,
      HerozStudentPriceVatAmount,
      SchoolPriceVatAmount,
      TripInformation,
    });
  } catch (error) {
    console.error("Error in gettripSummary:", error);
    next(error);
  }
};

// -------------------------------------------------------------
// ✅ gettripdata (your expanded one) — kept + minor safety
// -------------------------------------------------------------
exports.gettripdata = async (req, res, next) => {
  try {
    const db = await connectToMongoDB();
    const { RequestID, SchoolID, VendorID, tripKidsStatus } = req.body;

    if (!RequestID) return res.status(400).json({ message: "RequestID is required." });

    const actRequests = await db.collection("tblactivityrequest").find({ RequestID }).toArray();
    const activityRequest = actRequests?.[0] || null;

    const actTotalNoStudents = activityRequest?.actTotalNoStudents ?? 0;
    const actTripSendToVendor = activityRequest?.actTripSendToVendor ?? null;
    const actTripSendToVendorNotes = activityRequest?.actTripSendToVendorNotes ?? null;

    const buildEmptyTripSummary = () => ({
      status: "success",
      total: 0,
      actTotalPaidStudents: 0,
      actTotalNoStudents,
      data: [],
      TripSummary: {
        SchoolPaymentSummary: { SchoolTotalTripCost: 0, SchoolTotalFoodExtraCost: 0 },
        VendorPaymentSummary: { TotalTripCost: 0, TotalFoodExtraCost: 0 },
        HerozPaymentSummary: { TotalTripCost: 0, TotalFoodExtraCost: 0 },
        FoodExtra: [{}],
        FoodInclude: [{}],
      },
      activeStudentSumamry: { TotalActiveStudents: 0, TotalActiveStudentsPaidByOnline: 0, TotalActiveStudentsPaidByCash: 0 },
      actTripSendToVendor,
      actTripSendToVendorNotes,
      actRequests,
      schRequestFoodInfo: [],
      schRequestFoodTotals: { School: 0, Vendor: 0, Heroz: 0 },
      schRequestPriceInfo: [],
      schRequestPriceTotal: 0,
    });

    if (SchoolID !== undefined && SchoolID !== null && SchoolID !== "") {
      const arSchool = activityRequest?.SchoolID ?? null;
      if (!arSchool || String(arSchool) !== String(SchoolID)) return res.status(200).json(buildEmptyTripSummary());
    }

    if (VendorID !== undefined && VendorID !== null && VendorID !== "") {
      const arVendor = activityRequest?.VendorID ?? activityRequest?.vendorId ?? activityRequest?.VENDORID ?? null;
      if (!arVendor || String(arVendor) !== String(VendorID)) return res.status(200).json(buildEmptyTripSummary());
    }

    const rawSchRequestFoodInfo = await db.collection("tblschrequestfoodinfo").find({ RequestID }).project({
      FoodID: 1,
      foodId: 1,
      FoodId: 1,
      FoodSchoolPrice: 1,
      FoodVendorPrice: 1,
      FoodHerozPrice: 1,
    }).toArray();

    const schFoodIds = [
      ...new Set(
        rawSchRequestFoodInfo
          .map((r) => r.FoodID ?? r.foodId ?? r.FoodId)
          .filter((v) => v !== undefined && v !== null)
          .map((v) => String(v))
      ),
    ];

    let foodNameMap = {};
    if (schFoodIds.length) {
      const foodDocs = await db.collection("tblactfoodinfo").find({
        $or: [
          { FoodID: { $in: schFoodIds } },
          { foodId: { $in: schFoodIds } },
          { FoodId: { $in: schFoodIds } },
          { foodID: { $in: schFoodIds } },
        ],
      }).project({
        FoodID: 1,
        foodId: 1,
        FoodId: 1,
        foodID: 1,
        FoodName: 1,
        foodName: 1,
        name: 1,
      }).toArray();

      const getName = (d) => d.FoodName || d.foodName || d.name || "";
      for (const d of foodDocs) {
        const keys = [d.FoodID, d.foodId, d.FoodId, d.foodID]
          .filter((v) => v !== undefined && v !== null)
          .map((v) => String(v));
        const nm = getName(d);
        for (const k of keys) {
          if (nm && !foodNameMap[k]) foodNameMap[k] = nm;
        }
      }
    }

    const schRequestFoodInfo = rawSchRequestFoodInfo.map((r) => {
      const key = String(r.FoodID ?? r.foodId ?? r.FoodId ?? "");
      return { ...r, FoodName: key ? foodNameMap[key] || "" : "" };
    });

    const n = (v) => (typeof v === "number" ? v : v !== undefined && v !== null && v !== "" ? Number(v) : 0);

    const schRequestFoodTotals = schRequestFoodInfo.reduce(
      (acc, r) => {
        acc.School += n(r.FoodSchoolPrice);
        acc.Vendor += n(r.FoodVendorPrice);
        acc.Heroz += n(r.FoodHerozPrice);
        return acc;
      },
      { School: 0, Vendor: 0, Heroz: 0 }
    );

    const schRequestPriceInfo = await db.collection("tblschrequestpriceinfo").find({ RequestID }).project({ SchoolPrice: 1 }).toArray();
    const schRequestPriceTotal = schRequestPriceInfo.reduce((sum, r) => sum + n(r.SchoolPrice), 0);

    const kidsQuery = { RequestID };
    if (tripKidsStatus !== undefined && tripKidsStatus !== null && tripKidsStatus !== "") {
      kidsQuery.tripKidsStatus = String(tripKidsStatus).toUpperCase().trim();
    }

    const kids = await db.collection("tblBookTripKidsInfo").find(kidsQuery, {
      projection: { TripKidsSchoolNo: 1, KidsID: 1, TripKidsName: 1, tripKidsClassName: 1, tripKidsStatus: 1, ParentsID: 1 },
    }).toArray();

    const actTotalPaidStudents = kids.length;

    if (kids.length === 0) {
      const empty = buildEmptyTripSummary();
      empty.schRequestFoodInfo = schRequestFoodInfo;
      empty.schRequestFoodTotals = schRequestFoodTotals;
      empty.schRequestPriceInfo = schRequestPriceInfo;
      empty.schRequestPriceTotal = schRequestPriceTotal;
      return res.status(200).json(empty);
    }

    const parentIDs = [...new Set(kids.map((k) => k.ParentsID))];
    const kidsIDs = kids.map((k) => k.KidsID);

    const parents = await db.collection("tblBookTripParentsInfo").find({ RequestID, ParentsID: { $in: parentIDs } }).toArray();
    const parentsMap = {};
    parents.forEach((p) => {
      parentsMap[p.ParentsID] = {
        tripParentsName: p.tripParentsName,
        tripParentsMobileNo: p.tripParentsMobileNo,
        tripParentsNote: p.tripParentsNote,
      };
    });

    const paymentsAgg = await db.collection("tblBookTripPayInfo").aggregate([
      { $match: { RequestID, KidsID: { $in: kidsIDs }, PayStatus: "APPROVED" } },
      { $sort: { KidsID: 1, CreatedDate: -1 } },
      { $group: { _id: "$KidsID", doc: { $first: "$$ROOT" } } },
    ]).toArray();

    const paymentsByKid = {};
    paymentsAgg.forEach((p) => (paymentsByKid[p._id] = p.doc));

    const [foodIncludedLinks, foodExtraLinks] = await Promise.all([
      db.collection("tblBookKidsFoodIncluded").find({ RequestID, KidsID: { $in: kidsIDs } }).toArray(),
      db.collection("tblBookKidsFoodExtra").find({ RequestID, KidsID: { $in: kidsIDs } }).toArray(),
    ]);

    const foodIDs = [
      ...new Set([
        ...foodIncludedLinks.map((f) => f.FoodID),
        ...foodExtraLinks.map((f) => f.FoodID),
      ]),
    ];

    const foodInfo = foodIDs.length ? await db.collection("tblactfoodinfo").find({ FoodID: { $in: foodIDs } }).toArray() : [];
    const foodMap = {};
    foodInfo.forEach((f) => (foodMap[f.FoodID] = f.FoodName || f.foodName || f.name || ""));

    const includedByKid = new Map();
    const extraByKid = new Map();

    for (const link of foodIncludedLinks) {
      if (!includedByKid.has(link.KidsID)) includedByKid.set(link.KidsID, []);
      includedByKid.get(link.KidsID).push(link);
    }
    for (const link of foodExtraLinks) {
      if (!extraByKid.has(link.KidsID)) extraByKid.set(link.KidsID, []);
      extraByKid.get(link.KidsID).push(link);
    }

    const includeCounts = {};
    const extraCounts = {};

    let totalTripSchoolPrice = 0;
    let totalFoodExtraSchoolPrice = 0;
    let totalTripVendorCost = 0;
    let totalFoodExtraVendorPrice = 0;
    let totalTripHerozCost = 0;
    let totalFoodExtraHerozPrice = 0;

    const ONLINE_TYPES = new Set([
      "ONLINE",
      "CARD",
      "VISA",
      "MASTER",
      "MASTERCARD",
      "MADA",
      "APPLEPAY",
      "STC_PAY",
      "KNET",
      "DEBIT",
      "CREDIT",
      "PAYMENT_GATEWAY",
      "TABBY",
      "TAMARA",
      "SADAD",
    ]);
    let totalActiveStudentsPaidByOnline = 0;
    let totalActiveStudentsPaidByCash = 0;

    const finalList = kids.map((kid) => {
      const parent = parentsMap[kid.ParentsID] || {};
      const pay = paymentsByKid[kid.KidsID] || {};

      const TripVendorCost = numOrNull(pay?.TripVendorCost);
      const TripHerozCost = numOrNull(pay?.TripHerozCost);
      const TripSchoolPrice = numOrNull(pay?.TripSchoolPrice);

      if (typeof TripSchoolPrice === "number") totalTripSchoolPrice += TripSchoolPrice;
      if (typeof TripVendorCost === "number") totalTripVendorCost += TripVendorCost;
      if (typeof TripHerozCost === "number") totalTripHerozCost += TripHerozCost;

      const payType = (pay?.PayTypeID || "").toString().trim().toUpperCase();
      if (payType) {
        if (payType === "CASH") totalActiveStudentsPaidByCash += 1;
        else totalActiveStudentsPaidByOnline += 1;
      }

      const kidIncludedFoods = (includedByKid.get(kid.KidsID) || [])
        .map((link) => {
          const FoodName = foodMap[link.FoodID] || "";
          if (FoodName) includeCounts[FoodName] = (includeCounts[FoodName] || 0) + 1;
          return {
            FoodName,
            FoodSchoolPrice: numOrNull(link?.FoodSchoolPrice),
            FoodVendorPrice: numOrNull(link?.FoodVendorPrice),
            FoodHerozPrice: numOrNull(link?.FoodHerozPrice),
          };
        })
        .filter((x) => x.FoodName);

      const kidExtraFoods = (extraByKid.get(kid.KidsID) || [])
        .map((link) => {
          const FoodName = foodMap[link.FoodID] || "";
          if (FoodName) extraCounts[FoodName] = (extraCounts[FoodName] || 0) + 1;

          const FoodSchoolPrice = numOrNull(link?.FoodSchoolPrice);
          const FoodVendorPrice = numOrNull(link?.FoodVendorPrice);
          const FoodHerozPrice = numOrNull(link?.FoodHerozPrice);

          if (typeof FoodSchoolPrice === "number") totalFoodExtraSchoolPrice += FoodSchoolPrice;
          if (typeof FoodVendorPrice === "number") totalFoodExtraVendorPrice += FoodVendorPrice;
          if (typeof FoodHerozPrice === "number") totalFoodExtraHerozPrice += FoodHerozPrice;

          return { FoodName, FoodSchoolPrice, FoodVendorPrice, FoodHerozPrice };
        })
        .filter((x) => x.FoodName);

      return {
        TripKidsSchoolNo: kid.TripKidsSchoolNo,
        KidsID: kid.KidsID,
        TripKidsName: kid.TripKidsName,
        tripKidsClassName: kid.tripKidsClassName,
        tripKidsStatus: kid.tripKidsStatus,
        tripParentsName: parent.tripParentsName || "",
        tripParentsMobileNo: parent.tripParentsMobileNo || "",
        tripParentsNote: parent.tripParentsNote || "",
        PayRefNo: pay?.PayRefNo ?? null,
        PayTypeID: pay?.PayTypeID ?? null,
        tripPaymentTypeID: pay?.tripPaymentTypeID ?? null,
        TripCost: numOrNull(pay?.TripCost),
        TripFoodCost: numOrNull(pay?.TripFoodCost),
        TripTaxAmount: numOrNull(pay?.TripTaxAmount),
        TripFullAmount: numOrNull(pay?.TripFullAmount),
        TripVendorCost,
        TripHerozCost,
        TripSchoolPrice,
        PayStatus: pay?.PayStatus ?? null,
        InvoiceNo: pay?.InvoiceNo ?? null,
        MyFatrooahRefNo: pay?.MyFatrooahRefNo ?? null,
        PayDate: pay?.PayDate ?? null,
        CreatedDate: pay?.CreatedDate ?? null,
        IncFoodInfo: kidIncludedFoods,
        ExtraFoodInfo: kidExtraFoods,
      };
    });

    const TripSummary = {
      SchoolPaymentSummary: { SchoolTotalTripCost: totalTripSchoolPrice, SchoolTotalFoodExtraCost: totalFoodExtraSchoolPrice },
      VendorPaymentSummary: { TotalTripCost: totalTripVendorCost, TotalFoodExtraCost: totalFoodExtraVendorPrice },
      HerozPaymentSummary: { TotalTripCost: totalTripHerozCost, TotalFoodExtraCost: totalFoodExtraHerozPrice },
      FoodExtra: [extraCounts],
      FoodInclude: [includeCounts],
    };

    const activeStudentSumamry = {
      TotalActiveStudents: actTotalPaidStudents,
      TotalActiveStudentsPaidByOnline: totalActiveStudentsPaidByOnline,
      TotalActiveStudentsPaidByCash: totalActiveStudentsPaidByCash,
    };

    return res.status(200).json({
      status: "success",
      total: finalList.length,
      actTotalPaidStudents,
      actTotalNoStudents,
      data: finalList,
      TripSummary,
      activeStudentSumamry,
      actTripSendToVendor,
      actTripSendToVendorNotes,
      actRequests,
      schRequestFoodInfo,
      schRequestFoodTotals,
      schRequestPriceInfo,
      schRequestPriceTotal,
    });
  } catch (error) {
    console.error("Error in gettripdata:", error);
    next(error);
  }
};

// -------------------------------------------------------------
// ✅ getAllTripBookedActivitiesStats (FIXED pipeline syntax)
// -------------------------------------------------------------
exports.getAllTripBookedActivitiesStats = async (req, res, next) => {
  try {
    const db = await connectToMongoDB();
    const { SchoolID, VendorID } = req.body || {};

    const schoolProvided = SchoolID !== undefined && SchoolID !== null && String(SchoolID).trim() !== "";
    const vendorProvided = VendorID !== undefined && VendorID !== null && String(VendorID).trim() !== "";

    if (!schoolProvided && !vendorProvided) {
      return sendResponse(res, "You must pass either SchoolID or VendorID.", true);
    }

    const sid = schoolProvided ? String(SchoolID).trim() : null;
    const vid = vendorProvided ? String(VendorID).trim() : null;

    const pipeline = [];
    const andMatch = [{ actRequestStatus: "TRIP-BOOKED" }];

    if (schoolProvided) andMatch.push({ $or: [{ SchoolID: sid }, { schoolId: sid }, { SCHOOLID: sid }] });
    if (vendorProvided) andMatch.push({ $or: [{ VendorID: vid }, { vendorId: vid }, { VENDORID: vid }] });

    pipeline.push({ $match: { $and: andMatch } });

    pipeline.push({
      $project: {
        _id: 0,
        ActivityID: 1,
        RequestID: 1,
        actRequestRefNo: 1,
        actRequestDate: 1,
        actRequestTime: 1,
        actTotalNoStudents: 1,
      },
    });

    pipeline.push(
      {
        $group: {
          _id: { ActivityID: "$ActivityID", RequestID: "$RequestID" },
          actRequestRefNo: { $first: "$actRequestRefNo" },
          actRequestDate: { $first: "$actRequestDate" },
          actRequestTime: { $first: "$actRequestTime" },
          actTotalNoStudents: { $first: "$actTotalNoStudents" },
        },
      },
      {
        $project: {
          _id: 0,
          ActivityID: "$_id.ActivityID",
          RequestID: "$_id.RequestID",
          actRequestRefNo: 1,
          actRequestDate: 1,
          actRequestTime: 1,
          actTotalNoExpectedStudents: {
            $convert: { input: "$actTotalNoStudents", to: "double", onError: 0, onNull: 0 },
          },
        },
      }
    );

    pipeline.push(
      {
        $lookup: {
          from: "tblactivityinfo",
          localField: "ActivityID",
          foreignField: "ActivityID",
          as: "actInfo",
        },
      },
      {
        $addFields: {
          actName: { $ifNull: [{ $arrayElemAt: ["$actInfo.actName", 0] }, ""] },
          VendorIDFromAct: {
            $let: {
              vars: { d: { $arrayElemAt: ["$actInfo", 0] } },
              in: { $ifNull: [{ $ifNull: ["$$d.VendorID", "$$d.vendorId"] }, "$$d.VENDORID"] },
            },
          },
        },
      }
    );

    if (vendorProvided) {
      pipeline.push({ $match: { $expr: { $eq: ["$VendorIDFromAct", vid] } } });
    }

    pipeline.push(
      { $lookup: { from: "TblVendorInfo", localField: "VendorIDFromAct", foreignField: "VendorID", as: "v1" } },
      { $lookup: { from: "tblvendorinfo", localField: "VendorIDFromAct", foreignField: "VendorID", as: "v2" } },
      {
        $addFields: {
          vdrName: {
            $let: {
              vars: { c1: { $arrayElemAt: ["$v1", 0] }, c2: { $arrayElemAt: ["$v2", 0] } },
              in: {
                $ifNull: [
                  { $ifNull: ["$$c1.vdrName", "$$c1.VendorName"] },
                  { $ifNull: ["$$c2.vdrName", "$$c2.VendorName"] },
                ],
              },
            },
          },
        },
      }
    );

    pipeline.push({
      $lookup: {
        from: "tblBookTripKidsInfo",
        let: { req: "$RequestID" },
        pipeline: [
          { $match: { $expr: { $eq: ["$RequestID", "$$req"] }, tripKidsStatus: "PRESENT" } },
          { $group: { _id: null, totalStudents: { $sum: 1 }, kids: { $addToSet: "$KidsID" } } },
        ],
        as: "kidsAgg",
      },
    });

    pipeline.push({
      $lookup: {
        from: "tblBookTripPayInfo",
        let: { req: "$RequestID" },
        pipeline: [
          { $match: { $expr: { $eq: ["$RequestID", "$$req"] }, PayStatus: "APPROVED" } },
          { $sort: { KidsID: 1, CreatedDate: -1 } },
          { $group: { _id: "$KidsID", doc: { $first: "$$ROOT" } } },
          {
            $group: {
              _id: null,
              totalTripCost: { $sum: { $convert: { input: "$doc.TripFullAmount", to: "double", onError: 0, onNull: 0 } } },
              totalTripSchoolCost: { $sum: { $convert: { input: "$doc.TripSchoolPrice", to: "double", onError: 0, onNull: 0 } } },
              totalTripVendorCost: { $sum: { $convert: { input: "$doc.TripVendorCost", to: "double", onError: 0, onNull: 0 } } },
              totalTripHerozCost: { $sum: { $convert: { input: "$doc.TripHerozCost", to: "double", onError: 0, onNull: 0 } } },
            },
          },
        ],
        as: "payAgg",
      },
    });

    pipeline.push({
      $lookup: {
        from: "tblBookKidsFoodExtra",
        let: { req: "$RequestID" },
        pipeline: [
          { $match: { $expr: { $eq: ["$RequestID", "$$req"] } } },
          {
            $group: {
              _id: null,
              totalExtraFoodCost: { $sum: { $convert: { input: "$FoodSchoolPrice", to: "double", onError: 0, onNull: 0 } } },
              totalExtraFoodSchoolCost: { $sum: { $convert: { input: "$FoodSchoolPrice", to: "double", onError: 0, onNull: 0 } } },
              totalExtraFoodVendorCost: { $sum: { $convert: { input: "$FoodVendorPrice", to: "double", onError: 0, onNull: 0 } } },
              totalExtraFoodHerozCost: { $sum: { $convert: { input: "$FoodHerozPrice", to: "double", onError: 0, onNull: 0 } } },
            },
          },
        ],
        as: "extraAgg",
      },
    });

    pipeline.push({
      $addFields: {
        totalStudents: { $ifNull: [{ $arrayElemAt: ["$kidsAgg.totalStudents", 0] }, 0] },
        totalTripCost: { $ifNull: [{ $arrayElemAt: ["$payAgg.totalTripCost", 0] }, 0] },
        totalTripHerozCost: { $ifNull: [{ $arrayElemAt: ["$payAgg.totalTripHerozCost", 0] }, 0] },
        totalTripSchoolCost: { $ifNull: [{ $arrayElemAt: ["$payAgg.totalTripSchoolCost", 0] }, 0] },
        totalTripVendorCost: { $ifNull: [{ $arrayElemAt: ["$payAgg.totalTripVendorCost", 0] }, 0] },
        totalExtraFoodCost: { $ifNull: [{ $arrayElemAt: ["$extraAgg.totalExtraFoodCost", 0] }, 0] },
        totalExtraFoodHerozCost: { $ifNull: [{ $arrayElemAt: ["$extraAgg.totalExtraFoodHerozCost", 0] }, 0] },
        totalExtraFoodSchoolCost: { $ifNull: [{ $arrayElemAt: ["$extraAgg.totalExtraFoodSchoolCost", 0] }, 0] },
        totalExtraFoodVendorCost: { $ifNull: [{ $arrayElemAt: ["$extraAgg.totalExtraFoodVendorCost", 0] }, 0] },
      },
    });

    pipeline.push({
      $project: {
        ActivityID: 1,
        RequestID: 1,
        actRequestRefNo: 1,
        actRequestDate: 1,
        actRequestTime: 1,
        actTotalNoExpectedStudents: 1,
        actName: 1,
        vdrName: { $ifNull: ["$vdrName", ""] },
        totalStudents: 1,
        totalTripCost: 1,
        totalTripHerozCost: 1,
        totalTripSchoolCost: 1,
        totalTripVendorCost: 1,
        totalExtraFoodCost: 1,
        totalExtraFoodHerozCost: 1,
        totalExtraFoodSchoolCost: 1,
        totalExtraFoodVendorCost: 1,
      },
    });

    const rows = await db.collection("tblactivityrequest").aggregate(pipeline).toArray();
    return sendResponse(res, "Trip-booked activity stats fetched successfully.", false, rows, rows.length);
  } catch (err) {
    console.error("Error in getAllTripBookedActivitiesStats:", err);
    return sendResponse(res, "Database error in getAllTripBookedActivitiesStats.", true, { detail: err.message });
  }
};

// -------------------------------------------------------------
// ✅ gettripPaymentSummary (kept, plus ObjectId import fixed already)
// -------------------------------------------------------------
exports.gettripPaymentSummary = async (req, res, next) => {
  try {
    const db = await connectToMongoDB();
    const { RequestID, ActivityID, VendorID, SchoolID } = req.body || {};

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

    const reqIds = withObjectIds(toArray(RequestID));
    const actIds = withObjectIds(toArray(ActivityID));
    const vdrIds = withObjectIds(toArray(VendorID));
    const schIds = withObjectIds(toArray(SchoolID));

    const optionalFilter = {};
    if (reqIds.length) optionalFilter.RequestID = { $in: reqIds };
    if (actIds.length) optionalFilter.ActivityID = { $in: actIds };
    if (vdrIds.length) optionalFilter.VendorID = { $in: vdrIds };
    if (schIds.length) optionalFilter.SchoolID = { $in: schIds };

    const statusSet = ["TRIP-BOOKED", "COMPLETED", "WAITING-FOR-APPROVAL", "APPROVED", "REJECTED", "PENDING"];

    const pipeline = [
      {
        $match: Object.keys(optionalFilter).length
          ? { actRequestStatus: { $in: statusSet }, ...optionalFilter }
          : { actRequestStatus: { $in: statusSet } },
      },
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
      { $addFields: { PaymentDueDate: { $ifNull: ["$PaymentDueDate", null] } } },
      {
        $lookup: {
          from: "tblBookTripPayInfo",
          let: { reqId: "$RequestID" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    {
                      $or: [
                        { $eq: ["$RequestID", "$$reqId"] },
                        { $eq: ["$requestID", "$$reqId"] },
                        { $eq: ["$reqId", "$$reqId"] },
                        { $eq: ["$ReqID", "$$reqId"] },
                      ],
                    },
                    { $eq: ["$PayStatus", "APPROVED"] },
                  ],
                },
              },
            },
            {
              $project: {
                _id: 0,
                tripPaymentTypeID: 1,
                PayTypeID: 1,
                TripCost: 1,
                TripFoodCost: 1,
                TripTaxAmount: 1,
                TripFullAmount: 1,
                TripVendorCost: 1,
                TripHerozCost: 1,
                TripSchoolPrice: 1,
                CreatedDate: 1,
                PayDate: 1,
                PayStatus: 1,
                MyFatrooahRefNo: 1,
                KidsID: 1,
              },
            },
          ],
          as: "payments",
        },
      },
      {
        $addFields: {
          _approvedKidsIds: {
            $setUnion: [{ $map: { input: "$payments", as: "p", in: "$$p.KidsID" } }, []],
          },
        },
      },
      {
        $lookup: {
          from: "tblBookTripKidsInfo",
          let: { reqId: "$RequestID", approvedKids: "$_approvedKidsIds" },
          pipeline: [
            {
              $match: {
                $expr: { $and: [{ $eq: ["$RequestID", "$$reqId"] }, { $in: ["$KidsID", "$$approvedKids"] }] },
              },
            },
            { $project: { _id: 0, KidsID: 1, ParentsID: 1, TripKidsSchoolNo: 1, TripKidsName: 1, tripKidsClassName: 1, CreatedDate: 1, tripKidsStatus: 1 } },
          ],
          as: "KidsSumamry",
        },
      },
      {
        $addFields: {
          _kidsParentsIds: { $setUnion: [{ $map: { input: "$KidsSumamry", as: "k", in: "$$k.ParentsID" } }, []] },
        },
      },
      {
        $lookup: {
          from: "tblBookTripParentsInfo",
          let: { reqId: "$RequestID", parentIds: "$_kidsParentsIds" },
          pipeline: [
            {
              $match: { $expr: { $and: [{ $in: ["$ParentsID", "$$parentIds"] }, { $eq: ["$RequestID", "$$reqId"] }] } },
            },
            { $project: { _id: 0, ParentsID: 1, tripParentsName: 1, tripParentsMobileNo: 1, tripParentsNote: 1, CreatedDate: 1 } },
          ],
          as: "parentsInfo",
        },
      },
      {
        $lookup: {
          from: "tblBookKidsFoodExtra",
          let: { reqId: "$RequestID", approvedKids: "$_approvedKidsIds" },
          pipeline: [
            { $match: { $expr: { $and: [{ $eq: ["$RequestID", "$$reqId"] }, { $in: ["$KidsID", "$$approvedKids"] }] } } },
            { $lookup: { from: "tblactfoodinfo", localField: "FoodID", foreignField: "FoodID", as: "foodInfo" } },
            {
              $addFields: {
                FoodName: {
                  $ifNull: [{ $arrayElemAt: ["$foodInfo.FoodName", 0] }, { $arrayElemAt: ["$foodInfo.foodName", 0] }],
                },
              },
            },
            { $project: { _id: 0, FoodID: 1, FoodName: 1, FoodSchoolPrice: 1, FoodVendorPrice: 1, FoodHerozPrice: 1 } },
          ],
          as: "foodExtras",
        },
      },
      { $addFields: { payments: { $ifNull: ["$payments", []] }, foodExtras: { $ifNull: ["$foodExtras", []] }, KidsSumamry: { $ifNull: ["$KidsSumamry", []] }, parentsInfo: { $ifNull: ["$parentsInfo", []] } } },
      {
        $addFields: {
          _presentKidsIds: {
            $setUnion: [
              {
                $map: {
                  input: { $filter: { input: "$KidsSumamry", as: "k", cond: { $eq: ["$$k.tripKidsStatus", "PRESENT"] } } },
                  as: "k",
                  in: "$$k.KidsID",
                },
              },
              [],
            ],
          },
          _totalStudentAbsent: { $size: { $filter: { input: "$KidsSumamry", as: "k", cond: { $eq: ["$$k.tripKidsStatus", "ABSENT"] } } } },
        },
      },
      {
        $addFields: {
          _paymentsPresentAll: { $filter: { input: "$payments", as: "p", cond: { $in: ["$$p.KidsID", "$_presentKidsIds"] } } },
          _paymentsPresentApproved: { $filter: { input: "$payments", as: "p", cond: { $and: [{ $eq: ["$$p.PayStatus", "APPROVED"] }, { $in: ["$$p.KidsID", "$_presentKidsIds"] }] } } },
          _paymentsPresentFailed: { $filter: { input: "$payments", as: "p", cond: { $and: [{ $eq: ["$$p.PayStatus", "FAILED"] }, { $in: ["$$p.KidsID", "$_presentKidsIds"] }] } } },
          _paymentsPresentNew: { $filter: { input: "$payments", as: "p", cond: { $and: [{ $eq: ["$$p.PayStatus", "NEW"] }, { $in: ["$$p.KidsID", "$_presentKidsIds"] }] } } },
        },
      },
      {
        $addFields: {
          studentSummary: {
            totalStudentPaid: { $size: "$_paymentsPresentAll" },
            totalStudentApproved: { $size: "$_paymentsPresentApproved" },
            totalStudentFailed: { $size: "$_paymentsPresentFailed" },
            totalStudentNew: { $size: "$_paymentsPresentNew" },
            totalStudentAbsent: "$_totalStudentAbsent",
          },
        },
      },
      {
        $addFields: {
          _paymentsForTotals: {
            $cond: [{ $gt: [{ $size: "$_paymentsPresentApproved" }, 0] }, "$_paymentsPresentApproved", "$_paymentsPresentAll"],
          },
        },
      },
      {
        $addFields: {
          tripPayment: {
            totalTripVendorCost: { $sum: { $map: { input: "$_paymentsForTotals", as: "p", in: { $ifNull: ["$$p.TripVendorCost", 0] } } } },
            totalTripHerozCost: { $sum: { $map: { input: "$_paymentsForTotals", as: "p", in: { $ifNull: ["$$p.TripHerozCost", 0] } } } },
            totalTripSchoolPrice: { $sum: { $map: { input: "$_paymentsForTotals", as: "p", in: { $ifNull: ["$$p.TripSchoolPrice", 0] } } } },
          },
        },
      },
      {
        $addFields: {
          _totalFoodSchoolPrice: { $sum: { $map: { input: "$foodExtras", as: "f", in: { $ifNull: ["$$f.FoodSchoolPrice", 0] } } } },
          _totalFoodVendorPrice: { $sum: { $map: { input: "$foodExtras", as: "f", in: { $ifNull: ["$$f.FoodVendorPrice", 0] } } } },
          _totalFoodHerozPrice: { $sum: { $map: { input: "$foodExtras", as: "f", in: { $ifNull: ["$$f.FoodHerozPrice", 0] } } } },
        },
      },
      {
        $addFields: {
          foodExtrasSummary: {
            count: { $size: "$foodExtras" },
            totalFoodSchoolPrice: "$_totalFoodSchoolPrice",
            totalFoodVendorPrice: "$_totalFoodVendorPrice",
            totalFoodHerozPrice: "$_totalFoodHerozPrice",
          },
        },
      },
      {
        $addFields: {
          totalPaymentSummary: {
            totalVendorTripProfit: { $add: ["$tripPayment.totalTripVendorCost", "$foodExtrasSummary.totalFoodVendorPrice"] },
            totalSchoolTripProfit: { $add: ["$tripPayment.totalTripSchoolPrice", "$foodExtrasSummary.totalFoodSchoolPrice"] },
            totalHerozTripProfit: { $add: ["$tripPayment.totalTripHerozCost", "$foodExtrasSummary.totalFoodHerozPrice"] },
          },
        },
      },
      {
        $project: {
          _id: 0,
          RequestID: 1,
          ActivityID: 1,
          VendorID: 1,
          SchoolID: 1,
          actRequestStatus: 1,
          actRequestDate: 1,
          actRequestTime: 1,
          actRequestRefNo: 1,
          PaymentDueDate: 1,
          actName: 1,
          vdrName: 1,
          schName: 1,
          KidsSumamry: 1,
          parentsInfo: 1,
          payments: 1,
          foodExtras: 1,
          studentSummary: 1,
          tripPayment: 1,
          foodExtrasSummary: 1,
          totalPaymentSummary: 1,
        },
      },
      { $sort: { actRequestDate: -1, actRequestTime: -1, RequestID: -1 } },
    ];

    const rows = await db.collection("tblactivityrequest").aggregate(pipeline).toArray();
    return res.status(200).json({ status: "success", data: rows });
  } catch (err) {
    console.error("Error in gettripPaymentSummary:", err?.message || err);
    next(err);
  }
};

// -------------------------------------------------------------
// ✅ getPosUserKidsInfo (ObjectId already imported; kept)
// -------------------------------------------------------------
exports.getPosUserKidsInfo = async (req, res, next) => {
  try {
    const db = await connectToMongoDB();

    const { RequestID, ActivityID, VendorID, SchoolID } = req.body || {};

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

    const reqIds = withObjectIds(toArray(RequestID));
    const actIds = withObjectIds(toArray(ActivityID));
    const vdrIds = withObjectIds(toArray(VendorID));
    const schIds = withObjectIds(toArray(SchoolID));

    const optionalFilter = {};
    if (reqIds.length) optionalFilter.RequestID = { $in: reqIds };
    if (actIds.length) optionalFilter.ActivityID = { $in: actIds };
    if (vdrIds.length) optionalFilter.VendorID = { $in: vdrIds };
    if (schIds.length) optionalFilter.SchoolID = { $in: schIds };

    const statusSet = ["TRIP-BOOKED", "COMPLETED", "WAITING-FOR-APPROVAL", "APPROVED", "REJECTED", "PENDING"];

    const pipeline = [
      {
        $match: Object.keys(optionalFilter).length
          ? { actRequestStatus: { $in: statusSet }, ...optionalFilter }
          : { actRequestStatus: { $in: statusSet } },
      },
      { $lookup: { from: "tblactivityinfo", localField: "ActivityID", foreignField: "ActivityID", pipeline: [{ $project: { _id: 0, actName: 1 } }], as: "activity" } },
      { $addFields: { actName: { $arrayElemAt: ["$activity.actName", 0] } } },
      { $lookup: { from: "tblvendorinfo", localField: "VendorID", foreignField: "VendorID", pipeline: [{ $project: { _id: 0, vdrName: 1 } }], as: "vendor" } },
      { $addFields: { vdrName: { $arrayElemAt: ["$vendor.vdrName", 0] } } },
      { $lookup: { from: "tblschoolinfo", localField: "SchoolID", foreignField: "SchoolID", pipeline: [{ $project: { _id: 0, schName: 1 } }], as: "school" } },
      { $addFields: { schName: { $arrayElemAt: ["$school.schName", 0] } } },

      {
        $lookup: {
          from: "tblBookTripPayInfo",
          let: { reqId: "$RequestID" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    {
                      $or: [
                        { $eq: ["$RequestID", "$$reqId"] },
                        { $eq: ["$requestID", "$$reqId"] },
                        { $eq: ["$reqId", "$$reqId"] },
                        { $eq: ["$ReqID", "$$reqId"] },
                      ],
                    },
                    { $eq: ["$PayStatus", "APPROVED"] },
                  ],
                },
              },
            },
            { $project: { _id: 0, tripPaymentTypeID: 1, PayTypeID: 1, TripCost: 1, TripFoodCost: 1, TripTaxAmount: 1, TripFullAmount: 1, TripVendorCost: 1, TripHerozCost: 1, TripSchoolPrice: 1, CreatedDate: 1, PayDate: 1, PayStatus: 1, MyFatrooahRefNo: 1, KidsID: 1 } },
          ],
          as: "payments",
        },
      },
      { $addFields: { _approvedKidsIds: { $setUnion: [{ $map: { input: "$payments", as: "p", in: "$$p.KidsID" } }, []] } } },
      {
        $lookup: {
          from: "tblBookTripKidsInfo",
          let: { reqId: "$RequestID", approvedKids: "$_approvedKidsIds" },
          pipeline: [
            { $match: { $expr: { $and: [{ $eq: ["$RequestID", "$$reqId"] }, { $in: ["$KidsID", "$$approvedKids"] }] } } },
            { $project: { _id: 0, KidsID: 1, ParentsID: 1, TripKidsSchoolNo: 1, TripKidsName: 1, tripKidsClassName: 1, CreatedDate: 1, tripKidsStatus: 1 } },
          ],
          as: "KidsSumamry",
        },
      },
      { $addFields: { _kidsParentsIds: { $setUnion: [{ $map: { input: "$KidsSumamry", as: "k", in: "$$k.ParentsID" } }, []] } } },
      {
        $lookup: {
          from: "tblBookTripParentsInfo",
          let: { reqId: "$RequestID", parentIds: "$_kidsParentsIds" },
          pipeline: [
            { $match: { $expr: { $and: [{ $in: ["$ParentsID", "$$parentIds"] }, { $eq: ["$RequestID", "$$reqId"] }] } } },
            { $project: { _id: 0, ParentsID: 1, tripParentsName: 1, tripParentsMobileNo: 1, tripParentsNote: 1, CreatedDate: 1 } },
          ],
          as: "parentsInfo",
        },
      },
      {
        $lookup: {
          from: "tblBookKidsFoodExtra",
          let: { reqId: "$RequestID", approvedKids: "$_approvedKidsIds" },
          pipeline: [
            { $match: { $expr: { $and: [{ $eq: ["$RequestID", "$$reqId"] }, { $in: ["$KidsID", "$$approvedKids"] }] } } },
            { $lookup: { from: "tblactfoodinfo", localField: "FoodID", foreignField: "FoodID", as: "foodInfo" } },
            { $addFields: { FoodName: { $ifNull: [{ $arrayElemAt: ["$foodInfo.FoodName", 0] }, { $arrayElemAt: ["$foodInfo.foodName", 0] }] } } },
            { $project: { _id: 0, FoodID: 1, FoodName: 1, FoodSchoolPrice: 1, FoodVendorPrice: 1, FoodHerozPrice: 1 } },
          ],
          as: "foodExtras",
        },
      },
      { $addFields: { payments: { $ifNull: ["$payments", []] }, foodExtras: { $ifNull: ["$foodExtras", []] }, KidsSumamry: { $ifNull: ["$KidsSumamry", []] }, parentsInfo: { $ifNull: ["$parentsInfo", []] } } },
      {
        $addFields: {
          _presentKidsIds: {
            $setUnion: [
              {
                $map: {
                  input: { $filter: { input: "$KidsSumamry", as: "k", cond: { $eq: ["$$k.tripKidsStatus", "PRESENT"] } } },
                  as: "k",
                  in: "$$k.KidsID",
                },
              },
              [],
            ],
          },
          _totalStudentAbsent: { $size: { $filter: { input: "$KidsSumamry", as: "k", cond: { $eq: ["$$k.tripKidsStatus", "ABSENT"] } } } },
        },
      },
      {
        $addFields: {
          _paymentsPresentAll: { $filter: { input: "$payments", as: "p", cond: { $in: ["$$p.KidsID", "$_presentKidsIds"] } } },
          _paymentsPresentApproved: { $filter: { input: "$payments", as: "p", cond: { $and: [{ $eq: ["$$p.PayStatus", "APPROVED"] }, { $in: ["$$p.KidsID", "$_presentKidsIds"] }] } } },
          _paymentsPresentFailed: { $filter: { input: "$payments", as: "p", cond: { $and: [{ $eq: ["$$p.PayStatus", "FAILED"] }, { $in: ["$$p.KidsID", "$_presentKidsIds"] }] } } },
          _paymentsPresentNew: { $filter: { input: "$payments", as: "p", cond: { $and: [{ $eq: ["$$p.PayStatus", "NEW"] }, { $in: ["$$p.KidsID", "$_presentKidsIds"] }] } } },
        },
      },
      {
        $addFields: {
          studentSummary: {
            totalStudentPaid: { $size: "$_paymentsPresentAll" },
            totalStudentApproved: { $size: "$_paymentsPresentApproved" },
            totalStudentFailed: { $size: "$_paymentsPresentFailed" },
            totalStudentNew: { $size: "$_paymentsPresentNew" },
            totalStudentAbsent: "$_totalStudentAbsent",
          },
        },
      },
      {
        $addFields: {
          _paymentsForTotals: {
            $cond: [{ $gt: [{ $size: "$_paymentsPresentApproved" }, 0] }, "$_paymentsPresentApproved", "$_paymentsPresentAll"],
          },
        },
      },
      {
        $addFields: {
          tripPayment: {
            totalTripVendorCost: { $sum: { $map: { input: "$_paymentsForTotals", as: "p", in: { $ifNull: ["$$p.TripVendorCost", 0] } } } },
            totalTripHerozCost: { $sum: { $map: { input: "$_paymentsForTotals", as: "p", in: { $ifNull: ["$$p.TripHerozCost", 0] } } } },
            totalTripSchoolPrice: { $sum: { $map: { input: "$_paymentsForTotals", as: "p", in: { $ifNull: ["$$p.TripSchoolPrice", 0] } } } },
          },
        },
      },
      {
        $addFields: {
          _totalFoodSchoolPrice: { $sum: { $map: { input: "$foodExtras", as: "f", in: { $ifNull: ["$$f.FoodSchoolPrice", 0] } } } },
          _totalFoodVendorPrice: { $sum: { $map: { input: "$foodExtras", as: "f", in: { $ifNull: ["$$f.FoodVendorPrice", 0] } } } },
          _totalFoodHerozPrice: { $sum: { $map: { input: "$foodExtras", as: "f", in: { $ifNull: ["$$f.FoodHerozPrice", 0] } } } },
        },
      },
      { $addFields: { foodExtrasSummary: { count: { $size: "$foodExtras" }, totalFoodSchoolPrice: "$_totalFoodSchoolPrice", totalFoodVendorPrice: "$_totalFoodVendorPrice", totalFoodHerozPrice: "$_totalFoodHerozPrice" } } },
      {
        $addFields: {
          totalPaymentSummary: {
            totalVendorTripProfit: { $add: ["$tripPayment.totalTripVendorCost", "$foodExtrasSummary.totalFoodVendorPrice"] },
            totalSchoolTripProfit: { $add: ["$tripPayment.totalTripSchoolPrice", "$foodExtrasSummary.totalFoodSchoolPrice"] },
            totalHerozTripProfit: { $add: ["$tripPayment.totalTripHerozCost", "$foodExtrasSummary.totalFoodHerozPrice"] },
          },
        },
      },
      {
        $project: {
          _id: 0,
          RequestID: 1,
          ActivityID: 1,
          VendorID: 1,
          SchoolID: 1,
          actRequestStatus: 1,
          actRequestDate: 1,
          actRequestTime: 1,
          actRequestRefNo: 1,
          actName: 1,
          vdrName: 1,
          schName: 1,
          KidsSumamry: 1,
          parentsInfo: 1,
          payments: 1,
          foodExtras: 1,
          studentSummary: 1,
          tripPayment: 1,
          foodExtrasSummary: 1,
          totalPaymentSummary: 1,
        },
      },
      { $sort: { actRequestDate: -1, actRequestTime: -1, RequestID: -1 } },
    ];

    const rows = await db.collection("tblactivityrequest").aggregate(pipeline).toArray();
    return res.status(200).json({ status: "success", data: rows });
  } catch (err) {
    console.error("Error in getPosUserKidsInfo:", err?.message || err);
    next(err);
  }
};

// -------------------------------------------------------------
 

/**
 * POS - Get Parent + Kids Info
 * Updated:
 * - tblprtusers match by prtuserid
 * - tblvendorinfo match by VendorID = req.body.prtuserid
 * - keeps full payload structure
 */
exports.PosGetParentsKidsInfo = async (req, res, next) => {
  try {
    const db = await connectToMongoDB();

    const prtuseridRaw =      req.body?.prtuserid   ;

    const prtuserid = String(prtuseridRaw).trim();

    if (!prtuserid) {
      return sendResponse(res, "prtuserid is required.", true);
    }

    // 1) Check parent user from tblprtusers
    const prtUser = await db.collection("tblprtusers").findOne({
      prtuserid: prtuserid,
    });

    if (!prtUser) {
      return sendResponse(res, "prtuserid not found in tblprtusers.", true);
    }

    // 2) Match vendor info using VendorID = req.body.prtuserid
    const regInfo = await db.collection("tblMemRegInfo").findOne({
      prtuserid: prtuserid,
    });

    if (!regInfo) {
      return sendResponse(
        res,
        "No RegInfo found in tblvendorinfo for this VendorID/prtuserid.",
        true
      );
    }

    const baseUrl = String(process.env.PosUserImageUrl || "").trim();

    const joinUrl = (base, file) => {
      const b = String(base || "").trim();
      const f = String(file || "").trim();

      if (!b || !f) return null;

      return `${b.replace(/\/+$/, "")}/${f.replace(/^\/+/, "")}`;
    };

    const RegUserImageName = 
      regInfo.RegUserImageName ||
      regInfo.RegUserImageName ||
      "logo.png";

    const RegUserImageNameUrl = joinUrl(baseUrl, RegUserImageName);

    // 3) Get kids info by ParentsID = prtuserid
    const kidsRows = await db
      .collection("tblMemKidsInfo")
      .find({ ParentsID: prtuserid })
      .toArray();

    const KidsInformation = (kidsRows || []).map((k) => {
      const kidsImageName =
        k.KidsImageName ||
        k.kidsImageName ||
        k.KidImageName ||
        k.kidImageName ||
        "logo.png";

      return {
        TripKidsSchoolNo: k.KidsSchoolNo ?? null,
        TripKidsName: k.KidsName ?? null,
        tripKidsClassName: k.KidsClassName ?? null,
        tripKidsImageName: kidsImageName,
        tripKidsImageNameUrl: joinUrl(baseUrl, kidsImageName),
        KidsSchoolName: k.KidsSchoolName ?? null,
        KidsDateOfBirth: k.KidsDateOfBirth ?? null,
        KidsAdditionalNote: k.KidsAdditionalNote ?? null,
        KidsID: k.KidsID ?? null,
        ParentsID: k.ParentsID ?? null,
      };
    });

    const payload = {
      prtuserid,
      VendorID: prtuserid,
      RegUserFullName: regInfo.RegUserFullName || null,
      RegUserEmailAddress: regInfo.RegUserEmailAddress || null,
      RegUserMobileNo:
        regInfo.RegUserMobileNo || regInfo.RegUserMobileNo || null,
      RegUserImageName,
      RegUserImageNameUrl,
      KidsInformation,
    };

    return sendResponse(res, "Success.", null, payload);
  } catch (error) {
    console.error("Error in  :", error);

    return sendResponse(
      res,
      "Error in  .",
      true,
      { error: String(error?.message || error) }
    );
  }
};
// -------------------------------------------------------------
// ✅ closePayDueDate (kept)
// -------------------------------------------------------------
exports.closePayDueDate = async (req, res, next) => {
  const sanitizeLocal = (obj) => JSON.parse(JSON.stringify(obj || {}));

  const normalizeTextLocal = (v, maxLen = null) => {
    const s = String(v ?? "").trim();
    if (!s) return "";
    if (maxLen && s.length > maxLen) return s.slice(0, maxLen);
    return s;
  };

  const normalizeDate = (v) => {
    if (!v) return null;
    const s = String(v).trim();

    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) {
      const d = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00.000Z`);
      return isNaN(d.getTime()) ? null : d;
    }

    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  };

  try {
    const db = await connectToMongoDB();
    const body = sanitizeLocal(req.body);

    const RequestID = normalizeTextLocal(body.RequestID, 100);
    const PaymentDueDateRaw = normalizeTextLocal(body.PaymentDueDate, 30);

    const ClosedReason = normalizeTextLocal(body.ClosedReason, 200);
    const ClosedBy = normalizeTextLocal(body.ClosedBy, 50);
    const ClosedDateRaw = normalizeTextLocal(body.ClosedDate, 30);

    if (!RequestID) return sendResponse(res, "RequestID is required.", true);
    if (!PaymentDueDateRaw) return sendResponse(res, "PaymentDueDate is required.", true);
    if (!ClosedReason) return sendResponse(res, "ClosedReason is required.", true);
    if (!ClosedBy) return sendResponse(res, "ClosedBy is required.", true);
    if (!ClosedDateRaw) return sendResponse(res, "ClosedDate is required.", true);

    const PaymentDueDate = normalizeDate(PaymentDueDateRaw);
    const ClosedDate = normalizeDate(ClosedDateRaw);

    if (!PaymentDueDate || !ClosedDate) return sendResponse(res, "Invalid date format. Use YYYY-MM-DD.", true);

    const existing = await db.collection("tblactivityrequest").findOne(
      { RequestID },
      { projection: { PaymentDueDate: 1, payDueDate: 1, paymentDueDate: 1 } }
    );

    if (!existing) return sendResponse(res, "No record found for this RequestID.", true, { RequestID });

    const oldPayDueDate = existing.PaymentDueDate || existing.payDueDate || existing.paymentDueDate || null;

    const updateDoc = {
      PaymentDueDate,
      PaymentStatus: "CLOSED",
      ClosedReason,
      ClosedBy,
      ClosedDate,
      ModifyDate: new Date(),
      ModifyBy: ClosedBy,
    };

    const upd = await db.collection("tblactivityrequest").updateOne({ RequestID }, { $set: updateDoc });

    return sendResponse(res, "Payment closed / due date updated successfully.", null, {
      RequestID,
      oldPayDueDate,
      updated: { PaymentDueDate, PaymentStatus: "CLOSED", ClosedReason, ClosedBy, ClosedDate },
      mongo: { matchedCount: upd.matchedCount, modifiedCount: upd.modifiedCount },
    });
  } catch (error) {
    return sendResponse(res, "Error in closePayDueDate.", true, { error: String(error?.message || error) });
  }
};

// -------------------------------------------------------------
// ✅ PosAddKidsOnly (FIXED: prevents .bin file extension)
// -------------------------------------------------------------
 exports.PosAddKidsOnly = async (req, res) => {
  try {
    console.log("==============================================");
    console.log("[PosAddKidsOnly] HIT:", new Date().toISOString());
    console.log("==============================================");

    const db = await connectToMongoDB();

    // =========================================================
    // ✅ Validate ParentsID
    // =========================================================
    const ParentsID = String(req.body?.ParentsID ?? "").trim();
    if (!ParentsID) return sendResponse(res, "ParentsID is required.", true);

    // =========================================================
    // ✅ Parse kidsInfo
    // =========================================================
    let kidsInfoRaw = req.body?.kidsInfo;
    let kidsInfo = [];

    try {
      if (typeof kidsInfoRaw === "string") kidsInfo = JSON.parse(kidsInfoRaw);
      else if (Array.isArray(kidsInfoRaw)) kidsInfo = kidsInfoRaw;
      else kidsInfo = [];
    } catch {
      kidsInfo = [];
    }

    if (!Array.isArray(kidsInfo) || kidsInfo.length === 0) {
      return sendResponse(res, "kidsInfo is required (array).", true);
    }

    // =========================================================
    // ✅ Upload ONCE (single file if provided)
    // =========================================================
    let uploadedImage = null;
    if (req.file) {
      uploadedImage = await uploadKidsImageToS3(req.file);
    }

    const kidsDocs = [];
    const invalidSkipped = [];

    for (let i = 0; i < kidsInfo.length; i++) {
      const kid = sanitize(kidsInfo[i]);

      const KidsName = normalizeText(
        kid.KidsName ?? kid.kidsName ?? kid.name,
        150
      );

      const KidsClassName = normalizeText(
        kid.KidsClassName ??
          kid.ClassName ??
          kid.kidsClassName ??
          kid.className ??
          "",
        100
      );

      const KidsSchoolName = normalizeText(
        kid.KidsSchoolName ??
          kid.SchoolName ??
          kid.KidsSchool ??
          kid.schoolName ??
          "",
        150
      );

      const KidsGender = normalizeGender(kid.KidsGender ?? kid.gender);

      const KidsSchoolNo = normalizeText(
        kid.KidsSchoolNo ?? kid.SchoolNo ?? kid.kidsSchoolNo ?? "",
        50
      );

      const KidsDateOfBirth = normalizeDOB(
        kid.KidsDateOfBirth ??
          kid.DateOfBirth ??
          kid.kidsDateOfBirth ??
          kid.dob
      );

      const KidsAdditionalNote = normalizeText(
        kid.KidsAdditionalNote ?? kid.AdditionalNote ?? kid.notes ?? "",
        200
      );

      // ✅ Required validation only
      // ✅ KidsClassName is optional
      // ✅ KidsSchoolName remains optional
      if (!KidsName || !KidsGender) {
        invalidSkipped.push({
          index: i,
          reason: "KidsName and KidsGender are required.",
        });
        continue;
      }

      const KidsImageName = uploadedImage?.key
        ? uploadedImage.key
        : normalizeImageName(kid.KidsImageName);

      const KidsImageUrl = uploadedImage?.publicUrl
        ? uploadedImage.publicUrl
        : null;

      kidsDocs.push({
        KidsID: generateUniqueId(),
        KidsName,
        KidsClassName: KidsClassName || null,
        KidsSchoolName: KidsSchoolName || null,
        KidsGender,
        KidsSchoolNo: KidsSchoolNo || null,
        KidsDateOfBirth,
        KidsAdditionalNote: KidsAdditionalNote || null,
        KidsImageName,
        KidsImageUrl,
        ParentsID,
        CreatedDate: new Date(),
        ModifyDate: new Date(),
        CreatedBy: ParentsID,
        ModifyBy: ParentsID,
      });
    }

    if (!kidsDocs.length) {
      return sendResponse(res, "No kids inserted (all invalid).", true, {
        invalidSkipped,
      });
    }

    const insertResult = await db.collection("tblMemKidsInfo").insertMany(
      kidsDocs,
      {
        ordered: false,
      }
    );

    return sendResponse(res, "Kids inserted successfully.", null, {
      ParentsID,
      insertedCount: insertResult?.insertedCount ?? kidsDocs.length,
      insertedKids: kidsDocs,
      invalidSkipped,
      uploadedImage: uploadedImage
        ? {
            key: uploadedImage.key,
            publicUrl: uploadedImage.publicUrl,
            ext: uploadedImage.ext,
            contentType: uploadedImage.contentType,
          }
        : null,
    });
  } catch (error) {
    console.error("[PosAddKidsOnly] ERROR:", error);
    return sendResponse(res, "Error in PosAddKidsOnly.", true, {
      error: String(error?.message || error),
    });
  }
};
 exports.PosGetKidsInfoOnly = async (req, res) => {
  try {
    console.log("==============================================");
    console.log("[PosGetKidsInfoOnly] HIT:", new Date().toISOString());
    console.log("==============================================");

    const db = await connectToMongoDB();

    // =========================================================
    // ✅ Validate KidsID from req.body
    // =========================================================
    const KidsID = String(req.body?.KidsID ?? "").trim();

    console.log("[PosGetKidsInfoOnly] KidsID:", KidsID);

    if (!KidsID) {
      return sendResponse(res, "KidsID is required.", true);
    }

    // =========================================================
    // ✅ SELECT * FROM tblMemKidsInfo WHERE KidsID = KidsID
    // =========================================================
    const kid = await db.collection("tblMemKidsInfo").findOne({ KidsID });

    console.log("[PosGetKidsInfoOnly] Result:", kid);

    if (!kid) {
      return sendResponse(res, "No record found for the given KidsID.", true, {
        KidsID,
        data: null,
      });
    }

    // =========================================================
    // ✅ Build KidsImageNameUrl = env.PosUserImageUrl + "/" + KidsImageName
    // ✅ Ensures exactly one "/" between base URL and filename
    // =========================================================
    const baseUrl          = (process.env.PosUserImageUrl ?? "").trim().replace(/\/+$/, "");
    const imageName        = (kid.KidsImageName ?? "").toString().trim().replace(/^\/+/, "");
    const KidsImageNameUrl = imageName ? `${baseUrl}/${imageName}` : null;

    console.log("[PosGetKidsInfoOnly] KidsImageNameUrl:", KidsImageNameUrl);

    // =========================================================
    // ✅ Return all fields
    // =========================================================
    return sendResponse(res, "Kids info retrieved successfully.", null, {
      KidsID,
      data: {
        _id:                kid._id,
        KidsID:             kid.KidsID,
        KidsName:           kid.KidsName           ?? null,
        KidsClassName:      kid.KidsClassName      ?? null,
        KidsSchoolName:     kid.KidsSchoolName     ?? null,
        KidsGender:         kid.KidsGender         ?? null,
        KidsSchoolNo:       kid.KidsSchoolNo       ?? null,
        KidsDateOfBirth:    kid.KidsDateOfBirth    ?? null,
        KidsAdditionalNote: kid.KidsAdditionalNote ?? null,
        KidsImageName:      kid.KidsImageName      ?? null,
        KidsImageUrl:       kid.KidsImageUrl       ?? null,
        KidsImageNameUrl,
        ParentsID:          kid.ParentsID          ?? null,
        CreatedDate:        kid.CreatedDate        ?? null,
        ModifyDate:         kid.ModifyDate         ?? null,
        CreatedBy:          kid.CreatedBy          ?? null,
        ModifyBy:           kid.ModifyBy           ?? null,
      },
    });

  } catch (error) {
    console.error("[PosGetKidsInfoOnly] ERROR:", error);
    return sendResponse(res, "Error in PosGetKidsInfoOnly.", true, {
      error: String(error?.message || error),
    });
  }
};

 exports.PosUpdateKidsOnly = async (req, res) => {
  try {
    console.log("==============================================");
    console.log("[PosUpdateKidsOnly] HIT:", new Date().toISOString());
    console.log("==============================================");

    const db = await connectToMongoDB();

    // =========================================================
    // ✅ Validate KidsID from req.body (Primary Key)
    // =========================================================
    const KidsID = String(req.body?.kids ?? req.body?.KidsID ?? "").trim();
    if (!KidsID) return sendResponse(res, "kids (KidsID) is required.", true);

    const ParentsID = String(req.body?.ParentsID ?? "").trim();
    if (!ParentsID) return sendResponse(res, "ParentsID is required.", true);

    // =========================================================
    // ✅ Check kid exists in DB
    // =========================================================
    const existingKid = await db.collection("tblMemKidsInfo").findOne({ KidsID });
    if (!existingKid) {
      return sendResponse(res, "Kid not found with given KidsID.", true);
    }

    // =========================================================
    // ✅ Normalize fields from req.body
    // =========================================================
    const KidsName = normalizeText(
      req.body?.KidsName ?? req.body?.kidsName ?? req.body?.name ?? existingKid.KidsName,
      150
    );
    const KidsClassName = normalizeText(
      req.body?.KidsClassName ?? req.body?.ClassName ?? req.body?.className ?? existingKid.KidsClassName,
      100
    );
    const KidsSchoolName = normalizeText(
      req.body?.KidsSchoolName ?? req.body?.SchoolName ?? req.body?.schoolName ?? existingKid.KidsSchoolName,
      150
    );
    const KidsGender = normalizeGender(
      req.body?.KidsGender ?? req.body?.gender ?? existingKid.KidsGender
    );
    const KidsSchoolNo = normalizeText(
      req.body?.KidsSchoolNo ?? req.body?.SchoolNo ?? existingKid.KidsSchoolNo ?? "",
      50
    );
    const KidsDateOfBirth = normalizeDOB(
      req.body?.KidsDateOfBirth ?? req.body?.DateOfBirth ?? req.body?.dob ?? existingKid.KidsDateOfBirth
    );
    const KidsAdditionalNote = normalizeText(
      req.body?.KidsAdditionalNote ?? req.body?.AdditionalNote ?? req.body?.notes ?? existingKid.KidsAdditionalNote ?? "",
      200
    );

    // =========================================================
    // ✅ Resolve Image ONLY from req.body
    // ✅ No file upload logic
    // ✅ No file upload validation
    // ✅ Store KidsImageName without "users/"
    // =========================================================
    const S3_FOLDER = "users";
    const S3_BASE_URL = process.env.S3_BASE_URL; // e.g. https://your-bucket.s3.amazonaws.com

    let KidsImageName = existingKid.KidsImageName ?? "logo.png";
    let KidsImageUrl = existingKid.KidsImageUrl ?? null;

    const clientImageKey = normalizeImageName(
      req.body?.KidsImageKey ??
      req.body?.KidsImageName ??
      req.body?.imageKey ??
      req.body?.imageName ??
      null
    );

    if (clientImageKey) {
      const cleanedFileName = String(clientImageKey).trim().replace(/^users\//, "");

      KidsImageName = cleanedFileName;
      KidsImageUrl = S3_BASE_URL
        ? `${S3_BASE_URL}/${S3_FOLDER}/${cleanedFileName}`
        : null;
    } else {
      if (KidsImageName) {
        KidsImageName = String(KidsImageName).trim().replace(/^users\//, "");
      }
    }

    // =========================================================
    // ✅ Required field validation
    // =========================================================
    if (!KidsName || !KidsClassName || !KidsSchoolName || !KidsGender) {
      return sendResponse(
        res,
        "KidsName, KidsClassName, KidsSchoolName, KidsGender are required.",
        true
      );
    }

    // =========================================================
    // ✅ Build update payload — matches exact DB schema
    // =========================================================
    const updateFields = {
      KidsName,
      KidsClassName,
      KidsSchoolName,
      KidsGender,
      KidsSchoolNo: KidsSchoolNo || null,
      KidsDateOfBirth,
      KidsAdditionalNote: KidsAdditionalNote || null,
      KidsImageName, // stored as filename only
      KidsImageUrl,  // full S3 URL
      ParentsID,
      ModifyDate: new Date(),
      ModifyBy: ParentsID,
    };

    // =========================================================
    // ✅ Perform update
    // =========================================================
    const updateResult = await db.collection("tblMemKidsInfo").updateOne(
      { KidsID },
      { $set: updateFields }
    );

    // =========================================================
    // ✅ Success response
    // =========================================================
    return sendResponse(res, "Kid updated successfully.", null, {
      KidsID,
      matchedCount: updateResult.matchedCount,
      modifiedCount: updateResult.modifiedCount,
      updatedFields: updateFields,
    });
  } catch (error) {
    console.error("[PosUpdateKidsOnly] ERROR:", error);
    return sendResponse(res, "Error in PosUpdateKidsOnly.", true, {
      error: String(error?.message || error),
    });
  }
};
 
exports.PosDeleteKids = async (req, res) => {
  try {
    console.log("==============================================");
    console.log("[PosUpdateKidsOnly - DELETE] HIT:", new Date().toISOString());
    console.log("==============================================");

    const db = await connectToMongoDB();

    // =========================================================
    // ✅ Validate KidsID from req.body
    // =========================================================
    const KidsID =   req.body?.KidsID ;

    if (!KidsID) {
      return sendResponse(res, "KidsID is required.", true);
    }

    // =========================================================
    // ✅ Check kid exists in DB
    // =========================================================
    const existingKid = await db.collection("tblMemKidsInfo").findOne({ KidsID });

    if (!existingKid) {
      return sendResponse(res, "Kid not found with given KidsID.", true);
    }

    // =========================================================
    // ✅ Delete record from tblMemKidsInfo
    // =========================================================
    const deleteResult = await db.collection("tblMemKidsInfo").deleteOne({ KidsID });

    // =========================================================
    // ✅ Success response
    // =========================================================
    return sendResponse(res, "Kid deleted successfully.", null, {
      KidsID,
      deletedCount: deleteResult.deletedCount,
      deletedRecord: existingKid,
    });
  } catch (error) {
    console.error("[PosUpdateKidsOnly - DELETE] ERROR:", error);
    return sendResponse(res, "Error in PosUpdateKidsOnly delete.", true, {
      error: String(error?.message || error),
    });
  }
};


 exports.gettripviewByParentsID = async (req, res, next) => {
  try {
    const db = await connectToMongoDB();
    const { prtuserid } = req.body || {};

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
          try { out.push(new ObjectId(s)); } catch {}
        }
      }
      return out;
    };

    const parentIds = withObjectIds(toArray(prtuserid));

    if (!parentIds.length) {
      return res.status(400).json({ status: "error", message: "prtuserid is required." });
    }

    const statusSet = [
      "TRIP-BOOKED", "COMPLETED", "WAITING-FOR-APPROVAL",
      "APPROVED", "REJECTED", "PENDING",
    ];

    // =========================================================
    // STEP 1: Get parent info + RequestIDs from tblBookTripParentsInfo
    // =========================================================
    const parentRows = await db
      .collection("tblBookTripParentsInfo")
      .find({
        $or: [
          { ParentsID: { $in: parentIds } },
          { ParentID: { $in: parentIds } },
        ],
      })
      .project({
        _id: 0,
        RequestID: 1,
        ParentsID: 1,
        ParentID: 1,
        tripParentsName: 1,
        tripParentsMobileNo: 1,
        tripParentsNote: 1,
      })
      .toArray();

    if (!parentRows.length) {
      return res.status(200).json({ status: "success", parentsInfo: null, trips: [] });
    }

    // =========================================================
    // STEP 2: Single parentsInfo block
    // =========================================================
    const firstParent = parentRows[0];
    const parentsInfo = {
      ParentsID: firstParent.ParentsID || firstParent.ParentID,
      tripParentsName: firstParent.tripParentsName,
      tripParentsMobileNo: firstParent.tripParentsMobileNo,
      tripParentsNote: firstParent.tripParentsNote,
    };

    // =========================================================
    // STEP 3: Unique RequestIDs
    // =========================================================
    const requestIdsRaw = [
      ...new Set(
        parentRows
          .map((r) => r.RequestID)
          .filter((x) => x !== undefined && x !== null && `${x}`.trim() !== "")
          .map((x) => `${x}`.trim())
      ),
    ];

    const requestIds = withObjectIds(requestIdsRaw);

    if (!requestIds.length) {
      return res.status(200).json({ status: "success", parentsInfo, trips: [] });
    }

    // =========================================================
    // STEP 4: Main aggregation pipeline
    // =========================================================
    const pipeline = [
      {
        $match: {
          RequestID: { $in: requestIds },
          actRequestStatus: { $in: statusSet },
        },
      },

      // Activity name
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

      // Vendor name
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

      // School name
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

      // =========================================================
      // STEP 5: Get ALL payments for this trip + this parent
      // =========================================================
      {
        $lookup: {
          from: "tblBookTripPayInfo",
          let: { reqId: "$RequestID", parentIdsInput: parentIds },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    {
                      $or: [
                        { $eq: ["$RequestID", "$$reqId"] },
                        { $eq: ["$requestID", "$$reqId"] },
                        { $eq: ["$reqId", "$$reqId"] },
                        { $eq: ["$ReqID", "$$reqId"] },
                      ],
                    },
                    {
                      $or: [
                        { $in: ["$ParentsID", "$$parentIdsInput"] },
                        { $in: ["$ParentID", "$$parentIdsInput"] },
                      ],
                    },
                    // ✅ Only APPROVED or FAILED payments
                    { $in: ["$PayStatus", ["APPROVED", "FAILED"]] },
                  ],
                },
              },
            },
            {
              $project: {
                _id: 0,
                KidsID: 1,
                PayTypeID: 1,
                tripPaymentTypeID: 1,
                TripCost: 1,
                TripFoodCost: 1,
                TripTaxAmount: 1,
                TripFullAmount: 1,
                TripVendorCost: 1,
                TripHerozCost: 1,
                TripSchoolPrice: 1,
                CreatedDate: 1,
                PayDate: 1,
                PayStatus: 1,
                MyFatrooahRefNo: 1,
              },
            },
          ],
          as: "paymentsFiltered",
        },
      },

      // =========================================================
      // STEP 6: Extract unique KidsIDs from APPROVED/FAILED payments
      // =========================================================
      {
        $addFields: {
          _qualifiedKidsIds: {
            $setUnion: [
              {
                $map: {
                  input: "$paymentsFiltered",
                  as: "p",
                  in: "$$p.KidsID",
                },
              },
              [],
            ],
          },
        },
      },

      // =========================================================
      // STEP 7: Get kids info — only qualified KidsIDs
      // =========================================================
      {
        $lookup: {
          from: "tblBookTripKidsInfo",
          let: {
            reqId: "$RequestID",
            parentIdsInput: parentIds,
            qualifiedKidsIds: "$_qualifiedKidsIds",
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$RequestID", "$$reqId"] },
                    {
                      $or: [
                        { $in: ["$ParentsID", "$$parentIdsInput"] },
                        { $in: ["$ParentID", "$$parentIdsInput"] },
                      ],
                    },
                    // Only kids in APPROVED/FAILED payment KidsIDs
                    { $in: ["$KidsID", "$$qualifiedKidsIds"] },
                  ],
                },
              },
            },
            // Deduplicate by KidsID — keep only first record per KidsID
            {
              $group: {
                _id: "$KidsID",
                KidsID: { $first: "$KidsID" },
                TripKidsSchoolNo: { $first: "$TripKidsSchoolNo" },
                TripKidsName: { $first: "$TripKidsName" },
                tripKidsClassName: { $first: "$tripKidsClassName" },
                tripKidsStatus: { $first: "$tripKidsStatus" },
                CreatedDate: { $first: "$CreatedDate" },
              },
            },
            {
              $project: {
                _id: 0,
                KidsID: 1,
                TripKidsSchoolNo: 1,
                TripKidsName: 1,
                tripKidsClassName: 1,
                tripKidsStatus: 1,
                CreatedDate: 1,
              },
            },
          ],
          as: "kidsRaw",
        },
      },

      // =========================================================
      // STEP 8: Merge kid info + payment info per KidsID
      // =========================================================
      {
        $addFields: {
          KidsSummary: {
            $map: {
              input: "$kidsRaw",
              as: "kid",
              in: {
                $mergeObjects: [
                  "$$kid",
                  {
                    // Attach the latest APPROVED or FAILED payment for this kid
                    payment: {
                      $arrayElemAt: [
                        {
                          $filter: {
                            input: "$paymentsFiltered",
                            as: "p",
                            cond: { $eq: ["$$p.KidsID", "$$kid.KidsID"] },
                          },
                        },
                        0,
                      ],
                    },
                  },
                ],
              },
            },
          },
        },
      },

      // Flatten payment fields directly into KidsSummary item
      {
        $addFields: {
          KidsSummary: {
            $map: {
              input: "$KidsSummary",
              as: "item",
              in: {
                KidsID: "$$item.KidsID",
                TripKidsSchoolNo: "$$item.TripKidsSchoolNo",
                TripKidsName: "$$item.TripKidsName",
                tripKidsClassName: "$$item.tripKidsClassName",
                tripKidsStatus: "$$item.tripKidsStatus",
                KidsCreatedDate: "$$item.CreatedDate",
                PayTypeID: "$$item.payment.PayTypeID",
                tripPaymentTypeID: "$$item.payment.tripPaymentTypeID",
                TripCost: "$$item.payment.TripCost",
                TripFoodCost: "$$item.payment.TripFoodCost",
                TripTaxAmount: "$$item.payment.TripTaxAmount",
                TripFullAmount: "$$item.payment.TripFullAmount",
                TripVendorCost: "$$item.payment.TripVendorCost",
                TripHerozCost: "$$item.payment.TripHerozCost",
                TripSchoolPrice: "$$item.payment.TripSchoolPrice",
                PayDate: "$$item.payment.PayDate",
                PayStatus: "$$item.payment.PayStatus",
                MyFatrooahRefNo: "$$item.payment.MyFatrooahRefNo",
              },
            },
          },
        },
      },

      // =========================================================
      // STEP 9: Food extras
      // =========================================================
      {
        $lookup: {
          from: "tblBookKidsFoodExtra",
          let: { reqId: "$RequestID", kidsIds: "$_qualifiedKidsIds" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$RequestID", "$$reqId"] },
                    { $in: ["$KidsID", "$$kidsIds"] },
                  ],
                },
              },
            },
            {
              $lookup: {
                from: "tblactfoodinfo",
                localField: "FoodID",
                foreignField: "FoodID",
                as: "foodInfo",
              },
            },
            {
              $addFields: {
                FoodName: {
                  $ifNull: [
                    { $arrayElemAt: ["$foodInfo.FoodName", 0] },
                    { $arrayElemAt: ["$foodInfo.foodName", 0] },
                  ],
                },
              },
            },
            {
              $project: {
                _id: 0,
                FoodName: 1,
                FoodSchoolPrice: 1,
                FoodVendorPrice: 1,
                FoodHerozPrice: 1,
              },
            },
          ],
          as: "foodExtras",
        },
      },

      // =========================================================
      // STEP 10: Student summary
      // =========================================================
      {
        $addFields: {
          studentSummary: {
            totalKids: { $size: "$KidsSummary" },
            totalPresent: {
              $size: {
                $filter: {
                  input: "$KidsSummary",
                  as: "k",
                  cond: { $eq: ["$$k.tripKidsStatus", "PRESENT"] },
                },
              },
            },
            totalAbsent: {
              $size: {
                $filter: {
                  input: "$KidsSummary",
                  as: "k",
                  cond: { $eq: ["$$k.tripKidsStatus", "ABSENT"] },
                },
              },
            },
            totalPaymentApproved: {
              $size: {
                $filter: {
                  input: "$KidsSummary",
                  as: "k",
                  cond: { $eq: ["$$k.PayStatus", "APPROVED"] },
                },
              },
            },
            totalPaymentFailed: {
              $size: {
                $filter: {
                  input: "$KidsSummary",
                  as: "k",
                  cond: { $eq: ["$$k.PayStatus", "FAILED"] },
                },
              },
            },
          },
        },
      },

      // =========================================================
      // FINAL PROJECTION
      // =========================================================
      {
        $project: {
          _id: 0,
          RequestID: 1,
          ActivityID: 1,
          VendorID: 1,
          SchoolID: 1,
          actRequestRefNo: 1,
          actRequestDate: 1,
          actRequestTime: 1,
          actRequestStatus: 1,
          PaymentDueDate: 1,
          actName: 1,
          vdrName: 1,
          schName: 1,
          KidsSummary: 1,
          foodExtras: 1,
          studentSummary: 1,
        },
      },

      { $sort: { actRequestDate: -1, actRequestTime: -1 } },
    ];

    const trips = await db
      .collection("tblactivityrequest")
      .aggregate(pipeline)
      .toArray();

    return res.status(200).json({
      status: "success",
      parentsInfo,
      trips,
    });

  } catch (err) {
    console.error("Error in gettripviewByParentsID:", err?.message || err);
    next(err);
  }
};