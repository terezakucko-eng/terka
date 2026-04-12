import { useCallback, useEffect, useRef, useState } from 'react'
import Editable from './Editable'
import { defaultCV, type CVData } from './types'

const STORAGE_KEY = 'cv-app::data::v1'
const PHOTO_KEY = 'cv-app::photo::v1'

const boxColorMap: Record<string, { border: string; title: string }> = {
  green: { border: 'border-l-emerald-500', title: 'text-emerald-700' },
  amber: { border: 'border-l-amber-500', title: 'text-amber-700' },
  red: { border: 'border-l-rose-500', title: 'text-rose-700' },
  teal: { border: 'border-l-teal-500', title: 'text-teal-700' },
  pink: { border: 'border-l-pink-500', title: 'text-pink-700' },
  indigo: { border: 'border-l-indigo-500', title: 'text-indigo-700' },
}

function loadCV(): CVData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return defaultCV
    const parsed = JSON.parse(raw) as Partial<CVData>
    // shallow merge with defaults so added fields get sensible values
    return { ...defaultCV, ...parsed }
  } catch {
    return defaultCV
  }
}

export default function App() {
  const [cv, setCv] = useState<CVData>(() => loadCV())
  const [photo, setPhoto] = useState<string | null>(() => localStorage.getItem(PHOTO_KEY))
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cv))
  }, [cv])

  useEffect(() => {
    if (photo) localStorage.setItem(PHOTO_KEY, photo)
    else localStorage.removeItem(PHOTO_KEY)
  }, [photo])

  const patch = useCallback(<K extends keyof CVData>(key: K, value: CVData[K]) => {
    setCv((prev) => ({ ...prev, [key]: value }))
  }, [])

  const handlePhotoUpload = (file: File) => {
    if (!file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') setPhoto(reader.result)
    }
    reader.readAsDataURL(file)
  }

  const resetAll = () => {
    if (!confirm('Opravdu resetovat CV na výchozí hodnoty? Přijdete o všechny úpravy.')) return
    setCv(defaultCV)
    setPhoto(null)
  }

  return (
    <div className="min-h-screen bg-neutral-100 pb-20 text-neutral-800 print:bg-white print:pb-0">
      {/* Toolbar */}
      <div className="no-print sticky top-0 z-40 border-b border-neutral-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-[900px] flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div>
            <h1 className="font-serif text-xl font-semibold text-neutral-900">
              Editovatelná šablona CV
            </h1>
            <p className="text-xs text-neutral-500">
              Klikněte na libovolný text a upravte ho. Změny se automaticky ukládají do tohoto prohlížeče.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 shadow-sm hover:bg-neutral-50"
            >
              {photo ? 'Změnit foto' : 'Nahrát foto'}
            </button>
            {photo && (
              <button
                type="button"
                onClick={() => setPhoto(null)}
                className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 shadow-sm hover:bg-neutral-50"
              >
                Odstranit foto
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) handlePhotoUpload(f)
                e.target.value = ''
              }}
            />
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-neutral-700"
            >
              Uložit jako PDF
            </button>
            <button
              type="button"
              onClick={resetAll}
              className="rounded-md border border-rose-200 bg-white px-3 py-1.5 text-sm font-medium text-rose-600 shadow-sm hover:bg-rose-50"
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      {/* Page */}
      <main className="mx-auto mt-6 w-full max-w-[900px] print:mt-0 print:max-w-none">
        <article className="cv-page bg-white shadow-[0_4px_24px_-8px_rgba(0,0,0,0.15)] print:shadow-none">
          {/* Header */}
          <header className="flex items-start justify-between gap-6 border-b border-neutral-200 px-10 pt-10 pb-6">
            <div className="min-w-0 flex-1">
              <Editable
                as="h1"
                value={cv.name}
                onChange={(v) => patch('name', v)}
                className="font-serif text-4xl leading-tight font-bold tracking-tight text-neutral-900"
              />
              <Editable
                as="p"
                value={cv.tagline}
                onChange={(v) => patch('tagline', v)}
                className="mt-2 text-[15px] text-neutral-600"
              />
            </div>
            <div className="flex items-start gap-5">
              <div className="text-right text-[13px] leading-relaxed text-neutral-600">
                <div>
                  <Editable
                    value={cv.email}
                    onChange={(v) => patch('email', v)}
                    className="font-medium text-neutral-800"
                  />
                </div>
                <div>
                  <Editable value={cv.phone} onChange={(v) => patch('phone', v)} />
                  {' · '}
                  <Editable value={cv.location} onChange={(v) => patch('location', v)} />
                </div>
              </div>
              <PhotoSlot photo={photo} onClick={() => fileInputRef.current?.click()} />
            </div>
          </header>

          {/* Fact strip */}
          <section className="grid grid-cols-5 gap-3 border-b border-neutral-200 px-10 py-4 text-[12px] text-neutral-600 print:text-[11px]">
            {cv.facts.map((f, i) => (
              <Editable
                key={i}
                value={f}
                onChange={(v) => {
                  const next = [...cv.facts]
                  next[i] = v
                  patch('facts', next)
                }}
                className="leading-snug"
              />
            ))}
          </section>

          {/* Body */}
          <div className="grid grid-cols-[32%_68%]">
            {/* Sidebar */}
            <aside className="space-y-7 border-r border-neutral-200 px-8 py-8 text-[13px] leading-relaxed text-neutral-700">
              <SidebarSection title="Vzdělání">
                <div className="space-y-4">
                  {cv.education.map((e, i) => (
                    <div key={i}>
                      <Editable
                        as="div"
                        value={e.title}
                        onChange={(v) => {
                          const next = [...cv.education]
                          next[i] = { ...next[i], title: v }
                          patch('education', next)
                        }}
                        className="font-semibold text-neutral-900"
                      />
                      <Editable
                        as="div"
                        value={e.school}
                        onChange={(v) => {
                          const next = [...cv.education]
                          next[i] = { ...next[i], school: v }
                          patch('education', next)
                        }}
                        className="text-neutral-600"
                      />
                      {e.period && (
                        <Editable
                          as="div"
                          value={e.period}
                          onChange={(v) => {
                            const next = [...cv.education]
                            next[i] = { ...next[i], period: v }
                            patch('education', next)
                          }}
                          className="text-xs text-neutral-500"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </SidebarSection>

              <SidebarSection title="Klíčové dovednosti">
                <ul className="list-disc space-y-1.5 pl-5 marker:text-teal-500">
                  {cv.skills.map((s, i) => (
                    <li key={i}>
                      <Editable
                        value={s}
                        onChange={(v) => {
                          const next = [...cv.skills]
                          next[i] = v
                          patch('skills', next)
                        }}
                      />
                    </li>
                  ))}
                </ul>
              </SidebarSection>

              <SidebarSection title="Nástroje">
                <div className="space-y-2.5">
                  {cv.tools.map((group, i) => (
                    <Editable
                      key={i}
                      as="div"
                      value={group.join(' · ')}
                      onChange={(v) => {
                        const next = [...cv.tools]
                        next[i] = v.split('·').map((x) => x.trim()).filter(Boolean)
                        patch('tools', next)
                      }}
                      className="leading-snug"
                    />
                  ))}
                </div>
              </SidebarSection>

              <SidebarSection title="Jazyky & trhy">
                <ul className="list-disc space-y-1 pl-5 marker:text-teal-500">
                  {cv.languages.map((l, i) => (
                    <li key={i}>
                      <Editable
                        value={l}
                        onChange={(v) => {
                          const next = [...cv.languages]
                          next[i] = v
                          patch('languages', next)
                        }}
                      />
                    </li>
                  ))}
                </ul>
              </SidebarSection>

              <SidebarSection title="Osobnost">
                {cv.personality.map((p, i) => (
                  <Editable
                    key={i}
                    as="div"
                    value={p}
                    onChange={(v) => {
                      const next = [...cv.personality]
                      next[i] = v
                      patch('personality', next)
                    }}
                    className="font-semibold text-neutral-900"
                  />
                ))}
              </SidebarSection>

              <SidebarSection title="Gallup CliftonStrengths TOP 5">
                <ol className="list-decimal space-y-1 pl-5 marker:font-semibold marker:text-teal-600">
                  {cv.gallup.map((g, i) => (
                    <li key={i}>
                      <Editable
                        value={g}
                        onChange={(v) => {
                          const next = [...cv.gallup]
                          next[i] = v
                          patch('gallup', next)
                        }}
                      />
                    </li>
                  ))}
                </ol>
              </SidebarSection>
            </aside>

            {/* Main column */}
            <section className="space-y-7 px-9 py-8 text-[13.5px] leading-relaxed text-neutral-800">
              <div>
                <Editable
                  as="h2"
                  value={cv.philosophyTitle}
                  onChange={(v) => patch('philosophyTitle', v)}
                  className="mb-2 text-[11px] font-semibold tracking-[0.18em] text-teal-700 uppercase"
                />
                <Editable
                  as="p"
                  value={cv.philosophyText}
                  onChange={(v) => patch('philosophyText', v)}
                  multiline
                  className="whitespace-pre-wrap"
                />
              </div>

              {cv.experience.map((job, i) => (
                <article key={i} className="space-y-2.5">
                  <div className="flex items-baseline justify-between gap-4 border-b border-neutral-200 pb-1.5">
                    <div className="text-[11px] font-semibold tracking-[0.18em] text-teal-700 uppercase">
                      <Editable
                        value={job.role}
                        onChange={(v) => {
                          const next = [...cv.experience]
                          next[i] = { ...next[i], role: v }
                          patch('experience', next)
                        }}
                      />
                      {' — '}
                      <Editable
                        value={job.company}
                        onChange={(v) => {
                          const next = [...cv.experience]
                          next[i] = { ...next[i], company: v }
                          patch('experience', next)
                        }}
                      />
                    </div>
                    <Editable
                      value={job.period}
                      onChange={(v) => {
                        const next = [...cv.experience]
                        next[i] = { ...next[i], period: v }
                        patch('experience', next)
                      }}
                      className="text-[11px] font-medium tracking-wider text-neutral-500 uppercase"
                    />
                  </div>
                  {job.description && (
                    <Editable
                      as="p"
                      value={job.description}
                      onChange={(v) => {
                        const next = [...cv.experience]
                        next[i] = { ...next[i], description: v }
                        patch('experience', next)
                      }}
                      className="text-[12.5px] italic text-neutral-500"
                    />
                  )}
                  <ul className="space-y-1.5">
                    {job.bullets.map((b, j) => (
                      <li key={j} className="flex gap-3">
                        <span className="mt-[0.55em] inline-block h-[3px] w-3 shrink-0 bg-neutral-400" />
                        <div>
                          {b.label && (
                            <>
                              <Editable
                                value={b.label}
                                onChange={(v) => {
                                  const next = [...cv.experience]
                                  const bullets = [...next[i].bullets]
                                  bullets[j] = { ...bullets[j], label: v }
                                  next[i] = { ...next[i], bullets }
                                  patch('experience', next)
                                }}
                                className="font-semibold text-neutral-900"
                              />
                              {': '}
                            </>
                          )}
                          <Editable
                            value={b.text}
                            onChange={(v) => {
                              const next = [...cv.experience]
                              const bullets = [...next[i].bullets]
                              bullets[j] = { ...bullets[j], text: v }
                              next[i] = { ...next[i], bullets }
                              patch('experience', next)
                            }}
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}

              <div>
                <h2 className="mb-2 border-b border-neutral-200 pb-1.5 text-[11px] font-semibold tracking-[0.18em] text-teal-700 uppercase">
                  Dřívější zkušenosti
                </h2>
                <div className="space-y-3">
                  {cv.earlier.map((e, i) => (
                    <div key={i} className="flex items-baseline justify-between gap-4">
                      <div className="min-w-0">
                        <Editable
                          as="div"
                          value={e.role}
                          onChange={(v) => {
                            const next = [...cv.earlier]
                            next[i] = { ...next[i], role: v }
                            patch('earlier', next)
                          }}
                          className="font-semibold text-neutral-900"
                        />
                        <Editable
                          as="div"
                          value={e.note}
                          onChange={(v) => {
                            const next = [...cv.earlier]
                            next[i] = { ...next[i], note: v }
                            patch('earlier', next)
                          }}
                          className="text-[12.5px] italic text-neutral-500"
                        />
                      </div>
                      <Editable
                        value={e.period}
                        onChange={(v) => {
                          const next = [...cv.earlier]
                          next[i] = { ...next[i], period: v }
                          patch('earlier', next)
                        }}
                        className="shrink-0 text-[11px] font-medium tracking-wider text-neutral-500 uppercase"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h2 className="mb-2 border-b border-neutral-200 pb-1.5 text-[11px] font-semibold tracking-[0.18em] text-teal-700 uppercase">
                  Spolupráce
                </h2>
                <ul className="space-y-1.5">
                  {cv.collaborations.map((c, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="mt-[0.55em] inline-block h-[3px] w-3 shrink-0 bg-neutral-400" />
                      <Editable
                        value={c}
                        onChange={(v) => {
                          const next = [...cv.collaborations]
                          next[i] = v
                          patch('collaborations', next)
                        }}
                      />
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h2 className="mb-3 text-[11px] font-semibold tracking-[0.18em] text-teal-700 uppercase">
                  Co ode mě čekat · co nečekat
                </h2>
                <div className="grid grid-cols-2 gap-4">
                  <YesNoBox
                    title="Ano"
                    color="emerald"
                    items={cv.yes}
                    onChange={(items) => patch('yes', items)}
                  />
                  <YesNoBox
                    title="Ne"
                    color="rose"
                    items={cv.no}
                    onChange={(items) => patch('no', items)}
                  />
                </div>
              </div>

              <div>
                <h2 className="mb-3 text-[11px] font-semibold tracking-[0.18em] text-teal-700 uppercase">
                  Trochu víc o mně
                </h2>
                <div className="grid grid-cols-3 gap-4">
                  {cv.aboutBoxes.map((box, i) => {
                    const c = boxColorMap[box.color] ?? boxColorMap.teal
                    return (
                      <div
                        key={i}
                        className={`rounded-sm border-l-2 ${c.border} bg-neutral-50/60 px-3 py-3`}
                      >
                        <Editable
                          as="div"
                          value={box.title}
                          onChange={(v) => {
                            const next = [...cv.aboutBoxes]
                            next[i] = { ...next[i], title: v }
                            patch('aboutBoxes', next)
                          }}
                          className={`mb-2 text-[11px] font-semibold tracking-[0.14em] uppercase ${c.title}`}
                        />
                        <ul className="space-y-1 text-[12.5px] leading-snug">
                          {box.items.map((item, j) => (
                            <li key={j} className="flex gap-2">
                              <span className="mt-[0.55em] inline-block h-1 w-1 shrink-0 rounded-full bg-neutral-500" />
                              <Editable
                                value={item}
                                onChange={(v) => {
                                  const next = [...cv.aboutBoxes]
                                  const items = [...next[i].items]
                                  items[j] = v
                                  next[i] = { ...next[i], items }
                                  patch('aboutBoxes', next)
                                }}
                              />
                            </li>
                          ))}
                        </ul>
                      </div>
                    )
                  })}
                </div>
              </div>
            </section>
          </div>
        </article>
      </main>
    </div>
  )
}

function SidebarSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-3 text-[11px] font-semibold tracking-[0.2em] text-teal-700 uppercase">
        {title}
      </h3>
      {children}
    </div>
  )
}

function PhotoSlot({ photo, onClick }: { photo: string | null; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative h-24 w-24 shrink-0 overflow-hidden rounded-sm border border-neutral-200 bg-neutral-100 print:border-neutral-300"
      aria-label="Nahrát foto"
    >
      {photo ? (
        <img src={photo} alt="Foto" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center text-[10px] font-medium tracking-wider text-neutral-400 uppercase">
          <span>Foto</span>
        </div>
      )}
      <span className="no-print absolute inset-0 flex items-center justify-center bg-black/0 text-[10px] font-semibold tracking-wider text-white uppercase opacity-0 transition group-hover:bg-black/55 group-hover:opacity-100">
        {photo ? 'Změnit' : 'Nahrát'}
      </span>
    </button>
  )
}

function YesNoBox({
  title,
  color,
  items,
  onChange,
}: {
  title: string
  color: 'emerald' | 'rose'
  items: string[]
  onChange: (next: string[]) => void
}) {
  const border = color === 'emerald' ? 'border-l-emerald-500' : 'border-l-rose-500'
  const heading = color === 'emerald' ? 'text-emerald-700' : 'text-rose-700'
  const marker = color === 'emerald' ? 'bg-emerald-500' : 'bg-rose-500'
  return (
    <div className={`rounded-sm border-l-2 ${border} bg-neutral-50/60 px-3 py-3`}>
      <h3 className={`mb-2 text-[11px] font-semibold tracking-[0.14em] uppercase ${heading}`}>
        {title}
      </h3>
      <ul className="space-y-1 text-[12.5px] leading-snug">
        {items.map((it, i) => (
          <li key={i} className="flex gap-2">
            <span className={`mt-[0.55em] inline-block h-1 w-1 shrink-0 rounded-full ${marker}`} />
            <Editable
              value={it}
              onChange={(v) => {
                const next = [...items]
                next[i] = v
                onChange(next)
              }}
            />
          </li>
        ))}
      </ul>
    </div>
  )
}
