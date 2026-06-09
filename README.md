# 🎣 Mareas & Pesca · Huelva y Cádiz

App web para ver los **mejores días y horas próximos** para la pesca deportiva
desde playa (surfcasting) en la costa de **Huelva y Cádiz**. Combina mareas
oficiales, periodos solunares y estado de la mar en una puntuación 0–100 por
hora y por día.

Selecciona un punto en el mapa y la app usa la **estación de marea oficial más
cercana**; o elige la estación directamente en el desplegable.

## Stack

- **Next.js 14** (App Router) + TypeScript + Tailwind CSS
- **Leaflet** / react-leaflet para el mapa
- **SunCalc** para cálculos solares y lunares (sin API externa)
- Pensada para desplegar en **Vercel**

## Fuentes de datos (oficiales/gratuitas, sin clave)

| Dato | Fuente | Notas |
|------|--------|-------|
| Mareas (pleamar/bajamar/altura) | **Instituto Hidrográfico de la Marina (IHM)** — `https://ideihm.covam.es/api-ihm/getmarea` | Por ID de puerto. Las llamadas van desde el servidor (rutas `/api`) para evitar CORS y cachear. |
| Oleaje + viento + presión | **Open-Meteo** (Marine + Forecast API) | Gratis, con CORS. |
| Sol / luna / solunar | Cálculo propio con SunCalc | No requiere red. |

## Cómo se interpretan las mareas (modelo de puntuación)

Cada hora recibe una nota 0–100 = suma ponderada de cuatro factores
(`lib/scoring.ts`, pesos ajustables):

1. **Marea en movimiento (40%)** — el pez come con corriente. Máximo en la
   mitad de la subida/bajada (derivada de la altura, interpolación sinusoidal
   entre extremos), mínimo en el agua muerta. Se prima la **marea subiendo** y
   se modula por el **coeficiente** del día (vivas mueven más agua).
2. **Solunar (25%)** — periodos *mayores* (±1 h del tránsito y anti-tránsito
   lunar) y *menores* (±0,5 h del orto/ocaso de la luna).
3. **Luz (20%)** — amanecer y atardecer son horas punta; bonus de noche con luna.
4. **Meteo-marina (15%)** — penaliza temporal y viento fuerte; premia mar moderada.

Además, una **sinergia** potencia la nota cuando un periodo solunar coincide con
el orto/ocaso solar (la ventana premium de la teoría solunar, marcada con ⭐).

La nota del día es la media de sus mejores horas, y se detectan **ventanas**
continuas de buena pesca. El **coeficiente** se muestra junto a cada pleamar.

## Puesta en marcha

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # build de producción
```

Despliegue en Vercel: importar el repo, sin variables de entorno necesarias.

## Notas y limitaciones (importante)

- **Coeficiente de marea**: el IHM no lo publica, así que se calcula de forma
  **astronómica** (escala 20-120) a partir de la configuración Sol-Luna —fase
  lunar y distancia lunar— en `tidalCoefficient` (`lib/astro.ts`). Es el
  coeficiente estándar tipo SHOM, prácticamente igual en todo el mundo para una
  fecha dada, por lo que coincide con el que muestran tides4fishing y similares.
- **Zona horaria**: las horas del IHM se interpretan como hora oficial peninsular
  (Europe/Madrid). Si en producción se confirma que el API entrega UTC, basta
  ajustar el parseo en `lib/tides.ts` (`parseDateTime`). El resto del cálculo
  usa epoch UTC y solo formatea a local en los bordes (`lib/time.ts`).
- **Estaciones**: en `lib/stations.ts` hay 7 puertos con ID verificado
  (Ayamonte 32, Isla Canela 33, Mazagón 36, Rota 40, Cádiz 42, Barbate 47,
  Tarifa 48). Se pueden añadir más consultando el endpoint `getlist` del API del IHM.
- La puntuación es **orientativa** y no sustituye al criterio del pescador ni a
  los avisos de Salvamento/AEMET. Comprueba el estado de la mar antes de salir.

## Estructura

```
app/
  page.tsx                 UI principal (mapa + estación + previsión)
  api/forecast/route.ts    orquestador: mareas + meteo + scoring
  api/stations/route.ts    lista de estaciones
lib/
  stations.ts  tides.ts  marine.ts  astro.ts  scoring.ts  time.ts  types.ts
components/
  MapPicker.tsx  ForecastView.tsx
```
