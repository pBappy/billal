// db.js - IndexedDB Helper Functions

const DB_NAME = 'JomaKhorochDB';
const STORE_NAME = 'entries';
const DB_VERSION = 1; // ডেটাবেস ভার্সন

let db; // ডেটাবেস অবজেক্ট হোল্ড করার জন্য

/**
 * IndexedDB শুরু করে এবং ডেটাবেস অবজেক্ট db ভ্যারিয়েবলে স্টোর করে।
 * @returns {Promise<IDBDatabase>} একটি Promise যা ডেটাবেস অবজেক্টের সাথে resolve করে।
 */
function initDB() {
    return new Promise((resolve, reject) => {
        if (db) { // যদি ডেটাবেস 이미 ইনিশিয়ালাইজড থাকে
            return resolve(db);
        }

        console.log('Initializing IndexedDB...');
        // ডেটাবেস খোলার জন্য রিকোয়েস্ট
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        // যখন ডেটাবেসের স্ট্রাকচার পরিবর্তন করতে হয় (যেমন নতুন স্টোর তৈরি বা ইনডেক্স যোগ করা)
        request.onupgradeneeded = (event) => {
            const tempDb = event.target.result;
            console.log(`Upgrading to version ${tempDb.version}`);

            if (!tempDb.objectStoreNames.contains(STORE_NAME)) {
                // 'entries' নামে একটি অবজেক্ট স্টোর তৈরি করি
                // 'id' হবে প্রাইমারি কী এবং এটি অটো-ইনক্রিমেন্ট হবে
                const store = tempDb.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
                // বিভিন্ন ফিল্ডের ওপর ইনডেক্স তৈরি করি, যা কোয়েরি করতে সাহায্য করবে
                store.createIndex('type', 'type', { unique: false }); // জমা নাকি খরচ
                store.createIndex('timestamp', 'timestamp', { unique: false }); // কখন এন্ট্রি হয়েছে
                store.createIndex('synced', 'synced', { unique: false }); // অনলাইনে সিঙ্ক হয়েছে কিনা
                console.log('Object store "entries" created.');
            }
        };

        // ডেটাবেস সফলভাবে খোলা হলে
        request.onsuccess = (event) => {
            db = event.target.result; // ডেটাবেস অবজেক্ট সেভ করি
            console.log('Database initialized successfully.');
            resolve(db);
        };

        // ডেটাবেস খুলতে কোনো সমস্যা হলে
        request.onerror = (event) => {
            console.error('Database error:', event.target.error);
            reject('Error initializing database: ' + event.target.error);
        };
    });
}

/**
 * IndexedDB-তে একটি নতুন এন্ট্রি যোগ করে।
 * @param {object} entry - যে এন্ট্রিটি যোগ করতে হবে (যেমন: {description, amount, type})।
 * @returns {Promise<number>} একটি Promise যা নতুন এন্ট্রির id-এর সাথে resolve করে।
 */
async function addEntry(entry) {
    if (!db) {
        await initDB(); // যদি ডেটাবেস না থাকে, ইনিশিয়ালাইজ করি
    }
    return new Promise((resolve, reject) => {
        // একটি 'readwrite' ট্রানজ্যাকশন শুরু করি 'entries' স্টোরের জন্য
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);

        // নতুন এন্ট্রিতে timestamp এবং synced স্ট্যাটাস যোগ করি
        const entryToAdd = {
            ...entry,
            timestamp: new Date().getTime(), // বর্তমান সময়
            synced: false // ডিফল্টভাবে এটি সিঙ্ক হয়নি
        };

        const request = store.add(entryToAdd); // এন্ট্রি যোগ করার রিকোয়েস্ট

        request.onsuccess = () => {
            console.log('Entry added successfully with id:', request.result);
            resolve(request.result); // নতুন এন্ট্রির id রিটার্ন করি
        };

        request.onerror = (event) => {
            console.error('Error adding entry:', event.target.error);
            reject('Error adding entry: ' + event.target.error);
        };
    });
}

/**
 * IndexedDB থেকে সকল এন্ট্রি রিট্রিভ করে।
 * @returns {Promise<Array<object>>} একটি Promise যা সকল এন্ট্রির একটি অ্যারের সাথে resolve করে।
 */
async function getAllEntries() {
    if (!db) {
        await initDB();
    }
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll(); // সকল এন্ট্রি পাওয়ার রিকোয়েস্ট

        request.onsuccess = () => {
            // timestamp অনুযায়ী ডিসেন্ডিং অর্ডারে সর্ট করি (নতুন এন্ট্রি আগে)
            const sortedEntries = request.result.sort((a, b) => b.timestamp - a.timestamp);
            resolve(sortedEntries);
        };

        request.onerror = (event) => {
            console.error('Error getting all entries:', event.target.error);
            reject('Error getting all entries: ' + event.target.error);
        };
    });
}

/**
 * IndexedDB থেকে একটি নির্দিষ্ট এন্ট্রি মুছে ফেলে।
 * @param {number} id - যে এন্ট্রিটি মুছতে হবে তার id।
 * @returns {Promise<void>} একটি Promise যা এন্ট্রি সফলভাবে মোছা হলে resolve করে।
 */
async function deleteEntry(id) {
    if (!db) {
        await initDB();
    }
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(id); // নির্দিষ্ট id-এর এন্ট্রি মোছার রিকোয়েস্ট

        request.onsuccess = () => {
            console.log(`Entry with id ${id} deleted successfully.`);
            resolve();
        };
        request.onerror = (event) => {
            console.error(`Error deleting entry with id ${id}:`, event.target.error);
            reject(`Error deleting entry: ${event.target.error}`);
        };
    });
}

/**
 * IndexedDB-তে একটি নির্দিষ্ট এন্ট্রির synced স্ট্যাটাস আপডেট করে।
 * @param {number} id - যে এন্ট্রিটি আপডেট করতে হবে তার id।
 * @param {boolean} syncStatus - নতুন সিঙ্ক স্ট্যাটাস (true অথবা false)।
 * @returns {Promise<void>} একটি Promise যা সফলভাবে আপডেট হলে resolve করে।
 */
async function updateEntrySyncStatus(id, syncStatus) {
    if (!db) {
        await initDB();
    }
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);

        // প্রথমে এন্ট্রিটি খুঁজে বের করি
        const getRequest = store.get(id);

        getRequest.onsuccess = () => {
            const entry = getRequest.result;
            if (entry) {
                entry.synced = syncStatus; // সিঙ্ক স্ট্যাটাস আপডেট করি
                const updateRequest = store.put(entry); // আপডেট করা এন্ট্রি সেভ করি

                updateRequest.onsuccess = () => {
                    console.log(`Entry ${id} sync status updated to ${syncStatus}`);
                    resolve();
                };
                updateRequest.onerror = (event) => {
                    console.error(`Error updating sync status for entry ${id}:`, event.target.error);
                    reject(event.target.error);
                };
            } else {
                reject(`Entry with id ${id} not found.`);
            }
        };
        getRequest.onerror = (event) => {
            console.error(`Error fetching entry ${id} for update:`, event.target.error);
            reject(event.target.error);
        };
    });
}

/**
 * IndexedDB থেকে যে এন্ট্রিগুলো সিঙ্ক হয়নি (synced: false), সেগুলো রিট্রিভ করে।
 * @returns {Promise<Array<object>>} একটি Promise যা সিঙ্ক না হওয়া এন্ট্রিগুলোর একটি অ্যারের সাথে resolve করে।
 */
async function getUnsyncedEntries() {
    if (!db) {
        await initDB();
    }
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const index = store.index('synced'); // 'synced' ইনডেক্স ব্যবহার করি
        const request = index.getAll(false); // synced: false থাকা সব এন্ট্রি

        request.onsuccess = () => {
            resolve(request.result);
        };
        request.onerror = (event) => {
            console.error('Error getting unsynced entries:', event.target.error);
            reject(event.target.error);
        };
    });
}

// initDB() ফাংশনটি কল করে ডেটাবেস শুরু করি যখন এই স্ক্রিপ্ট লোড হয়
// initDB().catch(err => console.error("Failed to initialize DB on load:", err));
// আমরা app.js থেকে প্রয়োজন অনুযায়ী initDB() কল করব।
