require('dotenv').config();
const express = require('express');
const { ApolloServer, gql } = require('apollo-server-express');
const path = require('path');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const { GraphQLJSON } = require('graphql-type-json');

const API_GATEWAY_PORT = process.env.API_GATEWAY_PORT || 4000;

// Path to User service proto file
const USER_PROTO_PATH = path.join(__dirname, 'proto/user.proto');
const USER_SERVICE_GRPC_URL = process.env.USER_SERVICE_GRPC_URL || 'localhost:50051';

// Load User Proto
const userPackageDefinition = protoLoader.loadSync(USER_PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
    includeDirs: [path.join(__dirname, 'proto')]
});
const userProto = grpc.loadPackageDefinition(userPackageDefinition).user;

// Create gRPC client for User Service
const userServiceClient = new userProto.UserService(
    USER_SERVICE_GRPC_URL,
    grpc.credentials.createInsecure()
);

// Path to Matching service proto file
const MATCHING_PROTO_PATH = path.join(__dirname, 'graphql/proto/matching.proto');
const MATCHING_SERVICE_GRPC_URL = process.env.MATCHING_SERVICE_GRPC_URL || 'localhost:50052';
const CHAT_SERVICE_GRPC_URL = process.env.CHAT_SERVICE_GRPC_URL || 'localhost:50053';
const NOTIFICATION_SERVICE_GRPC_URL = process.env.NOTIFICATION_SERVICE_GRPC_URL || 'localhost:50054';
const EVENT_SERVICE_GRPC_URL = process.env.EVENT_SERVICE_GRPC_URL || 'localhost:50055';

// Load Matching Proto
const matchingPackageDefinition = protoLoader.loadSync(MATCHING_PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
    includeDirs: [path.join(__dirname, 'graphql/proto')]
});
const matchingProto = grpc.loadPackageDefinition(matchingPackageDefinition).matching;

// Create gRPC client for Matching Service
const matchingServiceClient = new matchingProto.MatchingService(
    MATCHING_SERVICE_GRPC_URL,
    grpc.credentials.createInsecure()
);

const CHAT_PROTO_PATH = path.join(__dirname, 'proto/chat.proto'); // Assuming chat.proto is copied here

let chatProto = {};
try {
    const chatPackageDefinition = protoLoader.loadSync(
        CHAT_PROTO_PATH,
        {
            keepCase: true, longs: String, enums: String, defaults: true, oneofs: true,
            includeDirs: [path.join(__dirname, 'proto'), path.join(__dirname, 'node_modules/google-proto-files')]
        }
    );
    chatProto = grpc.loadPackageDefinition(chatPackageDefinition).chat;
} catch (error) {
    console.error("API_GATEWAY: Failed to load chat.proto:", error);
    // process.exit(1); // Or handle gracefully
}

const chatServiceClient = chatProto.ChatRPCService ? 
    new chatProto.ChatRPCService(CHAT_SERVICE_GRPC_URL, grpc.credentials.createInsecure()) : null;

if (!chatServiceClient) {
    console.warn("API_GATEWAY: ChatServiceClient not initialized. Chat-related gRPC calls will fail.");
}

// Proto paths
const EVENT_PROTO_PATH = path.join(__dirname, 'proto/event.proto');

// Add after other proto loading sections
let eventProto = {};
try {
    const eventPackageDefinition = protoLoader.loadSync(
        EVENT_PROTO_PATH,
        {
            keepCase: true, longs: String, enums: String, defaults: true, oneofs: true,
            includeDirs: [path.join(__dirname, 'proto'), path.join(__dirname, 'node_modules/google-proto-files')]
        }
    );
    eventProto = grpc.loadPackageDefinition(eventPackageDefinition).event;
} catch (error) {
    console.error("API_GATEWAY: Failed to load event.proto:", error);
}

// Add after other service client initializations
const eventServiceClient = eventProto.EventService ? 
    new eventProto.EventService(EVENT_SERVICE_GRPC_URL, grpc.credentials.createInsecure()) : null;

if (!eventServiceClient) {
    console.warn("API_GATEWAY: EventServiceClient not initialized. Event-related gRPC calls will fail.");
}

// GraphQL Schema
const typeDefs = gql`
    enum SwipeDirectionGQL {
        LIKE
        DISLIKE
    }

    type UserProfile {
        id: ID!
        auth_id: String!
        email: String!
        username: String!
        first_name: String
        last_name: String
        age: Int
        gender: String
        interests: [String!]
        bio: String
        photos: [String!]
        city: String
        country: String
        created_at: String!
        updated_at: String!
    }

    type SwipeResponseGQL {
        success: Boolean!
        is_match: Boolean!
        match_id: String # Can be null
        matched_user_profile: UserProfile # Can be null if not a match or error fetching
    }

    type Timestamp {
        seconds: String # Using String as GraphQL Int might not be large enough for seconds since epoch
        nanos: Int
    }

    type ChatMessage {
        message_id: ID!
        chat_room_id: String!
        sender_id: String!
        content: String!
        timestamp: Timestamp!
        # contentType: String
    }

    type GetMessageHistoryResponse {
        messages: [ChatMessage!]!
        next_page_cursor: String
    }

    enum EventCategory {
        UNKNOWN
        SOCIAL
        DATING
        PROFESSIONAL
        HOBBY
        CULTURE
    }
    
    type EventTopic {
        id: ID!
        name: String!
        description: String!
        category: EventCategory!
        createdAt: Timestamp!
        createdBy: String!
        subscriberCount: Int!
        isActive: Boolean!
    }

    scalar JSON

    type Query {
        helloGateway: String
        getUserProfile(userId: ID!): UserProfile
        getConfirmedMatches(userId: ID!): [UserProfile]
        getMessageHistory(chatRoomId: ID!, pageSize: Int, beforeMessageId: String): GetMessageHistoryResponse
        getEvents(category: EventCategory, limit: Int, offset: Int): [EventTopic!]!
        getUserSubscriptions(userId: ID!): [EventTopic!]!
    }

    type Mutation {
        submitSwipe(
            swiperUserId: ID!,
            swipedUserId: ID!,
            direction: SwipeDirectionGQL!
        ): SwipeResponseGQL
        createEvent(name: String!, description: String!, category: EventCategory, createdByUserId: ID!): EventTopic
        subscribeToEvent(eventId: ID!, userId: ID!): Boolean!
        unsubscribeFromEvent(eventId: ID!, userId: ID!): Boolean!
        notifyEventSubscribers(eventId: ID!, title: String!, message: String!, data: JSON): Int!
    }
`;

// GraphQL Resolvers
const resolvers = {
    JSON: GraphQLJSON,
    
    Query: {
        helloGateway: () => 'Hello from API Gateway!',
        getUserProfile: async (_, { userId }) => {
            return new Promise((resolve, reject) => {
                userServiceClient.getUserProfile({ user_id: userId }, (error, response) => {
                    if (error) {
                        console.error('Error fetching user profile from user-service:', error);
                        reject(new Error(error.details || 'Error fetching user profile'));
                    }
                    resolve(response ? response.profile : null);
                });
            });
        },
        getConfirmedMatches: async (_, { userId }) => {
            console.log(`API Gateway: getConfirmedMatches called for userId: ${userId}`);
            return new Promise((resolve, reject) => {
                matchingServiceClient.getConfirmedMatches({ user_id: userId }, (error, response) => {
                    if (error) {
                        console.error('Error fetching confirmed matches from matching-service:', error);
                        reject(new Error(error.details || 'Error fetching confirmed matches'));
                    }
                    // The gRPC response is { matches: [UserProfile] }
                    // The UserProfile structure from gRPC matches the GraphQL UserProfile type
                    resolve(response ? response.matches : []);
                });
            });
        },
        getMessageHistory: async (_, { chatRoomId, pageSize, beforeMessageId }) => {
            console.log(`API_GATEWAY: Query.getMessageHistory called for room ${chatRoomId}`);
            if (!chatServiceClient) {
                throw new Error("Chat service client is not available.");
            }
            return new Promise((resolve, reject) => {
                chatServiceClient.GetMessageHistory({ 
                    chat_room_id: chatRoomId, 
                    page_size: pageSize,
                    before_message_id: beforeMessageId 
                }, (error, response) => {
                    if (error) {
                        console.error("API_GATEWAY: GetMessageHistory gRPC call error:", error);
                        reject(new Error(error.details || 'Failed to fetch message history'));
                    }
                    // console.log("API_GATEWAY: GetMessageHistory gRPC response:", response);
                    resolve(response);
                });
            });
        },
        getEvents: async (_, { category, limit, offset }) => {
            console.log(`API_GATEWAY: Query.getEvents called with category ${category}`);
            if (!eventServiceClient) {
                throw new Error("Event service client is not available.");
            }
            
            return new Promise((resolve, reject) => {
                eventServiceClient.GetEvents({
                    category: EventCategory[category] || 0,
                    limit: limit || 20,
                    offset: offset || 0
                }, (error, response) => {
                    if (error) {
                        console.error("API_GATEWAY: GetEvents gRPC call error:", error);
                        reject(new Error(error.details || 'Failed to fetch events'));
                        return;
                    }
                    
                    if (!response.success) {
                        reject(new Error(response.error || 'Failed to fetch events'));
                        return;
                    }
                    
                    // Map response to GraphQL format
                    const events = response.events.map(event => ({
                        id: event.id,
                        name: event.name,
                        description: event.description,
                        category: Object.keys(EventCategory)[event.category],
                        createdAt: event.created_at,
                        createdBy: event.created_by_user_id,
                        subscriberCount: event.subscriber_count,
                        isActive: event.is_active
                    }));
                    
                    resolve(events);
                });
            });
        },
        getUserSubscriptions: async (_, { userId }) => {
            console.log(`API_GATEWAY: Query.getUserSubscriptions called for user ${userId}`);
            if (!eventServiceClient) {
                throw new Error("Event service client is not available.");
            }
            
            return new Promise((resolve, reject) => {
                eventServiceClient.GetUserSubscriptions({
                    user_id: userId
                }, (error, response) => {
                    if (error) {
                        console.error("API_GATEWAY: GetUserSubscriptions gRPC call error:", error);
                        reject(new Error(error.details || 'Failed to fetch user subscriptions'));
                        return;
                    }
                    
                    if (!response.success) {
                        reject(new Error(response.error || 'Failed to fetch user subscriptions'));
                        return;
                    }
                    
                    // Map response to GraphQL format
                    const events = response.events.map(event => ({
                        id: event.id,
                        name: event.name,
                        description: event.description,
                        category: Object.keys(EventCategory)[event.category],
                        createdAt: event.created_at,
                        createdBy: event.created_by_user_id,
                        subscriberCount: event.subscriber_count,
                        isActive: event.is_active
                    }));
                    
                    resolve(events);
                });
            });
        }
    },
    Mutation: {
        submitSwipe: async (_, { swiperUserId, swipedUserId, direction }) => {
            // Map GraphQL enum to gRPC enum value
            // Note: matchingProto.SwipeDirection values are numbers (LIKE=1, DISLIKE=2)
            let grpcDirection;
            if (direction === 'LIKE') {
                grpcDirection = 1; // matchingProto.SwipeDirection.LIKE if loaded fully, but numbers are safer if not dynamically accessing enum values
            } else if (direction === 'DISLIKE') {
                grpcDirection = 2; // matchingProto.SwipeDirection.DISLIKE
            } else {
                throw new Error('Invalid swipe direction');
            }

            const swipeRequest = {
                swiper_user_id: swiperUserId,
                swiped_user_id: swipedUserId,
                direction: grpcDirection
            };

            return new Promise((resolve, reject) => {
                matchingServiceClient.submitSwipe(swipeRequest, (error, response) => {
                    if (error) {
                        console.error('Error submitting swipe to matching-service:', error);
                        reject(new Error(error.details || 'Error submitting swipe'));
                    }
                    // The gRPC response for matched_user_profile is already in the correct UserProfile structure
                    resolve(response);
                });
            });
        },
        createEvent: async (_, { name, description, category, createdByUserId }) => {
            console.log(`API_GATEWAY: Mutation.createEvent called for ${name}`);
            if (!eventServiceClient) {
                throw new Error("Event service client is not available.");
            }
            
            return new Promise((resolve, reject) => {
                eventServiceClient.CreateEvent({
                    name,
                    description,
                    category: EventCategory[category] || 0,
                    created_by_user_id: createdByUserId
                }, (error, response) => {
                    if (error) {
                        console.error("API_GATEWAY: CreateEvent gRPC call error:", error);
                        reject(new Error(error.details || 'Failed to create event'));
                        return;
                    }
                    
                    if (!response.success) {
                        reject(new Error(response.error || 'Failed to create event'));
                        return;
                    }
                    
                    // Map event to GraphQL format
                    const event = {
                        id: response.event.id,
                        name: response.event.name,
                        description: response.event.description,
                        category: Object.keys(EventCategory)[response.event.category],
                        createdAt: response.event.created_at,
                        createdBy: response.event.created_by_user_id,
                        subscriberCount: response.event.subscriber_count,
                        isActive: response.event.is_active
                    };
                    
                    resolve(event);
                });
            });
        },
        subscribeToEvent: async (_, { eventId, userId }) => {
            console.log(`API_GATEWAY: Mutation.subscribeToEvent called for user ${userId} to event ${eventId}`);
            if (!eventServiceClient) {
                throw new Error("Event service client is not available.");
            }
            
            return new Promise((resolve, reject) => {
                eventServiceClient.SubscribeToEvent({
                    event_id: eventId,
                    user_id: userId
                }, (error, response) => {
                    if (error) {
                        console.error("API_GATEWAY: SubscribeToEvent gRPC call error:", error);
                        reject(new Error(error.details || 'Failed to subscribe to event'));
                        return;
                    }
                    
                    if (!response.success) {
                        reject(new Error(response.error || 'Failed to subscribe to event'));
                        return;
                    }
                    
                    resolve(true);
                });
            });
        },
        unsubscribeFromEvent: async (_, { eventId, userId }) => {
            console.log(`API_GATEWAY: Mutation.unsubscribeFromEvent called for user ${userId} from event ${eventId}`);
            if (!eventServiceClient) {
                throw new Error("Event service client is not available.");
            }
            
            return new Promise((resolve, reject) => {
                eventServiceClient.UnsubscribeFromEvent({
                    event_id: eventId,
                    user_id: userId
                }, (error, response) => {
                    if (error) {
                        console.error("API_GATEWAY: UnsubscribeFromEvent gRPC call error:", error);
                        reject(new Error(error.details || 'Failed to unsubscribe from event'));
                        return;
                    }
                    
                    if (!response.success) {
                        reject(new Error(response.error || 'Failed to unsubscribe from event'));
                        return;
                    }
                    
                    resolve(true);
                });
            });
        },
        notifyEventSubscribers: async (_, { eventId, title, message, data }) => {
            console.log(`API_GATEWAY: Mutation.notifyEventSubscribers called for event ${eventId}`);
            if (!eventServiceClient) {
                throw new Error("Event service client is not available.");
            }
            
            return new Promise((resolve, reject) => {
                eventServiceClient.NotifyEventSubscribers({
                    event_id: eventId,
                    title,
                    message,
                    data: data || {}
                }, (error, response) => {
                    if (error) {
                        console.error("API_GATEWAY: NotifyEventSubscribers gRPC call error:", error);
                        reject(new Error(error.details || 'Failed to notify subscribers'));
                        return;
                    }
                    
                    if (!response.success) {
                        reject(new Error(response.error || 'Failed to notify subscribers'));
                        return;
                    }
                    
                    resolve(response.notifications_sent);
                });
            });
        }
    }
};

async function startServer() {
    const app = express();

    const server = new ApolloServer({
        typeDefs,
        resolvers,
        context: ({ req }) => {
            // Here we can extract and verify JWT from Keycloak
            // and pass user information to resolvers
            // For now, just passing the request
            return { req };
        },
        // introspection: process.env.NODE_ENV !== 'production', // Enable introspection for dev
        // playground: process.env.NODE_ENV !== 'production', // Enable playground for dev
    });

    await server.start();
    server.applyMiddleware({ app, path: '/graphql' });

    app.listen(API_GATEWAY_PORT, () => {
        console.log(`API Gateway running on port ${API_GATEWAY_PORT}`);
        console.log(`GraphQL endpoint available at http://localhost:${API_GATEWAY_PORT}${server.graphqlPath}`);
    });
}

startServer(); 