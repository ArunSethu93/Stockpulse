// frontend/components/charts/CandlestickChart.jsx
'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { createChart, CrosshairMode, LineStyle } from 'lightweight-charts';
import { usePriceStream } from '../../hooks/useWebSocket';


const THEME = {
  bg:          '#0f1923',
  grid:        'rgba(30,45,61,0.5)',
  border:      '#1e2d3d',
  text:        '#4a5a6e',
  crosshair:   '#2d4a6e',
  green:       '#00d68f',
  red:         '#ff4d6d',
  ema20:       '#f59e0b',
  ema50:       '#8b5cf6',
  bbUpper:     'rgba(59,130,246,0.4)',
  bbLower:     'rgba(59,130,246,0.4)',
  bbFill:      'rgba(59,130,246,0.05)',
  volume_up:   'rgba(0,214,143,0.4)',
  volume_down: 'rgba(255,77,109,0.4)',
};

export default function CandlestickChart({ symbol, initialData = [] }) {
  const containerRef = useRef(null);
  const chartRef     = useRef(null);
  const seriesRef    = useRef({});
  const resizeObs    = useRef(null);

  const [indicators, setIndicators] = useState({ EMA: true, BB: true, RSI: false, MACD: false, Volume: true });
  const [crosshairData, setCrosshair] = useState(null);
  const [timeframe, setTimeframe]     = useState('1M');
  const [chartType, setChartType]     = useState('candle');
  const [ohlcvData, setOhlcvData]     = useState(initialData);

  const { prices } = usePriceStream([symbol]);
  const livePrice  = prices[symbol];

  // ── Fetch OHLCV data ──────────────────────────────────────────
  useEffect(() => {
    const tfMap = { '1D':1, '1W':7, '1M':30, '3M':90, '6M':180, '1Y':365, '5Y':1825 };
    const days  = tfMap[timeframe] || 30;

    fetch(`/api/market/ohlcv/${symbol}?days=${days}`)
      .then(r => r.json())
      .then(data => {
        setOhlcvData(data);
        updateChartData(data);
      })
      .catch(() => {
        const generated = generateDemoOHLCV(symbol, days);
        setOhlcvData(generated);
        updateChartData(generated);
      });
  }, [symbol, timeframe]);

  // ── Initialize chart ──────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      width:  containerRef.current.clientWidth,
      height: 380,
      layout: {
        background:   { type: 'solid', color: THEME.bg },
        textColor:    THEME.text,
        fontFamily:   "'IBM Plex Mono'",
        fontSize:     10,
      },
      grid: {
        vertLines:   { color: THEME.grid, style: LineStyle.Dotted },
        horzLines:   { color: THEME.grid, style: LineStyle.Dotted },
      },
      crosshair: {
        mode:          CrosshairMode.Normal,
        vertLine:      { color: THEME.crosshair, width: 1, style: LineStyle.Dashed },
        horzLine:      { color: THEME.crosshair, width: 1, style: LineStyle.Dashed },
      },
      rightPriceScale: {
        borderColor: THEME.border,
        scaleMargins: { top: 0.1, bottom: 0.2 },
      },
      timeScale: {
        borderColor:     THEME.border,
        rightOffset:     5,
        minBarSpacing:   4,
        fixLeftEdge:     false,
        fixRightEdge:    false,
        timeVisible:     true,
        secondsVisible:  false,
      },
      handleScroll:   { mouseWheel: true, pressedMouseMove: true },
      handleScale:    { mouseWheel: true, pinch: true },
    });

    chartRef.current = chart;

    // ── Candlestick series ──
    const candleSeries = chart.addCandlestickSeries({
      upColor:         THEME.green,
      downColor:       THEME.red,
      borderUpColor:   THEME.green,
      borderDownColor: THEME.red,
      wickUpColor:     THEME.green,
      wickDownColor:   THEME.red,
    });
    seriesRef.current.candle = candleSeries;

    // ── EMA series ──
    seriesRef.current.ema20 = chart.addLineSeries({
      color: THEME.ema20, lineWidth: 1.5, priceLineVisible: false, lastValueVisible: false,
    });
    seriesRef.current.ema50 = chart.addLineSeries({
      color: THEME.ema50, lineWidth: 1.5, priceLineVisible: false, lastValueVisible: false,
    });

    // ── Bollinger Bands ──
    seriesRef.current.bbUpper = chart.addLineSeries({
      color: THEME.bbUpper, lineWidth: 1, lineStyle: LineStyle.Dashed, priceLineVisible: false, lastValueVisible: false,
    });
    seriesRef.current.bbLower = chart.addLineSeries({
      color: THEME.bbLower, lineWidth: 1, lineStyle: LineStyle.Dashed, priceLineVisible: false, lastValueVisible: false,
    });

    // ── Volume (separate pane) ──
    seriesRef.current.volume = chart.addHistogramSeries({
      priceFormat:   { type: 'volume' },
      priceScaleId:  'volume',
      scaleMargins:  { top: 0.8, bottom: 0 },
    });

    // ── Crosshair subscriber ──
    chart.subscribeCrosshairMove(param => {
      if (param.time && param.seriesPrices) {
        const price = param.seriesPrices.get(candleSeries);
        if (price) setCrosshair({ time: param.time, ...price });
      }
    });

    // ── ResizeObserver ──
    resizeObs.current = new ResizeObserver(entries => {
      const { width } = entries[0].contentRect;
      chart.applyOptions({ width });
    });
    resizeObs.current.observe(containerRef.current);

    return () => {
      resizeObs.current?.disconnect();
      chart.remove();
    };
  }, []);

  // ── Update chart data ─────────────────────────────────────────
  const updateChartData = useCallback((data) => {
    const chart = chartRef.current;
    const series = seriesRef.current;
    if (!chart || !data?.length) return;

    // Transform to lightweight-charts format
    const candles = data.map(d => ({
      time:  Math.floor(new Date(d.date).getTime() / 1000),
      open:  d.open, high: d.high, low: d.low, close: d.close,
    })).sort((a, b) => a.time - b.time);

    const closes = data.map(d => d.close);
    const times  = candles.map(c => c.time);

    series.candle?.setData(candles);

    // Volume bars
    const volData = data.map((d, i) => ({
      time:  candles[i]?.time,
      value: d.volume,
      color: d.close >= d.open ? THEME.volume_up : THEME.volume_down,
    }));
    series.volume?.setData(volData);

    // EMA calculations
    if (indicators.EMA) {
      const ema20 = calcEMA(closes, 20).map((v, i) => ({ time: times[i], value: +v.toFixed(2) }));
      const ema50 = calcEMA(closes, 50).map((v, i) => ({ time: times[i], value: +v.toFixed(2) }));
      series.ema20?.setData(ema20);
      series.ema50?.setData(ema50);
    } else {
      series.ema20?.setData([]);
      series.ema50?.setData([]);
    }

    // Bollinger Bands
    if (indicators.BB) {
      const { upper, lower } = calcBollinger(closes);
      series.bbUpper?.setData(upper.map((v, i) => v ? { time: times[i], value: +v.toFixed(2) } : null).filter(Boolean));
      series.bbLower?.setData(lower.map((v, i) => v ? { time: times[i], value: +v.toFixed(2) } : null).filter(Boolean));
    } else {
      series.bbUpper?.setData([]);
      series.bbLower?.setData([]);
    }

    chart.timeScale().fitContent();
  }, [indicators]);

  // ── Apply live WebSocket update ───────────────────────────────
  useEffect(() => {
    if (!livePrice || !seriesRef.current.candle) return;

    const now = Math.floor(Date.now() / 1000);
    // Update last candle with live price
    seriesRef.current.candle.update({
      time:  now,
      open:  livePrice.open  || livePrice.price,
      high:  livePrice.high  || livePrice.price,
      low:   livePrice.low   || livePrice.price,
      close: livePrice.price,
    });
  }, [livePrice]);

  // ── Indicator calculations ────────────────────────────────────
  function calcEMA(closes, period) {
    const k   = 2 / (period + 1);
    const ema = [closes[0]];
    for (let i = 1; i < closes.length; i++) {
      ema.push(closes[i] * k + ema[i - 1] * (1 - k));
    }
    return ema;
  }

  function calcBollinger(closes, period = 20, mult = 2) {
    const upper = [], lower = [];
    for (let i = 0; i < closes.length; i++) {
      if (i < period - 1) { upper.push(null); lower.push(null); continue; }
      const slice = closes.slice(i - period + 1, i + 1);
      const mean  = slice.reduce((a, b) => a + b, 0) / period;
      const std   = Math.sqrt(slice.reduce((a, b) => a + (b - mean) ** 2, 0) / period);
      upper.push(mean + mult * std);
      lower.push(mean - mult * std);
    }
    return { upper, lower };
  }

  function generateDemoOHLCV(sym, days) {
    const data = [];
    let price = 2811;
    for (let i = days; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      if (d.getDay() === 0 || d.getDay() === 6) continue;
      const open   = price;
      const move   = (Math.random() - 0.48) * price * 0.018;
      const close  = Math.max(open + move, 1);
      const wick   = Math.random() * price * 0.006;
      data.push({
        date:   d.toISOString().split('T')[0],
        open:   +open.toFixed(2),
        high:   +(Math.max(open, close) + wick).toFixed(2),
        low:    +(Math.min(open, close) - wick).toFixed(2),
        close:  +close.toFixed(2),
        volume: Math.floor((Math.random() * 25 + 8) * 1e6),
      });
      price = close;
    }
    return data;
  }

  const toggleIndicator = (name) => {
    setIndicators(prev => {
      const next = { ...prev, [name]: !prev[name] };
      return next;
    });
  };

  useEffect(() => {
    if (ohlcvData.length > 0) updateChartData(ohlcvData);
  }, [indicators, ohlcvData]);

  return (
    <div className="chart-container">
      {/* Toolbar */}
      <div className="chart-toolbar">
        {/* Timeframe buttons */}
        <div className="ctf-group">
          {['1D','1W','1M','3M','6M','1Y','5Y'].map(tf => (
            <button key={tf} className={`ctf ${timeframe === tf ? 'act' : ''}`} onClick={() => setTimeframe(tf)}>{tf}</button>
          ))}
        </div>

        {/* Chart type */}
        <div className="ctype-group">
          {['candle','line','bar'].map(t => (
            <button key={t} className={`ctype ${chartType === t ? 'act' : ''}`} onClick={() => setChartType(t)}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* Indicator toggles */}
        {['EMA','BB','RSI','MACD'].map(ind => (
          <button key={ind} className={`indicator-toggle ${indicators[ind] ? 'on' : ''}`} onClick={() => toggleIndicator(ind)}>
            {ind}
          </button>
        ))}

        {/* Crosshair info */}
        {crosshairData && (
          <div className="crosshair-info">
            <span>O:{crosshairData.open?.toFixed(2)}</span>
            <span>H:{crosshairData.high?.toFixed(2)}</span>
            <span>L:{crosshairData.low?.toFixed(2)}</span>
            <span className={crosshairData.close >= crosshairData.open ? 'up' : 'down'}>
              C:{crosshairData.close?.toFixed(2)}
            </span>
          </div>
        )}
      </div>

      {/* Chart canvas */}
      <div ref={containerRef} style={{ height: 380, width: '100%' }} />

      {/* Indicator sub-panes */}
      {indicators.RSI && <RSIPanel data={ohlcvData} />}
      {indicators.MACD && <MACDPanel data={ohlcvData} />}
    </div>
  );
}

// ── RSI Sub-panel ─────────────────────────────────────────────────
function RSIPanel({ data }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current || !data?.length) return;
    const chart = createChart(ref.current, {
      width: ref.current.clientWidth, height: 100,
      layout: { background: { type: 'solid', color: THEME.bg }, textColor: THEME.text },
      rightPriceScale: { borderColor: THEME.border },
      timeScale: { borderColor: THEME.border, visible: false },
      grid: { vertLines: { color: THEME.grid }, horzLines: { color: THEME.grid } },
    });
    const rsiSeries = chart.addLineSeries({ color: '#06b6d4', lineWidth: 1.5, priceLineVisible: false, lastValueVisible: true });
    const rsi = calcRSI(data.map(d => d.close));
    const candles = data.map(d => Math.floor(new Date(d.date).getTime() / 1000)).sort((a,b)=>a-b);
    rsiSeries.setData(rsi.map((v, i) => v ? { time: candles[i], value: +v.toFixed(2) } : null).filter(Boolean));
    chart.timeScale().fitContent();
    return () => chart.remove();
  }, [data]);
  return (
    <div style={{ position: 'relative', borderTop: '1px solid #1e2d3d' }}>
      <div style={{ position: 'absolute', top: 6, left: 12, fontFamily: "'IBM Plex Mono'", fontSize: 9, color: '#4a5a6e', zIndex: 2, textTransform: 'uppercase', letterSpacing: '0.08em' }}>RSI (14)</div>
      <div ref={ref} style={{ height: 100 }} />
    </div>
  );
}

function calcRSI(closes, period = 14) {
  const rsi = new Array(period).fill(null);
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i-1];
    if (d > 0) gains += d; else losses -= d;
  }
  let avgG = gains / period, avgL = losses / period;
  rsi.push(100 - 100 / (1 + avgG / avgL));
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i-1];
    avgG = (avgG * (period-1) + Math.max(d, 0)) / period;
    avgL = (avgL * (period-1) + Math.max(-d, 0)) / period;
    rsi.push(100 - 100 / (1 + avgG / avgL));
  }
  return rsi;
}

// ── MACD Sub-panel ────────────────────────────────────────────────
function MACDPanel({ data }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current || !data?.length) return;
    const chart = createChart(ref.current, {
      width: ref.current.clientWidth, height: 100,
      layout: { background: { type: 'solid', color: THEME.bg }, textColor: THEME.text },
      rightPriceScale: { borderColor: THEME.border },
      timeScale: { borderColor: THEME.border, visible: false },
      grid: { vertLines: { color: THEME.grid }, horzLines: { color: THEME.grid } },
    });
    const closes  = data.map(d => d.close);
    const times   = data.map(d => Math.floor(new Date(d.date).getTime() / 1000)).sort((a,b)=>a-b);
    const ema12   = calcEMA(closes, 12);
    const ema26   = calcEMA(closes, 26);
    const macd    = ema12.map((v, i) => v - ema26[i]);
    const signal  = calcEMA(macd.slice(26), 9);
    const hist    = macd.map((v, i) => i >= 34 ? v - signal[i - 34] : null);

    chart.addHistogramSeries({ color: THEME.green, priceLineVisible: false })
      .setData(hist.map((v, i) => v !== null ? { time: times[i], value: v, color: v >= 0 ? 'rgba(0,214,143,0.5)' : 'rgba(255,77,109,0.5)' } : null).filter(Boolean));
    chart.addLineSeries({ color: '#3b82f6', lineWidth: 1.2, priceLineVisible: false, lastValueVisible: false })
      .setData(macd.map((v, i) => ({ time: times[i], value: +v.toFixed(4) })));
    chart.addLineSeries({ color: '#f59e0b', lineWidth: 1.2, priceLineVisible: false, lastValueVisible: false })
      .setData(signal.map((v, i) => ({ time: times[i+34] || times[times.length-1], value: +v.toFixed(4) })));
    chart.timeScale().fitContent();
    return () => chart.remove();
  }, [data]);
  return (
    <div style={{ position: 'relative', borderTop: '1px solid #1e2d3d' }}>
      <div style={{ position: 'absolute', top: 6, left: 12, fontFamily: "'IBM Plex Mono'", fontSize: 9, color: '#4a5a6e', zIndex: 2, textTransform: 'uppercase', letterSpacing: '0.08em' }}>MACD (12,26,9)</div>
      <div ref={ref} style={{ height: 100 }} />
    </div>
  );
}

function calcEMA(closes, period) {
  const k = 2 / (period + 1);
  const ema = [closes[0]];
  for (let i = 1; i < closes.length; i++) ema.push(closes[i] * k + ema[i-1] * (1 - k));
  return ema;
}
