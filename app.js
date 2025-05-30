// app.js - Main application logic

// Firebase Firestore ফাংশন ইম্পোর্ট (index.html এ window.dbFirestore সেট করা হয়েছে)
// const dbFirestore = window.dbFirestore; // এখন আর প্রয়োজন নেই, সরাসরি window.dbFirestore ব্যবহার করব

// Firebase থেকে ফাংশন ইম্পোর্ট (যদি মডিউলার SDK ব্যবহার করেন, অন্যভাবে করতে হবে)
// আপাতত আমরা ধরে নিচ্ছি index.html এ SDK লোড করা হয়েছে এবং window.dbFirestore অ্যাভেইলেবল
// Firestore থেকে ডেটা যোগ, রিড করার জন্য প্রয়োজনীয় ফাংশন (এগুলো window.dbFirestore অবজেক্টের মেথড হিসেবে পাওয়া যাবে)
// যেমন: addDoc, collection, getDocs, query, where, orderBy, doc, updateDoc, deleteDoc
// এগুলোর জন্য firebase/firestore থেকে নির্দিষ্ট ফাংশন ইম্পোর্ট করতে হয়, যদি আপনি script type="module" ব্যবহার করেন এবং সরাসরি Firebase SDK থেকে ইম্পোর্ট করেন।
// যেহেতু আমরা index.html এ window.dbFirestore ব্যবহার করছি, আমাদের এভাবে ইম্পোর্ট করতে হবে না।
// তবে, Firestore এর নতুন মডিউলার SDK (v9+) তে ফাংশনগুলো সরাসরি `firebase.firestore().collection()` এভাবে পাওয়া যায় না।
// আপনাকে `import { collection, addDoc, getDocs, ... } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";` এভাবে করতে হবে।

// যেহেতু আমরা index.html এ SDK লোড করেছি, আমরা ধরে নেব window.dbFirestore গ্লোবালি অ্যাভেইলেবল
// এবং এটি Firestore v9+ এর ফাংশনগুলো সরাসরি এক্সপোজ করবে না।
// এর পরিবর্তে, index.html এ যখন Firebase SDK লোড করা হয়েছে, সেখানে আমাদের `getFirestore` এর পাশাপাশি
// অন্যান্য প্রয়োজনীয় ফাংশনগুলোও ইম্পোর্ট করে window অবজেক্টে রাখতে হবে, অথবা app.js কে module হিসেবে ব্যবহার করতে হবে।

// **সঠিক পদ্ধতি (index.html এ Firebase SDK মডিউলার লোডিং)**
// index.html এ script ট্যাগটি এমন হবে:
/*
<script type="module">
  import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
  import { getFirestore, collection, addDoc, getDocs, query, orderBy, doc, deleteDoc as firestoreDeleteDoc, updateDoc, serverTimestamp, where, writeBatch } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

  const firebaseConfig = { ... }; // আপনার কনফিগারেশন
  const firebaseApp = initializeApp(firebaseConfig);
  window.dbFirestore = getFirestore(firebaseApp); // Firestore ইন্সট্যান্স

  // Firestore ফাংশনগুলো window অবজেক্টে রাখি যাতে app.js থেকে সহজে ব্যবহার করা যায়
  window.fb = {
      collection, addDoc, getDocs, query, orderBy, doc,
      deleteDoc: firestoreDeleteDoc, // deleteDoc নামটি冲突 করতে পারে, তাই firestoreDeleteDoc
      updateDoc, serverTimestamp, where, writeBatch
  };
</script>
*/
// তাহলে app.js এ আমরা window.fb.collection, window.fb.addDoc ইত্যাদি ব্যবহার করতে পারব।

document.addEventListener('DOMContentLoaded', () => {
    // ... (আগের DOM Elements এবং ভ্যারিয়েবলগুলো) ...
    const entryForm = document.getElementById('entryForm');
    const descriptionInput = document.getElementById('description');
    const amountInput = document.getElementById('amount');
    const typeInput = document.getElementById('type');
    const entriesList = document.getElementById('entriesList');
    const totalIncomeEl = document.getElementById('totalIncome');
    const totalExpenseEl = document.getElementById('totalExpense');
    const balanceEl = document.getElementById('balance');

    // Initial load of entries (এখন লোকাল এবং অনলাইন থেকে লোড করবে)
    loadAndDisplayEntries();

    entryForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        // ... (আগের ফর্ম সাবমিশন লজিক) ...
        const description = descriptionInput.value.trim();
        const amount = parseFloat(amountInput.value);
        const type = typeInput.value;

        if (!description || isNaN(amount) || amount <= 0) {
            alert('অনুগ্রহ করে সঠিক বিবরণ এবং টাকার পরিমাণ লিখুন।');
            return;
        }

        const newEntry = {
            description,
            amount,
            type,
            // timestamp এবং synced স্ট্যাটাস db.js এ যোগ হবে
        };

        try {
            const localId = await addEntry(newEntry); // db.js থেকে লোকাল IndexedDB তে যোগ
            console.log('New entry added to Local DB with id:', localId);
            entryForm.reset();
            loadAndDisplayEntries(); // UI রিফ্রেশ

            // সফলভাবে লোকাল এন্ট্রি হওয়ার পর অনলাইনে সিঙ্ক করার চেষ্টা
            if (navigator.onLine && window.dbFirestore && window.fb) {
                syncSingleEntryToFirebase(localId, newEntry);
            } else {
                console.log("Offline or Firebase not configured. Will sync later.");
            }

        } catch (error) {
            console.error('Failed to add entry:', error);
            alert('এন্ট্রি যোগ করতে সমস্যা হয়েছে।');
        }
    });

    async function syncSingleEntryToFirebase(localId, entryData) {
        if (!window.dbFirestore || !window.fb) {
            console.error("Firebase not initialized for single sync.");
            return;
        }
        try {
            // Firestore তে timestamp সার্ভার থেকে নিতে পারি
            const entryToSync = {
                ...entryData,
                localId: localId, // লোকাল আইডি সংরক্ষণ করি, যদি প্রয়োজন হয়
                createdAt: window.fb.serverTimestamp() // Firebase সার্ভার টাইমস্ট্যাম্প
            };
            delete entryToSync.id; // Firestore নিজের আইডি তৈরি করবে
            delete entryToSync.synced; // এই ফিল্ড Firestore এর জন্য নয়

            const docRef = await window.fb.addDoc(window.fb.collection(window.dbFirestore, "entries"), entryToSync);
            console.log("Entry synced to Firebase with ID: ", docRef.id);
            // লোকাল ডেটাবেসে synced স্ট্যাটাস আপডেট করি
            await updateEntrySyncStatus(localId, true);
            // UI তে সিঙ্ক স্ট্যাটাস আপডেট করতে পারি (ঐচ্ছিক, কারণ loadAndDisplayEntries আবার কল হবে)
            // loadAndDisplayEntries(); // অথবা নির্দিষ্ট আইটেম আপডেট করুন
        } catch (error) {
            console.error("Error syncing single entry to Firebase: ", error);
            // এখানে এরর হলে, এন্ট্রিটি লোকাল DB তে synced: false হিসেবেই থাকবে
        }
    }


    async function loadAndDisplayEntries() {
        try {
            let localEntries = await getAllEntries(); // db.js থেকে লোকাল সব এন্ট্রি
            console.log("Local entries loaded:", localEntries);

            if (navigator.onLine && window.dbFirestore && window.fb) {
                console.log("Online. Attempting to sync with Firebase.");
                // ১. লোকাল আনসিঙ্কড এন্ট্রিগুলো Firebase এ পুশ করি
                await syncOfflineEntriesToFirebase();

                // ২. Firebase থেকে সব এন্ট্রি (বা নতুনগুলো) ফেচ করি
                const firebaseEntries = await fetchEntriesFromFirebase();

                // ৩. লোকাল এবং Firebase এন্ট্রি মার্জ/আপডেট করি (সিম্পলিসিটির জন্য, Firebase কেই সোর্স অফ ট্রুথ ধরতে পারি)
                // এই মডেলে, Firebase থেকে আসা ডেটা IndexedDB তেও আপডেট করা হবে
                localEntries = await mergeAndStoreFirebaseEntries(firebaseEntries, localEntries);
            } else {
                console.log("Offline or Firebase not configured. Showing local entries only.");
            }

            renderEntriesList(localEntries); // এখন মার্জ করা বা শুধু লোকাল এন্ট্রি দেখাবে
            updateSummary(localEntries);

        } catch (error) {
            console.error('Failed to load and display entries:', error);
            entriesList.innerHTML = '<li>এন্ট্রি লোড করতে সমস্যা হয়েছে।</li>';
        }
    }

    async function syncOfflineEntriesToFirebase() {
        if (!window.dbFirestore || !window.fb) {
            console.error("Firebase not initialized for bulk sync.");
            return;
        }
        const unsyncedEntries = await getUnsyncedEntries(); // db.js থেকে
        if (unsyncedEntries.length === 0) {
            console.log("No unsynced entries to push to Firebase.");
            return;
        }
        console.log(`Found ${unsyncedEntries.length} unsynced entries. Pushing to Firebase...`);

        const batch = window.fb.writeBatch(window.dbFirestore);

        for (const entry of unsyncedEntries) {
            const entryDataForFirebase = {
                description: entry.description,
                amount: entry.amount,
                type: entry.type,
                createdAt: window.fb.serverTimestamp(), // অথবা entry.timestamp যদি সেটাই রাখতে চান
                localId: entry.id // লোকাল আইডি, Firestore এ আলাদা আইডি তৈরি হবে
            };
            // Firestore তে একটি নতুন ডকুমেন্ট তৈরি করার জন্য একটি রেফারেন্স
            const newDocRef = window.fb.doc(window.fb.collection(window.dbFirestore, "entries"));
            batch.set(newDocRef, entryDataForFirebase);
        }

        try {
            await batch.commit(); // ব্যাচ কমিট করি
            console.log(`${unsyncedEntries.length} entries batched and synced to Firebase.`);
            // সফলভাবে সিঙ্ক হওয়ার পর লোকাল DB তে synced স্ট্যাটাস true করি
            for (const entry of unsyncedEntries) {
                await updateEntrySyncStatus(entry.id, true);
            }
        } catch (error) {
            console.error("Error syncing batch entries to Firebase: ", error);
        }
    }

    async function fetchEntriesFromFirebase() {
        if (!window.dbFirestore || !window.fb) {
            console.error("Firebase not initialized for fetching.");
            return [];
        }
        try {
            const q = window.fb.query(window.fb.collection(window.dbFirestore, "entries"), window.fb.orderBy("createdAt", "desc"));
            const querySnapshot = await window.fb.getDocs(q);
            const firebaseEntries = [];
            querySnapshot.forEach((doc) => {
                firebaseEntries.push({ id: doc.id, ...doc.data() });
            });
            console.log("Fetched entries from Firebase:", firebaseEntries);
            return firebaseEntries;
        } catch (error) {
            console.error("Error fetching entries from Firebase: ", error);
            return [];
        }
    }

    async function mergeAndStoreFirebaseEntries(firebaseEntries, localEntries) {
        // এটি একটি সরল মার্জিং স্ট্র্যাটেজি: Firebase-কেই সোর্স অফ ট্রুথ ধরা হচ্ছে
        // আরও জটিল মার্জিং (যেমন কনফ্লিক্ট রেজোলিউশন) এখানে যোগ করা যেতে পারে
        if (!window.dbFirestore || !window.fb) return localEntries;

        const allEntriesForDisplay = [];
        const localEntriesMap = new Map(localEntries.map(e => [e.id, e])); // লোকাল আইডি দিয়ে ম্যাপ

        for (const fbEntry of firebaseEntries) {
            // Firebase থেকে আসা এন্ট্রির জন্য একটি লোকাল আইডি তৈরি করি যদি না থাকে
            // (অথবা fbEntry.localId ব্যবহার করে ম্যাচ করতে পারি যদি পুশ করার সময় সেভ করে থাকি)
            let localMatch = localEntries.find(le => le.localId === fbEntry.localId && le.description === fbEntry.description); // সিম্পল ম্যাচিং

            if (localMatch) { // যদি লোকাল ম্যাচ পাওয়া যায়
                // Firestore ডেটা দিয়ে লোকাল এন্ট্রি আপডেট করি
                localMatch.firebaseId = fbEntry.id; // Firestore ID সেভ করি
                localMatch.description = fbEntry.description;
                localMatch.amount = fbEntry.amount;
                localMatch.type = fbEntry.type;
                localMatch.timestamp = fbEntry.createdAt.toDate().getTime(); // Firestore timestamp কে JS timestamp এ কনভার্ট
                localMatch.synced = true;
                // লোকাল IndexedDB তে আপডেট করতে পারেন (ঐচ্ছিক, যদি Firebase কেই সবসময় সোর্স ধরেন)
                // await updateEntryInDB(localMatch); // db.js এ এই ফাংশন বানাতে হবে
                allEntriesForDisplay.push(localMatch);
                localEntriesMap.delete(localMatch.id);
            } else {
                // যদি লোকাল ম্যাচ না পাওয়া যায়, এটি একটি নতুন এন্ট্রি Firebase থেকে
                const newLocalEntry = {
                    // একটি নতুন লোকাল আইডি তৈরি করতে হবে, অথবা fbEntry.localId যদি থাকে
                    id: fbEntry.localId || Date.now() + Math.random(), // একটা ইউনিক আইডি লাগবে
                    firebaseId: fbEntry.id,
                    description: fbEntry.description,
                    amount: fbEntry.amount,
                    type: fbEntry.type,
                    timestamp: fbEntry.createdAt.toDate().getTime(),
                    synced: true,
                    localId: fbEntry.localId // যদি থাকে
                };
                // এই নতুন এন্ট্রিটি IndexedDB তে সেভ করা যেতে পারে (যদি অফলাইন ফার্স্ট অ্যাপ্রোচ চান)
                // const newId = await addEntry(newLocalEntry); // addEntry কে মডিফাই করতে হবে যেন synced=true নেয়
                allEntriesForDisplay.push(newLocalEntry);
            }
        }

        // যে লোকাল এন্ট্রিগুলো Firebase এ নেই (যেমন অফলাইনে ডিলিট করা হয়েছে, কিন্তু সেই লজিক এখনো নেই)
        // অথবা যে লোকাল এন্ট্রিগুলো এখনো সিঙ্ক হয়নি (synced: false)
        localEntriesMap.forEach(unsyncedLocalEntry => {
            if (!unsyncedLocalEntry.synced) { // শুধু আনসিঙ্কডগুলো যোগ করি, কারণ সিঙ্কডগুলো Firebase থেকে আসার কথা
                 allEntriesForDisplay.push(unsyncedLocalEntry);
            }
        });


        // timestamp অনুযায়ী সর্ট করি (নতুন আগে)
        allEntriesForDisplay.sort((a, b) => b.timestamp - a.timestamp);

        // ডেডিকেটেড লোকাল স্টোরেজ আপডেট ফাংশন (ঐচ্ছিক, যদি IndexedDB কে Firebase এর সাথে সিঙ্কে রাখতে চান)
        // await clearAndRepopulateLocalDB(allEntriesForDisplay); // db.js এ এই ফাংশন বানাতে হবে

        return allEntriesForDisplay; // ডিসপ্লের জন্য অ্যারে রিটার্ন
    }


    function renderEntriesList(entries) {
        entriesList.innerHTML = '';
        if (entries.length === 0) {
            entriesList.innerHTML = '<li>এখনো কোনো এন্ট্রি নেই।</li>';
            return;
        }
        entries.forEach(entry => {
            const listItem = document.createElement('li');
            listItem.className = entry.type === 'income' ? 'income-item' : 'expense-item';

            const entryDetails = document.createElement('span');
            let syncStatusText = '';
            if ('synced' in entry) { // 'synced' প্রপার্টি থাকলেই দেখাব
                 syncStatusText = entry.synced ? ' (সিঙ্কড)' : ' (সিঙ্ক পেন্ডিং)';
            }
            entryDetails.textContent = `${entry.description}: ${entry.amount.toFixed(2)} টাকা - ${new Date(entry.timestamp).toLocaleDateString('bn-BD')} ${syncStatusText}`;


            const deleteButton = document.createElement('button');
            deleteButton.textContent = 'মুছুন';
            deleteButton.className = 'delete-btn';
            // ডিলিটের জন্য লোকাল আইডি অথবা Firebase আইডি ব্যবহার করতে হবে
            deleteButton.setAttribute('data-id', entry.id); // লোকাল আইডি
            if(entry.firebaseId) deleteButton.setAttribute('data-firebase-id', entry.firebaseId);


            deleteButton.addEventListener('click', async () => {
                const localEntryId = parseInt(deleteButton.getAttribute('data-id'));
                const firebaseEntryId = deleteButton.getAttribute('data-firebase-id');

                if (confirm('আপনি কি এই এন্ট্রিটি মুছে ফেলতে চান?')) {
                    try {
                        // প্রথমে লোকাল DB থেকে ডিলিট
                        if(!isNaN(localEntryId)) await deleteEntry(localEntryId); // db.js থেকে

                        // তারপর Firebase থেকে ডিলিট (যদি Firebase ID থাকে এবং অনলাইন থাকে)
                        if (firebaseEntryId && navigator.onLine && window.dbFirestore && window.fb) {
                            await window.fb.deleteDoc(window.fb.doc(window.dbFirestore, "entries", firebaseEntryId));
                            console.log("Entry deleted from Firebase:", firebaseEntryId);
                        } else if (firebaseEntryId && !navigator.onLine) {
                            // অফলাইনে ডিলিটের জন্য বিশেষ হ্যান্ডলিং লাগতে পারে
                            // যেমন, লোকালি 'deleted:true' মার্ক করে রাখা এবং অনলাইনে এলে Firebase থেকে ডিলিট করা
                            console.log("Offline, cannot delete from Firebase now. Will sync deletion later (feature not implemented).");
                        }
                        loadAndDisplayEntries(); // তালিকা রিফ্রেশ
                    } catch (error) {
                        console.error('Failed to delete entry:', error);
                        alert('এন্ট্রি মুছতে সমস্যা হয়েছে।');
                    }
                }
            });

            listItem.appendChild(entryDetails);
            listItem.appendChild(deleteButton);
            entriesList.appendChild(listItem);
        });
    }

    // ... (updateSummary ফাংশন আগের মতোই থাকবে) ...
    function updateSummary(entries) {
        let totalIncome = 0;
        let totalExpense = 0;

        entries.forEach(entry => {
            if (entry.type === 'income') {
                totalIncome += entry.amount;
            } else if (entry.type === 'expense') {
                totalExpense += entry.amount;
            }
        });

        const balance = totalIncome - totalExpense;

        totalIncomeEl.textContent = totalIncome.toFixed(2);
        totalExpenseEl.textContent = totalExpense.toFixed(2);
        balanceEl.textContent = balance.toFixed(2);
    }


    // অনলাইন/অফলাইন স্ট্যাটাস পরিবর্তন হলে সিঙ্ক করার চেষ্টা
    window.addEventListener('online', () => {
        console.log("Device is online. Attempting to sync...");
        loadAndDisplayEntries(); // অনলাইন হলে ডেটা লোড ও সিঙ্ক করার চেষ্টা
    });
    window.addEventListener('offline', () => {
        console.log("Device is offline.");
        // অফলাইন হলে শুধু লোকাল ডেটা দেখাবে, loadAndDisplayEntries এটা হ্যান্ডেল করবে
    });


    // সার্ভিস ওয়ার্কার রেজিস্ট্রেশন (আগের মতোই)
    if ('serviceWorker' in navigator) {
        // ... আপনার রিপোজিটরির নাম অনুযায়ী পাথ ঠিক করুন ...
        const repoName = '/YOUR_REPO_NAME_IF_ANY'; // যেমন '/jama-khoroch-pwa' অথবা খালি স্ট্রিং যদি রুটে থাকে
        let swPath = repoName + '/service-worker.js';
        let swScope = repoName + '/';
        if (location.hostname === 'localhost' || location.hostname === '127.0.0.1' || location.hostname.endsWith('github.io')) { // অথবা আপনার প্রোডাকশন ডোমেইন
             // GitHub Pages-এর ক্ষেত্রে ইউজার পেজ (username.github.io) হলে repoName খালি হবে
             // এবং প্রজেক্ট পেজ (username.github.io/repo-name) হলে repoName হবে '/repo-name'
             // এটি সঠিকভাবে নির্ধারণ করতে হবে
            if (location.pathname.split('/')[1] && location.hostname.endsWith('github.io') && !location.hostname.startsWith(location.pathname.split('/')[1])) {
                 // যদি pbappy.github.io/repo-name/ হয়
                 const pathSegments = location.pathname.split('/');
                 const inferredRepoName = '/' + pathSegments[1];
                 swPath = inferredRepoName + '/service-worker.js';
                 swScope = inferredRepoName + '/';
            } else if (location.hostname.endsWith('github.io') && location.pathname === '/') {
                // যদি pbappy.github.io/ হয় (রিপোজিটরির নাম username.github.io)
                swPath = '/service-worker.js';
                swScope = '/';
            } else { // localhost এর জন্য
                swPath = '/service-worker.js';
                swScope = '/';
            }
        }

        window.addEventListener('load', () => {
            navigator.serviceWorker.register(swPath, { scope: swScope })
                .then(registration => {
                    console.log('ServiceWorker registration successful with scope: ', registration.scope);
                })
                .catch(error => {
                    console.log('ServiceWorker registration failed: ', error);
                });
        });
    }

}); // End of DOMContentLoaded
