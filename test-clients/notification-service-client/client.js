const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');

// Path to the notification.proto file (assuming it's copied to this directory)
const PROTO_PATH = path.join(__dirname, 'notification.proto');

// Load notification.proto
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
    includeDirs: [
        path.join(__dirname), // For notification.proto
        path.join(__dirname, 'node_modules/google-proto-files') // For google/protobuf/timestamp.proto
    ]
});

const notificationProto = grpc.loadPackageDefinition(packageDefinition).notification;

// Create a notification service client
const client = new notificationProto.NotificationService(
    'localhost:50054', // Use notification-service:50054 if running inside Docker
    grpc.credentials.createInsecure()
);

// Helper function to test SendNotification
function testSendNotification(userId, type, title, body, data) {
    return new Promise((resolve, reject) => {
        const request = {
            user_id: userId,
            type: type, // Use the enum values from NotificationType (e.g., 1 for NEW_MATCH)
            payload: {
                title: title,
                body: body,
                data: data || {}
            }
        };

        console.log(`Sending notification to user ${userId}:`);
        console.log(JSON.stringify(request, null, 2));

        client.SendNotification(request, (error, response) => {
            if (error) {
                console.error('Error sending notification:', error);
                reject(error);
                return;
            }

            console.log('Notification sent successfully:');
            console.log(JSON.stringify(response, null, 2));
            resolve(response);
        });
    });
}

// Run tests
async function runTests() {
    try {
        // Test case 1: NEW_MATCH notification
        await testSendNotification(
            'testauth|1234',
            1, // NEW_MATCH
            'New Match!',
            'You have a new match with Sarah',
            { match_id: 'match123' }
        );

        // Test case 2: NEW_MESSAGE notification
        await testSendNotification(
            'testauth|5678',
            2, // NEW_MESSAGE
            'New Message',
            'Sarah sent you a message',
            { chat_room_id: 'chatroom456', message_preview: 'Hey, how are you?' }
        );

        // Test case 3: PROFILE_VISIT notification
        await testSendNotification(
            'testauth|9012',
            3, // PROFILE_VISIT
            'Profile Visit',
            'Someone viewed your profile',
            { visitor_id: 'testauth|7890' }
        );

        console.log('All tests completed successfully!');
    } catch (error) {
        console.error('Test failed:', error);
    } finally {
        // Close the client after tests
        client.close();
    }
}

// Run the tests
runTests(); 