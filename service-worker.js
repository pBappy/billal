// service-worker.js

const CACHE_NAME = 'jama-khoroch-cache-v1'; // ক্যাশের নাম, ভার্সন পরিবর্তনের জন্য এটি পরিবর্তন করতে পারেন
const URLS_TO_CACHE = [
    '/', // রুট পাথ, সাধারণত index.html কে বোঝায়
    '/index.html',
    '/style.css',
    '/app.js',
    '/db.js',
    '/manifest.json',
    '/icons/icon-192x192.png',
    '/icons/icon-512x512.png'
    // আপনি যদি আরও কোনো অ্যাসেট (যেমন ফন্ট, অন্যান্য ছবি) ব্যবহার করেন, সেগুলোও এখানে যোগ করুন
];

// ইন্সটল ইভেন্ট: সার্ভিস ওয়ার্কার যখন প্রথমবার ইন্সটল হয় বা আপডেট হয়
self.addEventListener('install', (event) => {
    console.log('Service Worker: Installing...');
    event.waitUntil(
        caches.open(CACHE_NAME) // আমাদের নামে একটি ক্যাশ স্টোরেজ খুলি
            .then((cache) => {
                console.log('Service Worker: Caching app shell (core files)');
                return cache.addAll(URLS_TO_CACHE); // নির্দিষ্ট ফাইলগুলো ক্যাশে যোগ করি
            })
            .then(() => {
                console.log('Service Worker: App shell cached successfully');
                return self.skipWaiting(); // নতুন সার্ভিস ওয়ার্কারকে দ্রুত সক্রিয় করার জন্য (যদি পুরনো একটি থাকে)
            })
            .catch(error => {
                console.error('Service Worker: Failed to cache app shell:', error);
            })
    );
});

// অ্যাক্টিভেট ইভেন্ট: যখন সার্ভিস ওয়ার্কার সক্রিয় হয়
self.addEventListener('activate', (event) => {
    console.log('Service Worker: Activating...');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    // যদি কোনো পুরনো ক্যাশ থাকে (যার নাম আমাদের বর্তমান CACHE_NAME এর সাথে মেলে না), সেটি ডিলিট করে দিই
                    if (cacheName !== CACHE_NAME) {
                        console.log('Service Worker: Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            console.log('Service Worker: Activated successfully and old caches cleaned.');
            return self.clients.claim(); // নতুন সার্ভিস ওয়ার্কারকে বর্তমান ক্লায়েন্টদের নিয়ন্ত্রণ নিতে বলি
        })
    );
});

// ফেচ ইভেন্ট: ব্রাউজার যখন কোনো রিসোর্স (যেমন HTML, CSS, JS, ছবি, API কল) রিকোয়েস্ট করে
self.addEventListener('fetch', (event) => {
    // console.log('Service Worker: Fetching ', event.request.url);

    // আমরা শুধু GET রিকোয়েস্টগুলো ক্যাশ করতে চাই
    if (event.request.method !== 'GET') {
        return;
    }

    // API কলগুলো বা Firebase সংক্রান্ত রিকোয়েস্টগুলো নেটওয়ার্ক থেকে আনার চেষ্টা করব, ক্যাশ থেকে নয়
    // (এই অংশটি Firebase ইন্টিগ্রেশনের সময় আরও উন্নত করা যেতে পারে)
    if (event.request.url.includes('firestore.googleapis.com')) {
         // console.log('Service Worker: Skipping cache for API call:', event.request.url);
        event.respondWith(fetch(event.request));
        return;
    }


    event.respondWith(
        caches.match(event.request) // প্রথমে ক্যাশে খুঁজি রিকোয়েস্ট করা রিসোর্সটি আছে কিনা
            .then((response) => {
                if (response) {
                    // console.log('Service Worker: Serving from cache:', event.request.url);
                    return response; // যদি ক্যাশে পাওয়া যায়, সেটি রিটার্ন করি
                }
                // console.log('Service Worker: Not in cache, fetching from network:', event.request.url);
                return fetch(event.request) // যদি ক্যাশে না পাওয়া যায়, নেটওয়ার্ক থেকে আনার চেষ্টা করি
                    .then(networkResponse => {
                        // সফলভাবে নেটওয়ার্ক থেকে পেলে, সেটি ক্যাশেও সেভ করে রাখি ভবিষ্যতের জন্য
                        if (networkResponse && networkResponse.status === 200) {
                            const responseToCache = networkResponse.clone();
                            caches.open(CACHE_NAME)
                                .then(cache => {
                                    cache.put(event.request, responseToCache);
                                });
                        }
                        return networkResponse;
                    });
            })
            .catch(error => {
                // যদি নেটওয়ার্ক থেকেও না পাওয়া যায় (যেমন অফলাইন এবং ক্যাশেও নেই)
                console.error('Service Worker: Fetch error:', error);
                // এখানে একটি কাস্টম অফলাইন পেজ দেখানো যেতে পারে, যদি থাকে
                // return caches.match('/offline.html');
            })
    );
});
