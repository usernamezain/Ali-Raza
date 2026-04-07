// --- FIREBASE INITIALIZATION ---
let db = null;
let isFirebaseEnabled = false;

function initFirebase(config) {
    if (!config || !config.apiKey || config.apiKey === "YOUR_API_KEY") return;
    
    try {
        if (firebase.apps.length === 0) {
            firebase.initializeApp(config);
            db = firebase.firestore();
            
            // Enable Offline Persistence for Firestore
            db.enablePersistence().catch((err) => {
                if (err.code == 'failed-precondition') {
                    console.warn("Persistence failed: Multiple tabs open");
                } else if (err.code == 'unimplemented') {
                    console.warn("Persistence not supported by browser");
                }
            });

            isFirebaseEnabled = true;
            console.log("Firebase initialized with persistence");
        }
    } catch (err) {
        console.error("Firebase Init Error:", err);
    }
}

// Load initial config from localStorage if exists
const tempSettings = JSON.parse(localStorage.getItem('arkpos_settings')) || {};
if (tempSettings.firebaseConfig) {
    initFirebase(tempSettings.firebaseConfig);
}


const i18n = {
    en: {
        app_title: "Ali Raza Kiryana",
        nav_home: "Home",
        nav_billing: "Billing",
        nav_inventory: "Inventory",
        nav_khata: "Khata",
        nav_settings: "Settings",
        today_collect: "Today's Collection",
        quick_actions: "Quick Actions",
        create_bill: "Create Bill",
        add_product: "Add Product",
        reminders: "Upcoming Reminders",
        no_reminders: "No reminders set.",
        search_items: "Search items...",
        add_new_prod: "+ Add New Product",
        low_stock: "Low Stock",
        in_stock: "In Stock",
        out_of_stock: "Out of Stock",
        items: "Items",
        total: "Total",
        paid: "Paid",
        balance: "Balance",
        save_gen_bill: "Save & Generate Bill",
        search_cust: "Search customer by name or #...",
        lang_toggle: "English / Urdu",
        dark_mode: "Dark Mode",
        backup_restore: "Backup & Restore",
        export_json: "Export JSON",
        import_json: "Import JSON",
        store_info: "Store Info",
        save_settings: "Save Settings",
        invoice_title: "Invoice #",
        share_whatsapp: "Share WhatsApp",
        whatsapp_ur: "WhatsApp (Urdu)",
        walkin: "Walk-in Customer",
        nav_history: "History"
    },
    ur: {
        app_title: "علی رضا کریانہ",
        nav_home: "ہوم",
        nav_billing: "بلنگ",
        nav_inventory: "انونٹری",
        nav_khata: "خاتہ",
        nav_settings: "سیٹنگز",
        today_collect: "آج کی وصولی",
        quick_actions: "فوری کام",
        create_bill: "بل بنائیں",
        add_product: "پروڈکٹ شامل کریں",
        reminders: "یاد دہانیاں",
        no_reminders: "کوئی یاد دہانی نہیں۔",
        search_items: "تلاش کریں...",
        add_new_prod: "+ نئی پروڈکٹ",
        low_stock: "اسٹاک کم ہے",
        in_stock: "اسٹاک میں ہے",
        out_of_stock: "اسٹاک ختم",
        items: "سامان",
        total: "کل رقم",
        paid: "ادا شدہ",
        balance: "باقایا",
        save_gen_bill: "بل محفوظ کریں",
        search_cust: "گاہک تلاش کریں...",
        lang_toggle: "انگریزی / اردو",
        dark_mode: "ڈارک موڈ",
        backup_restore: "بیک اپ",
        export_json: "برآمد کریں",
        import_json: "درآمد کریں",
        store_info: "سٹور کی معلومات",
        save_settings: "محفوظ کریں",
        invoice_title: "انوائس نمبر #",
        share_whatsapp: "واٹس ایپ شیئر",
        whatsapp_ur: "واٹس ایپ (اردو)",
        walkin: "عام گاہک",
        nav_history: "تاریخ"
    }
};

/**
 * Ali Raza Kiryana Store POS - Core Application Logic
 */

// --- STATE MANAGEMENT (Store) ---
class Store {
    constructor() {
        this.prefix = 'arkpos_';
        this.init();
        if (isFirebaseEnabled) {
            this.syncWithCloud();
        }
    }

    init() {
        if (!localStorage.getItem(this.prefix + 'products')) {
            const sampleProducts = [
                { id: '1', name: 'Coke Cola', category: 'Beverages', variants: [{size: '1.5L', price: 200, stock: 50, minStock: 5, barcode: '123456'}] },
                { id: '2', name: 'Lays Masala', category: 'Snacks', variants: [{size: 'Small', price: 30, stock: 100, minStock: 10, barcode: '789012'}] }
            ];
            localStorage.setItem(this.prefix + 'products', JSON.stringify(sampleProducts));
        }

        let prods = JSON.parse(localStorage.getItem(this.prefix + 'products')) || [];
        let updated = false;
        prods.forEach(p => {
            p.variants.forEach(v => {
                if (v.stock === undefined) { v.stock = 99; updated = true; }
                if (v.minStock === undefined) { v.minStock = 5; updated = true; }
                if (v.barcode === undefined) { v.barcode = ''; updated = true; }
            });
        });
        if (updated) localStorage.setItem(this.prefix + 'products', JSON.stringify(prods));

        if (!localStorage.getItem(this.prefix + 'customers')) {
            localStorage.setItem(this.prefix + 'customers', JSON.stringify([]));
        }
        if (!localStorage.getItem(this.prefix + 'bills')) {
            localStorage.setItem(this.prefix + 'bills', JSON.stringify([]));
        }
        if (!localStorage.getItem(this.prefix + 'reminders')) {
            localStorage.setItem(this.prefix + 'reminders', JSON.stringify([
                { id: 'r1', text: 'Get payment from Aslam Shop', time: new Date(Date.now() + 86400000).toISOString() }
            ]));
        }
        if (!localStorage.getItem(this.prefix + 'settings')) {
            localStorage.setItem(this.prefix + 'settings', JSON.stringify({
                theme: 'light',
                lang: 'en',
                storeName: 'Ali Raza Kiryana Store',
                address: 'Main Bazaar, Pakistan',
                lastBackup: Date.now()
            }));
        }
        
        if (!localStorage.getItem(this.prefix + 'categories')) {
            const defaultCats = ['Grocery & Staples', 'Beverages', 'Snacks', 'Dairy', 'Personal Care', 'HouseHold', 'Spices', 'Chawals', 'Sugar & Salt', 'Dall'];
            localStorage.setItem(this.prefix + 'categories', JSON.stringify(defaultCats));
        }
    }

    get(key) {
        return JSON.parse(localStorage.getItem(this.prefix + key));
    }

    save(key, data) {
        localStorage.setItem(this.prefix + key, JSON.stringify(data));
        
        // Sync to Cloud
        if (isFirebaseEnabled && db) {
            db.collection("pos_data").doc(key).set({
                data: JSON.stringify(data),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }).catch(err => {
                console.error("Cloud Save Error:", err);
                // Persistence handles offline, but we log the error
            });
        }
    }

    async syncWithCloud() {
        if (!isFirebaseEnabled || !db) return;
        
        console.log("Syncing with cloud...");
        try {
            const snapshot = await db.collection("pos_data").get();
            if (snapshot.empty) {
                console.log("No cloud data found to sync.");
                return;
            }

            snapshot.forEach(doc => {
                const key = doc.id;
                const cloudData = JSON.parse(doc.data().data);
                const localData = JSON.parse(localStorage.getItem(this.prefix + key));

                // Basic merge: if local doesn't exist, use cloud.
                // In a real app, you'd compare updatedAt timestamps.
                if (!localData) {
                    localStorage.setItem(this.prefix + key, JSON.stringify(cloudData));
                }
            });
            console.log("Cloud sync complete");
        } catch (err) {
            console.error("Cloud Sync Error:", err);
            throw err; // Propagate to UI for toast
        }
    }


    // Products
    addProduct(product) {
        const products = this.get('products');
        product.id = Date.now().toString();
        products.push(product);
        this.save('products', products);
        return product;
    }

    updateProduct(id, updatedProduct) {
        const products = this.get('products');
        const index = products.findIndex(p => p.id === id);
        if (index !== -1) {
            products[index] = { ...products[index], ...updatedProduct };
            this.save('products', products);
        }
    }

    addCategory(name) {
        const cats = this.get('categories');
        if (!cats.includes(name)) {
            cats.push(name);
            this.save('categories', cats);
        }
    }

    deleteCategory(name) {
        let cats = this.get('categories');
        cats = cats.filter(c => c !== name);
        this.save('categories', cats);
    }

    // Customers & Khata
    getOrCreateCustomer(name, number, address = '') {
        const customers = this.get('customers');
        let customer = customers.find(c => c.number === number);
        if (!customer) {
            customer = {
                id: Date.now().toString(),
                name,
                number,
                address,
                khata: [],
                totalDue: 0
            };
            customers.push(customer);
        } else {
            // Update address if it was empty
            if (!customer.address && address) customer.address = address;
        }
        this.save('customers', customers);
        return customer;
    }

    addKhataEntry(customerId, entry) {
        const customers = this.get('customers');
        const index = customers.findIndex(c => c.id === customerId);
        if (index !== -1) {
            entry.id = Date.now();
            entry.date = new Date().toISOString();
            customers[index].khata.push(entry);
            // Re-calculate total due
            customers[index].totalDue += (entry.amount || 0);
            this.save('customers', customers);
        }
    }
    
    // Bills
    saveBill(bill) {
        const bills = this.get('bills');
        bill.id = 'BILL-' + Date.now();
        bill.date = new Date().toISOString();
        bills.push(bill);
        this.save('bills', bills);
        return bill;
    }

    seedFullInventory() {
        const categories = {
            'Groceries': [
                { n: 'Sugar (Cheeni)', s: '1 KG', p: 150 },
                { n: 'Salt (National)', s: '800g', p: 50 },
                { n: 'Flour (Aata)', s: '10 KG', p: 1200 },
                { n: 'Flour (Aata)', s: '20 KG', p: 2350 },
                { n: 'Dalda Ghee', s: '1 KG', p: 540 },
                { n: 'Dalda Ghee', s: '5 KG', p: 2600 },
                { n: 'Dalda Cooking Oil', s: '1 Ltr', p: 560 },
                { n: 'Sufi Ghee', s: '1 KG', p: 520 },
                { n: 'Sufi Oil', s: '1 Ltr', p: 540 },
                { n: 'Banaspatri Ghee', s: '1 KG', p: 480 }
            ],
            'Pulses & Grains': [
                { n: 'Dall Chana', s: '1 KG', p: 260, w: true },
                { n: 'Dall Mash', s: '1 KG', p: 520, w: true },
                { n: 'Dall Moong', s: '1 KG', p: 280, w: true },
                { n: 'Dall Masoor', s: '1 KG', p: 310, w: true },
                { n: 'Kala Chana', s: '1 KG', p: 240, w: true },
                { n: 'Safaid Chana', s: '1 KG', p: 380, w: true },
                { n: 'Lobia', s: '1 KG', p: 360, w: true },
                { n: 'Rice Super Basmati', s: '1 KG', p: 340, w: true },
                { n: 'Rice Kernal', s: '1 KG', p: 380, w: true },
                { n: 'Rice Tota', s: '1 KG', p: 180, w: true },
                { n: 'Rice IRRI-6', s: '1 KG', p: 160, w: true },
                { n: 'Besan', s: '1 KG', p: 280, w: true },
                { n: 'Maida', s: '1 KG', p: 140, w: true },
                { n: 'Suji', s: '1 KG', p: 150, w: true }
            ],
            'Beverages': [
                { n: 'Coke', s: '250ml', p: 50 },
                { n: 'Coke', s: '500ml', p: 90 },
                { n: 'Coke', s: '1.5L', p: 180 },
                { n: 'Pepsi', s: '250ml', p: 50 },
                { n: 'Pepsi', s: '500ml', p: 90 },
                { n: 'Pepsi', s: '1.5L', p: 180 },
                { n: '7Up', s: '1.5L', p: 180 },
                { n: 'Dew', s: '1.5L', p: 190 },
                { n: 'String', s: '250ml', p: 60 },
                { n: 'Gourmet Cola', s: '1.5L', p: 120 },
                { n: 'Rooh Afza', s: '800ml', p: 450 },
                { n: 'Jam-e-Shirin', s: '800ml', p: 440 },
                { n: 'Tang Orange', s: '500g', p: 650 },
                { n: 'Tang Lemon', s: '500g', p: 650 },
                { n: 'Nestle Milkpak', s: '1 Ltr', p: 270 },
                { n: 'Nestle Milkpak', s: '250ml', p: 80 },
                { n: 'Olpers Milk', s: '1 Ltr', p: 270 },
                { n: 'Everyday Power', s: '1 KG', p: 1650 },
                { n: 'Everyday', s: 'Small Sachet', p: 40 },
                { n: 'Nido', s: '390g', p: 1100 }
            ],
            'Tea & Coffee': [
                { n: 'Tapal Danedar', s: '430g', p: 950 },
                { n: 'Tapal Danedar', s: '190g', p: 480 },
                { n: 'Lipton Yellow Label', s: '430g', p: 1100 },
                { n: 'Vital Tea', s: '430g', p: 850 },
                { n: 'Nescafe Classic', s: '50g', p: 550 },
                { n: 'Nescafé 3in1', s: 'Sachet', p: 60 }
            ],
            'Snacks & Biscuits': [
                { n: 'Lays Masala', s: 'Medium', p: 50 },
                { n: 'Lays Salted', s: 'Medium', p: 50 },
                { n: 'Kurkure Chutney', s: 'Large', p: 100 },
                { n: 'Slanty Vegetable', s: 'Medium', p: 50 },
                { n: 'Sooper Biscuits', s: 'Half Roll', p: 60 },
                { n: 'Sooper Biscuits', s: 'Family Pack', p: 150 },
                { n: 'Gala Biscuits', s: 'Half Roll', p: 50 },
                { n: 'Prince Biscuits', s: 'Half Roll', p: 70 },
                { n: 'Rio Biscuits', s: 'Tiki Pack', p: 30 },
                { n: 'Tiger Biscuits', s: 'Tiki Pack', p: 20 },
                { n: 'Candy Biscuits', s: 'Half Roll', p: 60 },
                { n: ' Tuc Biscuits', s: 'Half Roll', p: 60 },
                { n: 'Nimko Mix', s: '500g', p: 250 },
                { n: 'Peanuts', s: '250g', p: 200 }
            ],
            'Spices (Masalay)': [
                { n: 'Shan Biryani Masala', s: 'Pack', p: 120 },
                { n: 'Shan Bombay Biryani', s: 'Pack', p: 130 },
                { n: 'Shan Korma Masala', s: 'Pack', p: 120 },
                { n: 'Shan Nihari Masala', s: 'Pack', p: 130 },
                { n: 'Shan Tikka Masala', s: 'Pack', p: 120 },
                { n: 'National Biryani Masala', s: 'Pack', p: 110 },
                { n: 'National Chat Masala', s: 'Pack', p: 100 },
                { n: 'Red Chilli Powder', s: '100g', p: 180 },
                { n: 'Turmeric (Haldi)', s: '100g', p: 100 },
                { n: 'Coriander (Dhania)', s: '100g', p: 90 },
                { n: 'Garam Masala Mix', s: '100g', p: 250 },
                { n: 'Black Pepper', s: '50g', p: 150 },
                { n: 'Ginger Powder', s: '50g', p: 180 },
                { n: 'Garlic Powder', s: '50g', p: 180 }
            ],
            'Laundry & Cleaning': [
                { n: 'Surf Excel', s: '1 KG', p: 650 },
                { n: 'Arial', s: '1 KG', p: 680 },
                { n: 'Brite', s: '1 KG', p: 580 },
                { n: 'Bonus Tristar', s: '1 KG', p: 450 },
                { n: 'Vim Bar', s: 'Small', p: 40 },
                { n: 'Vim Bar', s: 'Large', p: 100 },
                { n: 'Vim Liquid', s: '500ml', p: 350 },
                { n: 'Max Bar', s: 'Large', p: 90 },
                { n: 'Robin Neel', s: 'Small', p: 50 },
                { n: 'Harpic', s: '500ml', p: 420 },
                { n: 'Dettol Surface Cleaner', s: '500ml', p: 550 }
            ],
            'Personal Care': [
                { n: 'Lifebuoy Soap', s: 'Standard', p: 110 },
                { n: 'Lux Soap', s: 'Standard', p: 140 },
                { n: 'Safeguard Soap', s: 'Standard', p: 150 },
                { n: 'Dettol Soap', s: 'Standard', p: 160 },
                { n: 'Sunsilk Shampoo', s: '180ml', p: 450 },
                { n: 'Sunsilk Shampoo', s: 'Sachet', p: 10 },
                { n: 'Pantene Shampoo', s: '180ml', p: 500 },
                { n: 'Head & Shoulders', s: '180ml', p: 550 },
                { n: 'Colgate Toothpaste', s: '100g', p: 220 },
                { n: 'Close-up', s: '100g', p: 200 },
                { n: 'Sensodyne', s: '75g', p: 450 },
                { n: 'Fair & Lovely', s: '50g', p: 350 },
                { n: 'Tibet Snow', s: 'Standard', p: 200 }
            ]
        };

        // Add 100 more items (variations) to reach ~200
        const brands = ['Nestle', 'National', 'Shan', 'Dalda', 'Sufi', 'Tang', 'Tapal', 'Lipton', 'Pepsi', 'Coke', 'Lays', 'Kurkure', 'Sooper', 'Lifebuoy', 'Lux', 'SafeGuard', 'Arial', 'Surf Excel'];
        const types = ['Regular', 'Premium', 'Special', 'Saver Pack', 'Value Pack', 'Small', 'Large', 'Extra', 'Family', 'Mini'];

        const productsGrouped = {};
        let idCount = 1000;

        for (let cat in categories) {
            categories[cat].forEach(item => {
                if (!productsGrouped[item.n]) {
                    productsGrouped[item.n] = {
                        id: (idCount++).toString(),
                        name: item.n,
                        category: cat,
                        isWeighted: item.w || false,
                        variants: []
                    };
                }
                productsGrouped[item.n].variants.push({
                    size: item.s,
                    price: item.p,
                    stock: Math.floor(Math.random() * 50) + 50,
                    minStock: 5,
                    barcode: (Math.floor(100000 + Math.random() * 900000)).toString()
                });
            });
        }

        let products = Object.values(productsGrouped);

        // Fill up to ~200 items by adding more variants or related products
        while (products.length < 150) {
            const base = products[Math.floor(Math.random() * products.length)];
            const brand = brands[Math.floor(Math.random() * brands.length)];
            const newName = `${brand} ${base.name}`;
            if (!productsGrouped[newName]) {
                products.push({
                    id: (idCount++).toString(),
                    name: newName,
                    category: base.category,
                    isWeighted: base.isWeighted,
                    variants: [{
                        size: base.variants[0].size,
                        price: base.variants[0].price + (Math.floor(Math.random() * 20) - 10),
                        stock: 50,
                        minStock: 5,
                        barcode: (Math.floor(100000 + Math.random() * 900000)).toString()
                    }]
                });
            }
        }

        this.save('products', products);
        this.save('categories', Object.keys(categories));
    }
}


const store = new Store();

// --- UI CONTROLLER & ROUTER ---
const UI = {
    currentView: 'home',
    cart: [],
    
    init() {
        this.cart = store.get('cart') || [];
        this.bindEvents();
        this.applySettings();
        this.renderView('home');
    },

    saveCartState() {
        store.save('cart', this.cart);
    },

    t(key) {
        const settings = store.get('settings');
        const lang = settings.lang || 'en';
        if (key === 'app_title' && settings && settings.storeName) {
            return settings.storeName;
        }
        return i18n[lang][key] || key;
    },

    applySettings() {
        const settings = store.get('settings');
        if (settings.theme === 'dark') document.body.classList.add('theme-dark');
        if (settings.lang === 'ur') document.body.classList.add('rtl');
        
        // Translate static elements
        document.querySelectorAll('[data-i18n]').forEach(el => {
            el.innerText = this.t(el.dataset.i18n);
        });
    },

    bindEvents() {
        document.querySelectorAll('.nav-item').forEach(btn => {
            btn.addEventListener('click', () => {
                const view = btn.dataset.view;
                this.renderView(view);
                
                document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });

        document.getElementById('lang-toggle').addEventListener('click', () => {
            const settings = store.get('settings');
            settings.lang = settings.lang === 'en' ? 'ur' : 'en';
            store.save('settings', settings);
            
            if (settings.lang === 'ur') document.body.classList.add('rtl');
            else document.body.classList.remove('rtl');
            
            this.applySettings();
            this.renderView(this.currentView);
            this.showToast(settings.lang === 'ur' ? 'اردو زبان منتخب' : 'English Selected');
        });

        document.getElementById('header-scan').addEventListener('click', () => {
            this.startScanner('bill');
        });

        document.querySelector('.close-modal')?.addEventListener('click', () => this.hideModal());
        
        // Notification permission
        document.getElementById('notification-btn').addEventListener('click', () => {
            if (Notification.permission !== 'granted') {
                Notification.requestPermission().then(permission => {
                    if (permission === 'granted') this.showToast('Notifications enabled!');
                });
            } else {
                this.showToast('Notifications already enabled');
            }
        });
    },

    renderView(view) {
        this.currentView = view;
        const main = document.getElementById('main-view');
        const title = document.getElementById('view-title');
        
        main.innerHTML = ''; // Clear
        
        // Backup Reminder Check
        this.checkBackupStatus();

        switch(view) {
            case 'home':
                title.innerText = this.t('app_title');
                this.renderHome(main);
                break;
            case 'billing':
                title.innerText = this.t('nav_billing');
                this.renderBilling(main);
                break;
            case 'products':
                title.innerText = this.t('nav_inventory');
                this.renderProducts(main);
                break;
            case 'khata':
                title.innerText = this.t('nav_khata');
                this.renderKhata(main);
                break;
            case 'settings':
                title.innerText = this.t('nav_settings');
                this.renderSettings(main);
                break;
            case 'history':
                title.innerText = this.t('nav_history');
                this.renderHistory(main);
                break;
        }
    },

    checkBackupStatus() {
        const settings = store.get('settings');
        const diff = Date.now() - settings.lastBackup;
        if (diff > 7 * 24 * 60 * 60 * 1000) {
            const banner = document.createElement('div');
            banner.className = 'card';
            banner.style.background = 'var(--warning)';
            banner.style.color = 'white';
            banner.style.marginBottom = '1rem';
            banner.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> ${this.t('lang') === 'ur' ? 'بیک اپ لیے ہوئے 7 دن ہو گئے ہیں۔' : 'Last backup was over 7 days ago.'} <button onclick="UI.exportData()" style="background:white; color:var(--warning); border:none; padding:2px 8px; border-radius:4px; font-weight:700;">Backup Now</button>`;
            document.getElementById('main-view').prepend(banner);
        }
    },

    // --- VIEW RENDERERS ---

    renderHome(container) {
        const bills = store.get('bills');
        const todayPrice = bills.filter(b => new Date(b.date).toDateString() === new Date().toDateString())
                                .reduce((acc, b) => acc + (b.paid || 0), 0);

        container.innerHTML = `
            <div class="card" style="background: linear-gradient(135deg, var(--primary), var(--info)); color: white; border: none;">
                <p style="font-size: 0.9rem; opacity: 0.9;">Today's Collection</p>
                <h2 style="font-size: 2.5rem; margin: 0.5rem 0;">Rs. ${todayPrice}</h2>
                <p style="font-size: 0.8rem;">Total Sales ${bills.length}</p>
            </div>
            
            <div class="section-title" style="margin: 1.5rem 0 1rem; font-weight: 700;">Quick Actions</div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                <div class="card" onclick="UI.renderView('billing')" style="text-align: center; cursor: pointer;">
                    <i class="fa-solid fa-plus-circle" style="font-size: 2rem; color: var(--success); margin-bottom: 0.5rem;"></i>
                    <p style="font-weight: 600;">Create Bill</p>
                </div>
                <div class="card" onclick="UI.renderView('history')" style="text-align: center; cursor: pointer;">
                    <i class="fa-solid fa-clock-rotate-left" style="font-size: 2rem; color: var(--warning); margin-bottom: 0.5rem;"></i>
                    <p style="font-weight: 600;">Sales History</p>
                </div>
            </div>

            <div class="section-title" style="margin: 1.5rem 0 1rem; font-weight: 700; display:flex; justify-content:space-between; align-items:center;">
                <span>Upcoming Reminders</span>
                <button class="icon-btn" onclick="UI.showAddReminder()" style="width:30px; height:30px;"><i class="fa-solid fa-plus"></i></button>
            </div>
            <div id="reminders-list">
                ${this.getRemindersHTML()}
            </div>
        `;
    },

    showAddReminder() {
        this.showModal('Add Reminder', `
            <div class="form-group">
                <label>Reminder Note</label>
                <input type="text" id="rem-text" class="form-input" placeholder="Collect payment...">
            </div>
            <div class="form-group">
                <label>Time</label>
                <input type="datetime-local" id="rem-time" class="form-input">
            </div>
            <button class="btn-primary" onclick="UI.saveReminder()">Set Reminder</button>
        `);
    },

    saveReminder() {
        const text = document.getElementById('rem-text').value;
        const time = document.getElementById('rem-time').value;
        if (!text || !time) return;

        const reminders = store.get('reminders');
        reminders.push({ id: Date.now().toString(), text, time, completed: false });
        store.save('reminders', reminders);
        
        this.hideModal();
        this.renderView('home');
        this.showToast('Reminder Set!');
        
        // Schedule notification
        const diff = new Date(time).getTime() - Date.now();
        if (diff > 0) {
            setTimeout(() => {
                new Notification('Kiryana Reminder', { body: text });
            }, diff);
        }
    },

    renderHistory(container) {
        const bills = store.get('bills').slice().reverse();
        container.innerHTML = `
            <div class="section-title" style="display:flex; justify-content:space-between; align-items:center;">
                <span>Sales History</span>
                <button class="btn-primary" onclick="UI.clearHistory()" style="width:auto; padding:5px 12px; background:var(--danger); font-size:0.8rem; border-radius:15px;">Clear All</button>
            </div>
            <div id="history-list">
                ${this.getHistoryHTML(bills)}
            </div>
        `;
    },

    clearHistory() {
        if (confirm('Are you sure you want to delete ALL sales history? This cannot be undone and will help free up storage.')) {
            store.save('bills', []);
            this.renderView('history');
            this.showToast('History Cleared');
        }
    },

    getHistoryHTML(bills) {
        if (bills.length === 0) return '<div class="card" style="text-align:center;">No history recorded yet.</div>';
        return bills.map(b => {
            const date = new Date(b.date).toLocaleDateString();
            const time = new Date(b.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            return `
                <div class="card list-item" onclick="UI.showBillDetails('${b.id}')">
                    <div style="flex:1;">
                        <p style="font-weight:700; font-size:1rem;">${b.customerName}</p>
                        <p style="font-size:0.8rem; color:var(--text-muted);">${date} | ${time}</p>
                    </div>
                    <div style="text-align:right;">
                        <p style="font-weight:800; color:var(--success);">Rs. ${b.total}</p>
                    </div>
                </div>
            `;
        }).join('');
    },

    showBillDetails(id) {
        const bills = store.get('bills');
        const bill = bills.find(b => b.id === id);
        if (!bill) return;

        // Calculate remaining if it was a Khata entry
        const customers = store.get('customers');
        const cust = customers.find(c => c.id === bill.customerId);
        let remaining = bill.total - bill.paid;
        
        this.showReceipt(bill, remaining);
    },

    getRemindersHTML() {
        const reminders = store.get('reminders');
        if (reminders.length === 0) return '<p style="text-align: center; color: var(--text-muted); font-size: 0.9rem;">No reminders set.</p>';
        return reminders.map(r => `
            <div class="list-item card">
                <i class="fa-solid fa-clock" style="color: var(--warning);"></i>
                <div style="flex: 1;">
                    <p style="font-weight: 600;">${r.text}</p>
                    <p style="font-size: 0.8rem; color: var(--text-muted);">${new Date(r.time).toLocaleString()}</p>
                </div>
                <button class="icon-btn" onclick="UI.deleteReminder('${r.id}')" style="width:30px; height:30px; color:var(--danger); border-color:transparent;"><i class="fa-solid fa-trash"></i></button>
            </div>
        `).join('');
    },

    renderProducts(container) {
        const products = store.get('products');
        container.innerHTML = `
            <div style="display: flex; gap: 0.5rem; margin-bottom: 1rem; flex-wrap: wrap;">
                <button class="btn-primary" onclick="UI.showAddProductModal()" style="flex: 1;">+ Add New Product</button>
            </div>
            <div class="form-group">
                 <input type="text" class="form-input" id="product-search" placeholder="Search items..." oninput="UI.filterProducts(this.value)">
            </div>
            <div id="product-list-container">
                ${this.getProductsHTML(products)}
            </div>
        `;
    },

    filterProducts(val) {
        const products = store.get('products');
        const filtered = products.filter(p => p.name.toLowerCase().includes(val.toLowerCase()));
        document.getElementById('product-list-container').innerHTML = this.getProductsHTML(filtered);
    },

    getProductsHTML(items) {
        if (items.length === 0) return `<div class="card" style="text-align:center;">${this.t('no_products')}</div>`;
        return items.map(p => {
            const lowStock = p.variants.some(v => v.stock <= v.minStock);
            return `
                <div class="card list-item" onclick="UI.showEditProductModal('${p.id}')">
                    <div style="flex: 1;">
                        <h3 style="font-size: 1rem;">${p.name} ${lowStock ? `<span class="badge badge-danger">${this.t('low_stock')}</span>` : ''}</h3>
                        <p style="font-size: 0.85rem; color: var(--text-muted);">${p.category}</p>
                    </div>
                    <div style="text-align: right;">
                        ${p.variants.map(v => `
                            <p style="font-size: 0.8rem; font-weight: 700;">
                                ${v.size}: <span style="color: var(--success);">Rs. ${v.price}</span>
                                <br><span style="font-size:0.7rem; color:${v.stock <= v.minStock ? 'var(--danger)' : 'var(--text-muted)'}">${this.t('items')}: ${v.stock}</span>
                            </p>
                        `).join('')}
                    </div>
                    <i class="fa-solid fa-chevron-right" style="color: var(--border);"></i>
                </div>
            `;
        }).join('');
    },

    renderBilling(container) {
        // No longer clearing cart here to maintain state on tab switch
        container.innerHTML = `
            <div class="card">
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:0.5rem; margin-bottom:0.5rem;">
                    <div class="form-group" style="margin-bottom:0;">
                        <label>Customer Name</label>
                        <input type="text" id="bill-cust-name" class="form-input" placeholder="Ali Raza" oninput="UI.saveCartState()">
                    </div>
                    <div class="form-group" style="margin-bottom:0;">
                        <label>Customer Mobile</label>
                        <input type="number" id="bill-cust-num" class="form-input" placeholder="03001234567" oninput="UI.saveCartState()">
                    </div>
                </div>
                <div class="form-group">
                    <label>Customer Address</label>
                    <input type="text" id="bill-cust-addr" class="form-input" placeholder="e.g. Street 5, Near Masjid" oninput="UI.saveCartState()">
                </div>
            </div>

            <div class="form-group" style="position: relative; display:flex; gap:0.5rem; flex-wrap:wrap;">
                <select id="bill-cat-filter" class="form-select" style="width: auto; flex:1;" onchange="UI.searchBillItems(document.getElementById('bill-search').value)">
                    <option value="">All Categories</option>
                    ${store.get('categories').map(cat => `<option>${cat}</option>`).join('')}
                </select>
                <input type="text" id="bill-search" class="form-input" style="flex:2; min-width:150px;" placeholder="${this.t('search_items')}" oninput="UI.searchBillItems(this.value)">
                <button class="icon-btn" onclick="UI.startScanner('bill')" title="Scan Barcode"><i class="fa-solid fa-barcode"></i></button>
                <div id="bill-search-results" class="card hidden" style="position: absolute; width: 100%; top: 100%; z-index: 10; max-height: 200px; overflow-y: auto; padding: 0.5rem; margin-top: 5px;"></div>
            </div>

            <div id="cart-container">
                <p style="text-align: center; padding: 2rem; color: var(--text-muted);">Cart is empty</p>
            </div>

            <div id="bill-summary" class="card hidden">
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                    <span>Subtotal</span>
                    <span id="bill-subtotal">Rs. 0</span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                    <span>Discount (%)</span>
                    <input type="number" id="bill-discount" value="0" style="width: 60px; text-align: right; border: 1px solid var(--border); padding: 4px;" oninput="UI.calculateBill()">
                </div>
                <hr style="border: 0.5px solid var(--border); margin: 0.75rem 0;">
                <div style="display: flex; justify-content: space-between; font-weight: 700; font-size: 1.25rem;">
                    <span>Grand Total</span>
                    <span id="bill-total">Rs. 0</span>
                </div>
                <div class="form-group" style="margin-top: 1rem;">
                    <label>Amount Paid (Cash)</label>
                    <input type="number" id="bill-paid" class="form-input" placeholder="Enter amount..." oninput="UI.calculateBill()">
                </div>
                <div id="remaining-money" style="color: var(--danger); font-size: 0.85rem; font-weight: 600; margin-bottom: 1rem;"></div>
                
                <button class="btn-primary" onclick="UI.finalizeBill()">Save & Generate Bill</button>
            </div>
        `;
    },

    // --- MODAL & ACTION LOGIC ---

    showAddProductModal() {
        this.showModal(this.t('add_product'), `
            <div class="form-group">
                <label>Product Name</label>
                <input type="text" id="p-name" class="form-input" placeholder="Lays Masala">
            </div>
            <div class="form-group">
                <label>Category</label>
                <select id="p-cat" class="form-select">
                    ${store.get('categories').map(cat => `<option>${cat}</option>`).join('')}
                </select>
            </div>
            <div class="form-group" style="display:flex; align-items:center; gap:0.5rem; margin-bottom: 1.5rem;">
                <input type="checkbox" id="p-weighted" style="width:20px; height:20px;" onchange="UI.toggleWeightedLabel(this)">
                <label for="p-weighted" style="margin-bottom:0;">Sold by Weight? (KG)</label>
            </div>
            <div id="variants-container" class="scrollable-variants">
                <label id="variant-label" style="font-size: 0.85rem; font-weight: 600; color: var(--text-muted);">${this.t('items')} (Size, Price, Stock, Barcode)</label>
                <div class="variant-row card" style="margin-top: 0.5rem; padding: 10px;">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; margin-bottom:0.5rem;">
                        <input type="text" class="form-input p-size" placeholder="Size (e.g. 1.5L)">
                        <input type="number" class="form-input p-price" placeholder="Price">
                    </div>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; margin-bottom:0.5rem;">
                        <input type="number" class="form-input p-stock" placeholder="Initial Stock">
                        <input type="number" class="form-input p-min" placeholder="Low Stock Alert Alert At">
                    </div>
                    <div style="display: flex; gap: 0.5rem; align-items:center;">
                        <input type="text" class="form-input p-barcode" placeholder="Barcode">
                        <button class="icon-btn" onclick="UI.startScanner('p-barcode-${Date.now()}')" title="Scan"><i class="fa-solid fa-barcode"></i></button>
                        <button class="icon-btn" onclick="UI.quickGenerateBarcode(this)" title="Generate"><i class="fa-solid fa-magic-wand-sparkles"></i></button>
                        <button class="icon-btn" onclick="UI.printQRCode(this.parentElement.querySelector('input').value, document.getElementById('p-name').value, this.closest('.variant-row').querySelector('.p-size').value)" title="Show QR"><i class="fa-solid fa-qrcode"></i></button>
                    </div>
                </div>
            </div>
            <button class="btn-primary" style="background: var(--text-muted); margin: 0.5rem 0;" onclick="UI.addVariantRow()">+ Add Size</button>
            <button class="btn-primary" onclick="UI.saveProduct()">${this.t('save_settings')}</button>
        `);
    },

    addVariantRow() {
        const container = document.getElementById('variants-container');
        const id = Date.now();
        const div = document.createElement('div');
        div.className = 'variant-row card';
        div.style.marginTop = '0.5rem';
        div.style.padding = '10px';
        div.innerHTML = `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; margin-bottom:0.5rem;">
                <input type="text" class="form-input p-size" placeholder="Size">
                <input type="number" class="form-input p-price" placeholder="Price">
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; margin-bottom:0.5rem;">
                <input type="number" class="form-input p-stock" placeholder="Initial Stock">
                <input type="number" class="form-input p-min" placeholder="Low Stock Alert">
            </div>
            <div style="display: flex; gap: 0.5rem; align-items:center;">
                <input type="text" class="form-input p-barcode" placeholder="Barcode/QR">
                <button class="icon-btn" onclick="UI.startScanner('p-barcode-${id}')" title="Scan"><i class="fa-solid fa-barcode"></i></button>
                <button class="icon-btn" onclick="UI.quickGenerateBarcode(this)" title="Generate"><i class="fa-solid fa-magic-wand-sparkles"></i></button>
                <button class="icon-btn" onclick="UI.printQRCode(this.parentElement.querySelector('input').value, document.getElementById('p-name').value, this.parentElement.closest('.variant-row').querySelector('.p-size').value)" title="Show QR"><i class="fa-solid fa-qrcode"></i></button>
            </div>
        `;
        container.appendChild(div);
    },

    saveProduct() {
        const name = document.getElementById('p-name').value;
        const category = document.getElementById('p-cat').value;
        const rows = document.querySelectorAll('.variant-row');
        
        const variants = [];
        rows.forEach(row => {
            const size = row.querySelector('.p-size').value;
            const price = parseFloat(row.querySelector('.p-price').value);
            const stock = parseInt(row.querySelector('.p-stock').value) || 0;
            const minStock = parseInt(row.querySelector('.p-min').value) || 5;
            const barcode = row.querySelector('.p-barcode').value || '';
            
            if (size && price) {
                variants.push({ size, price, stock, minStock, barcode });
            }
        });

        if (!name || variants.length === 0) return this.showToast('Fill all fields');

        const isWeighted = document.getElementById('p-weighted').checked;
        store.addProduct({ name, category, variants, isWeighted });
        this.hideModal();
        this.renderView('products');
        this.showToast('Product Added!');
    },

    showEditProductModal(id) {
        const products = store.get('products');
        const p = products.find(prod => prod.id === id);
        if (!p) return;

        this.showModal('Edit Product', `
            <div class="form-group">
                <label>Product Name</label>
                <input type="text" id="edit-p-name" class="form-input" value="${p.name}">
            </div>
            <div class="form-group">
                <label>Category</label>
                <select id="edit-p-cat" class="form-select">
                    ${store.get('categories').map(cat => `<option ${cat === p.category ? 'selected' : ''}>${cat}</option>`).join('')}
                </select>
            </div>
            <div class="form-group" style="display:flex; align-items:center; gap:0.5rem; margin-bottom: 1.5rem;">
                <input type="checkbox" id="edit-p-weighted" style="width:20px; height:20px;" ${p.isWeighted ? 'checked' : ''}>
                <label for="edit-p-weighted" style="margin-bottom:0;">Sold by Weight? (KG)</label>
            </div>
            <div id="edit-variants-container" class="scrollable-variants">
                ${p.variants.map((v, i) => `
                    <div class="variant-row card" style="margin-bottom:0.5rem; padding:10px;">
                        <input type="text" class="form-input edit-p-size" value="${v.size}" placeholder="Size">
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; margin-top:0.5rem;">
                            <input type="number" class="form-input edit-p-price" value="${v.price}" placeholder="Price">
                            <input type="number" class="form-input edit-p-stock" value="${v.stock}" placeholder="Stock">
                        </div>
                        <div style="display: flex; gap: 0.5rem; margin-top:0.5rem; align-items:center;">
                            <input type="text" class="form-input edit-p-barcode" value="${v.barcode || ''}" placeholder="Barcode">
                            <button class="icon-btn" onclick="UI.startScanner('edit-p-barcode-${i}')" title="Scan"><i class="fa-solid fa-barcode"></i></button>
                            <button class="icon-btn" onclick="UI.quickGenerateBarcode(this)" title="Generate"><i class="fa-solid fa-magic-wand-sparkles"></i></button>
                            <button class="icon-btn" onclick="UI.printQRCode('${v.barcode || ''}', '${p.name}', '${v.size}')" title="Show QR"><i class="fa-solid fa-qrcode"></i></button>
                            <button class="icon-btn" onclick="UI.printBarcode('${v.barcode || ''}', '${p.name}', '${v.size}')" title="Print Barcode"><i class="fa-solid fa-print"></i></button>
                        </div>
                    </div>
                `).join('')}
            </div>
            <button class="btn-primary" onclick="UI.updateProduct('${id}')">Update Changes</button>
            <button class="btn-primary" style="background:var(--danger); margin-top:0.5rem;" onclick="UI.deleteProduct('${id}')">Delete Product</button>
        `);
    },

    async startScanner(target) {
        this.showModal('Scanner Ready', `
            <div id="reader" style="width: 100%; min-height: 250px; background:#000; border-radius: var(--radius-md); overflow: hidden;"></div>
            <div style="text-align:center; padding:15px;">
                <p style="font-weight:600; font-size:0.9rem;">Aim at Barcode / QR Code</p>
                <p style="font-size:0.75rem; color:var(--text-muted);">Ensure good lighting</p>
                <button class="btn-primary" style="background:var(--danger); margin-top:10px; width:auto; padding:5px 15px;" onclick="UI.stopScanner()">Cancel</button>
            </div>
        `);

        try {
            // Check for camera support
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error("Camera not supported on this browser/device");
            }

            // Request permission explicitly first for mobile
            await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
            
            this.scanner = new Html5Qrcode("reader");
            const config = { 
                fps: 10, 
                qrbox: { width: 250, height: 180 },
                aspectRatio: 1.0 
            };

            await this.scanner.start(
                { facingMode: "environment" }, 
                config, 
                (decodedText) => {
                    this.stopScanner();
                    this.handleScanResult(target, decodedText);
                }
            );
        } catch (err) {
            console.error("Scanner Error:", err);
            let msg = "Camera Error";
            if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                msg = "Camera permission denied. Please allow camera access in settings.";
            } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
                msg = "No camera found on this device.";
            }
            this.showToast(msg);
            this.hideModal();
        }
    },

    async stopScanner() {
        if (this.scanner) {
            try {
                await this.scanner.stop();
                this.scanner = null;
            } catch (e) {
                console.warn("Stop scanner error:", e);
            }
        }
        this.hideModal();
    },


    handleScanResult(target, scanResult) {
        const barcode = scanResult.trim(); // Trim whitespace to prevent "not found"
        
        if (target === 'bill') {
            const products = store.get('products');
            let found = null;
            let variantMatched = null;
            
            products.forEach(p => {
                p.variants.forEach(v => {
                    // Using String() comparison to ensure types match
                    if (String(v.barcode).trim() === barcode) {
                        found = p;
                        variantMatched = v;
                    }
                });
            });

            if (found) {
                this.addToCart(found, variantMatched);
                this.showToast(`Added ${found.name}`);
            } else {
                this.showToast(`Item not found: ${barcode}`);
            }
        } else if (target.startsWith('edit-p-barcode') || target.startsWith('p-barcode')) {
            this.showToast(`Scanned: ${barcode}`);
            // Target the specific active input usually found by target ID or context
            const input = document.getElementById(target);
            if (input) input.value = barcode;
        }
    },


    updateProduct(id) {
        const name = document.getElementById('edit-p-name').value;
        const category = document.getElementById('edit-p-cat').value;
        const isWeighted = document.getElementById('edit-p-weighted').checked;
        const rows = document.querySelectorAll('.variant-row');
        
        const variants = [];
        rows.forEach(row => {
            const size = row.querySelector('.edit-p-size').value;
            const price = parseFloat(row.querySelector('.edit-p-price').value);
            const stock = parseInt(row.querySelector('.edit-p-stock').value) || 0;
            const barcode = row.querySelector('.edit-p-barcode').value || '';
            
            if (size && price) {
                variants.push({ size, price, stock, minStock: 5, barcode });
            }
        });

        store.updateProduct(id, { name, category, isWeighted, variants });
        this.hideModal();
        this.renderView('products');
        this.showToast('Product Updated');
    },

    deleteProduct(id) {
        if(confirm('Are you sure?')) {
            const products = store.get('products').filter(p => p.id !== id);
            store.save('products', products);
            this.hideModal();
            this.renderView('products');
        }
    },

    // --- BILLING LOGIC ---
    searchBillItems(val) {
        const results = document.getElementById('bill-search-results');
        const catFilter = document.getElementById('bill-cat-filter').value;
        
        if (!val && !catFilter) {
            results.classList.add('hidden');
            return;
        }

        const products = store.get('products');
        
        // Grouping items by name to show only one entry per product in search results
        const grouped = {};
        products.forEach(p => {
            const matchesSearch = p.name.toLowerCase().includes(val.toLowerCase());
            const matchesCat = !catFilter || p.category === catFilter;
            
            if (matchesSearch && matchesCat) {
                if (!grouped[p.name]) {
                    grouped[p.name] = {
                        name: p.name,
                        category: p.category,
                        count: 1
                    };
                } else {
                    grouped[p.name].count++;
                }
            }
        });

        const filtered = Object.values(grouped);
        
        if (filtered.length === 0) {
            results.innerHTML = '<p style="font-size:0.8rem; color:var(--text-muted); padding:10px;">No items found</p>';
        } else {
            results.innerHTML = filtered.map(p => `
                <div class="search-result-item" style="padding:0.75rem; border-bottom:1px solid var(--border); cursor:pointer;" onclick="UI.showSizeSelectorByName('${p.name.replace(/'/g, "\\'")}')">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <div>
                            <p style="font-weight:600; margin:0;">${p.name}</p>
                            <p style="font-size:0.7rem; color:var(--text-muted); margin:0;">${p.category}</p>
                        </div>
                        <span class="badge" style="background:var(--bg-main); color:var(--text-main); border:1px solid var(--border);">${p.count} ${p.count > 1 ? 'Sizes' : 'Size'}</span>
                    </div>
                </div>
            `).join('');
        }
        results.classList.remove('hidden');
    },


    showSizeSelectorByName(name) {
        const products = store.get('products').filter(p => p.name === name);
        if (products.length === 0) return;

        document.getElementById('bill-search-results').classList.add('hidden');
        document.getElementById('bill-search').value = '';

        // If it's a weighted item, handle specifically (assuming if any is weighted, the product is weighted)
        const weightedProduct = products.find(p => p.isWeighted);
        if (weightedProduct) {
            this.showWeightModal(weightedProduct);
            return;
        }

        // Collect all variants across similar items
        let allVariants = [];
        products.forEach(p => {
            p.variants.forEach(v => {
                allVariants.push({
                    pid: p.id,
                    size: v.size,
                    price: v.price
                });
            });
        });

        if (allVariants.length === 1) {
            const p = products.find(prod => prod.id === allVariants[0].pid);
            const v = p.variants.find(varnt => varnt.size === allVariants[0].size);
            this.addToCart(p, v);
        } else {
            this.showModal(`Select size for ${name}`, `
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem;">
                    ${allVariants.map(v => `
                        <button class="card" onclick="UI.addToCartById('${v.pid}', '${v.size}')" style="text-align:center;">
                            <p style="font-weight:700;">${v.size}</p>
                            <p style="color:var(--success);">Rs. ${v.price}</p>
                        </button>
                    `).join('')}
                </div>
            `);
        }
    },

    showWeightModal(p) {
        const v = p.variants[0]; // Assuming first variant is the base price for weighted items
        this.showModal(`${p.name} - Weighted Calculation`, `
            <div class="card" style="background:var(--bg-main); text-align:center; margin-bottom:1rem;">
                <p style="font-size:0.9rem;">Rate: <span style="font-weight:700; color:var(--success);">Rs. ${v.price} / KG</span></p>
            </div>
            <div class="form-group">
                <label>Enter Bill Amount (Rs.)</label>
                <input type="number" id="w-bill-amount" class="form-input" placeholder="e.g. 50" oninput="UI.calcWeightByPrice(${v.price})">
            </div>
            <div style="text-align:center; padding:0.5rem; font-weight:700; color:var(--text-muted);">- OR -</div>
            <div class="form-group">
                <label>Enter Weight (KG)</label>
                <input type="number" id="w-bill-weight" class="form-input" placeholder="e.g. 0.250" oninput="UI.calcPriceByWeight(${v.price})">
            </div>
            <div style="display:grid; grid-template-columns: repeat(5, 1fr); gap:0.4rem; margin-bottom:1rem;">
                <button class="btn-primary" style="padding:5px; font-size:0.75rem; background:var(--bg-main); color:var(--text-main); border:1px solid var(--border);" onclick="UI.setQuickWeight(1, ${v.price})">1kg</button>
                <button class="btn-primary" style="padding:5px; font-size:0.75rem; background:var(--bg-main); color:var(--text-main); border:1px solid var(--border);" onclick="UI.setQuickWeight(0.5, ${v.price})">500g</button>
                <button class="btn-primary" style="padding:5px; font-size:0.75rem; background:var(--bg-main); color:var(--text-main); border:1px solid var(--border);" onclick="UI.setQuickWeight(0.25, ${v.price})">250g</button>
                <button class="btn-primary" style="padding:5px; font-size:0.75rem; background:var(--bg-main); color:var(--text-main); border:1px solid var(--border);" onclick="UI.setQuickWeight(0.1, ${v.price})">100g</button>
                <button class="btn-primary" style="padding:5px; font-size:0.75rem; background:var(--bg-main); color:var(--text-main); border:1px solid var(--border);" onclick="UI.setQuickWeight(0.05, ${v.price})">50g</button>
            </div>
            <div id="w-summary" class="card" style="text-align:center; font-weight:700; font-size:1.1rem; border:2px dashed var(--success); color:var(--success);">
                Add Rs. 0 worth (0 KG)
            </div>
            <button class="btn-primary" style="margin-top:1rem;" onclick="UI.addWeightedToCart('${p.id}')">Add to Bill</button>
        `);
    },

    calcWeightByPrice(rate) {
        const price = parseFloat(document.getElementById('w-bill-amount').value) || 0;
        const weight = (price / rate).toFixed(3);
        document.getElementById('w-bill-weight').value = weight;
        this.updateWeightSummary(price, weight);
    },

    calcPriceByWeight(rate) {
        const weight = parseFloat(document.getElementById('w-bill-weight').value) || 0;
        const price = Math.round(weight * rate);
        document.getElementById('w-bill-amount').value = price;
        this.updateWeightSummary(price, weight);
    },

    updateWeightSummary(price, weight) {
        document.getElementById('w-summary').innerText = `Add Rs. ${price} worth (${weight} KG)`;
    },

    setQuickWeight(weight, rate) {
        document.getElementById('w-bill-weight').value = weight;
        this.calcPriceByWeight(rate);
    },

    addWeightedToCart(pid) {
        const p = store.get('products').find(prod => prod.id === pid);
        const weight = parseFloat(document.getElementById('w-bill-weight').value) || 0;
        const price = parseFloat(document.getElementById('w-bill-amount').value) || 0;
        
        if (weight <= 0) return this.showToast('Enter valid amount/weight');
        
        this.cart.push({
            pid: p.id,
            name: p.name,
            size: 'Weighted',
            price: p.variants[0].price, // unit price
            qty: weight, // Quantity is the weight in KG
            total: price, // Pre-calculated total
            isWeighted: true
        });
        
        this.saveCartState();
        this.hideModal();
        this.updateCartUI();
    },

    addToCartById(pid, size) {
        const p = store.get('products').find(p => p.id === pid);
        const v = p.variants.find(varnt => varnt.size === size);
        this.addToCart(p, v);
        this.hideModal();
    },

    addToCart(product, variant) {
        const existing = this.cart.find(item => item.pid === product.id && item.size === variant.size);
        if (existing) {
            existing.qty++;
        } else {
            this.cart.push({
                pid: product.id,
                name: product.name,
                size: variant.size,
                price: variant.price,
                qty: 1
            });
        }
        this.saveCartState();
        this.updateCartUI();
    },

    updateCartUI() {
        const container = document.getElementById('cart-container');
        const summary = document.getElementById('bill-summary');

        if (this.cart.length === 0) {
            container.innerHTML = '<p style="text-align: center; padding: 2rem; color: var(--text-muted);">Cart is empty</p>';
            summary.classList.add('hidden');
            return;
        }

        summary.classList.remove('hidden');
        container.innerHTML = this.cart.map((item, index) => `
            <div class="card" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem; padding: 0.75rem 1rem;">
                <div style="flex:1;">
                    <p style="font-weight:600;">${item.name} ${item.isWeighted ? '(KG)' : `(${item.size})`}</p>
                    <p style="font-size:0.8rem; color:var(--success);">Rs. ${item.price} per ${item.isWeighted ? 'KG' : 'unit'}</p>
                </div>
                <div style="display:flex; align-items:center; gap:0.75rem;">
                    ${item.isWeighted ? `
                        <span style="font-weight:700;">${item.qty} KG</span>
                    ` : `
                        <button class="icon-btn" onclick="UI.changeQty(${index}, -1)" style="width:30px; height:30px;"><i class="fa-solid fa-minus"></i></button>
                        <span style="font-weight:700; width:20px; text-align:center;">${item.qty}</span>
                        <button class="icon-btn" onclick="UI.changeQty(${index}, 1)" style="width:30px; height:30px;"><i class="fa-solid fa-plus"></i></button>
                    `}
                </div>
                <div style="margin-left:1rem; min-width:80px; text-align:right;">
                    <p style="font-weight:700;">Rs. ${item.isWeighted ? item.total : (item.price * item.qty)}</p>
                </div>
            </div>
        `).join('');
        this.calculateBill();
    },

    changeQty(index, delta) {
        this.cart[index].qty += delta;
        if (this.cart[index].qty <= 0) {
            this.cart.splice(index, 1);
        }
        this.saveCartState();
        this.updateCartUI();
    },

    calculateBill() {
        const subtotal = this.cart.reduce((acc, item) => {
            const rowTotal = item.isWeighted ? item.total : (item.price * item.qty);
            return acc + rowTotal;
        }, 0);
        const discountPerc = parseFloat(document.getElementById('bill-discount').value) || 0;
        const total = subtotal - (subtotal * (discountPerc / 100));
        const paid = parseFloat(document.getElementById('bill-paid').value) || 0;
        const remaining = total - paid;

        document.getElementById('bill-subtotal').innerText = `Rs. ${subtotal}`;
        document.getElementById('bill-total').innerText = `Rs. ${Math.round(total)}`;
        
        const remDiv = document.getElementById('remaining-money');
        if (remaining > 0) {
            remDiv.innerText = `Balance to Khata: Rs. ${Math.round(remaining)}`;
        } else if (remaining < 0) {
            remDiv.innerText = `Change to Return: Rs. ${Math.abs(Math.round(remaining))}`;
        } else {
            remDiv.innerText = '';
        }
    },

    finalizeBill() {
        const name = document.getElementById('bill-cust-name').value || 'Walking Customer';
        const number = document.getElementById('bill-cust-num').value || '0000000000';
        const subtotal = this.cart.reduce((acc, item) => {
            const rowTotal = item.isWeighted ? item.total : (item.price * item.qty);
            return acc + rowTotal;
        }, 0);
        const address = document.getElementById('bill-cust-addr').value || '';
        const discountPerc = parseFloat(document.getElementById('bill-discount').value) || 0;
        const total = Math.round(subtotal - (subtotal * (discountPerc / 100)));
        const paid = parseFloat(document.getElementById('bill-paid').value) || 0;
        const remaining = total - paid;

        const customer = store.getOrCreateCustomer(name, number, address);
        const bill = store.saveBill({
            customerId: customer.id,
            customerName: name,
            customerNumber: number,
            customerAddress: address,
            items: this.cart,
            total,
            paid,
            date: new Date().toISOString()
        });

        // Deduct Stock
        const products = store.get('products');
        this.cart.forEach(item => {
            const p = products.find(prod => prod.id === item.pid);
            if (p) {
                const v = p.variants.find(varnt => varnt.size === item.size);
                if (v) v.stock -= item.qty;
            }
        });
        store.save('products', products);

        if (remaining > 0) {
            store.addKhataEntry(customer.id, {
                type: 'debit',
                amount: remaining,
                billId: bill.id,
                note: 'Unpaid from bill'
            });
        }

        this.cart = [];
        this.saveCartState();
        this.showReceipt(bill, remaining);
    },

    showReceipt(bill, remaining) {
        const settings = store.get('settings');
        this.showModal('Bill Saved', `
            <div id="receipt-content" style="padding: 1rem; border: 1px dashed var(--border); ${this.lang === 'ur' ? 'direction:rtl; text-align:right;' : 'direction:ltr; text-align:left;'}">
                <h3 style="text-align:center;">${this.t('app_title')}</h3>
                <p style="text-align:center; font-size:0.75rem;">${settings.address || 'Main Street, Pakistan'} | ${settings.shopNumber || '0300-XXXXXXX'}</p>
                <hr style="margin: 0.5rem 0;">
                <div style="font-size:0.8rem;">
                    <p>${this.t('invoice_title')} ${bill.id.slice(-6)}</p>
                    <p>${this.lang === 'ur' ? 'تاریخ' : 'Date'}: ${new Date(bill.date).toLocaleString()}</p>
                    <p>${this.lang === 'ur' ? 'بنام' : 'To'}: ${bill.customerName} ${bill.customerNumber ? `(${bill.customerNumber})` : ''}</p>
                    ${bill.customerAddress ? `<p>${this.lang === 'ur' ? 'پتہ' : 'Addr'}: ${bill.customerAddress}</p>` : ''}
                </div>
                <table style="width:100%; font-size:0.85rem; margin:1rem 0;">
                    ${bill.items.map(item => `
                        <tr>
                            <td style="${this.lang === 'ur' ? 'text-align:right;' : 'text-align:left;'}">${item.name} ${item.isWeighted ? `(${item.qty} KG)` : `(${item.size}) x ${item.qty}`}</td>
                            <td style="${this.lang === 'ur' ? 'text-align:left;' : 'text-align:right;'}">Rs. ${item.isWeighted ? item.total : (item.price * item.qty)}</td>
                        </tr>
                    `).join('')}
                </table>
                <hr style="margin: 0.5rem 0;">
                <div style="${this.lang === 'ur' ? 'text-align:left;' : 'text-align:right;'} font-weight:700;">
                    <p>${this.t('total')}: Rs. ${bill.total}</p>
                    <p>${this.t('paid')}: Rs. ${bill.paid}</p>
                    ${remaining > 0 ? `<p style="color:var(--danger);">${this.t('balance')}: Rs. ${remaining}</p>` : ''}
                </div>
                <p style="margin-top:1.5rem; text-align:center;">${this.lang === 'ur' ? 'شکریہ! پھر ضرور آئیں۔' : 'Thank you, please come again!'}</p>
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.5rem; margin-top:1rem;">
                <button class="btn-primary" onclick="UI.shareWhatsAppById('${bill.id}', ${remaining}, 'en')" style="background:#25D366; font-size:0.85rem;">
                    <i class="fa-brands fa-whatsapp"></i> WhatsApp (Eng)
                </button>
                <button class="btn-primary" onclick="UI.shareWhatsAppById('${bill.id}', ${remaining}, 'ur')" style="background:#25D366; font-size:0.85rem;">
                    <i class="fa-brands fa-whatsapp"></i> WhatsApp (اردو)
                </button>
                <button class="btn-primary" id="download-btn" onclick="UI.downloadReceipt('${bill.id}')" style="background:var(--primary);">
                    <i class="fa-solid fa-download"></i> Download Bill
                </button>
                <button class="btn-primary" onclick="UI.shareDirectById('${bill.id}', ${remaining})" style="background:var(--info);">
                    <i class="fa-solid fa-share-nodes"></i> Share
                </button>
            </div>
        `);
    },

    downloadReceipt(billId) {
        const btn = document.getElementById('download-btn');
        btn.innerText = 'Downloading...';
        btn.disabled = true;

        const content = document.getElementById('receipt-content');
        
        html2canvas(content, {
            backgroundColor: '#ffffff',
            scale: 2, // Higher quality
            useCORS: true
        }).then(canvas => {
            const link = document.createElement('a');
            link.download = `receipt-${billId.slice(-6)}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
            
            btn.innerHTML = '<i class="fa-solid fa-check"></i> Downloaded';
            this.showToast('Receipt Saved to Gallery');
        }).catch(err => {
            console.error(err);
            this.showToast('Download Failed');
            btn.innerHTML = '<i class="fa-solid fa-download"></i> Try Again';
            btn.disabled = false;
        });
    },

    shareWhatsAppById(billId, remaining, lang = 'en') {
        const bills = store.get('bills');
        const bill = bills.find(b => b.id === billId);
        if (!bill) return;

        let itemsText = bill.items.map(item => {
            const detail = item.isWeighted ? `(${item.qty} KG)` : `(${item.size}) x${item.qty}`;
            const rowTotal = item.isWeighted ? item.total : (item.price * item.qty);
            return `• ${item.name} ${detail} = ${rowTotal}`;
        }).join('\n');
        
        let text = "";
        if (lang === 'ur') {
            text = `السلام علیکم *${bill.customerName}*,\n\n*علی رضا کریانہ اسٹور*\n\n--- سامان کی تفصیل ---\n${itemsText}\n-------------\n*کل رقم: Rs. ${bill.total}*\nادا شدہ: Rs. ${bill.paid}\n*بقیہ (خاتہ): Rs. ${remaining}*\n\nشکریہ! پھر ضرور آئیں۔`;
        } else {
            text = `Salaam *${bill.customerName}*,\n\n*Ali Raza Kiryana Store*\n\n--- Items ---\n${itemsText}\n-------------\n*Total: Rs. ${bill.total}*\nPaid: Rs. ${bill.paid}\n*Balance (Khata): Rs. ${remaining}*\n\nThank you, please come again!`;
        }
        
        const encoded = encodeURIComponent(text);
        window.open(`https://wa.me/${bill.customerNumber ? bill.customerNumber : ''}?text=${encoded}`);
    },

    async shareDirectById(billId, remaining) {
        const bills = store.get('bills');
        const bill = bills.find(b => b.id === billId);
        if (!bill) return;

        let itemsText = bill.items.map(item => {
            return `• ${item.name} x${item.qty}${item.isWeighted ? 'KG' : ''}`;
        }).join(', ');
        const shareData = {
            title: 'Ali Raza Kiryana Bill',
            text: `Bill for ${bill.customerName}\nTotal: Rs. ${bill.total}\nItems: ${itemsText}\nBaqaya: Rs. ${remaining}\nStore: Ali Raza Kiryana`
        };

        if (navigator.share) {
            try {
                await navigator.share(shareData);
            } catch (err) {
                this.shareWhatsAppById(billId, remaining);
            }
        } else {
            this.shareWhatsAppById(billId, remaining);
        }
    },

    // --- KHATA RENDERING ---
    renderKhata(container) {
        const customers = store.get('customers');
        container.innerHTML = `
            <div class="form-group" style="display:flex; gap:0.5rem;">
                <input type="text" id="khata-search" class="form-input" style="flex:1;" placeholder="Search customer by name or #..." oninput="UI.filterKhatas(this.value)">
                <button class="btn-primary" onclick="UI.showAddCustomerModal()" style="width:auto; padding:0 1rem;"><i class="fa-solid fa-user-plus"></i></button>
            </div>
            <div id="khata-list">
                ${this.getKhataHTML(customers)}
            </div>
        `;
    },

    getKhataHTML(customers) {
        const sorted = customers.filter(c => c.totalDue > 0).sort((a,b) => b.totalDue - a.totalDue);
        if (sorted.length === 0) return '<div class="card" style="text-align:center;">No Pending Khata Payments.</div>';
        
        return sorted.map(c => `
            <div class="card list-item" onclick="UI.showCustomerKhata('${c.id}')">
                <div style="flex:1;">
                    <h3 style="font-size:1.1rem;">${c.name}</h3>
                    <p style="font-size:0.85rem; color:var(--text-muted);">View History & Payments</p>
                </div>
                <div style="text-align:right;">
                    <p style="font-size:1.2rem; font-weight:700; color:var(--danger);">Rs. ${c.totalDue}</p>
                </div>
                <i class="fa-solid fa-chevron-right" style="color:var(--border);"></i>
            </div>
        `).join('');
    },

    showCustomerKhata(id) {
        const c = store.get('customers').find(cust => cust.id === id);
        this.showModal(`${c.name}'s Ledger`, `
            <div style="margin-bottom:1rem; padding:1rem; background:var(--bg-main); border-radius:var(--radius-md);">
                <p>Address: ${c.address || 'Not set'}</p>
                <p>Mobile: ${c.number}</p>
                <h3 style="color:var(--danger); margin-top:0.5rem;">Current Balance: Rs. ${c.totalDue}</h3>
            </div>
            
            <div style="max-height: 250px; overflow-y: auto; margin-bottom:1.5rem; border:1px solid var(--border); border-radius:var(--radius-sm); padding:0.5rem;">
                ${c.khata.slice().reverse().map(entry => `
                    <div style="display:flex; justify-content:space-between; padding:0.75rem 0.5rem; border-bottom:1px solid var(--border);">
                        <div>
                            <p style="font-size:0.9rem; font-weight:600;">${entry.note}</p>
                            <p style="font-size:0.75rem; color:var(--text-muted);">${new Date(entry.date).toLocaleString()}</p>
                        </div>
                        <p style="font-weight:700; color: ${entry.type === 'debit' ? 'var(--danger)' : 'var(--success)'}">
                            ${entry.type === 'debit' ? '+' : '-'} Rs. ${Math.abs(entry.amount)}
                        </p>
                    </div>
                `).join('')}
            </div>

            <div class="card" style="background:var(--bg-main);">
                <h4 style="margin-bottom:1rem;">Manage Transactions</h4>
                <div class="form-group">
                    <label>Amount (Rs)</label>
                    <input type="number" id="khata-amt" class="form-input" placeholder="0.00">
                </div>
                <div class="form-group">
                    <label>Note / Product</label>
                    <input type="text" id="khata-note" class="form-input" placeholder="Payment received or Items bought">
                </div>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.5rem;">
                    <button class="btn-primary" style="background:var(--danger);" onclick="UI.recordKhataEntry('${c.id}', 'debit')">+ Add Debt</button>
                    <button class="btn-primary" style="background:var(--success);" onclick="UI.recordKhataEntry('${c.id}', 'credit')">- Recieve Pay</button>
                </div>
            </div>
        `);
    },

    recordKhataEntry(cid, type) {
        const amt = parseFloat(document.getElementById('khata-amt').value);
        const note = document.getElementById('khata-note').value;
        if (!amt || !note) return this.showToast('Enter amount and note');
        
        store.addKhataEntry(cid, {
            type: type,
            amount: type === 'debit' ? amt : -amt,
            note: note
        });
        
        this.hideModal();
        this.renderView('khata');
        this.showToast('Entry Recorded');
    },

    filterKhatas(val) {
        const customers = store.get('customers');
        const filtered = customers.filter(c => 
            c.name.toLowerCase().includes(val.toLowerCase()) || 
            c.number.includes(val) || 
            (c.address && c.address.toLowerCase().includes(val.toLowerCase()))
        );
        document.getElementById('khata-list').innerHTML = this.getKhataHTML(filtered);
    },

    // --- SETTINGS ---
    renderSettings(container) {
        const settings = store.get('settings');
        const storageUsage = (JSON.stringify(localStorage).length / 1024).toFixed(2);

        container.innerHTML = `
            <div class="card">
                <h3 data-i18n="store_info">Store Info</h3>
                <div class="form-group" style="margin-top:0.5rem;">
                    <label>Store Name</label>
                    <input type="text" id="set-store-name" class="form-input" value="${settings.storeName || 'Ali Raza Kiryana Store'}">
                </div>
                <div class="form-group">
                    <label>Address</label>
                    <input type="text" id="set-store-addr" class="form-input" value="${settings.address || 'Main Bazaar, Pakistan'}">
                </div>
                <div class="form-group">
                    <label>Shop Contact #</label>
                    <input type="text" id="set-store-num" class="form-input" value="${settings.shopNumber || '0300-XXXXXXX'}">
                </div>
                <button class="btn-primary" onclick="UI.saveGeneralSettings()">${this.t('save_settings')}</button>
            </div>

            <div class="card">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span data-i18n="dark_mode">Dark Mode</span>
                    <button class="icon-btn" onclick="UI.toggleTheme()"><i class="fa-solid fa-moon"></i></button>
                </div>
            </div>
            
            <div class="card">
                <h3 style="display:flex; justify-content:space-between; align-items:center;">
                    Cloud Sync (Firestore)
                    <span class="badge ${isFirebaseEnabled ? 'badge-success' : 'badge-danger'}" style="font-size:0.75rem;">
                        ${isFirebaseEnabled ? 'Live Sync' : 'Offline'}
                    </span>
                </h3>
                <p style="font-size:0.8rem; color:var(--text-muted); margin-bottom:1rem;">
                    Sync your store items, khatas, and bills to the Google Cloud for free.
                </p>
                <div style="background:var(--bg-main); padding:10px; border-radius:var(--radius-sm); border:1px solid var(--border); font-size:0.75rem; margin-bottom:1rem;">
                    <p style="font-weight:700; margin-bottom:5px;">Firebase Free Plan (Spark):</p>
                    <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.25rem;">
                        <span>Data Limit:</span><span style="text-align:right; font-weight:600;">1 GB</span>
                        <span>Read Limit:</span><span style="text-align:right; font-weight:600;">50k / day</span>
                        <span>Write Limit:</span><span style="text-align:right; font-weight:600;">20k / day</span>
                    </div>
                </div>


                ${!isFirebaseEnabled ? `
                    <div class="form-group" style="margin-top:1rem;">
                        <label style="font-size:0.7rem;">API Key</label>
                        <input type="text" id="fb-apiKey" class="form-input" placeholder="Paste API Key">
                        <label style="font-size:0.7rem;">Project ID</label>
                        <input type="text" id="fb-projectId" class="form-input" placeholder="Paste Project ID">
                        <button class="btn-primary" style="margin-top:0.5rem; background:var(--primary);" onclick="UI.saveFirebaseConfig()">
                            <i class="fa-solid fa-plug"></i> Connect & Save
                        </button>
                    </div>
                ` : `
                    <button class="btn-primary" style="background:var(--success); font-size:0.85rem;" onclick="UI.syncCloudManual()">
                        <i class="fa-solid fa-cloud-arrow-down"></i> Sync from Cloud
                    </button>
                    <button class="btn-primary" style="background:var(--danger); font-size:0.85rem; margin-top:0.5rem;" onclick="UI.disconnectFirebase()">
                        Disconnect Firebase
                    </button>


                `}

            </div>

            <div class="card">
                <h3>Backup & Restore</h3>
                <div class="storage-info">
                    <p style="font-size:0.85rem; display:flex; justify-content:space-between;">
                        <span>Device Storage</span>
                        <span style="font-weight:700;">${storageUsage} / 5000 KB</span>
                    </p>
                    <div class="storage-bar-container">
                        <div id="storage-bar" class="storage-bar-fill"></div>
                    </div>
                    <p id="storage-status" style="font-size:0.75rem; margin-top:4px; text-align:right; font-weight:600;"></p>
                </div>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.5rem;">
                    <button class="btn-primary" style="background:var(--info);" onclick="UI.exportData()">Export JSON</button>
                    <button class="btn-primary" style="background:var(--warning);" onclick="UI.triggerImport()">Import JSON</button>
                </div>
                <input type="file" id="import-file" class="hidden" onchange="UI.importData(event)">
            </div>

            <div class="card">
                <h3 data-i18n="quick_actions">Quick Actions</h3>
                <button class="btn-primary" style="background:var(--primary); margin-top:0.5rem;" onclick="UI.showBulkUpdater()">
                    <i class="fa-solid fa-tags"></i> Bulk Price Updater
                </button>
                <button class="btn-primary" style="background:var(--info); margin-top:0.5rem;" onclick="UI.showCategoryManager()">
                    <i class="fa-solid fa-list"></i> Manage Categories
                </button>
                <button class="btn-primary" style="background:var(--success); margin-top:0.5rem;" onclick="UI.doFullSeed()">
                    <i class="fa-solid fa-database"></i> Load Full Store Data (200 Items)
                </button>
            </div>
            
            <p style="text-align:center; font-size:0.75rem; color:var(--text-muted); margin-top:2rem;">App Version 2.1.0 | Built for Ali Raza</p>
        `;
        this.applySettings(); // Re-apply for new static elements
        this.updateStorageBar(parseFloat(storageUsage));
    },

    updateStorageBar(usedKB) {
        const limit = 5000; // 5MB limit
        const percent = Math.min((usedKB / limit) * 100, 100).toFixed(1);
        const bar = document.getElementById('storage-bar');
        const status = document.getElementById('storage-status');
        
        if (bar && status) {
            bar.style.width = percent + '%';
            
            let color = 'var(--success)';
            let label = 'Healthy';
            
            if (percent > 90) {
                color = 'var(--danger)';
                label = 'Critical - Back up now!';
            } else if (percent > 70) {
                color = 'var(--warning)';
                label = 'Low Space';
            }
            
            bar.style.backgroundColor = color;
            status.innerText = `${percent}% Used - ${label}`;
            status.style.color = color;
        }
    },

    showBulkUpdater() {
        const products = store.get('products');
        const categories = [...new Set(products.map(p => p.category))];
        
        this.showModal('Bulk Price Updater', `
            <div class="form-group">
                <label>Select Category</label>
                <select id="bulk-cat" class="form-select">
                    ${categories.map(c => `<option>${c}</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label>Price Adjustment (Rs.)</label>
                <div style="display:flex; gap:0.5rem;">
                    <input type="number" id="bulk-val" class="form-input" placeholder="e.g. 10 or -5">
                    <button class="btn-primary" onclick="UI.applyBulkUpdate()">Apply</button>
                </div>
            </div>
            <p style="font-size:0.8rem; color:var(--text-muted);">This will add/subtract the value to all items in selected category.</p>
        `);
    },

    applyBulkUpdate() {
        const cat = document.getElementById('bulk-cat').value;
        const val = parseFloat(document.getElementById('bulk-val').value);
        if (!val) return;

        const products = store.get('products');
        products.forEach(p => {
            if (p.category === cat) {
                p.variants.forEach(v => v.price += val);
            }
        });
        store.save('products', products);
        this.hideModal();
        this.showToast(`Updated ${cat} prices by Rs. ${val}`);
        this.renderView('products');
    },

    showCategoryManager() {
        const cats = store.get('categories');
        this.showModal('Manage Categories', `
            <div class="form-group" style="display:flex; gap:0.5rem;">
                <input type="text" id="new-cat-input" class="form-input" placeholder="New category name...">
                <button class="btn-primary" onclick="UI.addNewCategory()" style="width:auto;">Add</button>
            </div>
            <div style="max-height: 250px; overflow-y: auto; border:1px solid var(--border); border-radius:var(--radius-sm);">
                ${cats.map(c => `
                    <div style="display:flex; justify-content:space-between; align-items:center; padding:10px; border-bottom:1px solid var(--border);">
                        <span>${c}</span>
                        <button class="icon-btn" onclick="UI.removeCategory('${c}')" style="width:30px; height:30px; color:var(--danger); border:none;"><i class="fa-solid fa-trash"></i></button>
                    </div>
                `).join('')}
            </div>
        `);
    },

    addNewCategory() {
        const val = document.getElementById('new-cat-input').value.trim();
        if (!val) return;
        store.addCategory(val);
        this.showCategoryManager();
        this.showToast('Category Added');
    },

    removeCategory(name) {
        if (confirm(`Delete category "${name}"?`)) {
            store.deleteCategory(name);
            this.showCategoryManager();
        }
    },

    toggleTheme() {
        const isDark = document.body.classList.toggle('theme-dark');
        const settings = store.get('settings');
        settings.theme = isDark ? 'dark' : 'light';
        store.save('settings', settings);
        this.showToast(`${isDark ? 'Dark' : 'Light'} Mode Enabled`);
    },

    applyTheme() {
        const settings = store.get('settings');
        if (settings.theme === 'dark') document.body.classList.add('theme-dark');
    },

    saveGeneralSettings() {
        const name = document.getElementById('set-store-name').value;
        const addr = document.getElementById('set-store-addr').value;
        const num = document.getElementById('set-store-num').value;
        const settings = store.get('settings');
        settings.storeName = name;
        settings.address = addr;
        settings.shopNumber = num;
        store.save('settings', settings);
        this.applySettings();
        this.showToast('Settings Saved');
    },

    exportData() {
        const data = {};
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith(store.prefix)) {
                data[key] = localStorage.getItem(key);
            }
        }
        const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `arkpos_backup_${new Date().toLocaleDateString()}.json`;
        a.click();
    },

    triggerImport() {
        document.getElementById('import-file').click();
    },

    importData(e) {
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = (event) => {
            const data = JSON.parse(event.target.result);
            Object.keys(data).forEach(key => localStorage.setItem(key, data[key]));
            this.showToast('Data Restored! Reloading...');
            setTimeout(() => location.reload(), 1500);
        };
        reader.readAsText(file);
    },

    // --- UTILS ---
    showModal(title, bodyHTML) {
        document.getElementById('modal-title').innerText = title;
        document.getElementById('modal-body').innerHTML = bodyHTML;
        document.getElementById('modal-container').classList.remove('hidden');
    },

    hideModal() {
        document.getElementById('modal-container').classList.add('hidden');
    },

    showToast(msg) {
        const toast = document.getElementById('toast');
        toast.innerText = msg;
        toast.classList.remove('hidden');
        setTimeout(() => toast.classList.add('hidden'), 3000);
    },

    // --- NEW ENHANCEMENTS ---
    showAddCustomerModal() {
        this.showModal('Add New Customer', `
            <div class="form-group">
                <label>Customer Name</label>
                <input type="text" id="new-cust-name" class="form-input" placeholder="e.g. Mohammad Ali">
            </div>
            <div class="form-group">
                <label>Mobile Number</label>
                <input type="number" id="new-cust-num" class="form-input" placeholder="03001234567">
            </div>
            <div class="form-group">
                <label>Customer Address</label>
                <input type="text" id="new-cust-addr" class="form-input" placeholder="e.g. Street 5, Near Masjid">
            </div>
            <button class="btn-primary" onclick="UI.saveNewCustomer()">Create Khata Account</button>
        `);
    },

    saveNewCustomer() {
        const name = document.getElementById('new-cust-name').value;
        const number = document.getElementById('new-cust-num').value;
        const address = document.getElementById('new-cust-addr').value;
        if (!name || !number) return this.showToast('Name and Number required');

        store.getOrCreateCustomer(name, number, address);
        this.hideModal();
        this.renderView('khata');
        this.showToast('Customer Added!');
    },

    quickGenerateBarcode(btn) {
        const input = btn.parentElement.querySelector('input');
        if (input) {
            const randomCode = Math.floor(100000 + Math.random() * 900000).toString();
            input.value = randomCode;
            this.showToast('Barcode Generated!');
        }
    },

    printBarcode(code, name, size) {
        if (!code) return this.showToast('No barcode to print');
        
        this.showModal('Print Barcode', `
            <div id="barcode-print-area" class="barcode-preview">
                <h4 style="margin-bottom:5px;">${name}</h4>
                <p style="font-size:0.8rem; margin-bottom:10px;">Size: ${size}</p>
                <svg id="barcode-svg"></svg>
            </div>
            <button class="btn-primary" onclick="UI.doPrintBarcode()" style="margin-top:1rem;">
                <i class="fa-solid fa-print"></i> Print Now
            </button>
        `);

        JsBarcode("#barcode-svg", code, {
            format: "CODE128",
            width: 2,
            height: 60,
            displayValue: true
        });
    },

    doPrintBarcode() {
        const printContent = document.getElementById('barcode-print-area').innerHTML;
        const win = window.open('', '', 'height=500,width=500');
        win.document.write('<html><head><title>Print Barcode</title>');
        win.document.write('<style>body{font-family:sans-serif; text-align:center; padding:20px;} svg{max-width:100%;}</style>');
        win.document.write('</head><body>');
        win.document.write(printContent);
        win.document.write('</body></html>');
        win.document.close();
        win.focus();
        setTimeout(() => {
            win.print();
            win.close();
        }, 500);
    },

    toggleWeightedLabel(checkbox) {
        const label = document.getElementById('variant-label');
        const sizeInput = document.querySelector('.p-size');
        const priceInput = document.querySelector('.p-price');
        
        if (checkbox.checked) {
            if (label) label.innerText = "Weighted Item Setup (Price per 1 KG)";
            if (sizeInput) {
                sizeInput.value = "1 KG";
                sizeInput.readOnly = true;
            }
            if (priceInput) priceInput.placeholder = "Price per 1 KG";
        } else {
            if (label) label.innerText = "Items (Size, Price, Stock, Barcode)";
            if (sizeInput) {
                sizeInput.value = "";
                sizeInput.readOnly = false;
                sizeInput.placeholder = "Size (e.g. 1.5L)";
            }
            if (priceInput) priceInput.placeholder = "Price";
        }
    },

    deleteReminder(id) {
        if (confirm('Clear this reminder?')) {
            const reminders = store.get('reminders').filter(r => r.id !== id);
            store.save('reminders', reminders);
            this.renderView('home');
            this.showToast('Reminder cleared');
        }
    },

    printQRCode(code, name, size) {
        if (!code) return this.showToast('Enter a code first');
        
        this.showModal('QR Code Preview', `
            <div id="qrcode-download-area" class="barcode-preview" style="display: flex; flex-direction: column; align-items: center; padding: 20px; background: white; border-radius: 10px;">
                <h3 style="margin-bottom:5px; color: #333;">${store.get('settings').storeName || 'Kiryana Store'}</h3>
                <h4 style="margin-bottom:5px; color: #555;">${name}</h4>
                <p style="font-size:0.85rem; margin-bottom:10px; color: #777;">Size: ${size} | Price: Rs. ${code}</p>
                <div id="qrcode-canvas" style="padding:15px; background:white; border: 1px solid #eee;"></div>
                <p style="font-size:0.7rem; margin-top:10px; color: #999;">Scan to add to bill</p>
            </div>
            <button class="btn-primary" id="qr-download-btn" onclick="UI.downloadQRCode('${name}', '${size}')" style="margin-top:1.5rem; background: var(--primary);">
                <i class="fa-solid fa-download"></i> Download QR Image
            </button>
        `);

        setTimeout(() => {
            new QRCode(document.getElementById("qrcode-canvas"), {
                text: code,
                width: 200,
                height: 200,
                colorDark : "#000000",
                colorLight : "#ffffff",
                correctLevel : QRCode.CorrectLevel.H
            });
        }, 150);
    },

    downloadQRCode(name, size) {
        const btn = document.getElementById('qr-download-btn');
        const originalHTML = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
        btn.disabled = true;

        const area = document.getElementById('qrcode-download-area');
        
        html2canvas(area, {
            backgroundColor: '#ffffff',
            scale: 3, // Very high quality for printing later
            logging: false,
            useCORS: true
        }).then(canvas => {
            const link = document.createElement('a');
            link.download = `QR-${name.replace(/\s+/g, '-').toLowerCase()}-${size.replace(/\s+/g, '-').toLowerCase()}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
            
            btn.innerHTML = '<i class="fa-solid fa-check"></i> Saved to Gallery';
            this.showToast('QR Image Downloaded');
            setTimeout(() => {
                btn.innerHTML = originalHTML;
                btn.disabled = false;
            }, 2000);
        }).catch(err => {
            console.error(err);
            this.showToast('Download Error');
            btn.innerHTML = originalHTML;
            btn.disabled = false;
        });
    },


    doFullSeed() {
        if (confirm('This will load 200+ common items into your inventory. Continue?')) {
            store.seedFullInventory();
            this.showToast('200+ Items Loaded!');
            this.renderView('products');
        }
    },

    saveFirebaseConfig() {
        const apiKey = document.getElementById('fb-apiKey').value.trim();
        const projectId = document.getElementById('fb-projectId').value.trim();
        
        if (!apiKey || !projectId) return this.showToast('Fill all fields');

        const settings = store.get('settings');
        settings.firebaseConfig = {
            apiKey: apiKey,
            projectId: projectId,
            authDomain: `${projectId}.firebaseapp.com`,
            storageBucket: `${projectId}.appspot.com`,
            messagingSenderId: "123456789", // Dummy
            appId: "1:123456789:web:abcdef" // Dummy
        };
        
        store.save('settings', settings);
        this.showToast('Config Saved! Reloading app...');
        setTimeout(() => location.reload(), 2000);
    },

    async syncCloudManual() {
        const btn = event.target.closest('button');
        const originalHTML = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Syncing...';
        btn.disabled = true;

        try {
            await store.syncWithCloud();
            this.showToast('Cloud Sync Successful');
            this.renderView('settings');
        } catch (err) {
            this.showToast('Sync Error: ' + err.message);
        } finally {
            btn.innerHTML = originalHTML;
            btn.disabled = false;
        }
    },

    disconnectFirebase() {
        if (confirm('Are you sure you want to disconnect Cloud Sync? Your local data will remain.')) {
            const settings = store.get('settings');
            delete settings.firebaseConfig;
            store.save('settings', settings);
            this.showToast('Firebase Disconnected. Reloading...');
            setTimeout(() => location.reload(), 1500);
        }
    }


};

UI.init();

// Polyfill for filterProducts and other dynamic functions to be globally accessible if triggered via onclick
window.UI = UI;
