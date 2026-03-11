const { connectToMongoDB } = require("../../../database/mongodb");
const { createUser } = require("../../service/userService");
const {
  generateUniqueId,
  generateOtp
} = require("../../../controllers/operation/operation");
const crypto = require("crypto");
const {
  herozsendsms, 
} = require("../../../controllers/commondata/operation/smsservice");
const fs = require("fs");      // if not already there
const path = require("path");
const PDFDocument = require("pdfkit");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { v4: uuidv4 } = require("uuid");
const QRCode = require("qrcode");

// S3 client
const s3Client = new S3Client({
  region: process.env.AWS_BUCKET_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_SECRET_KEY,
  }
});

const doc = new PDFDocument({ size: "A4", margin: 40 });

 
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
 
 
 exports.changepwd = async (req, res, next) => {
  try {
    const db = await connectToMongoDB();
    const { prtuserid, password } = req.body;

    if (!prtuserid || String(prtuserid).trim() === "") {
      return sendResponse(res, "prtuserid is required.", true);
    }
    if (!password || String(password).trim() === "") {
      return sendResponse(res, "password is required.", true);
    }

    const user = await db
      .collection("tblprtusers")
      .findOne({ prtuserid }, { projection: { username: 1, userName: 1, UserName: 1 } });

    if (!user) {
      return sendResponse(res, "User not found.", true);
    }

    const usernameval = user.username ?? user.userName ?? user.UserName ?? "";

    let pwdkey = "";
    const value = usernameval + password;
    const md5Key = crypto.createHash("md5").update(value, "utf-8").digest();
    for (let i = 0; i < md5Key.length; i++) {
      pwdkey += md5Key[i];
    }

    const result = await db.collection("tblprtusers").updateOne(
      { prtuserid },
      { $set: { password: pwdkey } }
    );

    return sendResponse(res, "Password updated.", null, { modified: result.modifiedCount });
  } catch (error) {
    return sendResponse(res, "Error in changepwd.", true, { error: String(error?.message || error) });
  }
};

 

 
exports.isUserExist = async (req, res, next) => {
  try {
    const db = await connectToMongoDB();
    const { mobileno } = req.body || {};

    if (!mobileno || String(mobileno).trim() === "") {
      return sendResponse(res, "mobileno is required.", true);
    }
    const mobile = String(mobileno).trim();
    const query = {
      $or: [{ username: mobile }, { userName: mobile }, { UserName: mobile }],
    };
    const user = await db.collection("tblprtusers").findOne(
      query,
      { projection: { _id: 0, prtuserid: 1 } }
    );

    if (!user) {
      return sendResponse(res, "User not found.", null, {
        exists: false,
        prtuserid: null,
      });
    }

    // Generate OTP from separate file
    const otp = generateOtp(4);
    const now = new Date();

    const update = {
      $set: {
        SMSOtpNo: otp,
        SMSDateTime: now,
        SMSOtpStatus: "NEW",
      },
    };

    const result = await db.collection("tblprtusers").updateOne(query, update);

    return sendResponse(res, "Lookup complete. OTP generated.", null, {
      exists: true,
      prtuserid: user?.prtuserid || null,
      otp, // REMOVE in production
      modified: result.modifiedCount,
    });
  } catch (error) {
    return sendResponse(
      res,
      "Error in isUserExist.",
      true,
      { error: String(error?.message || error) }
    );
  }
};

 

exports.IsOtpVerified = async (req, res, next) => {
  try {
    const db = await connectToMongoDB();
    const { mobileno, prtuserid, otp } = req.body || {};

    // 1) Validate input
    if (!mobileno || String(mobileno).trim() === "") {
      return sendResponse(res, "mobileno is required.", true);
    }
    if (!prtuserid || String(prtuserid).trim() === "") {
      return sendResponse(res, "prtuserid is required.", true);
    }
    if (otp == null || String(otp).trim() === "") {
      return sendResponse(res, "otp is required.", true);
    }

    const mobile = String(mobileno).trim();
    const otpStr = String(otp).trim();

    // Optional: ensure 4-digit numeric
    if (!/^\d{4}$/.test(otpStr)) {
      return sendResponse(res, "otp must be a 4-digit number.", true);
    }

    // 2) Find user by username variants + prtuserid
    const query = {
      prtuserid: String(prtuserid).trim(),
      $or: [{ username: mobile }, { userName: mobile }, { UserName: mobile }],
    };

    // Need OTP fields for comparison (support multiple casings)
    const user = await db.collection("tblprtusers").findOne(query, {
      projection: {
        _id: 0,
        prtuserid: 1,
        username: 1, userName: 1, UserName: 1,
        SmsOtpNo: 1 ,    // extra-safe
        SMSGenerateDateTime: 1, 
        SMSOtpStatus: 1, 
        SMSOtpStatus: 1,
      },
    });

    if (!user) {
      return sendResponse(res, "User not found.", true, { verified: false });
    }

    // 3) Compare OTP (string compare to avoid type mismatch)
    const storedOtp = user.SMSOtpNo ?? user.SmsOtpNo ?? user.smsOtpNo ?? null;
    if (storedOtp == null) {
      return sendResponse(res, "No OTP found for this user. Please request a new OTP.", true, {
        verified: false,
      });
    }
    if (String(storedOtp) !== otpStr) {
      return sendResponse(res, "Invalid OTP.", true, { verified: false });
    }

     
    // 4) Mark as verified + APPROVED
    const now = new Date();
    const update = {
      $set: {
         
        SmsOtpStatus: "APPROVED", 
        SMSDateTime: now,
      },
      // Optional: make OTP one-time use (uncomment to clear)
      // $unset: { SMSOtpNo: "", SmsOtpNo: "", smsOtpNo: "" }
    };

    const upd = await db.collection("tblprtusers").updateOne(query, update);

    return sendResponse(res, "OTP verified.", null, {
      verified: true,
      prtuserid: user.prtuserid || null,
      smsOtpStatus: "APPROVED",
      modified: upd.modifiedCount,
    });
  } catch (error) {
    return sendResponse(
      res,
      "Error in IsOtpVerified.",
      true,
      { error: String(error?.message || error) }
    );
  }
};
 exports.smssignup = async (req, res, next) => {
  const username = req.body.mobileno;

  //-------------------SMS Begin-------------------------------------------------------
  let keyword = "SIGNUP";
  let lang = "ar";
  try {
    const smsResult = await herozsendsms(username, keyword, lang);
    console.log("SMS Result:", smsResult);

    if (!smsResult.ok) {
      console.error("❌ SMS sending failed:", smsResult.error);
    } else {
      console.log("✅ SMS sent successfully:", smsResult.data);
    }

    return res.status(200).json({ message: "Signup process executed.", smsResult });
  } catch (err) {
    console.error("🚨 Signup process error:", err);
    return res.status(500).json({ message: "Internal error during signup.", error: err });
  }
  //-------------------SMS END---------------------------------------------------------
};



 exports.signup = async (req, res, next) => {
  var SchoolIDVal = generateUniqueId();
  try {
    const db = await connectToMongoDB();
    const { schName, schEmail, password } = req.body;
    const username = req.body.mobileno;

    const NowISO = new Date();

    if (!username || String(username).trim() === "") {
      return sendResponse(res, "username is required.", true);
    }
    if (!password || String(password).trim() === "") {
      return sendResponse(res, "password is required.", true);
    }

    // ✅ Check if username already exists (case-insensitive)
    const existingUser = await db
      .collection("tblprtusers")
      .findOne({ username: { $regex: `^${username}$`, $options: "i" } });

    if (existingUser) {
      return sendResponse(res, "duplicate mobile no or username", true);
    }

    // ✅ Check if email already exists (case-insensitive) in tblschoolinfo
    if (schEmail && String(schEmail).trim() !== "") {
      const existingEmail = await db
        .collection("tblschoolinfo")
        .findOne({ schEmailAddress: { $regex: `^${schEmail}$`, $options: "i" } });

      if (existingEmail) {
        return sendResponse(res, "duplicate email address", true);
      }
    }

    // ✅ Hash password (legacy scheme: md5(username + password) → decimal-byte string)
    let pwdkey = "";
    const value = username + password;
    const md5Key = crypto.createHash("md5").update(value, "utf-8").digest();
    for (let i = 0; i < md5Key.length; i++) {
      pwdkey += md5Key[i];
    }
console.log(pwdkey);
    const schoolDoc = {
      SchoolID: SchoolIDVal,
      schName: String(schName).trim(),
      schStatus: "ACTIVE",
      IsDataStatus: "1",
      schEmailAddress: schEmail || null,
      schMobileNo1: username,
      CreatedAt: NowISO,
      UpdatedAt: NowISO,
      CreatedBy: SchoolIDVal,
      ModifyBy: SchoolIDVal,
      schImageName: "logo.png",
    };

    const schoolInsertResult = await db.collection("tblschoolinfo").insertOne(schoolDoc);

    // ✅ Create the user
    await createUser({
      prtuserid: SchoolIDVal,
      username: username,
      password: password,
      usertype: "SCHOOL-SUBADMIN",
      userstatus: "ACTIVE",
      CreatedBy: SchoolIDVal,
      ModifyBy: SchoolIDVal,
    });

  
    

      //-------------------SMS Begin-------------------------------------------------------
      let smskeyword = "SIGNUP";
      let smslang = "ar"; 
      let smsmobileno = username; 
      const smsResult = await herozsendsms(smsmobileno, smskeyword, smslang);
      console.log("SMS Result:", smsResult);

      if (!smsResult.ok) {
      console.error("❌ SMS sending failed:", smsResult.error);
      } else {
      console.log("✅ SMS sent successfully:", smsResult.data);
    }
 
  //-------------------SMS END---------------------------------------------------------


    // ✅ Success
    return sendResponse(res, "School Inserted.", null, {
      schoolMongoId: schoolInsertResult.insertedId,
      SchoolID: SchoolIDVal,
      username: username,
    });

  } catch (error) {
    return sendResponse(res, "Error in School Inserted.", true, {
      error: String(error?.message || error),
    });
  }
};

exports.herozagreement = async (req, res, next) => {
  const AgreeIDVal = "100"; // fixed ID for update

  try {
    const db = await connectToMongoDB();
    const { HerozAgreeDesc } = req.body;

    const NowISO = new Date();

    // Update the record with AgreeID = 100
    const updateResult = await db.collection("tblherozagree").updateOne(
      { AgreeID: AgreeIDVal },
      {
        $set: {
          HerozAgreeDesc: String(HerozAgreeDesc || "").trim(),
          UpdatedAt: NowISO,
          ModifyBy: AgreeIDVal, 
           
        }
      }
    );

    if (updateResult.matchedCount === 0) {
      return sendResponse(res, `No record found with AgreeID ${AgreeIDVal}.`, true);
    }

    // ✅ Success response
    return sendResponse(res, "Heroz Agreement Updated.", null, {
      updatedCount: updateResult.modifiedCount,
      AgreeID: AgreeIDVal
    });

  } catch (error) {
    return sendResponse(res, "Error in Heroz Agreement Update.", true, {
      error: String(error?.message || error),
    });
  }
};
 
// controllers/herozAgreement.controller.js
// Requires: connectToMongoDB() and sendResponse()



exports.getagree = async (req, res, next) => {
  try {
    const db = await connectToMongoDB();

    const doc = await db.collection(COLLECTION).findOne(
      { AgreeID: AGREEMENT_ID },
      {
        projection: {
          _id: 0,
          AgreeID: 1,
          HerozAgreeDesc: 1,
          
        },
      }
    );

    if (!doc) {
      return sendResponse(res, `No record found with AgreeID ${AGREEMENT_ID}.`, true);
    }

    return sendResponse(res, "Heroz Agreement Fetched.", null, doc);
  } catch (error) {
    return sendResponse(res, "Error fetching Heroz Agreement.", true, {
      error: String(error?.message || error),
    });
  }
}; 
 exports.genSchReport = async (req, res, next) => {
  try {
    const payload = req.body || {};

    if (!payload.schoolName || !payload.destinationVendor) {
      return sendResponse(
        res,
        "schoolName and destinationVendor are required.",
        { type: "validation_error", receivedBody: req.body },
        null
      );
    }

    // ✅ Accept coverImageUrl OR schoolImageUrl OR headerimageUrl
    const headerImageUrlRaw =
      payload.coverImageUrl || payload.schoolImageUrl || payload.headerimageUrl;

    if (!headerImageUrlRaw || String(headerImageUrlRaw).trim() === "") {
      return sendResponse(
        res,
        "coverImageUrl (or schoolImageUrl or headerimageUrl) is required and must be a valid public image URL.",
        {
          type: "validation_error",
          field: "coverImageUrl|schoolImageUrl|headerimageUrl",
          receivedBody: req.body,
        },
        null
      );
    }

    const pdfBuffer = await createTripReportPdfBuffer(payload);

    const bucketName = process.env.AWS_BUCKET_NAME;
    const region = process.env.AWS_BUCKET_REGION;

    if (!bucketName || !region) {
      return sendResponse(
        res,
        "AWS_BUCKET_NAME and AWS_BUCKET_REGION must be set.",
        { type: "config_error", receivedBody: req.body },
        null
      );
    }

    const fileName = "school_trip_report.pdf";
    const key = `reports/${fileName}`;

    const { PutObjectCommand } = require("@aws-sdk/client-s3");

    const putCmd = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: pdfBuffer,
      ContentType: "application/pdf",
    });

    await s3Client.send(putCmd);

    const fileUrl = `https://${bucketName}.s3.${region}.amazonaws.com/${key}`;

    return sendResponse(res, "PDF generated and uploaded successfully.", null, {
      fileUrl,
      fileKey: key,
      fileName,
    });
  } catch (err) {
    console.error("PDF/S3 error:", err);
    return sendResponse(
      res,
      "Failed to generate or upload PDF.",
      { type: "server_error", details: err.message },
      null
    );
  }
};

async function createTripReportPdfBuffer(payload) {
  const http = require("http");
  const https = require("https");
  const fs = require("fs");
  const path = require("path");
  const QRCode = require("qrcode");

  // -----------------------
  // Helpers
  // -----------------------
  function clampStr(v) {
    return v === undefined || v === null ? "" : String(v);
  }

  function sanitizeText(v) {
    let s = clampStr(v);
    if (!s) return "";
    s = s.replace(/[\u200E\u200F\u202A-\u202E\u2066-\u2069\u061C]/g, "");
    s = s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");
    s = s.replace(/[ \t]+/g, " ").trim();
    return s;
  }

  function normalizeUrl(u) {
    if (!u) return "";
    return String(u).trim().replace(/\s+/g, "");
  }

  function downloadToBuffer(url, maxBytes = 10_000_000) {
    return new Promise((resolve, reject) => {
      const lib = String(url).startsWith("https") ? https : http;

      const req = lib.get(url, (res) => {
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`Failed to download. Status: ${res.statusCode}`));
        }

        const chunks = [];
        let size = 0;

        res.on("data", (d) => {
          size += d.length;
          if (size > maxBytes) {
            req.destroy();
            return reject(new Error("File too large"));
          }
          chunks.push(d);
        });

        res.on("end", () => resolve(Buffer.concat(chunks)));
      });

      req.on("error", reject);
      req.setTimeout(12000, () => req.destroy(new Error("Download timeout")));
    });
  }

  function isPngBuffer(buf) {
    return (
      buf &&
      buf.length >= 8 &&
      buf[0] === 0x89 &&
      buf[1] === 0x50 &&
      buf[2] === 0x4e &&
      buf[3] === 0x47 &&
      buf[4] === 0x0d &&
      buf[5] === 0x0a &&
      buf[6] === 0x1a &&
      buf[7] === 0x0a
    );
  }

  function isJpgBuffer(buf) {
    return buf && buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  }

  function toDataUriFromBuffer(buf) {
    const mime = isJpgBuffer(buf) ? "image/jpeg" : "image/png";
    return `data:${mime};base64,${buf.toString("base64")}`;
  }

  function resolveAssetAbs(rel) {
    const cleaned = rel.replace(/^[\\/]+/, "");
    const try1 = path.join(process.cwd(), cleaned);
    if (fs.existsSync(try1)) return try1;

    const try2 = path.join(__dirname, cleaned);
    if (fs.existsSync(try2)) return try2;

    const try3 = path.join(__dirname, "..", cleaned);
    if (fs.existsSync(try3)) return try3;

    return try1;
  }

  function safeReadFileBase64(relPath, maxBytes = 2500 * 1024) {
    try {
      const abs = resolveAssetAbs(relPath);
      if (!fs.existsSync(abs)) return "";
      const stat = fs.statSync(abs);
      if (!stat.isFile() || stat.size <= 0 || stat.size > maxBytes) return "";
      const buf = fs.readFileSync(abs);
      return buf.toString("base64");
    } catch {
      return "";
    }
  }

  function toList(val) {
    if (Array.isArray(val)) return val;
    const s = sanitizeText(val);
    if (!s) return [];
    return s
      .split(/,|\n/gi)
      .map((x) => x.trim())
      .filter(Boolean);
  }

  function money(n) {
    if (n === undefined || n === null || n === "") return "";
    const x = Number(n);
    if (Number.isNaN(x)) return String(n);
    return `${x.toFixed(0)} SAR`;
  }

  function escapeHtml(str) {
    const s = clampStr(str);
    return s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  const COLORS = {
    purple: "#7B1E6D",
    magenta: "#B02086",
    lightGray: "#F1F1F3",
    midGray: "#CFCFD4",
    darkText: "#333333",
    white: "#FFFFFF",
    figmaBorder: "#B02086",
  };

  // ✅ Download header image (ONLY png/jpg without sharp)
  const headerImageUrl = normalizeUrl(
    payload.coverImageUrl || payload.schoolImageUrl || payload.headerimageUrl
  );

  const headerBuf = await downloadToBuffer(headerImageUrl, 10_000_000);

  if (!isPngBuffer(headerBuf) && !isJpgBuffer(headerBuf)) {
    throw new Error(
      "Header image must be PNG or JPG when sharp is not installed. Please upload a public PNG/JPG URL (or install sharp to support WEBP)."
    );
  }

  const headerDataUri = toDataUriFromBuffer(headerBuf);

  // ✅ QR
  const qrValue = sanitizeText(payload.tripPhotosUrl || payload.qrValue || "https://heroz.sa");
  const qrDataUrl = await QRCode.toDataURL(String(qrValue), { margin: 1, scale: 8 });

  // ✅ Footer assets
  const footerBgB64 = safeReadFileBase64("assets/icons/bbg.png", 4000 * 1024);
  const phoneIconB64 = safeReadFileBase64("assets/icons/phone.png", 800 * 1024);
  const emailIconB64 = safeReadFileBase64("assets/icons/email.png", 800 * 1024);
  const addressIconB64 = safeReadFileBase64("assets/icons/address.png", 800 * 1024);
  const companyIconB64 = safeReadFileBase64("assets/icons/company.png", 800 * 1024);

  const footer = payload.footer || {};
  const footerPhone = sanitizeText(footer.phone || "+966 548 066 660");
  const footerEmail = sanitizeText(footer.email || "Info@Heroz.sa");
  const footerAddress = sanitizeText(footer.address || "Saudi Araibia - Jeddah");
  const footerCr = sanitizeText(footer.companyCr || "4030580386");

  const teachersLines = toList(
    payload.teachers ??
      payload.attendeesTeachers ??
      payload.attendees ??
      payload.teacherList ??
      payload.attendees_teachers ??
      payload.teacherNames ??
      payload.teachersList
  );

  const gradesArr = toList(
    payload.grades ?? payload.participatingGrades ?? payload.classes ?? payload.gradeClasses
  );

  const notesText = sanitizeText(payload.teacherNotes || payload.teachersNotes || "");

  const outcomes = toList(payload.learningOutcomes);
  const otherOutcomes = toList(payload.OtherOutComes || payload.otherOutcomes);

  const fixedOutcomes = [
    ...(outcomes || []),
    ...(otherOutcomes && otherOutcomes.length ? ["Other Outcomes:"] : []),
    ...(otherOutcomes || []),
  ]
    .map((x) => sanitizeText(x))
    .filter(Boolean);

  const teacherNamesArr = toList(
    payload.teacherNames ??
      payload.teacherName ??
      payload.teachers ??
      payload.attendeesTeachers ??
      payload.teacherList ??
      payload.teachersList
  );
  const teacherText = (teacherNamesArr.length ? teacherNamesArr : ["-"]).join("\n");

  const fin = payload.financial || {};
  const rows = [
    ["Cost Price (per student)", money(fin.costPricePerStudent)],
    ["Sold Price (per student)", money(fin.soldPricePerStudent)],
    ["Profit (per student)", money(fin.profitPerStudent)],
    ["Extra Profit", money(fin.totalTripFoodProfit)],
    ["Total Profit", money(fin.totalTripProfitWithoutVat)],
  ];

  const CTA_TITLE = sanitizeText(payload.callToActionTitle || "Call to action");
  const CTA_SUBTITLE = sanitizeText(
    payload.callToActionSubtitle || "Book your next school trip with heroz"
  );

  // ✅ This will print correctly in Chromium
  const arabicHeading = "تقرير واحد اثنين ثلاثة";

  // ✅ Embed Arabic font (recommended)
  const arFontAbs = resolveAssetAbs("assets/fonts/NotoNaskhArabic-Regular.ttf");
  const arFontB64 = fs.existsSync(arFontAbs) ? fs.readFileSync(arFontAbs).toString("base64") : "";

  const html = `
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    ${arFontB64 ? `
    @font-face {
      font-family: "NotoNaskhArabic";
      src: url(data:font/ttf;base64,${arFontB64}) format("truetype");
      font-weight: 400;
      font-style: normal;
    }` : ""}

    * { box-sizing: border-box; }
    body { margin:0; padding:22px; font-family: Arial, Helvetica, sans-serif; color:${COLORS.darkText}; }
    .headerWrap { height:150px; border-radius:18px; overflow:hidden; position:relative; background:#E9E9EE; }
    .headerWrap img { width:100%; height:150px; object-fit:cover; display:block; }
    .schoolNameOverlay { position:absolute; left:18px; bottom:18px; color:#fff; font-size:18px; font-weight:700; text-shadow:0 2px 10px rgba(0,0,0,.35); max-width:80%; }

    .arabicLine {
      margin-top: 10px;
      color: ${COLORS.magenta};
      font-size: 11px;
      font-weight: 700;
      direction: rtl;
      unicode-bidi: plaintext;
      text-align: right;
      white-space: nowrap;
      font-family: ${arFontB64 ? `"NotoNaskhArabic", Arial, sans-serif` : "Arial, sans-serif"};
    }

    .titleCenter { margin-top:6px; text-align:center; color:${COLORS.magenta}; font-weight:800; font-size:12px; }

    .box { margin-top:20px; background:${COLORS.lightGray}; border-radius:12px; padding:14px; }
    .grid3 { display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px; }
    .label { color:${COLORS.magenta}; font-weight:700; font-size:9px; margin-bottom:6px; }
    .valueBox { background:#fff; border:1px solid ${COLORS.midGray}; border-radius:8px; min-height:34px; padding:8px; font-size:10px; white-space:pre-wrap; }

    .grid2 { display:grid; grid-template-columns:55% 45%; gap:10px; align-items:start; }
    table { width:100%; border-collapse:collapse; border-radius:8px; overflow:hidden; background:#fff; }
    thead th { color:#fff; text-align:left; padding:6px 10px; font-size:9px; }
    thead th:first-child { background:${COLORS.purple}; width:48%; }
    thead th:last-child { background:${COLORS.magenta}; width:52%; }
    tbody td { border:1px solid ${COLORS.midGray}; padding:6px 10px; font-size:9px; }

    .qrTitle { text-align:center; color:${COLORS.magenta}; font-size:16px; font-weight:800; margin-bottom:12px; }
    .qrBox { display:flex; justify-content:center; }
    .qrBox img { width:95px; height:95px; }

    .cta { margin-top:18px; text-align:center; color:${COLORS.magenta}; }
    .ctaTitle { font-size:16px; font-weight:800; }
    .ctaSub { font-size:10px; margin-top:6px; }

    .pair { margin-top:10px; display:grid; grid-template-columns:60% 40%; gap:14px; }
    .boxedTitle { color:${COLORS.magenta}; font-weight:800; font-size:10px; margin-bottom:10px; }
    .outlined { background:#fff; border:2px solid ${COLORS.figmaBorder}; border-radius:10px; padding:12px; min-height:140px; white-space:pre-wrap; font-size:9px; line-height:1.35; }

    .footerBar {
      position: fixed; left:0; right:0; bottom:0; height:34px;
      ${footerBgB64 ? `background-image:url("data:image/png;base64,${footerBgB64}"); background-size:cover;` : `background:${COLORS.purple};`}
      color:#fff; display:grid; grid-template-columns:1fr 1fr 1fr 1fr; align-items:center;
      padding:0 22px; font-size:9px; gap:10px;
    }
    .footerItem { display:flex; align-items:center; gap:6px; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; }
    .footerItem img { width:14px; height:14px; }
  </style>
</head>
<body>
  <div class="headerWrap">
    <img src="${headerDataUri}" />
    <div class="schoolNameOverlay">${escapeHtml(sanitizeText(payload.schoolName))}</div>
  </div>

  <div class="arabicLine">${escapeHtml(arabicHeading)}</div>

  <div class="titleCenter">TRIP REPORT</div>

  <div class="box">
    <div class="grid3">
      <div>
        <div class="label">School</div>
        <div class="valueBox">${escapeHtml(sanitizeText(payload.schoolName || "-"))}</div>

        <div style="height:10px"></div>
        <div class="label">Day & Time</div>
        <div class="valueBox">${escapeHtml(sanitizeText(payload.dayTime || "-"))}</div>

        <div style="height:10px"></div>
        <div class="label">Total Number of Students</div>
        <div class="valueBox">${escapeHtml(sanitizeText(payload.totalStudents ?? "-"))}</div>
      </div>

      <div>
        <div class="label">Destination</div>
        <div class="valueBox">${escapeHtml(sanitizeText(payload.destinationVendor || "-"))}</div>

        <div style="height:10px"></div>
        <div class="label">Participating Grades/Classes</div>
        <div class="valueBox">${escapeHtml((gradesArr.length ? gradesArr : ["-"]).map(sanitizeText).join("\n"))}</div>
      </div>

      <div>
        <div class="label">Attendees teachers</div>
        <div class="valueBox">${escapeHtml((teachersLines.length ? teachersLines : ["-"]).map(sanitizeText).join("\n"))}</div>

        <div style="height:10px"></div>
        <div class="label">Teacher Notes</div>
        <div class="valueBox">${escapeHtml(notesText || "-")}</div>
      </div>
    </div>
  </div>

  <div class="box">
    <div class="grid2">
      <div>
        <div class="boxedTitle">Financial Summary without Tax</div>
        <table>
          <thead><tr><th>Item</th><th>Amount</th></tr></thead>
          <tbody>
            ${rows.map(r => `<tr><td>${escapeHtml(r[0])}</td><td>${escapeHtml(r[1])}</td></tr>`).join("")}
          </tbody>
        </table>
      </div>

      <div>
        <div class="qrTitle">Scan For The trip pictures</div>
        <div class="qrBox"><img src="${qrDataUrl}" /></div>

        <div class="cta">
          <div class="ctaTitle">“ ${escapeHtml(CTA_TITLE || "Call to action")} ”</div>
          <div class="ctaSub">${escapeHtml(CTA_SUBTITLE || "Book your next school trip with heroz")}</div>
        </div>
      </div>
    </div>
  </div>

  <div class="pair">
    <div>
      <div class="boxedTitle">Learning Outcomes Achieved</div>
      <div class="outlined">${escapeHtml((fixedOutcomes.length ? fixedOutcomes : ["-"]).join("\n"))}</div>
    </div>
    <div>
      <div class="boxedTitle">Teacher name :</div>
      <div class="outlined" style="font-size:10px">${escapeHtml(teacherText || "-")}</div>
    </div>
  </div>

  <div class="footerBar">
    <div class="footerItem">
      ${phoneIconB64 ? `<img src="data:image/png;base64,${phoneIconB64}" />` : ""}
      <span>${escapeHtml(footerPhone)}</span>
    </div>
    <div class="footerItem">
      ${emailIconB64 ? `<img src="data:image/png;base64,${emailIconB64}" />` : ""}
      <span>${escapeHtml(footerEmail)}</span>
    </div>
    <div class="footerItem">
      ${addressIconB64 ? `<img src="data:image/png;base64,${addressIconB64}" />` : ""}
      <span>${escapeHtml(footerAddress)}</span>
    </div>
    <div class="footerItem">
      ${companyIconB64 ? `<img src="data:image/png;base64,${companyIconB64}" />` : ""}
      <span>${escapeHtml(footerCr)}</span>
    </div>
  </div>
</body>
</html>
`;

  const puppeteer = require("puppeteer");

  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "22px", right: "22px", bottom: "44px", left: "22px" },
      preferCSSPageSize: true,
    });

    return pdfBuffer;
  } finally {
    await browser.close();
  }
}
