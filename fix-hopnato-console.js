// ============================================
// KONZOLOVÝ SCRIPT PRO OPRAVU HOPNATO.CZ
// ============================================
// Zkopíruj tento celý blok kódu a vlož ho do konzole prohlížeče (F12)

console.log('🔧 Spouštím opravu hopnato.cz pro 12.5.2025...');

// Najít záznam
const record = window.trackingData.find(r => r.date === '2025-05-12');

if (!record) {
    console.error('❌ Záznam pro 12.5.2025 nenalezen!');
    console.log('Dostupná data:', window.trackingData.map(r => r.date));
} else {
    console.log('✅ Záznam nalezen:', record.date);

    // Zobrazit aktuální stav VŠECH variant hopnato
    console.log('\n📊 Aktuální stav:');
    const variants = ['Hopnato.cz', 'hopnato.cz', 'HOPNATO.CZ'];
    variants.forEach(v => {
        if (record.competitors && record.competitors[v] !== undefined) {
            console.log(`  ${v}:`);
            console.log(`    competitors: ${record.competitors[v]}`);
            console.log(`    deltas: ${record.deltas?.[v]}`);
            console.log(`    firstMeasurement: ${record.firstMeasurement?.[v]}`);
            console.log(`    manualDeltas: ${record.manualDeltas?.[v]}`);
        }
    });

    // Inicializovat objekty
    if (!record.competitors) record.competitors = {};
    if (!record.deltas) record.deltas = {};
    if (!record.firstMeasurement) record.firstMeasurement = {};
    if (!record.manualDeltas) record.manualDeltas = {};

    // Najít správnou variantu názvu
    let correctName = null;
    for (const variant of variants) {
        if (record.competitors[variant] !== undefined) {
            correctName = variant;
            break;
        }
    }

    if (!correctName) {
        // Pokud neexistuje, použít Hopnato.cz
        correctName = 'Hopnato.cz';
        console.log('⚠️ hopnato.cz nenalezeno, vytvářím nový záznam jako:', correctName);
    } else {
        console.log('✅ Používám existující variantu:', correctName);
    }

    // OPRAVA
    console.log('\n🔧 Aplikuji opravu...');
    record.competitors[correctName] = 2615961;
    record.deltas[correctName] = 0;
    record.firstMeasurement[correctName] = true;
    record.manualDeltas[correctName] = 0;

    console.log('\n✅ Nový stav:');
    console.log(`  competitors[${correctName}]: ${record.competitors[correctName]}`);
    console.log(`  deltas[${correctName}]: ${record.deltas[correctName]}`);
    console.log(`  firstMeasurement[${correctName}]: ${record.firstMeasurement[correctName]}`);
    console.log(`  manualDeltas[${correctName}]: ${record.manualDeltas[correctName]}`);

    // Uložit
    console.log('\n💾 Ukládám...');
    localStorage.setItem('trackingData', JSON.stringify(window.trackingData));

    // Přepočítat delty
    console.log('🔄 Přepočítávám delty...');
    if (typeof calculateDeltas === 'function') {
        calculateDeltas();
    } else if (typeof window.calculateDeltas === 'function') {
        window.calculateDeltas();
    }

    // Synchronizovat s Firestore
    if (typeof saveTrackingDataToFirestore === 'function') {
        console.log('☁️ Synchronizuji s Firestore...');
        saveTrackingDataToFirestore(window.trackingData).then(() => {
            console.log('✅ Firestore synchronizováno');
        }).catch(err => {
            console.error('❌ Chyba Firestore:', err);
        });
    }

    // Obnovit UI
    console.log('🎨 Obnovuji UI...');
    if (typeof renderTrackingTable === 'function') {
        renderTrackingTable();
    }
    if (typeof updateMetricsDisplay === 'function') {
        updateMetricsDisplay();
    }
    if (typeof renderCharts === 'function') {
        renderCharts();
    }

    console.log('\n🎉 HOTOVO!');
    console.log('Pokud pořád vidíš špatné číslo, obnov stránku (F5).');
}
