require('dotenv').config();

const express = require('express');
const app = express();
const session = require('express-session');
const path = require('path');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const { OAuth2Client } = require('google-auth-library');
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://project:project1234@cluster0.h4ufncx.mongodb.net/project?authSource=admin";
const CLIENT_ID = process.env.CLIENT_ID;
const client = new OAuth2Client(CLIENT_ID);
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const SESSION_SECRET = process.env.SESSION_SECRET;
const passport = require('passport');
require('./passport');
const GoogleStrategy = require('passport-google-oauth2').Strategy;
const multer = require('multer');
const fs = require('fs');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const { exec } = require('child_process');
const moment = require('moment');
const MongoStore = require('connect-mongo');
const { spawn } = require('child_process');


mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log('MongoDB connected...');
    console.log(`Connected to database: ${mongoose.connection.name}`);
  })
  .catch(err => console.log(err));

// Middleware
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use(bodyParser.json());
app.use(express.json());

app.use(session({
  cookie: { maxAge: 24 * 60 * 60 * 1000 },
  store: MongoStore.create({ mongoUrl: MONGO_URI }),
  resave: false,
  saveUninitialized: false,
  secret: SESSION_SECRET
}));

app.use((req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  next();
});

app.set('view engine', 'ejs');

app.use(passport.initialize());
app.use(passport.session());

const userRoutes = require('./router/user');
app.use('/', userRoutes);

// Middleware for authenticating logins
function ensureAuthenticated(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect('/login'); // If the user is not logged in yet Will be redirected to the login page.
}

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'views/Login.html'));
});

app.get('/home', ensureAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, 'views/Home.html'));
});

app.get('/logout', (req, res) => {
  req.session.destroy(err => {
      if (err) {
          return res.status(500).send('Logout failed');
      }
      res.clearCookie('connect.sid');  // Clear the session cookie
      res.redirect('/login');  // Redirect to the login page
  });
});






// ================== upload file and taining ai  ===============
// Multer setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const googleId = req.user.googleId;
    const userFolder = path.join('uploads', googleId);

    if (!fs.existsSync(userFolder)) {
      fs.mkdirSync(userFolder, { recursive: true });
    }

    cb(null, userFolder);
  },
  filename: (req, file, cb) => {
    const originalName = path.basename(file.originalname, path.extname(file.originalname));
    const extension = path.extname(file.originalname);
    const timestamp = Date.now();
    cb(null, `${originalName}-${timestamp}${extension}`);
  }
});

const upload = multer({ storage: storage });

// Route for file upload
app.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).send('No file uploaded.');
  }
  console.log('File uploaded successfully:', req.file.path);

  // Run the Python script
  const pythonProcess = spawn('python', [path.join(__dirname, 'python/upload.py'), req.user.googleId]);
  pythonProcess.stdout.on('data', (data) => {
    console.log(`Python script output: ${data}`);
  });
  pythonProcess.stderr.on('data', (data) => {
    console.error(`Python script error: ${data}`);
  });
  pythonProcess.on('close', (code) => {
    console.log(`Python script exited with code ${code}`);
  });

  // Send the response to the user.
  res.send('File uploaded and processing started');
});

app.post('/start_training', (req, res) => {
  // Verify that req.user.googleId has a value
  if (!req.user || !req.user.googleId) {
    console.error('Google ID is missing.');
    return res.status(400).json({ status: 'error', message: 'Google ID is missing.' });
  }

  // Run the Python script and pass the Google ID value
  exec(`python python/ai_training.py ${req.user.googleId}`, (error, stdout, stderr) => {
    if (error) {
      console.error(`Error executing script: ${error.message}`);
      return res.status(500).json({ status: 'error', message: 'Failed to start processing.' });
    }
    if (stderr) {
      console.error(`Script stderr: ${stderr}`);
      return res.status(500).json({ status: 'error', message: 'Processing script error.' });
    }
    console.log(`Script stdout: ${stdout}`);
    res.status(200).json({ status: 'success', message: 'Processing started successfully.' });
  });
});

// ================== upload file and taining ai  ===============


// ================== Function to delete files older than 24 hours ================== 
// Define paths to the 'uploads' and 'update' directories
const directoriesToClean = [path.join(__dirname, 'uploads'), path.join(__dirname, 'update'), path.join(__dirname, 'csv')];
function cleanOldDirectories(dirPath) {
  fs.readdir(dirPath, (err, items) => {
    if (err) {
      console.error(`Error reading directory ${dirPath}:`, err);
      return;
    }

    items.forEach(item => {
      const itemPath = path.join(dirPath, item);
      fs.stat(itemPath, (err, stats) => {
        if (err) {
          console.error(`Error checking stats for ${itemPath}:`, err);
          return;
        }

        // Check if it's a subdirectory
        if (stats.isDirectory()) {
          // Check the age of the directory
          const now = Date.now();
          const twentyFourHours = 24 * 60 * 60 * 1000;
          if (now - stats.mtime.getTime() > twentyFourHours) {
            fs.rmdir(itemPath, { recursive: true }, (err) => {
              if (err) {
                console.error(`Error removing directory ${itemPath}:`, err);
                return;
              }
              console.log(`Removed directory ${itemPath}`);
            });
          }
        } else if (stats.isFile()) {
          // Check the age of the file (csv directory files)
          const now = Date.now();
          const oneMonth = 30 * 24 * 60 * 60 * 1000;
          if (now - stats.mtime.getTime() > oneMonth) {
            fs.unlink(itemPath, (err) => {
              if (err) {
                console.error(`Error removing file ${itemPath}:`, err);
                return;
              }
              console.log(`Removed file ${itemPath}`);
            });
          }
        }
      });
    });
  });
}

// Set interval to run the function every 1 minutes
setInterval(() => {
  directoriesToClean.forEach(dir => cleanOldDirectories(dir));
}, 60 * 1000);  // 1 minutes
// ================== Function to delete files older than 24 hours ================== 



// ============== mongodb model ===============
const finishSchema = new mongoose.Schema({
  "Country": String,
  "Timestamp": Date,
  "Action": String,
  "Source IP": String,
  "Source Port": Number,
  "Destination IP": String,
  "Destination Port": Number,
  "Protocol": String,
  "Bytes Sent": Number,
  "Bytes Received": Number,
  "Threat Information": String,
  "label": Number,
  "anomaly_score": Number,
  "is_anomalous_isolation_forest": Number,
  "y_pred_custom_threshold": Number,
  "status": String,
  "uploadedAt": { type: Date, default: Date.now },
  "googleId": String  // เพิ่มฟิลด์ googleId
});
const Finish = mongoose.model('Finishes', finishSchema);


// ================== analysis table ===============
app.get('/data', async (req, res) => {
  try {
    const googleId = req.user && req.user.googleId; // Use the googleId of the currently logged in user.
    if (!googleId) {
      return res.status(400).json({ error: 'Google ID is missing.' });
    }

    // Step 1: Find the most recent timestamp 'uploadedAt'
    const mostRecent = await Finish.findOne({ googleId }, { uploadedAt: 1 }).sort({ uploadedAt: -1 });

    if (mostRecent) {
      // Step 2: Adjust timestamp 'uploadedAt' to compare on a minute scale.
      const mostRecentMinute = moment(mostRecent.uploadedAt).startOf('minute');

      // Step 3: Fetch all data with timestamp 'uploadedAt' at the same minute level.
      const data = await Finish.find(
        {
          googleId,
          uploadedAt: {
            $gte: mostRecentMinute.toDate(),
            $lt: moment(mostRecentMinute).add(1, 'minute').toDate()
          }
        },
        {
          "Country": 1,
          "Source IP": 1,
          "Destination IP": 1,
          "Destination Port": 1,
          "Threat Information": 1,
          "status": 1,
          _id: 0
        }
      );

      res.status(200).json(data); // Send data in JSON format
    } else {
      res.status(200).json([]); // Send an empty array if no data is found.
    }
  } catch (err) {
    console.error('Error fetching data from MongoDB:', err);
    res.status(500).send('Error fetching data from MongoDB');
  }
});
// ================== analysis table ===============




// ================== get csv download result  ===============
const csvfileSchema = new mongoose.Schema({
  googleId: String,
  filename: String,
  filedata: Buffer, // Store file as binary data
  createdAt: { type: Date, default: Date.now }
});

const csvfile = mongoose.model('csvfile', csvfileSchema);

// Set the path for the 'csv' directory.
const csvDir = path.join(__dirname, 'csv');

// Verify and create the 'csv' directory if it doesn't already exist.
if (!fs.existsSync(csvDir)) {
  fs.mkdirSync(csvDir, { recursive: true });
}

// File that records the last time the CSV file was created.
const lastCsvTimestampFile = path.join(__dirname, 'last_csv_timestamp.txt');

// Global lock variable to prevent creating multiple CSV files at the same time.
let csvCreationInProgress = false;

const createCsvForNewData = async (timestamp, googleId) => {
  if (csvCreationInProgress) {
    console.log('The CSV file is being created. Skip creation...');
    return;
  }

  csvCreationInProgress = true;

  try {
    const data = await Finish.find({
      uploadedAt: { $gte: timestamp },
      googleId
    }, {
      "Country": 1,
      "Timestamp": 1,
      "Action": 1,
      "Source IP": 1,
      "Source Port": 1,
      "Destination IP": 1,
      "Destination Port": 1,
      "Protocol": 1,
      "Bytes Sent": 1,
      "Bytes Received": 1,
      "Threat Information": 1,
      "label": 1,
      "anomaly_score": 1,
      "is_anomalous_isolation_forest": 1,
      "y_pred_custom_threshold": 1,
      "status": 1,
      _id: 0
    });

    if (data.length > 0) {
      const timestampStr = moment().format('YYYYMMDD_HHmmss');
      const csvFilename = `data_${googleId}_${timestampStr}.csv`;

      const formattedData = data.map(item => ({
        ...item._doc,
        Timestamp: moment(item.Timestamp).format('YYYY-MM-DDTHH:mm:ss.SSSZ')
      }));

      const csvWriter = createCsvWriter({
        path: path.join(csvDir, csvFilename),
        header: [
          { id: 'Country', title: 'Country' },
          { id: 'Timestamp', title: 'Timestamp' },
          { id: 'Action', title: 'Action' },
          { id: 'Source IP', title: 'Source IP' },
          { id: 'Source Port', title: 'Source Port' },
          { id: 'Destination IP', title: 'Destination IP' },
          { id: 'Destination Port', title: 'Destination Port' },
          { id: 'Protocol', title: 'Protocol' },
          { id: 'Bytes Sent', title: 'Bytes Sent' },
          { id: 'Bytes Received', title: 'Bytes Received' },
          { id: 'Threat Information', title: 'Threat Information' },
          { id: 'label', title: 'label' },
          { id: 'anomaly_score', title: 'anomaly_score' },
          { id: 'is_anomalous_isolation_forest', title: 'is_anomalous_isolation_forest' },
          { id: 'y_pred_custom_threshold', title: 'y_pred_custom_threshold' },
          { id: 'status', title: 'status' }
        ]
      });

      await csvWriter.writeRecords(formattedData);

      // Read the file into a buffer
      const filePath = path.join(csvDir, csvFilename);
      const fileData = fs.readFileSync(filePath);

      // Save the file to MongoDB
      const newFile = new csvfile({
        googleId,
        filename: csvFilename,
        filedata: fileData
      });

      await newFile.save();

      fs.writeFileSync(lastCsvTimestampFile, timestamp.toISOString());
    }
  } catch (err) {
    console.error('An error occurred processing new data:', err);
  } finally {
    csvCreationInProgress = false;
  }
};

// Use Change Streams to check for new data in MongoDB.
async function monitorDatabaseChanges() {
  const changeStream = Finish.watch();

  changeStream.on('change', async (change) => {
    if (change.operationType === 'insert') {
      let lastCsvTimestamp = new Date(0);
      if (fs.existsSync(lastCsvTimestampFile)) {
        lastCsvTimestamp = new Date(fs.readFileSync(lastCsvTimestampFile, 'utf-8'));
      }

      const googleId = change.fullDocument.googleId; // Get the googleId from the changed document
      const uploadedAt = new Date(change.fullDocument.uploadedAt);

      // Convert time to minutes
      const uploadedAtMinutes = Math.floor(uploadedAt.getTime() / (1000 * 60));
      const lastCsvTimestampMinutes = Math.floor(lastCsvTimestamp.getTime() / (1000 * 60));

      // Create a new CSV file if new data exists after the saved time.
      if (uploadedAtMinutes > lastCsvTimestampMinutes) {
        await createCsvForNewData(uploadedAt, googleId);

        // Update lastCsvTimestamp file with new upload time
        fs.writeFileSync(lastCsvTimestampFile, uploadedAt.toISOString());
      }
    }
  });
}

// Start tracking changes in MongoDB
monitorDatabaseChanges();

// Function for listing CSV files
app.get('/listCsvFiles', (req, res) => {
  const googleId = req.user && req.user.googleId; // Use the googleId of the currently logged in user.

  if (!googleId) {
    return res.status(400).json({ error: 'Google ID is missing.' });
  }

  fs.readdir(csvDir, (err, files) => {
    if (err) {
      console.error('Error reading CSV directory:', err);
      return res.status(500).send('Error reading CSV directory');
    }

    const csvFiles = files
      .filter(file => file.endsWith('.csv') && file.includes(googleId)) // Filter files by googleId
      .map(file => ({
        filename: file,
        uploadTimestamp: fs.statSync(path.join(csvDir, file)).mtime
      }));

    res.status(200).json(csvFiles);
  });
});

app.get('/downloadcsv', (req, res) => {
  const filename = req.query.filename;
  const googleId = req.user && req.user.googleId; // Use the googleId of the currently logged in user.

  if (!filename || !googleId) {
    return res.status(400).json({ error: 'Filename or Google ID is missing.' });
  }

  if (!filename.includes(googleId)) {
    return res.status(403).json({ error: 'Unauthorized access to this file.' });
  }

  const filePath = path.join(csvDir, filename);
  res.download(filePath);
});

// ================== get csv download result  ===============







// ==============================================================
const server = app.listen(PORT, () => {
  console.log(`Server running at ${PORT}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use`);
  } else {
    console.error(`Server error: ${err}`);
  }
});