// =====================================================
// DATA MODEL PRO ČÍSLA OBJEDNÁVEK
// =====================================================

// Struktura jednoho záznamu sledování (jeden řádek z tabulky)
/*
{
    id: timestamp,
    date: "2024-01-15",
    competitors: {
        "Hopnato.cz": 2300812,
        "erosstar.cz": 124011015,
        "deeplove.cz": 224042369,
        "yoo.cz": 2024000322,
        "sexshop.cz": 20248649,
        "honitka.cz": 19606574,
        "sexshop.cz": 20248649,
        "eroticke-pomucky.cz": 400071,
        "flagranti.cz": 276820,
        "sexshopik.cz": 2806117,
        "e-kondomy.cz": 8260,
        "ruzovyslon.cz": 1704754427,
        "kondomshop.cz": 52449014
    },
    deltas: {
        "Hopnato.cz": 26,
        "erosstar.cz": 1015,
        // ... automaticky vypočítané
    },
    notes: ""
}
*/

// Seznam všech konkurentů (v pořadí jako v tabulce)
const COMPETITORS = [
    "Hopnato.cz",
    "erosstar.cz",
    "deeplove.cz",
    "yoo.cz",
    "sexicekshop.cz",
    "honitka.cz",
    "sexshop.cz",
    "eroticke-pomucky.cz",
    "flagranti.cz",
    "sexshopik.cz",
    "sex-shop69.cz",
    "eroticcity.cz",
    "e-kondomy.cz",
    "ruzovyslon.cz",
    "kondomshop.cz"
];

// Globální data
let trackingData = []; // Pole záznamů sledování

// =====================================================
// VÝPOČET DELT A METRIK
// =====================================================

// Konkurenti s měsíčním resetem číselné řady
const MONTHLY_RESET_COMPETITORS = ["erosstar.cz", "deeplove.cz"];

/**
 * Vypočítá deltu pro konkurenty s měsíčním resetem číselné řady
 * Formát: 1YYMMSSSS kde 1=prefix, YY=rok, MM=měsíc, SSSS=pořadové číslo v měsíci
 * Např.: 124074452 = 1-24-07-4452 (rok 2024, červenec, 4452. objednávka)
 *
 * Při změně měsíce: Delta = (konec_měsíce - předchozí_měření) + nový_měsíc
 * Např.: (4452 - 4122) + 632 = 330 + 632 = 962
 */
function calculateDeltaWithMonthlyReset(current, previous, competitorName, record, prevRecord) {
    if (current === 0 || previous === 0) {
        return current - previous;
    }

    // Převést na stringy
    const currentStr = String(current).padStart(10, '0');
    const previousStr = String(previous).padStart(10, '0');

    // Extrahovat části: 1YYMMSSSS
    // Index:           0123456789
    const currentYear = currentStr.substring(1, 3);   // YY
    const currentMonth = currentStr.substring(3, 5);  // MM
    const currentOrder = parseInt(currentStr.substring(5)) || 0; // SSSS

    const previousYear = previousStr.substring(1, 3);
    const previousMonth = previousStr.substring(3, 5);
    const previousOrder = parseInt(previousStr.substring(5)) || 0;

    // Stejný měsíc = normální výpočet
    if (currentYear === previousYear && currentMonth === previousMonth) {
        return currentOrder - previousOrder;
    }

    // ZMĚNA MĚSÍCE - potřebujeme koncové číslo předchozího měsíce
    // Zkontroluj, jestli uživatel zadal monthEndValue
    const monthEndValue = record.monthEndValues && record.monthEndValues[competitorName];

    if (monthEndValue) {
        // Máme koncové číslo měsíce - použij správný vzorec
        const monthEndStr = String(monthEndValue).padStart(10, '0');
        const monthEndOrder = parseInt(monthEndStr.substring(5)) || 0;

        const delta = (monthEndOrder - previousOrder) + currentOrder;

        console.log(`✅ ${competitorName}: Změna měsíce ${previousMonth}→${currentMonth}`);
        console.log(`   Výpočet: (${monthEndOrder} - ${previousOrder}) + ${currentOrder} = ${delta}`);

        return delta;
    }

    // Nemáme koncové číslo - použij zjednodušený výpočet (jen nový měsíc)
    console.warn(`⚠️ ${competitorName}: Změna měsíce bez koncového čísla!`);
    console.warn(`   Měsíc: ${previousYear}-${previousMonth} → ${currentYear}-${currentMonth}`);
    console.warn(`   Použit zjednodušený výpočet (jen nový měsíc): ${currentOrder}`);
    console.warn(`   💡 Pro přesný výpočet zadej "Konec měsíce" hodnotu!`);

    return currentOrder;
}

function calculateDeltas() {
    // Seřadit data podle data
    trackingData.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Pro každý záznam vypočítat delty
    trackingData.forEach((record, index) => {
        if (index === 0) {
            // První záznam nemá delty
            record.deltas = {};
            COMPETITORS.forEach(comp => {
                record.deltas[comp] = 0;
            });
        } else {
            // Vypočítat delta oproti předchozímu záznamu
            const prevRecord = trackingData[index - 1];
            record.deltas = {};

            COMPETITORS.forEach(comp => {
                const current = record.competitors[comp] || 0;
                const previous = prevRecord.competitors[comp] || 0;

                // Speciální logika pro konkurenty s měsíčním resetem
                if (MONTHLY_RESET_COMPETITORS.includes(comp)) {
                    record.deltas[comp] = calculateDeltaWithMonthlyReset(current, previous, comp, record, prevRecord);
                } else {
                    record.deltas[comp] = current - previous;
                }
            });
        }
    });

    // Vypočítat agregované metriky pro každý záznam
    trackingData.forEach(record => {
        // Celkem objednávek (suma delt všech konkurentů)
        record.totalOrders = Object.values(record.deltas).reduce((sum, delta) => sum + delta, 0);

        // Podíl Růžového Slona
        const slonDelta = record.deltas["ruzovyslon.cz"] || 0;
        record.slonShare = record.totalOrders > 0 ? (slonDelta / record.totalOrders) * 100 : 0;

        // Podíly vůči jednotlivým konkurentům
        record.shares = {};
        const competitorsForShare = ["e-kondomy.cz", "flagranti.cz", "sexshop.cz", "erosstar.cz", "yoo.cz", "deeplove.cz"];

        competitorsForShare.forEach(comp => {
            const compDelta = record.deltas[comp] || 0;
            const total = slonDelta + compDelta;
            record.shares[comp] = total > 0 ? (slonDelta / total) * 100 : 0;
        });
    });
}

// =====================================================
// IMPORT Z GOOGLE SHEETS
// =====================================================

async function importFromGoogleSheetsCustomFormat() {
    const url = document.getElementById('google-sheets-url').value.trim();
    const statusDiv = document.getElementById('import-status');

    function showStatus(message, type = 'info') {
        if (!statusDiv) return;
        statusDiv.classList.remove('hidden', 'bg-blue-50', 'bg-green-50', 'bg-red-50', 'text-blue-800', 'text-green-800', 'text-red-800');

        if (type === 'success') {
            statusDiv.classList.add('bg-green-50', 'text-green-800');
        } else if (type === 'error') {
            statusDiv.classList.add('bg-red-50', 'text-red-800');
        } else {
            statusDiv.classList.add('bg-blue-50', 'text-blue-800');
        }

        statusDiv.classList.add('p-3', 'rounded-lg', 'text-sm');
        statusDiv.innerHTML = message;
    }

    if (!url) {
        showStatus('⚠️ Zadejte URL Google Sheets tabulky', 'error');
        return;
    }

    // Extrahování Spreadsheet ID
    const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (!match) {
        showStatus('⚠️ Neplatná URL Google Sheets', 'error');
        return;
    }

    const spreadsheetId = match[1];
    const sheetName = "Zkušeb.obj. CZ"; // Název listu

    try {
        showStatus('⏳ Načítám data z Google Sheets...', 'info');

        const csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;

        const response = await fetch(csvUrl);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const csvText = await response.text();

        showStatus('⏳ Parsování dat...', 'info');
        parseCustomCSV(csvText);

        if (trackingData.length === 0) {
            throw new Error('Nebyly načteny žádné záznamy. Zkontroluj strukturu tabulky.');
        }

        showStatus('⏳ Výpočet delt...', 'info');
        calculateDeltas();

        showStatus('⏳ Ukládám data...', 'info');
        await saveTrackingData();

        renderTrackingTable();
        if (typeof updateMetricsDisplay === 'function') {
            updateMetricsDisplay();
        }
        if (typeof updateAllCharts === 'function') {
            updateAllCharts();
        }

        showStatus(`✅ Úspěšně importováno <strong>${trackingData.length} záznamů</strong>!<br><small>Růžový Slon a Sexy Elephant můžeš upravit pomocí ✏️</small>`, 'success');

        setTimeout(() => {
            if (typeof closeDataManagementModal === 'function') {
                closeDataManagementModal();
            }
        }, 2000);

    } catch (error) {
        console.error('Chyba při importu:', error);
        showStatus(`❌ Chyba při importu: ${error.message}<br><small>Zkontroluj, že tabulka je veřejně přístupná a má list "Zkušeb.obj. CZ"</small>`, 'error');
    }
}

function parseCustomCSV(csvText) {
    const lines = csvText.split('\n');
    if (lines.length < 2) {
        console.error('CSV nemá dostatek řádků');
        return;
    }

    // Parsovat záhlaví
    const header = parseCSVLine(lines[0]);
    console.log('📋 Načtených sloupců:', header.length);
    console.log('📋 První sloupce:', header.slice(0, 5).join(' | '));

    // Najít indexy sloupců pro jednotlivé konkurenty
    const columnMap = {};

    header.forEach((col, index) => {
        const colLower = col.toLowerCase().trim();

        // Mapování sloupců konkurentů (číslo objednávky, ne delta)
        if (colLower === 'hopnato.cz' || colLower.includes('hopnato')) columnMap['Hopnato.cz'] = index;
        else if (colLower === 'erosstar.cz' || colLower.includes('erosstar')) columnMap['erosstar.cz'] = index;
        else if (colLower === 'deeplove.cz' || colLower.includes('deeplove')) columnMap['deeplove.cz'] = index;
        else if (colLower === 'yoo.cz' || colLower.includes('yoo')) columnMap['yoo.cz'] = index;
        else if (colLower === 'sexicekshop.cz' || colLower.includes('sexicek')) columnMap['sexicekshop.cz'] = index;
        else if (colLower === 'honitka.cz' || colLower.includes('honitka')) columnMap['honitka.cz'] = index;
        else if (colLower === 'sexshop.cz' || colLower.includes('sexshop')) columnMap['sexshop.cz'] = index;
        else if (colLower === 'eroticke-pomucky.cz' || colLower.includes('eroticke')) columnMap['eroticke-pomucky.cz'] = index;
        else if (colLower === 'flagranti.cz' || colLower.includes('flagranti')) columnMap['flagranti.cz'] = index;
        else if (colLower === 'sexshopik.cz' || colLower.includes('sexshopik')) columnMap['sexshopik.cz'] = index;
        else if (colLower === 'sex-shop69.cz' || colLower.includes('sex-shop69')) columnMap['sex-shop69.cz'] = index;
        else if (colLower === 'eroticcity.cz' || colLower.includes('eroticcity')) columnMap['eroticcity.cz'] = index;
        else if (colLower === 'e-kondomy.cz' || colLower.includes('e-kondomy') || colLower.includes('ekondomy')) columnMap['e-kondomy.cz'] = index;
        else if (colLower === 'ruzovyslon.cz' || colLower.includes('r') && colLower.includes('slon') || colLower.includes('ruzovy')) columnMap['ruzovyslon.cz'] = index;
        else if (colLower === 'kondomshop.cz' || colLower.includes('kondomshop')) columnMap['kondomshop.cz'] = index;
    });

    console.log('🎯 Nalezené sloupce:', Object.keys(columnMap).length);
    console.log('🎯 Mapované e-shopy:', Object.keys(columnMap));

    // Parsovat data
    trackingData = [];

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const columns = parseCSVLine(line);
        if (columns.length < 2) continue;

        const dateStr = columns[0];
        if (!dateStr) continue;

        // Konverze data
        const formattedDate = formatDateForStorage(dateStr);
        if (!formattedDate) continue;

        // Vytvoření záznamu
        const record = {
            id: Date.now() + i,
            date: formattedDate,
            competitors: {},
            deltas: {},
            notes: ''
        };

        // Načtení čísel objednávek pro všechny konkurenty
        Object.keys(columnMap).forEach(competitor => {
            const colIndex = columnMap[competitor];
            const value = columns[colIndex];
            record.competitors[competitor] = value ? parseInt(value) || 0 : 0;
        });

        trackingData.push(record);
    }

    console.log(`✅ Načteno ${trackingData.length} záznamů z CSV`);
    if (trackingData.length > 0) {
        console.log('📅 První záznam:', trackingData[0].date);
        console.log('📅 Poslední záznam:', trackingData[trackingData.length - 1].date);
    }
}

function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }

    result.push(current.trim());
    return result;
}

function formatDateForStorage(dateStr) {
    // Zkusí parsovat různé formáty data
    const formats = [
        /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/, // DD.MM.YYYY
        /^(\d{4})-(\d{1,2})-(\d{1,2})$/, // YYYY-MM-DD
        /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/ // DD/MM/YYYY
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
            } else {
                // DD.MM.YYYY nebo DD/MM/YYYY
                day = match[1].padStart(2, '0');
                month = match[2].padStart(2, '0');
                year = match[3];
            }

            return `${year}-${month}-${day}`;
        }
    }

    return null;
}

// =====================================================
// ULOŽENÍ A NAČTENÍ DAT
// =====================================================

async function saveTrackingData() {
    try {
        if (typeof saveOrdersToFirestore === 'function') {
            // Použít Firestore pokud je k dispozici
            await saveOrdersToFirestore(trackingData);
        } else {
            // Fallback na LocalStorage
            localStorage.setItem('trackingData', JSON.stringify(trackingData));
        }
    } catch (e) {
        console.error('Chyba při ukládání:', e);
        localStorage.setItem('trackingData', JSON.stringify(trackingData));
    }
}

async function loadTrackingData() {
    try {
        if (typeof loadOrdersFromFirestore === 'function') {
            const data = await loadOrdersFromFirestore();
            if (data && data.length > 0) {
                trackingData = data;
                return;
            }
        }

        // Fallback na LocalStorage
        const saved = localStorage.getItem('trackingData');
        if (saved) {
            trackingData = JSON.parse(saved);
        }
    } catch (e) {
        console.error('Chyba při načítání:', e);
        trackingData = [];
    }
}

// Export funkcí
window.importFromGoogleSheetsCustomFormat = importFromGoogleSheetsCustomFormat;
window.calculateDeltas = calculateDeltas;
window.saveTrackingData = saveTrackingData;
window.loadTrackingData = loadTrackingData;
window.trackingData = trackingData;
window.COMPETITORS = COMPETITORS;
