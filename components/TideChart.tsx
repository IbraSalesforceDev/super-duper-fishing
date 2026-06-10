"use client";

import { useMemo } from "react";
import type { DayForecast } from "@/lib/types";
import { madridTime, HOUR } from "@/lib/time";

// Curva de marea del día en SVG: onda interpolada a partir de las alturas
// horarias + extremos, con sombreado nocturno, ventanas de pesca, marcadores
// de pleamar/bajamar y línea de "ahora" si el día es hoy.

const W = 720;
const H = 210;
const PAD_T = 30;
const PAD_B = 24;
const PAD_X = 10;

type Pt = [number, number];

/** Path suave (Catmull-Rom → Bézier) por los puntos dados. */
function smoothPath(pts: Pt[]): string {
  if (pts.length < 2) return "";
  let d = `M ${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}

export default function TideChart({ day }: { day: DayForecast }) {
  const model = useMemo(() => {
    if (day.hours.length === 0) return null;
    const start = day.hours[0].time;
    const end = start + 24 * HOUR;

    // Muestras: alturas horarias + extremos exactos, ordenadas.
    const samples: Pt[] = day.hours.map((h) => [h.time, h.tideHeight]);
    for (const e of day.extremes) samples.push([e.time, e.height]);
    samples.sort((a, b) => a[0] - b[0]);
    // Extender hasta el borde derecho para que la curva llene el ancho.
    samples.push([end, samples[samples.length - 1][1]]);

    const heights = samples.map((s) => s[1]);
    const minH = Math.min(...heights) - 0.25;
    const maxH = Math.max(...heights) + 0.3;

    const x = (t: number) => PAD_X + ((t - start) / (24 * HOUR)) * (W - 2 * PAD_X);
    const y = (h: number) =>
      PAD_T + (1 - (h - minH) / (maxH - minH)) * (H - PAD_T - PAD_B);

    const pts: Pt[] = samples.map(([t, h]) => [x(t), y(h)]);
    const line = smoothPath(pts);
    const area = `${line} L ${x(end).toFixed(1)},${H - PAD_B} L ${x(start).toFixed(1)},${H - PAD_B} Z`;

    const now = Date.now();
    const nowInDay = now >= start && now < end;
    // Altura "ahora": muestra más cercana.
    let nowPt: Pt | null = null;
    if (nowInDay) {
      const nearest = samples.reduce((a, b) =>
        Math.abs(b[0] - now) < Math.abs(a[0] - now) ? b : a
      );
      nowPt = [x(now), y(nearest[1])];
    }

    return { start, end, x, y, line, area, nowPt };
  }, [day]);

  if (!model) return null;
  const { start, end, x, y, line, area, nowPt } = model;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-auto select-none"
      role="img"
      aria-label="Curva de marea del día"
    >
      <defs>
        <linearGradient id="tideFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3f9cc2" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#3f9cc2" stopOpacity="0.05" />
        </linearGradient>
      </defs>

      {/* Noche: antes del orto y después del ocaso */}
      {day.sunrise != null && (
        <rect
          x={x(start)}
          y={PAD_T - 14}
          width={Math.max(0, x(day.sunrise) - x(start))}
          height={H - PAD_T - PAD_B + 14}
          fill="#0a1622"
          opacity="0.55"
        />
      )}
      {day.sunset != null && (
        <rect
          x={x(day.sunset)}
          y={PAD_T - 14}
          width={Math.max(0, x(end) - x(day.sunset))}
          height={H - PAD_T - PAD_B + 14}
          fill="#0a1622"
          opacity="0.55"
        />
      )}

      {/* Ventanas de pesca */}
      {day.windows.map((w) => (
        <rect
          key={w.start}
          x={x(Math.max(w.start, start))}
          y={PAD_T - 14}
          width={Math.max(2, x(Math.min(w.end, end)) - x(Math.max(w.start, start)))}
          height={H - PAD_T - PAD_B + 14}
          fill="#34d399"
          opacity="0.13"
        />
      ))}

      {/* Rejilla horaria */}
      {[0, 6, 12, 18, 24].map((h) => (
        <g key={h}>
          <line
            x1={x(start + h * HOUR)}
            x2={x(start + h * HOUR)}
            y1={PAD_T - 14}
            y2={H - PAD_B}
            stroke="#1d5471"
            strokeWidth="1"
            opacity="0.45"
          />
          <text
            x={x(start + h * HOUR)}
            y={H - 8}
            textAnchor="middle"
            fontSize="10"
            fill="#73bdd9"
            opacity="0.8"
          >
            {String(h).padStart(2, "0")}
          </text>
        </g>
      ))}

      {/* Curva y área */}
      <path d={area} fill="url(#tideFill)" />
      <path d={line} fill="none" stroke="#73bdd9" strokeWidth="2.5" />

      {/* Orto / ocaso */}
      {day.sunrise != null && (
        <text x={x(day.sunrise)} y={14} textAnchor="middle" fontSize="12">
          🌅
        </text>
      )}
      {day.sunset != null && (
        <text x={x(day.sunset)} y={14} textAnchor="middle" fontSize="12">
          🌇
        </text>
      )}

      {/* Extremos */}
      {day.extremes.map((e) => {
        const ex = x(e.time);
        const ey = y(e.height);
        const isHigh = e.type === "pleamar";
        const label = `${madridTime(e.time)} · ${e.height.toFixed(2)} m`;
        // Evitar que las etiquetas se salgan por los bordes.
        const anchor = ex < 70 ? "start" : ex > W - 70 ? "end" : "middle";
        return (
          <g key={e.time}>
            <circle
              cx={ex}
              cy={ey}
              r="4.5"
              fill={isHigh ? "#a9d8ea" : "#2680a8"}
              stroke="#122636"
              strokeWidth="1.5"
            >
              <title>
                {isHigh
                  ? `Pleamar ${label}${e.coefficient != null ? ` · coef. ${e.coefficient}` : ""}`
                  : `Bajamar ${label}`}
              </title>
            </circle>
            <text
              x={ex}
              y={isHigh ? ey - 10 : ey + 18}
              textAnchor={anchor}
              fontSize="10.5"
              fill={isHigh ? "#d4ecf5" : "#73bdd9"}
              fontWeight={600}
            >
              {label}
            </text>
            {isHigh && e.coefficient != null && (
              <text
                x={ex}
                y={ey - 22}
                textAnchor={anchor}
                fontSize="9.5"
                fill="#34d399"
              >
                coef. {e.coefficient}
              </text>
            )}
          </g>
        );
      })}

      {/* Ahora */}
      {nowPt && (
        <g>
          <line
            x1={nowPt[0]}
            x2={nowPt[0]}
            y1={PAD_T - 14}
            y2={H - PAD_B}
            stroke="#fbbf24"
            strokeWidth="1.5"
            strokeDasharray="4 3"
          />
          <circle cx={nowPt[0]} cy={nowPt[1]} r="5" fill="#fbbf24" stroke="#122636" strokeWidth="1.5" />
          <text
            x={nowPt[0]}
            y={PAD_T - 18}
            textAnchor="middle"
            fontSize="9.5"
            fill="#fbbf24"
            fontWeight={700}
          >
            AHORA
          </text>
        </g>
      )}
    </svg>
  );
}
