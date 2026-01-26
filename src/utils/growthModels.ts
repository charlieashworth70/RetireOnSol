/**
 * Growth Models for SOL Price Projection
 *
 * Different models for projecting future SOL prices:
 * 1. CAGR - Simple compound annual growth rate
 * 2. Power Law - Based on Bitcoin's power law (log-log linear relationship with time)
 * 3. S-Curve - Technology adoption curve (logistic function)
 * 4. Rainbow - Logarithmic regression with bands (cycle-aware)
 */

export type GrowthModel = 'cagr' | 'powerlaw' | 'scurve' | 'rainbow';

export interface GrowthModelParams {
  // CAGR
  cagr?: number; // Annual growth rate as decimal (0.25 = 25%)

  // Power Law
  // Bitcoin formula: log10(price) = -17.01 + 5.82 * log10(days_since_genesis)
  // SOL adapted with different coefficients
  powerLawSlope?: number; // Slope of log-log relationship (default ~4.5 for SOL)

  // S-Curve (Logistic)
  sCurveYearsToMidpoint?: number; // Years until we reach 50% of max price
  sCurveMaxPrice?: number; // Theoretical maximum price at full adoption (the ceiling)

  // Rainbow
  rainbowBand?: 'fire_sale' | 'buy' | 'accumulate' | 'hold' | 'bubble' | 'fomo'; // Which band to project
}

// SOL genesis was March 16, 2020
const SOL_GENESIS_DATE = new Date('2020-03-16');

/**
 * Get days since SOL genesis
 */
function daysSinceGenesis(date: Date = new Date()): number {
  return Math.floor((date.getTime() - SOL_GENESIS_DATE.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * CAGR Model - Simple compound growth
 */
function cagrPrice(currentPrice: number, yearsFromNow: number, cagr: number): number {
  return currentPrice * Math.pow(1 + cagr, yearsFromNow);
}

/**
 * Power Law Model
 * Based on the observation that Bitcoin (and other cryptos) follow a power law:
 * log(price) = a + b * log(days)
 *
 * We anchor to the current price and project forward using the power law slope.
 * The slope determines how fast prices grow relative to time on a log-log scale.
 *
 * Key insight: power law growth decelerates over time (unlike constant CAGR).
 * A slope of 1.5-2.0 gives reasonable projections anchored to current price.
 */
function powerLawPrice(currentPrice: number, yearsFromNow: number, slope: number = 1.8): number {
  const currentDays = daysSinceGenesis();
  const futureDays = currentDays + (yearsFromNow * 365);

  // Power law ratio: future_price / current_price = (future_days / current_days)^slope
  // This anchors the projection to the actual current price
  const ratio = Math.pow(futureDays / currentDays, slope);

  return currentPrice * ratio;
}

/**
 * Get power law fair value for a given date (relative to current)
 */
export function getPowerLawFairValue(currentPrice: number, daysFromGenesis: number, slope: number = 1.8): number {
  const currentDays = daysSinceGenesis();
  const ratio = Math.pow(daysFromGenesis / currentDays, slope);
  return currentPrice * ratio;
}

/**
 * S-Curve (Logistic) Model
 * Models technology adoption - slow start, rapid growth, then saturation
 *
 * The S-curve approaches maxPrice as an asymptote.
 * - At year 0, price = currentPrice
 * - At year = yearsToMidpoint, price reaches 50% of maxPrice
 * - Curve approaches maxPrice asymptotically
 *
 * @param currentPrice - Current SOL price
 * @param yearsFromNow - Years to project
 * @param yearsToMidpoint - Years until we reach 50% of max price
 * @param maxPrice - Theoretical maximum price at full adoption (the ceiling)
 */
function sCurvePrice(
  currentPrice: number,
  yearsFromNow: number,
  yearsToMidpoint: number = 10,
  maxPrice: number = 50000
): number {
  // If current price is already at or above max, just return max
  if (currentPrice >= maxPrice) {
    return maxPrice;
  }

  // Standard logistic: f(t) = maxPrice / (1 + e^(-k*(t - t_mid)))
  // At t=0: currentPrice = maxPrice / (1 + e^(k * t_mid))
  // Solving for k: k = ln((maxPrice / currentPrice) - 1) / t_mid
  const k = Math.log((maxPrice / currentPrice) - 1) / yearsToMidpoint;

  // Calculate future price
  const futurePrice = maxPrice / (1 + Math.exp(-k * (yearsFromNow - yearsToMidpoint)));

  return Math.max(currentPrice, futurePrice);
}

/**
 * Rainbow Chart Model
 * Based on logarithmic regression with standard deviation bands
 * Similar to Bitcoin rainbow chart
 *
 * The bands represent different market conditions:
 * - Fire Sale (>2 std below) - Extremely undervalued
 * - Buy (1-2 std below) - Good buying opportunity
 * - Accumulate (0-1 std below) - Fair value, accumulate
 * - Hold (0-1 std above) - Fair value, hold
 * - Bubble (1-2 std above) - Getting expensive
 * - FOMO (>2 std above) - Extremely overvalued
 */
type RainbowBand = 'fire_sale' | 'buy' | 'accumulate' | 'hold' | 'bubble' | 'fomo';

const RAINBOW_BAND_MULTIPLIERS: Record<RainbowBand, number> = {
  fire_sale: 0.3,    // -2.5 std
  buy: 0.5,          // -1.5 std
  accumulate: 0.75,  // -0.5 std
  hold: 1.25,        // +0.5 std
  bubble: 2.0,       // +1.5 std
  fomo: 3.5,         // +2.5 std
};

function rainbowPrice(
  currentPrice: number,
  yearsFromNow: number,
  band: RainbowBand = 'hold',
  slope: number = 1.8
): number {
  // Get power law fair value
  const fairValue = powerLawPrice(currentPrice, yearsFromNow, slope);

  // Apply band multiplier
  return fairValue * RAINBOW_BAND_MULTIPLIERS[band];
}

/**
 * Main function to calculate price based on selected model
 */
export function calculateFuturePrice(
  currentPrice: number,
  yearsFromNow: number,
  model: GrowthModel,
  params: GrowthModelParams
): number {
  switch (model) {
    case 'cagr':
      return cagrPrice(currentPrice, yearsFromNow, params.cagr || 0.25);

    case 'powerlaw':
      return powerLawPrice(currentPrice, yearsFromNow, params.powerLawSlope || 1.8);

    case 'scurve':
      return sCurvePrice(
        currentPrice,
        yearsFromNow,
        params.sCurveYearsToMidpoint || 10,
        params.sCurveMaxPrice || 50000
      );

    case 'rainbow':
      return rainbowPrice(
        currentPrice,
        yearsFromNow,
        params.rainbowBand || 'hold',
        params.powerLawSlope || 1.8
      );

    default:
      return cagrPrice(currentPrice, yearsFromNow, 0.25);
  }
}

/**
 * Get year-by-year prices for a model
 */
export function getYearlyPrices(
  currentPrice: number,
  years: number,
  model: GrowthModel,
  params: GrowthModelParams
): number[] {
  const prices: number[] = [];

  for (let year = 1; year <= years; year++) {
    prices.push(calculateFuturePrice(currentPrice, year, model, params));
  }

  return prices;
}

/**
 * Get model description for UI
 */
export function getModelDescription(model: GrowthModel): string {
  switch (model) {
    case 'cagr':
      return 'Constant annual growth rate - simple but unrealistic for crypto';
    case 'powerlaw':
      return 'Log-linear growth over time - based on Bitcoin\'s historical pattern';
    case 'scurve':
      return 'Technology adoption curve - slow start, rapid growth, then plateau';
    case 'rainbow':
      return 'Logarithmic regression bands - accounts for market cycles';
    default:
      return '';
  }
}

/**
 * Get model display name
 */
export function getModelDisplayName(model: GrowthModel): string {
  switch (model) {
    case 'cagr':
      return 'CAGR';
    case 'powerlaw':
      return 'Power Law';
    case 'scurve':
      return 'S-Curve';
    case 'rainbow':
      return 'Rainbow';
    default:
      return model;
  }
}
