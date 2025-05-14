const mongoose = require('mongoose');

const matchSchema = new mongoose.Schema({
    // An array of two user auth_ids involved in the match.
    // Storing them in a sorted manner can help prevent duplicate matches 
    // (e.g., [userA, userB] is the same as [userB, userA]) if a unique index is applied.
    userIds: {
        type: [String],
        required: true,
        validate: [
            val => val.length === 2, // Must contain exactly two user IDs
            'Match must involve exactly two users.'
        ],
        index: true, // Index this array for faster queries
    },
    // Denormalized user details for quick display could be added, but we will fetch full profiles for now.
    // user1_details: { username: String, primary_photo_url: String },
    // user2_details: { username: String, primary_photo_url: String },

    // Timestamp for when the match was formed (will be added by `timestamps: true`)
    // lastMessageAt: { type: Date }, // Could be useful for sorting matches by recent activity
    // chatRoomId: { type: String, unique: true, sparse: true } // For linking to a chat room later

}, {
    timestamps: true, // Adds createdAt (when match formed) and updatedAt
});

// Ensure that the combination of two user IDs is unique to prevent duplicate match entries.
// We sort userIds before saving to ensure (userA, userB) is treated the same as (userB, userA).
matchSchema.index({ userIds: 1 }, { unique: true });

// Helper to ensure userIds are always stored in a sorted order to maintain uniqueness
matchSchema.pre('save', function(next) {
    if (this.userIds && this.userIds.length === 2) {
        this.userIds.sort();
    }
    next();
});


const Match = mongoose.model('Match', matchSchema);

module.exports = Match; 