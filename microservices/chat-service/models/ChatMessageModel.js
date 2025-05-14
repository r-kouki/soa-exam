const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema({
    chatRoomId: { // Identifier for the chat room (e.g., could be derived from a Match ID)
        type: String,
        required: true,
        index: true,
    },
    senderId: { // auth_id of the user who sent the message
        type: String,
        required: true,
        index: true,
    },
    content: {
        type: String,
        required: true,
        trim: true,
    },
    contentType: {
        type: String,
        default: 'text', // e.g., 'text', 'image_url', 'system_notification'
    },
    // timestamp is provided by Mongoose's timestamps: true option as createdAt
}, {
    timestamps: true, // Adds createdAt and updatedAt
});

// Index for querying messages by chatRoomId and then by time (createdAt)
chatMessageSchema.index({ chatRoomId: 1, createdAt: -1 });

const ChatMessage = mongoose.model('ChatMessage', chatMessageSchema);

module.exports = ChatMessage; 