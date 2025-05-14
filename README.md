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

## Current Implementation Status

-   **API Gateway (`api-gateway`)**:
    -   Acts as the single entry point for all client requests.
    -   GraphQL interface for client-server communication.
    -   Routes requests to appropriate microservices (`user-service`, `matching-service`, `chat-service`).
    -   Currently handles:
        -   User profile creation and retrieval (via `user-service`).
        -   Submitting swipes and detecting matches (via `matching-service`).
        -   Retrieving confirmed matches for a user (via `matching-service`).
        -   Potentially assists clients in establishing WebSocket connections to the `chat-service`.
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
-   **Chat Service (`microservices/chat-service`)**:
    -   Manages real-time messaging between matched users using WebSockets.
    -   Stores chat messages in MongoDB (`dating_app_chat_db`).
    -   `ChatMessageModel` defined with Mongoose.
    -   Provides a basic gRPC endpoint (`GetMessageHistory`) for fetching chat history (implementation pending).
    -   WebSocket server allows clients to connect, send, and receive messages within chat rooms.
-   **Keycloak**: 
    -   Set up and running, with a realm (`dating-app-realm`) and a client (`dating-app-gateway`) configured. Not yet integrated into the API Gateway's request authentication flow.

### System Components Diagram (Current)

```mermaid
graph TD
    A[Client App] --> B{API Gateway (GraphQL)};
    B --> C[User Service (gRPC)];
    B --> D[Matching Service (gRPC)];
    B --> E[Chat Service (gRPC/WebSocket)];
    B --> F[Keycloak (OAuth2/OIDC)];
    C --> G[(MongoDB - User DB)];
    D --> H[(MongoDB - Matching DB)];
    E --> I[(MongoDB - Chat DB)];
    F --> G; # Keycloak might store user info linked to User DB

    subgraph Microservices
        C
        D
        E
    end
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
-   **Overall**: 

## Future Work

(To be added: planned features, improvements, and enhancements)