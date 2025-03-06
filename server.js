const express = require('express');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const session = require('express-session');
const bodyParser = require('body-parser');

const app = express();
const port = 3000;

app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Set up session middleware
app.use(session({
  secret: 'someRandomSecretKey', // Change this in production!
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 } // 1 hour
}));

// Serve static files from "public" folder
app.use(express.static(path.join(__dirname, 'public')));

// -----------------------
// Load Users
// -----------------------
const usersFilePath = path.join(__dirname, 'users.json');
let users = [];
try {
  if (fs.existsSync(usersFilePath)) {
    const usersData = fs.readFileSync(usersFilePath, 'utf8');
    users = JSON.parse(usersData);
  }
} catch (err) {
  console.error("Error reading users.json:", err);
}

// -----------------------
// Load Teams
// -----------------------
const teamsFilePath = path.join(__dirname, 'teams.json');
let teams = [];
try {
  if (fs.existsSync(teamsFilePath)) {
    const teamsData = fs.readFileSync(teamsFilePath, 'utf8');
    teams = JSON.parse(teamsData);
  }
} catch (err) {
  console.error("Error reading teams.json:", err);
}

// -----------------------
// Student Endpoints (Attendance Login)
// -----------------------

/**
 * POST /login
 * Processes login data:
 * - Adds student to students.json if not already present
 * - Logs the attendance in a CSV file named with today’s date
 */
app.post('/login', (req, res) => {
  const { name, regNo } = req.body;
  const studentsFilePath = path.join(__dirname, 'students.json');
  let students = [];

  // Load existing student data if the file exists
  if (fs.existsSync(studentsFilePath)) {
    try {
      const data = fs.readFileSync(studentsFilePath, 'utf-8');
      students = JSON.parse(data);
    } catch (error) {
      console.error("Error reading students.json:", error);
    }
  }

  // Add student only if registration number is not already present
  if (!students.find(student => student.regNo === regNo)) {
    students.push({ name, regNo });
    fs.writeFileSync(studentsFilePath, JSON.stringify(students, null, 2));
  }

  // Get today's date and time
  const today = new Date();
  const dateString = today.toISOString().split('T')[0]; // e.g., 2025-03-06
  const timeString = today.toTimeString().split(' ')[0];  // e.g., 14:30:00

  // CSV filename based on the date (e.g., 2025-03-06.csv)
  const csvFilename = `${dateString}.csv`;
  const csvFilePath = path.join(__dirname, csvFilename);

  // Create CSV file with header if it doesn't exist
  if (!fs.existsSync(csvFilePath)) {
    fs.writeFileSync(csvFilePath, 'Name,Registration Number,Date,Time\n');
  }

  // Append the attendance record
  const attendanceLine = `${name},${regNo},${dateString},${timeString}\n`;
  fs.appendFileSync(csvFilePath, attendanceLine);

  // Respond with a confirmation page that includes a download button
  res.send(`
    <html>
      <head>
        <title>Attendance Recorded</title>
        <link rel="stylesheet" type="text/css" href="/style.css">
      </head>
      <body>
        <div class="container">
          <h1>Attendance Recorded</h1>
          <p>Thank you, <strong>${name}</strong>. Your attendance has been recorded.</p>
          <ul>
            <li><strong>Registration Number:</strong> ${regNo}</li>
            <li><strong>Date:</strong> ${dateString}</li>
            <li><strong>Time:</strong> ${timeString}</li>
          </ul>
          <a href="/download" class="btn">Download Today's Attendance CSV</a>
          <p style="margin-top:20px; font-size:14px; color:#666;">
            Or login as <a href="/cr">CR</a>
          </p>
        </div>
      </body>
    </html>
  `);
});

/**
 * GET /download
 * Provides the CSV attendance file for download
 */
app.get('/download', (req, res) => {
  const today = new Date();
  const dateString = today.toISOString().split('T')[0];
  const csvFilename = `${dateString}.csv`;
  const csvFilePath = path.join(__dirname, csvFilename);

  if (fs.existsSync(csvFilePath)) {
    res.download(csvFilePath, csvFilename, (err) => {
      if (err) {
        console.error("Error sending file:", err);
      }
    });
  } else {
    res.send('No attendance data available for today.');
  }
});

// -----------------------
// CR Login and Dashboard Endpoints
// -----------------------

/**
 * GET /cr
 * Serves a CR login page.
 */
app.get('/cr', (req, res) => {
  res.send(`
    <html>
      <head>
        <title>CR Login</title>
        <link rel="stylesheet" type="text/css" href="/style.css">
        <style>
          .cr-login-card {
            max-width: 400px;
            margin: 50px auto;
            padding: 30px;
            background: var(--card-bg);
            border-radius: 16px;
            box-shadow: var(--shadow);
            text-align: center;
          }
          .cr-login-card h1 {
            font-size: 24px;
            margin-bottom: 20px;
            color: var(--text);
          }
          .cr-login-card input {
            width: 90%;
            padding: 10px;
            margin: 10px 0;
            border: 1px solid var(--border);
            border-radius: 8px;
          }
          .cr-login-card button {
            padding: 10px 20px;
            background: var(--primary);
            color: #fff;
            border: none;
            border-radius: 8px;
            cursor: pointer;
          }
        </style>
      </head>
      <body>
        <div class="cr-login-card">
          <h1>CR Login</h1>
          <form action="/cr-login" method="post">
            <input type="text" name="username" placeholder="CR Username" required /><br/>
            <input type="password" name="password" placeholder="Password" required /><br/>
            <button type="submit">Login as CR</button>
          </form>
        </div>
      </body>
    </html>
  `);
});

/**
 * POST /cr-login
 * Processes CR login credentials. Allowed usernames: Muskan, Sagar; password: btechb.
 * If login is successful, it reads today’s CSV file and displays all attendance records in a table along with a download button.
 */
app.post('/cr-login', (req, res) => {
  const { username, password } = req.body;
  const allowedUsers = ['Muskan', 'Sagar'];
  if (!allowedUsers.includes(username) || password !== 'btechb') {
    return res.send(`
      <html>
        <head>
          <title>CR Login Failed</title>
          <link rel="stylesheet" type="text/css" href="/style.css">
        </head>
        <body>
          <div class="container">
            <h1>CR Login Failed</h1>
            <p>Invalid CR credentials.</p>
            <a href="/cr">Try Again</a>
          </div>
        </body>
      </html>
    `);
  }

  // Get today's CSV file
  const today = new Date();
  const dateString = today.toISOString().split('T')[0];
  const csvFilename = `${dateString}.csv`;
  const csvFilePath = path.join(__dirname, csvFilename);

  let csvData = '';
  if (fs.existsSync(csvFilePath)) {
    csvData = fs.readFileSync(csvFilePath, 'utf8');
  } else {
    csvData = 'No attendance records for today.';
  }

  // Convert CSV data into an HTML table
  let tableHTML = '';
  if (csvData.startsWith('Name')) {
    const lines = csvData.trim().split('\n');
    const headers = lines[0].split(',');
    tableHTML += '<table border="1" cellpadding="10" cellspacing="0" style="width:100%; border-collapse: collapse;"><thead><tr>';
    headers.forEach(header => {
      tableHTML += `<th>${header}</th>`;
    });
    tableHTML += '</tr></thead><tbody>';
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',');
      tableHTML += '<tr>';
      cols.forEach(col => {
        tableHTML += `<td>${col}</td>`;
      });
      tableHTML += '</tr>';
    }
    tableHTML += '</tbody></table>';
  } else {
    tableHTML = `<p>${csvData}</p>`;
  }

  res.send(`
    <html>
      <head>
        <title>CR Dashboard</title>
        <link rel="stylesheet" type="text/css" href="/style.css">
        <style>
          .cr-dashboard {
            max-width: 800px;
            margin: 20px auto;
            padding: 20px;
            background: var(--card-bg);
            border-radius: 16px;
            box-shadow: var(--shadow);
          }
          .cr-dashboard h1 {
            text-align: center;
            margin-bottom: 20px;
            color: var(--text);
          }
          .download-btn {
            display: block;
            width: fit-content;
            margin: 0 auto 20px auto;
            padding: 10px 20px;
            background: var(--primary);
            color: #fff;
            text-decoration: none;
            border-radius: 8px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
          }
          table, th, td {
            border: 1px solid var(--border);
          }
          th, td {
            padding: 12px;
            text-align: left;
            color: var(--text);
          }
          th {
            background: var(--secondary);
          }
          tr:nth-child(even) {
            background: var(--background-light);
          }
        </style>
      </head>
      <body>
        <div class="cr-dashboard">
          <h1>Today's Attendance Records</h1>
          <a href="/download" class="download-btn">Download CSV</a>
          ${tableHTML}
        </div>
      </body>
    </html>
  `);
});

// -----------------------
// Other Endpoints (Profile, etc.) remain unchanged
// -----------------------

app.get('/dashboard', (req, res) => {
  // For authenticated student dashboard – not used in this demo
  res.sendFile(path.join(__dirname, 'private', 'dashboard.html'));
});

app.get('/dashboard-styles.css', (req, res) => {
  res.sendFile(path.join(__dirname, 'private', 'styles.css'));
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => { res.redirect('/'); });
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
