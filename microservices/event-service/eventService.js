require('dotenv').config();
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');
const connectDB = require('./config/database');
const { initializeKafka, producer, consumer } = require('./config/kafka');
const { Event, EventCategoryEnum } = require('./models/EventModel');
const EventSubscription = require('./models/EventSubscriptionModel');

// gRPC setup
const EVENT_SERVICE_GRPC_PORT = process.env.EVENT_SERVICE_GRPC_PORT || 50055;
const EVENT_PROTO_PATH = path.join(__dirname, 'proto/event.proto');
const NOTIFICATION_SERVICE_GRPC_URL = process.env.NOTIFICATION_SERVICE_GRPC_URL || 'localhost:50054';
const NOTIFICATION_PROTO_PATH = path.join(__dirname, 'proto/notification.proto');

// Connect to MongoDB
connectDB();

// Load proto files
let eventProto = {};
let notificationProto = {};

try {
    const eventPackageDefinition = protoLoader.loadSync(EVENT_PROTO_PATH, {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true,
        includeDirs: [
            path.join(__dirname, 'proto'),
            path.join(__dirname, 'node_modules/google-proto-files')
        ]
    });
    eventProto = grpc.loadPackageDefinition(eventPackageDefinition).event;

    const notificationPackageDefinition = protoLoader.loadSync(NOTIFICATION_PROTO_PATH, {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true,
        includeDirs: [
            path.join(__dirname, 'proto'),
            path.join(__dirname, 'node_modules/google-proto-files')
        ]
    });
    notificationProto = grpc.loadPackageDefinition(notificationPackageDefinition).notification;
} catch (err) {
    console.error("EVENT_SERVICE: Failed to load proto files:", err);
    process.exit(1);
}

// Create notification service client
const notificationServiceClient = new notificationProto.NotificationService(
    NOTIFICATION_SERVICE_GRPC_URL,
    grpc.credentials.createInsecure()
);

// Helper function to convert between Proto enums and MongoDB enums
function convertCategoryProtoToDb(protoCategory) {
    const mapping = {
        0: EventCategoryEnum.UNKNOWN,
        1: EventCategoryEnum.SOCIAL,
        2: EventCategoryEnum.DATING,
        3: EventCategoryEnum.PROFESSIONAL,
        4: EventCategoryEnum.HOBBY,
        5: EventCategoryEnum.CULTURE
    };
    return mapping[protoCategory] || EventCategoryEnum.UNKNOWN;
}

function convertCategoryDbToProto(dbCategory) {
    const mapping = {
        [EventCategoryEnum.UNKNOWN]: 0,
        [EventCategoryEnum.SOCIAL]: 1,
        [EventCategoryEnum.DATING]: 2,
        [EventCategoryEnum.PROFESSIONAL]: 3,
        [EventCategoryEnum.HOBBY]: 4,
        [EventCategoryEnum.CULTURE]: 5
    };
    return mapping[dbCategory] || 0;
}

// Helper function to convert Event model to EventTopic proto
function eventModelToProto(event) {
    return {
        id: event._id.toString(),
        name: event.name,
        description: event.description,
        category: convertCategoryDbToProto(event.category),
        created_at: {
            seconds: Math.floor(event.createdAt.getTime() / 1000),
            nanos: (event.createdAt.getTime() % 1000) * 1e6
        },
        created_by_user_id: event.createdBy,
        subscriber_count: event.subscriberCount || 0,
        is_active: event.isActive
    };
}

// Implement gRPC methods
const eventRPCMethods = {
    // Create a new event
    createEvent: async (call, callback) => {
        try {
            const { name, description, category, created_by_user_id } = call.request;
            
            if (!name || !description || !created_by_user_id) {
                return callback({
                    code: grpc.status.INVALID_ARGUMENT,
                    message: 'Name, description, and creator ID are required'
                });
            }
            
            const dbCategory = convertCategoryProtoToDb(category);
            
            const newEvent = new Event({
                name,
                description,
                category: dbCategory,
                createdBy: created_by_user_id
            });
            
            await newEvent.save();
            
            // Publish to Kafka event creation topic
            await producer.send({
                topic: 'event-notifications',
                messages: [
                    { 
                        key: newEvent._id.toString(),
                        value: JSON.stringify({
                            type: 'EVENT_CREATED',
                            eventId: newEvent._id.toString(),
                            name: newEvent.name,
                            category: newEvent.category,
                            createdBy: newEvent.createdBy,
                            timestamp: Date.now()
                        })
                    }
                ]
            });
            
            console.log(`EVENT_SERVICE: Created new event "${name}" with ID ${newEvent._id}`);
            
            callback(null, {
                success: true,
                event: eventModelToProto(newEvent)
            });
        } catch (error) {
            console.error('EVENT_SERVICE: Error creating event:', error);
            callback({
                code: grpc.status.INTERNAL,
                message: `Error creating event: ${error.message}`
            });
        }
    },
    
    // Get events (with optional filtering)
    getEvents: async (call, callback) => {
        try {
            const { category, limit = 20, offset = 0 } = call.request;
            
            // Build query
            const query = { isActive: true };
            if (category > 0) {
                query.category = convertCategoryProtoToDb(category);
            }
            
            // Get events with subscriber counts
            const { events, totalCount } = await Event.getEventsWithSubscriberCounts(
                query, 
                parseInt(limit), 
                parseInt(offset)
            );
            
            // Convert to proto format
            const protoEvents = events.map(eventModelToProto);
            
            callback(null, {
                success: true,
                events: protoEvents,
                total_count: totalCount
            });
        } catch (error) {
            console.error('EVENT_SERVICE: Error getting events:', error);
            callback({
                code: grpc.status.INTERNAL,
                message: `Error getting events: ${error.message}`
            });
        }
    },
    
    // Subscribe to an event
    subscribeToEvent: async (call, callback) => {
        try {
            const { event_id, user_id } = call.request;
            
            if (!event_id || !user_id) {
                return callback({
                    code: grpc.status.INVALID_ARGUMENT,
                    message: 'Event ID and User ID are required'
                });
            }
            
            // Check if event exists
            const event = await Event.findById(event_id);
            if (!event) {
                return callback({
                    code: grpc.status.NOT_FOUND,
                    message: 'Event not found'
                });
            }
            
            // Check if already subscribed (will error due to unique index)
            const existingSubscription = await EventSubscription.findOne({
                eventId: event_id,
                userId: user_id
            });
            
            if (existingSubscription) {
                return callback(null, {
                    success: true,
                    error: 'User is already subscribed to this event'
                });
            }
            
            // Create subscription
            const subscription = new EventSubscription({
                eventId: event_id,
                userId: user_id
            });
            
            await subscription.save();
            
            // Publish to Kafka
            await producer.send({
                topic: 'event-subscriptions',
                messages: [
                    { 
                        key: user_id,
                        value: JSON.stringify({
                            type: 'USER_SUBSCRIBED',
                            eventId: event_id,
                            userId: user_id,
                            eventName: event.name,
                            timestamp: Date.now()
                        })
                    }
                ]
            });
            
            console.log(`EVENT_SERVICE: User ${user_id} subscribed to event ${event_id}`);
            
            // Send notification to the user about successful subscription
            notificationServiceClient.SendNotification({
                user_id: user_id,
                type: 1, // Assuming 1 is for NEW_MATCH or similar notification type
                payload: {
                    title: `Subscribed to ${event.name}`,
                    body: `You are now subscribed to the "${event.name}" event.`,
                    data: {
                        event_id: event_id,
                        action: 'EVENT_SUBSCRIPTION'
                    }
                }
            }, (err, response) => {
                if (err) {
                    console.error(`EVENT_SERVICE: Failed to send subscription notification to ${user_id}:`, err);
                } else {
                    console.log(`EVENT_SERVICE: Sent subscription notification to ${user_id}`);
                }
            });
            
            callback(null, { success: true });
        } catch (error) {
            console.error('EVENT_SERVICE: Error subscribing to event:', error);
            callback({
                code: grpc.status.INTERNAL,
                message: `Error subscribing to event: ${error.message}`
            });
        }
    },
    
    // Unsubscribe from an event
    unsubscribeFromEvent: async (call, callback) => {
        try {
            const { event_id, user_id } = call.request;
            
            if (!event_id || !user_id) {
                return callback({
                    code: grpc.status.INVALID_ARGUMENT,
                    message: 'Event ID and User ID are required'
                });
            }
            
            // Find and delete the subscription
            const result = await EventSubscription.deleteOne({
                eventId: event_id,
                userId: user_id
            });
            
            if (result.deletedCount === 0) {
                return callback({
                    code: grpc.status.NOT_FOUND,
                    message: 'Subscription not found'
                });
            }
            
            // Publish to Kafka
            await producer.send({
                topic: 'event-subscriptions',
                messages: [
                    { 
                        key: user_id,
                        value: JSON.stringify({
                            type: 'USER_UNSUBSCRIBED',
                            eventId: event_id,
                            userId: user_id,
                            timestamp: Date.now()
                        })
                    }
                ]
            });
            
            console.log(`EVENT_SERVICE: User ${user_id} unsubscribed from event ${event_id}`);
            
            callback(null, { success: true });
        } catch (error) {
            console.error('EVENT_SERVICE: Error unsubscribing from event:', error);
            callback({
                code: grpc.status.INTERNAL,
                message: `Error unsubscribing from event: ${error.message}`
            });
        }
    },
    
    // Get events a user is subscribed to
    getUserSubscriptions: async (call, callback) => {
        try {
            const { user_id } = call.request;
            
            if (!user_id) {
                return callback({
                    code: grpc.status.INVALID_ARGUMENT,
                    message: 'User ID is required'
                });
            }
            
            // Get all subscriptions for the user
            const subscriptions = await EventSubscription.getUserSubscriptions(user_id);
            
            // Convert to event topics
            const events = subscriptions.map(sub => eventModelToProto(sub.eventId));
            
            callback(null, {
                success: true,
                events
            });
        } catch (error) {
            console.error('EVENT_SERVICE: Error getting user subscriptions:', error);
            callback({
                code: grpc.status.INTERNAL,
                message: `Error getting user subscriptions: ${error.message}`
            });
        }
    },
    
    // Notify all subscribers of an event
    notifyEventSubscribers: async (call, callback) => {
        try {
            const { event_id, title, message, data } = call.request;
            
            if (!event_id || !title || !message) {
                return callback({
                    code: grpc.status.INVALID_ARGUMENT,
                    message: 'Event ID, title, and message are required'
                });
            }
            
            // Check if event exists
            const event = await Event.findById(event_id);
            if (!event) {
                return callback({
                    code: grpc.status.NOT_FOUND,
                    message: 'Event not found'
                });
            }
            
            // Get all subscribers
            const subscribers = await EventSubscription.getEventSubscribers(event_id);
            if (subscribers.length === 0) {
                return callback(null, {
                    success: true,
                    notifications_sent: 0,
                    error: 'No subscribers found for this event'
                });
            }
            
            // Send notification to each subscriber
            let notificationsSent = 0;
            const notificationPromises = subscribers.map(sub => {
                return new Promise((resolve) => {
                    notificationServiceClient.SendNotification({
                        user_id: sub.userId,
                        type: 2, // Assuming 2 is for EVENT notifications
                        payload: {
                            title: title,
                            body: message,
                            data: {
                                ...data,
                                event_id: event_id,
                                event_name: event.name
                            }
                        }
                    }, (err, response) => {
                        if (err) {
                            console.error(`EVENT_SERVICE: Failed to send notification to ${sub.userId}:`, err);
                            resolve(false);
                        } else {
                            console.log(`EVENT_SERVICE: Sent notification to ${sub.userId}`);
                            notificationsSent++;
                            resolve(true);
                        }
                    });
                });
            });
            
            await Promise.all(notificationPromises);
            
            // Publish to Kafka
            await producer.send({
                topic: 'event-notifications',
                messages: [
                    { 
                        key: event_id,
                        value: JSON.stringify({
                            type: 'EVENT_NOTIFICATION',
                            eventId: event_id,
                            title,
                            message,
                            data,
                            subscribersCount: subscribers.length,
                            notificationsSent,
                            timestamp: Date.now()
                        })
                    }
                ]
            });
            
            console.log(`EVENT_SERVICE: Sent notifications to ${notificationsSent} subscribers of event ${event_id}`);
            
            callback(null, {
                success: true,
                notifications_sent: notificationsSent
            });
        } catch (error) {
            console.error('EVENT_SERVICE: Error notifying event subscribers:', error);
            callback({
                code: grpc.status.INTERNAL,
                message: `Error notifying event subscribers: ${error.message}`
            });
        }
    }
};

// Set up Kafka message consumption
async function setupKafkaConsumer() {
    try {
        await consumer.run({
            eachMessage: async ({ topic, partition, message }) => {
                try {
                    const messageValue = JSON.parse(message.value.toString());
                    console.log(`EVENT_SERVICE: Received Kafka message on '${topic}':`, messageValue.type);
                    
                    // Process different message types
                    switch (topic) {
                        case 'event-notifications':
                            // Process event notifications
                            break;
                            
                        case 'event-subscriptions':
                            // Process subscription changes
                            break;
                            
                        default:
                            console.log(`EVENT_SERVICE: Unknown topic '${topic}'`);
                    }
                } catch (error) {
                    console.error(`EVENT_SERVICE: Error processing Kafka message on topic '${topic}':`, error);
                }
            }
        });
        
        console.log('EVENT_SERVICE: Kafka consumer is running and listening for messages');
    } catch (error) {
        console.error('EVENT_SERVICE: Failed to set up Kafka consumer:', error);
    }
}

// Start gRPC server
async function startServer() {
    try {
        // Connect to Kafka
        await initializeKafka();
        
        // Set up Kafka consumer
        await setupKafkaConsumer();
        
        // Create and start gRPC server
        const server = new grpc.Server();
        server.addService(eventProto.EventService.service, eventRPCMethods);
        
        server.bindAsync(
            `0.0.0.0:${EVENT_SERVICE_GRPC_PORT}`,
            grpc.ServerCredentials.createInsecure(),
            (err, port) => {
                if (err) {
                    console.error('EVENT_SERVICE: Failed to bind gRPC server:', err);
                    return;
                }
                console.log(`EVENT_SERVICE: gRPC server running on port ${port}`);
                server.start();
            }
        );
    } catch (error) {
        console.error('EVENT_SERVICE: Failed to start server:', error);
        process.exit(1);
    }
}

// Start the server
startServer(); 