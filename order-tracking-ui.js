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
    html += '<h4 class="text-lg font-semibold text-gray-900 mb-2 pb-2 border-b-2 border-blue-500">CZ - České e-shopy - Konkurence</h4>';
    html += '<p class="text-sm text-gray-600 mb-4">Zadej číslo poslední objednávky</p>';
    html += '<div class="grid grid-cols-1 md:grid-cols-3 gap-4">';

    const czCompetitors = ["Hopnato.cz", "erosstar.cz", "deeplove.cz", "yoo.cz", "honitka.cz", "eroticke-pomucky.cz", "flagranti.cz", "sexshopik.cz", "e-kondomy.cz"];
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
    html += '<h4 class="text-lg font-semibold text-green-900 mb-2 pb-2 border-b-2 border-green-500">České e-shopy - Vlastní</h4>';
    html += '<p class="text-sm text-green-700 mb-4">Zadej počet objednávek (delta)</p>';
    html += '<div class="grid grid-cols-1 md:grid-cols-3 gap-4">';

    ["ruzovyslon.cz", "kondomshop.cz"].forEach(comp => {
        html += `
            <div class="bg-green-50 p-3 rounded-lg border-2 border-green-300">
                <label class="block text-sm font-bold text-green-900 mb-1">${comp}</label>
                <input type="number" id="comp-${sanitizeId(comp)}"
                    class="w-full px-3 py-2 border-2 border-green-400 rounded-lg font-bold"
                    placeholder="Počet objednávek">
            </div>`;
    });
    html += '</div></div>';

    // Sekce: SK Konkurence
    html += '<div class="mb-6">';
    html += '<h4 class="text-lg font-semibold text-gray-900 mb-2 pb-2 border-b-2 border-blue-500">SK - Slovenské e-shopy - Konkurence</h4>';
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
    html += '<h4 class="text-lg font-semibold text-green-900 mb-2 pb-2 border-b-2 border-green-500">Slovenské e-shopy - Vlastní</h4>';
    html += '<p class="text-sm text-green-700 mb-4">Zadej počet objednávek (delta)</p>';
    html += '<div class="grid grid-cols-1 md:grid-cols-3 gap-4">';

    ["ruzovyslon.sk", "kondomshop.sk"].forEach(comp => {
        html += `
            <div class="bg-green-50 p-3 rounded-lg border-2 border-green-300">
                <label class="block text-sm font-bold text-green-900 mb-1">${comp}</label>
                <input type="number" id="comp-${sanitizeId(comp)}"
                    class="w-full px-3 py-2 border-2 border-green-400 rounded-lg font-bold"
                    placeholder="Počet objednávek">
            </div>`;
    });
    html += '</div></div>';

    // Sekce: Sexy Elephant (vlastní zahraniční)
    html += '<div class="mb-6">';
    html += '<h4 class="text-lg font-semibold text-green-900 mb-2 pb-2 border-b-2 border-green-500">Sexy Elephant - Vlastní (Zahraniční)</h4>';
    html += '<p class="text-sm text-green-700 mb-4">Zadej počet objednávek (delta)</p>';
    html += '<div class="grid grid-cols-1 md:grid-cols-3 gap-4">';

    ["sexyelephant.ro", "sexyelephant.hu", "sexyelephant.si", "sexyelephant.bg", "sexyelephant.hr"].forEach(comp => {
        html += `
            <div class="bg-green-50 p-3 rounded-lg border-2 border-green-300">
                <label class="block text-sm font-bold text-green-900 mb-1">${comp}</label>
                <input type="number" id="comp-${sanitizeId(comp)}"
                    class="w-full px-3 py-2 border-2 border-green-400 rounded-lg font-bold"
                    placeholder="Počet objednávek">
            </div>`;
    });
    html += '</div></div>';

    // Sekce: Superlove (konkurence zahraniční)
    html += '<div class="mb-6">';
    html += '<h4 class="text-lg font-semibold text-gray-900 mb-2 pb-2 border-b-2 border-blue-500">Superlove - Konkurence (Evropa)</h4>';
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
 * Vykreslí hlavičku tabulky pro daný trh
 * @param {string} market - 'CZ', 'SK', nebo 'Foreign'
 * @param {Array} competitors - seznam e-shopů
 */
function renderTrackingTableHead(market, competitors) {
    const thead = document.getElementById(`tracking-table-head-${market.toLowerCase()}`);
    if (!thead) return;

    let html = `<tr>
        <th scope="col" class="px-4 py-3 text-xs font-bold uppercase tracking-wider text-center bg-gray-900 sticky left-0 border-r-2 border-gray-600 z-20">
            Datum
        </th>
    `;

    competitors.forEach(comp => {
        const isOwnEshop = window.OWN_ESHOPS && window.OWN_ESHOPS.includes(comp);
        const bgClass = isOwnEshop ? 'bg-green-600' : '';
        const icon = isOwnEshop ? '' : '';

        html += `
            <th scope="col" class="px-3 py-3 text-xs font-bold uppercase tracking-wider text-center ${bgClass}">
                ${icon}${comp}
            </th>
        `;
    });

    // CELKEM Δ a SLON % pouze pro CZ a SK
    if (market === 'CZ' || market === 'SK') {
        html += `
            <th scope="col" class="px-3 py-3 text-xs font-bold uppercase tracking-wider text-center bg-yellow-600 border-l-2 border-yellow-400">Celkem Δ</th>
            <th scope="col" class="px-3 py-3 text-xs font-bold uppercase tracking-wider text-center bg-green-600">Slon %</th>
        `;
    }

    html += `
        <th scope="col" class="px-3 py-3 text-xs font-bold uppercase tracking-wider text-center bg-gray-700 sticky right-0 border-l-2 border-gray-600 z-20">Akce</th>
    </tr>`;

    thead.innerHTML = html;
}

/**
 * Hlavní funkce pro vykreslení všech tří tabulek (CZ, SK, Foreign)
 */
function renderTrackingTable() {
    // Definice e-shopů podle trhů
    const czEshops = ["Hopnato.cz", "erosstar.cz", "deeplove.cz", "yoo.cz", "honitka.cz", "eroticke-pomucky.cz", "flagranti.cz", "sexshopik.cz", "e-kondomy.cz", "ruzovyslon.cz", "kondomshop.cz"];
    const skEshops = ["isexshop.sk", "flagranti.sk", "superlove.sk", "eros.sk", "ruzovyslon.sk", "kondomshop.sk"];
    const foreignEshops = ["sexyelephant.ro", "sexyelephant.hu", "sexyelephant.si", "sexyelephant.bg", "sexyelephant.hr", "superlove.ro", "superlove.pl", "superlove.eu", "superlove.at", "superlove.hr", "superlove.it", "superlove.si", "superlove.bg", "superlove.lt", "superlove.es", "superlove.hu", "goldengate.hu", "padlizsan.hu", "sexshopcenter.hu", "erotikashow.hu", "szexaruhaz.hu", "szexshop.hu", "vagyaim.hu"];

    // Vykreslit každou tabulku
    renderMarketTable('CZ', czEshops);
    renderMarketTable('SK', skEshops);

    // Aktualizovat metriky
    updateMetricsDisplay();
}

/**
 * Vykreslí tabulku pro konkrétní trh
 * @param {string} market - 'CZ', 'SK', nebo 'Foreign'
 * @param {Array} eshops - seznam e-shopů pro tento trh
 */
function renderMarketTable(market, eshops) {
    const tbody = document.getElementById(`tracking-table-body-${market.toLowerCase()}`);
    if (!tbody) {
        console.error(`Table body not found for market: ${market}`);
        return;
    }

    // Vygenerovat hlavičku
    renderTrackingTableHead(market, eshops);

    tbody.innerHTML = '';

    if (!window.trackingData || window.trackingData.length === 0) {
        const extraCols = (market === 'CZ' || market === 'SK') ? 3 : 1; // Akce + (CELKEM Δ + SLON % pro CZ/SK)
        tbody.innerHTML = `
            <tr>
                <td colspan="${eshops.length + extraCols}" class="text-center p-8 text-gray-500">
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

    // Filtrovat záznamy - zobrazit pouze ty, které mají alespoň jednu nenulovou hodnotu pro tento trh
    const filteredData = sortedData.filter(record => {
        return eshops.some(eshop => {
            const orderNum = record.competitors[eshop] || 0;
            const delta = record.deltas[eshop] || 0;
            return orderNum !== 0 || delta !== 0;
        });
    });

    filteredData.forEach(record => {
        const row = document.createElement('tr');
        row.className = "hover:bg-blue-50 transition-colors border-b border-gray-200";

        // Datum
        row.innerHTML = `
            <td class="px-4 py-3 text-sm font-bold text-gray-900 bg-gray-50 sticky left-0 border-r border-gray-300">
                ${formatDate(record.date)}
            </td>
        `;

        // Pro každý e-shop v tomto trhu
        eshops.forEach(eshop => {
            const orderNum = record.competitors[eshop] || 0;
            const delta = record.deltas[eshop] || 0;

            // Zjistit, jestli je označeno jako nezměřeno
            const isNotMeasured = record.notMeasured && record.notMeasured[eshop];

            const deltaClass = delta > 0 ? 'text-green-600' : (delta < 0 ? 'text-red-600' : 'text-gray-400');

            // Zjistit, jestli je to vlastní e-shop
            const isOwnEshop = window.OWN_ESHOPS && window.OWN_ESHOPS.includes(eshop);

            // Pro vlastní e-shopy zelené pozadí, pro nezměřené šedé
            let bgClass = '';
            if (isNotMeasured) {
                bgClass = 'bg-gray-200 opacity-60';
            } else if (isOwnEshop) {
                bgClass = 'bg-green-50 font-bold';
            }

            // Pro vlastní e-shopy zobrazit "-" místo čísla objednávky
            const orderNumDisplay = isOwnEshop ? '-' : orderNum.toLocaleString('cs-CZ');

            // Získat poznámku pro tento e-shop (pokud existuje)
            const cellNote = record.cellNotes && record.cellNotes[eshop] ? record.cellNotes[eshop] : '';
            const noteTitle = cellNote ? `title="${escapeHtml(cellNote)}"` : '';

            // Zkrácený text poznámky pro zobrazení (max 15 znaků)
            const noteDisplay = cellNote ?
                (cellNote.length > 15 ? cellNote.substring(0, 15) + '...' : cellNote) :
                '';

            // Speciální zobrazení pro nezměřené buňky
            if (isNotMeasured) {
                row.innerHTML += `
                    <td class="px-3 py-3 text-sm text-center ${bgClass} cursor-pointer hover:bg-gray-300 relative"
                        onclick="editCellNote('${record.id}', '${eshop}')" ${noteTitle}>
                        <div class="font-medium text-gray-400 text-xs line-through">${orderNumDisplay}</div>
                        <div class="text-gray-400 text-xs font-semibold line-through">
                            ${delta > 0 ? '+' : ''}${delta.toLocaleString('cs-CZ')}
                        </div>
                        <div class="text-red-600 text-xs font-bold mt-1">⊗ N/A</div>
                        ${cellNote ? `<div class="text-blue-600 text-xs italic mt-1">${escapeHtml(noteDisplay)}</div>` : ''}
                    </td>
                `;
            } else {
                row.innerHTML += `
                    <td class="px-3 py-3 text-sm text-center ${bgClass} cursor-pointer hover:bg-blue-100"
                        onclick="editCellNote('${record.id}', '${eshop}')" ${noteTitle}>
                        <div class="font-medium text-gray-500 text-xs">${orderNumDisplay}</div>
                        <div class="${deltaClass} text-xs font-semibold">
                            ${delta > 0 ? '+' : ''}${delta.toLocaleString('cs-CZ')}
                        </div>
                        ${cellNote ? `<div class="text-blue-600 text-xs italic mt-1">${escapeHtml(noteDisplay)}</div>` : ''}
                    </td>
                `;
            }
        });

        // CELKEM Δ a SLON % pouze pro CZ a SK
        if (market === 'CZ' || market === 'SK') {
            // Vypočítat celkový delta pro tento trh (přeskočit nezměřené e-shopy)
            const totalDelta = eshops.reduce((sum, eshop) => {
                // Přeskočit, pokud je e-shop označen jako nezměřeno
                if (record.notMeasured && record.notMeasured[eshop]) {
                    console.log(`🚫 Přeskakuji nezměřený e-shop: ${eshop} v záznamu ${record.date}`);
                    return sum;
                }
                return sum + (record.deltas[eshop] || 0);
            }, 0);

            // Vypočítat Slon % pro tento trh (přeskočit nezměřené e-shopy)
            const ownEshops = market === 'CZ' ? ['ruzovyslon.cz', 'kondomshop.cz'] : ['ruzovyslon.sk', 'kondomshop.sk'];
            const slonDelta = ownEshops.reduce((sum, eshop) => {
                // Přeskočit, pokud je e-shop označen jako nezměřeno
                if (record.notMeasured && record.notMeasured[eshop]) {
                    return sum;
                }
                return sum + (record.deltas[eshop] || 0);
            }, 0);
            const slonShare = totalDelta > 0 ? (slonDelta / totalDelta * 100) : 0;

            row.innerHTML += `
                <td class="px-3 py-3 text-sm text-center bg-yellow-50 font-bold border-l-2 border-yellow-300">
                    ${totalDelta.toLocaleString('cs-CZ')}
                </td>
                <td class="px-3 py-3 text-sm text-center bg-green-50 font-bold">
                    ${slonShare.toFixed(1)}%
                </td>
            `;
        }

        // Akce
        row.innerHTML += `
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
}

// Pomocná funkce pro escapování HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
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

    // Načíst manuální delty (přepíší automatický výpočet)
    const manualDeltaErosstar = document.getElementById('manual-delta-erosstar-cz');
    const manualDeltaDeeplove = document.getElementById('manual-delta-deeplove-cz');

    // Inicializovat manualDeltas, pokud neexistuje
    if (!record.manualDeltas) {
        record.manualDeltas = {};
    }

    if (manualDeltaErosstar && manualDeltaErosstar.value) {
        const value = parseInt(manualDeltaErosstar.value) || 0;
        record.manualDeltas['erosstar.cz'] = value;
        console.log(`✏️ Ruční delta pro erosstar.cz: ${value}`);
    }
    if (manualDeltaDeeplove && manualDeltaDeeplove.value) {
        const value = parseInt(manualDeltaDeeplove.value) || 0;
        record.manualDeltas['deeplove.cz'] = value;
        console.log(`✏️ Ruční delta pro deeplove.cz: ${value}`);
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

    // Najít aktualizovaný record po přepočtu delt
    const updatedRecord = window.trackingData.find(r => r.id === record.id);

    // Uložit do Firestore (pokud je aktivní) - použít aktualizovaný record s přepočtenými deltami
    if (typeof saveTrackingRecordToFirestore === 'function' && updatedRecord) {
        saveTrackingRecordToFirestore(updatedRecord);
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

    // Naplnit manuální delty
    const manualDeltaErosstar = document.getElementById('manual-delta-erosstar-cz');
    const manualDeltaDeeplove = document.getElementById('manual-delta-deeplove-cz');

    if (manualDeltaErosstar) {
        manualDeltaErosstar.value = (record.manualDeltas && record.manualDeltas['erosstar.cz']) || '';
    }
    if (manualDeltaDeeplove) {
        manualDeltaDeeplove.value = (record.manualDeltas && record.manualDeltas['deeplove.cz']) || '';
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
        "Hopnato.cz", "erosstar.cz", "deeplove.cz", "yoo.cz",
        "honitka.cz", "eroticke-pomucky.cz", "flagranti.cz",
        "sexshopik.cz", "e-kondomy.cz",
        "ruzovyslon.cz", "kondomshop.cz"
    ];

    // SK e-shopy
    const skEshops = [
        "isexshop.sk", "flagranti.sk", "superlove.sk", "eros.sk",
        "ruzovyslon.sk", "kondomshop.sk"
    ];

    // Aktualizovat CZ metriky
    updateMarketMetrics('cz', czEshops, latest, sorted, dateStr, ['ruzovyslon.cz', 'kondomshop.cz']);

    // Aktualizovat SK metriky
    updateMarketMetrics('sk', skEshops, latest, sorted, dateStr, ['ruzovyslon.sk', 'kondomshop.sk']);
}

function updateMarketMetrics(market, eshops, latest, sorted, dateStr, ownEshops) {
    // Celkový počet objednávek na trhu (DELTY, ne absolutní čísla!)
    let totalOrders = 0;
    let slonOrders = 0;
    let kondomshopOrders = 0;
    let elephantOrders = 0;
    let topCompetitor = { name: '-', orders: 0 };

    eshops.forEach(eshop => {
        // Přeskočit, pokud je e-shop označen jako nezměřeno
        if (latest.notMeasured && latest.notMeasured[eshop]) {
            return;
        }

        const delta = latest.deltas[eshop] || 0;
        totalOrders += delta;

        // Rozdělit Růžový Slon, Kondomshop a Sexy Elephant
        if (eshop === 'ruzovyslon.cz' || eshop === 'ruzovyslon.sk') {
            slonOrders += delta;
        } else if (eshop === 'kondomshop.cz' || eshop === 'kondomshop.sk') {
            kondomshopOrders += delta;
        } else if (eshop.startsWith('sexyelephant.')) {
            elephantOrders += delta;
        } else if (!ownEshops.includes(eshop)) {
            // Hledat top konkurenta (ne vlastní e-shop)
            if (delta > topCompetitor.orders) {
                topCompetitor = { name: eshop, orders: delta };
            }
        }
    });

    // Aktualizovat DOM
    document.getElementById(`metric-${market}-period`).textContent = `K ${dateStr}`;
    document.getElementById(`metric-${market}-total`).textContent = totalOrders.toLocaleString('cs-CZ');

    // Vlastní e-shopy (CZ a SK)
    // Růžový Slon
    document.getElementById(`metric-${market}-slon`).textContent = slonOrders.toLocaleString('cs-CZ');
    const slonShare = totalOrders > 0 ? (slonOrders / totalOrders * 100).toFixed(1) : '0.0';
    document.getElementById(`metric-${market}-slon-share`).textContent = `Podíl: ${slonShare}%`;

    // Kondomshop
    document.getElementById(`metric-${market}-kondomshop`).textContent = kondomshopOrders.toLocaleString('cs-CZ');
    const kondomshopShare = totalOrders > 0 ? (kondomshopOrders / totalOrders * 100).toFixed(1) : '0.0';
    document.getElementById(`metric-${market}-kondomshop-share`).textContent = `Podíl: ${kondomshopShare}%`;

    // Top konkurent
    document.getElementById(`metric-${market}-top-name`).textContent = topCompetitor.name;
    document.getElementById(`metric-${market}-top-orders`).textContent = topCompetitor.orders.toLocaleString('cs-CZ');

    // Porovnání Slon vs. konkurent (pro CZ a SK)
    if (market === 'cz') {
        const slonVsCompetitor = calculateSlonVsCompetitor(latest, 'ruzovyslon.cz', 'e-kondomy.cz');
        document.getElementById(`metric-cz-comparison-label`).textContent = slonVsCompetitor.label;
        document.getElementById(`metric-cz-comparison-value`).textContent = slonVsCompetitor.value;
    } else if (market === 'sk') {
        const slonVsCompetitor = calculateSlonVsCompetitor(latest, 'ruzovyslon.sk', 'eros.sk');
        document.getElementById(`metric-sk-comparison-label`).textContent = slonVsCompetitor.label;
        document.getElementById(`metric-sk-comparison-value`).textContent = slonVsCompetitor.value;
    }
}

function calculateSlonVsCompetitor(latest, slonEshop, competitorEshop) {
    // Kontrola, jestli nejsou e-shopy označeny jako nezměřeno
    const slonNotMeasured = latest.notMeasured && latest.notMeasured[slonEshop];
    const competitorNotMeasured = latest.notMeasured && latest.notMeasured[competitorEshop];

    if (slonNotMeasured || competitorNotMeasured) {
        return {
            label: 'Porovnání:',
            value: 'N/A'
        };
    }

    const slonOrders = (latest.deltas && latest.deltas[slonEshop]) ? latest.deltas[slonEshop] : 0;
    const competitorOrders = (latest.deltas && latest.deltas[competitorEshop]) ? latest.deltas[competitorEshop] : 0;

    const difference = slonOrders - competitorOrders;

    if (difference > 0) {
        return {
            label: 'Náskok Slona:',
            value: `+${difference.toLocaleString('cs-CZ')}`
        };
    } else if (difference < 0) {
        return {
            label: 'Ztráta Slona:',
            value: `${difference.toLocaleString('cs-CZ')}`
        };
    } else {
        return {
            label: 'Remíza:',
            value: '0'
        };
    }
}

function calculateWeekJumper(sortedData, eshops) {
    if (sortedData.length < 14) {
        return { name: '-', pct: 'N/A' };
    }

    const today = new Date();
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 7);
    const fourteenDaysAgo = new Date(today);
    fourteenDaysAgo.setDate(today.getDate() - 14);

    // Data pro tento týden (poslední 7 dní)
    const thisWeekData = sortedData.filter(record => {
        const recordDate = new Date(record.date);
        return recordDate >= sevenDaysAgo && recordDate <= today;
    });

    // Data pro minulý týden (dny 8-14)
    const lastWeekData = sortedData.filter(record => {
        const recordDate = new Date(record.date);
        return recordDate >= fourteenDaysAgo && recordDate < sevenDaysAgo;
    });

    if (thisWeekData.length === 0 || lastWeekData.length === 0) {
        return { name: '-', pct: 'N/A' };
    }

    let bestJumper = { name: '-', pct: -Infinity, pctText: 'N/A' };

    // Vypočítat mezitýdenní změnu pro každý e-shop
    eshops.forEach(eshop => {
        // Součet delta hodnot pro tento týden
        const thisWeekTotal = thisWeekData.reduce((sum, record) => {
            const delta = (record.deltas && record.deltas[eshop]) ? record.deltas[eshop] : 0;
            return sum + delta;
        }, 0);

        // Součet delta hodnot pro minulý týden
        const lastWeekTotal = lastWeekData.reduce((sum, record) => {
            const delta = (record.deltas && record.deltas[eshop]) ? record.deltas[eshop] : 0;
            return sum + delta;
        }, 0);

        // Vypočítat procentuální změnu
        if (lastWeekTotal > 0) {
            const percentChange = ((thisWeekTotal - lastWeekTotal) / lastWeekTotal) * 100;
            if (percentChange > bestJumper.pct) {
                bestJumper = {
                    name: eshop,
                    pct: percentChange,
                    pctText: `${percentChange > 0 ? '+' : ''}${percentChange.toFixed(1)}%`
                };
            }
        }
    });

    return { name: bestJumper.name, pct: bestJumper.pctText };
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
    ['cz', 'sk'].forEach(market => {
        document.getElementById(`metric-${market}-period`).textContent = '-';
        document.getElementById(`metric-${market}-total`).textContent = '-';
        document.getElementById(`metric-${market}-top-name`).textContent = '-';
        document.getElementById(`metric-${market}-top-orders`).textContent = '-';
        document.getElementById(`metric-${market}-slon`).textContent = '-';
        document.getElementById(`metric-${market}-slon-share`).textContent = 'Podíl: -';
        document.getElementById(`metric-${market}-kondomshop`).textContent = '-';
        document.getElementById(`metric-${market}-kondomshop-share`).textContent = 'Podíl: -';
        document.getElementById(`metric-${market}-comparison-label`).textContent = 'Náskok Slona:';
        document.getElementById(`metric-${market}-comparison-value`).textContent = '-';
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

// =====================================================
// EDITACE POZNÁMEK V BUŇKÁCH
// =====================================================

// Globální proměnné pro modal editace buňky
let currentCellEditRecordId = null;
let currentCellEditEshop = null;

/**
 * Otevře dialog pro editaci poznámky k buňce
 * @param {number} recordId - ID záznamu
 * @param {string} eshop - Název e-shopu
 */
window.editCellNote = function(recordId, eshop) {
    // Najít záznam
    const record = window.trackingData.find(r => r.id == recordId);
    if (!record) {
        alert('Záznam nenalezen');
        return;
    }

    // Inicializovat cellNotes a notMeasured pokud neexistují
    if (!record.cellNotes) {
        record.cellNotes = {};
    }
    if (!record.notMeasured) {
        record.notMeasured = {};
    }

    // Uložit aktuální kontext
    currentCellEditRecordId = recordId;
    currentCellEditEshop = eshop;

    // Nastavit titulek modalu
    document.getElementById('cellEditTitle').textContent = `${eshop} - ${formatDate(record.date)}`;

    // Naplnit aktuální hodnoty
    document.getElementById('cellNote').value = record.cellNotes[eshop] || '';
    document.getElementById('cellNotMeasured').checked = record.notMeasured[eshop] || false;

    // Zobrazit modal
    document.getElementById('cellEditModal').classList.remove('hidden');
};

window.closeCellEditModal = function() {
    document.getElementById('cellEditModal').classList.add('hidden');
    currentCellEditRecordId = null;
    currentCellEditEshop = null;
};

window.saveCellEdit = function() {
    if (!currentCellEditRecordId || !currentCellEditEshop) return;

    // Najít záznam
    const record = window.trackingData.find(r => r.id == currentCellEditRecordId);
    if (!record) {
        alert('Záznam nenalezen');
        return;
    }

    // Inicializovat objekty pokud neexistují
    if (!record.cellNotes) record.cellNotes = {};
    if (!record.notMeasured) record.notMeasured = {};

    // Uložit poznámku
    const note = document.getElementById('cellNote').value.trim();
    if (note === '') {
        delete record.cellNotes[currentCellEditEshop];
    } else {
        record.cellNotes[currentCellEditEshop] = note;
    }

    // Uložit stav "nezměřeno"
    const notMeasured = document.getElementById('cellNotMeasured').checked;
    console.log(`💾 Ukládám stav nezměřeno pro ${currentCellEditEshop}: ${notMeasured}`);
    if (notMeasured) {
        record.notMeasured[currentCellEditEshop] = true;
        console.log(`✅ Nastaveno record.notMeasured['${currentCellEditEshop}'] = true`);
    } else {
        delete record.notMeasured[currentCellEditEshop];
        console.log(`❌ Odstraněno record.notMeasured['${currentCellEditEshop}']`);
    }
    console.log('🔍 Aktuální record.notMeasured:', record.notMeasured);

    // Zavřít modal
    closeCellEditModal();

    // Uložit změny
    saveTrackingData();
    renderTrackingTable();
    updateMetricsDisplay();

    // Uložit do Firestore
    if (typeof saveTrackingRecordToFirestore === 'function') {
        saveTrackingRecordToFirestore(record);
    }
};

// Export funkcí
window.renderTrackingTable = renderTrackingTable;
window.showAddRecordForm = showAddRecordForm;
window.hideRecordForm = hideRecordForm;
window.handleRecordFormSubmit = handleRecordFormSubmit;
window.updateMetricsDisplay = updateMetricsDisplay;
