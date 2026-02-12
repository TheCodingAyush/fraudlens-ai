const fs = require('fs');
const path = require('path');

let admin = null;
let db = null;
let useMockDb = false;

// In-memory mock database for development/testing
const mockDatabase = {
    claims: new Map(),
    idCounter: 1
};

// Mock Firestore-like API
class MockCollection {
    constructor(name) {
        this.name = name;
    }

    async add(data) {
        const id = `mock_${mockDatabase.idCounter++}`;
        mockDatabase[this.name].set(id, { ...data, _id: id });
        return { id };
    }

    doc(id) {
        return new MockDoc(this.name, id);
    }

    orderBy(field, direction = 'asc') {
        return new MockQuery(this.name, { orderBy: { field, direction } });
    }
}

class MockDoc {
    constructor(collection, id) {
        this.collection = collection;
        this.id = id;
    }

    async get() {
        const data = mockDatabase[this.collection].get(this.id);
        return {
            exists: !!data,
            id: this.id,
            data: () => data
        };
    }
}

class MockQuery {
    constructor(collection, options = {}) {
        this.collection = collection;
        this.options = options;
    }

    limit(n) {
        this.options.limit = n;
        return this;
    }

    async get() {
        let results = Array.from(mockDatabase[this.collection].entries())
            .map(([id, data]) => ({ id, data: () => data }));

        if (this.options.orderBy) {
            results.sort((a, b) => {
                const aVal = a.data()[this.options.orderBy.field];
                const bVal = b.data()[this.options.orderBy.field];
                const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
                return this.options.orderBy.direction === 'desc' ? -cmp : cmp;
            });
        }

        if (this.options.limit) {
            results = results.slice(0, this.options.limit);
        }

        return {
            forEach: (fn) => results.forEach(fn),
            docs: results
        };
    }
}

class MockDb {
    collection(name) {
        if (!mockDatabase[name]) {
            mockDatabase[name] = new Map();
        }
        return new MockCollection(name);
    }
}

// Try to load Firebase, fall back to mock
const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json');

if (fs.existsSync(serviceAccountPath)) {
    try {
        const serviceAccount = require('./serviceAccountKey.json');
        admin = require('firebase-admin');
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
        db = admin.firestore();
        console.log('✅ Firebase initialized successfully');
    } catch (error) {
        console.warn('⚠️ Firebase initialization failed, using mock database:', error.message);
        useMockDb = true;
        db = new MockDb();
    }
} else {
    console.warn('⚠️ serviceAccountKey.json not found, using in-memory mock database');
    console.warn('   To use Firebase, copy serviceAccountKey.example.json to serviceAccountKey.json');
    console.warn('   and fill in your Firebase credentials');
    useMockDb = true;
    db = new MockDb();
}

module.exports = { admin, db, useMockDb };
