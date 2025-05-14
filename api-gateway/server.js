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
});
const userProto = grpc.loadPackageDefinition(userPackageDefinition).user;

// Create gRPC client for User Service
const userServiceClient = new userProto.UserService(
    USER_SERVICE_GRPC_URL,
    grpc.credentials.createInsecure()
);

// GraphQL Schema (Placeholder)
const typeDefs = gql`
    type Query {
        _empty: String # Placeholder to ensure Query type is defined
        helloGateway: String
        getUserProfile(userId: ID!): UserProfile
    }

    # We will extend this later with User types and queries
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
`;

// GraphQL Resolvers (Placeholder)
const resolvers = {
    Query: {
        helloGateway: () => 'Hello from API Gateway!',
        getUserProfile: async (_, { userId }) => {
            return new Promise((resolve, reject) => {
                userServiceClient.getUserProfile({ user_id: userId }, (error, response) => {
                    if (error) {
                        console.error('Error fetching user profile from user-service:', error);
                        // Map gRPC error to GraphQL error
                        // This is a simple mapping; more sophisticated error handling would be needed
                        reject(new Error(error.details || 'Error fetching user profile'));
                    }
                    console.log("Received from user-service:", response)
                    resolve(response ? response.profile : null);
                });
            });
        },
    },
    // We will add mutations later
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