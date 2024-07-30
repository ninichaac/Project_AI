require('dotenv').config(); // เพื่อใช้ environment variables จากไฟล์ .env

const express = require('express');
const app = express();
const session = require('express-session');
const path = require('path');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const { OAuth2Client } = require('google-auth-library');
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://project:project1234@cluster0.h4ufncx.mongodb.net/project?authSource=admin";
const CLIENT_ID = process.env.CLIENT_ID; // ใช้ environment variable ที่เก็บ Google Client ID
const client = new OAuth2Client(CLIENT_ID);
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const passport = require('passport');
require('./passport');
const GoogleStrategy = require('passport-google-oauth2').Strategy;
const multer = require('multer');
const csvParser = require('csv-parser');
const fs = require('fs');
// const { createObjectCsvWriter } = require('csv-writer');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const { exec } = require('child_process');
const moment = require('moment');

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
  resave: false,
  saveUninitialized: true,
  secret: process.env.SESSION_SECRET
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

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'views/Login.html'));
});

app.get('/home', (req, res) => {
  res.sendFile(path.join(__dirname, 'views/pro.html'));
});





// ================== upload file and taining ai  ===============
// Multer setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    //Use the original file name and add the time it was uploaded to prevent duplicate file names.
    const originalName = path.basename(file.originalname, path.extname(file.originalname));
    const extension = path.extname(file.originalname);
    const timestamp = Date.now();
    cb(null, originalName + '-' + timestamp + extension);
  }
});

const upload = multer({ storage: storage });

// upload file
app.post('/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).send('No file uploaded.');
  }

  console.log('File uploaded successfully:', req.file.path);
  res.status(200).send('File uploaded successfully.');
});

// Add this route to handle training initiation
app.post('/start_training', (req, res) => {
  exec('python python/ai2.py', (error, stdout, stderr) => {
    if (error) {
      console.error(`Error executing script: ${error.message}`);
      return res.status(500).json({ status: 'error', message: 'Failed to start training.' });
    }
    if (stderr) {
      console.error(`Script stderr: ${stderr}`);
      return res.status(500).json({ status: 'error', message: 'Training script error.' });
    }
    console.log(`Script stdout: ${stdout}`);
    res.status(200).json({ status: 'success', message: 'Training started successfully.' });
  });
});


// Function to delete files older than 24 hours
const deleteOldFiles = () => {
  const uploadDir = path.join(__dirname, 'uploads');
  const now = Date.now();
  const threshold = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

  fs.readdir(uploadDir, (err, files) => {
    if (err) {
      console.error('Error reading upload directory:', err);
      return;
    }

    files.forEach(file => {
      const filePath = path.join(uploadDir, file);
      fs.stat(filePath, (err, stats) => {
        if (err) {
          console.error('Error getting file stats:', err);
          return;
        }

        const fileAge = now - stats.mtimeMs;
        if (fileAge > threshold) {
          fs.unlink(filePath, err => {
            if (err) {
              console.error('Error deleting file:', err);
              return;
            }
            console.log('Deleted old file:', filePath);
          });
        }
      });
    });
  });
};

// Schedule the task to run every hour
setInterval(deleteOldFiles, 60 * 60 * 1000); // 1 hour in milliseconds

// ================== upload file and taining ai  ===============






// ================== analysis table ===============
const finish = mongoose.model('finishes', new mongoose.Schema({
  "Country": String,
  "Source IP": String,
  "Destination IP": String,
  "Threat Information": String,
  "status": String,
  "uploadedAt": { type: Date, default: Date.now } // เพิ่มฟิลด์นี้
}));

app.get('/data', async (req, res) => {
  try {
    // ขั้นตอนที่ 1: หา timestamp 'uploadedAt' ที่ล่าสุดที่สุด
    const mostRecent = await finish.findOne({}, { uploadedAt: 1 }).sort({ uploadedAt: -1 });

    if (mostRecent) {
      // ขั้นตอนที่ 2: ปรับ timestamp 'uploadedAt' ให้เปรียบเทียบในระดับนาที
      const mostRecentMinute = moment(mostRecent.uploadedAt).startOf('minute');

      // ขั้นตอนที่ 3: ดึงข้อมูลทั้งหมดที่มี timestamp 'uploadedAt' ในระดับนาทีเดียวกัน
      const data = await finish.find(
        {
          uploadedAt: {
            $gte: mostRecentMinute.toDate(),
            $lt: moment(mostRecentMinute).add(1, 'minute').toDate()
          }
        },
        {
          "Country": 1,
          "Source IP": 1,
          "Destination IP": 1,
          "Threat Information": 1,
          "status": 1,
          _id: 0
        }
      );

      res.status(200).json(data); // ส่งข้อมูลในรูปแบบ JSON
    } else {
      res.status(200).json([]); // ส่ง array ว่างถ้าไม่พบข้อมูล
    }
  } catch (err) {
    console.error('Error fetching data from MongoDB:', err);
    res.status(500).send('Error fetching data from MongoDB'); // ส่งข้อความ error ถ้าเกิดข้อผิดพลาด
  }
});
// ================== analysis table ===============



// ================== get csv download result  ===============
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
  "uploadedAt": { type: Date, default: Date.now }
});
const Finish = mongoose.model('Finishes', finishSchema);

// Set the path for the 'csv' directory.
const csvDir = path.join(__dirname, 'csv');

// Verify and create the 'csv' directory if it does not exist.
if (!fs.existsSync(csvDir)) {
  fs.mkdirSync(csvDir, { recursive: true });
}

// The file that records the last timestamp of the CSV file creation.
const lastCsvTimestampFile = path.join(__dirname, 'last_csv_timestamp.txt');

// Function to create new CSV files
async function createCsvForNewData(timestamp) {
  try {
    // Find new data from MongoDB
    const data = await Finish.find({
      uploadedAt: {
        $gte: timestamp
      }
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
      const csvFilename = `data_${timestampStr}.csv`;

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

      await csvWriter.writeRecords(data);

      // Update the last timestamp generated CSV file.
      fs.writeFileSync(lastCsvTimestampFile, timestamp.toISOString());
    }
  } catch (err) {
    console.error('Error processing new data:', err);
  }
}

// Use Change Streams to check for new data in MongoDB.
async function monitorDatabaseChanges() {
  const changeStream = Finish.watch();

  changeStream.on('change', async (change) => {
    if (change.operationType === 'insert') {
      let lastCsvTimestamp = new Date(0); // Default time is 1970-01-01

      if (fs.existsSync(lastCsvTimestampFile)) {
        lastCsvTimestamp = new Date(fs.readFileSync(lastCsvTimestampFile, 'utf-8'));
      }

      // Create a new CSV file if there is new data after the last timestamp.
      if (change.fullDocument.uploadedAt > lastCsvTimestamp) {
        await createCsvForNewData(change.fullDocument.uploadedAt);
      }
    }
  });
}
// Start tracking changes in MongoDB.
monitorDatabaseChanges();

// Function for listing CSV files
app.get('/listCsvFiles', (req, res) => {
  fs.readdir(csvDir, (err, files) => {
    if (err) {
      console.error('Error reading CSV directory:', err);
      return res.status(500).send('Error reading CSV directory');
    }

    const csvFiles = files.filter(file => file.endsWith('.csv')).map(file => ({
      filename: file,
      uploadTimestamp: fs.statSync(path.join(csvDir, file)).mtime
    }));

    res.status(200).json(csvFiles);
  });
});

app.get('/downloadcsv', (req, res) => {
  const filename = req.query.filename;
  const filePath = path.join(csvDir, filename);
  res.download(filePath);
});

// ================== get csv download result  ===============







// ==============================================================
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use`);
  } else {
    console.error(`Server error: ${err}`);
  }
});