// =====================================================
// SLEDOVÁNÍ KONKURENCE - RŮŽOVÝ SLON
// Aplikace pro sledování objednávek a marketingových kampaní konkurence
// =====================================================

// ----- KONFIGURACE A KONSTANTY -----
const STORAGE_KEY_ORDERS = 'competitorOrders';
const STORAGE_KEY_CAMPAIGNS = 'competitorCampaigns';
const STORAGE_KEY_SETTINGS = 'appSettings';

const MARKETS = ["CZ", "SK", "HU", "RO", "SI", "HR", "BG", "PL", "AT", "IT"];

const MKT_COMPETITORS = [
    "Růžový Slon", "Sexshop.cz", "e-kondomy.cz", "Flagranti.cz", "YOO.cz",
    "Erosstar.cz", "Deeplove.cz", "Hopnato.cz", "sexshopik.cz", "honitka.cz",
    "eroticke-pomucky.cz", "sexicekshop.cz", "sex-shop69.cz", "eroticcity.cz",
    "kondomshop.cz"
].sort();

const MKT_CHANNELS = [
    "Newsletter", "HP - web", "Soc. média", "TV", "Rádio",
    "Billboardy", "SMS", "PPC reklama", "SEO/Obsah", "Display/Bannery",
    "Affiliate", "Ostatní"
];

const COMPETITORS_BY_MARKET = [
    // Růžový Slon Group
    { name: "Růžový Slon", domain: "ruzovyslon.cz", market: "CZ" },
    { name: "Růžový Slon", domain: "ruzovyslon.sk", market: "SK" },
    { name: "Sexy Elephant", domain: "sexyelephant.hu", market: "HU" },
    { name: "Sexy Elephant", domain: "sexyelephant.ro", market: "RO" },
    { name: "Sexy Elephant", domain: "sexyelephant.si", market: "SI" },
    { name: "Sexy Elephant", domain: "sexyelephant.bg", market: "BG" },
    { name: "Sexy Elephant", domain: "sexyelephant.hr", market: "HR" },

    // CZ konkurence
    { name: "Sexshop.cz", domain: "sexshop.cz", market: "CZ" },
    { name: "e-kondomy.cz", domain: "e-kondomy.cz", market: "CZ" },
    { name: "Flagranti.cz", domain: "flagranti.cz", market: "CZ" },
    { name: "YOO.cz", domain: "yoo.cz", market: "CZ" },
    { name: "Erosstar.cz", domain: "erosstar.cz", market: "CZ" },
    { name: "Deeplove.cz", domain: "deeplove.cz", market: "CZ" },
    { name: "sexshopik.cz", domain: "sexshopik.cz", market: "CZ" },
    { name: "honitka.cz", domain: "honitka.cz", market: "CZ" },
    { name: "eroticke-pomucky.cz", domain: "eroticke-pomucky.cz", market: "CZ" },
    { name: "Hopnato.cz", domain: "hopnato.cz", market: "CZ" },

    // SK konkurence
    { name: "superlove.sk", domain: "superlove.sk", market: "SK" },
    { name: "eros.sk", domain: "eros.sk", market: "SK" },
    { name: "isexshop.sk", domain: "isexshop.sk", market: "SK" },
    { name: "kondomshop.sk", domain: "kondomshop.sk", market: "SK" },
    { name: "sexiveci.sk", domain: "sexiveci.sk", market: "SK" },
];

// Sytější barevná paleta pro lepší viditelnost v grafech
const CHART_COLORS = [
    '#ff69b4', // živě růžová
    '#4169e1', // královská modrá
    '#9370db', // středně fialová
    '#32cd32', // limetkově zelená
    '#ffd700', // zlatá
    '#ff1493', // tmavě růžová
    '#8a2be2', // fialová
    '#ff6347', // rajčatová
    '#20b2aa', // světle mořská
    '#ff69b4', // orchidej
    '#ba55d3', // středně orchidej
    '#6495ed', // cornflower blue
    '#00bfff', // deep sky blue
    '#7fff00', // chartreuse
    '#ffa500'  // oranžová
];

// ----- GLOBÁLNÍ PROMĚNNÉ -----
let orderData = [];
// Použít window.window.mktCampaignData pro sdílení s Firestore realtime listener
if (!window.window.mktCampaignData) {
    window.window.mktCampaignData = [];
}
let charts = {
    trend: null,
    delta: null,
    marketShare: null,
    mktActivity: null
};

// =====================================================
// INICIALIZACE APLIKACE
// =====================================================

async function initializeApp() {
    // Zobrazení loading stavu
    console.log('🚀 Inicializace aplikace...');

    // Inicializace Firebase databáze s realtime sync
    if (typeof initFirestoreTracking === 'function') {
        const dbInitialized = await initFirestoreTracking();
        if (dbInitialized) {
            console.log('✅ Firestore připojen - data budou sdílená v reálném čase');
        } else {
            console.log('⚠️ Používám LocalStorage - data pouze v tomto prohlížeči');
        }
    }

    // Načtení tracking dat (nová struktura)
    await loadTrackingData();
    calculateDeltas();

    // Vygenerovat formulářová pole pro e-shopy
    if (typeof renderFormFields === 'function') {
        renderFormFields();
    }

    renderTrackingTable();

    // Aktualizovat metriky po načtení dat
    if (typeof updateMetricsDisplay === 'function') {
        updateMetricsDisplay();
    }

    // Načtení dat z databáze (kampaně)
    await loadDataFromStorage();

    // Nastavení UI
    setupMktTab();
    setupModals();

    // Inicializace grafů pro sledování objednávek
    console.log('📊 Inicializace grafů...');
    initTrendChart();
    initDeltaChart();
    initMarketShareChart();

    // Přidat event listenery pro filtry grafů
    const trendPeriodFilter = document.getElementById('trend-period-filter');
    const trendEshopsFilter = document.getElementById('trend-eshops-filter');
    const trendTypeFilter = document.getElementById('trend-type-filter');
    const deltaMarketFilter = document.getElementById('delta-market-filter');
    const deltaEshopsFilter = document.getElementById('delta-eshops-filter');

    if (trendPeriodFilter) trendPeriodFilter.addEventListener('change', updateTrendChart);
    if (trendEshopsFilter) trendEshopsFilter.addEventListener('change', updateTrendChart);
    if (trendTypeFilter) trendTypeFilter.addEventListener('change', updateTrendChart);

    // Inicializovat delta e-shops filter
    if (deltaMarketFilter) {
        updateDeltaEshopsFilter();
    }

    // Event listenery pro datová pole delta grafu nejsou potřeba - uživatel klikne na tlačítko

    // Aktualizovat všechny grafy s načtenými daty
    updateAllCharts();

    showTab('order-tracking');

    // Nastavení aktuálního data jako výchozí v formulářích
    const today = new Date().toISOString().split('T')[0];
    if (document.getElementById('record-date')) {
        document.getElementById('record-date').value = today;
    }
    if (document.getElementById('discoveryDate-mkt')) {
        document.getElementById('discoveryDate-mkt').value = today;
    }

    console.log('✅ Aplikace připravena k použití');
}

// =====================================================
// SPRÁVA DAT (Firestore + LocalStorage fallback)
// =====================================================

async function loadDataFromStorage() {
    try {
        // Načtení objednávek z Firestore
        const orders = await loadOrdersFromFirestore();
        if (orders && orders.length > 0) {
            orderData = orders;
        }

        // Načtení kampaní z Firestore
        const campaigns = await loadCampaignsFromFirestore();
        if (campaigns && campaigns.length > 0) {
            window.mktCampaignData = campaigns;
        }

        console.log(`✅ Načteno ${orderData.length} objednávek a ${window.mktCampaignData.length} kampaní`);
    } catch (e) {
        console.error('Chyba při načítání dat:', e);
        orderData = [];
        window.mktCampaignData = [];
    }
}

async function saveOrdersToStorage() {
    try {
        await saveOrdersToFirestore(orderData);
    } catch (e) {
        console.error('Chyba při ukládání objednávek:', e);
        alert('Nepodařilo se uložit data. Zkontrolujte připojení k databázi.');
    }
}

async function saveCampaignsToStorage() {
    try {
        // Uložit do LocalStorage jako fallback
        localStorage.setItem('competitorCampaigns', JSON.stringify(window.mktCampaignData));
    } catch (e) {
        console.error('Chyba při ukládání kampaní:', e);
    }
}

// =====================================================
// IMPORT/EXPORT DAT
// =====================================================

async function importFromGoogleSheets() {
    const url = document.getElementById('google-sheets-url').value.trim();

    if (!url) {
        alert('Zadejte URL Google Sheets tabulky');
        return;
    }

    // Extrahování Spreadsheet ID
    const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (!match) {
        alert('Neplatná URL Google Sheets');
        return;
    }

    const spreadsheetId = match[1];

    // Pro každý trh zkusíme importovat data z listu "Zkušeb.obj. {MARKET}"
    let importedCount = 0;
    const errors = [];

    for (const market of MARKETS) {
        try {
            const sheetName = `Zkušeb.obj. ${market}`;
            const csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;

            const response = await fetch(csvUrl);
            if (!response.ok) {
                errors.push(`${market}: List nenalezen nebo není přístupný`);
                continue;
            }

            const csvText = await response.text();
            const imported = parseOrderCSV(csvText, market);
            importedCount += imported;

        } catch (e) {
            errors.push(`${market}: ${e.message}`);
        }
    }

    if (importedCount > 0) {
        saveOrdersToStorage();
        calculateOrderMetrics();
        renderOrderTable();
        updateAllCharts();
        alert(`Úspěšně importováno ${importedCount} záznamů!\n\n${errors.length > 0 ? 'Chyby:\n' + errors.join('\n') : ''}`);
        closeDataManagementModal();
    } else {
        alert('Nepodařilo se importovat žádná data.\n\n' + errors.join('\n'));
    }
}

function parseOrderCSV(csvText, market) {
    const lines = csvText.split('\n');
    if (lines.length < 2) return 0;

    let importedCount = 0;

    // Předpokládáme strukturu: Datum, Konkurent, Číslo objednávky, Poznámky
    // První řádek je záhlaví
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Jednoduchý CSV parser (může mít problémy s čárkami v textu)
        const columns = line.split(',').map(col => col.replace(/^"|"$/g, '').trim());

        if (columns.length < 3) continue;

        const date = columns[0];
        const competitor = columns[1];
        const orderNumber = parseInt(columns[2]);
        const notes = columns[3] || '';

        if (!date || !competitor || isNaN(orderNumber)) continue;

        // Konverze data do formátu YYYY-MM-DD
        const formattedDate = formatDateForStorage(date);
        if (!formattedDate) continue;

        // Přidání záznamu
        orderData.push({
            id: Date.now() + i,
            market: market,
            competitor: competitor,
            discoveryDate: formattedDate,
            orderNumber: orderNumber,
            notes: notes,
            orderDelta: 0,
            marketShare: 0
        });

        importedCount++;
    }

    return importedCount;
}

function formatDateForStorage(dateStr) {
    // Zkusí parsovat různé formáty data
    const formats = [
        // DD.MM.YYYY nebo DD/MM/YYYY
        /^(\d{1,2})[\.\/](\d{1,2})[\.\/](\d{4})$/,
        // YYYY-MM-DD
        /^(\d{4})-(\d{1,2})-(\d{1,2})$/,
        // MM/DD/YYYY
        /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/
    ];

    for (let format of formats) {
        const match = dateStr.match(format);
        if (match) {
            let year, month, day;

            if (format.source.startsWith('^(\\d{4})')) {
                // YYYY-MM-DD
                year = match[1];
                month = match[2].padStart(2, '0');
                day = match[3].padStart(2, '0');
            } else if (format.source.startsWith('^(\\d{1,2})[\\.\\/](\\d{1,2})')) {
                // DD.MM.YYYY nebo DD/MM/YYYY
                day = match[1].padStart(2, '0');
                month = match[2].padStart(2, '0');
                year = match[3];
            } else {
                // MM/DD/YYYY
                month = match[1].padStart(2, '0');
                day = match[2].padStart(2, '0');
                year = match[3];
            }

            return `${year}-${month}-${day}`;
        }
    }

    return null;
}

function importFromJSON() {
    const fileInput = document.getElementById('json-file-input');
    const file = fileInput.files[0];

    if (!file) {
        alert('Vyberte JSON soubor');
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);

            if (data.orders) {
                orderData = data.orders;
                saveOrdersToStorage();
                calculateOrderMetrics();
                renderOrderTable();
                updateAllCharts();
            }

            if (data.campaigns) {
                window.mktCampaignData = data.campaigns;
                saveCampaignsToStorage();
                renderMktTable();
                updateMktChart();
            }

            alert('Data byla úspěšně importována!');
            closeDataManagementModal();

        } catch (err) {
            alert('Chyba při načítání JSON souboru: ' + err.message);
        }
    };

    reader.readAsText(file);
}

function exportToJSON() {
    const data = {
        orders: orderData,
        campaigns: window.mktCampaignData,
        exportDate: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `konkurence-data-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function exportToCSV() {
    // Export objednávek
    let csv = 'Trh,Konkurent,Datum,Číslo objednávky,Delta objednávek,Podíl na trhu (%),Poznámky\n';

    orderData.forEach(order => {
        csv += `${order.market},"${order.competitor}",${order.discoveryDate},${order.orderNumber},${order.orderDelta},${order.marketShare.toFixed(2)},"${order.notes.replace(/"/g, '""')}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `objednavky-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

function clearAllData() {
    if (confirm('Opravdu chcete vymazat VŠECHNA data? Tato akce je nevratná!\n\nDoporučujeme nejprve exportovat data jako zálohu.')) {
        if (confirm('Jste si jisti? Toto je poslední varování!')) {
            // Vymazat tracking data
            window.trackingData = [];
            localStorage.removeItem('trackingData');

            // Vymazat tracking data z Firestore
            if (typeof clearAllTrackingDataFromFirestore === 'function') {
                clearAllTrackingDataFromFirestore().then(() => {
                    console.log('✅ Data smazána z Firestore');
                }).catch(err => {
                    console.error('❌ Chyba při mazání z Firestore:', err);
                });
            }

            // Překreslit tabulky
            if (typeof renderTrackingTable === 'function') {
                renderTrackingTable();
            }
            if (typeof updateMetricsDisplay === 'function') {
                updateMetricsDisplay();
            }
            if (typeof updateAllCharts === 'function') {
                updateAllCharts();
            }

            alert('Všechna data byla vymazána.');
            if (typeof closeDataManagementModal === 'function') {
                closeDataManagementModal();
            }
        }
    }
}

// =====================================================
// EXPORT DAT
// =====================================================

// Helper funkce pro escapování CSV hodnot
function escapeCSV(value) {
    if (value === null || value === undefined) return '';
    const str = String(value);
    // Pokud obsahuje čárku, uvozovky nebo nový řádek, obalit do uvozovek
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
}

// Helper funkce pro stažení CSV
function downloadCSV(csvContent, filename) {
    const BOM = '\uFEFF'; // UTF-8 BOM pro správné zobrazení v Excelu
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Export sledování konkurence
window.exportCompetitorDataToCSV = function() {
    if (!window.trackingData || window.trackingData.length === 0) {
        alert('❌ Žádná data k exportu');
        return;
    }

    console.log('📤 Exportuji data sledování konkurence...');

    // Získat všechny e-shopy ze všech záznamů
    const allEshops = new Set();
    window.trackingData.forEach(record => {
        if (record.competitors) {
            Object.keys(record.competitors).forEach(eshop => allEshops.add(eshop));
        }
        if (record.deltas) {
            Object.keys(record.deltas).forEach(eshop => allEshops.add(eshop));
        }
    });
    const eshopList = Array.from(allEshops).sort();

    // Hlavička CSV
    const headers = ['Datum', 'Celkem objednávek'];
    eshopList.forEach(eshop => {
        headers.push(`${eshop} - Počet`, `${eshop} - Delta`);
    });

    const rows = [headers.map(escapeCSV).join(',')];

    // Data
    window.trackingData
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .forEach(record => {
            const row = [
                record.date,
                record.totalOrders || 0
            ];

            eshopList.forEach(eshop => {
                const orderNum = record.competitors && record.competitors[eshop] !== undefined
                    ? record.competitors[eshop]
                    : '';
                const delta = record.deltas && record.deltas[eshop] !== undefined
                    ? record.deltas[eshop]
                    : '';

                row.push(orderNum, delta);
            });

            rows.push(row.map(escapeCSV).join(','));
        });

    const csvContent = rows.join('\n');
    const filename = `sledovani-konkurence-${new Date().toISOString().split('T')[0]}.csv`;

    downloadCSV(csvContent, filename);
    console.log(`✅ Export dokončen: ${filename}`);
    alert(`✅ Data exportována do souboru:\n${filename}`);
}

// Export MKT kampaní
window.exportMKTCampaignsToCSV = function() {
    const campaigns = localStorage.getItem('mktCampaigns');

    if (!campaigns) {
        alert('❌ Žádné MKT kampaně k exportu');
        return;
    }

    const mktCampaigns = JSON.parse(campaigns);

    if (!mktCampaigns || mktCampaigns.length === 0) {
        alert('❌ Žádné MKT kampaně k exportu');
        return;
    }

    console.log('📤 Exportuji data MKT kampaní...');

    // Hlavička CSV
    const headers = [
        'Název kampaně',
        'Typ kampaně',
        'Období od',
        'Období do',
        'Zdroj',
        'Rozpočet (Kč)',
        'Objednávky',
        'CPO (Kč)',
        'Newsletter text'
    ];

    const rows = [headers.map(escapeCSV).join(',')];

    // Data
    mktCampaigns.forEach(campaign => {
        const row = [
            campaign.name || '',
            campaign.type || '',
            campaign.periodFrom || '',
            campaign.periodTo || '',
            campaign.source || '',
            campaign.budget || '',
            campaign.orders || '',
            campaign.cpo || '',
            campaign.newsletterText || ''
        ];

        rows.push(row.map(escapeCSV).join(','));
    });

    const csvContent = rows.join('\n');
    const filename = `mkt-kampane-${new Date().toISOString().split('T')[0]}.csv`;

    downloadCSV(csvContent, filename);
    console.log(`✅ Export dokončen: ${filename}`);
    alert(`✅ MKT kampaně exportovány do souboru:\n${filename}`);
}

// =====================================================
// OPRAVA ČÍSELNÉ ŘADY E-SHOPU
// =====================================================

// Funkce pro reset číselné řady e-shopu (např. když začnou počítat od nuly)
window.resetEshopNumberSequence = function(eshopDomain, dateStr, newOrderNumber) {
    if (!window.trackingData || window.trackingData.length === 0) {
        alert('❌ Žádná data k úpravě');
        return false;
    }

    // Najít záznam pro dané datum
    const record = window.trackingData.find(r => r.date === dateStr);

    if (!record) {
        alert(`❌ Nenalezen záznam pro datum ${dateStr}`);
        return false;
    }

    console.log(`🔧 Resetuji číselnou řadu pro ${eshopDomain} na datum ${dateStr}`);
    console.log(`   Nové startovní číslo objednávky: ${newOrderNumber}`);

    // Inicializovat objekty pokud neexistují
    if (!record.competitors) record.competitors = {};
    if (!record.deltas) record.deltas = {};
    if (!record.firstMeasurement) record.firstMeasurement = {};
    if (!record.manualDeltas) record.manualDeltas = {};

    // Nastavit nové číslo objednávky
    record.competitors[eshopDomain] = newOrderNumber;

    // Nastavit deltu na 0 (nové měření)
    record.deltas[eshopDomain] = 0;

    // Označit jako první měření (aby se nezapočítávalo do grafů)
    record.firstMeasurement[eshopDomain] = true;

    // Odstranit manuální delta pokud existuje (už není potřeba)
    delete record.manualDeltas[eshopDomain];

    console.log(`✅ Záznam aktualizován:`, {
        competitors: record.competitors[eshopDomain],
        deltas: record.deltas[eshopDomain],
        firstMeasurement: record.firstMeasurement[eshopDomain]
    });

    // Uložit do localStorage
    localStorage.setItem('trackingData', JSON.stringify(window.trackingData));
    console.log('💾 Uloženo do localStorage');

    // Synchronizovat s Firestore pokud je dostupné
    if (typeof saveTrackingDataToFirestore === 'function') {
        saveTrackingDataToFirestore(window.trackingData)
            .then(() => {
                console.log('☁️ Synchronizováno s Firestore');
            })
            .catch(err => {
                console.error('❌ Chyba při synchronizaci s Firestore:', err);
            });
    }

    // Přepočítat všechny delty pro následující záznamy
    console.log('🔄 Přepočítávám delty...');
    if (typeof recalculateAllDeltas === 'function') {
        recalculateAllDeltas();
    }

    // Znovu načíst data a obnovit grafy
    if (typeof loadTrackingData === 'function') {
        loadTrackingData();
    }
    if (typeof renderCharts === 'function') {
        renderCharts();
    }

    alert(`✅ Číselná řada pro ${eshopDomain} byla resetována!\n\nDatum: ${dateStr}\nNové číslo: ${newOrderNumber}\nDelta: 0`);
    return true;
}

// Pomocná funkce pro rychlé použití z konzole
window.fixHopnato = function() {
    return resetEshopNumberSequence('hopnato.cz', '2025-05-12', 2615961);
}

// =====================================================
// HROMADNÉ VLOŽENÍ DAT
// =====================================================

// Globální proměnná pro uložení dat z bulk tabulky
let bulkDataRows = [];

window.addBulkRow = function() {
    const tbody = document.getElementById('bulk-data-tbody');
    const row = document.createElement('tr');
    row.className = 'hover:bg-gray-50';

    const today = new Date().toISOString().split('T')[0];

    row.innerHTML = `
        <td class="px-3 py-2">
            <input type="text" class="bulk-eshop w-full px-2 py-1 border rounded text-sm" placeholder="ruzovyslon.cz" list="eshop-list">
        </td>
        <td class="px-3 py-2">
            <input type="date" class="bulk-date w-full px-2 py-1 border rounded text-sm" value="${today}">
        </td>
        <td class="px-3 py-2">
            <input type="number" class="bulk-order-number w-full px-2 py-1 border rounded text-sm" placeholder="12345">
        </td>
        <td class="px-3 py-2">
            <input type="number" class="bulk-order-count w-full px-2 py-1 border rounded text-sm" placeholder="50">
        </td>
        <td class="px-3 py-2">
            <button onclick="removeBulkRow(this)" class="text-red-600 hover:text-red-800 text-sm font-semibold">Smazat</button>
        </td>
    `;

    tbody.appendChild(row);

    // Přidat paste handler pro Excel
    const firstInput = row.querySelector('.bulk-eshop');
    firstInput.addEventListener('paste', handleExcelPaste);
};

window.removeBulkRow = function(button) {
    button.closest('tr').remove();
};

window.clearBulkTable = function() {
    if (confirm('Opravdu chcete vymazat všechny řádky v tabulce?')) {
        document.getElementById('bulk-data-tbody').innerHTML = '';
    }
};

window.importBulkData = function() {
    const tbody = document.getElementById('bulk-data-tbody');
    const rows = tbody.querySelectorAll('tr');

    if (rows.length === 0) {
        alert('Tabulka je prázdná. Přidejte nejprve nějaké řádky.');
        return;
    }

    let importedCount = 0;
    let errors = [];

    rows.forEach((row, index) => {
        const eshop = row.querySelector('.bulk-eshop').value.trim();
        const date = row.querySelector('.bulk-date').value;
        const orderNumber = row.querySelector('.bulk-order-number').value;
        const orderCount = row.querySelector('.bulk-order-count').value;

        // Validace
        if (!eshop) {
            errors.push(`Řádek ${index + 1}: Chybí název e-shopu`);
            return;
        }
        if (!date) {
            errors.push(`Řádek ${index + 1}: Chybí datum`);
            return;
        }

        // Kontrola, zda je to vlastní e-shop nebo konkurent
        const isOwnEshop = window.OWN_ESHOPS && window.OWN_ESHOPS.includes(eshop);

        // Pro konkurenty musí být číslo objednávky
        if (!isOwnEshop && !orderNumber) {
            errors.push(`Řádek ${index + 1}: Chybí číslo objednávky pro konkurenta ${eshop}`);
            return;
        }

        // Pro vlastní e-shopy musí být počet objednávek
        if (isOwnEshop && !orderCount) {
            errors.push(`Řádek ${index + 1}: Chybí počet objednávek pro vlastní e-shop ${eshop}`);
            return;
        }

        // Přidat záznam do tracking dat (bez přepočítávání delt)
        if (typeof addBulkTrackingRecord === 'function') {
            addBulkTrackingRecord(eshop, date, orderNumber || null, orderCount || null, true); // true = skip calculateDeltas
            importedCount++;
        }
    });

    // Přepočítat delty JEDNOU pro všechny importované záznamy
    if (importedCount > 0 && typeof calculateDeltas === 'function') {
        calculateDeltas();
    }

    // Uložit data po importu
    if (importedCount > 0 && typeof saveTrackingData === 'function') {
        saveTrackingData();
    }

    if (errors.length > 0) {
        alert('Chyby při importu:\n\n' + errors.join('\n') + '\n\nImportováno: ' + importedCount + ' záznamů');
    } else {
        alert(`✅ Úspěšně importováno ${importedCount} záznamů!`);

        // Vyčistit tabulku
        document.getElementById('bulk-data-tbody').innerHTML = '';

        // Zavřít modal
        closeDataManagementModal();
    }

    // Aktualizovat UI vždy (i když byly chyby)
    if (importedCount > 0) {
        if (typeof renderTrackingTable === 'function') {
            renderTrackingTable();
        }
        if (typeof updateMetricsDisplay === 'function') {
            updateMetricsDisplay();
        }
        if (typeof updateAllCharts === 'function') {
            updateAllCharts();
        }
    }
};

// Handler pro paste z Excelu
function handleExcelPaste(e) {
    e.preventDefault();

    const clipboardData = e.clipboardData || window.clipboardData;
    const pastedData = clipboardData.getData('text');

    if (!pastedData) return;

    // Rozdělit data na řádky a buňky
    const rows = pastedData.split(/\r?\n/).filter(row => row.trim());

    // Najít tbody - buď z aktuálního řádku nebo přímo podle ID
    const currentRow = e.target.closest('tr');
    const tbody = currentRow ? currentRow.parentElement : document.getElementById('bulk-data-tbody');

    if (!tbody) {
        console.error('Tabulka pro bulk import nebyla nalezena');
        return;
    }

    // Vyčistit tabulku před vložením
    tbody.innerHTML = '';

    if (rows.length === 0) return;

    // Parsovat první řádek jako záhlaví
    const headerCells = rows[0].split('\t');

    // Detekovat formát: sloupcový (první buňka = "Datum") vs. řádkový (první buňka = název e-shopu)
    const isColumnFormat = headerCells[0] && (
        headerCells[0].toLowerCase().includes('datum') ||
        headerCells[0].toLowerCase().includes('date')
    );

    if (isColumnFormat) {
        // SLOUPCOVÝ FORMÁT: Datum | Hopnato.cz | erosstar.cz | ...
        console.log('📊 Detekován sloupcový formát (Google Sheets)');
        parseColumnFormat(rows, tbody);
    } else {
        // ŘÁDKOVÝ FORMÁT: E-shop | Datum | Číslo obj. | Počet obj.
        console.log('📋 Detekován řádkový formát');
        parseRowFormat(rows, tbody);
    }
}

// Parsování sloupcového formátu (Google Sheets)
function parseColumnFormat(rows, tbody) {
    const headerCells = rows[0].split('\t');

    // Mapovat sloupce na e-shopy (přeskočit první sloupec = Datum)
    const eshopColumns = [];
    for (let i = 1; i < headerCells.length; i++) {
        const eshopName = headerCells[i].trim();
        if (eshopName) {
            eshopColumns.push({ index: i, name: eshopName });
        }
    }

    console.log(`📋 Nalezeno ${eshopColumns.length} e-shopů:`, eshopColumns.map(c => c.name));

    // Parsovat datové řádky
    for (let rowIndex = 1; rowIndex < rows.length; rowIndex++) {
        const cells = rows[rowIndex].split('\t');

        // První buňka = datum
        let dateStr = cells[0] || '';
        let date = parseDateString(dateStr);

        // Pro každý e-shop vytvořit řádek v tabulce
        eshopColumns.forEach(eshopCol => {
            const value = cells[eshopCol.index];

            // Přeskočit prázdné hodnoty
            if (!value || value.trim() === '') return;

            const eshopName = eshopCol.name;
            const numValue = parseInt(value) || 0;

            // Zjistit, jestli je to vlastní e-shop
            const isOwnEshop = window.OWN_ESHOPS && window.OWN_ESHOPS.includes(eshopName);

            const row = document.createElement('tr');
            row.className = 'hover:bg-gray-50';

            row.innerHTML = `
                <td class="px-3 py-2">
                    <input type="text" class="bulk-eshop w-full px-2 py-1 border rounded text-sm" value="${eshopName}" list="eshop-list">
                </td>
                <td class="px-3 py-2">
                    <input type="date" class="bulk-date w-full px-2 py-1 border rounded text-sm" value="${date}">
                </td>
                <td class="px-3 py-2">
                    <input type="number" class="bulk-order-number w-full px-2 py-1 border rounded text-sm" value="${isOwnEshop ? '' : numValue}">
                </td>
                <td class="px-3 py-2">
                    <input type="number" class="bulk-order-count w-full px-2 py-1 border rounded text-sm" value="${isOwnEshop ? numValue : ''}">
                </td>
                <td class="px-3 py-2">
                    <button onclick="removeBulkRow(this)" class="text-red-600 hover:text-red-800 text-sm font-semibold">Smazat</button>
                </td>
            `;

            tbody.appendChild(row);
        });
    }
}

// Parsování řádkového formátu
function parseRowFormat(rows, tbody) {
    rows.forEach(rowData => {
        const cells = rowData.split('\t');

        if (cells.length < 2) return;

        const row = document.createElement('tr');
        row.className = 'hover:bg-gray-50';

        const eshop = cells[0] || '';
        const dateStr = cells[1] || '';
        const date = parseDateString(dateStr);
        const orderNumber = cells[2] || '';
        const orderCount = cells[3] || '';

        row.innerHTML = `
            <td class="px-3 py-2">
                <input type="text" class="bulk-eshop w-full px-2 py-1 border rounded text-sm" value="${eshop}" list="eshop-list">
            </td>
            <td class="px-3 py-2">
                <input type="date" class="bulk-date w-full px-2 py-1 border rounded text-sm" value="${date}">
            </td>
            <td class="px-3 py-2">
                <input type="number" class="bulk-order-number w-full px-2 py-1 border rounded text-sm" value="${orderNumber}">
            </td>
            <td class="px-3 py-2">
                <input type="number" class="bulk-order-count w-full px-2 py-1 border rounded text-sm" value="${orderCount}">
            </td>
            <td class="px-3 py-2">
                <button onclick="removeBulkRow(this)" class="text-red-600 hover:text-red-800 text-sm font-semibold">Smazat</button>
            </td>
        `;

        tbody.appendChild(row);
    });
}

// Pomocná funkce pro parsování data
function parseDateString(dateStr) {
    if (!dateStr) return new Date().toISOString().split('T')[0];

    // Zkusit parsovat různé formáty
    const dateMatch = dateStr.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/); // DD.MM.YYYY
    if (dateMatch) {
        const day = dateMatch[1].padStart(2, '0');
        const month = dateMatch[2].padStart(2, '0');
        const year = dateMatch[3];
        return `${year}-${month}-${day}`;
    }

    // Formát D.M.YYYY (bez nuly)
    const dateMatch2 = dateStr.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (dateMatch2) {
        const day = dateMatch2[1].padStart(2, '0');
        const month = dateMatch2[2].padStart(2, '0');
        const year = dateMatch2[3];
        return `${year}-${month}-${day}`;
    }

    // Už je ve formátu YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        return dateStr;
    }

    // Pokud nelze parsovat, použij dnešní datum
    return new Date().toISOString().split('T')[0];
}

// =====================================================
// PŘIDÁNÍ HROMADNÉHO ZÁZNAMU DO TRACKING DAT
// =====================================================

/**
 * Přidá záznam pro konkrétní e-shop a datum do tracking dat
 * @param {string} eshop - Název e-shopu
 * @param {string} date - Datum ve formátu YYYY-MM-DD
 * @param {number|null} orderNumber - Číslo objednávky (pro konkurenty)
 * @param {number|null} orderCount - Počet objednávek (pro vlastní e-shopy)
 * @param {boolean} skipDeltaCalculation - Přeskočit výpočet delt (použít při hromadném importu)
 */
function addBulkTrackingRecord(eshop, date, orderNumber, orderCount, skipDeltaCalculation = false) {
    if (!window.trackingData) {
        window.trackingData = [];
    }

    // Zjistit, jestli je to vlastní e-shop
    const isOwnEshop = window.OWN_ESHOPS && window.OWN_ESHOPS.includes(eshop);

    // Najít existující záznam pro dané datum
    let record = window.trackingData.find(r => r.date === date);

    if (!record) {
        // Vytvořit nový záznam pro toto datum
        record = {
            id: Date.now() + Math.random(), // Unikátní ID
            date: date,
            competitors: {},
            deltas: {},
            monthEndValues: {},
            notes: ''
        };

        // NEBUDEME inicializovat všechny e-shopy na 0
        // Nastaví se pouze hodnoty pro e-shopy, které skutečně importujeme
        // To zajistí, že trhy budou nezávislé - když importuješ SK data,
        // nevytvoří se záznam pro CZ trh

        window.trackingData.push(record);
    }

    // Aktualizovat hodnoty pro daný e-shop
    if (isOwnEshop) {
        // Vlastní e-shop: uložit počet objednávek do deltas
        record.deltas[eshop] = parseInt(orderCount) || 0;
        record.competitors[eshop] = 0; // Nenastavujeme číslo objednávky
    } else {
        // Konkurent: uložit číslo objednávky do competitors
        record.competitors[eshop] = parseInt(orderNumber) || 0;
        // Delta se vypočítá později v calculateDeltas()
    }

    // Seřadit data podle data
    window.trackingData.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Přepočítat delty (pro konkurenty) - pouze pokud není skipDeltaCalculation
    if (!skipDeltaCalculation && typeof calculateDeltas === 'function') {
        calculateDeltas();
    }

    // Uložit do Firestore (pokud je aktivní) - pouze pokud není skipDeltaCalculation
    if (!skipDeltaCalculation && typeof saveTrackingRecordToFirestore === 'function') {
        saveTrackingRecordToFirestore(record);
    }

    // Uložit do localStorage/Firestore - pouze pokud není skipDeltaCalculation
    if (!skipDeltaCalculation && typeof saveTrackingData === 'function') {
        saveTrackingData();
    }
}

// Export funkce
window.addBulkTrackingRecord = addBulkTrackingRecord;

// Přidat globální paste handler na bulk tabulku
window.addEventListener('DOMContentLoaded', function() {
    const bulkTableBody = document.getElementById('bulk-data-tbody');
    if (bulkTableBody) {
        // Přidat paste handler na celý tbody pro zachycení paste i když je prázdný
        bulkTableBody.addEventListener('paste', function(e) {
            // Kontrola, zda není už přidán handler na konkrétní input (přednost má specifický handler)
            if (e.target.classList.contains('bulk-eshop')) {
                return; // Nech to zpracovat handleExcelPaste na inputu
            }

            // Pokud je paste na tbody nebo jiný element, zpracuj to globálně
            handleExcelPaste(e);
        });
    }
});

// Datalist pro e-shopy
window.addEventListener('DOMContentLoaded', function() {
    // Přidat datalist do body pokud ještě neexistuje
    if (!document.getElementById('eshop-list')) {
        const datalist = document.createElement('datalist');
        datalist.id = 'eshop-list';

        const allEshops = [
            'ruzovyslon.cz', 'kondomshop.cz', 'ruzovyslon.sk', 'kondomshop.sk',
            'sexyelephant.ro', 'sexyelephant.hu', 'sexyelephant.si', 'sexyelephant.bg', 'sexyelephant.hr',
            'Hopnato.cz', 'erosstar.cz', 'deeplove.cz', 'yoo.cz', 'sexicekshop.cz', 'honitka.cz',
            'sexshop.cz', 'eroticke-pomucky.cz', 'flagranti.cz', 'sexshopik.cz', 'sex-shop69.cz',
            'eroticcity.cz', 'e-kondomy.cz', 'isexshop.sk', 'flagranti.sk', 'superlove.sk', 'eros.sk',
            'superlove.ro', 'superlove.pl', 'superlove.eu', 'superlove.at', 'superlove.hr',
            'superlove.it', 'superlove.si', 'superlove.bg', 'superlove.lt', 'superlove.es',
            'superlove.hu', 'goldengate.hu', 'padlizsan.hu', 'sexshopcenter.hu', 'erotikashow.hu',
            'szexaruhaz.hu', 'szexshop.hu', 'vagyaim.hu'
        ];

        allEshops.forEach(eshop => {
            const option = document.createElement('option');
            option.value = eshop;
            datalist.appendChild(option);
        });

        document.body.appendChild(datalist);
    }
});

// =====================================================
// ZÁLOŽKA: SLEDOVÁNÍ OBJEDNÁVEK
// =====================================================

function setupOrderTab() {
    const form = document.getElementById('order-form');
    const cancelEditButton = document.getElementById('cancel-edit-order-button');

    // Naplnění dropdownů
    fillMarketSelects();
    filterCompetitorsByMarket();
    fillCompetitorFilters();

    // Event listenery
    form.addEventListener('submit', handleOrderFormSubmit);
    cancelEditButton.addEventListener('click', resetOrderForm);

    document.getElementById('filter-market-order').addEventListener('change', renderOrderTable);
    document.getElementById('filter-competitor-order').addEventListener('change', renderOrderTable);

    document.getElementById('market-share-filter').addEventListener('change', updateMarketShareChart);
    document.getElementById('market-share-start-date').addEventListener('change', updateMarketShareChart);
    document.getElementById('market-share-end-date').addEventListener('change', updateMarketShareChart);

    // Inicializace grafů
    initTrendChart();
    initDeltaChart();
    initMarketShareChart();

    // Načtení dat
    calculateOrderMetrics();
    updateMetricsDisplay();
    renderOrderTable();
    updateAllCharts();
}

function fillMarketSelects() {
    const selects = [
        'market-share-filter',
        'comparison-market-filter',
        'filter-market-order'
    ];

    selects.forEach(selectId => {
        const select = document.getElementById(selectId);
        if (selectId === 'filter-market-order') {
            // Pro filtr přidáme možnost "Všechny trhy"
            select.innerHTML = '<option value="all">Všechny trhy</option>';
        } else {
            select.innerHTML = '';
        }

        MARKETS.forEach(market => {
            select.add(new Option(market, market));
        });

        // Nastavení CZ jako výchozí
        select.value = 'CZ';
    });
}

function filterCompetitorsByMarket() {
    const competitorSelect = document.getElementById('competitor-order');
    competitorSelect.innerHTML = '<option value="">Vyberte konkurenta</option>';

    const grouped = {};

    COMPETITORS_BY_MARKET.forEach(c => {
        const groupKey = c.market || 'Nezařazeno';
        if (!grouped[groupKey]) {
            grouped[groupKey] = [];
        }
        grouped[groupKey].push({ value: c.name, label: c.domain });
    });

    Object.keys(grouped).sort().forEach(group => {
        const optgroup = document.createElement('optgroup');
        optgroup.label = `Trh: ${group}`;
        grouped[group].sort((a, b) => a.label.localeCompare(b.label)).forEach(c => {
            optgroup.appendChild(new Option(c.label, c.value));
        });
        competitorSelect.appendChild(optgroup);
    });
}

function fillCompetitorFilters() {
    const allCompetitors = [...new Set(COMPETITORS_BY_MARKET.map(c => c.name))].sort();
    const select = document.getElementById('filter-competitor-order');

    select.innerHTML = '<option value="all">Všichni konkurenti</option>';
    allCompetitors.forEach(comp => {
        select.add(new Option(comp, comp));
    });
}

function handleOrderFormSubmit(e) {
    e.preventDefault();
    const form = document.getElementById('order-form');
    const formError = document.getElementById('form-error-order');
    formError.classList.add('hidden');

    const formData = new FormData(form);
    const data = {
        id: formData.get('id') ? parseInt(formData.get('id')) : Date.now(),
        market: formData.get('market'),
        competitor: formData.get('competitor'),
        discoveryDate: formData.get('discoveryDate'),
        orderNumber: parseInt(formData.get('orderNumber')),
        notes: formData.get('notes') || '',
        orderDelta: 0,
        marketShare: 0
    };

    if (!data.market || !data.competitor || !data.discoveryDate || !data.orderNumber) {
        formError.textContent = 'Pole Trh, Konkurent, Datum a Číslo objednávky jsou povinná.';
        formError.classList.remove('hidden');
        return;
    }

    if (formData.get('id')) {
        const index = orderData.findIndex(o => o.id === data.id);
        if (index !== -1) orderData[index] = data;
    } else {
        orderData.push(data);
    }

    orderData.sort((a, b) => {
        if (a.market !== b.market) return a.market.localeCompare(b.market);
        if (a.competitor !== b.competitor) return a.competitor.localeCompare(b.competitor);
        return new Date(a.discoveryDate) - new Date(b.discoveryDate);
    });

    saveOrdersToStorage();
    calculateOrderMetrics();
    updateMetricsDisplay();
    renderOrderTable();
    updateAllCharts();
    resetOrderForm();
}

function resetOrderForm() {
    document.getElementById('order-form').reset();
    document.getElementById('order-id').value = '';
    document.getElementById('form-title-order').textContent = 'Přidat záznam objednávky';
    document.getElementById('submit-button-order').textContent = 'Přidat záznam objednávky';
    document.getElementById('cancel-edit-order-button').classList.add('hidden');

    const today = new Date().toISOString().split('T')[0];
    document.getElementById('discoveryDate-order').value = today;
}

window.editOrder = function(id) {
    const order = orderData.find(o => o.id === id);
    if (!order) return;

    document.getElementById('order-id').value = order.id;
    document.getElementById('market-order').value = order.market;
    document.getElementById('competitor-order').value = order.competitor;
    document.getElementById('discoveryDate-order').value = order.discoveryDate;
    document.getElementById('orderNumber-order').value = order.orderNumber;
    document.getElementById('notes-order').value = order.notes;

    document.getElementById('form-title-order').textContent = 'Upravit záznam objednávky';
    document.getElementById('submit-button-order').textContent = 'Uložit změny';
    document.getElementById('cancel-edit-order-button').classList.remove('hidden');
    document.getElementById('order-form').scrollIntoView({ behavior: 'smooth' });
};

window.deleteOrder = function(id) {
    if (confirm('Opravdu chcete smazat tento záznam o objednávce? Tato akce je nevratná.')) {
        const index = orderData.findIndex(o => o.id === id);
        if (index !== -1) {
            orderData.splice(index, 1);
            saveOrdersToStorage();
            calculateOrderMetrics();
            updateMetricsDisplay();
            renderOrderTable();
            updateAllCharts();
        }
    }
};

// =====================================================
// VÝPOČTY METRIK OBJEDNÁVEK
// =====================================================

function calculateOrderMetrics() {
    // Výpočet delta objednávek pro každý záznam
    orderData.forEach(currentRecord => {
        const competitorHistory = orderData
            .filter(item => item.market === currentRecord.market && item.competitor === currentRecord.competitor)
            .sort((a, b) => new Date(a.discoveryDate) - new Date(b.discoveryDate));

        const currentIndex = competitorHistory.findIndex(item => item.id === currentRecord.id);

        if (currentIndex > 0) {
            const previousRecord = competitorHistory[currentIndex - 1];
            currentRecord.orderDelta = currentRecord.orderNumber - previousRecord.orderNumber;
        } else {
            currentRecord.orderDelta = 0;
        }
    });

    // Výpočet market share pro každý trh
    const markets = [...new Set(orderData.map(o => o.market))];

    markets.forEach(market => {
        const marketData = orderData.filter(o => o.market === market);
        const competitorDeltas = {};

        [...new Set(marketData.map(d => d.competitor))].forEach(competitor => {
            const latestRecord = marketData
                .filter(d => d.competitor === competitor && d.orderDelta > 0)
                .sort((a, b) => new Date(b.discoveryDate) - new Date(a.discoveryDate))[0];

            if (latestRecord) {
                competitorDeltas[competitor] = latestRecord.orderDelta;
            }
        });

        const totalDelta = Object.values(competitorDeltas).reduce((sum, delta) => sum + delta, 0);

        if (totalDelta > 0) {
            Object.keys(competitorDeltas).forEach(competitor => {
                const share = (competitorDeltas[competitor] / totalDelta) * 100;

                marketData.forEach(record => {
                    if (record.competitor === competitor) {
                        record.marketShare = share;
                    }
                });
            });
        }
    });
}

// =====================================================
// TABULKA OBJEDNÁVEK
// =====================================================

function renderOrderTable() {
    const filterMarket = document.getElementById('filter-market-order').value;
    const filterComp = document.getElementById('filter-competitor-order').value;
    const tableBody = document.getElementById('order-table-body');

    const filteredData = orderData.filter(d => {
        const marketMatch = filterMarket === 'all' || d.market === filterMarket;
        const compMatch = filterComp === 'all' || d.competitor === filterComp;
        return compMatch && marketMatch;
    });

    filteredData.sort((a, b) => new Date(b.discoveryDate) - new Date(a.discoveryDate));

    tableBody.innerHTML = '';
    if (filteredData.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="8" class="text-center p-4 text-gray-500">Zatím nebyly přidány žádné záznamy o objednávkách.</td></tr>`;
        return;
    }

    filteredData.forEach(d => {
        const deltaText = d.orderDelta > 0 ? `+${d.orderDelta.toLocaleString('cs-CZ')}` :
                          (d.orderDelta === 0 ? 'N/A' : d.orderDelta.toLocaleString('cs-CZ'));
        const shareText = d.marketShare > 0 ? `${d.marketShare.toFixed(2)} %` : 'N/A';

        const row = document.createElement('tr');
        row.className = "hover:bg-gray-50 transition-colors";
        row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">${d.market}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${d.competitor}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">${formatDate(d.discoveryDate)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">${d.orderNumber.toLocaleString('cs-CZ')}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-semibold ${d.orderDelta > 0 ? 'text-green-600' : (d.orderDelta < 0 ? 'text-red-600' : 'text-gray-600')}">${deltaText}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">${shareText}</td>
            <td class="px-6 py-4 whitespace-normal text-sm text-gray-600">${d.notes}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                <button onclick="editOrder(${d.id})" class="text-blue-600 hover:text-blue-800 transition-colors font-semibold mr-3">
                    Editovat
                </button>
                <button onclick="deleteOrder(${d.id})" class="text-red-600 hover:text-red-800 transition-colors font-semibold">
                    Smazat
                </button>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

// =====================================================
// GRAFY - SLEDOVÁNÍ OBJEDNÁVEK
// =====================================================

function initTrendChart() {
    const canvas = document.getElementById('trendChart');
    if (!canvas) {
        console.warn('Trend chart canvas nenalezen, přeskakuji inicializaci');
        return;
    }

    const ctx = canvas.getContext('2d');
    charts.trend = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: []
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: { color: '#4b5563' }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { color: '#4b5563' },
                    grid: { color: '#f3f4f6' }
                },
                x: {
                    ticks: { color: '#4b5563' },
                    grid: { display: false }
                }
            }
        }
    });
}

// Pomocná funkce pro agregaci dat podle týdnů
function aggregateByWeeks(data, eshops) {
    const weeklyData = {};

    data.forEach(record => {
        const recordDate = new Date(record.date);
        // Získat ISO week number
        const weekNumber = getWeekNumber(recordDate);
        const weekKey = `${recordDate.getFullYear()}-W${String(weekNumber).padStart(2, '0')}`;

        if (!weeklyData[weekKey]) {
            weeklyData[weekKey] = {
                date: weekKey,
                year: recordDate.getFullYear(),
                week: weekNumber,
                totals: {}
            };
            eshops.forEach(eshop => {
                weeklyData[weekKey].totals[eshop] = 0;
            });
        }

        eshops.forEach(eshop => {
            // Přeskočit nezměřené e-shopy
            if (record.notMeasured && record.notMeasured[eshop]) {
                return;
            }

            // Přeskočit první měření (nezapočítává se)
            if (record.firstMeasurement && record.firstMeasurement[eshop]) {
                return;
            }

            const delta = (record.deltas && record.deltas[eshop]) ? record.deltas[eshop] : 0;
            weeklyData[weekKey].totals[eshop] += delta;
        });
    });

    return Object.values(weeklyData).sort((a, b) => a.date.localeCompare(b.date));
}

// Pomocná funkce pro agregaci dat podle měsíců
function aggregateByMonths(data, eshops) {
    const monthlyData = {};

    data.forEach(record => {
        const recordDate = new Date(record.date);
        const monthKey = `${recordDate.getFullYear()}-${String(recordDate.getMonth() + 1).padStart(2, '0')}`;

        if (!monthlyData[monthKey]) {
            monthlyData[monthKey] = {
                date: monthKey,
                year: recordDate.getFullYear(),
                month: recordDate.getMonth() + 1,
                totals: {}
            };
            eshops.forEach(eshop => {
                monthlyData[monthKey].totals[eshop] = 0;
            });
        }

        eshops.forEach(eshop => {
            // Přeskočit nezměřené e-shopy
            if (record.notMeasured && record.notMeasured[eshop]) {
                return;
            }

            // Přeskočit první měření (nezapočítává se)
            if (record.firstMeasurement && record.firstMeasurement[eshop]) {
                return;
            }

            const delta = (record.deltas && record.deltas[eshop]) ? record.deltas[eshop] : 0;
            monthlyData[monthKey].totals[eshop] += delta;
        });
    });

    return Object.values(monthlyData).sort((a, b) => a.date.localeCompare(b.date));
}

// Pomocná funkce pro získání čísla týdne
function getWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function updateTrendChart() {
    const periodFilter = document.getElementById('trend-period-filter');
    const dateFromInput = document.getElementById('trend-date-from');
    const dateToInput = document.getElementById('trend-date-to');
    const eshopsFilter = document.getElementById('trend-eshops-filter');
    const typeFilter = document.getElementById('trend-type-filter');
    const aggregationFilter = document.getElementById('trend-aggregation-filter');
    const yoyCheckbox = document.getElementById('trend-yoy-comparison');

    if (!periodFilter || !dateFromInput || !dateToInput || !eshopsFilter || !typeFilter || !aggregationFilter || !yoyCheckbox) {
        console.error('❌ Trend chart filtry nenalezeny');
        return;
    }

    // Získání vybraných e-shopů z multi-select
    const selectedEshops = Array.from(eshopsFilter.selectedOptions).map(opt => opt.value);

    // Pokud není nic vybráno, použij defaultní výběr (Růžový Slon)
    if (selectedEshops.length === 0) {
        selectedEshops.push('ruzovyslon.cz');
    }

    const periodValue = periodFilter.value;
    const dateFrom = dateFromInput.value;
    const dateTo = dateToInput.value;
    const chartType = typeFilter.value;
    const aggregation = aggregationFilter.value;
    const showYoY = yoyCheckbox.checked;

    // Použít trackingData místo orderData
    if (!window.trackingData || window.trackingData.length === 0) {
        charts.trend.data.labels = [];
        charts.trend.data.datasets = [];
        charts.trend.update();
        return;
    }

    // Seřadit podle data
    let sortedData = [...window.trackingData].sort((a, b) => new Date(a.date) - new Date(b.date));

    // Filtrovat podle období - vlastní období má přednost před přednastavenými
    if (dateFrom || dateTo) {
        // Vlastní období (od-do) - date input vrací ISO formát (yyyy-mm-dd)
        const fromDate = dateFrom ? new Date(dateFrom) : new Date('1900-01-01');
        const toDate = dateTo ? new Date(dateTo) : new Date('2099-12-31');

        sortedData = sortedData.filter(r => {
            const recordDate = new Date(r.date);
            return recordDate >= fromDate && recordDate <= toDate;
        });
    } else if (periodValue !== '' && periodValue !== 'all') {
        // Přednastavené období
        if (periodValue === 'previous-year') {
            // Minulý rok - celý rok
            const today = new Date();
            const previousYear = today.getFullYear() - 1;
            const fromDate = new Date(previousYear, 0, 1); // 1. ledna minulého roku
            const toDate = new Date(previousYear, 11, 31); // 31. prosince minulého roku

            sortedData = sortedData.filter(r => {
                const recordDate = new Date(r.date);
                return recordDate >= fromDate && recordDate <= toDate;
            });
        } else {
            const period = parseInt(periodValue);
            if (!isNaN(period)) {
                const today = new Date();
                const cutoffDate = new Date(today);
                cutoffDate.setDate(cutoffDate.getDate() - period);

                sortedData = sortedData.filter(r => new Date(r.date) >= cutoffDate);
            }
        }
    }

    if (sortedData.length === 0) {
        charts.trend.data.labels = [];
        charts.trend.data.datasets = [];
        charts.trend.update();
        return;
    }

    // Agregace dat podle vybraného zobrazení
    let processedData, labels;

    if (aggregation === 'weeks') {
        const aggregatedData = aggregateByWeeks(sortedData, selectedEshops);
        processedData = aggregatedData;
        labels = aggregatedData.map(d => d.date);
    } else if (aggregation === 'months') {
        const aggregatedData = aggregateByMonths(sortedData, selectedEshops);
        processedData = aggregatedData;
        labels = aggregatedData.map(d => {
            const [year, month] = d.date.split('-');
            const monthNames = ['Led', 'Úno', 'Bře', 'Dub', 'Kvě', 'Čvn', 'Čvc', 'Srp', 'Zář', 'Říj', 'Lis', 'Pro'];
            return `${monthNames[parseInt(month) - 1]} ${year}`;
        });
    } else {
        // Výchozí je týdny
        const aggregatedData = aggregateByWeeks(sortedData, selectedEshops);
        processedData = aggregatedData;
        labels = aggregatedData.map(d => d.date);
    }

    // Příprava datasetů pro vybrané e-shopy
    const datasets = [];

    selectedEshops.forEach((eshop, index) => {
        const color = CHART_COLORS[index % CHART_COLORS.length];

        // Dataset pro aktuální období
        const currentData = processedData.map(record => {
            // Pokud je e-shop označen jako nezměřený, vrátit 0
            if (record.notMeasured && record.notMeasured[eshop]) {
                return 0;
            }

            // Vždy používat agregované totals (týdny nebo měsíce)
            return record.totals && record.totals[eshop] ? record.totals[eshop] : null;
        });

        datasets.push({
            label: eshop,
            data: currentData,
            borderColor: color,
            backgroundColor: chartType === 'area' ? color + '40' : color + '20',
            borderWidth: 3,
            pointRadius: 4,
            pointHoverRadius: 6,
            tension: 0.3,
            spanGaps: true,
            fill: chartType === 'area'
        });

        // Dataset pro meziroční srovnání (předchozí rok)
        if (showYoY) {
            // Získat rok z prvního záznamu pro label
            const firstRecordDate = processedData.length > 0
                ? new Date(`${processedData[0].year}-01-01`)
                : new Date();
            const previousYear = firstRecordDate.getFullYear() - 1;

            // DŮLEŽITÉ: Pro YoY musíme použít CELÁ window.trackingData, ne filtrovaná sortedData!
            // Jinak nemáme data z minulého roku, pokud je filtr na "poslední měsíc"
            const allData = [...window.trackingData].sort((a, b) => new Date(a.date) - new Date(b.date));

            // Agregovat data z předchozího roku z CELÝCH dat
            const previousYearData = allData.filter(r => {
                const rDate = new Date(r.date);
                return rDate.getFullYear() === previousYear;
            });

            const previousYearAggregated = aggregation === 'weeks'
                ? aggregateByWeeks(previousYearData, selectedEshops)
                : aggregateByMonths(previousYearData, selectedEshops);

            console.log(`📊 YoY Debug pro ${eshop}:`, {
                currentYear: firstRecordDate.getFullYear(),
                previousYear: previousYear,
                previousYearDataCount: previousYearData.length,
                previousYearAggregatedCount: previousYearAggregated.length,
                currentDataCount: processedData.length
            });

            const yoyData = processedData.map(record => {
                // Najít odpovídající záznam z předchozího roku
                const matchingRecord = previousYearAggregated.find(r => {
                    if (aggregation === 'weeks') {
                        return r.week === record.week;
                    } else {
                        return r.month === record.month;
                    }
                });

                if (matchingRecord) {
                    return matchingRecord.totals && matchingRecord.totals[eshop] ? matchingRecord.totals[eshop] : null;
                }
                return null;
            });

            // Přidat YoY dataset s čárkovanou čárou
            datasets.push({
                label: `${eshop} (${previousYear})`,
                data: yoyData,
                borderColor: color,
                backgroundColor: 'transparent',
                borderWidth: 2,
                borderDash: [5, 5],
                pointRadius: 3,
                pointHoverRadius: 5,
                tension: 0.3,
                spanGaps: true,
                fill: false
            });
        }
    });

    // Změnit typ grafu
    if (charts.trend.config.type !== chartType && chartType !== 'area') {
        charts.trend.config.type = chartType;
    } else if (chartType === 'area') {
        charts.trend.config.type = 'line';
    }

    charts.trend.data.labels = labels;
    charts.trend.data.datasets = datasets;
    charts.trend.update();
}

function initDeltaChart() {
    const ctx = document.getElementById('deltaChart');
    if (!ctx) {
        console.warn('⚠️ Delta chart canvas nenalezen');
        return;
    }

    charts.delta = new Chart(ctx.getContext('2d'), {
        type: 'bar',
        data: {
            labels: [],
            datasets: [{
                label: 'Růst (%)',
                data: [],
                backgroundColor: [],
                borderColor: [],
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const dataIndex = context.dataIndex;
                            const dataset = context.chart.data.datasets[0];
                            const percent = dataset.data[dataIndex];
                            const period1 = dataset.period1Data ? dataset.period1Data[dataIndex] : null;
                            const period2 = dataset.period2Data ? dataset.period2Data[dataIndex] : null;
                            const diff = dataset.diffData ? dataset.diffData[dataIndex] : null;

                            const lines = [];
                            lines.push(`Růst: ${percent.toFixed(1)}%`);
                            if (period1 !== null && period2 !== null) {
                                lines.push(`Období 1: ${period1.toLocaleString('cs-CZ')} obj.`);
                                lines.push(`Období 2: ${period2.toLocaleString('cs-CZ')} obj.`);
                                lines.push(`Rozdíl: ${diff >= 0 ? '+' : ''}${diff.toLocaleString('cs-CZ')} obj.`);
                            }

                            return lines;
                        }
                    }
                }
            },
            scales: {
                y: {
                    type: 'linear',
                    position: 'left',
                    ticks: {
                        color: '#4b5563'
                    },
                    grid: { color: '#e5e7eb' },
                    title: {
                        display: true,
                        text: 'Hodnota',
                        color: '#4b5563'
                    }
                },
                x: {
                    ticks: {
                        color: '#4b5563',
                        maxRotation: 45,
                        minRotation: 45
                    },
                    grid: { display: false }
                }
            }
        }
    });
}

// Aktualizovat seznam e-shopů podle vybraného trhu
window.updateDeltaEshopsFilter = function() {
    const marketFilter = document.getElementById('delta-market-filter');
    const eshopsFilter = document.getElementById('delta-eshops-filter');

    if (!marketFilter || !eshopsFilter) {
        console.error('Delta eshops filter nenalezen');
        return;
    }

    const market = marketFilter.value;
    console.log('Aktualizace Delta e-shopů pro trh:', market);

    // Definice e-shopů podle trhů
    const czEshops = ["Hopnato.cz", "erosstar.cz", "deeplove.cz", "yoo.cz", "honitka.cz", "eroticke-pomucky.cz", "flagranti.cz", "sexshopik.cz", "e-kondomy.cz", "ruzovyslon.cz", "kondomshop.cz"];
    const skEshops = ["isexshop.sk", "flagranti.sk", "superlove.sk", "eros.sk", "ruzovyslon.sk", "kondomshop.sk"];
    const foreignEshops = ["sexyelephant.ro", "sexyelephant.hu", "sexyelephant.si", "sexyelephant.bg", "sexyelephant.hr", "superlove.ro", "superlove.pl", "superlove.eu", "superlove.at", "superlove.hr", "superlove.it", "superlove.si", "superlove.bg", "superlove.lt", "superlove.es", "superlove.hu", "goldengate.hu", "padlizsan.hu", "sexshopcenter.hu", "erotikashow.hu", "szexaruhaz.hu", "szexshop.hu", "vagyaim.hu"];

    let eshops;
    if (market === 'CZ') eshops = czEshops;
    else if (market === 'SK') eshops = skEshops;
    else if (market === 'Foreign') eshops = foreignEshops;
    else eshops = [];

    // Vyčistit a naplnit select
    eshopsFilter.innerHTML = '';

    // Definice vlastních e-shopů
    const ownEshopsCZ = ["ruzovyslon.cz", "kondomshop.cz"];
    const ownEshopsSK = ["ruzovyslon.sk", "kondomshop.sk"];
    const ownEshopsForeign = ["sexyelephant.ro", "sexyelephant.hu", "sexyelephant.si", "sexyelephant.bg", "sexyelephant.hr"];

    eshops.forEach(eshop => {
        const option = document.createElement('option');
        option.value = eshop;
        option.textContent = eshop;
        option.selected = true; // Výchozí: všechny vybrané
        eshopsFilter.appendChild(option);
    });
};

function updateDeltaChart() {
    const marketFilter = document.getElementById('delta-market-filter');
    const eshopsFilter = document.getElementById('delta-eshops-filter');
    const chartTypeSelect = document.getElementById('delta-chart-type');
    const period1Start = document.getElementById('delta-period1-start');
    const period1End = document.getElementById('delta-period1-end');
    const period2Start = document.getElementById('delta-period2-start');
    const period2End = document.getElementById('delta-period2-end');

    if (!marketFilter || !eshopsFilter || !chartTypeSelect) {
        console.error('Delta chart filtry nenalezeny');
        return;
    }

    if (!charts.delta) {
        console.warn('Delta chart není inicializován');
        return;
    }

    const market = marketFilter.value;
    const chartType = chartTypeSelect.value;

    // Validace období
    if (!period1Start.value || !period1End.value || !period2Start.value || !period2End.value) {
        alert('Vyber prosím obě období (datum od-do) pro porovnání.');
        return;
    }

    if (!window.trackingData || window.trackingData.length === 0) {
        charts.delta.data.labels = [];
        charts.delta.data.datasets = [];
        charts.delta.update();
        return;
    }

    // Získat vybrané e-shopy z multi-select
    const selectedEshops = Array.from(eshopsFilter.selectedOptions).map(opt => opt.value);

    console.log('🔍 Delta Graf Debug:');
    console.log('  - Vybrané e-shopy:', selectedEshops.length, selectedEshops);
    console.log('  - Období 1:', period1Start.value, '-', period1End.value);
    console.log('  - Období 2:', period2Start.value, '-', period2End.value);
    console.log('  - Počet záznamů v trackingData:', window.trackingData.length);

    if (selectedEshops.length === 0) {
        alert('Vyber prosím alespoň jeden e-shop.');
        return;
    }

    // Výpočet průměrů pro každý e-shop ve dvou obdobích
    const deltaData = selectedEshops.map(eshop => {
        const period1Avg = calculatePeriodAverage(eshop, period1Start.value, period1End.value);
        const period2Avg = calculatePeriodAverage(eshop, period2Start.value, period2End.value);

        console.log(`  - ${eshop}: P1=${period1Avg}, P2=${period2Avg}`);

        if (period1Avg === null || period2Avg === null) {
            return null;
        }

        const percentChange = period2Avg === 0 ? 0 : ((period1Avg - period2Avg) / period2Avg) * 100;
        const absoluteDiff = period1Avg - period2Avg;

        return {
            eshop: eshop,
            percent: percentChange,
            period1: period1Avg,
            period2: period2Avg,
            diff: absoluteDiff
        };
    }).filter(item => item !== null);

    console.log('  - Platných dat po filtraci:', deltaData.length);

    // Seřadit sestupně podle period1 (nebo percent pro growth)
    if (chartType === 'growth') {
        deltaData.sort((a, b) => b.percent - a.percent);
    } else {
        deltaData.sort((a, b) => b.period1 - a.period1);
    }

    if (deltaData.length === 0) {
        alert('Žádná data pro zvolená období. Zkontroluj, zda máš data v těchto datech.');
        charts.delta.data.labels = [];
        charts.delta.data.datasets = [];
        charts.delta.update();
        return;
    }

    const labels = deltaData.map(item => item.eshop);

    // Nastavit typ grafu a data podle výběru
    if (chartType === 'comparison') {
        // Sloupcový graf s dvěma datasety
        charts.delta.config.type = 'bar';
        charts.delta.data.labels = labels;
        charts.delta.data.datasets = [
            {
                label: 'Období 1 (novější)',
                data: deltaData.map(item => item.period1),
                backgroundColor: 'rgba(76, 175, 80, 0.7)',
                borderColor: 'rgba(76, 175, 80, 1)',
                borderWidth: 2
            },
            {
                label: 'Období 2 (starší)',
                data: deltaData.map(item => item.period2),
                backgroundColor: 'rgba(33, 150, 243, 0.7)',
                borderColor: 'rgba(33, 150, 243, 1)',
                borderWidth: 2
            }
        ];
        charts.delta.options.scales.y.title.text = 'Průměrný počet objednávek';
    } else if (chartType === 'growth') {
        // Procentuální růst
        charts.delta.config.type = 'bar';
        const percentData = deltaData.map(item => item.percent);
        const colors = percentData.map(val => val >= 0 ? '#32cd32' : '#ff6347');

        charts.delta.data.labels = labels;
        charts.delta.data.datasets = [{
            label: 'Procentuální změna',
            data: percentData,
            backgroundColor: colors.map(c => c + 'CC'),
            borderColor: colors,
            borderWidth: 2
        }];
        charts.delta.options.scales.y.title.text = 'Změna (%)';
    } else if (chartType === 'line') {
        // Čárový graf
        charts.delta.config.type = 'line';
        charts.delta.data.labels = labels;
        charts.delta.data.datasets = [
            {
                label: 'Období 1 (novější)',
                data: deltaData.map(item => item.period1),
                borderColor: 'rgba(76, 175, 80, 1)',
                backgroundColor: 'rgba(76, 175, 80, 0.2)',
                borderWidth: 3,
                pointRadius: 5,
                pointHoverRadius: 7,
                tension: 0.3,
                fill: false
            },
            {
                label: 'Období 2 (starší)',
                data: deltaData.map(item => item.period2),
                borderColor: 'rgba(33, 150, 243, 1)',
                backgroundColor: 'rgba(33, 150, 243, 0.2)',
                borderWidth: 3,
                pointRadius: 5,
                pointHoverRadius: 7,
                tension: 0.3,
                fill: false
            }
        ];
        charts.delta.options.scales.y.title.text = 'Průměrný počet objednávek';
    }

    charts.delta.update();
}

// Aktualizovat mezitýdenní srovnání CZ a SK e-shopů
window.updateWeeklyComparison = function() {
    console.log('🔄 Aktualizace mezitýdenního srovnání...');

    if (!window.trackingData || window.trackingData.length === 0) {
        console.warn('⚠️ Žádná data pro mezitýdenní srovnání');
        const tbody = document.getElementById('weekly-comparison-tbody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-4 text-center text-gray-500">Žádná data k zobrazení</td></tr>';
        }
        return;
    }

    // Získat CZ a SK e-shopy
    const czEshops = ["Hopnato.cz", "erosstar.cz", "deeplove.cz", "yoo.cz", "honitka.cz", "eroticke-pomucky.cz", "flagranti.cz", "sexshopik.cz", "e-kondomy.cz", "ruzovyslon.cz", "kondomshop.cz"];
    const skEshops = ["isexshop.sk", "flagranti.sk", "superlove.sk", "eros.sk", "ruzovyslon.sk", "kondomshop.sk"];
    const allEshops = [...czEshops, ...skEshops];

    // Seřadit data podle data (nejnovější první)
    const sortedData = [...window.trackingData].sort((a, b) => new Date(b.date) - new Date(a.date));

    // Získat poslední 14 dní dat
    const today = new Date();
    const fourteenDaysAgo = new Date(today);
    fourteenDaysAgo.setDate(today.getDate() - 14);

    const last14Days = sortedData.filter(record => {
        const recordDate = new Date(record.date);
        return recordDate >= fourteenDaysAgo && recordDate <= today;
    });

    if (last14Days.length === 0) {
        console.warn('⚠️ Nedostatek dat pro mezitýdenní srovnání');
        const tbody = document.getElementById('weekly-comparison-tbody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-4 text-center text-gray-500">Nedostatek dat (potřeba alespoň 14 dní)</td></tr>';
        }
        return;
    }

    // Rozdělit na tento týden (poslední 7 dní) a minulý týden (dny 8-14)
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 7);

    const thisWeekData = sortedData.filter(record => {
        const recordDate = new Date(record.date);
        return recordDate >= sevenDaysAgo && recordDate <= today;
    });

    const lastWeekData = sortedData.filter(record => {
        const recordDate = new Date(record.date);
        const fourteenDaysAgo = new Date(today);
        fourteenDaysAgo.setDate(today.getDate() - 14);
        return recordDate >= fourteenDaysAgo && recordDate < sevenDaysAgo;
    });

    console.log(`📊 Tento týden: ${thisWeekData.length} záznamů, Minulý týden: ${lastWeekData.length} záznamů`);

    // Vypočítat součty pro každý e-shop
    const weeklyStats = [];

    allEshops.forEach(eshop => {
        // Součet delta hodnot pro tento týden (přeskočit nezměřené)
        const thisWeekTotal = thisWeekData.reduce((sum, record) => {
            // Přeskočit nezměřené e-shopy
            if (record.notMeasured && record.notMeasured[eshop]) {
                return sum;
            }
            const delta = (record.deltas && record.deltas[eshop]) ? record.deltas[eshop] : 0;
            return sum + delta;
        }, 0);

        // Součet delta hodnot pro minulý týden (přeskočit nezměřené)
        const lastWeekTotal = lastWeekData.reduce((sum, record) => {
            // Přeskočit nezměřené e-shopy
            if (record.notMeasured && record.notMeasured[eshop]) {
                return sum;
            }
            const delta = (record.deltas && record.deltas[eshop]) ? record.deltas[eshop] : 0;
            return sum + delta;
        }, 0);

        // Vypočítat změnu
        const change = thisWeekTotal - lastWeekTotal;
        const percentChange = lastWeekTotal !== 0 ? ((change / lastWeekTotal) * 100) : 0;

        weeklyStats.push({
            eshop: eshop,
            lastWeek: lastWeekTotal,
            thisWeek: thisWeekTotal,
            change: change,
            percentChange: percentChange
        });
    });

    // Seřadit abecedně - nejdříve CZ, pak SK
    weeklyStats.sort((a, b) => {
        const aIsCZ = czEshops.includes(a.eshop);
        const bIsCZ = czEshops.includes(b.eshop);

        // CZ před SK
        if (aIsCZ && !bIsCZ) return -1;
        if (!aIsCZ && bIsCZ) return 1;

        // V rámci stejného trhu - abecedně
        return a.eshop.localeCompare(b.eshop, 'cs-CZ');
    });

    // Vygenerovat HTML pro tabulku
    const tbody = document.getElementById('weekly-comparison-tbody');
    if (!tbody) {
        console.error('❌ Element weekly-comparison-tbody nenalezen');
        return;
    }

    let html = '';
    weeklyStats.forEach(stat => {
        // Určit trend
        let trendIcon = '→';
        let trendColor = 'text-gray-500';
        if (stat.percentChange > 0) {
            trendIcon = '↑';
            trendColor = 'text-green-600';
        } else if (stat.percentChange < 0) {
            trendIcon = '↓';
            trendColor = 'text-red-600';
        }

        // Formátovat změnu
        const changeSign = stat.change >= 0 ? '+' : '';
        const changeText = `${changeSign}${stat.change.toLocaleString('cs-CZ')}`;
        const percentText = `${stat.percentChange >= 0 ? '+' : ''}${stat.percentChange.toFixed(1)}%`;

        // Barva pro změnu
        let changeColor = 'text-gray-700';
        if (stat.change > 0) changeColor = 'text-green-700';
        else if (stat.change < 0) changeColor = 'text-red-700';

        html += `
            <tr class="hover:bg-gray-50 transition-colors">
                <td class="px-6 py-4 font-medium text-gray-900">${stat.eshop}</td>
                <td class="px-6 py-4 text-right text-gray-700">${stat.lastWeek.toLocaleString('cs-CZ')}</td>
                <td class="px-6 py-4 text-right font-semibold text-gray-900">${stat.thisWeek.toLocaleString('cs-CZ')}</td>
                <td class="px-6 py-4 text-center ${changeColor} font-medium">
                    ${changeText}
                    <span class="text-xs ml-1">(${percentText})</span>
                </td>
                <td class="px-6 py-4 text-center">
                    <span class="${trendColor} text-2xl font-bold">${trendIcon}</span>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
    console.log('✅ Mezitýdenní srovnání aktualizováno');
};

// Aktualizovat meziroční srovnání měsíců CZ a SK e-shopů
window.updateMonthlyYoYComparison = function() {
    console.log('🔄 Aktualizace meziročního srovnání měsíců...');

    if (!window.trackingData || window.trackingData.length === 0) {
        console.warn('⚠️ Žádná data pro meziroční srovnání');
        const tbody = document.getElementById('monthly-yoy-comparison-tbody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-4 text-center text-gray-500">Žádná data k zobrazení</td></tr>';
        }
        return;
    }

    // Získat CZ a SK e-shopy
    const czEshops = ["Hopnato.cz", "erosstar.cz", "deeplove.cz", "yoo.cz", "honitka.cz", "eroticke-pomucky.cz", "flagranti.cz", "sexshopik.cz", "e-kondomy.cz", "ruzovyslon.cz", "kondomshop.cz"];
    const skEshops = ["isexshop.sk", "flagranti.sk", "superlove.sk", "eros.sk", "ruzovyslon.sk", "kondomshop.sk"];
    const allEshops = [...czEshops, ...skEshops];

    // Seřadit data podle data
    const sortedData = [...window.trackingData].sort((a, b) => new Date(a.date) - new Date(b.date));

    // Zjistit aktuální měsíc a rok
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth(); // 0-11

    // Najít data pro aktuální měsíc letošního roku
    const thisYearData = sortedData.filter(record => {
        const recordDate = new Date(record.date);
        return recordDate.getFullYear() === currentYear && recordDate.getMonth() === currentMonth;
    });

    // Najít data pro stejný měsíc předchozího roku
    const lastYearData = sortedData.filter(record => {
        const recordDate = new Date(record.date);
        return recordDate.getFullYear() === (currentYear - 1) && recordDate.getMonth() === currentMonth;
    });

    if (thisYearData.length === 0 && lastYearData.length === 0) {
        console.warn('⚠️ Nedostatek dat pro meziroční srovnání');
        const tbody = document.getElementById('monthly-yoy-comparison-tbody');
        if (tbody) {
            const monthNames = ['ledna', 'února', 'března', 'dubna', 'května', 'června', 'července', 'srpna', 'září', 'října', 'listopadu', 'prosince'];
            tbody.innerHTML = `<tr><td colspan="5" class="px-6 py-4 text-center text-gray-500">Nedostatek dat pro ${monthNames[currentMonth]} (potřeba data z ${currentYear} i ${currentYear - 1})</td></tr>`;
        }
        return;
    }

    console.log(`📊 Letošní rok (${currentMonth + 1}/${currentYear}): ${thisYearData.length} záznamů, Minulý rok (${currentMonth + 1}/${currentYear - 1}): ${lastYearData.length} záznamů`);

    // Vypočítat součty pro každý e-shop
    const monthlyStats = [];

    allEshops.forEach(eshop => {
        // Součet delta hodnot pro letošní měsíc (přeskočit nezměřené)
        const thisYearTotal = thisYearData.reduce((sum, record) => {
            // Přeskočit nezměřené e-shopy
            if (record.notMeasured && record.notMeasured[eshop]) {
                return sum;
            }
            const delta = (record.deltas && record.deltas[eshop]) ? record.deltas[eshop] : 0;
            return sum + delta;
        }, 0);

        // Součet delta hodnot pro stejný měsíc loni (přeskočit nezměřené)
        const lastYearTotal = lastYearData.reduce((sum, record) => {
            // Přeskočit nezměřené e-shopy
            if (record.notMeasured && record.notMeasured[eshop]) {
                return sum;
            }
            const delta = (record.deltas && record.deltas[eshop]) ? record.deltas[eshop] : 0;
            return sum + delta;
        }, 0);

        // Vypočítat změnu
        const change = thisYearTotal - lastYearTotal;
        const percentChange = lastYearTotal !== 0 ? ((change / lastYearTotal) * 100) : 0;

        monthlyStats.push({
            eshop: eshop,
            lastYear: lastYearTotal,
            thisYear: thisYearTotal,
            change: change,
            percentChange: percentChange
        });
    });

    // Seřadit abecedně - nejdříve CZ, pak SK
    monthlyStats.sort((a, b) => {
        const aIsCZ = czEshops.includes(a.eshop);
        const bIsCZ = czEshops.includes(b.eshop);

        // CZ před SK
        if (aIsCZ && !bIsCZ) return -1;
        if (!aIsCZ && bIsCZ) return 1;

        // V rámci stejného trhu - abecedně
        return a.eshop.localeCompare(b.eshop, 'cs-CZ');
    });

    // Vygenerovat HTML pro tabulku
    const tbody = document.getElementById('monthly-yoy-comparison-tbody');
    if (!tbody) {
        console.error('❌ Element monthly-yoy-comparison-tbody nenalezen');
        return;
    }

    const monthNames = ['Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen', 'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec'];

    let html = '';
    monthlyStats.forEach(stat => {
        // Určit trend
        let trendIcon = '→';
        let trendColor = 'text-gray-500';
        if (stat.percentChange > 0) {
            trendIcon = '↑';
            trendColor = 'text-green-600';
        } else if (stat.percentChange < 0) {
            trendIcon = '↓';
            trendColor = 'text-red-600';
        }

        // Formátovat změnu
        const changeSign = stat.change >= 0 ? '+' : '';
        const changeText = `${changeSign}${stat.change.toLocaleString('cs-CZ')}`;
        const percentText = `${stat.percentChange >= 0 ? '+' : ''}${stat.percentChange.toFixed(1)}%`;

        // Barva pro změnu
        let changeColor = 'text-gray-700';
        if (stat.change > 0) changeColor = 'text-green-700';
        else if (stat.change < 0) changeColor = 'text-red-700';

        html += `
            <tr class="hover:bg-gray-50 transition-colors">
                <td class="px-6 py-4 font-medium text-gray-900">${stat.eshop}</td>
                <td class="px-6 py-4 text-right text-gray-700">
                    ${stat.lastYear.toLocaleString('cs-CZ')}
                    <span class="text-xs text-gray-500 block">${monthNames[currentMonth]} ${currentYear - 1}</span>
                </td>
                <td class="px-6 py-4 text-right font-semibold text-gray-900">
                    ${stat.thisYear.toLocaleString('cs-CZ')}
                    <span class="text-xs text-gray-500 block">${monthNames[currentMonth]} ${currentYear}</span>
                </td>
                <td class="px-6 py-4 text-center ${changeColor} font-medium">
                    ${changeText}
                    <span class="text-xs ml-1">(${percentText})</span>
                </td>
                <td class="px-6 py-4 text-center">
                    <span class="${trendColor} text-2xl font-bold">${trendIcon}</span>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
    console.log('✅ Meziroční srovnání měsíců aktualizováno');
};

// Pomocná funkce pro výpočet průměru v daném období
function calculatePeriodAverage(eshop, startDate, endDate) {
    if (!window.trackingData) return null;

    const start = new Date(startDate);
    const end = new Date(endDate);

    // Filtrovat záznamy v období
    const recordsInPeriod = window.trackingData.filter(record => {
        const recordDate = new Date(record.date);
        return recordDate >= start && recordDate <= end;
    });

    if (recordsInPeriod.length === 0) return null;

    // Zjistit, jestli je to vlastní e-shop
    const isOwnEshop = window.OWN_ESHOPS && window.OWN_ESHOPS.includes(eshop);

    // Sečíst delty (pro vlastní i konkurenty) - přeskočit nezměřené
    let totalDeltas = 0;
    let measuredCount = 0;

    recordsInPeriod.forEach(record => {
        // Přeskočit nezměřené e-shopy
        if (record.notMeasured && record.notMeasured[eshop]) {
            return;
        }
        const delta = record.deltas && record.deltas[eshop] ? record.deltas[eshop] : 0;
        totalDeltas += delta;
        measuredCount++;
    });

    // Vrátit průměr (pouze z měřených dní)
    return measuredCount > 0 ? totalDeltas / measuredCount : null;
}

function calculateEshopDelta(sortedData, eshop, recordsBack) {
    if (sortedData.length < recordsBack + 1) return null;

    const latest = sortedData[0];
    const previous = sortedData[recordsBack];

    const isOwnEshop = window.OWN_ESHOPS && window.OWN_ESHOPS.includes(eshop);

    let latestValue, previousValue;

    if (isOwnEshop) {
        latestValue = latest.deltas && latest.deltas[eshop] ? latest.deltas[eshop] : 0;
        previousValue = previous.deltas && previous.deltas[eshop] ? previous.deltas[eshop] : 0;
    } else {
        latestValue = latest.competitors && latest.competitors[eshop] ? latest.competitors[eshop] : 0;
        previousValue = previous.competitors && previous.competitors[eshop] ? previous.competitors[eshop] : 0;
    }

    if (previousValue === 0) return null;

    return ((latestValue - previousValue) / previousValue) * 100;
}

function calculateEshopDeltaAverage(sortedData, eshop, n) {
    if (sortedData.length < n * 2) return null;

    const isOwnEshop = window.OWN_ESHOPS && window.OWN_ESHOPS.includes(eshop);

    // Průměr posledních N záznamů
    let recentSum = 0;
    let recentCount = 0;
    for (let i = 0; i < n && i < sortedData.length; i++) {
        const record = sortedData[i];

        // Přeskočit nezměřené e-shopy
        if (record.notMeasured && record.notMeasured[eshop]) {
            continue;
        }

        let value;

        if (isOwnEshop) {
            value = record.deltas && record.deltas[eshop] ? record.deltas[eshop] : 0;
        } else {
            value = record.competitors && record.competitors[eshop] ? record.competitors[eshop] : 0;
        }

        if (value > 0) {
            recentSum += value;
            recentCount++;
        }
    }

    // Průměr N předchozích záznamů
    let oldSum = 0;
    let oldCount = 0;
    for (let i = n; i < n * 2 && i < sortedData.length; i++) {
        const record = sortedData[i];

        // Přeskočit nezměřené e-shopy
        if (record.notMeasured && record.notMeasured[eshop]) {
            continue;
        }

        let value;

        if (isOwnEshop) {
            value = record.deltas && record.deltas[eshop] ? record.deltas[eshop] : 0;
        } else {
            value = record.competitors && record.competitors[eshop] ? record.competitors[eshop] : 0;
        }

        if (value > 0) {
            oldSum += value;
            oldCount++;
        }
    }

    if (recentCount === 0 || oldCount === 0) return null;

    const recentAvg = recentSum / recentCount;
    const oldAvg = oldSum / oldCount;

    if (oldAvg === 0) return null;

    return ((recentAvg - oldAvg) / oldAvg) * 100;
}

function calculateCompetitorGrowth(sortedData, competitor, daysDiff) {
    if (sortedData.length < 2) return null;

    const latest = sortedData[0];
    const latestDate = new Date(latest.date);
    const targetDate = new Date(latestDate);
    targetDate.setDate(targetDate.getDate() - daysDiff);

    // Najít nejbližší starší záznam
    let closestRecord = null;
    let smallestDiff = Infinity;

    for (let i = 1; i < sortedData.length; i++) {
        const recordDate = new Date(sortedData[i].date);
        const diff = Math.abs((targetDate - recordDate) / (1000 * 60 * 60 * 24));

        if (diff < smallestDiff && recordDate < latestDate) {
            smallestDiff = diff;
            closestRecord = sortedData[i];
        }
    }

    if (!closestRecord || smallestDiff > daysDiff * 0.5) {
        return null;
    }

    // Použít čísla objednávek z competitors
    const latestOrders = latest.competitors[competitor] || 0;
    const oldOrders = closestRecord.competitors[competitor] || 0;

    if (oldOrders === 0) return null;

    // Růst = ((nové - staré) / staré) * 100
    return ((latestOrders - oldOrders) / oldOrders) * 100;
}

function initMarketShareChart() {
    const canvas = document.getElementById('marketShareChart');
    if (!canvas) {
        console.warn('Market share chart canvas nenalezen, přeskakuji inicializaci');
        return;
    }

    const ctx = canvas.getContext('2d');
    charts.marketShare = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: [],
            datasets: [{
                data: [],
                backgroundColor: CHART_COLORS,
                hoverOffset: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        color: '#4b5563',
                        boxWidth: 15
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.parsed || 0;
                            return `${label}: ${value.toFixed(2)} %`;
                        }
                    }
                }
            }
        }
    });
}

function updateMarketShareChart() {
    const selectedMarket = document.getElementById('market-share-filter').value;
    const startDateStr = document.getElementById('market-share-start-date').value;
    const endDateStr = document.getElementById('market-share-end-date').value;

    const startDate = startDateStr ? new Date(startDateStr) : null;
    const endDate = endDateStr ? new Date(endDateStr) : null;

    let marketData = orderData.filter(d => d.market === selectedMarket);

    if (startDate || endDate) {
        marketData = marketData.filter(d => {
            const discoveryDate = new Date(d.discoveryDate);
            const isAfterStart = !startDate || discoveryDate >= startDate;
            const isBeforeEnd = !endDate || discoveryDate <= endDate;
            return isAfterStart && isBeforeEnd;
        });
    }

    const competitorDeltas = {};

    [...new Set(marketData.map(d => d.competitor))].forEach(competitor => {
        const latestRecord = marketData
            .filter(d => d.competitor === competitor && d.orderDelta > 0)
            .sort((a, b) => new Date(b.discoveryDate) - new Date(a.discoveryDate))[0];

        if (latestRecord) {
            competitorDeltas[competitor] = latestRecord.orderDelta;
        }
    });

    const totalDelta = Object.values(competitorDeltas).reduce((sum, delta) => sum + delta, 0);

    if (totalDelta === 0) {
        charts.marketShare.data.labels = ['Žádná data'];
        charts.marketShare.data.datasets[0].data = [100];
        charts.marketShare.data.datasets[0].backgroundColor = ['#e5e7eb'];
        document.getElementById('chart-info').textContent = `Pro trh ${selectedMarket} nebyly zaznamenány žádné delty objednávek.`;
    } else {
        const shares = Object.entries(competitorDeltas).map(([comp, delta]) => ({
            competitor: comp,
            share: (delta / totalDelta) * 100
        }));

        shares.sort((a, b) => b.share - a.share);

        charts.marketShare.data.labels = shares.map(s => s.competitor);
        charts.marketShare.data.datasets[0].data = shares.map(s => s.share);
        charts.marketShare.data.datasets[0].backgroundColor = CHART_COLORS.slice(0, shares.length);

        const currentFilterInfo = (startDateStr || endDateStr)
            ? `v období ${formatDate(startDateStr)} - ${formatDate(endDateStr)}`
            : 'za celou historii dat';
        document.getElementById('chart-info').textContent = `Podíl konkurentů na trhu ${selectedMarket} ${currentFilterInfo}.`;
    }

    charts.marketShare.update();
}

function updateAllCharts() {
    updateTrendChart();
    updateWeeklyComparison();
    updateMonthlyYoYComparison();
    updateMarketShareChart();
}

// =====================================================
// ZÁLOŽKA: SLEDOVÁNÍ MKT KAMPANÍ
// =====================================================

function setupMktTab() {
    try {
        const form = document.getElementById('campaign-form');
        const cancelEditButton = document.getElementById('cancel-edit-mkt-button');

        const competitorSelect = document.getElementById('competitor-mkt');
        const channelSelect = document.getElementById('channel-mkt');
        const filterCompetitorTable = document.getElementById('filter-competitor-mkt');
        const filterChannelTable = document.getElementById('filter-channel-mkt');
        const filterCompetitorChart = document.getElementById('chart-filter-competitor-mkt');
        const filterChannelChart = document.getElementById('chart-filter-channel-mkt');

        if (!competitorSelect || !channelSelect) {
            console.error('❌ MKT elementy nenalezeny!');
            return;
        }

        // Vyčistit existující options (kromě první)
        competitorSelect.innerHTML = '<option value="">Vyberte konkurenta</option>';
        channelSelect.innerHTML = '<option value="">Vyberte kanál</option>';
        filterCompetitorTable.innerHTML = '<option value="all">Všichni konkurenti</option>';
        filterChannelTable.innerHTML = '<option value="all">Všechny kanály</option>';
        filterCompetitorChart.innerHTML = '<option value="all">Všichni konkurenti</option>';
        filterChannelChart.innerHTML = '<option value="all">Všechny kanály</option>';

        MKT_COMPETITORS.forEach(c => {
            competitorSelect.add(new Option(c, c));
            filterCompetitorTable.add(new Option(c, c));
            filterCompetitorChart.add(new Option(c, c));
        });

        MKT_CHANNELS.forEach(c => {
            channelSelect.add(new Option(c, c));
            filterChannelTable.add(new Option(c, c));
            filterChannelChart.add(new Option(c, c));
        });

        form.addEventListener('submit', handleMktFormSubmit);
        filterCompetitorTable.addEventListener('change', renderMktTable);
        filterChannelTable.addEventListener('change', renderMktTable);
        filterCompetitorChart.addEventListener('change', updateMktChart);
        filterChannelChart.addEventListener('change', updateMktChart);
        cancelEditButton.addEventListener('click', resetMktForm);

        initMktChart();
        renderMktTable();

        console.log('✅ MKT tab nastaven:', MKT_COMPETITORS.length, 'konkurentů,', MKT_CHANNELS.length, 'kanálů');
    } catch (error) {
        console.error('❌ Chyba při nastavení MKT tabu:', error);
    }
}

function handleMktFormSubmit(e) {
    e.preventDefault();
    const form = document.getElementById('campaign-form');
    const formError = document.getElementById('form-error-mkt');
    formError.classList.add('hidden');

    const formData = new FormData(form);
    const data = {
        id: formData.get('id') ? parseInt(formData.get('id')) : Date.now(),
        competitor: formData.get('competitor'),
        discoveryDate: formData.get('discoveryDate'),
        startDate: formData.get('startDate'),
        endDate: formData.get('endDate'),
        description: formData.get('description'),
        channel: formData.get('channel'),
        screenshotUrl: formData.get('screenshotUrl'),
        notes: formData.get('notes') || '',
    };

    if (!data.competitor || !data.discoveryDate || !data.description || !data.channel) {
        formError.textContent = 'Pole Konkurent, Datum zjištění, Popis a Kanál jsou povinná.';
        formError.classList.remove('hidden');
        return;
    }

    if (formData.get('id')) {
        const index = window.mktCampaignData.findIndex(c => c.id === data.id);
        if (index !== -1) {
            // Zachovat firestoreId pokud existuje
            data.firestoreId = window.mktCampaignData[index].firestoreId;
            window.mktCampaignData[index] = data;
        }
    } else {
        window.mktCampaignData.push(data);
    }

    window.mktCampaignData.sort((a, b) => new Date(b.discoveryDate) - new Date(a.discoveryDate));

    // Uložit do Firestore (pokud je aktivní)
    if (typeof saveCampaignToFirestore === 'function') {
        saveCampaignToFirestore(data);
    }

    saveCampaignsToStorage();
    renderMktTable();
    updateMktChart();

    // Pokud je zadaná URL screenshotu, otevři ji automaticky
    if (data.screenshotUrl && data.screenshotUrl.trim()) {
        setTimeout(() => {
            if (typeof showIframeModal === 'function') {
                showIframeModal(data.screenshotUrl);
            }
        }, 300); // Malé zpoždění pro lepší UX
    }

    resetMktForm();
}

function resetMktForm() {
    document.getElementById('campaign-form').reset();
    document.getElementById('campaign-id').value = '';
    document.getElementById('form-title-mkt').textContent = 'Přidat MKT kampaň';
    document.getElementById('submit-button-mkt').textContent = 'Přidat kampaň';
    document.getElementById('cancel-edit-mkt-button').classList.add('hidden');

    const today = new Date().toISOString().split('T')[0];
    document.getElementById('discoveryDate-mkt').value = today;
}

window.editMktCampaign = function(id) {
    const campaign = window.mktCampaignData.find(c => c.id === id);
    if (!campaign) return;

    document.getElementById('campaign-id').value = campaign.id;
    document.getElementById('competitor-mkt').value = campaign.competitor;
    document.getElementById('discoveryDate-mkt').value = campaign.discoveryDate;
    document.getElementById('startDate-mkt').value = campaign.startDate || '';
    document.getElementById('endDate-mkt').value = campaign.endDate || '';
    document.getElementById('description-mkt').value = campaign.description;
    document.getElementById('channel-mkt').value = campaign.channel;
    document.getElementById('screenshotUrl-mkt').value = campaign.screenshotUrl || '';
    document.getElementById('notes-mkt').value = campaign.notes;

    document.getElementById('form-title-mkt').textContent = 'Upravit MKT kampaň';
    document.getElementById('submit-button-mkt').textContent = 'Uložit změny';
    document.getElementById('cancel-edit-mkt-button').classList.remove('hidden');
    document.getElementById('campaign-form').scrollIntoView({ behavior: 'smooth' });
};

window.deleteMktCampaign = async function(id) {
    if (confirm('Opravdu chcete smazat tuto kampaň? Tato akce je nevratná.')) {
        const index = window.mktCampaignData.findIndex(c => c.id === id);
        if (index !== -1) {
            // Smazat z Firestore (pokud je aktivní)
            if (typeof deleteCampaignFromFirestore === 'function') {
                await deleteCampaignFromFirestore(id);
            }

            window.mktCampaignData.splice(index, 1);
            saveCampaignsToStorage();
            renderMktTable();
            updateMktChart();
        }
    }
};

function renderMktTable() {
    const filterComp = document.getElementById('filter-competitor-mkt').value;
    const filterChan = document.getElementById('filter-channel-mkt').value;
    const tableBody = document.getElementById('campaign-table-body');

    const filteredData = window.mktCampaignData.filter(d => {
        const compMatch = filterComp === 'all' || d.competitor === filterComp;
        const chanMatch = filterChan === 'all' || d.channel === filterChan;
        return compMatch && chanMatch;
    });

    tableBody.innerHTML = '';
    if (filteredData.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="8" class="text-center p-4 text-gray-500">Zatím nebyly přidány žádné záznamy o kampaních.</td></tr>`;
        return;
    }

    filteredData.forEach(d => {
        const durationText = (d.startDate || d.endDate)
            ? `${formatDate(d.startDate)} - ${formatDate(d.endDate)}`
            : 'N/A';
        const linkHtml = d.screenshotUrl
            ? `<button onclick="showIframeModal('${d.screenshotUrl}')" class="text-blue-600 hover:text-blue-800 transition-colors">Zobrazit</button>`
            : 'N/A';

        const row = document.createElement('tr');
        row.className = "hover:bg-gray-50 transition-colors";
        row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${d.competitor}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">${formatDate(d.discoveryDate)}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">${durationText}</td>
            <td class="px-6 py-4 whitespace-normal text-sm text-gray-600 min-w-[200px]">${d.description}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">${d.channel}</td>
            <td class="px-6 py-4 text-sm text-gray-600">${linkHtml}</td>
            <td class="px-6 py-4 whitespace-normal text-sm text-gray-600">${d.notes}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                <button onclick="editMktCampaign(${d.id})" class="text-blue-600 hover:text-blue-800 transition-colors font-semibold mr-3">
                    Editovat
                </button>
                <button onclick="deleteMktCampaign(${d.id})" class="text-red-600 hover:text-red-800 transition-colors font-semibold">
                    Smazat
                </button>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

function initMktChart() {
    const ctx = document.getElementById('competitorChart').getContext('2d');
    charts.mktActivity = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: MKT_COMPETITORS,
            datasets: [{
                label: 'Počet kampaní',
                data: MKT_COMPETITORS.map(() => 0),
                backgroundColor: 'rgba(59, 130, 246, 0.7)',
                borderColor: 'rgba(59, 130, 246, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { stepSize: 1, color: '#4b5563' },
                    grid: { color: '#f3f4f6' }
                },
                x: {
                    ticks: { color: '#4b5563' },
                    grid: { display: false }
                }
            }
        }
    });
}

function updateMktChart() {
    const filterComp = document.getElementById('chart-filter-competitor-mkt').value;
    const filterChan = document.getElementById('chart-filter-channel-mkt').value;

    let dataForChart = window.mktCampaignData;

    if (filterChan !== 'all') {
        dataForChart = dataForChart.filter(d => d.channel === filterChan);
    }

    const counts = MKT_COMPETITORS.map(c => {
        if (filterComp !== 'all' && c !== filterComp) {
            return 0;
        }
        return dataForChart.filter(d => d.competitor === c).length;
    });

    charts.mktActivity.data.datasets[0].data = counts;
    charts.mktActivity.update();
}

// =====================================================
// MODALS
// =====================================================

function setupModals() {
    const dataModal = document.getElementById('dataManagementModal');
    const iframeModal = document.getElementById('iframeModal');
    const closeIframeButton = document.getElementById('closeModalButton');

    if (closeIframeButton) {
        closeIframeButton.onclick = function() {
            iframeModal.style.display = "none";
            document.getElementById('modalBody').innerHTML = '';
        };
    }

    if (iframeModal) {
        iframeModal.onclick = function(event) {
            if (event.target == iframeModal) {
                iframeModal.style.display = "none";
                document.getElementById('modalBody').innerHTML = '';
            }
        };
    }
}

window.showDataManagementModal = function() {
    document.getElementById('dataManagementModal').style.display = 'flex';
};

window.closeDataManagementModal = function() {
    document.getElementById('dataManagementModal').style.display = 'none';
};

window.showIframeModal = function(url) {
    if (!url) return;

    // Detekce známých screenshot služeb - otevři rovnou v nové záložce
    const screenshotServices = ['prnt.sc', 'lightshot', 'imgur.com/a/', 'gyazo.com'];
    const isScreenshotService = screenshotServices.some(service => url.includes(service));

    if (isScreenshotService) {
        // Pro screenshot služby otevři rovnou v nové záložce
        window.open(url, '_blank');
        return;
    }

    const iframeModal = document.getElementById('iframeModal');
    const modalHeaderTitle = document.getElementById('modalHeaderTitle');
    const modalBody = document.getElementById('modalBody');

    modalBody.innerHTML = '';
    modalHeaderTitle.textContent = `Náhled: ${url}`;

    // Zkus načíst jako obrázek
    const img = new Image();
    let imageLoaded = false;

    img.onload = function() {
        imageLoaded = true;
        modalBody.innerHTML = '';
        const imgElement = document.createElement('img');
        imgElement.src = url;
        imgElement.className = 'max-w-full max-h-full object-contain';
        imgElement.style.cssText = 'width: auto; height: auto; max-width: 100%; max-height: 80vh;';
        modalBody.appendChild(imgElement);
        iframeModal.style.display = "flex";
    };

    img.onerror = function() {
        // Není obrázek, zkus iframe
        const iframe = document.createElement('iframe');
        iframe.src = url;
        iframe.className = 'modal-iframe';
        modalBody.appendChild(iframe);
        iframeModal.style.display = "flex";

        // Rychlejší timeout - 1 sekunda místo 3
        setTimeout(() => {
            if (modalBody.children.length > 0 && modalBody.children[0] === iframe) {
                // Iframe se nenačetl, otevři v nové záložce
                window.open(url, '_blank');
                iframeModal.style.display = "none";
                modalBody.innerHTML = '';
            }
        }, 1000);
    };

    img.src = url;
};

// =====================================================
// AKTUALIZACE GRAFŮ
// =====================================================

function updateAllCharts() {
    // Placeholder pro aktualizaci grafů
    // V budoucnu lze přidat grafy založené na tracking datech
    console.log('📊 Grafy budou aktualizovány v další verzi');
}

// Exportovat pro použití z order-tracking-ui.js
window.updateAllCharts = updateAllCharts;

// =====================================================
// PŘEPÍNÁNÍ ZÁLOŽEK
// =====================================================

window.showTab = function(tabId) {
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.style.display = 'none';
    });
    document.querySelectorAll('nav button').forEach(button => {
        button.classList.remove('border-[#ffb3d9]', 'text-[#ff6b9d]');
        button.classList.add('text-gray-500', 'hover:text-gray-700');
    });

    const tabContent = document.getElementById(tabId);
    const tabButtonId = 'tab-' + tabId.replace('-tracking', '');
    const tabButton = document.getElementById(tabButtonId);

    if (tabContent) {
        tabContent.style.display = 'block';
    }

    if (tabButton) {
        tabButton.classList.add('border-[#ffb3d9]', 'text-[#ff6b9d]');
        tabButton.classList.remove('text-gray-500', 'hover:text-gray-700');
    }

    if (tabId === 'order-tracking') {
        updateAllCharts();
    } else if (tabId === 'mkt-tracking') {
        updateMktChart();
    }
};

// =====================================================
// UTILITY FUNKCE
// =====================================================

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
}

// =====================================================
// SPUŠTĚNÍ APLIKACE
// =====================================================

document.addEventListener('DOMContentLoaded', initializeApp);
