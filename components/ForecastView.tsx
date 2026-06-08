"use client";

import { useState } from "react";
import type { DayForecast, ForecastResponse, HourScore } from "@/lib/types";
import { madridTime } from "@/lib/time";

const RATING_STYLE: Record<DayForecast["rating"], string> = {
  excelente: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
  buena: "bg-sea-300/20 text-sea-200 border-sea-300/40",
  regular: "bg-amber-500/20 text-amber-300 border-amber-500/40",
  floja: "bg-slate-500/20 text-slate-300 border-slate-500/40",
};

function scoreColor(s: number): string {
  if (s >= 70) return "#34d399";
  if (s >= 55) return "#73bdd9";
  if (s >= 40) return "#fbbf24";
  return "#64748b";
}

function dayLabel(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  return new Intl.DateTimeFormat("es-ES", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(dt);
}

function HourBars({ hours }: { hours: HourScore[] }) {
  return (
    <div className="flex items-end gap-[3px] h-28">
      {hours.map((h) => {
        const hour = Number(madridTime(h.time).slice(0, 2));
        return (
          <div key={h.time} className="flex-1 flex flex-col items-center group">
            <div
              className="w-full rounded-t transition-opacity"
              style={{
                height: `${Math.max(4, h.score)}%`,
                backgroundColor: scoreColor(h.score),
                opacity: h.flags.major ? 1 : 0.78,
              }}
              title={`${madridTime(h.time)} · ${h.score}/100 · marea ${h.tideHeight} m (${
                h.tideRate >= 0 ? "subiendo" : "bajando"
              })`}
            />
            <div className="mt-1 text-[9px] text-sea-300/70 flex flex-col items-center leading-none">
              {hour % 3 === 0 ? <span>{String(hour).padStart(2, "0")}</span> : <span>&nbsp;</span>}
              <span className="h-2">
                {h.flags.sunrise ? "🌅" : h.flags.sunset ? "🌇" : h.flags.major ? "🌙" : ""}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DayDetail({ day }: { day: DayForecast }) {
  return (
    <div className="rounded-xl border border-sea-700/60 bg-sea-900/60 p-4 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-lg font-semibold capitalize">{dayLabel(day.date)}</span>
        <span className={`px-2 py-0.5 rounded-full text-xs border ${RATING_STYLE[day.rating]}`}>
          {day.rating} · {day.score}/100
        </span>
        <span className="text-sm text-sea-200" title="Fase lunar">
          {day.moonPhase.emoji} {day.moonPhase.name}
        </span>
        {day.coefficient != null && (
          <span className="text-sm text-sea-200" title="Coeficiente de marea estimado">
            coef. ≈ {day.coefficient}
          </span>
        )}
        <span className="text-sm text-sea-300">
          {day.sunrise && `🌅 ${madridTime(day.sunrise)}`}{" "}
          {day.sunset && `· 🌇 ${madridTime(day.sunset)}`}
        </span>
      </div>

      {day.windows.length > 0 && (
        <div>
          <h4 className="text-xs uppercase tracking-wide text-sea-300 mb-1">
            Mejores ventanas
          </h4>
          <ul className="flex flex-wrap gap-2">
            {day.windows.slice(0, 3).map((w) => (
              <li
                key={w.start}
                className="px-3 py-1.5 rounded-lg bg-sea-800/70 border border-sea-700 text-sm"
              >
                <span className="font-medium">
                  {madridTime(w.start)}–{madridTime(w.end)}
                </span>
                <span className="text-sea-300"> · pico {madridTime(w.peak)} · {w.score}/100</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <h4 className="text-xs uppercase tracking-wide text-sea-300 mb-1">
          Mareas del día
        </h4>
        <div className="flex flex-wrap gap-2 text-sm">
          {day.extremes.map((e) => (
            <span
              key={e.time}
              className="px-2.5 py-1 rounded-lg bg-sea-800/50 border border-sea-700/60"
            >
              {e.type === "pleamar" ? "⬆ Pleamar" : "⬇ Bajamar"} {madridTime(e.time)} ·{" "}
              {e.height.toFixed(2)} m
            </span>
          ))}
        </div>
      </div>

      <div>
        <h4 className="text-xs uppercase tracking-wide text-sea-300 mb-2">
          Puntuación por horas
        </h4>
        <HourBars hours={day.hours} />
      </div>
    </div>
  );
}

export default function ForecastView({ data }: { data: ForecastResponse }) {
  const [selected, setSelected] = useState(0);
  const day = data.days[selected];

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <h2 className="text-xl font-semibold">
          {data.station.name}{" "}
          <span className="text-sm font-normal text-sea-300">
            ({data.station.province})
          </span>
        </h2>
        <span className="text-xs text-sea-400">
          Mareas: IHM · Solunar: cálculo propio · Meteo: Open-Meteo
        </span>
      </div>

      {data.warnings.map((w) => (
        <p key={w} className="text-xs text-amber-300/90 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
          ⚠ {w}
        </p>
      ))}

      <div className="grid grid-flow-col auto-cols-[minmax(7rem,1fr)] gap-2 overflow-x-auto pb-1">
        {data.days.map((d, i) => (
          <button
            key={d.date}
            onClick={() => setSelected(i)}
            className={`rounded-xl border p-3 text-left transition ${
              i === selected
                ? "border-sea-300 bg-sea-800/80"
                : "border-sea-700/60 bg-sea-900/50 hover:bg-sea-800/50"
            }`}
          >
            <div className="text-sm font-medium capitalize">{dayLabel(d.date)}</div>
            <div className="mt-1 flex items-center gap-1">
              <span
                className="inline-block w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: scoreColor(d.score) }}
              />
              <span className="text-lg font-bold">{d.score}</span>
              <span className="text-xs text-sea-300">/100</span>
            </div>
            <div className="text-xs text-sea-300 mt-0.5">{d.moonPhase.emoji} {d.rating}</div>
          </button>
        ))}
      </div>

      {day && <DayDetail day={day} />}
    </div>
  );
}
