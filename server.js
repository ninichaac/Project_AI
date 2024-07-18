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

// Model
const LogFiles = mongoose.model('LogFiles', new mongoose.Schema({
  "File Name": String,
  "Event Receive Time": String,
  "Reporting IP": String,
  "Event Type": String,
  "Event Name": String,
  "Raw Event Log": String,
}));

// Multer setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, file.fieldname + '-' + Date.now() + '.csv');
  }
});
const upload = multer({ storage: storage });

// Route
app.post('/upload', upload.single('file'), (req, res) => {
  const results = [];
  fs.createReadStream(req.file.path)
    .pipe(csvParser())
    .on('data', (data) => results.push(data))
    .on('end', async () => {
      try {
        await LogFiles.insertMany(results.map(result => ({
          "File Name": req.file.originalname,
          "Event Receive Time": result['Event Receive Time'],
          "Reporting IP": result['Reporting IP'],
          "Event Type": result['Event Type'],
          "Event Name": result['Event Name'],
          "Raw Event Log": result['Raw Event Log'],
        })));
        console.log('CSV data successfully inserted into MongoDB');
        res.status(200).send('File uploaded and data inserted into MongoDB');
      } catch (err) {
        console.log('Error inserting CSV data into MongoDB', err);
        res.status(500).send('Error inserting CSV data into MongoDB');
      }
    });
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

const finish = mongoose.model('finishes', new mongoose.Schema({
  "Source IP": String,
  "status": String,
}));

// Route to fetch data from MongoDB (collection 'finish')
app.get('/data', async (req, res) => {
  try {
    const data = await finish.find({}, { "Source IP": 1, "status": 1, _id: 0 }); // ดึงเฉพาะ Source IP และ status
    res.status(200).json(data); // ส่งคืนข้อมูลในรูปแบบ JSON
  } catch (err) {
    console.error('Error fetching data from MongoDB:', err);
    res.status(500).send('Error fetching data from MongoDB'); // ส่งข้อความแจ้งเตือนในกรณีเกิดข้อผิดพลาด
  }
});

// app.get('/downloadcsv', async (req, res) => {
//   try {
//     const finishes = mongoose.model('finishes');
//     const data = await finishes.find();
//     res.status(200).json(data);
//   } catch (error) {
//     console.error('Error fetching data:', error);
//     res.status(500).json({ error: 'Error fetching data' });
//   }
// });

// const finishesSchema = new mongoose.Schema({}, { collection: 'finishes' });
// const Finishes = mongoose.model('finishes', finishesSchema);

app.get('/downloadcsv', async (req, res) => {
  try {
    const Finishes = mongoose.model('finishes');
    const data = await Finishes.find().lean();

    // Remove _id field from each document
    const filteredData = data.map(({ _id, Timestamp, ...rest }) => ({
      ...rest,
      Timestamp: new Date(Timestamp).toISOString(),
    }));


    const csvWriter = createObjectCsvWriter({
      path: 'finishes.csv',
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
        { id: 'status', title: 'status' },
      ],
    });

    await csvWriter.writeRecords(filteredData);

    res.download('finishes.csv', 'finishes.csv', (err) => {
      if (err) {
        console.error('Error downloading the file:', err);
        res.status(500).json({ error: 'Error downloading the file' });
      }

      // Delete the file after download
      fs.unlinkSync('finishes.csv');
    });
  } catch (error) {
    console.error('Error fetching data:', error);
    res.status(500).json({ error: 'Error fetching data' });
  }
});

app.get('/checkFinishes', async (req, res) => {
  try {
    const Finishes = mongoose.model('finishes');
    const count = await Finishes.countDocuments();
    res.json({ hasData: count > 0 });
  } catch (error) {
    console.error('Error checking data:', error);
    res.status(500).json({ error: 'Error checking data' });
  }
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