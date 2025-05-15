const mongoose = require('mongoose');

const EventCategoryEnum = {
    UNKNOWN: 'UNKNOWN',
    SOCIAL: 'SOCIAL',
    DATING: 'DATING',
    PROFESSIONAL: 'PROFESSIONAL',
    HOBBY: 'HOBBY',
    CULTURE: 'CULTURE'
};

const eventSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100
    },
    description: {
        type: String,
        required: true,
        trim: true,
        maxlength: 500
    },
    category: {
        type: String,
        enum: Object.values(EventCategoryEnum),
        default: EventCategoryEnum.SOCIAL
    },
    createdBy: {
        type: String, // auth_id of the creator
        required: true,
        index: true
    },
    isActive: {
        type: Boolean,
        default: true
    },
    // Virtual field, will be populated by counting subscriptions
    subscriberCount: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true // Adds createdAt and updatedAt
});

// Create indexes for efficient querying
eventSchema.index({ category: 1 });
eventSchema.index({ isActive: 1 });

// Static method to get events with subscriber counts
eventSchema.statics.getEventsWithSubscriberCounts = async function(query = {}, limit = 20, offset = 0) {
    const EventSubscription = mongoose.model('EventSubscription');
    
    // Get events
    const events = await this.find(query)
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit);
    
    // Get total count for pagination
    const totalCount = await this.countDocuments(query);
    
    // Get subscriber counts for each event
    const eventIds = events.map(event => event._id);
    const subscriptionCounts = await EventSubscription.aggregate([
        { $match: { eventId: { $in: eventIds } } },
        { $group: { _id: '$eventId', count: { $sum: 1 } } }
    ]);
    
    // Create a map of event ID to subscriber count
    const countsMap = subscriptionCounts.reduce((map, item) => {
        map[item._id.toString()] = item.count;
        return map;
    }, {});
    
    // Convert mongoose documents to plain objects and add subscriber count
    const eventsWithCounts = events.map(event => {
        const eventObj = event.toObject();
        eventObj.subscriberCount = countsMap[event._id.toString()] || 0;
        return eventObj;
    });
    
    return { events: eventsWithCounts, totalCount };
};

const Event = mongoose.model('Event', eventSchema);

module.exports = { Event, EventCategoryEnum }; 