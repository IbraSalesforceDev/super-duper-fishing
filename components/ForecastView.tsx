"use client";

import { useEffect, useMemo, useState } from "react";
import type { DayForecast, ForecastResponse, HourScore } from "@/lib/types";
import { madridTime, HOUR, MINUTE } from "@/lib/time";
import { tideAt } from "@/lib/tides";
import { speciesForDay } from "@/lib/species";
import TideChart from "./TideChart";

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

/** Panel con el estado de la marea en este momento y la próxima marea. */
function NowPanel({ data }: { data: ForecastResponse }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const extremes = useMemo(
    () => data.days.flatMap((d) => d.extremes),
    [data]
  );
  const next = extremes.find((e) => e.time > now);
  if (!next || extremes.length === 0) return null;

  const { height, rate } = tideAt(extremes, now);
  const mins = Math.max(0, Math.round((next.time - now) / 60_000));
  const hh = Math.floor(mins / 60);
  const mm = mins % 60;
  const dir =
    Math.abs(rate) < 0.05 ? "parada" : rate > 0 ? "subiendo" : "bajando";
  const dirIcon = Math.abs(rate) < 0.05 ? "⏸" : rate > 0 ? "⬆" : "⬇";

  const today = data.days[0];
  const hourNow = today?.hours.find(
    (h) => now >= h.time && now < h.time + HOUR
  );

  return (
    <div className="rounded-xl border border-sea-600/50 bg-gradient-to-r from-sea-800/80 to-sea-900/60 px-4 py-3 flex flex-wrap items-center gap-x-5 gap-y-1.5">
      <span className="text-xs uppercase tracking-wide text-sea-300 w-full sm:w-auto">
        Ahora mismo
      </span>
      <span className="text-sm font-semibold">
        🌊 {height.toFixed(2)} m{" "}
        <span className={rate > 0 ? "text-emerald-300" : "text-sea-300"}>
          {dirIcon} {dir}
        </span>
      </span>
      <span className="text-sm">
        {next.type === "pleamar" ? "⬆ Pleamar" : "⬇ Bajamar"} a las{" "}
        <strong>{madridTime(next.time)}</strong>{" "}
        <span className="text-sea-300">
          (en {hh > 0 ? `${hh} h ` : ""}
          {mm} min)
        </span>
      </span>
      {hourNow && (
        <span
          className="text-sm font-semibold"
          style={{ color: scoreColor(hourNow.score) }}
        >
          ● nota actual {hourNow.score}/100
        </span>
      )}
    </div>
  );
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
              })${h.flags.synergy ? " · ventana premium (solunar + luz)" : ""}`}
            />
            <div className="mt-1 text-[9px] text-sea-300/70 flex flex-col items-center leading-none">
              {hour % 3 === 0 ? <span>{String(hour).padStart(2, "0")}</span> : <span>&nbsp;</span>}
              <span className="h-2">
                {h.flags.synergy
                  ? "⭐"
                  : h.flags.sunrise
                  ? "🌅"
                  : h.flags.sunset
                  ? "🌇"
                  : h.flags.major
                  ? "🌙"
                  : ""}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SessionPlan({ day }: { day: DayForecast }) {
  const w = day.windows[0];
  const best = [...day.hours].sort((a, b) => b.score - a.score)[0];
  if (!w && !best) return null;

  // Sin ventana destacada: plan ligero en torno a la mejor hora.
  if (!w) {
    return (
      <div className="rounded-xl border border-sea-700/50 bg-sea-800/30 p-3">
        <h4 className="text-xs uppercase tracking-wide text-sea-300 mb-1">
          🎒 Plan de sesión
        </h4>
        <p className="text-sm text-sea-200">
          Día sin ventana destacada. Prueba en torno a las{" "}
          <strong>{madridTime(best.time)}</strong> (nota {best.score}/100).
        </p>
      </div>
    );
  }

  const arrival = w.start - 45 * MINUTE;
  const peakHour = day.hours.find((h) => h.time === w.peak);
  const tideState = peakHour
    ? peakHour.tideRate > 0.03
      ? `subiendo ⬆ ${peakHour.tideHeight} m`
      : peakHour.tideRate < -0.03
      ? `bajando ⬇ ${peakHour.tideHeight} m`
      : `parada ${peakHour.tideHeight} m`
    : "";

  const steps = [
    { i: "🚗", t: `Llega sobre las ${madridTime(arrival)}`, s: "monta antes de la ventana" },
    { i: "🎯", t: `Mejor momento ${madridTime(w.peak)}`, s: `marea ${tideState} · nota ${w.score}/100` },
    { i: "🎣", t: `Pesca activa ${madridTime(w.start)}–${madridTime(w.end)}`, s: "" },
    { i: "🏁", t: `Recoge a partir de ${madridTime(w.end)}`, s: "" },
  ];

  return (
    <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 p-3">
      <h4 className="text-xs uppercase tracking-wide text-emerald-300/90 mb-2">
        🎒 Plan de sesión
      </h4>
      <ol className="space-y-1.5">
        {steps.map((st) => (
          <li key={st.t} className="flex items-start gap-2 text-sm">
            <span>{st.i}</span>
            <span>
              <span className="font-medium">{st.t}</span>
              {st.s && <span className="text-sea-300"> · {st.s}</span>}
            </span>
          </li>
        ))}
      </ol>
      {day.windows.length > 1 && (
        <p className="mt-2 text-xs text-sea-400">
          Otra ventana: {madridTime(day.windows[1].start)}–
          {madridTime(day.windows[1].end)} ({day.windows[1].score}/100).
        </p>
      )}
    </div>
  );
}

function SpeciesPanel({ day }: { day: DayForecast }) {
  const [sel, setSel] = useState<string | null>(null);
  const month = Number(day.date.split("-")[1]);
  const best = [...day.hours].sort((a, b) => b.score - a.score)[0];
  const picks = speciesForDay({
    month,
    coefficient: day.coefficient,
    nightBest: best?.flags.night ?? false,
    risingBest: (best?.tideRate ?? 0) > 0,
  });
  if (picks.length === 0) return null;
  const selected = picks.find((p) => p.name === sel) ?? picks[0];

  return (
    <div>
      <h4 className="text-xs uppercase tracking-wide text-sea-300 mb-1">
        🐟 Especies de temporada{" "}
        <span className="text-sea-500 normal-case">(toca para ver consejo)</span>
      </h4>
      <ul className="flex flex-wrap gap-2">
        {picks.map((s) => {
          const active = s.name === selected.name;
          return (
            <li key={s.name}>
              <button
                onClick={() => setSel(s.name)}
                className={`px-2.5 py-1 rounded-lg text-sm border transition ${
                  active
                    ? "bg-sea-700 border-sea-400"
                    : s.fitsToday
                    ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-200"
                    : "bg-sea-800/50 border-sea-700/60"
                }`}
              >
                {s.emoji} {s.name}
                {s.fitsToday && <span title="Encaja con las condiciones de hoy"> ⭐</span>}
              </button>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-xs text-sea-300">
        <strong>{selected.emoji} {selected.name}.</strong> {selected.note}
        {selected.fitsToday && (
          <span className="text-emerald-300"> · ⭐ buen día para ella.</span>
        )}
      </p>
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
          <span className="text-sm text-sea-200" title="Coeficiente de marea">
            coef. {day.coefficient}
          </span>
        )}
        <span className="text-sm text-sea-300">
          {day.sunrise && `🌅 ${madridTime(day.sunrise)}`}{" "}
          {day.sunset && `· 🌇 ${madridTime(day.sunset)}`}
        </span>
        {day.marine && (
          <span className="text-sm text-sea-300">
            {day.marine.waveMax != null && (
              <span title="Altura de ola máxima del día">
                🌊 máx {day.marine.waveMax.toFixed(1)} m{" "}
              </span>
            )}
            {day.marine.windMax != null && (
              <span title="Viento máximo del día">
                💨 máx {day.marine.windMax} km/h
              </span>
            )}
          </span>
        )}
      </div>

      <div>
        <h4 className="text-xs uppercase tracking-wide text-sea-300 mb-1">
          Curva de marea
        </h4>
        <div className="rounded-lg bg-sea-950/60 border border-sea-800/80 p-1">
          <TideChart day={day} />
        </div>
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
                className="px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-sm"
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

      <SessionPlan day={day} />

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
              {e.coefficient != null && (
                <span className="ml-1 text-sea-300" title="Coeficiente de marea">
                  · coef. {e.coefficient}
                </span>
              )}
            </span>
          ))}
        </div>
      </div>

      <div>
        <h4 className="text-xs uppercase tracking-wide text-sea-300 mb-2">
          Puntuación por horas
        </h4>
        <HourBars hours={day.hours} />
        <p className="mt-2 text-[10px] text-sea-400">
          ⭐ ventana premium (solunar + luz) · 🌅 amanecer · 🌇 atardecer · 🌙 periodo solunar mayor
        </p>
      </div>

      <SpeciesPanel day={day} />
    </div>
  );
}

export default function ForecastView({ data }: { data: ForecastResponse }) {
  const [selected, setSelected] = useState(0);
  const day = data.days[selected];

  return (
    <div className="space-y-4 min-w-0">
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

      <NowPanel data={data} />

      <div className="grid grid-flow-col auto-cols-[minmax(7rem,1fr)] gap-2 overflow-x-auto pb-1">
        {data.days.map((d, i) => (
          <button
            key={d.date}
            onClick={() => setSelected(i)}
            className={`rounded-xl border p-3 text-left transition ${
              i === selected
                ? "border-sea-300 bg-sea-800/80 shadow-lg shadow-sea-950/50"
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
            <div className="text-xs text-sea-300 mt-0.5">
              {d.moonPhase.emoji} {d.rating}
              {d.coefficient != null && (
                <span className="text-sea-400"> · c{d.coefficient}</span>
              )}
            </div>
          </button>
        ))}
      </div>

      {day && <DayDetail day={day} />}
    </div>
  );
}
