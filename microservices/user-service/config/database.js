const mongoose = require('mongoose');
require('dotenv').config(); // To load .env variables

const MONGODB_URI = process.env.MONGODB_URI;

const connectDB = async () => {
    if (!MONGODB_URI) {
        console.error('MONGODB_URI is not defined in .env file');
        process.exit(1);
    }
    try {
        await mongoose.connect(MONGODB_URI, {
            // useNewUrlParser: true, // No longer needed in Mongoose 6+
            // useUnifiedTopology: true, // No longer needed in Mongoose 6+
            // useCreateIndex: true, // No longer supported
            // useFindAndModify: false // No longer supported
        });
        console.log('MongoDB Connected successfully to:', MONGODB_URI);
    } catch (err) {
        console.error('MongoDB Connection Error:', err.message);
        // Exit process with failure
        process.exit(1);
    }
};

module.exports = connectDB; 