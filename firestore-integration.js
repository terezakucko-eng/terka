// =====================================================
// FIRESTORE INTEGRACE - Databázové operace
// =====================================================

// Kolekce v Firestore
const COLLECTIONS = {
    ORDERS: 'orders',
    CAMPAIGNS: 'campaigns',
    SETTINGS: 'settings'
};

let useFirestore = false;

// =====================================================
// INICIALIZACE
// =====================================================

async function initDatabase() {
    const firebaseInitialized = await initFirebase();
    useFirestore = firebaseInitialized;

    if (useFirestore) {
        console.log('📊 Používám Firestore databázi');
    } else {
        console.log('💾 Používám LocalStorage (fallback)');
    }

    return useFirestore;
}

// =====================================================
// OBJEDNÁVKY - Firestore operace
// =====================================================

async function loadOrdersFromFirestore() {
    if (!useFirestore) return loadOrdersFromLocalStorage();

    try {
        const db = window.getFirestore();
        const snapshot = await db.collection(COLLECTIONS.ORDERS).get();

        const orders = [];
        snapshot.forEach(doc => {
            orders.push({
                firestoreId: doc.id,
                ...doc.data()
            });
        });

        console.log(`✅ Načteno ${orders.length} objednávek z Firestore`);
        return orders;
    } catch (error) {
        console.error('❌ Chyba při načítání objednávek:', error);
        return loadOrdersFromLocalStorage();
    }
}

async function saveOrdersToFirestore(orders) {
    if (!useFirestore) return saveOrdersToLocalStorage(orders);

    try {
        const db = window.getFirestore();
        const batch = db.batch();

        // Smazat všechny existující záznamy
        const existingOrders = await db.collection(COLLECTIONS.ORDERS).get();
        existingOrders.forEach(doc => {
            batch.delete(doc.ref);
        });

        // Přidat nové záznamy
        orders.forEach(order => {
            const docRef = db.collection(COLLECTIONS.ORDERS).doc();
            batch.set(docRef, {
                id: order.id,
                market: order.market,
                competitor: order.competitor,
                discoveryDate: order.discoveryDate,
                orderNumber: order.orderNumber,
                notes: order.notes || '',
                orderDelta: order.orderDelta || 0,
                marketShare: order.marketShare || 0,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        });

        await batch.commit();
        console.log(`✅ Uloženo ${orders.length} objednávek do Firestore`);
        return true;
    } catch (error) {
        console.error('❌ Chyba při ukládání objednávek:', error);
        return saveOrdersToLocalStorage(orders);
    }
}

async function addOrderToFirestore(order) {
    if (!useFirestore) return addOrderToLocalStorage(order);

    try {
        const db = window.getFirestore();
        const docRef = await db.collection(COLLECTIONS.ORDERS).add({
            id: order.id,
            market: order.market,
            competitor: order.competitor,
            discoveryDate: order.discoveryDate,
            orderNumber: order.orderNumber,
            notes: order.notes || '',
            orderDelta: order.orderDelta || 0,
            marketShare: order.marketShare || 0,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        console.log('✅ Objednávka přidána do Firestore:', docRef.id);
        return docRef.id;
    } catch (error) {
        console.error('❌ Chyba při přidávání objednávky:', error);
        return addOrderToLocalStorage(order);
    }
}

async function updateOrderInFirestore(orderId, orderData) {
    if (!useFirestore) return updateOrderInLocalStorage(orderId, orderData);

    try {
        const db = window.getFirestore();
        const snapshot = await db.collection(COLLECTIONS.ORDERS)
            .where('id', '==', orderId)
            .get();

        if (snapshot.empty) {
            console.warn('⚠️ Objednávka nenalezena v Firestore');
            return false;
        }

        const docRef = snapshot.docs[0].ref;
        await docRef.update({
            ...orderData,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        console.log('✅ Objednávka aktualizována v Firestore');
        return true;
    } catch (error) {
        console.error('❌ Chyba při aktualizaci objednávky:', error);
        return updateOrderInLocalStorage(orderId, orderData);
    }
}

async function deleteOrderFromFirestore(orderId) {
    if (!useFirestore) return deleteOrderFromLocalStorage(orderId);

    try {
        const db = window.getFirestore();
        const snapshot = await db.collection(COLLECTIONS.ORDERS)
            .where('id', '==', orderId)
            .get();

        if (snapshot.empty) {
            console.warn('⚠️ Objednávka nenalezena v Firestore');
            return false;
        }

        await snapshot.docs[0].ref.delete();
        console.log('✅ Objednávka smazána z Firestore');
        return true;
    } catch (error) {
        console.error('❌ Chyba při mazání objednávky:', error);
        return deleteOrderFromLocalStorage(orderId);
    }
}

// =====================================================
// KAMPANĚ - Firestore operace
// =====================================================

async function loadCampaignsFromFirestore() {
    if (!useFirestore) return loadCampaignsFromLocalStorage();

    try {
        const db = window.getFirestore();
        const snapshot = await db.collection(COLLECTIONS.CAMPAIGNS).get();

        const campaigns = [];
        snapshot.forEach(doc => {
            campaigns.push({
                firestoreId: doc.id,
                ...doc.data()
            });
        });

        console.log(`✅ Načteno ${campaigns.length} kampaní z Firestore`);
        return campaigns;
    } catch (error) {
        console.error('❌ Chyba při načítání kampaní:', error);
        return loadCampaignsFromLocalStorage();
    }
}

async function saveCampaignsToFirestore(campaigns) {
    if (!useFirestore) return saveCampaignsToLocalStorage(campaigns);

    try {
        const db = window.getFirestore();
        const batch = db.batch();

        // Smazat všechny existující záznamy
        const existingCampaigns = await db.collection(COLLECTIONS.CAMPAIGNS).get();
        existingCampaigns.forEach(doc => {
            batch.delete(doc.ref);
        });

        // Přidat nové záznamy
        campaigns.forEach(campaign => {
            const docRef = db.collection(COLLECTIONS.CAMPAIGNS).doc();
            batch.set(docRef, {
                ...campaign,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        });

        await batch.commit();
        console.log(`✅ Uloženo ${campaigns.length} kampaní do Firestore`);
        return true;
    } catch (error) {
        console.error('❌ Chyba při ukládání kampaní:', error);
        return saveCampaignsToLocalStorage(campaigns);
    }
}

// =====================================================
// FALLBACK - LocalStorage operace
// =====================================================

function loadOrdersFromLocalStorage() {
    const saved = localStorage.getItem('competitorOrders');
    return saved ? JSON.parse(saved) : [];
}

function saveOrdersToLocalStorage(orders) {
    localStorage.setItem('competitorOrders', JSON.stringify(orders));
}

function loadCampaignsFromLocalStorage() {
    const saved = localStorage.getItem('competitorCampaigns');
    return saved ? JSON.parse(saved) : [];
}

function saveCampaignsToLocalStorage(campaigns) {
    localStorage.setItem('competitorCampaigns', JSON.stringify(campaigns));
}

// Export funkcí
window.initDatabase = initDatabase;
window.loadOrdersFromFirestore = loadOrdersFromFirestore;
window.saveOrdersToFirestore = saveOrdersToFirestore;
window.addOrderToFirestore = addOrderToFirestore;
window.updateOrderInFirestore = updateOrderInFirestore;
window.deleteOrderFromFirestore = deleteOrderFromFirestore;
window.loadCampaignsFromFirestore = loadCampaignsFromFirestore;
window.saveCampaignsToFirestore = saveCampaignsToFirestore;
