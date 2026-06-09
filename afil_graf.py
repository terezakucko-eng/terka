import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.ticker as mticker
import numpy as np

months = [
    "Led\n2024","Úno\n2024","Bře\n2024","Dub\n2024","Kvě\n2024","Čer\n2024",
    "Čvc\n2024","Srp\n2024","Zář\n2024","Říj\n2024","Lis\n2024","Pro\n2024",
    "Led\n2025","Úno\n2025","Bře\n2025","Dub\n2025","Kvě\n2025","Čer\n2025",
    "Čvc\n2025","Srp\n2025","Zář\n2025","Říj\n2025","Lis\n2025","Pro\n2025",
    "Led\n2026","Úno\n2026","Bře\n2026","Dub\n2026","Kvě\n2026","Čer\n2026*",
]

obrat = [
    243474, 224163, 174549, 182086, 204418, 273080,
    282764, 294411, 301987, 290710, 350640, 302432,
    187358, 227117, 330820, 375152, 468269, 416798,
    510273, 647657, 539123, 572950, 831659, 1325676,
    989724, 1024393, 834107, 603823, 520149, 103436,
]

provize = [
    90613, 56931, 45110, 33146, 45139, 47676,
    61788, 70336, 73092, 77060, 60235, 91356,
    60097, 43821, 66976, 78309, 105079, 112908,
    113069, 128258, 158388, 147688, 159732, 256568,
    316452, 252329, 273955, 218212, 124207, 41868,
]

konverze = [
    204, 186, 128, 144, 171, 190,
    255, 271, 197, 222, 312, 240,
    142, 189, 258, 320, 421, 338,
    481, 572, 478, 494, 744, 1057,
    881, 1000, 744, 406, 460, 102,
]

x = np.arange(len(months))

fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(18, 10), facecolor='#f8f8f8')
fig.suptitle('Affiliate program — vývoj leden 2024 – červen 2026', fontsize=15, fontweight='bold', y=0.98)

# Barvy: 2024 šedá, 2025 modrá, 2026 růžová
bar_colors = ['#b0b0b0']*12 + ['#4a90d9']*12 + ['#e05c8a']*5 + ['#e0a0b8']

bars = ax1.bar(x, [o/1000 for o in obrat], color=bar_colors, width=0.6, alpha=0.85, zorder=2)
ax1.plot(x, [o/1000 for o in obrat], color='#333333', linewidth=1.2, marker='o', markersize=3, zorder=3)
ax1_r = ax1.twinx()
ax1_r.plot(x, [p/1000 for p in provize], color='#e8a020', linewidth=2, marker='s', markersize=4, label='Provize (tis. Kč)', zorder=4)
ax1_r.set_ylabel('Provize partnerů (tis. Kč)', color='#e8a020', fontsize=10)
ax1_r.tick_params(axis='y', labelcolor='#e8a020')
ax1_r.yaxis.set_major_formatter(mticker.FuncFormatter(lambda v, _: f'{int(v)} tis.'))

ax1.set_ylabel('Obrat (tis. Kč)', fontsize=10)
ax1.set_xticks(x)
ax1.set_xticklabels(months, fontsize=7.5)
ax1.yaxis.set_major_formatter(mticker.FuncFormatter(lambda v, _: f'{int(v)} tis.'))
ax1.set_title('Obrat a provize partnerů', fontsize=11, fontweight='bold', pad=6)
ax1.grid(axis='y', linestyle='--', alpha=0.4, zorder=1)
ax1.set_facecolor('#f8f8f8')

# Annotate peak
peak_idx = obrat.index(max(obrat))
ax1.annotate(f'Peak\n{max(obrat)/1000:.0f} tis.', xy=(peak_idx, max(obrat)/1000),
             xytext=(peak_idx-2, max(obrat)/1000 * 0.92),
             arrowprops=dict(arrowstyle='->', color='#333'),
             fontsize=8, color='#333')

# Legend for bars
from matplotlib.patches import Patch
legend_elements = [
    Patch(facecolor='#b0b0b0', label='2024'),
    Patch(facecolor='#4a90d9', label='2025'),
    Patch(facecolor='#e05c8a', label='2026'),
]
ax1.legend(handles=legend_elements, loc='upper left', fontsize=9)
ax1_r.legend(loc='upper right', fontsize=9)

# Graf 2: Konverze + Aktivní partneři
aktivni = [9,9,9,8,8,8,8,9,8,8,7,6, 5,5,6,6,7,6,7,6,6,6,6,6, 6,6,6,5,4,3]

bar_colors2 = ['#b0b0b0']*12 + ['#4a90d9']*12 + ['#e05c8a']*5 + ['#e0a0b8']
ax2.bar(x, konverze, color=bar_colors2, width=0.6, alpha=0.85, zorder=2)
ax2.plot(x, konverze, color='#333333', linewidth=1.2, marker='o', markersize=3, zorder=3, label='Konverze')
ax2_r = ax2.twinx()
ax2_r.plot(x, aktivni, color='#27ae60', linewidth=2, marker='^', markersize=5, label='Aktivní partneři', zorder=4)
ax2_r.set_ylabel('Aktivní partneři', color='#27ae60', fontsize=10)
ax2_r.tick_params(axis='y', labelcolor='#27ae60')
ax2_r.set_ylim(0, 15)

ax2.set_ylabel('Konverze (počet)', fontsize=10)
ax2.set_xticks(x)
ax2.set_xticklabels(months, fontsize=7.5)
ax2.set_title('Konverze a počet aktivních partnerů', fontsize=11, fontweight='bold', pad=6)
ax2.grid(axis='y', linestyle='--', alpha=0.4, zorder=1)
ax2.set_facecolor('#f8f8f8')
ax2.legend(loc='upper left', fontsize=9)
ax2_r.legend(loc='upper right', fontsize=9)

ax2.text(len(months)-1, konverze[-1]+20, '*neúplný\nměsíc', fontsize=7, color='#999', ha='center')

# Svislé oddělovače roků
for ax in [ax1, ax2]:
    ax.axvline(x=11.5, color='#aaaaaa', linestyle=':', linewidth=1.2)
    ax.axvline(x=23.5, color='#aaaaaa', linestyle=':', linewidth=1.2)
    ax.text(5.5, ax.get_ylim()[1]*0.97, '2024', ha='center', fontsize=9, color='#888')
    ax.text(17.5, ax.get_ylim()[1]*0.97, '2025', ha='center', fontsize=9, color='#888')
    ax.text(26.5, ax.get_ylim()[1]*0.97, '2026', ha='center', fontsize=9, color='#888')

plt.tight_layout(rect=[0, 0, 1, 0.97])
plt.savefig('/tmp/afil_graf.png', dpi=150, bbox_inches='tight')
print("OK")
