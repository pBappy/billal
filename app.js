// app.js - Main application logic

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const entryForm = document.getElementById('entryForm');
    const descriptionInput = document.getElementById('description');
    const amountInput = document.getElementById('amount');
    const typeInput = document.getElementById('type');
    const entriesList = document.getElementById('entriesList');
    const totalIncomeEl = document.getElementById('totalIncome');
    const totalExpenseEl = document.getElementById('totalExpense');
    const balanceEl = document.getElementById('balance');

    // Initial load of entries
    loadAndDisplayEntries();

    // Event listener for form submission
    entryForm.addEventListener('submit', async (event) => {
        event.preventDefault(); // Prevent default form submission

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
            type
        };

        try {
            await addEntry(newEntry); // db.js থেকে addEntry ফাংশন কল
            console.log('New entry added to DB via app.js');
            entryForm.reset(); // ফর্ম রিসেট করি
            loadAndDisplayEntries(); // তালিকা রিফ্রেশ করি
        } catch (error) {
            console.error('Failed to add entry via app.js:', error);
            alert('এন্ট্রি যোগ করতে সমস্যা হয়েছে।');
        }
    });

    /**
     * Loads entries from IndexedDB and displays them in the list.
     * Also updates the summary (total income, expense, balance).
     */
    async function loadAndDisplayEntries() {
        try {
            const entries = await getAllEntries(); // db.js থেকে getAllEntries ফাংশন কল
            renderEntriesList(entries);
            updateSummary(entries);
        } catch (error) {
            console.error('Failed to load entries:', error);
            entriesList.innerHTML = '<li>এন্ট্রি লোড করতে সমস্যা হয়েছে।</li>';
        }
    }

    /**
     * Renders the list of entries in the UI.
     * @param {Array<object>} entries - Array of entry objects.
     */
    function renderEntriesList(entries) {
        entriesList.innerHTML = ''; // আগের তালিকা মুছে ফেলি

        if (entries.length === 0) {
            entriesList.innerHTML = '<li>এখনো কোনো এন্ট্রি নেই।</li>';
            return;
        }

        entries.forEach(entry => {
            const listItem = document.createElement('li');
            listItem.className = entry.type === 'income' ? 'income-item' : 'expense-item';

            const entryDetails = document.createElement('span');
            entryDetails.textContent = `${entry.description}: ${entry.amount.toFixed(2)} টাকা (${new Date(entry.timestamp).toLocaleDateString('bn-BD')})`;

            const deleteButton = document.createElement('button');
            deleteButton.textContent = 'মুছুন';
            deleteButton.className = 'delete-btn';
            deleteButton.setAttribute('data-id', entry.id); // ডিলিট করার জন্য id রাখি

            deleteButton.addEventListener('click', async () => {
                const entryId = parseInt(deleteButton.getAttribute('data-id'));
                if (confirm('আপনি কি এই এন্ট্রিটি মুছে ফেলতে চান?')) {
                    try {
                        await deleteEntry(entryId); // db.js থেকে deleteEntry ফাংশন কল
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

    /**
     * Updates the summary section (total income, total expense, balance).
     * @param {Array<object>} entries - Array of entry objects.
     */
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

    // Service Worker Registration (আমরা এটি পরে service-worker.js তৈরি করার পর আনকমেন্ট করব)
    if ('serviceWorker' in navigator) {
         window.addEventListener('load', () => {
             navigator.serviceWorker.register('./service-worker.js', { scope: './' })
                 .then(registration => {
                     console.log('ServiceWorker registration successful with scope: ', registration.scope);
                 })
                 .catch(error => {
                     console.log('ServiceWorker registration failed: ', error);
                 });
         });
     }

}); // End of DOMContentLoaded
