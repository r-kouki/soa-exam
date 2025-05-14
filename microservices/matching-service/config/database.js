const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI;

const connectDB = async () => {
    if (!MONGODB_URI) {
        console.error('MATCHING_SERVICE: MONGODB_URI is not defined in .env file');
        process.exit(1);
    }
    try {
        await mongoose.connect(MONGODB_URI, {});
        console.log('MATCHING_SERVICE: MongoDB Connected successfully to:', MONGODB_URI);
    } catch (err) {
        console.error('MATCHING_SERVICE: MongoDB Connection Error:', err.message);
        process.exit(1);
    }
};

module.exports = connectDB; 