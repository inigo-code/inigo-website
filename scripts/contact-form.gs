/**
 * Contact form mailer for inigo.co.in (Google Apps Script web app).
 *
 * Runs under Inigo's own Google account, so messages arrive from that account
 * and are not filtered as third-party mail. Each message:
 *   1. is emailed to TO, with Reply-To set to the visitor, and
 *   2. gets an automatic confirmation sent to the visitor.
 *
 * Deploy: script.google.com (signed in as TO) > New project > paste this file >
 * Save > run testSend once (authorise it) > Deploy > New deployment > Web app,
 * Execute as: Me, Who has access: Anyone > copy the /exec URL into
 * src/_data/site.json as "formEndpoint".
 *
 * After editing this file, update the deployment (Deploy > Manage deployments >
 * edit > Version: New version) so the /exec URL keeps working.
 */

const TO = "inigo@tosstheworld.org";
const SITE = "https://inigo.co.in";
const OWNER = "J. Inigo Papu Vinodhan";
const MAX_PER_HOUR = 20; // simple guard against abuse; MailApp has a daily quota

function doPost(e) {
  const p = readParams_(e);
  const ajax = String(p._ajax || "") === "1";

  // Honeypot: bots fill the hidden field. Pretend it worked.
  if (p._honey) return reply_(ajax, true);

  const name = clean_(p.name, 120);
  const email = clean_(p.email, 200);
  const topic = clean_(p.topic, 80) || "Something else";
  const message = clean_(p.message, 5000, true);

  if (!name || !message || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return reply_(ajax, false, "Please fill in your name, a valid email and a message.");
  }
  if (!underLimit_()) {
    return reply_(ajax, false, "Too many messages right now.");
  }

  MailApp.sendEmail({
    to: TO,
    replyTo: email,
    name: "inigo.co.in",
    subject: "New message from inigo.co.in: " + topic,
    body:
      "Name: " + name + "\n" +
      "Email: " + email + "\n" +
      "About: " + topic + "\n\n" +
      message + "\n\n" +
      "-- \nSent from the contact form at " + SITE + "/contact/. Reply to this email to answer " + name + ".",
  });

  MailApp.sendEmail({
    to: email,
    replyTo: TO,
    name: OWNER,
    subject: "Thank you for your message",
    body:
      "Dear " + name + ",\n\n" +
      "Thank you for writing to me through inigo.co.in. Your message has reached me, and I will reply to this address soon.\n\n" +
      "With regards,\n" + OWNER + "\n" + SITE + "\n\n" +
      "-- \nYour message:\n" + message,
  });

  return reply_(ajax, true);
}

// Opening the /exec URL in a browser shows this, which confirms the deployment is live.
function doGet() {
  return ContentService.createTextOutput("inigo.co.in contact form is running.");
}

// Run this once from the editor: it asks for permission and emails TO a test message.
function testSend() {
  MailApp.sendEmail(TO, "Contact form test", "If you can read this, the inigo.co.in contact form can send mail.");
}

function readParams_(e) {
  if (e && e.postData && e.postData.contents && /^text\/plain|json/.test(e.postData.type || "")) {
    try { return JSON.parse(e.postData.contents); } catch (err) { /* fall through */ }
  }
  return (e && e.parameter) || {};
}

function clean_(value, max, multiline) {
  let s = String(value == null ? "" : value).trim();
  if (!multiline) s = s.replace(/[\r\n]+/g, " ");
  return s.slice(0, max);
}

function underLimit_() {
  const cache = CacheService.getScriptCache();
  const key = "count-" + new Date().toISOString().slice(0, 13); // per hour
  const n = Number(cache.get(key) || 0);
  if (n >= MAX_PER_HOUR) return false;
  cache.put(key, String(n + 1), 3700);
  return true;
}

function reply_(ajax, ok, error) {
  if (ajax) {
    return ContentService
      .createTextOutput(JSON.stringify(ok ? { success: "true" } : { success: "false", message: error }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  // Without JavaScript the browser lands here after posting the form.
  const text = ok
    ? "<h1>Thank you, your message is on its way.</h1><p>A confirmation has been sent to your email.</p>"
    : "<h1>Sorry, the message didn't go through.</h1><p>" + error + " Please email " + TO + " directly.</p>";
  return HtmlService.createHtmlOutput(
    '<base target="_top"><div style="font:16px/1.5 system-ui,sans-serif;max-width:36rem;margin:3rem auto;padding:0 1rem">' +
      text + '<p><a href="' + SITE + '/">Back to inigo.co.in</a></p></div>'
  ).setTitle("Inigo Papu Vinodhan");
}
