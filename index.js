const bodyParser = require("body-parser");
const dotenv = require("dotenv");
const express = require("express");
const knex = require("knex");
const mysql = require("mysql");
const Joi = require("joi");

// Get environment variables
dotenv.config();

// Establish database connection to MySQL DB with knex as ORM
const db = knex({
  client: "mysql",
  connection: {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
  },
});

const app = express();
const port = 3000;

// Middleware to parse JSON data in the request body
app.use(bodyParser.json());

// Apply authentication middleware to all routes
const apiAuthMiddleware = (req, res, next) => {
  const apiKey = req.headers["x-api-key"];
  if (!apiKey || apiKey !== process.env.API_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
};
app.use(apiAuthMiddleware);

// Route to receive temperature data and store it in the database
app.post("/temperatures", async (req, res) => {
  const { deviceId, dateTime, humidity, locationId, temperature } = req.body;

  // Prepare validation schema for input payload
  const measurementSchema = Joi.object({
    deviceId: Joi.string().required(),
    dateTime: Joi.string()
      .isoDate({ options: { format: "date-time" } })
      .required(),
    locationId: Joi.string().required(),
    temperature: Joi.number().required(),
    humidity: Joi.number(),
  });
  const measurementsSchema = Joi.object({
    measurements: Joi.array().items(measurementSchema),
  });

  // Validate the payload
  const { error } = measurementsSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }

  measurements = req.body.measurements.map((measurement) => {
    return {
      deviceid: measurement.deviceId,
      datetime: new Date(measurement.dateTime),
      locationid: measurement.locationId,
      humidity: parseFloat(measurement.humidity),
      temperature: parseFloat(measurement.temperature),
    };
  });

  try {
    // Perform database update in a transaction (overwrite on duplicate)
    await db.transaction(async (trx) => {
      await trx
        .insert(measurements)
        .into("temperatures")
        .onConflict("datetime")
        .merge();
    });

    return res.status(200).json({
      message: `${measurements.length} measurement${
        measurements.length > 1 ? "s" : ""
      } added successfully`,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Failed to add measurements" });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
