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

// Get CSV contents from GCS
router.get("/get-csv/:blobName", async (req, res) => {
    const blobName = req.params.blobName;
  
    try {
      const file = bucket.file(blobName);
      const [contents] = await file.download();
      res.status(200).send(contents.toString());
    } catch (err) {
      console.error("Error reading CSV from GCS:", err);
      res.status(500).json({ error: "Failed to read CSV" });
    }
  });
  

module.exports = router;
