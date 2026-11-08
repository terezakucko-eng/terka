import markdown,re,sys
src=open('/home/user/terka/SonicBrand_brief_2026-11.md').read()
# body = sections 1..5 only (we rebuild harmonogram, kdo rozhoduje, přílohy)
start=src.index('### 1. Kdo jsme'); end=src.index('### 6. Harmonogram')
core=src[start:end]
core=core.replace('Brief pro studia Trebledu a Brainz','')
agencies={
 'Trebledu':dict(call='pátek 13. 11. 2026 od 10:30 (online) – případně jiný termín podle vás',
   theirs=[('Ukázky projektů a případové studie','https://drive.google.com/drive/folders/1SjFq_yIbqB7ENZ1Mz2whCeXcR_8Z6sVh','zasláno 29. 9. 2026')]),
 'Brainz':dict(call='doplníme po domluvě (navrhli jste po 10. 11. 15:00, út 11. 11. 13:00 nebo st 12. 11. 9:00)',
   theirs=[('Prezentace s ukázkami (úvodní call 1. 10.)','https://www.figma.com/deck/3KioC6IkVc3wNcvzBFh62o','zasláno 1. 10. 2026')]),
}
css='<style>body{font-family:Arial;font-size:11pt} table{border-collapse:collapse;width:100%} td,th{border:1px solid #999;padding:5px 8px;vertical-align:top} th{background:#FBE5ED} h1{color:#DC004E} h2{color:#240A49} .note{background:#FCEAEA;padding:6px}</style>'
def table(headers,rows):
    h='<table><tr>'+''.join(f'<th>{x}</th>' for x in headers)+'</tr>'
    for r in rows: h+='<tr>'+''.join(f'<td>{x}</td>' for x in r)+'</tr>'
    return h+'</table>'
def a(u): return f'<a href="{u}">{u}</a>'
for name,cfg in agencies.items():
    md=f"# Růžový slon – zvuková identita\n## Brief a workbook pro {name} (listopad 2026)\n\n"
    html='<html><head><meta charset="utf-8">'+css+'</head><body>'
    html+=markdown.markdown(md)
    html+=('<p class="note"><b>Jak s dokumentem pracovat:</b> tento dokument je náš společný workbook. Najdete v něm zadání, podklady od nás a místo pro vaše odkazy, otázky a poznámky. '
           'Do tabulek můžete rovnou psát a vkládat odkazy, k libovolnému textu přidávejte komentáře (vložit komentář: označit text → Ctrl+Alt+M). '
           'Na komentáře budeme odpovídat přímo v dokumentu. Zadání dostávají všechna studia ve výběru ve stejné podobě.</p>')
    html+=markdown.markdown(core,extensions=['tables','sane_lists'])
    html+='<h3>6. Harmonogram</h3>'+table(['Krok','Termín'],[
        ['Brief a workbook','9. 11. 2026'],
        ['Online call (doplňující otázky k zadání)',cfg['call']],
        ['Odevzdání nabídky','<b>pátek 20. 11. 2026</b>'],
        ['Rozhodnutí','27. 11. 2026'],
        ['Smlouva','4. 12. 2026'],
        ['Zvukové logo a earcon hotové','do 31. 3. 2027']])
    html+=('<h3>7. Kdo rozhoduje</h3><p>Za Růžového slona: Tereza Kucková (Head of Marketing, kontaktní osoba), Karel Novotný (brand konzultant). '
           'V hodnotící komisi dále Adam Durčák (majitel) a Gabriel Kopeć.</p><p>Kontakt: Tereza Kucková, tereza.kuckova@ruzovyslon.cz</p>')
    html+='<h2>Workbook</h2>'
    html+='<h3>A. Podklady od nás</h3>'+table(['Podklad','Odkaz','Poznámka'],[
        ['Brand manuál Slon 4.0 (Visualbook)',a('https://ruzovyslon.visualbook.pro/'),
         'Nový brand manuál, hotový zhruba z 99 %. Náš grafik do něj právě doplňuje podrobnosti, mimo jiné upřesnění kódů značky. Aktualizaci vám dáme vědět zde v dokumentu.'],
        ['Dosavadní TV spoty (Vimeo)',a('https://vimeo.com/user119290805'),'Historické spoty se starou podobou maskota a současným hlasem (Martin Stránský). Novou podobu Slona představíme v lednu 2027.'],
        ['Dřívější pokusy o jingle (2021–22)','na vyžádání','Ukázky toho, čemu se chceme vyhnout.'],
        ['','','']])
    html+='<h3>B. Podklady a odkazy od vás</h3>'+table(['Co','Odkaz','Poznámka'],[[t,a(u),n] for t,u,n in cfg['theirs']]+[['','',''],['','','']])
    html+='<h3>C. Otázky a odpovědi</h3>'+table(['#','Otázka','Kdo se ptá','Odpověď'],[['1','','',''],['2','','',''],['3','','','']])
    html+='<h3>D. Poznámky z online callu</h3>'+table(['Datum','Účastníci','Hlavní body a domluvené kroky'],[['','','']])
    html+='<h3>E. Nabídka</h3>'+table(['Verze','Odkaz na nabídku','Datum','Poznámka'],[['1','','','']])
    html+='</body></html>'
    open(f'wb_{name}.html','w').write(html)
print('ok')
