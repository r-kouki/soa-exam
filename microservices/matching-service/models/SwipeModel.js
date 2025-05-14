const mongoose = require('mongoose');

const swipeSchema = new mongoose.Schema({
    swiperUserId: { // auth_id of the user who performed the swipe
        type: String,
        required: true,
        index: true,
    },
    swipedUserId: { // auth_id of the user who was swiped on
        type: String,
        required: true,
        index: true,
    },
    direction: {
        type: String,
        enum: ['LIKE', 'DISLIKE'], // Corresponds to SwipeDirection enum in proto, excluding UNSPECIFIED
        required: true,
    },
    // Optional: Add a field to indicate if this swipe resulted in a match, can be denormalized or calculated
    // isMatch: {
    //     type: Boolean,
    //     default: false
    // }
}, {
    timestamps: true, // createdAt will be the swipe time
});

// Compound index to quickly find if a specific user has swiped another
swipeSchema.index({ swiperUserId: 1, swipedUserId: 1 }, { unique: true });

// Index to quickly find all users a specific user has liked
swipeSchema.index({ swiperUserId: 1, direction: 1 });

// Index to quickly find all users who liked a specific user
swipeSchema.index({ swipedUserId: 1, direction: 1 });

const Swipe = mongoose.model('Swipe', swipeSchema);

module.exports = Swipe; 