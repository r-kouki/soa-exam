const mongoose = require('mongoose');

const userProfileSchema = new mongoose.Schema({
    auth_id: { // ID from Keycloak
        type: String,
        required: true,
        unique: true,
        index: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true
    },
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    first_name: {
        type: String,
        trim: true
    },
    last_name: {
        type: String,
        trim: true
    },
    age: {
        type: Number,
        min: 18
    },
    gender: {
        type: String,
        enum: ['male', 'female', 'non-binary', 'other', 'prefer_not_to_say'] // Example enum
    },
    interests: {
        type: [String],
        default: []
    },
    bio: {
        type: String,
        maxlength: 500
    },
    photos: {
        type: [String], // URLs to photos
        default: []
    },
    city: {
        type: String,
        trim: true
    },
    country: {
        type: String,
        trim: true
    },
    // Add other profile fields from proto as needed
    // e.g., looking_for, location (GeoJSON for proximity searches), etc.
    is_active: {
        type: Boolean,
        default: true
    },
    is_verified: { // e.g., email verified
        type: Boolean,
        default: false
    }
}, {
    timestamps: true // Adds createdAt and updatedAt automatically
});

const UserProfile = mongoose.model('UserProfile', userProfileSchema);

module.exports = UserProfile; 