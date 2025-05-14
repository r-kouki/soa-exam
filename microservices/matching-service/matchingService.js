require('dotenv').config();
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');
const connectDB = require('./config/database');
const Swipe = require('./models/SwipeModel');
const Match = require('./models/MatchModel'); // Import MatchModel

const MATCHING_SERVICE_PORT = process.env.MATCHING_SERVICE_PORT || 50052;
const USER_SERVICE_GRPC_URL = process.env.USER_SERVICE_GRPC_URL || 'localhost:50051';

const MATCHING_PROTO_PATH = path.join(__dirname, 'proto/matching.proto');
const USER_PROTO_PATH = path.join(__dirname, 'proto/user.proto'); // For user types and client

// Connect to MongoDB
connectDB();

// Load User Proto (for UserServiceClient and for types used in matching.proto)
const userPackageDefinition = protoLoader.loadSync(USER_PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
    includeDirs: [path.join(__dirname, 'proto')] // Important for resolving imports in matching.proto
});
const userProto = grpc.loadPackageDefinition(userPackageDefinition).user;

// Create gRPC client for User Service
const userServiceClient = new userProto.UserService(
    USER_SERVICE_GRPC_URL,
    grpc.credentials.createInsecure()
);

// Load Matching Proto
const matchingPackageDefinition = protoLoader.loadSync(MATCHING_PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
    includeDirs: [path.join(__dirname, 'proto')] // Important for resolving imports
});
const matchingProto = grpc.loadPackageDefinition(matchingPackageDefinition).matching;

// Helper to convert gRPC SwipeDirection enum string name to the DB string (they are the same in this case)
// This function now might seem redundant if the enum string names are directly what we want to store,
// but it provides a layer of validation/mapping if they were different.
function getSwipeDirectionStringForDB(directionStringName) {
    switch (directionStringName) {
        case 'LIKE':
            return 'LIKE';
        case 'DISLIKE':
            return 'DISLIKE';
        // case 'SUPER_LIKE': // if we add it to proto and want to store it
        //     return 'SUPER_LIKE';
        default:
            console.warn('Received unspecified or invalid swipe direction string name:', directionStringName);
            return null;
    }
}

// gRPC Service Implementation for MatchingService
const matchingServiceMethods = {
    submitSwipe: async (call, callback) => {
        console.log('SubmitSwipe called with:', call.request);
        const { swiper_user_id, swiped_user_id, direction } = call.request; // direction is a string e.g., "LIKE"

        // Use the new helper or directly use 'direction' if validation is sufficient
        const directionForDB = getSwipeDirectionStringForDB(direction);

        if (!swiper_user_id || !swiped_user_id || !directionForDB) {
            return callback({
                code: grpc.status.INVALID_ARGUMENT,
                message: 'swiper_user_id, swiped_user_id, and a valid direction are required.'
            });
        }

        if (swiper_user_id === swiped_user_id) {
            return callback({
                code: grpc.status.INVALID_ARGUMENT,
                message: 'User cannot swipe on themselves.'
            });
        }

        try {
            // Atomically create the swipe or find existing (due to unique index)
            // We use findOneAndUpdate with upsert:true and new:true to handle potential race conditions
            // or just rely on the unique index to throw an error if it's a duplicate non-upsertable swipe.
            // For simplicity here, let's try to create and catch duplicate error.
            let swipe = new Swipe({
                swiperUserId: swiper_user_id,
                swipedUserId: swiped_user_id,
                direction: directionForDB, // Use the validated/mapped string for DB
            });
            await swipe.save();

            let isMatch = false;
            let matchedUserProfile = null;
            let newMatchId = null;

            if (directionForDB === 'LIKE') {
                // Check if the other person (swiped_user_id) has also liked the swiper_user_id
                const mutualLike = await Swipe.findOne({
                    swiperUserId: swiped_user_id, // The one who was swiped on
                    swipedUserId: swiper_user_id, // The one who initiated the current swipe
                    direction: 'LIKE'
                });

                if (mutualLike) {
                    isMatch = true;
                    console.log(`MATCH FORMED between: ${swiper_user_id} and ${swiped_user_id}`);

                    // Create a Match document
                    // The pre-save hook in MatchModel will sort userIds
                    const matchUserIds = [swiper_user_id, swiped_user_id];
                    try {
                        const existingMatch = await Match.findOne({ userIds: {$all: matchUserIds} });
                        if (!existingMatch) {
                            const newMatch = new Match({ userIds: matchUserIds });
                            const savedMatch = await newMatch.save();
                            newMatchId = savedMatch._id.toString();
                            console.log(`New Match document created with ID: ${newMatchId}`);
                        } else {
                            newMatchId = existingMatch._id.toString(); // Match already recorded
                            console.log(`Match document already exists with ID: ${newMatchId}`);
                        }
                    } catch (matchError) {
                        if (matchError.code === 11000) { // Duplicate key error for Match, if pre-save sort and findOne didn't catch it
                            console.warn(`Attempted to create a duplicate Match document for users: ${matchUserIds.join(', ')}. This should ideally be caught by findOne.`);
                             // Try to find it again to be sure
                            const foundMatch = await Match.findOne({userIds: {$all: matchUserIds.sort()}});
                            if(foundMatch) newMatchId = foundMatch._id.toString();

                        } else {
                            console.error("Error creating or finding Match document:", matchError);
                            // Non-critical for swipe response, but should be logged/monitored
                        }
                    }
                    
                    try {
                        const profileResponse = await new Promise((resolve, reject) => {
                            userServiceClient.getUserProfile({ user_id: swiped_user_id }, (error, response) => {
                                if (error) return reject(error);
                                resolve(response);
                            });
                        });
                        if (profileResponse && profileResponse.profile) {
                            matchedUserProfile = profileResponse.profile;
                        }
                    } catch (profileError) {
                        console.error(`Failed to fetch profile for matched user ${swiped_user_id}:`, profileError);
                    }
                }
            }

            callback(null, {
                success: true,
                is_match: isMatch,
                match_id: newMatchId,
                matched_user_profile: matchedUserProfile
            });

        } catch (error) {
            console.error("Error submitting swipe:", error);
            if (error.code === 11000) { // MongoDB duplicate key error
                return callback({
                    code: grpc.status.ALREADY_EXISTS,
                    message: 'This swipe has already been recorded.'
                });
            }
            callback({
                code: grpc.status.INTERNAL,
                message: 'Error processing swipe: ' + error.message
            });
        }
    },
    getPotentialMatches: (call) => { // Server-side streaming RPC
        console.log('GetPotentialMatches called for user:', call.request.user_id);
        // TODO: Implement logic to find and stream potential matches.
        // 1. Get the requesting user's profile (from user-service) to understand their preferences, location etc.
        // 2. Get users they have already swiped on (from SwipeModel) to exclude them.
        // 3. Query UserProfile collection (via user-service, or if user data is replicated/cached here)
        //    for users matching criteria (e.g., location, age, interests, not yet swiped by requester).
        // 4. For each potential match found, call call.write(userProfile).
        // 5. When done, or if an error occurs, call call.end().
        call.emit('error', { code: grpc.status.UNIMPLEMENTED, message: 'GetPotentialMatches not implemented' });
        // call.end(); // Should be called when streaming is done or on error
    },
    getConfirmedMatches: async (call, callback) => {
        console.log('GetConfirmedMatches called for user:', call.request.user_id);
        const { user_id } = call.request;

        if (!user_id) {
            return callback({
                code: grpc.status.INVALID_ARGUMENT,
                message: 'user_id is required to get confirmed matches.'
            });
        }

        try {
            // Find all matches where the requesting user's ID is in the userIds array
            const matches = await Match.find({ userIds: user_id });

            if (!matches || matches.length === 0) {
                return callback(null, { matches: [] }); // No matches found
            }

            const matchedUserProfiles = [];

            for (const match of matches) {
                // Identify the other user in the match
                const otherUserId = match.userIds.find(id => id !== user_id);
                if (!otherUserId) continue; // Should not happen if data is consistent

                try {
                    const profileResponse = await new Promise((resolve, reject) => {
                        userServiceClient.getUserProfile({ user_id: otherUserId }, (error, response) => {
                            if (error) {
                                console.error(`Error fetching profile for matched user ${otherUserId}:`, error);
                                return reject(error); // If a profile can't be fetched, we might skip this match or return partial data
                            }
                            resolve(response);
                        });
                    });

                    if (profileResponse && profileResponse.profile) {
                        matchedUserProfiles.push(profileResponse.profile);
                    }
                } catch (profileError) {
                    console.error(`Skipping match with ${otherUserId} due to error fetching profile:`, profileError.message);
                    // Decide if a partial list is okay or if the whole operation should fail
                }
            }
            
            callback(null, { matches: matchedUserProfiles });

        } catch (error) {
            console.error("Error getting confirmed matches:", error);
            callback({
                code: grpc.status.INTERNAL,
                message: 'Error retrieving confirmed matches: ' + error.message
            });
        }
    }
};

// Start gRPC server
function main() {
    const server = new grpc.Server();
    server.addService(matchingProto.MatchingService.service, matchingServiceMethods);
    server.bindAsync(`0.0.0.0:${MATCHING_SERVICE_PORT}`,
        grpc.ServerCredentials.createInsecure(),
        (err, port) => {
            if (err) {
                console.error('MATCHING_SERVICE: Failed to bind server:', err);
                return;
            }
            console.log(`Matching service running on port: ${port}`);
            server.start();
        }
    );
}

main(); 