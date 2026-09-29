"use client";

import { useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { finishTourAction, tourPreferencesAction } from "@/app/actions/onboarding";
import { CardSave } from "./card-save";
import { PushToggle } from "./push-toggle";
import { cx } from "./ui";

type Props = { firstName: string; publicKey: string; marketing: boolean; reminders: boolean };

/**
 * Short tour after the first sign-in (also for clients moved from the old
 * system): member card on the phone, notifications, newsletter & reminders.
 * Every step can be skipped; finishing or closing hides it for good.
 */
export function WelcomeTour({ firstName, publicKey, marketing, reminders }: Props) {
  const [open, setOpen] = useState(true);
  const [step, setStep] = useState(0);
  const [prefs, setPrefs] = useState({ marketing, reminders });
  if (!open) return null;

  const close = () => {
    setOpen(false);
    void finishTourAction();
  };
  const next = () => setStep((s) => s + 1);

  const steps = [
    {
      title: `Vítej, ${firstName}!`,
      body: (
        <p>
          Tady je tvůj účet v OCTOPUSH – rezervace lekcí a masáží, permanentky, kredit i platby na jednom místě. Za minutku ti
          ukážeme tři věci, které se hodí mít nastavené.
        </p>
      ),
    },
    {
      title: "1. Členská karta v mobilu",
      body: (
        <>
          <p className="mb-4">Na recepci pak stačí ukázat QR kód. A když si web přidáš na plochu, budeš mít rozvrh jedním klepnutím.</p>
          <CardSave embedded />
        </>
      ),
    },
    {
      title: "2. Upozornění do telefonu",
      body: (
        <>
          <p className="mb-4">Dáme ti vědět, když se uvolní místo z pořadníku, když se lekce ruší, a připomeneme lekci před začátkem.</p>
          <PushToggle publicKey={publicKey} />
        </>
      ),
    },
    {
      title: "3. Novinky a připomínky e-mailem",
      body: (
        <div className="space-y-3">
          <label className="flex gap-3">
            <input
              type="checkbox"
              checked={prefs.marketing}
              onChange={(e) => setPrefs((p) => ({ ...p, marketing: e.target.checked }))}
              className="mt-1 accent-[#674329]"
            />
            <span>
              <strong>Newsletter</strong> – nové lekce, workshopy a akce se dozvíš jako první. <span className="text-les/60">(doporučujeme)</span>
            </span>
          </label>
          <label className="flex gap-3">
            <input
              type="checkbox"
              checked={prefs.reminders}
              onChange={(e) => setPrefs((p) => ({ ...p, reminders: e.target.checked }))}
              className="mt-1 accent-[#674329]"
            />
            <span><strong>Připomínka</strong> lekce nebo masáže 3 hodiny předem</span>
          </label>
          <p className="text-xs text-les/50">Změnit to můžeš kdykoliv v profilu. Potvrzení rezervací a změny lekcí ti chodí vždy.</p>
        </div>
      ),
      onNext: () => void tourPreferencesAction(prefs),
    },
    {
      title: "Hotovo, můžeš vyrazit 🐙",
      body: <p>Vyber si lekci v rozvrhu. Všechno z průvodce najdeš i později v profilu a u členské karty.</p>,
    },
  ];
  const s = steps[step];
  const last = step === steps.length - 1;

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-les/60 p-4 backdrop-blur-sm sm:items-center" role="dialog" aria-modal="true" aria-label="Úvodní průvodce">
      <div className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-3xl bg-papir p-7 shadow-2xl">
        <button type="button" onClick={close} aria-label="Zavřít průvodce" className="absolute right-4 top-4 text-les/50 hover:text-les">
          <X className="size-5" />
        </button>
        <div className="mb-5 flex gap-1.5" aria-hidden>
          {steps.map((_, i) => (
            <span key={i} className={cx("h-1 flex-1 rounded-full", i <= step ? "bg-zlato" : "bg-linka/60")} />
          ))}
        </div>
        <h2 className="pr-6 text-2xl font-semibold tracking-tight">{s.title}</h2>
        <div className="mt-4 text-sm leading-relaxed text-les/80">{s.body}</div>
        <div className="mt-7 flex items-center justify-between gap-3">
          {last ? (
            <>
              <button type="button" onClick={close} className="text-xs text-les/60 underline">Zavřít</button>
              <Link href="/rozvrh" onClick={close} className="rounded-full bg-les px-5 py-3 text-xs font-semibold uppercase tracking-wider text-papir">
                Vybrat lekci
              </Link>
            </>
          ) : (
            <>
              <button type="button" onClick={step === 0 ? close : next} className="text-xs text-les/60 underline">
                {step === 0 ? "Teď ne" : "Přeskočit"}
              </button>
              <button
                type="button"
                onClick={() => {
                  s.onNext?.();
                  next();
                }}
                className="rounded-full bg-les px-5 py-3 text-xs font-semibold uppercase tracking-wider text-papir"
              >
                {step === 0 ? "Jdeme na to" : "Pokračovat"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
