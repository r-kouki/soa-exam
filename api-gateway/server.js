require('dotenv').config();
const express = require('express');
const { ApolloServer, gql } = require('apollo-server-express');
const path = require('path');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');

const API_GATEWAY_PORT = process.env.API_GATEWAY_PORT || 4000;

// Path to User service proto file
const USER_PROTO_PATH = path.join(__dirname, 'graphql/proto/user.proto');
const USER_SERVICE_GRPC_URL = process.env.USER_SERVICE_GRPC_URL || 'localhost:50051';

// Load User Proto
const userPackageDefinition = protoLoader.loadSync(USER_PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
    includeDirs: [path.join(__dirname, 'graphql/proto')]
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

    type Query {
        helloGateway: String
        getUserProfile(userId: ID!): UserProfile
        getConfirmedMatches(userId: ID!): [UserProfile]
    }

    type Mutation {
        submitSwipe(
            swiperUserId: ID!,
            swipedUserId: ID!,
            direction: SwipeDirectionGQL!
        ): SwipeResponseGQL
    }
`;

// GraphQL Resolvers
const resolvers = {
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