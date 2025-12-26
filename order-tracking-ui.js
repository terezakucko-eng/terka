// =====================================================
// UI PRO SLEDOVÁNÍ OBJEDNÁVEK - TABULKA
// =====================================================

function renderTrackingTable() {
    const tbody = document.getElementById('tracking-table-body');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (!window.trackingData || window.trackingData.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="20" class="text-center p-8 text-gray-500">
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

        // Pro každého konkurenta: Číslo objednávky a Delta
        window.COMPETITORS.forEach((comp, index) => {
            const orderNum = record.competitors[comp] || 0;
            const delta = record.deltas[comp] || 0;
            const deltaClass = delta > 0 ? 'text-green-600' : (delta < 0 ? 'text-red-600' : 'text-gray-400');
            const isRuzovySlon = comp === 'ruzovyslon.cz';

            row.innerHTML += `
                <td class="px-3 py-3 text-sm text-center ${isRuzovySlon ? 'bg-blue-50 font-bold' : ''}">
                    <div class="font-medium text-gray-900">${orderNum.toLocaleString('cs-CZ')}</div>
                    <div class="${deltaClass} text-xs font-semibold">
                        ${delta > 0 ? '+' : ''}${delta.toLocaleString('cs-CZ')}
                    </div>
                </td>
            `;
        });

        // Agregované metriky
        row.innerHTML += `
            <td class="px-3 py-3 text-sm text-center bg-yellow-50 font-bold border-l-2 border-yellow-300">
                ${record.totalOrders.toLocaleString('cs-CZ')}
            </td>
            <td class="px-3 py-3 text-sm text-center bg-green-50 font-bold">
                ${record.slonShare.toFixed(1)}%
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

    // Načíst čísla objednávek pro všechny konkurenty
    window.COMPETITORS.forEach(comp => {
        const input = document.getElementById(`comp-${sanitizeId(comp)}`);
        if (input && input.value) {
            record.competitors[comp] = parseInt(input.value) || 0;
        } else {
            record.competitors[comp] = 0;
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
            window.trackingData[index] = record;
        }
    } else {
        window.trackingData.push(record);
    }

    // Přepočítat delty
    calculateDeltas();

    // Uložit a aktualizovat UI
    saveTrackingData();
    renderTrackingTable();
    updateAllCharts();
    hideRecordForm();
}

window.editTrackingRecord = function(id) {
    const record = window.trackingData.find(r => r.id === id);
    if (!record) return;

    document.getElementById('record-id').value = record.id;
    document.getElementById('record-date').value = record.date;
    document.getElementById('record-notes').value = record.notes || '';

    // Naplnit pole pro konkurenty
    window.COMPETITORS.forEach(comp => {
        const input = document.getElementById(`comp-${sanitizeId(comp)}`);
        if (input) {
            input.value = record.competitors[comp] || '';
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

window.deleteTrackingRecord = function(id) {
    if (!confirm('Opravdu chcete smazat tento záznam? Tato akce je nevratná.')) {
        return;
    }

    const index = window.trackingData.findIndex(r => r.id === id);
    if (index !== -1) {
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
        document.getElementById('metric-total-orders').textContent = '-';
        document.getElementById('metric-wow').textContent = '-';
        document.getElementById('metric-mom').textContent = '-';
        document.getElementById('metric-yoy').textContent = '-';
        return;
    }

    // Seřadit data podle data
    const sorted = [...window.trackingData].sort((a, b) => new Date(b.date) - new Date(a.date));

    // Poslední záznam
    const latest = sorted[0];
    const slonOrders = latest.competitors['ruzovyslon.cz'] || 0;

    document.getElementById('metric-total-orders').textContent = slonOrders.toLocaleString('cs-CZ');
    document.getElementById('metric-total-period').textContent = `K ${formatDate(latest.date)}`;

    // Růsty
    const wow = calculateGrowth(sorted, 7);
    const mom = calculateGrowth(sorted, 30);
    const yoy = calculateGrowth(sorted, 365);

    document.getElementById('metric-wow').textContent = wow !== null ? `${wow > 0 ? '+' : ''}${wow.toFixed(2)}%` : 'N/A';
    document.getElementById('metric-mom').textContent = mom !== null ? `${mom > 0 ? '+' : ''}${mom.toFixed(2)}%` : 'N/A';
    document.getElementById('metric-yoy').textContent = yoy !== null ? `${yoy > 0 ? '+' : ''}${yoy.toFixed(2)}%` : 'N/A';
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
