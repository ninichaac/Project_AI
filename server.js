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
const { createObjectCsvWriter } = require('csv-writer');
const { exec } = require('child_process');

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

app.get('/test', (req, res) => {
  res.sendFile(path.join(__dirname, 'views/testhome.html'));
});

// Multer setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

// Route
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

// const finish = mongoose.model('finishes', new mongoose.Schema({
//   "Country": String,
//   "Source IP": String,
//   "Destination IP": String,
//   "Threat Information": String,
//   "status": String,
//   "uploadedAt": { type: Date, default: Date.now } // เพิ่มฟิลด์นี้
// }));

// app.get('/data', async (req, res) => {
//   try {
//     const data = await finish.find({}, { 
//       "Country": 1,
//       "Source IP": 1,
//       "Destination IP": 1,
//       "Threat Information": 1,
//       "status": 1,
//       _id: 0 
//     }).sort({ uploadedAt: -1 }).limit(100); // Sort by 'uploadedAt' in descending order
//     res.status(200).json(data); // Return the data in JSON format
//   } catch (err) {
//     console.error('Error fetching data from MongoDB:', err);
//     res.status(500).send('Error fetching data from MongoDB'); // Send an error message in case of a failure
//   }
// });


const moment = require('moment');
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





// app.get('/downloadcsv', async (req, res) => {
//   try {
//     const Finishes = mongoose.model('finishes');
//     const data = await Finishes.find().lean();

//     // Remove _id field from each document
//     const filteredData = data.map(({ _id, Timestamp, ...rest }) => ({
//       ...rest,
//       Timestamp: new Date(Timestamp).toISOString(),
//     }));


//     const csvWriter = createObjectCsvWriter({
//       path: 'finishes.csv',
//       header: [
//         { id: 'Country', title: 'Country' },
//         { id: 'Timestamp', title: 'Timestamp' },
//         { id: 'Action', title: 'Action' },
//         { id: 'Source IP', title: 'Source IP' },
//         { id: 'Source Port', title: 'Source Port' },
//         { id: 'Destination IP', title: 'Destination IP' },
//         { id: 'Destination Port', title: 'Destination Port' },
//         { id: 'Protocol', title: 'Protocol' },
//         { id: 'Bytes Sent', title: 'Bytes Sent' },
//         { id: 'Bytes Received', title: 'Bytes Received' },
//         { id: 'Threat Information', title: 'Threat Information' },
//         { id: 'label', title: 'label' },
//         { id: 'anomaly_score', title: 'anomaly_score' },
//         { id: 'is_anomalous_isolation_forest', title: 'is_anomalous_isolation_forest' },
//         { id: 'y_pred_custom_threshold', title: 'y_pred_custom_threshold' },
//         { id: 'status', title: 'status' },
//       ],
//     });

//     await csvWriter.writeRecords(filteredData);

//     res.download('finishes.csv', 'finishes.csv', (err) => {
//       if (err) {
//         console.error('Error downloading the file:', err);
//         res.status(500).json({ error: 'Error downloading the file' });
//       }

//       // Delete the file after download
//       fs.unlinkSync('finishes.csv');
//     });
//   } catch (error) {
//     console.error('Error fetching data:', error);
//     res.status(500).json({ error: 'Error fetching data' });
//   }
// });

// app.get('/checkFinishes', async (req, res) => {
//   try {
//     const Finishes = mongoose.model('finishes');
//     const count = await Finishes.countDocuments();
//     res.json({ hasData: count > 0 });
//   } catch (error) {
//     console.error('Error checking data:', error);
//     res.status(500).json({ error: 'Error checking data' });
//   }
// });



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
  "label": String,
  "anomaly_score": Number,
  "is_anomalous_isolation_forest": Boolean,
  "y_pred_custom_threshold": Boolean,
  "status": String,
  "uploadedAt": { type: Date, default: Date.now }
});
const Finish = mongoose.model('Finishes', finishSchema);

// Ensure the 'csv' directory exists
const csvDir = path.join(__dirname, 'csv');
if (!fs.existsSync(csvDir)) {
  fs.mkdirSync(csvDir);
}

app.get('/datacsv', async (req, res) => {
  try {
    const mostRecent = await Finish.findOne({}, { uploadedAt: 1 }).sort({ uploadedAt: -1 });

    if (mostRecent) {
      const mostRecentMinute = moment(mostRecent.uploadedAt).startOf('minute');

      const data = await Finish.find({
        uploadedAt: {
          $gte: mostRecentMinute.toDate(),
          $lt: moment(mostRecentMinute).add(1, 'minute').toDate()
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

      // Create a new CSV file with a unique timestamp
      const timestamp = moment().format('YYYYMMDD_HHmmss');
      const csvFilename = `data_${timestamp}.csv`;

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

      res.status(200).json(data);
    } else {
      res.status(200).json([]);
    }
  } catch (err) {
    console.error('Error fetching data from MongoDB:', err);
    res.status(500).send('Error fetching data from MongoDB');
  }
});

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