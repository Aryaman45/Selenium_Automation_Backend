const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { spawn } = require('child_process');
const uploadCsvRoute = require("./uploadCsvRoute");
const getUploadedCSV = require("./getUploadedCSV")
const { uploadScreenshot } = require('./utils/uploadScreenshot');
const { Parser } = require('json2csv'); 
const fs = require('fs');
const authRoutes = require('./routes/authRoutes');
const connectDB = require('./config/db');
const authMiddleware = require('./middleware/authMiddleware');
const User = require('./models/userModel');

// Connect to MongoDB
connectDB();

const app = express();
const PORT = 5001;

// CORS configuration
app.use(cors({
  origin: ['http://localhost:3000', 'https://selenium-automation.vercel.app/'],  
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
  credentials: true
}));

app.use(express.json());
const registrationResults = [];
app.use("/api", uploadCsvRoute);
app.use("/api", getUploadedCSV);
app.use('/api/auth', authRoutes);

// Protected routes
app.use('/api/batch-register', authMiddleware);
app.use('/api/register', authMiddleware);
app.use('/api/report', authMiddleware);



const MAX_RETRIES = 3;

function runPythonScript(blobName) {
  return new Promise((resolve, reject) => {
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
        const successMatch = output.match(/Success:\s*(\d+)/i);
        const failedMatch = output.match(/Failed:\s*(\d+)/i);

        const successCount = successMatch ? parseInt(successMatch[1], 10) : 0;
        const failedCount = failedMatch ? parseInt(failedMatch[1], 10) : 0;

        resolve({ successCount, failedCount, output });
      } else {
        reject(new Error(error || 'Python script failed to execute.'));
      }
    });
  });
}

app.post('/api/batch-register', async (req, res) => {
  const { blobName } = req.body;

  if (!blobName) {
    return res.status(400).json({ success: false, message: 'Missing blobName' });
  }

  let attempts = 0;
  let finalResult = null;

  while (attempts < MAX_RETRIES) {
    try {
      const result = await runPythonScript(blobName);
      attempts++;

      const { successCount, failedCount } = result;
      console.log(`Attempt ${attempts}: Success=${successCount}, Failed=${failedCount}`);

      if (successCount >= failedCount) {
        return res.status(200).json({ success: true, message: 'Registration complete.' });
      } else {
        finalResult = result; // Save last attempt result
      }
    } catch (err) {
      console.error(`Attempt ${attempts} failed with error:`, err.message);
      attempts++;
    }
  }

  return res.status(500).json({
    success: false,
    message: 'Registration failed after multiple attempts.',
    lastAttempt: finalResult?.output || 'No output available'
  });
});

// app.post('/api/batch-register', (req, res) => {
//   const { blobName } = req.body;

//   if (!blobName) {
//     return res.status(400).json({ success: false, message: 'Missing blobName' });
//   }

//   const pythonProcess = spawn(
//     '/Users/aryamansaxena/Desktop/Projects/User_Registration_Automation/Automation_Scripts/venv/bin/python',
//     ['../Automation_Scripts/registration_controller.py', blobName]
//   );

//   let output = '';
//   let error = '';

//   pythonProcess.stdout.on('data', (data) => {
//     output += data.toString();
//     console.log(`stdout: ${data}`);
//   });

//   pythonProcess.stderr.on('data', (data) => {
//     error += data.toString();
//     console.error(`stderr: ${data}`);
//   });

//   pythonProcess.on('close', (code) => {
//     if (code === 0) {
//       res.status(200).json({ success: true, message: 'Registration complete.' });
//     } else {
//       res.status(500).json({ success: false, message: 'Registration failed.' });
//     }
//   });
// });


app.post('/api/register', async (req, res) => {
  const { phone, email, countryCode } = req.body;

  const pythonProcess = spawn(
    '/Users/aryamansaxena/Desktop/Projects/User_Registration_Automation/Automation_Scripts/venv/bin/python',
    ['../Automation_Scripts/indriverRegistration.py', phone, countryCode]
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
    console.log('✅ Python process closed with code:', code);

    try {
      let screenshotUrl = null;
      console.log("111", screenshotPath)
      if (screenshotPath && fs.existsSync(screenshotPath)) {
        console.log("2222")
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

// Test route to check users (remove in production)
app.get('/api/test/users', async (req, res) => {
  try {
    const users = await User.find({}, { password: 0 }); // Exclude passwords
    res.json({ count: users.length, users });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
