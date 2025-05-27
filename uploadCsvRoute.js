// uploadCsvRoute.js
const express = require("express");
const { Storage } = require("@google-cloud/storage");
const upload = require("./upload"); // Multer middleware
const path = require("path");

const router = express.Router();

// Load GCS credentials
const storage = new Storage({
  keyFilename: path.join(__dirname, "service-account.json"),
});

const bucket = storage.bucket("registration-uploads"); // Replace with your GCS bucket name

router.post("/upload-csv", upload.single("file"), async (req, res) => {
    console.log(req.file); 
  try {
    const blob = bucket.file(Date.now() + "-" + req.file.originalname);

    const blobStream = blob.createWriteStream({
      resumable: false,
      contentType: req.file.mimetype,
    });

    blobStream.on("error", (err) => {
      console.error("Upload error:", err);
      res.status(500).json({ error: err.message });
    });

    blobStream.on("finish", () => {
        res.status(200).json({
          success: true,
          message: "CSV uploaded to GCS",
          blobName: blob.name, 
        });
      });

    blobStream.end(req.file.buffer);
  } catch (err) {
    console.error("Upload failure:", err);
    res.status(500).json({ error: "Failed to upload" });
  }
});

module.exports = router;
