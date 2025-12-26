// =====================================================
// FIRESTORE INTEGRACE PRO TRACKING DATA - Live Sync
// =====================================================

let useFirestore = false;
let unsubscribeTracking = null;
let unsubscribeCampaigns = null;

// =====================================================
// INICIALIZACE
// =====================================================

async function initFirestoreTracking() {
    const firebaseInitialized = await initFirebase();
    useFirestore = firebaseInitialized;

    if (useFirestore) {
        console.log('✅ Firestore připojen - data budou sdílená');
        // Nastavit realtime listeners
        setupRealtimeListeners();
    } else {
        console.log('⚠️ Používám LocalStorage - data pouze v tomto prohlížeči');
    }

    return useFirestore;
}

// =====================================================
// REALTIME SYNCHRONIZACE
// =====================================================

function setupRealtimeListeners() {
    if (!useFirestore) return;

    const db = window.getFirestore();

    // Listener pro tracking data
    unsubscribeTracking = db.collection('trackingData')
        .orderBy('date', 'desc')
        .onSnapshot((snapshot) => {
            console.log('🔄 Tracking data aktualizována v reálném čase');

            const data = [];
            snapshot.forEach(doc => {
                data.push({
                    firestoreId: doc.id,
                    ...doc.data()
                });
            });

            // Aktualizovat lokální data
            window.trackingData = data;

            // Aktualizovat UI
            if (typeof renderTrackingTable === 'function') {
                renderTrackingTable();
            }
            if (typeof updateMetricsDisplay === 'function') {
                updateMetricsDisplay();
            }
        }, (error) => {
            console.error('❌ Chyba při realtime sync tracking data:', error);
        });

    // Listener pro kampaně
    unsubscribeCampaigns = db.collection('campaigns')
        .orderBy('discoveryDate', 'desc')
        .onSnapshot((snapshot) => {
            console.log('🔄 Kampaně aktualizovány v reálném čase');

            const campaigns = [];
            snapshot.forEach(doc => {
                campaigns.push({
                    firestoreId: doc.id,
                    ...doc.data()
                });
            });

            // Aktualizovat lokální data
            window.mktCampaignData = campaigns;

            // Aktualizovat UI
            if (typeof renderMktTable === 'function') {
                renderMktTable();
            }
            if (typeof updateMktChart === 'function') {
                updateMktChart();
            }
        }, (error) => {
            console.error('❌ Chyba při realtime sync kampaní:', error);
        });

    console.log('👂 Realtime listeners aktivní');
}

// =====================================================
// TRACKING DATA - Firestore operace
// =====================================================

async function loadTrackingDataFromFirestore() {
    if (!useFirestore) return loadTrackingDataFromLocalStorage();

    try {
        const db = window.getFirestore();
        const snapshot = await db.collection('trackingData')
            .orderBy('date', 'desc')
            .get();

        const data = [];
        snapshot.forEach(doc => {
            data.push({
                firestoreId: doc.id,
                ...doc.data()
            });
        });

        console.log(`✅ Načteno ${data.length} tracking záznamů z Firestore`);
        return data;
    } catch (error) {
        console.error('❌ Chyba při načítání tracking data:', error);
        return loadTrackingDataFromLocalStorage();
    }
}

async function saveTrackingRecordToFirestore(record) {
    if (!useFirestore) return saveTrackingDataToLocalStorage();

    try {
        const db = window.getFirestore();

        // Pokud má záznam firestoreId, aktualizuj ho
        if (record.firestoreId) {
            await db.collection('trackingData').doc(record.firestoreId).update({
                id: record.id,
                date: record.date,
                competitors: record.competitors || {},
                deltas: record.deltas || {},
                totalOrders: record.totalOrders || 0,
                slonShare: record.slonShare || 0,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            console.log('✅ Tracking záznam aktualizován v Firestore');
        } else {
            // Jinak vytvoř nový
            const docRef = await db.collection('trackingData').add({
                id: record.id,
                date: record.date,
                competitors: record.competitors || {},
                deltas: record.deltas || {},
                totalOrders: record.totalOrders || 0,
                slonShare: record.slonShare || 0,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            console.log('✅ Tracking záznam přidán do Firestore:', docRef.id);
            return docRef.id;
        }
    } catch (error) {
        console.error('❌ Chyba při ukládání tracking záznamu:', error);
        saveTrackingDataToLocalStorage();
    }
}

async function deleteTrackingRecordFromFirestore(recordId) {
    if (!useFirestore) return deleteTrackingRecordFromLocalStorage(recordId);

    try {
        const db = window.getFirestore();

        // Najdi záznam podle ID
        const snapshot = await db.collection('trackingData')
            .where('id', '==', parseInt(recordId))
            .get();

        if (snapshot.empty) {
            console.warn('⚠️ Tracking záznam nenalezen v Firestore');
            return false;
        }

        // Smaž ho
        await snapshot.docs[0].ref.delete();
        console.log('✅ Tracking záznam smazán z Firestore');
        return true;
    } catch (error) {
        console.error('❌ Chyba při mazání tracking záznamu:', error);
        return deleteTrackingRecordFromLocalStorage(recordId);
    }
}

// =====================================================
// KAMPANĚ - Firestore operace
// =====================================================

async function loadCampaignsFromFirestore() {
    if (!useFirestore) return loadCampaignsFromLocalStorage();

    try {
        const db = window.getFirestore();
        const snapshot = await db.collection('campaigns')
            .orderBy('discoveryDate', 'desc')
            .get();

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

async function saveCampaignToFirestore(campaign) {
    if (!useFirestore) return saveCampaignsToLocalStorage();

    try {
        const db = window.getFirestore();

        // Pokud má kampaň firestoreId, aktualizuj ji
        if (campaign.firestoreId) {
            await db.collection('campaigns').doc(campaign.firestoreId).update({
                id: campaign.id,
                competitor: campaign.competitor || '',
                channel: campaign.channel || '',
                discoveryDate: campaign.discoveryDate || '',
                notes: campaign.notes || '',
                screenshotUrl: campaign.screenshotUrl || '',
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            console.log('✅ Kampaň aktualizována v Firestore');
        } else {
            // Jinak vytvoř novou
            const docRef = await db.collection('campaigns').add({
                id: campaign.id,
                competitor: campaign.competitor || '',
                channel: campaign.channel || '',
                discoveryDate: campaign.discoveryDate || '',
                notes: campaign.notes || '',
                screenshotUrl: campaign.screenshotUrl || '',
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            console.log('✅ Kampaň přidána do Firestore:', docRef.id);
            return docRef.id;
        }
    } catch (error) {
        console.error('❌ Chyba při ukládání kampaně:', error);
        saveCampaignsToLocalStorage();
    }
}

async function deleteCampaignFromFirestore(campaignId) {
    if (!useFirestore) return deleteCampaignFromLocalStorage(campaignId);

    try {
        const db = window.getFirestore();

        // Najdi kampaň podle ID
        const snapshot = await db.collection('campaigns')
            .where('id', '==', parseInt(campaignId))
            .get();

        if (snapshot.empty) {
            console.warn('⚠️ Kampaň nenalezena v Firestore');
            return false;
        }

        // Smaž ji
        await snapshot.docs[0].ref.delete();
        console.log('✅ Kampaň smazána z Firestore');
        return true;
    } catch (error) {
        console.error('❌ Chyba při mazání kampaně:', error);
        return deleteCampaignFromLocalStorage(campaignId);
    }
}

// =====================================================
// FALLBACK - LocalStorage operace
// =====================================================

function loadTrackingDataFromLocalStorage() {
    const saved = localStorage.getItem('trackingData');
    return saved ? JSON.parse(saved) : [];
}

function saveTrackingDataToLocalStorage() {
    localStorage.setItem('trackingData', JSON.stringify(window.trackingData || []));
}

function deleteTrackingRecordFromLocalStorage(recordId) {
    if (!window.trackingData) return false;

    const index = window.trackingData.findIndex(r => r.id === parseInt(recordId));
    if (index === -1) return false;

    window.trackingData.splice(index, 1);
    saveTrackingDataToLocalStorage();
    return true;
}

function loadCampaignsFromLocalStorage() {
    const saved = localStorage.getItem('competitorCampaigns');
    return saved ? JSON.parse(saved) : [];
}

function saveCampaignsToLocalStorage() {
    localStorage.setItem('competitorCampaigns', JSON.stringify(window.mktCampaignData || []));
}

function deleteCampaignFromLocalStorage(campaignId) {
    if (!window.mktCampaignData) return false;

    const index = window.mktCampaignData.findIndex(c => c.id === parseInt(campaignId));
    if (index === -1) return false;

    window.mktCampaignData.splice(index, 1);
    saveCampaignsToLocalStorage();
    return true;
}

// =====================================================
// CLEANUP
// =====================================================

function cleanupFirestoreListeners() {
    if (unsubscribeTracking) {
        unsubscribeTracking();
        console.log('👋 Tracking listener odpojen');
    }
    if (unsubscribeCampaigns) {
        unsubscribeCampaigns();
        console.log('👋 Campaigns listener odpojen');
    }
}

// Odpojit listeners při zavření stránky
window.addEventListener('beforeunload', cleanupFirestoreListeners);

// =====================================================
// EXPORT
// =====================================================

window.initFirestoreTracking = initFirestoreTracking;
window.loadTrackingDataFromFirestore = loadTrackingDataFromFirestore;
window.saveTrackingRecordToFirestore = saveTrackingRecordToFirestore;
window.deleteTrackingRecordFromFirestore = deleteTrackingRecordFromFirestore;
window.loadCampaignsFromFirestore = loadCampaignsFromFirestore;
window.saveCampaignToFirestore = saveCampaignToFirestore;
window.deleteCampaignFromFirestore = deleteCampaignFromFirestore;
window.useFirestore = () => useFirestore;
