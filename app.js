// Top of app.js
require("dotenv").config();
const express = require("express");
const path = require("path");
const cors = require("cors");
const bodyParser = require("body-parser");
const logger = require("morgan");

const { connectToMongoDB } = require("./database/mongodb");
const routes = require("./route"); 

const app = express();

app.use(express.json());
app.use(logger("dev"));

app.set("views", path.join(__dirname, "views"));
app.set("view engine", "jade");

app.use(cors());
app.use(bodyParser.json({ limit: "50mb" }));
app.use(
  bodyParser.urlencoded({
    limit: "50mb",
    extended: true,
    parameterLimit: 50000,
  })
);

// ✅ Use consolidated routes
app.use(routes);

// MongoDB connection
connectToMongoDB()
  .then(() => console.log("Database connected successfully with test"))
  .catch((err) => console.error("Database connection failed", err));

// Test route
app.get("/testconn", (req, res) => {
  res.send("Ok new running to the API with the latest changes for tou===y===  this is test");
});

module.exports = app;
