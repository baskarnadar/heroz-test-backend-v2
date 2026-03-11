// mongodb.js
require('dotenv').config();
const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI;
const database = process.env.DATABASE
let db;

// Function to initialize MongoDB connection
async function connectToMongoDB() {
  if (db) {
    return db; // Return the existing connection if it's already connected
  }

  try {
    const client = await MongoClient.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('Connected to MongoDB');
    db = client.db(database); // Replace 'myDatabase' with your actual database name
    return db;
  } catch (error) {
    console.error('Failed to connect to MongoDB', error);
    throw error;
  }
}

module.exports = {
  connectToMongoDB,
};
