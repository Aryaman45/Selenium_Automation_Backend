// utils/generateCsvReport.js
const { createObjectCsvWriter } = require("csv-writer");
const fs = require("fs/promises");
const path = require("path");
const { bucket } = require("../gcs");
const { v4: uuidv4 } = require("uuid");

async function generateAndUploadCsv(rows) {
  const tmpFilePath = path.join(__dirname, `report_${uuidv4()}.csv`);

  const csvWriter = createObjectCsvWriter({
    path: tmpFilePath,
    header: [
      { id: "countryCode", title: "Country Code" },
      { id: "phone", title: "Phone" },
      { id: "result", title: "Result" },
      { id: "screenshotUrl", title: "Screenshot" },
    ],
  });

  await csvWriter.writeRecords(rows);

  const reportFileName = `reports/report_${uuidv4()}.csv`;
  const file = bucket.file(reportFileName);

  const fileBuffer = await fs.readFile(tmpFilePath);
  await file.save(fileBuffer, { contentType: "text/csv", resumable: false });
  await file.makePublic();

  await fs.unlink(tmpFilePath); // delete local temp file

  return `https://storage.googleapis.com/${bucket.name}/${reportFileName}`;
}

module.exports = { generateAndUploadCsv };
