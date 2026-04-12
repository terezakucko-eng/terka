import { useRef, useState } from 'react'

function App() {
  const [photo, setPhoto] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cvRef = useRef<HTMLDivElement>(null)

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (ev) => setPhoto(ev.target?.result as string)
      reader.readAsDataURL(file)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="min-h-screen py-8 px-4">
      {/* Toolbar */}
      <div className="no-print max-w-[210mm] mx-auto mb-4 flex items-center gap-3 bg-white rounded-lg shadow px-5 py-3">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="px-4 py-2 bg-sidebar text-white rounded-md hover:bg-sidebar/90 transition-colors text-sm font-medium cursor-pointer"
        >
          Nahrát fotku
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handlePhotoUpload}
          className="hidden"
        />
        {photo && (
          <button
            onClick={() => setPhoto(null)}
            className="px-3 py-2 text-sm text-accent-red hover:bg-red-50 rounded-md transition-colors cursor-pointer"
          >
            Odstranit fotku
          </button>
        )}
        <div className="flex-1" />
        <span className="text-xs text-text-secondary">Kliknutím na text jej můžete upravit</span>
        <button
          onClick={handlePrint}
          className="px-4 py-2 bg-text-primary text-white rounded-md hover:bg-text-primary/85 transition-colors text-sm font-medium cursor-pointer"
        >
          Uložit jako PDF
        </button>
      </div>

      {/* CV Page */}
      <div
        ref={cvRef}
        className="cv-page max-w-[210mm] mx-auto bg-white shadow-xl rounded-sm"
        style={{ minHeight: '297mm' }}
      >
        {/* Header */}
        <div className="px-10 pt-8 pb-4">
          <div className="flex items-start gap-6">
            <div className="flex-1">
              <h1
                contentEditable
                suppressContentEditableWarning
                className="text-4xl font-bold tracking-tight leading-tight text-text-primary"
              >
                Tereza Kucková
              </h1>
              <p
                contentEditable
                suppressContentEditableWarning
                className="text-base text-text-secondary mt-1 font-light"
              >
                Marketingová ředitelka &middot; 7 trhů &middot; 8členný tým &middot; MBA Marketing
              </p>
            </div>
            <div className="flex items-start gap-5">
              <div className="text-right text-sm text-text-secondary space-y-0.5">
                <p contentEditable suppressContentEditableWarning>tereza.kucko@gmail.com</p>
                <p contentEditable suppressContentEditableWarning>724 443 766 &middot; Ostrava, ČR</p>
              </div>
              {/* Photo */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="w-20 h-20 rounded-sm bg-gray-100 overflow-hidden flex-shrink-0 cursor-pointer border border-border hover:border-sidebar transition-colors flex items-center justify-center"
                title="Klikněte pro nahrání fotky"
              >
                {photo ? (
                  <img src={photo} alt="Foto" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-xs text-gray-400 text-center leading-tight">Foto</span>
                )}
              </div>
            </div>
          </div>

          {/* Stats bar */}
          <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-1 bg-stats-bg rounded px-4 py-2.5 text-xs text-text-secondary">
            <span contentEditable suppressContentEditableWarning>V marketingu od 2013</span>
            <span contentEditable suppressContentEditableWarning>7 trhů střední a východní Evropy</span>
            <span contentEditable suppressContentEditableWarning>Tým 8 lidí</span>
            <span contentEditable suppressContentEditableWarning>MBA Marketing &middot; Newton University</span>
            <span contentEditable suppressContentEditableWarning>ENFJ &middot; CliftonStrengths: Activator, Maximizer, Strategic</span>
          </div>
        </div>

        {/* Two-column body */}
        <div className="flex px-10 pb-8 gap-8">
          {/* Left sidebar */}
          <div className="w-[28%] flex-shrink-0 space-y-5 pt-2">
            <SidebarSection title="VZDĚLÁNÍ">
              <SidebarItem bold="MBA – Marketing (probíhá)" sub="Newton University" />
              <SidebarItem bold="Hotelnictví a turismus" sub="SOU a HŠ Šilheřovice, maturita" />
              <SidebarItem bold="Klasický tanec" sub="Janáčkova konzervatoř Ostrava" />
            </SidebarSection>

            <SidebarSection title="KLÍČOVÉ DOVEDNOSTI">
              <EditableList items={[
                'Značka & marketingová strategie',
                'Výkonnostní marketing',
                'E-shop & optimalizace konverzí',
                'Péče o zákazníky & jejich udržení',
                'Marketingová analytika & data',
                'Marketing tvůrčí obsahu & partnerský marketing',
                'Vedení týmu & procesů',
                'Umělá inteligence v marketingu',
              ]} />
            </SidebarSection>

            <SidebarSection title="NÁSTROJE">
              <ToolGroup text="Google Ads · Meta Ads · Sklik" />
              <ToolGroup text="Heureka · Zboží.cz · Árukereső · Glami" />
              <ToolGroup text="Google Analytics · Looker Studio · PowerBI · SimilarWeb · Marketing Miner" />
              <ToolGroup text="Targito" />
              <ToolGroup text="AffiliBox · Dognet" />
              <ToolGroup text="Mergado · Google Search Console · Collabim" />
              <ToolGroup text="Basecamp · ClickUp · Trello" />
              <ToolGroup text="ABRA · Google Workspace" />
              <ToolGroup text="ChatGPT · Gemini · Claude · Firefly · NotebookLM" />
              <ToolGroup text="Canva · vlastní nástroje pomocí AI" />
            </SidebarSection>

            <SidebarSection title="JAZYKY & TRHY">
              <div contentEditable suppressContentEditableWarning className="text-[11px] leading-relaxed space-y-0.5">
                <p>· Čeština – rodilý mluvčí</p>
                <p>· Angličtina – pokročilá</p>
                <p className="mt-1.5 text-text-secondary">CZ · SK · HU · RO · HR · BG · SI</p>
              </div>
            </SidebarSection>

            <SidebarSection title="OSOBNOST">
              <div contentEditable suppressContentEditableWarning className="text-[11px] leading-relaxed">
                <p className="font-medium">ENFJ Protagonista</p>
                <p className="text-text-secondary mt-1 text-[10px] uppercase tracking-wide">Gallup CliftonStrengths Top 5</p>
                <ul className="mt-1 space-y-0.5">
                  <li>· Activator</li>
                  <li>· Maximizer</li>
                  <li>· Strategic</li>
                  <li>· Relator</li>
                  <li>· Empathy</li>
                </ul>
              </div>
            </SidebarSection>
          </div>

          {/* Right main content */}
          <div className="flex-1 space-y-5 pt-2">
            {/* Filozofie a přístup */}
            <MainSection title="FILOZOFIE A PŘÍSTUP">
              <p contentEditable suppressContentEditableWarning className="text-[12px] leading-relaxed text-text-secondary">
                Marketing mě baví proto, že v něm můžu propojovat data s empatií – čísla mi dávají směr, ale empatie mi pomáhá pochopit skutečné potřeby lidí. Věci dotahuji do konce, i když cesta k nim není vždy vyšlapaná. Věřím, že dobrý marketing nepotřebuje anglické zkratky – a dokážu prodat pouze to, čemu sama věřím. Jsem milovnice češtiny – preferuji české slovní spojení před anglickou zkratkou.
              </p>
            </MainSection>

            {/* Vedoucí marketingu */}
            <MainSection title="VEDOUCÍ MARKETINGU – RŮŽOVÝ SLON S.R.O.">
              <p contentEditable suppressContentEditableWarning className="text-[11px] text-text-secondary italic mb-2">
                E-commerce, 7 trhů CEE, 8členný tým, segment erotiky
              </p>
              <ul contentEditable suppressContentEditableWarning className="text-[12px] leading-relaxed space-y-1.5">
                <li><strong>Procesy a kvalita:</strong> Analyzuji nefunkční procesy, přenastavuji je a dohlížím na udržení kvality tam, kde se nám dlouhodobě daří.</li>
                <li><strong>Kreativní strategie:</strong> Hledám nové cesty k zákazníkům v segmentu, kde nám legislativa hází klacky pod nohy – marketing musí být chytřejší než překážky.</li>
                <li><strong>Marketing s příběhem:</strong> Věřím, že každý produkt se dá prodat skrze emoci. Proto dospělým vyprávím příběhy, které dělají značku zapamatovatelnou.</li>
                <li><strong>Vedení týmu:</strong> Řídím 8 lidí napříč disciplínami a dbám na to, aby se plány skutečně naplnily.</li>
                <li><strong>Mezioborová spolupráce:</strong> Úzce spolupracuji s obchodním týmem, produktovým oddělením, IT, návrháři rozhraní a zákaznickou péčí.</li>
                <li><strong>Regionální přesah:</strong> Primárně český trh, podpora slovenského, dohled nad dalšími pěti trhy CEE.</li>
              </ul>
            </MainSection>

            {/* Marketingový specialista */}
            <MainSection title="MARKETINGOVÝ SPECIALISTA – RŮŽOVÝ SLON S.R.O.">
              <p contentEditable suppressContentEditableWarning className="text-[12px] leading-relaxed text-text-secondary">
                Budování marketingové infrastruktury od nuly a expanze z CZ/SK na 5 dalších trhů. Srovnávače, kampaňový kalendář, influencer spolupráce, partnerský program, spolupráce s vývojáři.
              </p>
            </MainSection>

            {/* Dřívější zkušenosti */}
            <MainSection title="DŘÍVĚJŠÍ ZKUŠENOSTI">
              <div contentEditable suppressContentEditableWarning className="text-[12px] leading-relaxed space-y-1.5">
                <p><strong>Vedoucí PPC specialistka · PPC specialistka</strong></p>
                <p className="text-text-secondary text-[11px]">Seznam.cz – Tvrdá škola výkonnostního marketingu, role obchodníka i konzultanta, školení klientů</p>
                <p className="mt-1.5"><strong>PPC specialistka (OSVČ) · Freelance</strong></p>
                <p className="text-text-secondary text-[11px]">Správa kampaní pro malé, střední i velké klienty – Google Ads, Sklik, Meta Ads</p>
                <p className="mt-1.5"><strong>Majitelka pohybového studia · Lektorka</strong></p>
                <p className="text-text-secondary text-[11px]">MOVE IN ZONE s.r.o. – skupinové i individuální lekce, organizace sportovních a tanečních eventů</p>
              </div>
            </MainSection>

            {/* Spolupráce */}
            <MainSection title="SPOLUPRÁCE">
              <div contentEditable suppressContentEditableWarning className="text-[12px] leading-relaxed space-y-0.5">
                <p>· <strong>Radek Hudák</strong> – nadřízený v Růžovém Slonu</p>
                <p>· <strong>Karel Rujzl</strong> – výkonnostní marketing · <strong>Jakub Rejnuš</strong> – SEO · <strong>Karel Novotný</strong> – strategie značky</p>
                <p>· <strong>Motionhouse</strong> – grafika a design · <strong>CzechPromotion</strong> – výzkumy a data · <strong>Behavio</strong> – behaviorální výzkumy</p>
              </div>
            </MainSection>

            {/* Co ode mě čekat */}
            <div>
              <h3 className="text-xs font-bold tracking-widest uppercase mb-2 text-text-primary">CO ODE MĚ ČEKAT · CO NEČEKAT</h3>
              <div className="grid grid-cols-2 gap-3">
                <ColorBox title="ANO" color="bg-accent-green" textColor="text-white">
                  <ul contentEditable suppressContentEditableWarning className="text-[11px] leading-relaxed space-y-0.5">
                    <li>· Lidskost a čeština na prvním místě</li>
                    <li>· Příběhy a emoce jako nástroj prodeje</li>
                    <li>· Tah na branku a dotahování věcí</li>
                    <li>· Selský rozum nad teorií</li>
                  </ul>
                </ColorBox>
                <ColorBox title="NE" color="bg-accent-red" textColor="text-white">
                  <ul contentEditable suppressContentEditableWarning className="text-[11px] leading-relaxed space-y-0.5">
                    <li>· Anglické zkratky tam, kde existuje český výraz</li>
                    <li>· Prázdné fráze o dokonalosti</li>
                    <li>· Složitě korporátní věty</li>
                    <li>· Procesy pro procesy</li>
                  </ul>
                </ColorBox>
              </div>
            </div>

            {/* Trochu víc o mně */}
            <div>
              <h3 className="text-xs font-bold tracking-widest uppercase mb-2 text-text-primary">TROCHU VÍC O MNĚ</h3>
              <div className="grid grid-cols-3 gap-2">
                <ColorBox title="CO UMÍM" color="bg-accent-teal" textColor="text-white">
                  <ul contentEditable suppressContentEditableWarning className="text-[11px] leading-relaxed space-y-0.5">
                    <li>· Strategicky myslet a dotahovat do konce</li>
                    <li>· Číst data i lidi a propojit oboje</li>
                    <li>· Postavit tým a kulturu, kde se lidem chce pracovat</li>
                    <li>· Prodat značku, které věřím</li>
                    <li>· Psát česky – jasně a bez balastu</li>
                  </ul>
                </ColorBox>
                <ColorBox title="CO NEUMÍM A CHCI SE NAUČIT" color="bg-accent-orange" textColor="text-white">
                  <ul contentEditable suppressContentEditableWarning className="text-[11px] leading-relaxed space-y-0.5">
                    <li>· Říkat ne bez pocitu viny</li>
                    <li>· Angličtinu na úrovni C1</li>
                    <li>· Delegovat bez potřeby kontrolovat výsledek</li>
                    <li>· Trpělivost s pomalým rozhodováním</li>
                  </ul>
                </ColorBox>
                <ColorBox title="CO NEUMÍM" color="bg-accent-red" textColor="text-white">
                  <ul contentEditable suppressContentEditableWarning className="text-[11px] leading-relaxed space-y-0.5">
                    <li>· Dělat věci napůl</li>
                    <li>· Pracovat bez smyslu a vize</li>
                    <li>· Prodávat značku, které nevěřím</li>
                    <li>· Mlčet, když vidím, že se dá dělat líp</li>
                  </ul>
                </ColorBox>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-2">
                <ColorBox title="CO MĚ BAVÍ" color="bg-accent-teal" textColor="text-white">
                  <ul contentEditable suppressContentEditableWarning className="text-[11px] leading-relaxed space-y-0.5">
                    <li>· Marketing s reálným dopadem na růst firmy</li>
                    <li>· Budovat věci od nuly</li>
                    <li>· Lidé s tahem na branku</li>
                    <li>· Česky napsaný text, který dává smysl</li>
                    <li>· Tanec, sport, pohyb</li>
                  </ul>
                </ColorBox>
                <ColorBox title="CO MĚ NEBAVÍ" color="bg-accent-orange" textColor="text-white">
                  <ul contentEditable suppressContentEditableWarning className="text-[11px] leading-relaxed space-y-0.5">
                    <li>· Zbytečné porady místo rozhodnutí</li>
                    <li>· Anglické zkratky tam, kde stačí česky</li>
                    <li>· Marketing jako servisní oddělení</li>
                    <li>· Procesy pro procesy</li>
                  </ul>
                </ColorBox>
                <ColorBox title="CO SE TEĎ UČÍM" color="bg-accent-dark-teal" textColor="text-white">
                  <ul contentEditable suppressContentEditableWarning className="text-[11px] leading-relaxed space-y-0.5">
                    <li>· MBA Marketing – Newton University</li>
                    <li>· Umělá inteligence v marketingu</li>
                    <li>· Strategické finanční myšlení</li>
                    <li>· Vedení na úrovni nejvyššího vedení firmy</li>
                  </ul>
                </ColorBox>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── Helper Components ─── */

function SidebarSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3
        contentEditable
        suppressContentEditableWarning
        className="text-[10px] font-bold tracking-[0.15em] uppercase text-sidebar mb-2 border-b border-sidebar/20 pb-1"
      >
        {title}
      </h3>
      {children}
    </div>
  )
}

function SidebarItem({ bold, sub }: { bold: string; sub: string }) {
  return (
    <div contentEditable suppressContentEditableWarning className="text-[11px] leading-snug mb-1.5">
      <p className="font-semibold">{bold}</p>
      <p className="text-text-secondary text-[10px]">{sub}</p>
    </div>
  )
}

function EditableList({ items }: { items: string[] }) {
  return (
    <ul contentEditable suppressContentEditableWarning className="text-[11px] leading-relaxed space-y-0.5">
      {items.map((item, i) => (
        <li key={i}>· {item}</li>
      ))}
    </ul>
  )
}

function ToolGroup({ text }: { text: string }) {
  return (
    <p contentEditable suppressContentEditableWarning className="text-[11px] leading-snug text-text-secondary mb-1">
      {text}
    </p>
  )
}

function MainSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3
        contentEditable
        suppressContentEditableWarning
        className="text-xs font-bold tracking-widest uppercase mb-2 text-text-primary"
      >
        {title}
      </h3>
      {children}
    </div>
  )
}

function ColorBox({ title, color, textColor, children }: {
  title: string
  color: string
  textColor: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded overflow-hidden">
      <div className={`${color} ${textColor} px-2.5 py-1`}>
        <span contentEditable suppressContentEditableWarning className="text-[10px] font-bold tracking-wider uppercase">
          {title}
        </span>
      </div>
      <div className="px-2.5 py-2 bg-gray-50">
        {children}
      </div>
    </div>
  )
}

export default App
