const { Kafka } = require('kafkajs');
require('dotenv').config();

const KAFKA_BROKERS = process.env.KAFKA_BROKERS ? process.env.KAFKA_BROKERS.split(',') : ['localhost:9092'];

// Create Kafka client
const kafka = new Kafka({
    clientId: 'event-service',
    brokers: KAFKA_BROKERS,
    retry: {
        initialRetryTime: 100,
        retries: 8
    }
});

// Create Kafka producer
const producer = kafka.producer();

// Create Kafka consumer
const consumer = kafka.consumer({ 
    groupId: 'event-service-group' 
});

// Initialize Kafka (connect producer and consumer)
const initializeKafka = async () => {
    try {
        await producer.connect();
        console.log('EVENT_SERVICE: Kafka producer connected');
        
        await consumer.connect();
        console.log('EVENT_SERVICE: Kafka consumer connected');
        
        // Create topics if they don't exist
        const admin = kafka.admin();
        await admin.connect();
        
        const topics = await admin.listTopics();
        
        // Create topics if they don't exist
        const topicsToCreate = [
            { topic: 'event-notifications' },
            { topic: 'event-subscriptions' }
        ];
        
        const missingTopics = topicsToCreate
            .filter(topic => !topics.includes(topic.topic));
            
        if (missingTopics.length > 0) {
            await admin.createTopics({
                topics: missingTopics,
                waitForLeaders: true
            });
            console.log(`EVENT_SERVICE: Created Kafka topics: ${missingTopics.map(t => t.topic).join(', ')}`);
        }
        
        await admin.disconnect();
        
        // Subscribe to relevant topics
        await consumer.subscribe({ 
            topics: ['event-notifications', 'event-subscriptions'],
            fromBeginning: false 
        });
        
        return { producer, consumer };
    } catch (error) {
        console.error('EVENT_SERVICE: Failed to initialize Kafka:', error);
        throw error;
    }
};

module.exports = {
    initializeKafka,
    producer,
    consumer
}; 