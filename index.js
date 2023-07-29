const express = require("express");
const mysql = require("mysql");
const bodyParser = require("body-parser");
const dotenv = require("dotenv");

// Get environment variables
dotenv.config();

const app = express();
const port = process.env.EXPRESS_PORT;

// MySQL configuration to ensure incoming timestamps treated as UTC
const config = {
  timezone: "UTC",
  apiKey: process.env.API_KEY,
};
const pool = mysql.createPool(config);
pool.on("connection", (conn) => {
  conn.query("SET time_zone='+00:00;", (error) => {
    if (error) {
      throw error;
    }
  });
});
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
});

// Connect to the database
db.connect((err) => {
  if (err) {
    throw err;
  }
  console.log("Connected to MySQL database!");
});

// Apply authentication middleware to all routes
const apiAuthMiddleware = (req, res, next) => {
  const apiKey = req.headers["x-api-key"];
  console.log(config.apiKey)
  console.log(apiKey);
  if (!apiKey || apiKey !== config.apiKey) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
};
app.use(apiAuthMiddleware);

// Middleware to parse JSON data in the request body
app.use(bodyParser.json());

// Route to receive weather data and store it in the database
app.post("/weather", (req, res) => {
  const { datetime, temperature, humidity } = req.body;

  if (!datetime || !temperature || !humidity) {
    return res.status(400).json({ error: "Missing required data fields." });
  }

  const weatherData = {
    datetime: new Date(datetime),
    temperature: parseFloat(temperature),
    humidity: parseFloat(humidity),
  };
  console.log(weatherData.datetime);

  const query = "INSERT INTO Readings SET ?";
  db.query(query, weatherData, (err, result) => {
    if (err) {
      console.error("Error inserting data into the database:", err);
      return res
        .status(500)
        .json({ error: "Error inserting data into the database." });
    }

    console.log("Data inserted successfully.");
    return res.status(200).json({
      message: "Data inserted successfully.",
    });
  });

  const query2 = "SELECT * FROM Readings ORDER BY datetime DESC LIMIT 1";
  db.query(query2, weatherData, (err, result) => {
    if (err) {
      console.log(err);
    }
  });
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
