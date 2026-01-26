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
        const safeId = sanitizeId(comp);
        html += `
            <div class="border border-gray-200 rounded-lg p-3 bg-gray-50">
                <label class="block text-sm font-medium text-gray-700 mb-2">${comp}</label>
                <input type="number" id="comp-${safeId}"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg mb-2"
                    placeholder="Číslo objednávky">

                <div class="flex items-center gap-2 mt-2">
                    <input type="checkbox" id="first-measurement-${safeId}"
                        class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        onchange="document.getElementById('delta-${safeId}').style.display = this.checked ? 'block' : 'none'">
                    <label for="first-measurement-${safeId}" class="text-xs text-gray-600">
                        ✨ Nová číselná řada
                    </label>
                </div>

                <input type="number" id="delta-${safeId}"
                    class="w-full px-3 py-2 border border-orange-300 rounded-lg mt-2 bg-orange-50"
                    placeholder="Počet objednávek (delta)"
                    style="display:none;">
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

    ["isexshop.sk", "flagranti.sk", "superlove.sk", "eros.sk", "erotickyshop.sk"].forEach(comp => {
        const safeId = sanitizeId(comp);
        html += `
            <div class="border border-gray-200 rounded-lg p-3 bg-gray-50">
                <label class="block text-sm font-medium text-gray-700 mb-2">${comp}</label>
                <input type="number" id="comp-${safeId}"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg mb-2"
                    placeholder="Číslo objednávky">

                <div class="flex items-center gap-2 mt-2">
                    <input type="checkbox" id="first-measurement-${safeId}"
                        class="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        onchange="document.getElementById('delta-${safeId}').style.display = this.checked ? 'block' : 'none'">
                    <label for="first-measurement-${safeId}" class="text-xs text-gray-600">
                        ✨ Nová číselná řada
                    </label>
                </div>

                <input type="number" id="delta-${safeId}"
                    class="w-full px-3 py-2 border border-orange-300 rounded-lg mt-2 bg-orange-50"
                    placeholder="Počet objednávek (delta)"
                    style="display:none;">
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
        const safeId = sanitizeId(comp);
        html += `
            <div class="border border-gray-200 rounded-lg p-2 bg-gray-50">
                <label class="block text-xs font-medium text-gray-700 mb-1">${comp}</label>
                <input type="number" id="comp-${safeId}"
                    class="w-full px-2 py-1 border border-gray-300 rounded text-sm mb-1"
                    placeholder="Č. obj.">

                <div class="flex items-center gap-1">
                    <input type="checkbox" id="first-measurement-${safeId}"
                        class="w-3 h-3 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        onchange="document.getElementById('delta-${safeId}').style.display = this.checked ? 'block' : 'none'">
                    <label for="first-measurement-${safeId}" class="text-xs text-gray-600">
                        ✨ Nová řada
                    </label>
                </div>

                <input type="number" id="delta-${safeId}"
                    class="w-full px-2 py-1 border border-orange-300 rounded mt-1 bg-orange-50 text-sm"
                    placeholder="Δ"
                    style="display:none;">
            </div>`;
    });
    html += '</div></div>';

    // Sekce: Maďarsko (konkurence)
    html += '<div class="mb-6">';
    html += '<h4 class="text-lg font-semibold text-gray-900 mb-2 pb-2 border-b-2 border-blue-500">🇭🇺 Maďarské e-shopy - Konkurence</h4>';
    html += '<p class="text-sm text-gray-600 mb-4">Zadej číslo poslední objednávky</p>';
    html += '<div class="grid grid-cols-1 md:grid-cols-4 gap-3">';

    ["goldengate.hu", "padlizsan.hu", "sexshopcenter.hu", "erotikashow.hu", "szexaruhaz.hu", "szexshop.hu", "vagyaim.hu"].forEach(comp => {
        const safeId = sanitizeId(comp);
        html += `
            <div class="border border-gray-200 rounded-lg p-2 bg-gray-50">
                <label class="block text-xs font-medium text-gray-700 mb-1">${comp}</label>
                <input type="number" id="comp-${safeId}"
                    class="w-full px-2 py-1 border border-gray-300 rounded text-sm mb-1"
                    placeholder="Č. obj.">

                <div class="flex items-center gap-1">
                    <input type="checkbox" id="first-measurement-${safeId}"
                        class="w-3 h-3 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        onchange="document.getElementById('delta-${safeId}').style.display = this.checked ? 'block' : 'none'">
                    <label for="first-measurement-${safeId}" class="text-xs text-gray-600">
                        ✨ Nová řada
                    </label>
                </div>

                <input type="number" id="delta-${safeId}"
                    class="w-full px-2 py-1 border border-orange-300 rounded mt-1 bg-orange-50 text-sm"
                    placeholder="Δ"
                    style="display:none;">
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

        // Barvy pro vlastní e-shopy
        let bgClass = '';
        if (comp === 'ruzovyslon.cz' || comp === 'ruzovyslon.sk' || comp === 'sexshopik' ||
            comp === 'sexyelephant.ro' || comp === 'sexyelephant.hu' || comp === 'sexyelephant.si' ||
            comp === 'sexyelephant.bg' || comp === 'sexyelephant.hr') {
            bgClass = 'bg-pink-300';  // Světle růžová pro Růžový slon a Sexy elephant
        } else if (comp === 'kondomshop.cz' || comp === 'kondomshop.sk') {
            bgClass = 'bg-blue-300';  // Světle modrá pro Kondomshop
        }

        const icon = isOwnEshop ? '' : '';

        // Normální zobrazení pro všechny trhy
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
    const skEshops = ["isexshop.sk", "flagranti.sk", "superlove.sk", "eros.sk", "erotickyshop.sk", "ruzovyslon.sk", "kondomshop.sk"];
    const foreignEshops = ["sexyelephant.ro", "sexyelephant.hu", "sexyelephant.si", "sexyelephant.bg", "sexyelephant.hr", "superlove.ro", "superlove.pl", "superlove.eu", "superlove.at", "superlove.hr", "superlove.it", "superlove.si", "superlove.bg", "superlove.lt", "superlove.es", "superlove.hu", "goldengate.hu", "padlizsan.hu", "sexshopcenter.hu", "erotikashow.hu", "szexaruhaz.hu", "szexshop.hu", "vagyaim.hu"];

    // Vykreslit každou tabulku
    renderMarketTable('CZ', czEshops);
    renderMarketTable('SK', skEshops);
    renderMarketTable('Foreign', foreignEshops);

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

    // Filtrovat záznamy - zobrazit pouze ty, které mají alespoň jednu SKUTEČNOU hodnotu pro tento trh
    // (ne undefined a ne 0 - chceme pouze záznamy s reálnými daty)
    const filteredData = sortedData.filter(record => {
        return eshops.some(eshop => {
            const orderNum = record.competitors[eshop];
            const delta = record.deltas[eshop];
            // Zobrazit pouze pokud má nenulovou hodnotu (musí být definovaná A nenulová)
            return (orderNum !== undefined && orderNum !== 0) ||
                   (delta !== undefined && delta !== 0);
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

            // Zjistit, jestli je to první měření (nezapočítává se do součtu)
            const isFirstMeasurement = record.firstMeasurement && record.firstMeasurement[eshop];

            // Debug log pro kontrolu
            if (eshop === 'yoo.cz' && (record.date === '2024-02-29' || record.date === '2024-03-31')) {
                console.log(`🔍 RENDER ${eshop} ${record.date}:`);
                console.log(`  orderNum:`, orderNum);
                console.log(`  delta:`, delta);
                console.log(`  isFirstMeasurement:`, isFirstMeasurement);
                console.log(`  firstMeasurement obj:`, record.firstMeasurement);
            }

            const deltaClass = delta > 0 ? 'text-green-600' : (delta < 0 ? 'text-red-600' : 'text-gray-400');

            // Zjistit, jestli je to vlastní e-shop
            const isOwnEshop = window.OWN_ESHOPS && window.OWN_ESHOPS.includes(eshop);

            // Barvy pro vlastní e-shopy
            let bgClass = '';
            if (isNotMeasured) {
                bgClass = 'bg-gray-200 opacity-60';
            } else if (eshop === 'ruzovyslon.cz' || eshop === 'ruzovyslon.sk' || eshop === 'sexshopik' ||
                       eshop === 'sexyelephant.ro' || eshop === 'sexyelephant.hu' || eshop === 'sexyelephant.si' ||
                       eshop === 'sexyelephant.bg' || eshop === 'sexyelephant.hr') {
                bgClass = 'bg-pink-100 font-bold';  // Světle růžová
            } else if (eshop === 'kondomshop.cz' || eshop === 'kondomshop.sk') {
                bgClass = 'bg-blue-100 font-bold';  // Světle modrá
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

            // Normální zobrazení pro všechny trhy
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
            } else if (isFirstMeasurement) {
                // První měření - zobrazit šedě s označením, že se nezapočítává
                row.innerHTML += `
                    <td class="px-3 py-3 text-sm text-center ${bgClass} cursor-pointer hover:bg-blue-100"
                        onclick="editCellNote('${record.id}', '${eshop}')" ${noteTitle} title="První měření - nezapočítává se do celkového součtu">
                        <div class="font-medium text-gray-500 text-xs">${orderNumDisplay}</div>
                        <div class="text-gray-400 text-xs font-semibold">
                            ${delta > 0 ? '+' : ''}${delta.toLocaleString('cs-CZ')}
                            <span class="text-orange-500">*</span>
                        </div>
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
            // Vypočítat celkový delta pro tento trh (přeskočit nezměřené a firstMeasurement e-shopy)
            const totalDelta = eshops.reduce((sum, eshop) => {
                // Přeskočit, pokud je e-shop označen jako nezměřeno
                if (record.notMeasured && record.notMeasured[eshop]) {
                    console.log(`🚫 Přeskakuji nezměřený e-shop: ${eshop} v záznamu ${record.date}`);
                    return sum;
                }
                // Přeskočit, pokud má firstMeasurement (nová číselná řada)
                if (record.firstMeasurement && record.firstMeasurement[eshop]) {
                    console.log(`✨ Přeskakuji firstMeasurement e-shop: ${eshop} v záznamu ${record.date}`);
                    return sum;
                }
                return sum + (record.deltas[eshop] || 0);
            }, 0);

            // Vypočítat Slon % pro tento trh (přeskočit nezměřené a firstMeasurement e-shopy)
            const ownEshops = market === 'CZ' ? ['ruzovyslon.cz', 'kondomshop.cz'] : ['ruzovyslon.sk', 'kondomshop.sk'];
            const slonDelta = ownEshops.reduce((sum, eshop) => {
                // Přeskočit, pokud je e-shop označen jako nezměřeno
                if (record.notMeasured && record.notMeasured[eshop]) {
                    return sum;
                }
                // Přeskočit, pokud má firstMeasurement (nová číselná řada)
                if (record.firstMeasurement && record.firstMeasurement[eshop]) {
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
                <button onclick="deleteTrackingRecord(${record.id}, '${market}')" class="text-red-600 hover:text-red-800">
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

    // Vyčistit manuální delty
    const manualDeltasContainer = document.getElementById('manual-deltas-container');
    if (manualDeltasContainer) {
        manualDeltasContainer.innerHTML = '';
    }

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

    // Pokud editujeme existující záznam, zkopírovat ho (aby se zachovaly všechny položky)
    // Pokud vytváříme nový, vytvořit nový objekt
    let record;
    if (recordId) {
        const existingIndex = window.trackingData.findIndex(r => r.id === parseInt(recordId));
        if (existingIndex !== -1) {
            // Zkopírovat existující záznam (deep copy důležitých objektů)
            const existing = window.trackingData[existingIndex];
            record = {
                ...existing,
                competitors: { ...(existing.competitors || {}) },
                deltas: { ...(existing.deltas || {}) },
                manualDeltas: { ...(existing.manualDeltas || {}) },
                notMeasured: { ...(existing.notMeasured || {}) },
                firstMeasurement: { ...(existing.firstMeasurement || {}) },
                monthEndValues: { ...(existing.monthEndValues || {}) }
            };
            // Aktualizovat datum a poznámky
            record.date = date;
            record.notes = document.getElementById('record-notes').value || '';
        } else {
            // Existující record nenalezen, vytvořit nový
            record = {
                id: parseInt(recordId),
                date: date,
                competitors: {},
                deltas: {},
                monthEndValues: {},
                notes: document.getElementById('record-notes').value || ''
            };
        }
    } else {
        // Nový záznam
        record = {
            id: Date.now(),
            date: date,
            competitors: {},
            deltas: {},
            monthEndValues: {},
            notes: document.getElementById('record-notes').value || ''
        };
    }

    // Načíst data pro všechny e-shopy
    // Rozlišujeme vlastní e-shopy (ukládáme delty přímo) a konkurenty (ukládáme čísla objednávek)
    window.COMPETITORS.forEach(comp => {
        const safeId = sanitizeId(comp);
        const input = document.getElementById(`comp-${safeId}`);
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

            // Zkontrolovat checkbox "Nová číselná řada"
            const firstMeasurementCheckbox = document.getElementById(`first-measurement-${safeId}`);
            const deltaInput = document.getElementById(`delta-${safeId}`);

            if (firstMeasurementCheckbox && firstMeasurementCheckbox.checked) {
                // Inicializovat objekty pokud neexistují
                if (!record.firstMeasurement) {
                    record.firstMeasurement = {};
                }
                if (!record.manualDeltas) {
                    record.manualDeltas = {};
                }

                // Označit jako první měření
                record.firstMeasurement[comp] = true;

                // Načíst manuálně zadanou deltu
                const deltaValue = (deltaInput && deltaInput.value) ? parseInt(deltaInput.value) || 0 : 0;

                // DŮLEŽITÉ: Nastavit OBOJÍ - deltu I manuální deltu
                // manualDeltas se aplikuje na konci calculateDeltas() a přepíše vše ostatní
                record.deltas[comp] = deltaValue;
                record.manualDeltas[comp] = deltaValue;

                console.log(`✨ ${comp}: Nová číselná řada - číslo ${value}, delta ${deltaValue}, manualDelta ${deltaValue}`);
            } else {
                // Checkbox NENÍ zaškrtnutý - odstranit firstMeasurement a manualDeltas
                if (record.firstMeasurement && record.firstMeasurement[comp]) {
                    delete record.firstMeasurement[comp];
                }
                if (record.manualDeltas && record.manualDeltas[comp] !== undefined) {
                    delete record.manualDeltas[comp];
                }
                console.log(`🔄 ${comp}: Zrušeno firstMeasurement + manualDelta - delta se přepočítá`);
            }
        }
    });

    // Načíst manuální delty (přepíší automatický výpočet)
    // Inicializovat manualDeltas, pokud neexistuje
    if (!record.manualDeltas) {
        record.manualDeltas = {};
    }

    // Projít všechny dynamicky přidané řádky pro manuální delty
    const manualDeltaRows = document.querySelectorAll('[data-manual-delta-row]');
    manualDeltaRows.forEach(row => {
        const selectElem = row.querySelector('select');
        const inputElem = row.querySelector('input[type="number"]');

        if (selectElem && inputElem && selectElem.value && inputElem.value) {
            const eshop = selectElem.value;
            const value = parseInt(inputElem.value) || 0;
            record.manualDeltas[eshop] = value;
            console.log(`✏️ Ruční delta pro ${eshop}: ${value}`);
        }
    });

    // Aktualizovat nebo přidat záznam
    if (recordId) {
        const index = window.trackingData.findIndex(r => r.id === parseInt(recordId));
        if (index !== -1) {
            // Zachovat firestoreId pokud existuje
            record.firestoreId = window.trackingData[index].firestoreId;
            window.trackingData[index] = record;
        }
    } else {
        // KONTROLA DUPLICITNÍHO data - pokud už existuje záznam se stejným datem, SLOUČIT data
        const existingRecordIndex = window.trackingData.findIndex(r => r.date === record.date);

        if (existingRecordIndex !== -1) {
            console.log(`⚠️ Záznam pro ${record.date} už existuje - slučuji data`);
            const existingRecord = window.trackingData[existingRecordIndex];

            // Sloučit competitors (nové hodnoty přepíší staré)
            record.competitors = { ...existingRecord.competitors, ...record.competitors };

            // Sloučit deltas (nové hodnoty přepíší staré)
            record.deltas = { ...existingRecord.deltas, ...record.deltas };

            // Sloučit manualDeltas (nové hodnoty přepíší staré)
            record.manualDeltas = { ...existingRecord.manualDeltas, ...record.manualDeltas };

            // Sloučit notMeasured (nové hodnoty přepíší staré)
            record.notMeasured = { ...existingRecord.notMeasured, ...record.notMeasured };

            // Sloučit firstMeasurement (nové hodnoty přepíší staré)
            record.firstMeasurement = { ...existingRecord.firstMeasurement, ...record.firstMeasurement };

            // Zachovat ID a firestoreId existujícího záznamu
            record.id = existingRecord.id;
            record.firestoreId = existingRecord.firestoreId;

            // Aktualizovat poznámky (spojit, pokud obě existují)
            if (existingRecord.notes && record.notes) {
                record.notes = existingRecord.notes + '\n' + record.notes;
            } else if (existingRecord.notes) {
                record.notes = existingRecord.notes;
            }

            // Nahradit existující záznam sloučeným
            window.trackingData[existingRecordIndex] = record;
            console.log(`✅ Data sloučena do existujícího záznamu ID ${record.id}`);
        } else {
            // Žádný záznam se stejným datem - vytvořit nový
            window.trackingData.push(record);
            console.log(`✅ Vytvořen nový záznam pro ${record.date}`);
        }
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
        const safeId = sanitizeId(comp);
        const input = document.getElementById(`comp-${safeId}`);
        if (input) {
            // Pro vlastní e-shopy použít DELTY, pro konkurenty čísla objednávek
            const isOwnEshop = window.OWN_ESHOPS && window.OWN_ESHOPS.includes(comp);

            if (isOwnEshop) {
                // Vlastní e-shop - zobrazit deltu (počet objednávek)
                input.value = record.deltas[comp] || '';
            } else {
                // Konkurent - zobrazit číslo objednávky
                input.value = record.competitors[comp] || '';

                // Načíst firstMeasurement checkbox a delta input
                const firstMeasurementCheckbox = document.getElementById(`first-measurement-${safeId}`);
                const deltaInput = document.getElementById(`delta-${safeId}`);

                if (firstMeasurementCheckbox && deltaInput) {
                    // Pokud je e-shop označen jako firstMeasurement, zaškrtnout checkbox
                    const isFirstMeasurement = record.firstMeasurement && record.firstMeasurement[comp];
                    firstMeasurementCheckbox.checked = isFirstMeasurement;

                    if (isFirstMeasurement) {
                        // Zobrazit delta input a naplnit ho hodnotou
                        deltaInput.style.display = 'block';
                        deltaInput.value = record.deltas && record.deltas[comp] !== undefined ? record.deltas[comp] : 0;
                    } else {
                        // Skrýt delta input
                        deltaInput.style.display = 'none';
                        deltaInput.value = '';
                    }
                }
            }
        }
    });

    // Naplnit manuální delty
    const manualDeltasContainer = document.getElementById('manual-deltas-container');
    if (manualDeltasContainer) {
        manualDeltasContainer.innerHTML = ''; // Vyčistit

        // Přidat řádky pro existující manuální delty
        if (record.manualDeltas && Object.keys(record.manualDeltas).length > 0) {
            Object.keys(record.manualDeltas).forEach(eshop => {
                const value = record.manualDeltas[eshop];
                if (value) {
                    addManualDeltaRow(eshop, value);
                }
            });
        }
    }

    document.getElementById('form-title-record').textContent = 'Upravit záznam';
    document.getElementById('record-form-modal').classList.remove('hidden');
};

window.deleteTrackingRecord = async function(id, market) {
    const marketNames = { 'CZ': 'CZ', 'SK': 'SK', 'Foreign': 'zahraničních' };
    const marketName = marketNames[market] || market;

    if (!confirm(`Opravdu chcete smazat data ${marketName} trhu pro toto datum? Tato akce je nevratná.`)) {
        return;
    }

    const index = window.trackingData.findIndex(r => r.id === id);
    if (index !== -1) {
        const record = window.trackingData[index];

        // Získat seznam e-shopů podle trhu
        let eshopsToDelete = [];
        if (market === 'CZ' && window.CZ_ESHOPS) {
            eshopsToDelete = window.CZ_ESHOPS;
        } else if (market === 'SK' && window.SK_ESHOPS) {
            eshopsToDelete = window.SK_ESHOPS;
        } else if (market === 'Foreign' && window.FOREIGN_ESHOPS) {
            eshopsToDelete = window.FOREIGN_ESHOPS;
        }

        // Smazat data jen pro e-shopy z tohoto trhu
        eshopsToDelete.forEach(eshop => {
            if (record.competitors && record.competitors[eshop] !== undefined) {
                delete record.competitors[eshop];
            }
            if (record.deltas && record.deltas[eshop] !== undefined) {
                delete record.deltas[eshop];
            }
        });

        // Zkontrolovat, jestli záznam má ještě nějaká data
        const hasAnyData = Object.keys(record.competitors || {}).length > 0 ||
                          Object.keys(record.deltas || {}).filter(key => (record.deltas[key] || 0) !== 0).length > 0;

        if (!hasAnyData) {
            // Žádná data nezbyla - smazat celý záznam
            if (typeof deleteTrackingRecordFromFirestore === 'function') {
                await deleteTrackingRecordFromFirestore(id);
            }
            window.trackingData.splice(index, 1);
        } else {
            // Ještě jsou nějaká data - aktualizovat záznam
            window.trackingData[index] = record;
            // Uložit aktualizovaný záznam do Firestore
            if (typeof saveTrackingRecordToFirestore === 'function') {
                await saveTrackingRecordToFirestore(record);
            }
        }

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
        "isexshop.sk", "flagranti.sk", "superlove.sk", "eros.sk", "erotickyshop.sk",
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
        // Přeskočit, pokud má firstMeasurement (nová číselná řada)
        if (latest.firstMeasurement && latest.firstMeasurement[eshop]) {
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
        const slonVsCompetitor = calculateSlonVsCompetitor(latest, 'ruzovyslon.sk', 'superlove.sk');
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

    // Sečíst DELTY pro tento trh (přeskočit nezměřené)
    let latestTotal = 0;
    let oldTotal = 0;

    eshops.forEach(eshop => {
        // Přeskočit nezměřené e-shopy v aktuálním záznamu
        if (!latest.notMeasured || !latest.notMeasured[eshop]) {
            latestTotal += latest.deltas[eshop] || 0;
        }
        // Přeskočit nezměřené e-shopy ve starším záznamu
        if (!closestRecord.notMeasured || !closestRecord.notMeasured[eshop]) {
            oldTotal += closestRecord.deltas[eshop] || 0;
        }
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

// =====================================================
// FUNKCE PRO RUČNÍ ÚPRAVU DELT
// =====================================================

let manualDeltaRowCounter = 0;

/**
 * Přidá nový řádek pro ruční úpravu delty
 */
window.addManualDeltaRow = function(selectedEshop = '', value = '') {
    const container = document.getElementById('manual-deltas-container');
    if (!container) return;

    const rowId = `manual-delta-row-${manualDeltaRowCounter++}`;

    // Vytvořit HTML řádku
    const rowHTML = `
        <div data-manual-delta-row id="${rowId}" class="grid grid-cols-1 md:grid-cols-12 gap-2 sm:gap-3 items-end">
            <div class="md:col-span-5">
                <label class="block text-xs sm:text-sm font-medium text-gray-700 mb-1">E-shop</label>
                <select class="w-full px-3 py-2 text-sm sm:text-base border-2 border-blue-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500">
                    <option value="">Vyberte e-shop...</option>
                    <optgroup label="CZ">
                        <option value="Hopnato.cz" ${selectedEshop === 'Hopnato.cz' ? 'selected' : ''}>Hopnato.cz</option>
                        <option value="erosstar.cz" ${selectedEshop === 'erosstar.cz' ? 'selected' : ''}>erosstar.cz</option>
                        <option value="deeplove.cz" ${selectedEshop === 'deeplove.cz' ? 'selected' : ''}>deeplove.cz</option>
                        <option value="yoo.cz" ${selectedEshop === 'yoo.cz' ? 'selected' : ''}>yoo.cz</option>
                        <option value="honitka.cz" ${selectedEshop === 'honitka.cz' ? 'selected' : ''}>honitka.cz</option>
                        <option value="eroticke-pomucky.cz" ${selectedEshop === 'eroticke-pomucky.cz' ? 'selected' : ''}>eroticke-pomucky.cz</option>
                        <option value="flagranti.cz" ${selectedEshop === 'flagranti.cz' ? 'selected' : ''}>flagranti.cz</option>
                        <option value="sexshopik.cz" ${selectedEshop === 'sexshopik.cz' ? 'selected' : ''}>sexshopik.cz</option>
                        <option value="e-kondomy.cz" ${selectedEshop === 'e-kondomy.cz' ? 'selected' : ''}>e-kondomy.cz</option>
                        <option value="ruzovyslon.cz" ${selectedEshop === 'ruzovyslon.cz' ? 'selected' : ''}>ruzovyslon.cz</option>
                        <option value="kondomshop.cz" ${selectedEshop === 'kondomshop.cz' ? 'selected' : ''}>kondomshop.cz</option>
                    </optgroup>
                    <optgroup label="SK">
                        <option value="isexshop.sk" ${selectedEshop === 'isexshop.sk' ? 'selected' : ''}>isexshop.sk</option>
                        <option value="flagranti.sk" ${selectedEshop === 'flagranti.sk' ? 'selected' : ''}>flagranti.sk</option>
                        <option value="superlove.sk" ${selectedEshop === 'superlove.sk' ? 'selected' : ''}>superlove.sk</option>
                        <option value="eros.sk" ${selectedEshop === 'eros.sk' ? 'selected' : ''}>eros.sk</option>
                        <option value="erotickyshop.sk" ${selectedEshop === 'erotickyshop.sk' ? 'selected' : ''}>erotickyshop.sk</option>
                        <option value="ruzovyslon.sk" ${selectedEshop === 'ruzovyslon.sk' ? 'selected' : ''}>ruzovyslon.sk</option>
                        <option value="kondomshop.sk" ${selectedEshop === 'kondomshop.sk' ? 'selected' : ''}>kondomshop.sk</option>
                    </optgroup>
                    <optgroup label="Foreign - Sexy Elephant">
                        <option value="sexyelephant.ro" ${selectedEshop === 'sexyelephant.ro' ? 'selected' : ''}>sexyelephant.ro</option>
                        <option value="sexyelephant.hu" ${selectedEshop === 'sexyelephant.hu' ? 'selected' : ''}>sexyelephant.hu</option>
                        <option value="sexyelephant.si" ${selectedEshop === 'sexyelephant.si' ? 'selected' : ''}>sexyelephant.si</option>
                        <option value="sexyelephant.bg" ${selectedEshop === 'sexyelephant.bg' ? 'selected' : ''}>sexyelephant.bg</option>
                        <option value="sexyelephant.hr" ${selectedEshop === 'sexyelephant.hr' ? 'selected' : ''}>sexyelephant.hr</option>
                    </optgroup>
                    <optgroup label="Foreign - Ostatní">
                        <option value="superlove.ro" ${selectedEshop === 'superlove.ro' ? 'selected' : ''}>superlove.ro</option>
                        <option value="superlove.pl" ${selectedEshop === 'superlove.pl' ? 'selected' : ''}>superlove.pl</option>
                        <option value="superlove.eu" ${selectedEshop === 'superlove.eu' ? 'selected' : ''}>superlove.eu</option>
                        <option value="superlove.at" ${selectedEshop === 'superlove.at' ? 'selected' : ''}>superlove.at</option>
                        <option value="superlove.hr" ${selectedEshop === 'superlove.hr' ? 'selected' : ''}>superlove.hr</option>
                        <option value="superlove.it" ${selectedEshop === 'superlove.it' ? 'selected' : ''}>superlove.it</option>
                        <option value="superlove.si" ${selectedEshop === 'superlove.si' ? 'selected' : ''}>superlove.si</option>
                        <option value="superlove.bg" ${selectedEshop === 'superlove.bg' ? 'selected' : ''}>superlove.bg</option>
                        <option value="superlove.lt" ${selectedEshop === 'superlove.lt' ? 'selected' : ''}>superlove.lt</option>
                        <option value="superlove.es" ${selectedEshop === 'superlove.es' ? 'selected' : ''}>superlove.es</option>
                        <option value="superlove.hu" ${selectedEshop === 'superlove.hu' ? 'selected' : ''}>superlove.hu</option>
                        <option value="goldengate.hu" ${selectedEshop === 'goldengate.hu' ? 'selected' : ''}>goldengate.hu</option>
                        <option value="padlizsan.hu" ${selectedEshop === 'padlizsan.hu' ? 'selected' : ''}>padlizsan.hu</option>
                        <option value="sexshopcenter.hu" ${selectedEshop === 'sexshopcenter.hu' ? 'selected' : ''}>sexshopcenter.hu</option>
                        <option value="erotikashow.hu" ${selectedEshop === 'erotikashow.hu' ? 'selected' : ''}>erotikashow.hu</option>
                        <option value="szexaruhaz.hu" ${selectedEshop === 'szexaruhaz.hu' ? 'selected' : ''}>szexaruhaz.hu</option>
                        <option value="szexshop.hu" ${selectedEshop === 'szexshop.hu' ? 'selected' : ''}>szexshop.hu</option>
                        <option value="vagyaim.hu" ${selectedEshop === 'vagyaim.hu' ? 'selected' : ''}>vagyaim.hu</option>
                    </optgroup>
                </select>
            </div>
            <div class="md:col-span-6">
                <label class="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                    Počet objednávek <span class="text-xs text-blue-600">(přepíše automatický výpočet)</span>
                </label>
                <input
                    type="number"
                    value="${value}"
                    class="w-full px-3 py-2 text-sm sm:text-base border-2 border-blue-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500"
                    placeholder="např. 150">
            </div>
            <div class="md:col-span-1">
                <button type="button" onclick="removeManualDeltaRow('${rowId}')" class="w-full px-3 py-2 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition border-2 border-red-300 font-medium">
                    ✕
                </button>
            </div>
        </div>
    `;

    container.insertAdjacentHTML('beforeend', rowHTML);
};

/**
 * Odstraní řádek pro ruční úpravu delty
 */
window.removeManualDeltaRow = function(rowId) {
    const row = document.getElementById(rowId);
    if (row) {
        row.remove();
    }
};

/**
 * Vyčistí duplicitní záznamy se stejným datem
 * Sloučí data z duplikátů do jednoho záznamu
 */
window.cleanupDuplicateRecords = function() {
    if (!window.trackingData || window.trackingData.length === 0) {
        console.log('📊 Žádná data k vyčištění');
        return;
    }

    console.log('🧹 Hledám duplicitní záznamy...');

    // Seskupit záznamy podle data
    const recordsByDate = {};
    window.trackingData.forEach(record => {
        if (!recordsByDate[record.date]) {
            recordsByDate[record.date] = [];
        }
        recordsByDate[record.date].push(record);
    });

    // Najít duplicity
    let duplicatesFound = 0;
    const cleanedData = [];

    Object.keys(recordsByDate).forEach(date => {
        const records = recordsByDate[date];

        if (records.length > 1) {
            console.log(`⚠️ Nalezeno ${records.length} záznamů pro ${date} - slučuji...`);
            duplicatesFound += records.length - 1;

            // Sloučit všechny záznamy pro toto datum
            const mergedRecord = {
                id: records[0].id, // Zachovat první ID
                firestoreId: records[0].firestoreId, // Zachovat první firestoreId
                date: date,
                competitors: {},
                deltas: {},
                manualDeltas: {},
                notMeasured: {},
                notes: ''
            };

            // Sloučit data ze všech záznamů
            records.forEach((record, index) => {
                mergedRecord.competitors = { ...mergedRecord.competitors, ...record.competitors };
                mergedRecord.deltas = { ...mergedRecord.deltas, ...record.deltas };
                mergedRecord.manualDeltas = { ...mergedRecord.manualDeltas, ...record.manualDeltas };
                mergedRecord.notMeasured = { ...mergedRecord.notMeasured, ...record.notMeasured };

                // Spojit poznámky
                if (record.notes) {
                    if (mergedRecord.notes) {
                        mergedRecord.notes += '\n' + record.notes;
                    } else {
                        mergedRecord.notes = record.notes;
                    }
                }

                console.log(`  └─ Sloučen záznam ID ${record.id}`);
            });

            cleanedData.push(mergedRecord);
        } else {
            // Žádný duplikát, zachovat záznam
            cleanedData.push(records[0]);
        }
    });

    if (duplicatesFound > 0) {
        window.trackingData = cleanedData;
        calculateDeltas();
        saveTrackingData();
        renderTrackingTable();

        // Aktualizovat metriky
        if (typeof updateMetricsDisplay === 'function') {
            updateMetricsDisplay();
        }

        updateAllCharts();

        console.log(`✅ Vyčištěno ${duplicatesFound} duplicitních záznamů`);
        alert(`✅ Vyčištěno ${duplicatesFound} duplicitních záznamů.\n\nData byla sloučena a uložena.`);
    } else {
        console.log('✅ Žádné duplicity nenalezeny');
        alert('✅ Žádné duplicitní záznamy nenalezeny.');
    }
};

// =====================================================
// FIRESTORE DIAGNOSTIKA A SYNCHRONIZACE
// =====================================================

/**
 * Zkontroluje status Firestore připojení a zobrazí informace
 */
window.checkFirestoreStatus = async function() {
    const statusContainer = document.getElementById('firestore-status-container');
    const statusIcon = document.getElementById('firestore-status-icon');
    const statusText = document.getElementById('firestore-status-text');
    const statusDetail = document.getElementById('firestore-status-detail');

    if (!statusContainer || !statusIcon || !statusText || !statusDetail) {
        console.error('Firestore status elementy nenalezeny');
        return;
    }

    // Kontrola
    statusIcon.textContent = '🔄';
    statusText.textContent = 'Kontroluji připojení...';
    statusDetail.textContent = '';
    statusContainer.className = 'p-4 rounded-lg border-2 border-blue-300 bg-blue-50';

    try {
        // Zjistit, jestli je Firestore aktivní
        const isFirestoreActive = typeof window.useFirestore === 'function' && window.useFirestore();

        if (!isFirestoreActive) {
            // Firestore není aktivní
            statusIcon.textContent = '⚠️';
            statusText.textContent = 'Firestore není připojen';
            statusDetail.textContent = 'Data jsou uložena pouze v tomto prohlížeči (localStorage). Pro sdílení dat mezi prohlížeči nastavte Firestore pravidla.';
            statusContainer.className = 'p-4 rounded-lg border-2 border-orange-300 bg-orange-50';
            return;
        }

        // Firestore je aktivní - zkusit číst data
        const db = window.getFirestore();
        if (!db) {
            throw new Error('Firestore databáze není inicializovaná');
        }

        // Zkusit přečíst data
        const snapshot = await db.collection('trackingData').limit(1).get();

        // Úspěch!
        statusIcon.textContent = '✅';
        statusText.textContent = 'Firestore je připojen a funkční';

        const recordCount = window.trackingData ? window.trackingData.length : 0;
        statusDetail.textContent = `Data se synchronizují automaticky. Aktuálně máte ${recordCount} záznamů v databázi.`;
        statusContainer.className = 'p-4 rounded-lg border-2 border-green-300 bg-green-50';

        console.log('✅ Firestore status: AKTIVNÍ');
    } catch (error) {
        // Chyba při čtení - pravděpodobně pravidla
        statusIcon.textContent = '❌';
        statusText.textContent = 'Firestore připojení selhalo';
        statusDetail.textContent = `Chyba: ${error.message}. Zkontrolujte Firestore pravidla (viz instrukce níže).`;
        statusContainer.className = 'p-4 rounded-lg border-2 border-red-300 bg-red-50';

        console.error('❌ Firestore chyba:', error);
    }
};

/**
 * Nahraje všechna lokální data do Firestore
 */
window.syncToFirestore = async function() {
    if (!window.trackingData || window.trackingData.length === 0) {
        alert('Žádná data k nahrání.');
        return;
    }

    const isFirestoreActive = typeof window.useFirestore === 'function' && window.useFirestore();
    if (!isFirestoreActive) {
        alert('❌ Firestore není aktivní. Zkontrolujte připojení a pravidla.');
        return;
    }

    if (!confirm(`Nahrát ${window.trackingData.length} záznamů do Firestore?\n\nTato akce přepíše existující data v cloudu.`)) {
        return;
    }

    try {
        console.log(`🔄 Nahrávám ${window.trackingData.length} záznamů do Firestore...`);

        // Použít existující funkci
        if (typeof window.saveAllTrackingDataToFirestore === 'function') {
            // OPRAVA: předat trackingData jako parametr
            await window.saveAllTrackingDataToFirestore(window.trackingData);
            alert(`✅ Úspěšně nahráno ${window.trackingData.length} záznamů do Firestore!\n\nData jsou nyní synchronizovaná napříč všemi prohlížeči.`);
            console.log(`✅ ${window.trackingData.length} záznamů nahráno do Firestore`);

            // Aktualizovat status
            checkFirestoreStatus();
        } else {
            throw new Error('Funkce saveAllTrackingDataToFirestore není dostupná');
        }
    } catch (error) {
        console.error('❌ Chyba při nahrávání do Firestore:', error);
        alert(`❌ Chyba při nahrávání: ${error.message}\n\nZkontrolujte Firestore pravidla.`);
    }
};

/**
 * Rozšíření funkce showDataManagementModal - automaticky zkontrolovat Firestore status
 */
const originalShowDataManagementModal = window.showDataManagementModal;
window.showDataManagementModal = function() {
    // Zavolat původní funkci (z app.js)
    if (originalShowDataManagementModal) {
        originalShowDataManagementModal();
    } else {
        document.getElementById('dataManagementModal').style.display = 'flex';
    }

    // Automaticky zkontrolovat status při otevření
    setTimeout(() => {
        checkFirestoreStatus();
    }, 100);
};

// Export funkcí
window.renderTrackingTable = renderTrackingTable;
window.showAddRecordForm = showAddRecordForm;
window.hideRecordForm = hideRecordForm;
window.handleRecordFormSubmit = handleRecordFormSubmit;
window.updateMetricsDisplay = updateMetricsDisplay;
