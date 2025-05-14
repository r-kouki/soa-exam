require('dotenv').config();
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');
const http = require('http'); // Need http server for WebSocket server to attach to
const WebSocket = require('ws');
const connectDB = require('./config/database');
const ChatMessage = require('./models/ChatMessageModel');

const CHAT_SERVICE_WS_PORT = process.env.CHAT_SERVICE_WS_PORT || 3001;
const CHAT_SERVICE_GRPC_PORT = process.env.CHAT_SERVICE_GRPC_PORT || 50053;
const CHAT_PROTO_PATH = path.join(__dirname, 'proto/chat.proto');

// Connect to MongoDB
connectDB();

// --- gRPC Server Setup ---
let chatProto = {};
try {
    const packageDefinition = protoLoader.loadSync(CHAT_PROTO_PATH, {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true,
        // For google/protobuf/timestamp.proto, ensure proto-loader can find it.
        // If errors, you might need to copy google/protobuf/*.proto files into your proto dir
        // or install google-protobuf package and add its include path.
        includeDirs: [path.join(__dirname, 'proto'), path.join(__dirname, '../../node_modules/@grpc/proto-loader/node_modules/google-proto-files') ]
    });
    chatProto = grpc.loadPackageDefinition(packageDefinition).chat;
} catch (err) {
    console.error("CHAT_SERVICE: Failed to load chat.proto:", err);
    // process.exit(1); // Optionally exit if gRPC is critical path for startup
}

const chatRPCMethods = {
    getMessageHistory: async (call, callback) => {
        console.log('GetMessageHistory called with:', call.request);
        // TODO: Implement logic to fetch messages from ChatMessageModel based on request filters.
        callback({ code: grpc.status.UNIMPLEMENTED, message: 'GetMessageHistory not implemented' });
    }
};

function startGRPCServer() {
    if (!chatProto.ChatRPCService) {
        console.warn("CHAT_SERVICE: ChatRPCService not loaded from proto. gRPC server not starting.");
        return;
    }
    const server = new grpc.Server();
    server.addService(chatProto.ChatRPCService.service, chatRPCMethods);
    server.bindAsync(`0.0.0.0:${CHAT_SERVICE_GRPC_PORT}`,
        grpc.ServerCredentials.createInsecure(),
        (err, port) => {
            if (err) {
                console.error('CHAT_SERVICE: Failed to bind gRPC server:', err);
                return;
            }
            console.log(`Chat service gRPC server running on port: ${port}`);
            server.start();
        }
    );
}

// --- WebSocket Server Setup ---
// Create a simple HTTP server to attach WebSocket server to
const httpServer = http.createServer((req, res) => {
    // This can handle health checks or other HTTP requests if needed
    if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok' }));
    } else {
        res.writeHead(404);
        res.end();
    }
});

const wss = new WebSocket.Server({ server: httpServer });

// Store connected clients - very basic, needs proper session/room management
const clients = new Map(); // Map: ws_connection -> { userId, chatRoomId }
const chatRooms = new Map(); // Map: chatRoomId -> Set of ws_connections

wss.on('connection', (ws, req) => {
    // TODO: Authenticate user (e.g., via token in query param or initial message)
    // For now, let's assume chatRoomId and userId are passed in query for simplicity
    const params = new URLSearchParams(req.url.substring(req.url.indexOf('?')));
    const userId = params.get('userId'); // e.g. auth_id
    const chatRoomId = params.get('chatRoomId'); // e.g. match_id

    if (!userId || !chatRoomId) {
        console.log('CHAT_SERVICE: Connection attempt without userId or chatRoomId. Closing.');
        ws.terminate();
        return;
    }

    console.log(`CHAT_SERVICE: Client ${userId} connected to room ${chatRoomId}`);
    clients.set(ws, { userId, chatRoomId });

    if (!chatRooms.has(chatRoomId)) {
        chatRooms.set(chatRoomId, new Set());
    }
    chatRooms.get(chatRoomId).add(ws);

    ws.on('message', async (message) => {
        console.log(`CHAT_SERVICE: Received from ${userId} in room ${chatRoomId}: ${message}`);
        try {
            const parsedMessage = JSON.parse(message.toString());
            // Basic validation
            if (!parsedMessage.content) {
                ws.send(JSON.stringify({ error: 'Message content is required.'}));
                return;
            }

            // Store message
            const chatMessage = new ChatMessage({
                chatRoomId: chatRoomId,
                senderId: userId,
                content: parsedMessage.content,
                // contentType will use default 'text' from model
            });
            await chatMessage.save();
            console.log("CHAT_SERVICE: Message saved:", chatMessage._id);

            // Broadcast message to all clients in the same chat room
            const roomClients = chatRooms.get(chatRoomId);
            if (roomClients) {
                roomClients.forEach(clientWs => {
                    if (clientWs !== ws && clientWs.readyState === WebSocket.OPEN) {
                        clientWs.send(JSON.stringify({
                            senderId: userId,
                            content: parsedMessage.content,
                            timestamp: chatMessage.createdAt // Use timestamp from saved message
                        }));
                    }
                });
            }
        } catch (err) {
            console.error('CHAT_SERVICE: Error processing message or broadcasting:', err);
            ws.send(JSON.stringify({ error: 'Failed to process message.' }));
        }
    });

    ws.on('close', () => {
        console.log(`CHAT_SERVICE: Client ${userId} in room ${chatRoomId} disconnected`);
        clients.delete(ws);
        const room = chatRooms.get(chatRoomId);
        if (room) {
            room.delete(ws);
            if (room.size === 0) {
                chatRooms.delete(chatRoomId);
            }
        }
    });

    ws.on('error', (error) => {
        console.error(`CHAT_SERVICE: WebSocket error for client ${userId} in room ${chatRoomId}:`, error);
    });
});

function startWebSocketServer() {
    httpServer.listen(CHAT_SERVICE_WS_PORT, () => {
        console.log(`Chat service WebSocket server running on port: ${CHAT_SERVICE_WS_PORT}`);
    });
}

// --- Main Start --- 
function main() {
    startGRPCServer();      // Start gRPC server
    startWebSocketServer(); // Start WebSocket server
}

main(); 