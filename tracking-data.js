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
                record.deltas[comp] = current - previous;
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
    const sheetName = "Zkušeb.obj. CZ"; // Název listu

    try {
        const csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;

        const response = await fetch(csvUrl);
        if (!response.ok) {
            throw new Error('Nepodařilo se načíst data z Google Sheets');
        }

        const csvText = await response.text();
        parseCustomCSV(csvText);

        calculateDeltas();
        await saveTrackingData();
        renderTrackingTable();
        updateAllCharts();

        alert(`Úspěšně importováno ${trackingData.length} záznamů!`);
        closeDataManagementModal();

    } catch (error) {
        console.error('Chyba při importu:', error);
        alert('Nepodařilo se importovat data: ' + error.message);
    }
}

function parseCustomCSV(csvText) {
    const lines = csvText.split('\n');
    if (lines.length < 2) return;

    // Parsovat záhlaví
    const header = parseCSVLine(lines[0]);

    // Najít indexy sloupců pro jednotlivé konkurenty
    const columnMap = {};

    header.forEach((col, index) => {
        const colLower = col.toLowerCase().trim();

        // Mapování sloupců konkurentů (číslo objednávky, ne delta)
        if (colLower === 'hopnato.cz') columnMap['Hopnato.cz'] = index;
        else if (colLower === 'erosstar.cz') columnMap['erosstar.cz'] = index;
        else if (colLower === 'deeplove.cz') columnMap['deeplove.cz'] = index;
        else if (colLower === 'yoo.cz') columnMap['yoo.cz'] = index;
        else if (colLower === 'sexicekshop.cz') columnMap['sexicekshop.cz'] = index;
        else if (colLower === 'honitka.cz') columnMap['honitka.cz'] = index;
        else if (colLower === 'sexshop.cz') columnMap['sexshop.cz'] = index;
        else if (colLower === 'eroticke-pomucky.cz') columnMap['eroticke-pomucky.cz'] = index;
        else if (colLower === 'flagranti.cz') columnMap['flagranti.cz'] = index;
        else if (colLower === 'sexshopik.cz') columnMap['sexshopik.cz'] = index;
        else if (colLower === 'sex-shop69.cz') columnMap['sex-shop69.cz'] = index;
        else if (colLower === 'eroticcity.cz') columnMap['eroticcity.cz'] = index;
        else if (colLower === 'e-kondomy.cz') columnMap['e-kondomy.cz'] = index;
        else if (colLower === 'ruzovyslon.cz') columnMap['ruzovyslon.cz'] = index;
        else if (colLower === 'kondomshop.cz') columnMap['kondomshop.cz'] = index;
    });

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
