// brevoMailer.js
import SibApiV3Sdk from "sib-api-v3-sdk";

const client = SibApiV3Sdk.ApiClient.instance;
const apiKey = client.authentications["api-key"];
apiKey.apiKey = process.env.BREVO_API_KEY;

const tranEmailApi = new SibApiV3Sdk.TransactionalEmailsApi();

const DEFAULT_FROM = {
  email: process.env.MAIL_FROM_EMAIL || "no-reply@localhost",
  name: process.env.MAIL_FROM_NAME || "System",
};

export async function sendTemplate({ to, templateId, params }) {
  if (!templateId) throw new Error("Missing templateId");
  const payload = {
    sender: DEFAULT_FROM,
    to: Array.isArray(to) ? to : [{ email: to }],
    templateId,
    params
  };
  return await tranEmailApi.sendTransacEmail(payload);
}

export async function sendHtml({ to, subject, html, text }) {
  if (!subject) throw new Error("Missing subject");
  const payload = {
    sender: DEFAULT_FROM,
    to: Array.isArray(to) ? to : [{ email: to }],
    subject,
    htmlContent: html,
    textContent: text
  };
  return await tranEmailApi.sendTransacEmail(payload);
}
