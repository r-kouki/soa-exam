require('dotenv').config();
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const connectDB = require('./config/database');
const UserProfile = require('./models/UserModel'); // Assuming this will be used in actual implementations
const mongoose = require('mongoose');

const USER_SERVICE_PORT = process.env.USER_SERVICE_PORT || 50051;
const PROTO_PATH = __dirname + '/proto/user.proto';

// Connect to MongoDB
connectDB();

// Load protobuf
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true
});
const userProto = grpc.loadPackageDefinition(packageDefinition).user;

// gRPC Service Implementation
const userServiceMethods = {
    createUserProfile: async (call, callback) => {
        console.log('CreateUserProfile called with:', call.request);
        try {
            const {
                auth_id,
                email,
                username,
                first_name,
                last_name,
                age,
                gender,
                interests,
                bio,
                photos,
                city,
                country
            } = call.request;

            // Basic validation
            if (!auth_id || !email || !username) {
                return callback({
                    code: grpc.status.INVALID_ARGUMENT,
                    message: 'auth_id, email, and username are required fields.'
                });
            }

            const newUserProfile = new UserProfile({
                auth_id,
                email,
                username,
                first_name,
                last_name,
                age,
                gender,
                interests,
                bio,
                photos,
                city,
                country
            });

            const savedProfile = await newUserProfile.save();

            // Prepare response matching the proto UserProfile message
            const profileResponse = {
                id: savedProfile._id.toString(),
                auth_id: savedProfile.auth_id,
                email: savedProfile.email,
                username: savedProfile.username,
                first_name: savedProfile.first_name,
                last_name: savedProfile.last_name,
                age: savedProfile.age,
                gender: savedProfile.gender,
                interests: savedProfile.interests,
                bio: savedProfile.bio,
                photos: savedProfile.photos,
                city: savedProfile.city,
                country: savedProfile.country,
                created_at: savedProfile.createdAt.toISOString(),
                updated_at: savedProfile.updatedAt.toISOString()
            };

            callback(null, { profile: profileResponse });

        } catch (error) {
            console.error("Error creating user profile:", error);
            if (error.code === 11000) { // MongoDB duplicate key error
                // Determine which field caused the duplication
                let duplicateField = "unknown";
                if (error.message.includes("email")) duplicateField = "email";
                else if (error.message.includes("username")) duplicateField = "username";
                else if (error.message.includes("auth_id")) duplicateField = "auth_id";

                return callback({
                    code: grpc.status.ALREADY_EXISTS,
                    message: `User profile with this ${duplicateField} already exists.`
                });
            }
            if (error.name === 'ValidationError') {
                return callback({
                    code: grpc.status.INVALID_ARGUMENT,
                    message: `Validation Error: ${error.message}`
                });
            }
            callback({
                code: grpc.status.INTERNAL,
                message: 'Error creating user profile: ' + error.message
            });
        }
    },
    getUserProfile: async (call, callback) => {
        console.log('GetUserProfile called with:', call.request);
        try {
            const { user_id } = call.request;

            if (!user_id) {
                return callback({
                    code: grpc.status.INVALID_ARGUMENT,
                    message: 'user_id is required.'
                });
            }

            let userProfile = await UserProfile.findOne({ auth_id: user_id });

            if (!userProfile) {
                // Try finding by MongoDB _id if not found by auth_id
                // Validate if user_id could be a valid MongoDB ObjectId
                if (mongoose.Types.ObjectId.isValid(user_id)) {
                    userProfile = await UserProfile.findById(user_id);
                }
            }

            if (!userProfile) {
                return callback({
                    code: grpc.status.NOT_FOUND,
                    message: 'User profile not found.'
                });
            }

            const profileResponse = {
                id: userProfile._id.toString(),
                auth_id: userProfile.auth_id,
                email: userProfile.email,
                username: userProfile.username,
                first_name: userProfile.first_name,
                last_name: userProfile.last_name,
                age: userProfile.age,
                gender: userProfile.gender,
                interests: userProfile.interests,
                bio: userProfile.bio,
                photos: userProfile.photos,
                city: userProfile.city,
                country: userProfile.country,
                created_at: userProfile.createdAt.toISOString(),
                updated_at: userProfile.updatedAt.toISOString()
            };

            callback(null, { profile: profileResponse });

        } catch (error) {
            console.error("Error getting user profile:", error);
            callback({
                code: grpc.status.INTERNAL,
                message: 'Error getting user profile: ' + error.message
            });
        }
    },
    updateUserProfile: async (call, callback) => {
        console.log('UpdateUserProfile called with:', call.request);
        try {
            const { user_id, ...updates } = call.request;

            if (!user_id) {
                return callback({
                    code: grpc.status.INVALID_ARGUMENT,
                    message: 'user_id is required for updates.'
                });
            }

            // Remove fields that are not set or are explicitly null in the request
            // to prevent overwriting existing data with nulls unless intended.
            // gRPC optional fields might not be present in `updates` if not provided.
            const validUpdates = {};
            for (const key in updates) {
                if (updates[key] !== undefined && updates[key] !== null) { // also check for empty arrays if needed
                    if (Array.isArray(updates[key])) {
                        // For repeated fields, gRPC sends empty array if cleared,
                        // or array with values if updated. We assume replacement.
                        validUpdates[key] = updates[key];
                    } else {
                        validUpdates[key] = updates[key];
                    }
                }
            }

            if (Object.keys(validUpdates).length === 0) {
                return callback({
                    code: grpc.status.INVALID_ARGUMENT,
                    message: 'No update fields provided.'
                });
            }

            let updatedProfile = await UserProfile.findOneAndUpdate(
                { auth_id: user_id },
                { $set: validUpdates },
                { new: true, runValidators: true }
            );

            if (!updatedProfile) {
                if (mongoose.Types.ObjectId.isValid(user_id)) {
                    updatedProfile = await UserProfile.findByIdAndUpdate(
                        user_id,
                        { $set: validUpdates },
                        { new: true, runValidators: true }
                    );
                }
            }

            if (!updatedProfile) {
                return callback({
                    code: grpc.status.NOT_FOUND,
                    message: 'User profile not found to update.'
                });
            }

            const profileResponse = {
                id: updatedProfile._id.toString(),
                auth_id: updatedProfile.auth_id,
                email: updatedProfile.email,
                username: updatedProfile.username,
                first_name: updatedProfile.first_name,
                last_name: updatedProfile.last_name,
                age: updatedProfile.age,
                gender: updatedProfile.gender,
                interests: updatedProfile.interests,
                bio: updatedProfile.bio,
                photos: updatedProfile.photos,
                city: updatedProfile.city,
                country: updatedProfile.country,
                created_at: updatedProfile.createdAt.toISOString(),
                updated_at: updatedProfile.updatedAt.toISOString()
            };

            callback(null, { profile: profileResponse });

        } catch (error) {
            console.error("Error updating user profile:", error);
            if (error.code === 11000) { // MongoDB duplicate key error
                let duplicateField = "unknown";
                if (error.message.includes("email")) duplicateField = "email";
                else if (error.message.includes("username")) duplicateField = "username";
                return callback({
                    code: grpc.status.ALREADY_EXISTS,
                    message: `Update failed: new ${duplicateField} already exists.`
                });
            }
            if (error.name === 'ValidationError') {
                return callback({
                    code: grpc.status.INVALID_ARGUMENT,
                    message: `Validation Error: ${error.message}`
                });
            }
            callback({
                code: grpc.status.INTERNAL,
                message: 'Error updating user profile: ' + error.message
            });
        }
    },
    deleteUserProfile: async (call, callback) => {
        console.log('DeleteUserProfile called with:', call.request);
        try {
            const { user_id } = call.request;

            if (!user_id) {
                return callback({
                    code: grpc.status.INVALID_ARGUMENT,
                    message: 'user_id is required for deletion.'
                });
            }

            let deletedProfile = await UserProfile.findOneAndDelete({ auth_id: user_id });

            if (!deletedProfile) {
                if (mongoose.Types.ObjectId.isValid(user_id)) {
                    deletedProfile = await UserProfile.findByIdAndDelete(user_id);
                }
            }

            if (!deletedProfile) {
                return callback({
                    code: grpc.status.NOT_FOUND,
                    message: 'User profile not found to delete.'
                });
            }

            callback(null, { message: 'User profile deleted successfully.', success: true });

        } catch (error) {
            console.error("Error deleting user profile:", error);
            callback({
                code: grpc.status.INTERNAL,
                message: 'Error deleting user profile: ' + error.message
            });
        }
    }
};

// Start gRPC server
function main() {
    const server = new grpc.Server();
    server.addService(userProto.UserService.service, userServiceMethods);
    server.bindAsync(`0.0.0.0:${USER_SERVICE_PORT}`,
        grpc.ServerCredentials.createInsecure(),
        (err, port) => {
            if (err) {
                console.error('Failed to bind server:', err);
                return;
            }
            console.log(`User service running on port: ${port}`);
            server.start();
        }
    );
}

main(); 