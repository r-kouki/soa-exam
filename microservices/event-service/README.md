# Event Service

The Event Service is a key component of the dating app microservices architecture, responsible for managing event topics, user subscriptions, and event notifications.

## Overview

The Event Service enables users to:
- Create event topics (e.g., "Available Tonight", "Coders Night", "Outdoor Activities")
- Subscribe to events they're interested in
- Receive notifications when there are updates to events they've subscribed to

## Technical Implementation

- **gRPC API**: Provides endpoints for creating, retrieving, subscribing to and notifying about events
- **MongoDB**: Stores event data and user subscriptions
- **Kafka**: Used for event publishing and consuming
- **Integration**: Works with the Notification Service to deliver notifications to users

## Service Endpoints

The Event Service exposes the following gRPC endpoints:

### CreateEvent
Creates a new event topic.
- **Input**: `CreateEventRequest` (title, description, category, location, date)
- **Output**: `Event` with generated ID and other details

### GetEvents
Retrieves a list of events, with optional filtering by category.
- **Input**: `GetEventsRequest` (category, limit, offset)
- **Output**: `GetEventsResponse` (list of events)

### SubscribeToEvent
Subscribes a user to an event.
- **Input**: `SubscribeRequest` (event_id, user_id)
- **Output**: `SubscribeResponse` (success status)

### UnsubscribeFromEvent
Removes a user's subscription from an event.
- **Input**: `UnsubscribeRequest` (event_id, user_id)
- **Output**: `UnsubscribeResponse` (success status)

### GetUserSubscriptions
Retrieves all events a user has subscribed to.
- **Input**: `GetUserSubscriptionsRequest` (user_id)
- **Output**: `GetUserSubscriptionsResponse` (list of events)

### NotifyEventSubscribers
Sends a notification to all subscribers of an event.
- **Input**: `NotifyRequest` (event_id, title, message, data)
- **Output**: `NotifyResponse` (success status, count of notified users)

## Data Models

### Event
```javascript
{
  id: String,           // Unique identifier
  title: String,        // Event title
  description: String,  // Event description
  category: String,     // Event category (e.g., "SOCIAL", "ACTIVITY", "DATING")
  location: String,     // Optional location information
  date: Date,           // Event date (if applicable)
  createdAt: Date,      // Timestamp when the event was created
  updatedAt: Date       // Timestamp when the event was last updated
}
```

### Subscription
```javascript
{
  id: String,           // Unique identifier
  eventId: String,      // Reference to the event
  userId: String,       // User who subscribed
  createdAt: Date,      // Timestamp when the subscription was created
}
```

## Kafka Integration

The Event Service uses Kafka for:
- **Publishing**: When events are created or updated
- **Consuming**: Processing event notifications for subscribers

### Topics
- `event-notifications`: Used for sending notifications to subscribers
- `event-updates`: Used for broadcasting event updates

## Setup and Configuration

The Event Service requires the following environment variables:

```
EVENT_SERVICE_GRPC_PORT=50055
MONGODB_URI=mongodb://mongodb:27017/dating_app_event_db
KAFKA_BROKERS=kafka:9092
USER_SERVICE_GRPC_URL=user-service:50051
NOTIFICATION_SERVICE_GRPC_URL=notification-service:50054
```

## Getting Started

1. Ensure MongoDB and Kafka are running
2. Start the Event Service
3. Use the API Gateway or a gRPC client to interact with the service

## Testing

A test client is available at `test-clients/event-service-client` to test the functionality:

```bash
cd test-clients/event-service-client
npm install
node client.js
```

The test client demonstrates creating events, subscribing users, and sending notifications. 