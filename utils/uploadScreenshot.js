// utils/uploadScreenshot.js
const { bucket } = require("../gcs");
const fs = require("fs/promises");
const path = require("path");

async function uploadScreenshot(localFilePath) {
  const fileName = path.basename(localFilePath);
  const destFile = bucket.file(`screenshots/${fileName}`);
  const fileData = await fs.readFile(localFilePath);

  await destFile.save(fileData, {
    resumable: false,
    contentType: "image/png",
  });

  await destFile.makePublic();

  return `https://storage.googleapis.com/${bucket.name}/screenshots/${fileName}`;
}

module.exports = { uploadScreenshot };
