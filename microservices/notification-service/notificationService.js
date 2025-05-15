require('dotenv').config();
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');

const NOTIFICATION_SERVICE_GRPC_PORT = process.env.NOTIFICATION_SERVICE_GRPC_PORT || 50054;
const NOTIFICATION_PROTO_PATH = path.join(__dirname, 'proto/notification.proto');

// --- gRPC Server Setup ---
let notificationProto = {};
try {
    const packageDefinition = protoLoader.loadSync(NOTIFICATION_PROTO_PATH, {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true,
        includeDirs: [
            path.join(__dirname, 'proto'), 
            path.join(__dirname, 'node_modules/google-proto-files') // For google/protobuf/timestamp.proto
        ]
    });
    notificationProto = grpc.loadPackageDefinition(packageDefinition).notification;
} catch (err) {
    console.error("NOTIFICATION_SERVICE: Failed to load notification.proto:", err);
    process.exit(1);
}

const notificationRPCMethods = {
    sendNotification: (call, callback) => {
        const { user_id, type, payload } = call.request;
        console.log(`NOTIFICATION_SERVICE: Received SendNotification request for user ${user_id}`);
        console.log(`Type: ${type}, Title: ${payload ? payload.title : 'N/A'}, Body: ${payload ? payload.body : 'N/A'}`);
        // console.log("Payload data:", payload ? payload.data : {});

        // In a real service, this is where you'd integrate with:
        // - Email services (Nodemailer)
        // - Push notification services (Firebase Admin SDK for FCM, APNS)
        // - SMS gateways
        // - Or push to a message queue (Kafka, RabbitMQ) for workers to process

        // For now, just simulate success
        const notificationId = `notif_${Date.now()}`;
        callback(null, {
            success: true,
            message_id: notificationId,
            details: "Notification processed by stubbed service."
        });
    }
};

function main() {
    if (!notificationProto.NotificationService) {
        console.error("NOTIFICATION_SERVICE: NotificationService not loaded from proto. Server not starting.");
        return;
    }
    const server = new grpc.Server();
    server.addService(notificationProto.NotificationService.service, notificationRPCMethods);
    server.bindAsync(`0.0.0.0:${NOTIFICATION_SERVICE_GRPC_PORT}`,
        grpc.ServerCredentials.createInsecure(),
        (err, port) => {
            if (err) {
                console.error('NOTIFICATION_SERVICE: Failed to bind gRPC server:', err);
                process.exit(1);
            }
            console.log(`Notification service gRPC server running on port: ${port}`);
            server.start();
        }
    );
}

main(); 