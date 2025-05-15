const mongoose = require('mongoose');

const eventSubscriptionSchema = new mongoose.Schema({
    userId: {
        type: String, // auth_id of the subscribing user
        required: true,
        index: true
    },
    eventId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Event',
        required: true
    }
}, {
    timestamps: true // Adds createdAt and updatedAt
});

// Compound index to ensure unique subscriptions and efficient queries
eventSubscriptionSchema.index({ userId: 1, eventId: 1 }, { unique: true });

// Static method to get all subscriptions for a user with populated event details
eventSubscriptionSchema.statics.getUserSubscriptions = async function(userId) {
    return this.find({ userId })
        .populate('eventId')
        .sort({ createdAt: -1 });
};

// Static method to get all subscribers for an event
eventSubscriptionSchema.statics.getEventSubscribers = async function(eventId) {
    return this.find({ eventId })
        .select('userId')
        .lean();
};

const EventSubscription = mongoose.model('EventSubscription', eventSubscriptionSchema);

module.exports = EventSubscription; 