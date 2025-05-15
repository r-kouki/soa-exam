const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');

// Path to the event.proto file
const PROTO_PATH = path.join(__dirname, 'event.proto');

// Load event.proto
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
    includeDirs: [
        path.join(__dirname),
        path.join(__dirname, 'node_modules/google-proto-files')
    ]
});

const eventProto = grpc.loadPackageDefinition(packageDefinition).event;

// Create an event service client
const client = new eventProto.EventService(
    'localhost:50055', // Use event-service:50055 if running inside Docker
    grpc.credentials.createInsecure()
);

// Test case data for event creation
const testEvents = [
    {
        name: "Available Tonight",
        description: "For users who are available for a spontaneous meet-up tonight.",
        category: 1, // SOCIAL
        created_by_user_id: "testauth|1234"
    },
    {
        name: "Coders Night",
        description: "A special event for software developers to meet and mingle.",
        category: 3, // PROFESSIONAL
        created_by_user_id: "testauth|1234"
    },
    {
        name: "Movie Lovers",
        description: "For those passionate about films and cinema.",
        category: 5, // CULTURE
        created_by_user_id: "testauth|5678"
    }
];

// Helper function to create an event
function createEvent(eventData) {
    return new Promise((resolve, reject) => {
        client.CreateEvent(eventData, (error, response) => {
            if (error) {
                console.error('Error creating event:', error);
                reject(error);
                return;
            }

            console.log('Event created successfully:');
            console.log(JSON.stringify(response, null, 2));
            resolve(response);
        });
    });
}

// Helper function to get all events
function getEvents(category = 0, limit = 10, offset = 0) {
    return new Promise((resolve, reject) => {
        client.GetEvents({ category, limit, offset }, (error, response) => {
            if (error) {
                console.error('Error getting events:', error);
                reject(error);
                return;
            }

            console.log('Events retrieved successfully:');
            console.log(JSON.stringify(response, null, 2));
            resolve(response);
        });
    });
}

// Helper function to subscribe to an event
function subscribeToEvent(eventId, userId) {
    return new Promise((resolve, reject) => {
        client.SubscribeToEvent({ event_id: eventId, user_id: userId }, (error, response) => {
            if (error) {
                console.error('Error subscribing to event:', error);
                reject(error);
                return;
            }

            console.log(`User ${userId} subscribed to event ${eventId}:`);
            console.log(JSON.stringify(response, null, 2));
            resolve(response);
        });
    });
}

// Helper function to get user subscriptions
function getUserSubscriptions(userId) {
    return new Promise((resolve, reject) => {
        client.GetUserSubscriptions({ user_id: userId }, (error, response) => {
            if (error) {
                console.error('Error getting user subscriptions:', error);
                reject(error);
                return;
            }

            console.log(`Subscriptions for user ${userId}:`);
            console.log(JSON.stringify(response, null, 2));
            resolve(response);
        });
    });
}

// Helper function to notify subscribers of an event
function notifyEventSubscribers(eventId, title, message, data = {}) {
    return new Promise((resolve, reject) => {
        client.NotifyEventSubscribers({ 
            event_id: eventId, 
            title, 
            message, 
            data 
        }, (error, response) => {
            if (error) {
                console.error('Error notifying event subscribers:', error);
                reject(error);
                return;
            }

            console.log(`Notification sent to subscribers of event ${eventId}:`);
            console.log(JSON.stringify(response, null, 2));
            resolve(response);
        });
    });
}

// Run test flow
async function runTests() {
    try {
        console.log('======= EVENT SERVICE TEST CLIENT =======');
        
        // Step 1: Create events
        console.log('\n1. Creating test events...');
        const createdEvents = [];
        for (const eventData of testEvents) {
            const event = await createEvent(eventData);
            if (event.event && event.event.id) {
                createdEvents.push(event.event);
            }
        }
        
        if (createdEvents.length === 0) {
            throw new Error('Failed to create any events.');
        }
        
        // Step 2: Get all events
        console.log('\n2. Getting all events...');
        await getEvents();
        
        // Step 3: Subscribe to events
        console.log('\n3. Subscribing users to events...');
        const user1 = 'testauth|1234';
        const user2 = 'testauth|5678';
        
        // User 1 subscribes to all events
        for (const event of createdEvents) {
            await subscribeToEvent(event.id, user1);
        }
        
        // User 2 subscribes to the first event only
        await subscribeToEvent(createdEvents[0].id, user2);
        
        // Step 4: Get user subscriptions
        console.log('\n4. Getting subscriptions for User 1...');
        await getUserSubscriptions(user1);
        
        console.log('\n4. Getting subscriptions for User 2...');
        await getUserSubscriptions(user2);
        
        // Step 5: Send notification to subscribers of the first event
        console.log('\n5. Notifying subscribers of the first event...');
        await notifyEventSubscribers(
            createdEvents[0].id,
            'Event Starting Soon!',
            `The "${createdEvents[0].name}" event is starting in 30 minutes.`,
            { 
                event_type: createdEvents[0].name,
                starts_in_minutes: 30
            }
        );
        
        console.log('\nAll tests completed successfully!');
    } catch (error) {
        console.error('Test failed:', error);
    } finally {
        // Close the gRPC client
        client.close();
    }
}

// Run the tests
runTests(); 