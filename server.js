const express = require("express");
const fs = require("fs");
const path = require("path");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");

const app = express();
const port = 3000;

// Global object to track if deletion is scheduled for today's CSV file
const deletionScheduled = {};

// Middleware to parse form data and cookies
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());

// Serve static files from the "public" folder
app.use(express.static(path.join(__dirname, "public")));

// Student Attendance Endpoint
app.post("/login", (req, res) => {
  const { name, regNo } = req.body;
  const now = Date.now();

  const lastAttendance = req.cookies.lastAttendance;
  if (lastAttendance && now - Number.parseInt(lastAttendance) < 3600000) {
    return res.send(`
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Attendance Already Recorded</title>
    <link rel="stylesheet" href="/style.css">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  </head>
  <body>
    <div class="container">
      <h1>Attendance Already Recorded</h1>
      <p class="text-center text-muted">You have already recorded your attendance recently. Please wait at least one hour before recording again.</p>
      <div style="text-align: center;">
        <a href="/" class="btn">Go Back</a>
      </div>
    </div>
  </body>
  </html>
    `);
  }

  res.cookie("lastAttendance", now.toString(), { maxAge: 3600000, httpOnly: true });

  const studentsFilePath = path.join(__dirname, "students.json");
  let students = [];
  if (fs.existsSync(studentsFilePath)) {
    try {
      const data = fs.readFileSync(studentsFilePath, "utf-8");
      students = JSON.parse(data);
    } catch (error) {
      console.error("Error reading students.json:", error);
    }
  }

  if (!students.find((student) => student.regNo === regNo)) {
    students.push({ name, regNo });
    fs.writeFileSync(studentsFilePath, JSON.stringify(students, null, 2));
  }

  const today = new Date();
  const dateString = today.toISOString().split("T")[0];
  const timeString = today.toTimeString().split(" ")[0];

  const csvFilename = `${dateString}.csv`;
  const csvFilePath = path.join(__dirname, csvFilename);

  if (!fs.existsSync(csvFilePath)) {
    fs.writeFileSync(csvFilePath, "Name,Registration Number,Date,Time\n");

    if (!deletionScheduled[dateString]) {
      deletionScheduled[dateString] = true;
      setTimeout(() => {
        if (fs.existsSync(csvFilePath)) {
          fs.unlink(csvFilePath, (err) => {
            if (err) {
              console.error(`Error deleting ${csvFilename}:`, err);
            } else {
              console.log(`${csvFilename} has been deleted after 2 hours.`);
            }
          });
        }
      }, 2 * 60 * 60 * 1000);
    }
  }

  const attendanceLine = `${name},${regNo},${dateString},${timeString}\n`;
  fs.appendFileSync(csvFilePath, attendanceLine);

  res.send(`
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Attendance Recorded</title>
    <link rel="stylesheet" href="/style.css">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  </head>
  <body>
    <div class="container">
      <h1>Attendance Recorded</h1>
      <p class="text-center text-muted">Thank you, <strong>${name}</strong>. Your attendance has been recorded.</p>
      <ul style="list-style-type: none; padding: 0;">
        <li><strong>Registration Number:</strong> ${regNo}</li>
        <li><strong>Date:</strong> ${dateString}</li>
        <li><strong>Time:</strong> ${timeString}</li>
      </ul>
    </div>
  </body>
  </html>
  `);
});

// CR Login and Dashboard Endpoint
app.post("/cr-login", (req, res) => {
  const { username, password } = req.body;

  if ((username === "Muskan" || username === "Sagar") && password === "btechb") {
    const today = new Date();
    const dateString = today.toISOString().split("T")[0];
    const csvFilename = `${dateString}.csv`;
    const csvFilePath = path.join(__dirname, csvFilename);
    let attendanceData = "";

    if (fs.existsSync(csvFilePath)) {
      attendanceData = fs.readFileSync(csvFilePath, "utf-8");
    } else {
      attendanceData = "No attendance records for today.";
    }

    let tableHTML = "";
    if (attendanceData.startsWith("Name")) {
      const lines = attendanceData.trim().split("\n");
      const headers = lines[0].split(",");
      tableHTML += "<table><thead><tr>";
      headers.forEach((header) => {
        tableHTML += `<th>${header}</th>`;
      });
      tableHTML += "</tr></thead><tbody>";
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(",");
        tableHTML += "<tr>";
        cols.forEach((col) => {
          tableHTML += `<td>${col}</td>`;
        });
        tableHTML += "</tr>";
      }
      tableHTML += "</tbody></table>";
    } else {
      tableHTML = `<p class="text-center text-muted">${attendanceData}</p>`;
    }

    res.send(`
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CR Dashboard</title>
    <link rel="stylesheet" href="/style.css">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  </head>
  <body>
    <div class="container cr-dashboard">
      <h1>Today's Attendance Records</h1>
      <div class="text-center mb-20">
        <a href="/download" class="download-btn">Download CSV</a>
      </div>
      ${tableHTML}
      <div style="text-align: center;"><a href="/" class="btn mt-20">Logout</a></div>
    </div>
  </body>
  </html>
    `);
  } else {
    res.send(`
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CR Login Failed</title>
    <link rel="stylesheet" href="/style.css">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  </head>
  <body>
    <div class="container">
      <h1>Invalid Credentials</h1>
      <p class="text-center text-muted">The username or password you entered is incorrect.</p>
      <a href="/cr.html" class="btn">Try Again</a>
    </div>
  </body>
  </html>
    `);
  }
});

// CSV Download Endpoint
app.get("/download", (req, res) => {
  const today = new Date();
  const dateString = today.toISOString().split("T")[0];
  const csvFilename = `${dateString}.csv`;
  const csvFilePath = path.join(__dirname, csvFilename);

  if (fs.existsSync(csvFilePath)) {
    res.download(csvFilePath, csvFilename, (err) => {
      if (err) {
        console.error("Error sending file:", err);
      }
    });
  } else {
    res.send(`
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>No Attendance Data</title>
    <link rel="stylesheet" href="/style.css">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  </head>
  <body>
    <div class="container">
      <h1>No Attendance Data</h1>
      <p class="text-center text-muted">No attendance data available for today.</p>
      <div style="text-align: center;">
        <a href="/" class="btn">Go Back</a>
      </div>
    </div>
  </body>
  </html>
    `);
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
