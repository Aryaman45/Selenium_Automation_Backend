const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { spawn } = require('child_process');
const uploadCsvRoute = require("./uploadCsvRoute");
const { uploadScreenshot } = require('./utils/uploadScreenshot');
const { Parser } = require('json2csv'); 

const app = express();
const PORT = 5001;

app.use(cors({
  origin: 'http://localhost:3001',  
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
  credentials: true
}));

app.options('/*', cors());

app.use(express.json());
const registrationResults = [];
app.use("/api", uploadCsvRoute);

app.post('/api/batch-register', (req, res) => {
  const { blobName } = req.body;

  if (!blobName) {
    return res.status(400).json({ success: false, message: 'Missing blobName' });
  }

  const pythonProcess = spawn(
    '/Users/aryamansaxena/Desktop/Projects/User_Registration_Automation/Automation_Scripts/venv/bin/python',
    ['../Automation_Scripts/registration_controller.py', blobName]
  );

  let output = '';
  let error = '';

  pythonProcess.stdout.on('data', (data) => {
    output += data.toString();
    console.log(`stdout: ${data}`);
  });

  pythonProcess.stderr.on('data', (data) => {
    error += data.toString();
    console.error(`stderr: ${data}`);
  });

  pythonProcess.on('close', (code) => {
    if (code === 0) {
      res.status(200).json({ success: true, message: 'Registration complete.', output });
    } else {
      res.status(500).json({ success: false, message: 'Registration failed.', error });
    }
  });
});


app.post('/api/register', async (req, res) => {
  const { phone, email } = req.body;

  const pythonProcess = spawn(
    '/Users/aryamansaxena/Desktop/Projects/User_Registration_Automation/Automation_Scripts/venv/bin/python',
    ['../Automation_Scripts/registration_controller.py', phone, email]
  );

  let stdoutData = '';
  let stderrData = '';
  let screenshotPath = '';

  pythonProcess.stdout.on('data', (data) => {
    const text = data.toString();
    stdoutData += text;
    console.log(`stdout: ${text}`);

    // Check for screenshot output
    const match = text.match(/SCREENSHOT:(.+\.png)/);
    if (match) {
      screenshotPath = match[1].trim();
    }
  });

  pythonProcess.stderr.on('data', (data) => {
    stderrData += data.toString();
    console.error(`stderr: ${data}`);
  });

  pythonProcess.on('close', async (code) => {
    try {
      let screenshotUrl = null;

      if (screenshotPath && fs.existsSync(screenshotPath)) {
        screenshotUrl = await uploadScreenshot(screenshotPath);
        fs.unlinkSync(screenshotPath); // Clean up local file
      }

      const result = {
        phone,
        email,
        timestamp: new Date().toISOString(),
        success: code === 0,
        message: code === 0 ? 'OTP screen detected. Marked as passed.' : 'OTP screen not detected. Marked as failed.',
        screenshotUrl
      };

      registrationResults.push(result);

      res.json({
        ...result,
        output: stdoutData,
        error: code !== 0 ? (stderrData || stdoutData) : undefined
      });

    } catch (err) {
      console.error("Error handling screenshot:", err);
      res.status(500).json({ success: false, message: "Internal error", error: err.message });
    }
  });
});


// app.post('/api/register', (req, res) => {
//   const { phone, email } = req.body;

//   // Use spawn instead of exec to get exit code
//   const pythonProcess = spawn(
//     '/Users/aryamansaxena/Desktop/Projects/User_Registration_Automation/Automation_Scripts/venv/bin/python',
//     ['../Automation_Scripts/registration.py', phone, email]
//   );

//   let stdoutData = '';
//   let stderrData = '';

//   pythonProcess.stdout.on('data', (data) => {
//     stdoutData += data.toString();
//     console.log(`stdout: ${data}`);
//   });

//   pythonProcess.stderr.on('data', (data) => {
//     stderrData += data.toString();
//     console.error(`stderr: ${data}`);
//   });

//   pythonProcess.on('close', (code) => {
//     console.log(`Python script exited with code ${code}`);
//     if (code === 0) {
//       res.json({ success: true, message: 'OTP screen detected. Marked as passed.', output: stdoutData });
//     } else {
//       res.json({ success: false, message: 'OTP screen not detected. Marked as failed.', error: stderrData || stdoutData });
//     }
//   });
// });

app.get('/api/report', (req, res) => {
  const fields = ['phone', 'email', 'timestamp', 'success', 'message', 'screenshotUrl'];
  const opts = { fields };

  try {
    const parser = new Parser(opts);
    const csv = parser.parse(registrationResults);

    res.header('Content-Type', 'text/csv');
    res.attachment(`registration-report-${Date.now()}.csv`);
    res.send(csv);
  } catch (err) {
    console.error('CSV generation error:', err);
    res.status(500).send('Failed to generate report');
  }
});


app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
