import { useEffect, useState } from 'react'

export type ThemePref = 'auto' | 'light' | 'dark'

const KEY = 'publikacni-plan-motiv'

function read(): ThemePref {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'light' || v === 'dark' ? v : 'auto'
  } catch {
    return 'auto'
  }
}

/** Light, dark or follow the system; remembered per browser. */
export function useTheme(): [ThemePref, (t: ThemePref) => void] {
  const [pref, setPref] = useState<ThemePref>(read)
  useEffect(() => {
    const el = document.documentElement
    if (pref === 'auto') delete el.dataset.theme
    else el.dataset.theme = pref
    try {
      localStorage.setItem(KEY, pref)
    } catch {
      // storage blocked: the choice lasts for this visit
    }
  }, [pref])
  return [pref, setPref]
}
