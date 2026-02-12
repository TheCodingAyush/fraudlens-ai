const admin = require('firebase-admin');

let db;
let isFirebaseInitialized = false;

try {
    const serviceAccount = require('./serviceAccountKey.json');
    
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
    
    db = admin.firestore();
    isFirebaseInitialized = true;
    console.log('✓ Firebase initialized successfully');
} catch (error) {
    console.warn('⚠ Firebase initialization failed. Running in demo mode.');
    console.warn('To use real Firebase, add a valid serviceAccountKey.json');
    
    // Create a mock database for demo purposes
    const mockedClaims = {};
    
    db = {
        collection: (name) => ({
            add: async (data) => {
                const id = 'DEMO-' + Date.now().toString();
                if (name === 'claims') {
                    mockedClaims[id] = data;
                }
                return { id };
            },
            get: async () => ({
                docs: Object.entries(mockedClaims).map(([id, data]) => ({
                    id,
                    data: () => data,
                    exists: true
                }))
            }),
            orderBy: (field) => ({
                limit: (count) => ({
                    get: async () => ({
                        docs: Object.entries(mockedClaims)
                            .slice(-count)
                            .reverse()
                            .map(([id, data]) => ({
                                id,
                                data: () => data,
                                exists: true
                            }))
                    })
                })
            }),
            doc: (id) => ({
                get: async () => ({
                    exists: !!mockedClaims[id],
                    data: () => mockedClaims[id] || {},
                    id
                }),
                set: async (data) => ({ success: true }),
                update: async (data) => ({ success: true }),
                delete: async () => ({ success: true })
            })
        }),
        doc: (path) => ({
            get: async () => ({ exists: false, data: () => ({}) })
        })
    };
}

module.exports = { admin, db, isFirebaseInitialized };