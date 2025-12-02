const fs = require("fs");
const path = require("path");
const { google } = require("googleapis");
const { v4: uuidv4 } = require("uuid");
const db = require("../db/database");
const { getBankFromSubject } = require("./bankDetection");
const redis = require("redis");

// Redis setup: use REDIS_URL from environment (Railway provides this)
const redisClient = redis.createClient({
  url: process.env.REDIS_URL || undefined,
});
redisClient.on("error", (err) => console.log("Redis Client Error", err));
(async () => {
  try {
    await redisClient.connect();
    console.log("Connected to Redis");
  } catch (e) {
    console.error("Failed to connect to Redis:", e);
  }
})();

const TEMP_DIR = path.join(__dirname, "../../temp_pdfs");

if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

async function savePdfAndCache(gmail, msg, userId) {
  const info = [];
  const bank = getBankFromSubject(msg);

  if (bank === "UNKNOWN") {
    return info;
  }

  // Insert bank into DB
  db.run(
    "INSERT OR IGNORE INTO user_banks (user_id, bank_name) VALUES (?, ?)",
    [userId, bank.toLowerCase()],
    (err) => {
      if (err) console.error("Error inserting bank", err);
    }
  );

  const parts = msg.payload.parts || [];

  for (const part of parts) {
    const filename = part.filename || "";
    if (filename.toLowerCase().endsWith(".pdf")) {
      const attachmentId = part.body.attachmentId;
      if (attachmentId) {
        try {
          const attach = await gmail.users.messages.attachments.get({
            userId: "me",
            messageId: msg.id,
            id: attachmentId,
          });

          const pdfData = Buffer.from(attach.data.data, "base64");
          const uniqueId = uuidv4();
          const localPath = path.join(TEMP_DIR, `${uniqueId}_${filename}`);

          fs.writeFileSync(localPath, pdfData);

          // Cache in Redis with bank information
          await redisClient.setEx(
            `pdf:${uniqueId}`,
            3600,
            JSON.stringify({
              path: localPath,
              bank: bank.toLowerCase(),
              originalFilename: filename,
            })
          );

          info.push({
            uuid: uniqueId,
            filename: filename,
            bank: bank,
            path: localPath,
          });
        } catch (e) {
          console.error(`Error downloading attachment for msg ${msg.id}`, e);
        }
      }
    }
  }
  return info;
}

async function autoProcessStatements(auth, userId) {
  const gmail = google.gmail({ version: "v1", auth });

  try {
    const res = await gmail.users.messages.list({
      userId: "me",
      q: 'has:attachment "statement" newer_than:180d',
    });

    const messages = res.data.messages || [];
    const results = [];

    for (const msgInfo of messages) {
      const msg = await gmail.users.messages.get({
        userId: "me",
        id: msgInfo.id,
      });

      const pdfs = await savePdfAndCache(gmail, msg.data, userId);
      results.push(...pdfs);
    }

    return results;
  } catch (error) {
    console.error("The API returned an error: " + error);
    return [];
  }
}

module.exports = { autoProcessStatements, redisClient };
