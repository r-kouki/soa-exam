const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');

const PROTO_PATH = __dirname + '/proto/user.proto';
const USER_SERVICE_ADDRESS = 'localhost:50051'; // Address of the gRPC server

// Load protobuf
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true
});
const userProto = grpc.loadPackageDefinition(packageDefinition).user;

// Create gRPC client
const client = new userProto.UserService(USER_SERVICE_ADDRESS, grpc.credentials.createInsecure());

const randomSuffix = Math.floor(Math.random() * 10000);

// Data for the new user
const newUser = {
    auth_id: `testauth|${randomSuffix}`,
    email: `testuser${randomSuffix}@example.com`,
    username: `testuser${randomSuffix}`,
    first_name: 'Test',
    last_name: 'User',
    age: 30,
    gender: 'non-binary',
    interests: ['coding', 'hiking'],
    bio: 'This is a test user profile created by a gRPC client.',
    photos: [],
    city: 'Testville',
    country: 'Testland'
};

async function runTests() {
    // 1. Create User Profile
    console.log("Attempting to create user profile...");
    client.createUserProfile(newUser, (error, response) => {
        if (error) {
            console.error('Error creating user profile:', error.message);
            if (error.details) console.error('Details:', error.details);
            return;
        }
        console.log('User profile created successfully:', response.profile);
        const createdUserId = response.profile.id;
        const createdAuthId = response.profile.auth_id;

        // 2. Get User Profile by ID
        if (createdUserId) {
            console.log(`\nAttempting to get user profile by ID: ${createdUserId}...`);
            client.getUserProfile({ user_id: createdUserId }, (err, resp) => {
                if (err) {
                    console.error('Error getting user profile by ID:', err.message);
                    return;
                }
                console.log('User profile fetched by ID:', resp.profile);
            });
        }

        // 3. Get User Profile by Auth ID
        if (createdAuthId) {
            console.log(`\nAttempting to get user profile by Auth ID: ${createdAuthId}...`);
            client.getUserProfile({ user_id: createdAuthId }, (err, resp) => {
                if (err) {
                    console.error('Error getting user profile by Auth ID:', err.message);
                    return;
                }
                console.log('User profile fetched by Auth ID:', resp.profile);
            });
        }
    });
}

runTests(); 