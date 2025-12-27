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

// Seznam všech konkurentů (organizováno podle trhů)
const COMPETITORS = [
    // === CZ trh - Konkurence ===
    "Hopnato.cz",
    "erosstar.cz",
    "deeplove.cz",
    "yoo.cz",
    "honitka.cz",
    "eroticke-pomucky.cz",
    "flagranti.cz",
    "sexshopik.cz",
    "e-kondomy.cz",

    // === CZ trh - Vlastní e-shopy ===
    "ruzovyslon.cz",
    "kondomshop.cz",

    // === SK trh - Konkurence ===
    "isexshop.sk",
    "flagranti.sk",
    "superlove.sk",
    "eros.sk",

    // === SK trh - Vlastní e-shopy ===
    "ruzovyslon.sk",
    "kondomshop.sk",

    // === Ostatní trhy - Vlastní e-shopy (Sexy Elephant) ===
    "sexyelephant.ro",
    "sexyelephant.hu",
    "sexyelephant.si",
    "sexyelephant.bg",
    "sexyelephant.hr",

    // === Ostatní trhy - Konkurence (Superlove) ===
    "superlove.ro",
    "superlove.pl",
    "superlove.eu",
    "superlove.at",
    "superlove.hr",
    "superlove.it",
    "superlove.si",
    "superlove.bg",
    "superlove.lt",
    "superlove.es",
    "superlove.hu",

    // === Maďarsko - Konkurence ===
    "goldengate.hu",
    "padlizsan.hu",
    "sexshopcenter.hu",
    "erotikashow.hu",
    "szexaruhaz.hu",
    "szexshop.hu",
    "vagyaim.hu"
];

// Vlastní e-shopy - zadává se počet objednávek (delty) přímo, ne číslo objednávky
const OWN_ESHOPS = [
    "ruzovyslon.cz",
    "ruzovyslon.sk",
    "kondomshop.cz",
    "kondomshop.sk",
    "sexyelephant.ro",
    "sexyelephant.hu",
    "sexyelephant.si",
    "sexyelephant.bg",
    "sexyelephant.hr"
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
 * Např.: 125010687 = 1-25-01-0687 (rok 2025, leden, 687. objednávka)
 *
 * Při změně měsíce: Delta = (konec_měsíce - předchozí_měření) + nový_měsíc
 * Např.: (14721 - 13986) + 326 = 735 + 326 = 1061
 *
 * AUTOMATICKÉ HLEDÁNÍ: Když detekuje změnu měsíce, automaticky najde poslední
 * záznam z předchozího měsíce v databázi a použije ho jako "konec měsíce".
 */
function calculateDeltaWithMonthlyReset(current, previous, competitorName, record, prevRecord, allRecords, currentIndex) {
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

    // ZMĚNA MĚSÍCE - automaticky najít poslední záznam předchozího měsíce
    console.log(`🔄 ${competitorName}: Detekována změna měsíce ${previousYear}-${previousMonth} → ${currentYear}-${currentMonth}`);

    // Hledat v celé databázi poslední záznam z předchozího měsíce
    let monthEndValue = null;
    let monthEndSource = 'neznámý';

    // 1. Pokusit se najít poslední záznam předchozího měsíce v databázi
    for (let i = currentIndex - 1; i >= 0; i--) {
        const checkRecord = allRecords[i];
        const checkValue = checkRecord.competitors[competitorName] || 0;

        if (checkValue === 0) continue;

        const checkStr = String(checkValue).padStart(10, '0');
        const checkYear = checkStr.substring(1, 3);
        const checkMonth = checkStr.substring(3, 5);

        // Pokud jsme našli záznam z předchozího měsíce
        if (checkYear === previousYear && checkMonth === previousMonth) {
            monthEndValue = checkValue;
            monthEndSource = `automaticky (záznam z ${checkRecord.date})`;
            break;
        }

        // Pokud jsme už v ještě starším měsíci, můžeme přestat hledat
        if (checkYear < previousYear || (checkYear === previousYear && checkMonth < previousMonth)) {
            break;
        }
    }

    // 2. Pokud nenajdeme automaticky, zkusit monthEndValues z předchozího záznamu
    if (!monthEndValue && prevRecord.monthEndValues && prevRecord.monthEndValues[competitorName]) {
        monthEndValue = prevRecord.monthEndValues[competitorName];
        monthEndSource = 'manuálně zadaná hodnota';
    }

    if (monthEndValue) {
        // Máme koncové číslo měsíce - použij správný vzorec
        const monthEndStr = String(monthEndValue).padStart(10, '0');
        const monthEndOrder = parseInt(monthEndStr.substring(5)) || 0;

        const delta = (monthEndOrder - previousOrder) + currentOrder;

        console.log(`✅ ${competitorName}: Použit konec měsíce (${monthEndSource})`);
        console.log(`   Výpočet: (${monthEndOrder} - ${previousOrder}) + ${currentOrder} = ${delta}`);

        return delta;
    }

    // Nemáme koncové číslo - použij zjednodušený výpočet (jen nový měsíc)
    console.warn(`⚠️ ${competitorName}: Změna měsíce bez koncového čísla!`);
    console.warn(`   Měsíc: ${previousYear}-${previousMonth} → ${currentYear}-${currentMonth}`);
    console.warn(`   Použit zjednodušený výpočet (jen nový měsíc): ${currentOrder}`);
    console.warn(`   💡 Přidej záznam z konce předchozího měsíce pro přesný výpočet!`);

    return currentOrder;
}

function calculateDeltas() {
    // Seřadit data podle data
    trackingData.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Pro každý záznam vypočítat delty
    trackingData.forEach((record, index) => {
        // Zachovat existující delty (z importu vlastních e-shopů)
        const existingDeltas = record.deltas || {};

        if (index === 0) {
            // První záznam nemá delty (kromě importovaných)
            record.deltas = existingDeltas;
            COMPETITORS.forEach(comp => {
                // Pokud delta není už nastavená, dej 0
                if (record.deltas[comp] === undefined) {
                    record.deltas[comp] = 0;
                }
            });
        } else {
            // Vypočítat delta oproti předchozímu záznamu
            const prevRecord = trackingData[index - 1];

            COMPETITORS.forEach(comp => {
                // Pokud je delta už nastavená (z importu "Objednáno kusů"), nech ji být
                if (existingDeltas[comp] !== undefined && existingDeltas[comp] !== 0) {
                    // Delta už je importovaná, přeskočit výpočet
                    return;
                }

                const current = record.competitors[comp] || 0;
                const previous = prevRecord.competitors[comp] || 0;

                // Speciální logika pro konkurenty s měsíčním resetem
                if (MONTHLY_RESET_COMPETITORS.includes(comp)) {
                    record.deltas[comp] = calculateDeltaWithMonthlyReset(current, previous, comp, record, prevRecord, trackingData, index);
                } else {
                    record.deltas[comp] = current - previous;
                }
            });
        }

        // PŘEPSÁNÍ AUTOMATICKÉHO VÝPOČTU MANUÁLNÍMI DELTAMI
        // Pokud uživatel zadal manuální hodnotu, použij ji místo automatické
        if (record.manualDeltas) {
            Object.keys(record.manualDeltas).forEach(eshop => {
                const manualValue = record.manualDeltas[eshop];
                if (manualValue !== undefined && manualValue !== null) {
                    console.log(`✏️ Přepsání automatické delty pro ${eshop}: ${record.deltas[eshop]} → ${manualValue}`);
                    record.deltas[eshop] = manualValue;
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

    // AUTOMATICKÉ DOPLNĚNÍ CHYBĚJÍCÍCH DAT INTERPOLACÍ
    interpolateMissingData();
}

/**
 * Automaticky doplní chybějící data (kde je 0) pomocí interpolace
 * Najde nejbližší předchozí a následující nenulovou hodnotu a spočítá průměr
 */
function interpolateMissingData() {
    if (trackingData.length < 3) {
        // Interpolace má smysl jen když máme alespoň 3 záznamy
        return;
    }

    console.log('🔧 Interpolace chybějících dat...');
    let interpolatedCount = 0;

    // Pro každý e-shop zkontroluj všechny záznamy
    COMPETITORS.forEach(comp => {
        trackingData.forEach((record, index) => {
            // Přeskočit první a poslední záznam
            if (index === 0 || index === trackingData.length - 1) {
                return;
            }

            // Pokud má e-shop hodnotu 0 (chybějící data)
            const currentValue = record.competitors[comp] || 0;
            if (currentValue === 0) {
                // Najít předchozí nenulovou hodnotu
                let prevValue = null;
                let prevIndex = -1;
                for (let i = index - 1; i >= 0; i--) {
                    const val = trackingData[i].competitors[comp] || 0;
                    if (val !== 0) {
                        prevValue = val;
                        prevIndex = i;
                        break;
                    }
                }

                // Najít následující nenulovou hodnotu
                let nextValue = null;
                let nextIndex = -1;
                for (let i = index + 1; i < trackingData.length; i++) {
                    const val = trackingData[i].competitors[comp] || 0;
                    if (val !== 0) {
                        nextValue = val;
                        nextIndex = i;
                        break;
                    }
                }

                // Pokud máme obě hodnoty, spočítat interpolaci
                if (prevValue !== null && nextValue !== null) {
                    // Lineární interpolace podle vzdálenosti
                    const totalDistance = nextIndex - prevIndex;
                    const currentDistance = index - prevIndex;
                    const ratio = currentDistance / totalDistance;

                    const interpolatedValue = Math.round(prevValue + (nextValue - prevValue) * ratio);

                    console.log(`  📊 ${comp} [${formatDate(record.date)}]: Interpolace ${prevValue} → ${interpolatedValue} → ${nextValue}`);

                    // Uložit interpolovanou hodnotu
                    record.competitors[comp] = interpolatedValue;

                    // Přepočítat deltu pro tento záznam
                    if (index > 0) {
                        const prevRecord = trackingData[index - 1];
                        const prevOrderNum = prevRecord.competitors[comp] || 0;

                        if (MONTHLY_RESET_COMPETITORS.includes(comp)) {
                            record.deltas[comp] = calculateDeltaWithMonthlyReset(
                                interpolatedValue,
                                prevOrderNum,
                                comp,
                                record,
                                prevRecord,
                                trackingData,
                                index
                            );
                        } else {
                            record.deltas[comp] = interpolatedValue - prevOrderNum;
                        }
                    }

                    interpolatedCount++;
                }
            }
        });
    });

    if (interpolatedCount > 0) {
        console.log(`✅ Interpolováno ${interpolatedCount} chybějících hodnot`);
    }
}

// =====================================================
// IMPORT Z GOOGLE SHEETS
// =====================================================

async function importFromGoogleSheetsCustomFormat() {
    try {
        const urlInput = document.getElementById('google-sheets-url');
        const statusDiv = document.getElementById('import-status');

        // Ošetření případu, kdy element neexistuje
        if (!urlInput) {
            console.error('❌ Element google-sheets-url nebyl nalezen v DOM');
            console.error('Zkontrolujte, že modal "dataManagementModal" je správně načten');
            alert('Chyba: Formulář pro import nebyl správně načten. Zkuste obnovit stránku (Ctrl+F5).');
            return;
        }

        const url = urlInput.value.trim();

        function showStatus(message, type = 'info') {
            if (!statusDiv) {
                console.warn('Status div nebyl nalezen, vypíšu do console:', message);
                return;
            }
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

        // Získat vybraný list
        const sheetSelector = document.getElementById('sheet-selector');
        const sheetName = sheetSelector && sheetSelector.value ? sheetSelector.value : "List1";

        console.log(`Import začíná: ${sheetName} z ${spreadsheetId}`);

        showStatus(`Načítám data z listu "${sheetName}"...`, 'info');

        const csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;

        const response = await fetch(csvUrl);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const csvText = await response.text();

        showStatus('Parsování dat...', 'info');
        parseCustomCSV(csvText);

        if (trackingData.length === 0) {
            throw new Error('Nebyly načteny žádné záznamy. Zkontroluj strukturu tabulky.');
        }

        showStatus('⏳ Výpočet delt...', 'info');
        calculateDeltas();

        showStatus('⏳ Ukládám data...', 'info');

        // Uložit do localStorage
        await saveTrackingData();

        // Uložit všechny záznamy do Firestore (pokud je aktivní)
        if (typeof saveAllTrackingDataToFirestore === 'function') {
            await saveAllTrackingDataToFirestore(trackingData);
        }

        renderTrackingTable();
        if (typeof updateMetricsDisplay === 'function') {
            updateMetricsDisplay();
        }
        if (typeof updateAllCharts === 'function') {
            updateAllCharts();
        }

        // Spočítat importované konkurenty a vlastní e-shopy
        const sampleRecord = trackingData[0] || { competitors: {}, deltas: {} };
        const importedCompetitors = Object.keys(sampleRecord.competitors).filter(k => sampleRecord.competitors[k] > 0).length;
        const importedOwnShops = Object.keys(sampleRecord.deltas).filter(k =>
            ['ruzovyslon.cz', 'sexyelephant.cz', 'e-kondomy.cz'].includes(k) && sampleRecord.deltas[k] !== undefined
        ).length;

        showStatus(`✅ Úspěšně importováno <strong>${trackingData.length} záznamů</strong>!<br>` +
            `<small>📊 Konkurenti: ${importedCompetitors} e-shopů (absolutní čísla)</small><br>` +
            `<small>🏪 Vlastní e-shopy: ${importedOwnShops} e-shopů (delty z "Objednáno kusů")</small>`, 'success');

        setTimeout(() => {
            if (typeof closeDataManagementModal === 'function') {
                closeDataManagementModal();
            }
        }, 2000);

    } catch (error) {
        console.error('❌ Chyba při importu:', error);
        console.error('Stack trace:', error.stack);

        const statusDiv = document.getElementById('import-status');
        if (statusDiv) {
            statusDiv.classList.remove('hidden', 'bg-blue-50', 'bg-green-50', 'bg-red-50', 'text-blue-800', 'text-green-800', 'text-red-800');
            statusDiv.classList.add('bg-red-50', 'text-red-800', 'p-3', 'rounded-lg', 'text-sm');
            statusDiv.innerHTML = `❌ Chyba při importu: ${error.message}<br><small>Zkontroluj konzoli (F12) pro více informací</small>`;
        } else {
            alert(`Chyba při importu: ${error.message}\n\nOtevři konzoli (F12) pro více informací.`);
        }
    }
}

/**
 * Parser pro VERTIKÁLNÍ formát
 * Struktura: E-SHOP | Datum | Číslo obj. | Počet obj.
 *
 * Příklad:
 * deeplove.cz | 6.1.2025  | 225010673 | 859
 * erosstar.cz | 6.1.2025  | 125010687 | 687
 * deeplove.cz | 13.1.2025 | 225011646 | 973
 */
function parseVerticalCSV(lines) {
    const header = parseCSVLine(lines[0]);

    // Najít indexy sloupců
    let eshopIndex = -1;
    let dateIndex = -1;
    let orderNumIndex = -1;
    let countIndex = -1;

    header.forEach((col, index) => {
        const colLower = col.toLowerCase().trim();
        if (colLower.includes('e-shop') || colLower.includes('eshop')) {
            eshopIndex = index;
        } else if (colLower.includes('datum') || colLower.includes('date')) {
            dateIndex = index;
        } else if (colLower.includes('číslo') || colLower.includes('cislo')) {
            orderNumIndex = index;
        } else if (colLower.includes('počet') || colLower.includes('pocet') || colLower.includes('count')) {
            countIndex = index;
        }
    });

    console.log(`📍 Indexy sloupců: E-SHOP=${eshopIndex}, Datum=${dateIndex}, Číslo obj.=${orderNumIndex}, Počet obj.=${countIndex}`);

    if (eshopIndex === -1 || dateIndex === -1 || orderNumIndex === -1) {
        console.error('❌ Nepodařilo se najít všechny požadované sloupce');
        throw new Error('Nenalezeny požadované sloupce (E-SHOP, Datum, Číslo obj.)');
    }

    // Seskupit řádky podle data
    const recordsByDate = {};

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const columns = parseCSVLine(line);
        if (columns.length < 3) continue;

        const eshop = columns[eshopIndex]?.trim();
        const dateStr = columns[dateIndex]?.trim();
        const orderNum = columns[orderNumIndex]?.trim();
        const count = countIndex !== -1 ? columns[countIndex]?.trim() : '';

        if (!eshop || !dateStr) continue;

        // Konverze data
        const formattedDate = formatDateForStorage(dateStr);
        if (!formattedDate) {
            console.warn(`⚠️ Neplatné datum: "${dateStr}"`);
            continue;
        }

        // Inicializovat záznam pro toto datum
        if (!recordsByDate[formattedDate]) {
            recordsByDate[formattedDate] = {
                date: formattedDate,
                competitors: {},
                deltas: {}
            };
        }

        // Přidat data e-shopu
        recordsByDate[formattedDate].competitors[eshop] = orderNum ? parseInt(orderNum) || 0 : 0;
        recordsByDate[formattedDate].deltas[eshop] = count ? parseInt(count) || 0 : 0;
    }

    // Převést na pole a seřadit podle data
    trackingData = Object.values(recordsByDate)
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .map((record, index) => ({
            id: Date.now() + index,
            date: record.date,
            competitors: record.competitors,
            deltas: record.deltas,
            cellNotes: {},
            monthEndValues: {},
            notes: ''
        }));

    console.log(`✅ Načteno ${trackingData.length} záznamů z vertikálního CSV`);
    if (trackingData.length > 0) {
        console.log('📅 První záznam:', trackingData[0].date);
        console.log('📅 Poslední záznam:', trackingData[trackingData.length - 1].date);
        console.log('📊 E-shopy v prvním záznamu:', Object.keys(trackingData[0].competitors).join(', '));
    }

    window.trackingData = trackingData;
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
    console.log('📋 Sloupce:', header.join(' | '));

    // Detekovat formát tabulky (vertikální vs horizontální)
    const hasEshopColumn = header.some(col =>
        col.toLowerCase().includes('e-shop') ||
        col.toLowerCase().includes('eshop')
    );

    if (hasEshopColumn) {
        console.log('🔄 Detekován VERTIKÁLNÍ formát (jeden e-shop na řádek)');
        parseVerticalCSV(lines);
        return;
    }

    console.log('🔄 Detekován HORIZONTÁLNÍ formát (e-shopy jako sloupce)');

    // HORIZONTÁLNÍ PARSER (původní kód)
    // columnMap = čísla objednávek (absolutní) pro konkurenty
    // deltaMap = "Objednáno kusů" (delty) pro vlastní e-shopy
    const columnMap = {};
    const deltaMap = {};

    header.forEach((col, index) => {
        const colLower = col.toLowerCase().trim();
        // Normalizovat diakritiku pro lepší detekci
        const colNormalized = colLower
            .replace(/á/g, 'a')
            .replace(/í/g, 'i')
            .replace(/é/g, 'e')
            .replace(/ů/g, 'u')
            .replace(/ú/g, 'u')
            .replace(/č/g, 'c')
            .replace(/š/g, 's')
            .replace(/ž/g, 'z')
            .replace(/ý/g, 'y')
            .replace(/ň/g, 'n');

        const isOrderedPiecesColumn = colLower.includes('objednáno kusů') ||
                                       colNormalized.includes('objednano kusu') ||
                                       colLower.includes('obj. kusů') ||
                                       colNormalized.includes('obj. kusu');

        // Detekce vlastních e-shopů v "Objednáno kusů" sloupcích
        if (isOrderedPiecesColumn) {
            if (colNormalized.includes('ruzovy slon') ||
                colNormalized.includes('r.slon') ||
                colNormalized.includes('rslon')) {
                deltaMap['ruzovyslon.cz'] = index;
                console.log(`✅ Detekován delta sloupec: Růžový Slon (${col}, index ${index})`);
            }
            else if (colLower.includes('sexy elephant') ||
                     colNormalized.includes('sexyelephant') ||
                     colNormalized.includes('s.elephant')) {
                deltaMap['sexyelephant.cz'] = index;
                console.log(`✅ Detekován delta sloupec: Sexy Elephant (${col}, index ${index})`);
            }
            else if (colLower.includes('e-kondomy') ||
                     colNormalized.includes('ekondomy') ||
                     colNormalized.includes('e-kond')) {
                deltaMap['e-kondomy.cz'] = index;
                console.log(`✅ Detekován delta sloupec: e-kondomy.cz (${col}, index ${index})`);
            }
        }
        // Mapování sloupců konkurentů (číslo objednávky, ne delta)
        else {
            if (colLower.includes('hopnato')) columnMap['Hopnato.cz'] = index;
            else if (colLower.includes('erosstar')) columnMap['erosstar.cz'] = index;
            else if (colLower.includes('deeplove')) columnMap['deeplove.cz'] = index;
            else if (colLower.includes('yoo.cz') || colLower === 'yoo') columnMap['yoo.cz'] = index;
            else if (colLower.includes('sexicek')) columnMap['sexicekshop.cz'] = index;
            else if (colLower.includes('honitka')) columnMap['honitka.cz'] = index;
            else if (colLower.includes('sexshop.cz')) columnMap['sexshop.cz'] = index;
            else if (colLower.includes('eroticke')) columnMap['eroticke-pomucky.cz'] = index;
            else if (colLower.includes('flagranti')) columnMap['flagranti.cz'] = index;
            else if (colLower.includes('sexshopik')) columnMap['sexshopik.cz'] = index;
            else if (colLower.includes('sex-shop69')) columnMap['sex-shop69.cz'] = index;
            else if (colLower.includes('eroticcity')) columnMap['eroticcity.cz'] = index;
            else if (colLower.includes('kondomshop')) columnMap['kondomshop.cz'] = index;
        }
    });

    console.log('🎯 Nalezené sloupce (absolutní čísla):', Object.keys(columnMap).length);
    console.log('🎯 Mapované konkurenty:', Object.keys(columnMap));
    console.log('🎯 Nalezené sloupce (delty):', Object.keys(deltaMap).length);
    console.log('🎯 Mapované vlastní e-shopy:', Object.keys(deltaMap));

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

        // Načtení čísel objednávek pro konkurenty (absolutní čísla)
        Object.keys(columnMap).forEach(competitor => {
            const colIndex = columnMap[competitor];
            const value = columns[colIndex];
            record.competitors[competitor] = value ? parseInt(value) || 0 : 0;
        });

        // Načtení delt pro vlastní e-shopy (přímo z "Objednáno kusů")
        Object.keys(deltaMap).forEach(eshop => {
            const colIndex = deltaMap[eshop];
            const value = columns[colIndex];
            const deltaValue = value ? parseInt(value) || 0 : 0;

            // Pro vlastní e-shopy uložíme deltu přímo
            record.deltas[eshop] = deltaValue;

            // A také nastavíme competitors na 0 (nebudeme počítat deltu znovu)
            record.competitors[eshop] = 0;
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
        if (typeof window.useFirestore === 'function' && window.useFirestore()) {
            // Firestore je aktivní - realtime sync se postará o synchronizaci
            // Neukládáme celé pole, jen notifikujeme o změně
            localStorage.setItem('trackingData', JSON.stringify(trackingData));
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
        if (typeof loadTrackingDataFromFirestore === 'function') {
            const data = await loadTrackingDataFromFirestore();
            // Pokud Firestore vrátilo data (i prázdné pole), použij je a synchronizuj localStorage
            if (data !== null && data !== undefined) {
                trackingData = data;
                window.trackingData = trackingData;

                // Synchronizovat localStorage s Firestore
                if (data.length === 0) {
                    localStorage.removeItem('trackingData');
                } else {
                    localStorage.setItem('trackingData', JSON.stringify(data));
                }
                return;
            }
        }

        // Fallback na LocalStorage pouze pokud Firestore není dostupný
        const saved = localStorage.getItem('trackingData');
        if (saved) {
            trackingData = JSON.parse(saved);
            window.trackingData = trackingData;
        }
    } catch (e) {
        console.error('Chyba při načítání:', e);
        trackingData = [];
        window.trackingData = trackingData;
    }
}

// =====================================================
// EXPORT DO EXCELU (CSV)
// =====================================================

/**
 * Exportuje všechna data ze Sledování objednávek do CSV formátu (pro Excel)
 * Struktura: Datum | erosstar.cz | deeplove.cz | ... (všechny e-shopy)
 * Druhý řádek pro každé datum: Delta pro každý e-shop
 */
function exportTrackingToExcel() {
    if (!window.trackingData || window.trackingData.length === 0) {
        alert('Nejsou k dispozici žádná data pro export.');
        return;
    }

    console.log('📥 Export sledování objednávek do CSV...');

    // Seřadit podle data (nejstarší první)
    const sortedData = [...window.trackingData].sort((a, b) => new Date(a.date) - new Date(b.date));

    // Vytvořit hlavičku CSV
    let csv = 'Datum';

    // Přidat všechny e-shopy jako sloupce
    COMPETITORS.forEach(comp => {
        csv += `,${comp}`;
    });
    csv += '\n';

    // Pro každý záznam vytvoř dva řádky: čísla objednávek a delty
    sortedData.forEach(record => {
        // Formátovat datum pro Excel (DD.MM.YYYY)
        const dateParts = record.date.split('-'); // YYYY-MM-DD
        const excelDate = `${dateParts[2]}.${dateParts[1]}.${dateParts[0]}`;

        // Řádek 1: Čísla objednávek
        let row1 = `"${excelDate}"`;
        COMPETITORS.forEach(comp => {
            const orderNum = record.competitors[comp] || 0;
            row1 += `,${orderNum}`;
        });
        csv += row1 + '\n';

        // Řádek 2: Deltas (počet objednávek)
        let row2 = `"  Δ ${excelDate}"`;
        COMPETITORS.forEach(comp => {
            const delta = record.deltas[comp] || 0;
            row2 += `,${delta}`;
        });
        csv += row2 + '\n';
    });

    // Stáhnout CSV soubor
    const BOM = '\uFEFF'; // Byte Order Mark pro správné zobrazení diakritiky v Excelu
    const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sledovani-objednavek-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    console.log(`✅ Exportováno ${sortedData.length} záznamů do CSV`);
}

// Export funkcí
window.importFromGoogleSheetsCustomFormat = importFromGoogleSheetsCustomFormat;
window.exportTrackingToExcel = exportTrackingToExcel;
window.calculateDeltas = calculateDeltas;
window.saveTrackingData = saveTrackingData;
window.loadTrackingData = loadTrackingData;
window.trackingData = trackingData;
window.COMPETITORS = COMPETITORS;
window.OWN_ESHOPS = OWN_ESHOPS;
