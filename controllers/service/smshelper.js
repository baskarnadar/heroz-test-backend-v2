"use strict";

const otpMobileTracker = new Map();
const otpIpTracker = new Map();

const MOBILE_COOLDOWN_MS = Number(process.env.SMS_MOBILE_COOLDOWN_MS || 60 * 1000);
const MOBILE_WINDOW_MS = Number(process.env.SMS_MOBILE_WINDOW_MS || 15 * 60 * 1000);
const MOBILE_MAX_REQUESTS = Number(process.env.SMS_MOBILE_MAX_REQUESTS || 3);

const IP_WINDOW_MS = Number(process.env.SMS_IP_WINDOW_MS || 15 * 60 * 1000);
const IP_MAX_REQUESTS = Number(process.env.SMS_IP_MAX_REQUESTS || 20);

const ERROR_CODES = {
  SUCCESS: "SMS_000",
  MOBILE_REQUIRED: "SMS_001",
  INVALID_MOBILE: "SMS_002",
  KEYWORD_REQUIRED: "SMS_003",
  LANG_REQUIRED: "SMS_004",
  TEMPLATE_NOT_FOUND: "SMS_005",
  TEMPLATE_EMPTY: "SMS_006",
  MOBILE_COOLDOWN: "SMS_007",
  MOBILE_RATE_LIMIT: "SMS_008",
  IP_RATE_LIMIT: "SMS_009",
  CONFIG_MISSING: "SMS_010",
  PROVIDER_FAILED: "SMS_011",
  DB_ERROR: "SMS_012",
  INTERNAL_ERROR: "SMS_500",
};

function normalizeLang(lang) {
  const val = String(lang || "").trim().toLowerCase();
  return val === "ar" ? "ar" : "en";
}

function getClientIp(req) {
  const xfwd = req?.headers?.["x-forwarded-for"];
  if (xfwd) {
    return String(xfwd).split(",")[0].trim();
  }

  return (
    req?.ip ||
    req?.connection?.remoteAddress ||
    req?.socket?.remoteAddress ||
    "unknown"
  );
}

function normalizeSaudiMobile(mobileNo) {
  if (!mobileNo) return "";

  let val = String(mobileNo).trim();

  val = val.replace(/\s+/g, "");
  val = val.replace(/-/g, "");
  val = val.replace(/[()]/g, "");

  if (val.startsWith("+966")) {
    val = val.replace("+966", "966");
  }

  val = val.replace(/\D+/g, "");

  if (val.startsWith("966") && val.length === 12) return val;
  if (val.startsWith("05") && val.length === 10) return "966" + val.slice(1);
  if (val.startsWith("5") && val.length === 9) return "966" + val;

  return val;
}

function isValidSaudiMobile(mobileNo) {
  return /^9665\d{8}$/.test(String(mobileNo || ""));
}

function pruneTracker(tracker, now, windowMs) {
  for (const [key, value] of tracker.entries()) {
    if (!value || !Array.isArray(value.requests)) {
      tracker.delete(key);
      continue;
    }

    value.requests = value.requests.filter((ts) => now - ts < windowMs);

    if (
      value.requests.length === 0 &&
      (!value.lastSentAt || now - value.lastSentAt > windowMs)
    ) {
      tracker.delete(key);
    } else {
      tracker.set(key, value);
    }
  }
}

function isIpRateLimited(ip, now = Date.now()) {
  pruneTracker(otpIpTracker, now, IP_WINDOW_MS);

  const entry = otpIpTracker.get(ip) || { requests: [] };
  entry.requests = entry.requests.filter((ts) => now - ts < IP_WINDOW_MS);

  if (entry.requests.length >= IP_MAX_REQUESTS) {
    otpIpTracker.set(ip, entry);
    return true;
  }

  entry.requests.push(now);
  otpIpTracker.set(ip, entry);
  return false;
}

function isMobileBlockedOrCooling(mobileNo, now = Date.now()) {
  pruneTracker(otpMobileTracker, now, MOBILE_WINDOW_MS);

  const entry = otpMobileTracker.get(mobileNo) || {
    requests: [],
    lastSentAt: 0,
  };

  entry.requests = entry.requests.filter((ts) => now - ts < MOBILE_WINDOW_MS);

  const isCooling =
    entry.lastSentAt && now - entry.lastSentAt < MOBILE_COOLDOWN_MS;

  const isRateLimited = entry.requests.length >= MOBILE_MAX_REQUESTS;

  otpMobileTracker.set(mobileNo, entry);

  return {
    isCooling,
    isRateLimited,
    cooldownRemainingMs: isCooling
      ? Math.max(0, MOBILE_COOLDOWN_MS - (now - entry.lastSentAt))
      : 0,
    requestCountInWindow: entry.requests.length,
    maxRequestsInWindow: MOBILE_MAX_REQUESTS,
    windowMs: MOBILE_WINDOW_MS,
  };
}

function markMobileSend(mobileNo, now = Date.now()) {
  const entry = otpMobileTracker.get(mobileNo) || {
    requests: [],
    lastSentAt: 0,
  };

  entry.requests.push(now);
  entry.lastSentAt = now;

  otpMobileTracker.set(mobileNo, entry);
}

function maskMobile(mobileNo) {
  const val = String(mobileNo || "");
  if (val.length < 4) return val;
  return `${val.slice(0, 4)}****${val.slice(-2)}`;
}

/* ========================= */
/* ✅ USER FRIENDLY MESSAGES */
/* ========================= */

function getUserMessage(errorCode, data = {}) {
  switch (errorCode) {
    case "SMS_000":
      return {
        en: "SMS sent successfully.",
        ar: "تم إرسال الرسالة بنجاح.",
      };

    case "SMS_001":
      return {
        en: "Mobile number is required.",
        ar: "رقم الجوال مطلوب.",
      };

    case "SMS_002":
      return {
        en: "Invalid mobile number.",
        ar: "رقم الجوال غير صحيح.",
      };

    case "SMS_007":
      const seconds = Math.ceil((data.cooldownRemainingMs || 0) / 1000);
      return {
        en: `Please wait ${seconds} seconds before requesting again.`,
        ar: `يرجى الانتظار ${seconds} ثانية قبل المحاولة مرة أخرى.`,
      };

    case "SMS_008":
      return {
        en: "Too many requests. Please try again later.",
        ar: "طلبات كثيرة. حاول مرة أخرى لاحقاً.",
      };

    case "SMS_009":
      return {
        en: "Too many requests from your network.",
        ar: "طلبات كثيرة من نفس الشبكة.",
      };

    case "SMS_010":
      return {
        en: "SMS service is not configured properly.",
        ar: "خدمة الرسائل غير مهيأة بشكل صحيح.",
      };

    case "SMS_011":
      return {
        en: "Failed to send SMS. Please try again.",
        ar: "فشل إرسال الرسالة. حاول مرة أخرى.",
      };

    case "SMS_005":
      return {
        en: "Message template not found.",
        ar: "قالب الرسالة غير موجود.",
      };

    default:
      return {
        en: "Something went wrong. Please try again.",
        ar: "حدث خطأ. حاول مرة أخرى.",
      };
  }
}

/* ========================= */
/* RESPONSE BUILDERS */
/* ========================= */

function buildSmsResponse({
  ok,
  httpStatus = 200,
  code,
  data = null,
  provider = null,
  details = null,
}) {
  const msg = getUserMessage(code, data);

  return {
    ok: Boolean(ok),
    statusCode: httpStatus,
    errorCode: code,
    messageEn: msg.en,
    messageAr: msg.ar,
    data,
    provider,
    details,
  };
}

function buildSuccess({ data = null, provider = null }) {
  return buildSmsResponse({
    ok: true,
    httpStatus: 200,
    code: ERROR_CODES.SUCCESS,
    data,
    provider,
  });
}

function buildError({
  code = ERROR_CODES.INTERNAL_ERROR,
  httpStatus = 400,
  data = null,
  provider = null,
  details = null,
}) {
  return buildSmsResponse({
    ok: false,
    httpStatus,
    code,
    data,
    provider,
    details,
  });
}

module.exports = {
  ERROR_CODES,
  normalizeLang,
  getClientIp,
  normalizeSaudiMobile,
  isValidSaudiMobile,
  isIpRateLimited,
  isMobileBlockedOrCooling,
  markMobileSend,
  buildSmsResponse,
  buildSuccess,
  buildError,
  maskMobile,
  getUserMessage,
};