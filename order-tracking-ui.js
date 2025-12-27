// =====================================================
// UI PRO SLEDOVÁNÍ OBJEDNÁVEK - FORMULÁŘ
// =====================================================

/**
 * Vygeneruje formulářová pole pro všechny e-shopy
 * Rozlišuje vlastní e-shopy (počet objednávek) a konkurenty (číslo objednávky)
 */
function renderFormFields() {
    const container = document.getElementById('competitor-fields-container');
    if (!container) return;

    let html = '';

    // Sekce: CZ Konkurence
    html += '<div class="mb-6">';
    html += '<h4 class="text-lg font-semibold text-gray-900 mb-2 pb-2 border-b-2 border-blue-500">🇨🇿 České e-shopy - Konkurence</h4>';
    html += '<p class="text-sm text-gray-600 mb-4">Zadej číslo poslední objednávky</p>';
    html += '<div class="grid grid-cols-1 md:grid-cols-3 gap-4">';

    const czCompetitors = ["Hopnato.cz", "erosstar.cz", "deeplove.cz", "yoo.cz", "sexicekshop.cz", "honitka.cz", "sexshop.cz", "eroticke-pomucky.cz", "flagranti.cz", "sexshopik.cz", "sex-shop69.cz", "eroticcity.cz", "e-kondomy.cz"];
    czCompetitors.forEach(comp => {
        html += `
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">${comp}</label>
                <input type="number" id="comp-${sanitizeId(comp)}"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="Číslo objednávky">
            </div>`;
    });
    html += '</div></div>';

    // Sekce: CZ Vlastní e-shopy
    html += '<div class="mb-6">';
    html += '<h4 class="text-lg font-semibold text-green-900 mb-2 pb-2 border-b-2 border-green-500">🏪 České e-shopy - Vlastní</h4>';
    html += '<p class="text-sm text-green-700 mb-4">✅ Zadej počet objednávek (delta)</p>';
    html += '<div class="grid grid-cols-1 md:grid-cols-3 gap-4">';

    ["ruzovyslon.cz", "kondomshop.cz"].forEach(comp => {
        html += `
            <div class="bg-green-50 p-3 rounded-lg border-2 border-green-300">
                <label class="block text-sm font-bold text-green-900 mb-1">🌸 ${comp}</label>
                <input type="number" id="comp-${sanitizeId(comp)}"
                    class="w-full px-3 py-2 border-2 border-green-400 rounded-lg font-bold"
                    placeholder="Počet objednávek">
            </div>`;
    });
    html += '</div></div>';

    // Sekce: SK Konkurence
    html += '<div class="mb-6">';
    html += '<h4 class="text-lg font-semibold text-gray-900 mb-2 pb-2 border-b-2 border-blue-500">🇸🇰 Slovenské e-shopy - Konkurence</h4>';
    html += '<p class="text-sm text-gray-600 mb-4">Zadej číslo poslední objednávky</p>';
    html += '<div class="grid grid-cols-1 md:grid-cols-3 gap-4">';

    ["isexshop.sk", "flagranti.sk", "superlove.sk", "eros.sk"].forEach(comp => {
        html += `
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">${comp}</label>
                <input type="number" id="comp-${sanitizeId(comp)}"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    placeholder="Číslo objednávky">
            </div>`;
    });
    html += '</div></div>';

    // Sekce: SK Vlastní e-shopy
    html += '<div class="mb-6">';
    html += '<h4 class="text-lg font-semibold text-green-900 mb-2 pb-2 border-b-2 border-green-500">🏪 Slovenské e-shopy - Vlastní</h4>';
    html += '<p class="text-sm text-green-700 mb-4">✅ Zadej počet objednávek (delta)</p>';
    html += '<div class="grid grid-cols-1 md:grid-cols-3 gap-4">';

    ["ruzovyslon.sk", "kondomshop.sk"].forEach(comp => {
        html += `
            <div class="bg-green-50 p-3 rounded-lg border-2 border-green-300">
                <label class="block text-sm font-bold text-green-900 mb-1">🌸 ${comp}</label>
                <input type="number" id="comp-${sanitizeId(comp)}"
                    class="w-full px-3 py-2 border-2 border-green-400 rounded-lg font-bold"
                    placeholder="Počet objednávek">
            </div>`;
    });
    html += '</div></div>';

    // Sekce: Sexy Elephant (vlastní zahraniční)
    html += '<div class="mb-6">';
    html += '<h4 class="text-lg font-semibold text-green-900 mb-2 pb-2 border-b-2 border-green-500">🏪 Sexy Elephant - Vlastní (Zahraniční)</h4>';
    html += '<p class="text-sm text-green-700 mb-4">✅ Zadej počet objednávek (delta)</p>';
    html += '<div class="grid grid-cols-1 md:grid-cols-3 gap-4">';

    ["sexyelephant.ro", "sexyelephant.hu", "sexyelephant.si", "sexyelephant.bg", "sexyelephant.hr"].forEach(comp => {
        html += `
            <div class="bg-green-50 p-3 rounded-lg border-2 border-green-300">
                <label class="block text-sm font-bold text-green-900 mb-1">🐘 ${comp}</label>
                <input type="number" id="comp-${sanitizeId(comp)}"
                    class="w-full px-3 py-2 border-2 border-green-400 rounded-lg font-bold"
                    placeholder="Počet objednávek">
            </div>`;
    });
    html += '</div></div>';

    // Sekce: Superlove (konkurence zahraniční)
    html += '<div class="mb-6">';
    html += '<h4 class="text-lg font-semibold text-gray-900 mb-2 pb-2 border-b-2 border-blue-500">🌍 Superlove - Konkurence (Evropa)</h4>';
    html += '<p class="text-sm text-gray-600 mb-4">Zadej číslo poslední objednávky</p>';
    html += '<div class="grid grid-cols-1 md:grid-cols-4 gap-3">';

    ["superlove.ro", "superlove.pl", "superlove.eu", "superlove.at", "superlove.hr", "superlove.it", "superlove.si", "superlove.bg", "superlove.lt", "superlove.es", "superlove.hu"].forEach(comp => {
        html += `
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">${comp}</label>
                <input type="number" id="comp-${sanitizeId(comp)}"
                    class="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm"
                    placeholder="Č. obj.">
            </div>`;
    });
    html += '</div></div>';

    // Sekce: Maďarsko (konkurence)
    html += '<div class="mb-6">';
    html += '<h4 class="text-lg font-semibold text-gray-900 mb-2 pb-2 border-b-2 border-blue-500">🇭🇺 Maďarské e-shopy - Konkurence</h4>';
    html += '<p class="text-sm text-gray-600 mb-4">Zadej číslo poslední objednávky</p>';
    html += '<div class="grid grid-cols-1 md:grid-cols-4 gap-3">';

    ["goldengate.hu", "padlizsan.hu", "sexshopcenter.hu", "erotikashow.hu", "szexaruhaz.hu", "szexshop.hu", "vagyaim.hu"].forEach(comp => {
        html += `
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">${comp}</label>
                <input type="number" id="comp-${sanitizeId(comp)}"
                    class="w-full px-2 py-2 border border-gray-300 rounded-lg text-sm"
                    placeholder="Č. obj.">
            </div>`;
    });
    html += '</div></div>';

    container.innerHTML = html;
}

// Exportovat funkci pro použití jinde
window.renderFormFields = renderFormFields;

// =====================================================
// UI PRO SLEDOVÁNÍ OBJEDNÁVEK - TABULKA
// =====================================================

/**
 * Získá seznam e-shopů podle vybraných trhů ve filtru
 */
function getFilteredCompetitors() {
    const czChecked = document.getElementById('filter-market-cz')?.checked || false;
    const skChecked = document.getElementById('filter-market-sk')?.checked || false;
    const foreignChecked = document.getElementById('filter-market-foreign')?.checked || false;

    // Definice e-shopů podle trhů
    const czEshops = [
        "Hopnato.cz", "erosstar.cz", "deeplove.cz", "yoo.cz", "sexicekshop.cz",
        "honitka.cz", "sexshop.cz", "eroticke-pomucky.cz", "flagranti.cz",
        "sexshopik.cz", "sex-shop69.cz", "eroticcity.cz", "e-kondomy.cz",
        "ruzovyslon.cz", "kondomshop.cz"
    ];

    const skEshops = [
        "isexshop.sk", "flagranti.sk", "superlove.sk", "eros.sk",
        "ruzovyslon.sk", "kondomshop.sk"
    ];

    const foreignEshops = [
        "sexyelephant.ro", "sexyelephant.hu", "sexyelephant.si",
        "sexyelephant.bg", "sexyelephant.hr",
        "superlove.ro", "superlove.pl", "superlove.eu", "superlove.at",
        "superlove.hr", "superlove.it", "superlove.si", "superlove.bg",
        "superlove.lt", "superlove.es", "superlove.hu",
        "goldengate.hu", "padlizsan.hu", "sexshopcenter.hu",
        "erotikashow.hu", "szexaruhaz.hu", "szexshop.hu", "vagyaim.hu"
    ];

    let filtered = [];
    if (czChecked) filtered = filtered.concat(czEshops);
    if (skChecked) filtered = filtered.concat(skEshops);
    if (foreignChecked) filtered = filtered.concat(foreignEshops);

    // Pokud není nic vybráno, zobraz CZ trh defaultně
    if (filtered.length === 0) {
        filtered = czEshops;
    }

    return filtered;
}

/**
 * Vygeneruje hlavičku tabulky podle vybraných e-shopů
 */
function renderTrackingTableHead(competitors) {
    const thead = document.getElementById('tracking-table-head');
    if (!thead) return;

    let html = `
        <th scope="col" class="px-4 py-3 text-xs font-bold uppercase tracking-wider text-center bg-gray-900 sticky left-0 border-r-2 border-gray-600 z-20">
            Datum
        </th>
    `;

    competitors.forEach(comp => {
        const isOwnEshop = window.OWN_ESHOPS && window.OWN_ESHOPS.includes(comp);
        const bgClass = isOwnEshop ? 'bg-green-600' : '';
        const icon = isOwnEshop ? '🌸 ' : '';

        html += `
            <th scope="col" class="px-3 py-3 text-xs font-bold uppercase tracking-wider text-center ${bgClass}">
                ${icon}${comp}
            </th>
        `;
    });

    html += `
        <th scope="col" class="px-3 py-3 text-xs font-bold uppercase tracking-wider text-center bg-yellow-600 border-l-2 border-yellow-400">Celkem Δ</th>
        <th scope="col" class="px-3 py-3 text-xs font-bold uppercase tracking-wider text-center bg-green-600">Slon %</th>
        <th scope="col" class="px-3 py-3 text-xs font-bold uppercase tracking-wider text-center bg-blue-600">📝 Poznámky</th>
        <th scope="col" class="px-3 py-3 text-xs font-bold uppercase tracking-wider text-center bg-gray-700 sticky right-0 border-l-2 border-gray-600 z-20">Akce</th>
    `;

    thead.innerHTML = html;
}

/**
 * Toggle všechny checkboxy trhů
 */
window.toggleAllMarkets = function() {
    const checkboxes = document.querySelectorAll('.market-filter-checkbox');
    const allChecked = Array.from(checkboxes).every(cb => cb.checked);

    checkboxes.forEach(cb => cb.checked = !allChecked);
    renderTrackingTable();
};

function renderTrackingTable() {
    const tbody = document.getElementById('tracking-table-body');
    if (!tbody) return;

    // Získat filtrované e-shopy podle výběru trhů
    const filteredCompetitors = getFilteredCompetitors();

    // Vygenerovat hlavičku tabulky
    renderTrackingTableHead(filteredCompetitors);

    tbody.innerHTML = '';

    if (!window.trackingData || window.trackingData.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="${filteredCompetitors.length + 5}" class="text-center p-8 text-gray-500">
                    <div class="space-y-2">
                        <p class="text-lg font-medium">Zatím nebyly přidány žádné záznamy.</p>
                        <p class="text-sm">Klikněte na "Přidat záznam" nebo importujte data z Google Sheets.</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    // Seřadit podle data (nejnovější nahoře)
    const sortedData = [...window.trackingData].sort((a, b) => new Date(b.date) - new Date(a.date));

    sortedData.forEach(record => {
        const row = document.createElement('tr');
        row.className = "hover:bg-blue-50 transition-colors border-b border-gray-200";

        // Datum
        row.innerHTML = `
            <td class="px-4 py-3 text-sm font-bold text-gray-900 bg-gray-50 sticky left-0 border-r border-gray-300">
                ${formatDate(record.date)}
            </td>
        `;

        // Pro každého FILTROVANÉHO e-shopu: Číslo objednávky a Delta
        filteredCompetitors.forEach((comp, index) => {
            const orderNum = record.competitors[comp] || 0;
            const delta = record.deltas[comp] || 0;
            const deltaClass = delta > 0 ? 'text-green-600' : (delta < 0 ? 'text-red-600' : 'text-gray-400');

            // Zjistit, jestli je to vlastní e-shop
            const isOwnEshop = window.OWN_ESHOPS && window.OWN_ESHOPS.includes(comp);

            // Pro vlastní e-shopy zelené pozadí, jinak normální
            const bgClass = isOwnEshop ? 'bg-green-50 font-bold' : '';

            // Pro vlastní e-shopy zobrazit "-" místo čísla objednávky
            const orderNumDisplay = isOwnEshop ? '-' : orderNum.toLocaleString('cs-CZ');

            row.innerHTML += `
                <td class="px-3 py-3 text-sm text-center ${bgClass}">
                    <div class="font-medium text-gray-500 text-xs">${orderNumDisplay}</div>
                    <div class="${deltaClass} text-xs font-semibold">
                        ${delta > 0 ? '+' : ''}${delta.toLocaleString('cs-CZ')}
                    </div>
                </td>
            `;
        });

        // Agregované metriky a poznámky
        const escapeHtml = (text) => {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML;
        };

        const notesDisplay = record.notes && record.notes.trim() !== ''
            ? `<span class="text-xs text-gray-700 italic" title="${escapeHtml(record.notes)}">${escapeHtml(record.notes.length > 30 ? record.notes.substring(0, 30) + '...' : record.notes)}</span>`
            : '<span class="text-xs text-gray-400">-</span>';

        row.innerHTML += `
            <td class="px-3 py-3 text-sm text-center bg-yellow-50 font-bold border-l-2 border-yellow-300">
                ${record.totalOrders.toLocaleString('cs-CZ')}
            </td>
            <td class="px-3 py-3 text-sm text-center bg-green-50 font-bold">
                ${record.slonShare.toFixed(1)}%
            </td>
            <td class="px-3 py-3 text-sm text-left bg-blue-50">
                ${notesDisplay}
            </td>
            <td class="px-3 py-3 text-sm text-right bg-gray-50 sticky right-0 border-l border-gray-300">
                <button onclick="editTrackingRecord(${record.id})" class="text-blue-600 hover:text-blue-800 mr-2">
                    ✏️
                </button>
                <button onclick="deleteTrackingRecord(${record.id})" class="text-red-600 hover:text-red-800">
                    🗑️
                </button>
            </td>
        `;

        tbody.appendChild(row);
    });

    // Aktualizovat metriky
    updateMetricsDisplay();
}

// =====================================================
// FORMULÁŘ PRO PŘIDÁNÍ/EDITACI ZÁZNAMU
// =====================================================

function showAddRecordForm() {
    const modal = document.getElementById('record-form-modal');
    if (!modal) return;

    // Vygenerovat formulářová pole pro e-shopy (pokud ještě nejsou)
    if (typeof renderFormFields === 'function') {
        renderFormFields();
    }

    // Reset formuláře
    document.getElementById('record-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('record-id').value = '';
    document.getElementById('form-title-record').textContent = 'Přidat nový záznam';

    // Vyčistit všechna pole pro konkurenty
    window.COMPETITORS.forEach(comp => {
        const input = document.getElementById(`comp-${sanitizeId(comp)}`);
        if (input) input.value = '';
    });

    // Vyčistit pole pro koncové hodnoty měsíce
    const erosstarMonthEnd = document.getElementById('monthend-erosstar-cz');
    const deeploveMonthEnd = document.getElementById('monthend-deeplove-cz');
    if (erosstarMonthEnd) erosstarMonthEnd.value = '';
    if (deeploveMonthEnd) deeploveMonthEnd.value = '';

    modal.classList.remove('hidden');
}

function hideRecordForm() {
    const modal = document.getElementById('record-form-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

function handleRecordFormSubmit(e) {
    e.preventDefault();

    const recordId = document.getElementById('record-id').value;
    const date = document.getElementById('record-date').value;

    const record = {
        id: recordId ? parseInt(recordId) : Date.now(),
        date: date,
        competitors: {},
        deltas: {},
        monthEndValues: {},
        notes: document.getElementById('record-notes').value || ''
    };

    // Načíst data pro všechny e-shopy
    // Rozlišujeme vlastní e-shopy (ukládáme delty přímo) a konkurenty (ukládáme čísla objednávek)
    window.COMPETITORS.forEach(comp => {
        const input = document.getElementById(`comp-${sanitizeId(comp)}`);
        const value = input && input.value ? parseInt(input.value) || 0 : 0;

        // Zjistit, jestli je to vlastní e-shop
        const isOwnEshop = window.OWN_ESHOPS && window.OWN_ESHOPS.includes(comp);

        if (isOwnEshop) {
            // Vlastní e-shop: uložit deltu přímo (zadává se počet objednávek)
            record.deltas[comp] = value;
            record.competitors[comp] = 0;  // Číslo objednávky nepoužíváme
        } else {
            // Konkurent: uložit číslo objednávky (delta se vypočítá později)
            record.competitors[comp] = value;
            record.deltas[comp] = 0; // Delta se přepočítá v calculateDeltas()
        }
    });

    // Načíst koncové hodnoty měsíce (erosstar.cz, deeplove.cz)
    const erosstarMonthEnd = document.getElementById('monthend-erosstar-cz');
    const deeploveMonthEnd = document.getElementById('monthend-deeplove-cz');

    if (erosstarMonthEnd && erosstarMonthEnd.value) {
        record.monthEndValues['erosstar.cz'] = parseInt(erosstarMonthEnd.value) || 0;
    }
    if (deeploveMonthEnd && deeploveMonthEnd.value) {
        record.monthEndValues['deeplove.cz'] = parseInt(deeploveMonthEnd.value) || 0;
    }

    // Aktualizovat nebo přidat záznam
    if (recordId) {
        const index = window.trackingData.findIndex(r => r.id === parseInt(recordId));
        if (index !== -1) {
            // Zachovat firestoreId pokud existuje
            record.firestoreId = window.trackingData[index].firestoreId;
            window.trackingData[index] = record;
        }
    } else {
        window.trackingData.push(record);
    }

    // Přepočítat delty
    calculateDeltas();

    // Uložit do Firestore (pokud je aktivní)
    if (typeof saveTrackingRecordToFirestore === 'function') {
        saveTrackingRecordToFirestore(record);
    }

    // Uložit a aktualizovat UI
    saveTrackingData();
    renderTrackingTable();

    // Aktualizovat metriky
    if (typeof updateMetricsDisplay === 'function') {
        updateMetricsDisplay();
    }

    updateAllCharts();
    hideRecordForm();
}

window.editTrackingRecord = function(id) {
    const record = window.trackingData.find(r => r.id === id);
    if (!record) return;

    document.getElementById('record-id').value = record.id;
    document.getElementById('record-date').value = record.date;
    document.getElementById('record-notes').value = record.notes || '';

    // Naplnit pole pro všechny e-shopy
    window.COMPETITORS.forEach(comp => {
        const input = document.getElementById(`comp-${sanitizeId(comp)}`);
        if (input) {
            // Pro vlastní e-shopy použít DELTY, pro konkurenty čísla objednávek
            const isOwnEshop = window.OWN_ESHOPS && window.OWN_ESHOPS.includes(comp);

            if (isOwnEshop) {
                // Vlastní e-shop - zobrazit deltu (počet objednávek)
                input.value = record.deltas[comp] || '';
            } else {
                // Konkurent - zobrazit číslo objednávky
                input.value = record.competitors[comp] || '';
            }
        }
    });

    // Naplnit koncové hodnoty měsíce
    const erosstarMonthEnd = document.getElementById('monthend-erosstar-cz');
    const deeploveMonthEnd = document.getElementById('monthend-deeplove-cz');

    if (erosstarMonthEnd) {
        erosstarMonthEnd.value = (record.monthEndValues && record.monthEndValues['erosstar.cz']) || '';
    }
    if (deeploveMonthEnd) {
        deeploveMonthEnd.value = (record.monthEndValues && record.monthEndValues['deeplove.cz']) || '';
    }

    document.getElementById('form-title-record').textContent = 'Upravit záznam';
    document.getElementById('record-form-modal').classList.remove('hidden');
};

window.deleteTrackingRecord = async function(id) {
    if (!confirm('Opravdu chcete smazat tento záznam? Tato akce je nevratná.')) {
        return;
    }

    const index = window.trackingData.findIndex(r => r.id === id);
    if (index !== -1) {
        // Smazat z Firestore (pokud je aktivní)
        if (typeof deleteTrackingRecordFromFirestore === 'function') {
            await deleteTrackingRecordFromFirestore(id);
        }

        window.trackingData.splice(index, 1);
        calculateDeltas();
        saveTrackingData();
        renderTrackingTable();
        updateAllCharts();
    }
};

// =====================================================
// METRIKY - RŮŽOVÝ SLON
// =====================================================

function updateMetricsDisplay() {
    if (!window.trackingData || window.trackingData.length === 0) {
        resetAllMetrics();
        return;
    }

    // Seřadit data podle data
    const sorted = [...window.trackingData].sort((a, b) => new Date(b.date) - new Date(a.date));
    const latest = sorted[0];
    const dateStr = formatDate(latest.date);

    // CZ e-shopy
    const czEshops = [
        "Hopnato.cz", "erosstar.cz", "deeplove.cz", "yoo.cz", "sexicekshop.cz",
        "honitka.cz", "sexshop.cz", "eroticke-pomucky.cz", "flagranti.cz",
        "sexshopik.cz", "sex-shop69.cz", "eroticcity.cz", "e-kondomy.cz",
        "ruzovyslon.cz", "kondomshop.cz"
    ];

    // SK e-shopy
    const skEshops = [
        "isexshop.sk", "flagranti.sk", "superlove.sk", "eros.sk",
        "ruzovyslon.sk", "kondomshop.sk"
    ];

    // Foreign e-shopy
    const foreignEshops = [
        "sexyelephant.ro", "sexyelephant.hu", "sexyelephant.si",
        "sexyelephant.bg", "sexyelephant.hr",
        "superlove.ro", "superlove.pl", "superlove.eu", "superlove.at",
        "superlove.hr", "superlove.it", "superlove.si", "superlove.bg",
        "superlove.lt", "superlove.es", "superlove.hu",
        "goldengate.hu", "padlizsan.hu", "sexshopcenter.hu",
        "erotikashow.hu", "szexaruhaz.hu", "szexshop.hu", "vagyaim.hu"
    ];

    // Aktualizovat CZ metriky
    updateMarketMetrics('cz', czEshops, latest, sorted, dateStr, ['ruzovyslon.cz', 'kondomshop.cz']);

    // Aktualizovat SK metriky
    updateMarketMetrics('sk', skEshops, latest, sorted, dateStr, ['ruzovyslon.sk', 'kondomshop.sk']);

    // Aktualizovat Foreign metriky
    updateMarketMetrics('foreign', foreignEshops, latest, sorted, dateStr, [
        'sexyelephant.ro', 'sexyelephant.hu', 'sexyelephant.si', 'sexyelephant.bg', 'sexyelephant.hr'
    ]);
}

function updateMarketMetrics(market, eshops, latest, sorted, dateStr, ownEshops) {
    // Celkový počet objednávek na trhu (DELTY, ne absolutní čísla!)
    let totalOrders = 0;
    let ownOrders = 0;
    let topCompetitor = { name: '-', orders: 0 };

    eshops.forEach(eshop => {
        const delta = latest.deltas[eshop] || 0;
        totalOrders += delta;

        if (ownEshops.includes(eshop)) {
            ownOrders += delta;
        } else {
            // Hledat top konkurenta (ne vlastní e-shop)
            if (delta > topCompetitor.orders) {
                topCompetitor = { name: eshop, orders: delta };
            }
        }
    });

    // Aktualizovat DOM
    document.getElementById(`metric-${market}-period`).textContent = `K ${dateStr}`;
    document.getElementById(`metric-${market}-total`).textContent = totalOrders.toLocaleString('cs-CZ');

    // Vlastní e-shopy
    if (market === 'cz' || market === 'sk') {
        document.getElementById(`metric-${market}-slon`).textContent = ownOrders.toLocaleString('cs-CZ');
        const share = totalOrders > 0 ? (ownOrders / totalOrders * 100).toFixed(1) : '0.0';
        document.getElementById(`metric-${market}-slon-share`).textContent = `Podíl: ${share}%`;
    } else if (market === 'foreign') {
        document.getElementById(`metric-${market}-elephant`).textContent = ownOrders.toLocaleString('cs-CZ');
        const share = totalOrders > 0 ? (ownOrders / totalOrders * 100).toFixed(1) : '0.0';
        document.getElementById(`metric-${market}-elephant-share`).textContent = `Podíl: ${share}%`;
    }

    // Top konkurent
    document.getElementById(`metric-${market}-top-name`).textContent = topCompetitor.name;
    document.getElementById(`metric-${market}-top-orders`).textContent = topCompetitor.orders.toLocaleString('cs-CZ');

    // Růst měsíc/měsíc (celého trhu)
    const mom = calculateMarketGrowth(sorted, eshops, 30);
    document.getElementById(`metric-${market}-mom`).textContent =
        mom !== null ? `${mom > 0 ? '+' : ''}${mom.toFixed(1)}%` : 'N/A';
}

function calculateMarketGrowth(sortedData, eshops, daysDiff) {
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

    // Sečíst DELTY pro tento trh
    let latestTotal = 0;
    let oldTotal = 0;

    eshops.forEach(eshop => {
        latestTotal += latest.deltas[eshop] || 0;
        oldTotal += closestRecord.deltas[eshop] || 0;
    });

    if (oldTotal === 0) return null;

    // Růst = ((nové - staré) / staré) * 100
    return ((latestTotal - oldTotal) / oldTotal) * 100;
}

function resetAllMetrics() {
    ['cz', 'sk', 'foreign'].forEach(market => {
        document.getElementById(`metric-${market}-period`).textContent = '-';
        document.getElementById(`metric-${market}-total`).textContent = '-';
        document.getElementById(`metric-${market}-mom`).textContent = '-';
        document.getElementById(`metric-${market}-top-name`).textContent = '-';
        document.getElementById(`metric-${market}-top-orders`).textContent = '-';

        if (market === 'cz' || market === 'sk') {
            document.getElementById(`metric-${market}-slon`).textContent = '-';
            document.getElementById(`metric-${market}-slon-share`).textContent = 'Podíl: -';
        } else {
            document.getElementById(`metric-${market}-elephant`).textContent = '-';
            document.getElementById(`metric-${market}-elephant-share`).textContent = 'Podíl: -';
        }
    });
}

function calculateGrowth(sortedData, daysDiff) {
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

    // Použít absolutní čísla objednávek, ne delty!
    const latestOrders = latest.competitors['ruzovyslon.cz'] || 0;
    const oldOrders = closestRecord.competitors['ruzovyslon.cz'] || 0;

    if (oldOrders === 0) return null;

    // Růst = ((nové - staré) / staré) * 100
    return ((latestOrders - oldOrders) / oldOrders) * 100;
}

// =====================================================
// HELPER FUNKCE
// =====================================================

function sanitizeId(str) {
    return str.replace(/[^a-zA-Z0-9]/g, '-');
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
}

// Export funkcí
window.renderTrackingTable = renderTrackingTable;
window.showAddRecordForm = showAddRecordForm;
window.hideRecordForm = hideRecordForm;
window.handleRecordFormSubmit = handleRecordFormSubmit;
window.updateMetricsDisplay = updateMetricsDisplay;
