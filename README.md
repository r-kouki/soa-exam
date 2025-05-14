# Online Dating App Microservices Project

This project implements a microservices architecture for an online dating application.

## Project Description

The goal is to build a scalable and maintainable online dating platform using microservices. The system will utilize REST and GraphQL for client interactions via an API Gateway, gRPC for inter-service communication, and potentially a message broker like Kafka for asynchronous events. Keycloak will handle authentication.

## Architecture Overview

(Inspired by the provided diagram and adapted for a dating app)

*   **Client (Mobile/Web App)**: Interacts with the system via REST or GraphQL through the API Gateway.
*   **API Gateway**: The single entry point for client requests. Routes requests to the appropriate microservices. Handles REST and GraphQL.
*   **User Service**:
    *   Manages user profiles (creation, updates, retrieval), preferences, photos.
    *   Integrates with Keycloak for authentication and user identity.
    *   Exposes gRPC APIs for internal communication and potentially REST for some admin operations.
*   **Matching Service**:
    *   Handles user discovery, swiping mechanics, and matching algorithms.
    *   Stores and processes user interactions (likes, dislikes).
    *   Communicates with User Service to get profile data for matching.
    *   Exposes gRPC APIs.
*   **Chat Service**:
    *   Manages real-time text/media messaging between matched users.
    *   Handles message history and delivery status.
    *   Exposes gRPC APIs and potentially WebSockets via the API Gateway or directly.
*   **Notification Service**:
    *   Sends real-time notifications to users (e.g., new matches, new messages, profile views).
    *   May use various channels like push notifications, email.
    *   Exposes gRPC APIs.
*   **Databases**: Each core microservice (User, Matching, Chat) will have its own dedicated database to ensure loose coupling.
*   **Message Broker (e.g., Kafka)**: For asynchronous tasks like updating recommendations, sending batch notifications, or logging events.
*   **Keycloak**: Provides robust authentication and authorization for the platform.

## Project Structure

```
.
├── api-gateway/          # API Gateway service
├── microservices/
│   ├── user-service/       # User profile and authentication management
│   ├── matching-service/   # Matching logic and swipe handling
│   ├── chat-service/       # Real-time messaging
│   └── notification-service/ # Notifications
├── docker-compose.yml    # For local development environment
├── docs/                 # Project documentation (diagrams, API specs)
└── README.md             # This file
```

## Technologies

*   **API Gateway**: (To be decided, e.g., Apollo Server with Express for GraphQL, Spring Cloud Gateway, Kong, or Python-based like FastAPI/Flask with appropriate libraries)
*   **Microservices**: (Language/Framework TBD - e.g., Python with FastAPI/Flask, Node.js with Express, Java with Spring Boot)
    *   `user-service`
    *   `matching-service`
    *   `chat-service`
    *   `notification-service`
*   **gRPC**: For high-performance, type-safe inter-service communication.
*   **REST/GraphQL**: For client-facing APIs via the API Gateway.
*   **Databases**: (To be decided, e.g., PostgreSQL for relational data like user profiles, MongoDB for flexible data like chat messages or matching preferences, Redis for caching/session management)
*   **Message Broker**: (e.g., Kafka for event streaming, RabbitMQ for task queues)
*   **Real-time Communication (for Chat)**: WebSockets.
*   **Authentication**: Keycloak.

## Getting Started

(Instructions to be added: cloning, environment setup, running services)

## Documentation

(Links to detailed documentation for each service, API contracts, .proto files, etc., to be added)

## Current Implementation Status (As of User & Matching Service Setup)

The project currently has the following components set up and functional to a basic degree:

*   **API Gateway**: Exposes a GraphQL endpoint. Can currently query user profiles (from `user-service`), submit swipes (to `matching-service`), and retrieve confirmed matches for a user (from `matching-service`).
*   **User Service**: Manages user profiles with CRUD operations via gRPC. Connects to its own MongoDB database (`dating_app_user_db`).
*   **Matching Service**: 
    *   Handles swipe submissions via gRPC. Stores swipes in its own MongoDB database (`dating_app_matching_db`).
    *   Detects mutual matches upon swipe and creates a `Match` document in its database.
    *   Provides a gRPC method to retrieve confirmed matches for a user, fetching profile details from the `user-service`.
*   **Keycloak**: Set up and running, with a realm (`dating-app-realm`) and a client (`dating-app-gateway`) configured. Not yet integrated into the API Gateway's request authentication flow.
*   **MongoDB**: A single instance running, hosting separate databases for the user and matching services.
*   **Docker Compose**: All services (API Gateway, User Service, Matching Service, Keycloak, MongoDB) are containerized and orchestrated via `docker-compose.yml`.
*   **Basic Testing**:
    *   `user-service` tested via a gRPC client script for creating users.
    *   API Gateway's GraphQL endpoints tested manually for:
        *   `getUserProfile` (calling `user-service`)
        *   `submitSwipe` (calling `matching-service`)
        *   `getConfirmedMatches` (calling `matching-service`)

### System Components Diagram (Current)

```mermaid
graph TD
    subgraph "Client Interaction (Manual Testing)"
        UserClient[User via GraphQL Playground/gRPC Client]
    end

    subgraph "Orchestration"
        DockerCompose[docker-compose.yml]
    end

    subgraph "Authentication Service (Setup)"
        KeycloakService[Keycloak]
    end
    
    subgraph "Databases (Single MongoDB Instance)"
        MongoDBInstance[(MongoDB)]
        UserDB[("dating_app_user_db")]
        MatchingDB[("dating_app_matching_db")]
    end

    APIGateway["API Gateway (Node.js)
    GraphQL (Apollo)
    gRPC Clients (User, Matching)"]

    UserService["User Service (Node.js)
    gRPC Server
    Mongoose"] 
    
    MatchingService["Matching Service (Node.js)
    gRPC Server
    Mongoose
    gRPC Client (User)"]

    UserClient -->|GraphQL HTTP| APIGateway
    UserClient -->|gRPC (test script)| UserService
    
    APIGateway -->|gRPC| UserService
    APIGateway -->|gRPC| MatchingService
    
    UserService -->|CRUD| UserDB
    MatchingService -->|CRUD| MatchingDB
    MatchingService -->|gRPC GetUserProfile| UserService

    DockerCompose -.-> APIGateway
    DockerCompose -.-> UserService
    DockerCompose -.-> MatchingService
    DockerCompose -.-> KeycloakService
    DockerCompose -.-> MongoDBInstance

    MongoDBInstance --- UserDB
    MongoDBInstance --- MatchingDB
``` 