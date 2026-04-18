 "use strict";

require("dotenv").config();

var https = require("follow-redirects").https;
const { connectToMongoDB } = require("../../database/mongodb");

const {
  ERROR_CODES,
  normalizeLang,
  getClientIp,
  normalizeSaudiMobile,
  isValidSaudiMobile,
  isIpRateLimited,
  isMobileBlockedOrCooling,
  markMobileSend,
  buildSuccess,
  buildError,
  maskMobile,
} = require("./smshelper");

const SMS_API_URL = process.env.SMS_API_URL;
const SMS_AUTHORIZATION = process.env.SMS_AUTHORIZATION;
const SMS_SENDER_NAME = process.env.SMS_SENDER_NAME;

function hasSmsConfig() {
  return Boolean(SMS_API_URL && SMS_AUTHORIZATION && SMS_SENDER_NAME);
}

async function resolveSmsMessage(keyword, langNorm) {
  try {
    const db = await connectToMongoDB();
    const coll = db.collection("tblloksms");

    const trimmedKeyword = String(keyword || "").trim();
    const tpl = await coll.findOne({ SMSCODE: trimmedKeyword });

    if (!tpl) {
      return {
        ok: false,
        code: ERROR_CODES.TEMPLATE_NOT_FOUND,
        error: `Template not found for SMSCODE='${trimmedKeyword}'`,
      };
    }

    let message = "";
    if (langNorm === "ar") {
      message = String(tpl.armsg || "").trim();
    } else {
      message = String(tpl.enmsg || "").trim();
    }

    if (!message) {
      return {
        ok: false,
        code: ERROR_CODES.TEMPLATE_EMPTY,
        error: `Template found but empty message for SMSCODE='${trimmedKeyword}', lang='${langNorm}'`,
      };
    }

    return {
      ok: true,
      message,
      template: tpl,
    };
  } catch (err) {
    return {
      ok: false,
      code: ERROR_CODES.DB_ERROR,
      error: err?.message || "Database error while resolving SMS template.",
    };
  }
}

function isProviderSuccess(responseData, httpStatus) {
  if (httpStatus >= 200 && httpStatus < 300) {
    if (typeof responseData === "string") {
      const lower = responseData.toLowerCase();
      if (lower.includes("error") || lower.includes("method not allowed")) {
        return false;
      }
      return true;
    }

    if (responseData && typeof responseData === "object") {
      if (responseData.success === false || responseData.ok === false) {
        return false;
      }
      return true;
    }

    return true;
  }

  return false;
}

function sendThrough4jawaly({ mobileNo, message }) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      messages: [
        {
          text: String(message || ""),
          numbers: [String(mobileNo || "")],
        },
      ],
      globals: {
        number_iso: "SA",
        sender: SMS_SENDER_NAME,
      },
    });

    const options = {
      method: "POST",
      hostname: "api-sms.4jawaly.com",
      path: "/api/v1/account/area/sms/send",
      headers: {
        "Content-Type": "application/json",
        "Authorization": SMS_AUTHORIZATION,
      },
      maxRedirects: 20,
    };

    const req = https.request(options, function (res) {
      const chunks = [];

      res.on("data", function (chunk) {
        chunks.push(chunk);
      });

      res.on("end", function () {
        const body = Buffer.concat(chunks).toString();
        let parsedBody = body;

        try {
          parsedBody = JSON.parse(body);
        } catch (e) {
          parsedBody = body;
        }

        resolve({
          ok: isProviderSuccess(parsedBody, res.statusCode || 0),
          httpStatus: res.statusCode || 0,
          data: parsedBody,
          requestPayload: JSON.parse(postData),
        });
      });

      res.on("error", function (error) {
        reject(error);
      });
    });

    req.on("error", function (error) {
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

async function herozsendsms(mobileNo, keyword, lang = "ar", options = {}) {
  const safeLang = normalizeLang(lang);
  const ip = getClientIp(options.req || null);
  const now = Date.now();

  if (!mobileNo || String(mobileNo).trim() === "") {
    return buildError({
      code: ERROR_CODES.MOBILE_REQUIRED,
      httpStatus: 400,
    });
  }

  if (!keyword || String(keyword).trim() === "") {
    return buildError({
      code: ERROR_CODES.KEYWORD_REQUIRED,
      httpStatus: 400,
    });
  }

  if (!lang || String(lang).trim() === "") {
    return buildError({
      code: ERROR_CODES.LANG_REQUIRED,
      httpStatus: 400,
    });
  }

  if (!hasSmsConfig()) {
    return buildError({
      code: ERROR_CODES.CONFIG_MISSING,
      httpStatus: 500,
      details: "Missing SMS_API_URL, SMS_AUTHORIZATION, or SMS_SENDER_NAME",
    });
  }

  const normalizedMobile = normalizeSaudiMobile(mobileNo);

  if (!isValidSaudiMobile(normalizedMobile)) {
    return buildError({
      code: ERROR_CODES.INVALID_MOBILE,
      httpStatus: 400,
      data: {
        mobileNo,
        normalizedMobile,
      },
    });
  }

  if (options.enableIpRateLimit !== false) {
    if (isIpRateLimited(ip, now)) {
      return buildError({
        code: ERROR_CODES.IP_RATE_LIMIT,
        httpStatus: 429,
        data: { ip },
      });
    }
  }

  if (options.enableMobileRateLimit !== false) {
    const mobileCheck = isMobileBlockedOrCooling(normalizedMobile, now);

    if (mobileCheck.isCooling) {
      return buildError({
        code: ERROR_CODES.MOBILE_COOLDOWN,
        httpStatus: 429,
        data: {
          mobileNo: normalizedMobile,
          cooldownRemainingMs: mobileCheck.cooldownRemainingMs,
        },
      });
    }

    if (mobileCheck.isRateLimited) {
      return buildError({
        code: ERROR_CODES.MOBILE_RATE_LIMIT,
        httpStatus: 429,
        data: {
          mobileNo: normalizedMobile,
          requestCountInWindow: mobileCheck.requestCountInWindow,
          maxRequestsInWindow: mobileCheck.maxRequestsInWindow,
          windowMs: mobileCheck.windowMs,
        },
      });
    }
  }

  let resolvedMessage = "";

  if (options.message && String(options.message).trim() !== "") {
    resolvedMessage = String(options.message).trim();
  } else {
    const msgRes = await resolveSmsMessage(keyword, safeLang);

    if (!msgRes.ok) {
      return buildError({
        code: msgRes.code || ERROR_CODES.TEMPLATE_NOT_FOUND,
        httpStatus: msgRes.code === ERROR_CODES.DB_ERROR ? 500 : 404,
        data: {
          keyword: String(keyword).trim(),
          lang: safeLang,
        },
        details: msgRes.error,
      });
    }

    resolvedMessage = msgRes.message;
  }

  try {
    let providerMobile = normalizedMobile;
    if (providerMobile.startsWith("966")) {
      providerMobile = "0" + providerMobile.slice(3);
    }

    const providerResult = await sendThrough4jawaly({
      mobileNo: providerMobile,
      message: resolvedMessage,
    });

    if (!providerResult.ok) {
      return buildError({
        code: ERROR_CODES.PROVIDER_FAILED,
        httpStatus: 502,
        data: {
          mobileNo: normalizedMobile,
          providerMobile,
          maskedMobile: maskMobile(normalizedMobile),
          keyword: String(keyword).trim(),
          lang: safeLang,
        },
        provider: {
          httpStatus: providerResult.httpStatus,
          response: providerResult.data,
        },
        details: null,
      });
    }

    if (options.enableMobileRateLimit !== false) {
      markMobileSend(normalizedMobile, now);
    }

    return buildSuccess({
      data: {
        mobileNo: normalizedMobile,
        providerMobile,
        maskedMobile: maskMobile(normalizedMobile),
        keyword: String(keyword).trim(),
        lang: safeLang,
        sender: SMS_SENDER_NAME,
      },
      provider: {
        httpStatus: providerResult.httpStatus,
        response: providerResult.data,
      },
    });
  } catch (err) {
    return buildError({
      code: ERROR_CODES.PROVIDER_FAILED,
      httpStatus: 502,
      data: {
        mobileNo: normalizedMobile,
        maskedMobile: maskMobile(normalizedMobile),
        keyword: String(keyword).trim(),
        lang: safeLang,
      },
      provider: null,
      details: err?.message || "SMS provider request failed.",
    });
  }
}

module.exports = {
  herozsendsms,
  resolveSmsMessage,
};