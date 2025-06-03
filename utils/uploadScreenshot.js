// utils/uploadScreenshot.js
const { bucket } = require("../gcs");
const fs = require("fs/promises");
const path = require("path");

async function uploadScreenshot(localFilePath) {
  try {
    const fileName = path.basename(localFilePath);
    const destFile = bucket.file(`screenshots/${fileName}`);
    const fileData = await fs.readFile(localFilePath);

    await destFile.save(fileData, {
      resumable: false,
      contentType: "image/png",
    });

    // Removed: await destFile.makePublic();
    console.log(`✅ Uploaded screenshot: ${fileName}`);

    // Optionally return a signed URL instead
    // const [url] = await destFile.getSignedUrl({
    //   action: 'read',
    //   expires: Date.now() + 1000 * 60 * 10, // 10 minutes
    // });
    // return url;

    // Just return the GCS URI for internal use
    return `gs://${bucket.name}/screenshots/${fileName}`;
  } catch (error) {
    console.error("❌ Error uploading screenshot:", error.message);
    throw error;
  }
}

module.exports = { uploadScreenshot };
