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
*   **Event Service**:
    *   Manages event topics like "Available Tonight" or "Coders Night".
    *   Implements gRPC endpoints for creating events, subscribing, and sending notifications.
    *   Uses Kafka for event publishing and consuming.
    *   Integrates with `notification-service` to notify subscribers about events.
    *   Stores event data and subscriptions in MongoDB (`dating_app_event_db`).
*   **Databases**: Each core microservice (User, Matching, Chat) will have its own dedicated database to ensure loose coupling.
*   **Message Broker (e.g., Kafka)**: For asynchronous tasks like updating recommendations, sending batch notifications, or logging events.
*   **Keycloak**: Provides robust authentication and authorization for the platform.

## Project Structure

```
.
├── api-gateway/          # API Gateway service (Node.js based)
├── microservices/
│   ├── user-service/       # User profile and authentication management (Node.js based)
│   ├── matching-service/   # Matching logic and swipe handling (Node.js based)
│   ├── chat-service/       # Real-time messaging (Node.js based)
│   ├── notification-service/ # Notifications (Node.js based)
│   └── event-service/      # Event management (Node.js based)
├── docker-compose.yml    # For local development environment
├── docs/                 # Project documentation (diagrams, API specs)
└── README.md             # This file
```

## Technologies

*   **API Gateway**: Node.js based (e.g., Express with Apollo Server for GraphQL).
*   **Microservices**: Node.js based (e.g., using Express or Fastify, with gRPC for inter-service communication).
    *   `user-service`
    *   `matching-service`
    *   `chat-service`
    *   `notification-service`
    *   `event-service`
*   **gRPC**: For high-performance, type-safe inter-service communication.
*   **REST/GraphQL**: For client-facing APIs via the API Gateway.
*   **Databases**: MongoDB (used as a central instance with separate logical databases for services).
*   **Message Broker**: Kafka (for event streaming, with Zookeeper for coordination).
*   **Real-time Communication (for Chat)**: WebSockets.
*   **Authentication**: Keycloak.

## Getting Started

(Instructions to be added: cloning, environment setup, running services)

## Documentation

(Links to detailed documentation for each service, API contracts, .proto files, etc., to be added)

## Current Implementation Status

-   **API Gateway (`api-gateway`)**:
    -   Acts as the single entry point for all client requests.
    -   GraphQL interface for client-server communication.
    -   Routes requests to appropriate microservices (`user-service`, `matching-service`, `chat-service`, `notification-service`, `event-service`).
    -   Currently handles:
        -   User profile creation and retrieval (via `user-service`).
        -   Submitting swipes and detecting matches (via `matching-service`).
        -   Retrieving confirmed matches for a user (via `matching-service`).
        -   Potentially assists clients in establishing WebSocket connections to the `chat-service`.
        -   Creating and managing event topics and subscriptions (via `event-service`).
    -   Integrated with Keycloak for authentication (initial setup, further integration pending).
-   **User Service (`microservices/user-service`)**:
    -   Manages user profiles (creation, retrieval, updates).
    -   gRPC service for internal communication.
    -   Stores user data in MongoDB (`dating_app_user_db`).
    -   `UserModel` defined with Mongoose.
-   **Matching Service (`microservices/matching-service`)**:
    -   Handles user swipes (likes/dislikes).
    -   Detects mutual matches between users.
    -   Stores swipe data and confirmed matches in MongoDB (`dating_app_matching_db`).
    -   `SwipeModel` and `MatchModel` defined with Mongoose.
    -   gRPC service for `submitSwipe` and `getConfirmedMatches`.
    -   Integrated with `notification-service` to alert users about new matches.
-   **Chat Service (`microservices/chat-service`)**:
    -   Manages real-time messaging between matched users using WebSockets.
    -   Stores chat messages in MongoDB (`dating_app_chat_db`).
    -   `ChatMessageModel` defined with Mongoose.
    -   Provides a basic gRPC endpoint (`GetMessageHistory`) for fetching chat history.
    -   WebSocket server allows clients to connect, send, and receive messages within chat rooms.
-   **Notification Service (`microservices/notification-service`)**:
    -   Handles the delivery of notifications to users.
    -   Implements a gRPC service with a `SendNotification` endpoint.
    -   Supports various notification types (`NEW_MATCH`, `NEW_MESSAGE`, `PROFILE_VISIT`).
    -   Provides a foundation for integration with external notification systems (email, push, SMS).
-   **Event Service (`microservices/event-service`)**:
    -   Manages event topics like "Available Tonight" or "Coders Night".
    -   Implements gRPC endpoints for creating events, subscribing, and sending notifications.
    -   Uses Kafka for event publishing and consuming.
    -   Integrates with `notification-service` to notify subscribers about events.
    -   Stores event data and subscriptions in MongoDB (`dating_app_event_db`).
-   **Message Broker**:
    -   Kafka and Zookeeper services for async communication and event streaming.
    -   Topics for event notifications and subscription management.
-   **Keycloak**: 
    -   Set up and running, with a realm (`dating-app-realm`) and a client (`dating-app-gateway`) configured. Not yet integrated into the API Gateway's request authentication flow.

### System Components Diagram (Current)

```mermaid
graph TD
    ClientApp[Client App] --> APIGateway{API Gateway <br>GraphQL/REST};

    subgraph "Core Services"
        APIGateway --> UserService[User Service <br>gRPC/REST];
        APIGateway --> MatchingService[Matching Service <br>gRPC];
        APIGateway --> ChatService[Chat Service <br>gRPC/WebSocket];
        APIGateway --> NotificationService[Notification Service <br>gRPC];
        APIGateway --> EventService[Event Service <br>gRPC];
    end

    subgraph "Authentication"
        APIGateway --> Keycloak[Keycloak <br>OAuth2/OIDC];
        UserService --> Keycloak; %% User service may validate tokens or interact with Keycloak APIs
    end

    subgraph "Data Storage & Messaging"
        MongoDBInstance[(MongoDB Instance)];
        UserService --> UserDB[dating_app_user_db];
        MatchingService --> MatchingDB[dating_app_matching_db];
        ChatService --> ChatDB[dating_app_chat_db];
        EventService --> EventDB[dating_app_event_db];

        UserDB -- in --> MongoDBInstance;
        MatchingDB -- in --> MongoDBInstance;
        ChatDB -- in --> MongoDBInstance;
        EventDB -- in --> MongoDBInstance;

        KafkaBroker[(Kafka)];
        Zookeeper[(Zookeeper)];

        EventService --> KafkaBroker; %% Event service produces to Kafka
        KafkaBroker -. uses .-> Zookeeper; %% Kafka relies on Zookeeper
    end

    subgraph "Service Interactions"
        MatchingService --> UserService; %% For profile data
        MatchingService --> NotificationService; %% For match alerts

        EventService --> UserService; %% For user data related to events
        EventService --> NotificationService; %% For event alerts
    end

    classDef microservice fill:#D6EAF8,stroke:#3498DB,stroke-width:2px,color:#000;
    classDef supportservice fill:#E8DAEF,stroke:#8E44AD,stroke-width:2px,color:#000;
    classDef database fill:#D5F5E3,stroke:#2ECC71,stroke-width:2px,color:#000;
    classDef client fill:#FDEDEC,stroke:#E74C3C,stroke-width:2px,color:#000;
    classDef datastore fill:#FDEBD0,stroke:#F39C12,stroke-width:2px,color:#000;


    class ClientApp client;
    class APIGateway,UserService,MatchingService,ChatService,NotificationService,EventService microservice;
    class Keycloak supportservice;
    class KafkaBroker,Zookeeper supportservice;
    class MongoDBInstance datastore;
    class UserDB,MatchingDB,ChatDB,EventDB database;
```

### Testing Notes

-   **Matching Service**:
    -   `submitSwipe` mutation to record a like or dislike.
    -   `getConfirmedMatches` query to retrieve a list of users who have mutually liked the current user.
    -   Verification of match creation in MongoDB.
-   **Chat Service**:
    -   Connect to the WebSocket endpoint (e.g., `ws://localhost:3001/?userId=testUser&chatRoomId=testRoom`) using a WebSocket client like `wscat`.
    -   Send and receive JSON messages (`{"content": "Hello!"}`).
    -   Verify message persistence in `dating_app_chat_db` in MongoDB.
    -   Test `GetMessageHistory` gRPC endpoint (once fully implemented).
-   **Notification Service**:
    -   Basic gRPC service for sending notifications to users.
    -   Supports different notification types (e.g., `NEW_MATCH`, `NEW_MESSAGE`, `PROFILE_VISIT`).
    -   Currently implements a stubbed notification delivery system.
-   **Event Service**:
    -   Create event topics like "Available Tonight" using the `createEvent` GraphQL mutation.
    -   Subscribe users to events with the `subscribeToEvent` mutation.
    -   Send notifications to all subscribers of an event topic.
    -   Retrieve events and user subscriptions.
    -   Verify Kafka message publishing and consumption.
-   **Overall**:

## Future Work

(To be added: planned features, improvements, and enhancements)