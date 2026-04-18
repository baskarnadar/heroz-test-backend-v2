const axios = require("axios");
const { connectToMongoDB } = require("../../database/mongodb"); 


function getAuthHeaderV1() {
  const token = Buffer.from(`${apiKey}:${secretKey}`).toString("base64");
  return `Basic ${token}`;
}

 async function resolveSmsMessage(keyword, langNorm) {
  const db = await connectToMongoDB();
  const coll = db.collection("tblloksmsmessage");

  const trimmedKeyword = String(keyword || "").trim();

  // ✅ Only find by keyword — no extra conditions
  const tpl = await coll.findOne({ KeyWord: trimmedKeyword });

  if (!tpl) {
    return {
      ok: false,
      error: `Template not found for keyword='${trimmedKeyword}'`,
    };
  }

  // ✅ Choose Arabic or English text
  let message = "";
  if (langNorm === "ar") {
    message = (tpl.armessage || tpl.message || "").trim();
  } else {
    message = (tpl.enmessage || tpl.message || "").trim();
  }

  if (!message) {
    return {
      ok: false,
      error: `Template found but empty message for keyword='${trimmedKeyword}', lang='${langNorm}'`,
    };
  }

  // ✅ Return the message and the found template
  return { ok: true, message, template: tpl };
}


 async function herozsendsms(mobileNo, keyword, lang) {
  const SAIDSCodeVal = "+966";
  mobileNo = SAIDSCodeVal + mobileNo;
  mobileNo = mobileNo.replace("+9660", "+966");

  try {
    if (!mobileNo || !keyword || !lang) {
      throw new Error("Missing required fields: mobileNo, keyword, or lang");
    }

    const langNorm = String(lang).trim().toLowerCase();
    if (!["ar", "en"].includes(langNorm)) {
      throw new Error(`Unsupported language '${lang}'`);
    }

    // Resolve the message text
    const msgRes = await resolveSmsMessage(keyword, langNorm);
    if (!msgRes.ok) throw new Error(msgRes.error);

    const message = msgRes.message;
    const payload = {
      messages: [
        {
          text: message,
          numbers: [mobileNo],
          sender,
        },
      ],
    };

    console.log("📨 Sending SMS with payload:", payload);

    const { data } = await axios.post(
      "https://api-sms.4jawaly.com/api/v1/account/area/sms/send",
      JSON.stringify(payload),
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: getAuthHeaderV1(),
        },
        maxBodyLength: Infinity,
      }
    );

    console.log("✅ SMS API response:", data);
    return { ok: true, data };
  } catch (err) {
    console.error("🚨 SMS Sending Error Trace:");
    console.error("Error Message:", err?.message);
    console.error("Error Stack:", err?.stack);
    if (err?.response) {
      console.error("Error Response Data:", err.response.data);
      console.error("Error Response Status:", err.response.status);
      console.error("Error Response Headers:", err.response.headers);
    }
    return { ok: false, error: err?.response?.data || err?.message || err };
  }
}

module.exports = { herozsendsms };
