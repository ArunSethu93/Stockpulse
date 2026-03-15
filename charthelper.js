// frontend/lib/chartHelpers.js

/**
 * chartHelpers.js — Technical indicator calculations
 * Used by both the chart components and right panel mini-charts
 */

// ── EMA ────────────────────────────────────────────────────────────
export function calcEMA(closes, period) {
  if (!closes?.length || closes.length < period) return [];
  const k   = 2 / (period + 1);
  const ema = [closes[0]];
  for (let i = 1; i < closes.length; i++) {
    ema.push(+(closes[i] * k + ema[i - 1] * (1 - k)).toFixed(4));
  }
  return ema;
}

// ── SMA ────────────────────────────────────────────────────────────
export function calcSMA(closes, period) {
  if (!closes?.length) return [];
  const sma = [];
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) { sma.push(null); continue; }
    const slice = closes.slice(i - period + 1, i + 1);
    sma.push(+(slice.reduce((a, b) => a + b, 0) / period).toFixed(4));
  }
  return sma;
}

// ── RSI ────────────────────────────────────────────────────────────
export function calcRSI(closes, period = 14) {
  if (closes.length < period + 1) return [];
  const rsi = new Array(period).fill(null);
  let gains = 0, losses = 0;

  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d > 0) gains += d; else losses -= d;
  }

  let avgG = gains / period;
  let avgL = losses / period;
  rsi.push(+(100 - 100 / (1 + avgG / (avgL || 1))).toFixed(2));

  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    avgG = (avgG * (period - 1) + Math.max(d, 0)) / period;
    avgL = (avgL * (period - 1) + Math.max(-d, 0)) / period;
    rsi.push(+(100 - 100 / (1 + avgG / (avgL || 1))).toFixed(2));
  }

  return rsi;
}

// ── MACD ───────────────────────────────────────────────────────────
export function calcMACD(closes, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
  const emaFast   = calcEMA(closes, fastPeriod);
  const emaSlow   = calcEMA(closes, slowPeriod);
  const macdLine  = emaFast.map((v, i) => +(v - emaSlow[i]).toFixed(4));
  const signalLine = calcEMA(macdLine.slice(slowPeriod - 1), signalPeriod);
  const fullSignal = new Array(slowPeriod - 1).fill(null)
    .concat(new Array(signalPeriod - 1).fill(null))
    .concat(signalLine);
  const histogram = macdLine.map((v, i) =>
    fullSignal[i] !== null ? +(v - fullSignal[i]).toFixed(4) : null
  );
  return { macdLine, signalLine: fullSignal, histogram };
}

// ── Bollinger Bands ────────────────────────────────────────────────
export function calcBollinger(closes, period = 20, stdDevMult = 2) {
  const upper = [], middle = [], lower = [];
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) {
      upper.push(null); middle.push(null); lower.push(null);
      continue;
    }
    const slice = closes.slice(i - period + 1, i + 1);
    const mean  = slice.reduce((a, b) => a + b, 0) / period;
    const std   = Math.sqrt(slice.reduce((a, b) => a + (b - mean) ** 2, 0) / period);
    middle.push(+mean.toFixed(4));
    upper.push(+(mean + stdDevMult * std).toFixed(4));
    lower.push(+(mean - stdDevMult * std).toFixed(4));
  }
  return { upper, middle, lower };
}

// ── ATR ────────────────────────────────────────────────────────────
export function calcATR(ohlcv, period = 14) {
  if (!ohlcv?.length) return [];
  const trueRanges = ohlcv.map((d, i) => {
    if (i === 0) return d.high - d.low;
    const prevClose = ohlcv[i - 1].close;
    return Math.max(d.high - d.low, Math.abs(d.high - prevClose), Math.abs(d.low - prevClose));
  });
  return calcEMA(trueRanges, period);
}

// ── Stochastic ─────────────────────────────────────────────────────
export function calcStochastic(ohlcv, kPeriod = 14, dPeriod = 3) {
  const kValues = [];
  for (let i = 0; i < ohlcv.length; i++) {
    if (i < kPeriod - 1) { kValues.push(null); continue; }
    const slice = ohlcv.slice(i - kPeriod + 1, i + 1);
    const high  = Math.max(...slice.map(d => d.high));
    const low   = Math.min(...slice.map(d => d.low));
    kValues.push(low === high ? 50 : +((ohlcv[i].close - low) / (high - low) * 100).toFixed(2));
  }
  const dValues = calcSMA(kValues.filter(Boolean), dPeriod);
  return { k: kValues, d: dValues };
}

// ── VWAP ───────────────────────────────────────────────────────────
export function calcVWAP(ohlcv) {
  let cumVolume = 0, cumTypicalVol = 0;
  return ohlcv.map(d => {
    const typical = (d.high + d.low + d.close) / 3;
    cumTypicalVol += typical * d.volume;
    cumVolume     += d.volume;
    return +(cumTypicalVol / cumVolume).toFixed(2);
  });
}

// ── OHLCV Data Generator (for demo/testing) ────────────────────────
export function generateOHLCV(days = 30, startPrice = 2811, volatility = 0.018, trend = 0.003) {
  const data  = [];
  let price   = startPrice;
  const today = new Date();

  for (let i = days; i >= 0; i--) {
    const date = new Date(today - i * 86400000);
    if (date.getDay() === 0 || date.getDay() === 6) continue; // Skip weekends

    const open   = price;
    const move   = (Math.random() - 0.5 + trend) * price * volatility;
    const close  = Math.max(open + move, 1);
    const wick   = Math.random() * price * (volatility / 3);
    const high   = Math.max(open, close) + wick;
    const low    = Math.min(open, close) - wick;
    const volume = Math.floor((Math.random() * 25 + 8) * 1e6);

    data.push({
      date:   date.toISOString().split('T')[0],
      open:   +open.toFixed(2),
      high:   +high.toFixed(2),
      low:    +low.toFixed(2),
      close:  +close.toFixed(2),
      volume,
    });

    price = close;
  }
  return data;
}

/**
 * Transform OHLCV for lightweight-charts format (Unix timestamps)
 */
export function toLightweightFormat(ohlcvData) {
  return ohlcvData
    .map(d => ({
      time:  Math.floor(new Date(d.date).getTime() / 1000),
      open:  d.open,
      high:  d.high,
      low:   d.low,
      close: d.close,
    }))
    .sort((a, b) => a.time - b.time);
}

/**
 * Get RSI signal level label
 */
export function getRSISignal(rsi) {
  if (rsi === null) return null;
  if (rsi >= 70) return { label: 'Overbought', class: 'negative' };
  if (rsi <= 30) return { label: 'Oversold',   class: 'positive' };
  if (rsi >= 60) return { label: 'Strong',      class: 'positive' };
  if (rsi <= 40) return { label: 'Weak',        class: 'negative' };
  return { label: 'Neutral', class: '' };
}

/**
 * Get MACD signal
 */
export function getMACDSignal(hist) {
  if (hist === null || hist === undefined) return null;
  if (hist > 0) return { label: 'Bullish', class: 'positive' };
  return { label: 'Bearish', class: 'negative' };
}

/**
 * Determine support/resistance levels from OHLCV
 */
export function findSupportResistance(ohlcvData, lookback = 20) {
  const highs  = ohlcvData.slice(-lookback).map(d => d.high);
  const lows   = ohlcvData.slice(-lookback).map(d => d.low);
  const resistance = Math.max(...highs);
  const support    = Math.min(...lows);
  const current    = ohlcvData[ohlcvData.length - 1]?.close;

  return {
    resistance,
    support,
    distToResistance: current ? ((resistance - current) / current * 100).toFixed(2) : null,
    distToSupport:    current ? ((current - support) / current * 100).toFixed(2) : null,
  };
}