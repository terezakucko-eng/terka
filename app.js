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
    "eroticke-pomucky.cz"
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

const CHART_COLORS = [
    '#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#6366f1',
    '#eab308', '#06b6d4', '#f97316', '#a855f7', '#84cc16',
    '#ec4899', '#f43f5e', '#34d399', '#fbbf24', '#c084fc'
];

// ----- GLOBÁLNÍ PROMĚNNÉ -----
let orderData = [];
let mktCampaignData = [];
let charts = {
    trend: null,
    comparison: null,
    marketShare: null,
    mktActivity: null
};

// =====================================================
// INICIALIZACE APLIKACE
// =====================================================

async function initializeApp() {
    // Zobrazení loading stavu
    console.log('🚀 Inicializace aplikace...');

    // Inicializace Firebase databáze
    const dbInitialized = await initDatabase();
    if (dbInitialized) {
        console.log('✅ Firestore připojen - data budou sdílená');
    } else {
        console.log('⚠️ Používám LocalStorage - data pouze v tomto prohlížeči');
    }

    // Načtení tracking dat (nová struktura)
    await loadTrackingData();
    calculateDeltas();
    renderTrackingTable();

    // Načtení dat z databáze (kampaně)
    await loadDataFromStorage();

    // Nastavení UI
    setupMktTab();
    setupModals();
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
            mktCampaignData = campaigns;
        }

        console.log(`✅ Načteno ${orderData.length} objednávek a ${mktCampaignData.length} kampaní`);
    } catch (e) {
        console.error('Chyba při načítání dat:', e);
        orderData = [];
        mktCampaignData = [];
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
        await saveCampaignsToFirestore(mktCampaignData);
    } catch (e) {
        console.error('Chyba při ukládání kampaní:', e);
        alert('Nepodařilo se uložit data. Zkontrolujte připojení k databázi.');
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
                mktCampaignData = data.campaigns;
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
        campaigns: mktCampaignData,
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
            orderData = [];
            mktCampaignData = [];
            localStorage.removeItem(STORAGE_KEY_ORDERS);
            localStorage.removeItem(STORAGE_KEY_CAMPAIGNS);
            localStorage.removeItem(STORAGE_KEY_SETTINGS);

            renderOrderTable();
            renderMktTable();
            updateAllCharts();

            alert('Všechna data byla vymazána.');
            closeDataManagementModal();
        }
    }
}

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

    document.getElementById('trend-market-filter').addEventListener('change', updateTrendChart);
    document.getElementById('comparison-market-filter').addEventListener('change', updateComparisonChart);
    document.getElementById('comparison-period-filter').addEventListener('change', updateComparisonChart);

    // Inicializace grafů
    initTrendChart();
    initComparisonChart();
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
        'trend-market-filter',
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

function updateMetricsDisplay() {
    // Růžový Slon CZ metriky
    const czRuzovySlon = orderData.filter(o => o.market === 'CZ' && o.competitor === 'Růžový Slon')
        .sort((a, b) => new Date(b.discoveryDate) - new Date(a.discoveryDate));

    if (czRuzovySlon.length === 0) {
        document.getElementById('metric-total-orders').textContent = '-';
        document.getElementById('metric-wow').textContent = '-';
        document.getElementById('metric-mom').textContent = '-';
        document.getElementById('metric-yoy').textContent = '-';
        return;
    }

    const latest = czRuzovySlon[0];
    document.getElementById('metric-total-orders').textContent = latest.orderNumber.toLocaleString('cs-CZ');
    document.getElementById('metric-total-period').textContent = `K ${formatDate(latest.discoveryDate)}`;

    // WoW (Week over Week)
    const wow = calculateGrowthRate(czRuzovySlon, 7);
    document.getElementById('metric-wow').textContent = formatGrowthRate(wow);

    // MoM (Month over Month)
    const mom = calculateGrowthRate(czRuzovySlon, 30);
    document.getElementById('metric-mom').textContent = formatGrowthRate(mom);

    // YoY (Year over Year)
    const yoy = calculateGrowthRate(czRuzovySlon, 365);
    document.getElementById('metric-yoy').textContent = formatGrowthRate(yoy);
}

function calculateGrowthRate(sortedData, daysDiff) {
    if (sortedData.length < 2) return null;

    const latest = sortedData[0];
    const latestDate = new Date(latest.discoveryDate);

    // Najdi nejbližší starší záznam v požadovaném časovém rámci
    const targetDate = new Date(latestDate);
    targetDate.setDate(targetDate.getDate() - daysDiff);

    let closestRecord = null;
    let smallestDiff = Infinity;

    for (let i = 1; i < sortedData.length; i++) {
        const recordDate = new Date(sortedData[i].discoveryDate);
        const diff = Math.abs((targetDate - recordDate) / (1000 * 60 * 60 * 24));

        if (diff < smallestDiff && recordDate < latestDate) {
            smallestDiff = diff;
            closestRecord = sortedData[i];
        }
    }

    if (!closestRecord || smallestDiff > daysDiff * 0.5) {
        return null;
    }

    const growth = ((latest.orderNumber - closestRecord.orderNumber) / closestRecord.orderNumber) * 100;
    return growth;
}

function formatGrowthRate(rate) {
    if (rate === null) return 'N/A';

    const sign = rate >= 0 ? '+' : '';
    return `${sign}${rate.toFixed(2)}%`;
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
    const ctx = document.getElementById('trendChart').getContext('2d');
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

function updateTrendChart() {
    const market = document.getElementById('trend-market-filter').value;
    const marketData = orderData
        .filter(o => o.market === market)
        .sort((a, b) => new Date(a.discoveryDate) - new Date(b.discoveryDate));

    if (marketData.length === 0) {
        charts.trend.data.labels = [];
        charts.trend.data.datasets = [];
        charts.trend.update();
        return;
    }

    // Získání unikátních dat
    const dates = [...new Set(marketData.map(o => o.discoveryDate))].sort();

    // Získání unikátních konkurentů
    const competitors = [...new Set(marketData.map(o => o.competitor))];

    // Příprava datasetů
    const datasets = competitors.map((comp, index) => {
        const compData = marketData.filter(o => o.competitor === comp);
        const data = dates.map(date => {
            const record = compData.find(o => o.discoveryDate === date);
            return record ? record.orderNumber : null;
        });

        return {
            label: comp,
            data: data,
            borderColor: CHART_COLORS[index % CHART_COLORS.length],
            backgroundColor: CHART_COLORS[index % CHART_COLORS.length] + '20',
            tension: 0.1,
            spanGaps: true
        };
    });

    charts.trend.data.labels = dates.map(d => formatDate(d));
    charts.trend.data.datasets = datasets;
    charts.trend.update();
}

function initComparisonChart() {
    const ctx = document.getElementById('comparisonChart').getContext('2d');
    charts.comparison = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [{
                label: 'Růst (%)',
                data: [],
                backgroundColor: [],
                borderColor: [],
                borderWidth: 1
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
                            return context.parsed.y.toFixed(2) + '%';
                        }
                    }
                }
            },
            scales: {
                y: {
                    ticks: {
                        color: '#4b5563',
                        callback: function(value) {
                            return value + '%';
                        }
                    },
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

function updateComparisonChart() {
    const market = document.getElementById('comparison-market-filter').value;
    const period = document.getElementById('comparison-period-filter').value;

    const daysDiff = period === 'wow' ? 7 : (period === 'mom' ? 30 : 365);

    const marketData = orderData.filter(o => o.market === market);
    const competitors = [...new Set(marketData.map(o => o.competitor))];

    const growthData = competitors.map(comp => {
        const compData = marketData
            .filter(o => o.competitor === comp)
            .sort((a, b) => new Date(b.discoveryDate) - new Date(a.discoveryDate));

        const growth = calculateGrowthRate(compData, daysDiff);
        return { competitor: comp, growth: growth };
    }).filter(item => item.growth !== null);

    growthData.sort((a, b) => b.growth - a.growth);

    const labels = growthData.map(item => item.competitor);
    const data = growthData.map(item => item.growth);
    const colors = data.map(val => val >= 0 ? '#10b981' : '#ef4444');

    charts.comparison.data.labels = labels;
    charts.comparison.data.datasets[0].data = data;
    charts.comparison.data.datasets[0].backgroundColor = colors.map(c => c + 'CC');
    charts.comparison.data.datasets[0].borderColor = colors;
    charts.comparison.update();
}

function initMarketShareChart() {
    const ctx = document.getElementById('marketShareChart').getContext('2d');
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
    updateComparisonChart();
    updateMarketShareChart();
}

// =====================================================
// ZÁLOŽKA: SLEDOVÁNÍ MKT KAMPANÍ
// =====================================================

function setupMktTab() {
    const form = document.getElementById('campaign-form');
    const cancelEditButton = document.getElementById('cancel-edit-mkt-button');

    const competitorSelect = document.getElementById('competitor-mkt');
    const channelSelect = document.getElementById('channel-mkt');
    const filterCompetitorTable = document.getElementById('filter-competitor-mkt');
    const filterChannelTable = document.getElementById('filter-channel-mkt');
    const filterCompetitorChart = document.getElementById('chart-filter-competitor-mkt');
    const filterChannelChart = document.getElementById('chart-filter-channel-mkt');

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
        const index = mktCampaignData.findIndex(c => c.id === data.id);
        if (index !== -1) mktCampaignData[index] = data;
    } else {
        mktCampaignData.push(data);
    }

    mktCampaignData.sort((a, b) => new Date(b.discoveryDate) - new Date(a.discoveryDate));
    saveCampaignsToStorage();
    renderMktTable();
    updateMktChart();
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
    const campaign = mktCampaignData.find(c => c.id === id);
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

window.deleteMktCampaign = function(id) {
    if (confirm('Opravdu chcete smazat tuto kampaň? Tato akce je nevratná.')) {
        const index = mktCampaignData.findIndex(c => c.id === id);
        if (index !== -1) {
            mktCampaignData.splice(index, 1);
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

    const filteredData = mktCampaignData.filter(d => {
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

    let dataForChart = mktCampaignData;

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

    const iframeModal = document.getElementById('iframeModal');
    const modalHeaderTitle = document.getElementById('modalHeaderTitle');
    const modalBody = document.getElementById('modalBody');

    modalBody.innerHTML = '';
    modalHeaderTitle.textContent = `Náhled: ${url}`;

    const iframe = document.createElement('iframe');
    iframe.src = url;
    iframe.className = 'modal-iframe';

    modalBody.appendChild(iframe);
    iframeModal.style.display = "flex";

    setTimeout(() => {
        if (modalBody.children.length > 0 && modalBody.children[0] === iframe) {
            modalBody.innerHTML = `
                <div class="text-center py-8">
                    <p class="text-lg font-semibold text-red-600 mb-4">
                        Vizuální náhled se nepodařilo zobrazit v aplikaci.
                    </p>
                    <p class="mb-4">
                        Důvodem je blokování obsahu z externích stránek (CSP/X-Frame-Options) ze strany dané URL.
                    </p>
                    <p>
                        <a href="${url}" target="_blank" class="text-blue-600 hover:text-blue-800 underline font-medium">
                            Kliknutím otevřete odkaz v nové záložce pro zobrazení.
                        </a>
                    </p>
                </div>
            `;
        }
    }, 3000);
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
        button.classList.remove('border-blue-600', 'text-blue-600');
        button.classList.add('text-gray-500', 'hover:text-gray-700');
    });

    const tabContent = document.getElementById(tabId);
    const tabButtonId = 'tab-' + tabId.replace('-tracking', '');
    const tabButton = document.getElementById(tabButtonId);

    if (tabContent) {
        tabContent.style.display = 'block';
    }

    if (tabButton) {
        tabButton.classList.add('border-blue-600', 'text-blue-600');
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
