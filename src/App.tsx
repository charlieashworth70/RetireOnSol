import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  calculateProjection,
  formatUSD,
  formatSOL,
  type ProjectionInput,
  type ProjectionResult,
  type GrowthModel,
  type GrowthModelParams,
} from './utils/calculations';
import { getModelDisplayName, getModelDescription } from './utils/growthModels';
import { fetchSOLPrice, startPriceRefresh } from './utils/solPrice';
import { GrowthChart } from './components/GrowthChart';
import { ComparisonChart } from './components/ComparisonChart';
import { WalletButton } from './components/WalletButton';
import { shareProjection } from './utils/shareImage';
import './App.css';

type DCAFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

function App() {
  // Form state
  const [currentSOL, setCurrentSOL] = useState<number>(10);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [priceLoading, setPriceLoading] = useState<boolean>(true);
  const [priceError, setPriceError] = useState<string | null>(null);
  const [years, setYears] = useState<number>(25);
  const [dcaAmountUSD, setDcaAmountUSD] = useState<number>(100);
  const [dcaMaxLimit, setDcaMaxLimit] = useState<number>(1000);
  const [dcaFrequency, setDcaFrequency] = useState<DCAFrequency>('weekly');

  // Growth model state
  const [growthModel, setGrowthModel] = useState<GrowthModel>('powerlaw');
  const [modelParams, setModelParams] = useState<GrowthModelParams>({
    cagr: 0.25,
    powerLawSlope: 1.8,
    sCurveYearsToMidpoint: 10,
    sCurveMaxPrice: 50000,
    rainbowBand: 'hold',
  });
  const [compareMode, setCompareMode] = useState(false);

  // Fetch SOL price on mount and refresh every 5 minutes
  useEffect(() => {
    async function loadPrice() {
      try {
        setPriceLoading(true);
        setPriceError(null);
        const data = await fetchSOLPrice();
        setCurrentPrice(data.price);
      } catch (err) {
        setPriceError(err instanceof Error ? err.message : 'Could not fetch price');
        // No fallback - price will remain null until network is available
      } finally {
        setPriceLoading(false);
      }
    }
    loadPrice();

    // Start periodic refresh every 5 minutes
    const cleanup = startPriceRefresh((newPrice) => {
      setCurrentPrice(newPrice);
      setPriceError(null);
    });

    return cleanup;
  }, []);

  // Track wallet balance for "Use Wallet Balance" button
  const [walletBalance, setWalletBalance] = useState<number | null>(null);

  // Handle wallet balance loaded
  const handleWalletBalance = useCallback((balance: number) => {
    setWalletBalance(balance);
  }, []);

  // Apply wallet balance to input
  const useWalletBalanceForInput = useCallback(() => {
    if (walletBalance !== null) {
      setCurrentSOL(walletBalance);
    }
  }, [walletBalance]);

  // Calculate projections
  const projection = useMemo<ProjectionResult | null>(() => {
    if (currentPrice === null) return null;
    const input: ProjectionInput = {
      currentSOL,
      currentPrice,
      years,
      dcaAmountUSD,
      dcaFrequency,
      growthModel,
      modelParams,
    };
    return calculateProjection(input);
  }, [currentSOL, currentPrice, years, dcaAmountUSD, dcaFrequency, growthModel, modelParams]);

  return (
    <div className="app">
      <header className="header">
        <div className="header-top">
          <h1>RetireOnSol</h1>
          <WalletButton onBalanceLoaded={handleWalletBalance} />
        </div>
        <p className="subtitle">Plan your SOL accumulation journey</p>
      </header>

      <main className="main">
        <section className="input-section">
          <h2>Your Situation</h2>

          <div className="input-row">
            <div className="input-group">
              <label htmlFor="currentSOL">Current SOL Holdings</label>
              <div className="sol-input-wrapper">
                <input
                  id="currentSOL"
                  type="number"
                  min="0"
                  step="1"
                  value={currentSOL}
                  onChange={(e) => setCurrentSOL(Number(e.target.value))}
                />
                {walletBalance !== null && (
                  <button
                    type="button"
                    className="use-wallet-btn"
                    onClick={useWalletBalanceForInput}
                    title={`Use wallet balance: ${walletBalance} SOL`}
                  >
                    Use {walletBalance} SOL
                  </button>
                )}
              </div>
            </div>

            <div className="input-group">
              <label>Current SOL Price</label>
              <div className="price-display">
                {priceLoading ? (
                  <span className="price-loading">Loading...</span>
                ) : priceError ? (
                  <span className="price-value">${currentPrice?.toFixed(2)} <span className="price-note">(fallback)</span></span>
                ) : (
                  <span className="price-value">${currentPrice?.toFixed(2)} <span className="price-note">live</span></span>
                )}
              </div>
            </div>
          </div>

          <div className="input-group slider-group">
            <label htmlFor="years">Years to Retirement: <span className="slider-value">{years}</span></label>
            <input
              id="years"
              type="range"
              min="5"
              max="40"
              value={years}
              onChange={(e) => setYears(Number(e.target.value))}
            />
            <div className="slider-labels">
              <span>5</span>
              <span>40</span>
            </div>
          </div>

          <h2 className="section-divider">Your DCA Plan</h2>

          <div className="input-group slider-group">
            <label htmlFor="dcaAmountUSD">Invest per Period: <span className="slider-value">${dcaAmountUSD}</span></label>
            <input
              id="dcaAmountUSD"
              type="range"
              min="0"
              max={dcaMaxLimit}
              step={dcaMaxLimit <= 1000 ? 10 : 50}
              value={Math.min(dcaAmountUSD, dcaMaxLimit)}
              onChange={(e) => setDcaAmountUSD(Number(e.target.value))}
            />
            <div className="slider-labels">
              <span>$0</span>
              <span>${dcaMaxLimit.toLocaleString()}</span>
            </div>
            <div className="limit-buttons">
              {[1000, 5000, 10000].map((limit) => (
                <button
                  key={limit}
                  type="button"
                  className={`limit-btn ${dcaMaxLimit === limit ? 'active' : ''}`}
                  onClick={() => setDcaMaxLimit(limit)}
                >
                  ${limit >= 1000 ? `${limit / 1000}K` : limit}
                </button>
              ))}
            </div>
          </div>

          <div className="input-group">
            <label>Frequency</label>
            <div className="frequency-buttons">
              {(['daily', 'weekly', 'monthly', 'yearly'] as DCAFrequency[]).map((freq) => (
                <button
                  key={freq}
                  type="button"
                  className={`freq-btn ${dcaFrequency === freq ? 'active' : ''}`}
                  onClick={() => setDcaFrequency(freq)}
                >
                  {freq.charAt(0).toUpperCase() + freq.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <h2 className="section-divider">Growth Model</h2>

          <div className="input-group">
            <label>Price Projection Model</label>
            <div className="model-buttons">
              {(['cagr', 'powerlaw', 'scurve', 'rainbow'] as GrowthModel[]).map((model) => (
                <button
                  key={model}
                  type="button"
                  className={`model-btn ${growthModel === model ? 'active' : ''}`}
                  onClick={() => setGrowthModel(model)}
                >
                  {getModelDisplayName(model)}
                </button>
              ))}
            </div>
            <span className="input-hint">{getModelDescription(growthModel)}</span>
          </div>

          {/* Model-specific parameters */}
          {growthModel === 'cagr' && (
            <div className="input-group slider-group">
              <label htmlFor="cagr">Annual Growth Rate: <span className="slider-value">{Math.round((modelParams.cagr || 0.25) * 100)}%</span></label>
              <input
                id="cagr"
                type="range"
                min="0"
                max="100"
                value={(modelParams.cagr || 0.25) * 100}
                onChange={(e) => setModelParams({ ...modelParams, cagr: Number(e.target.value) / 100 })}
              />
              <div className="slider-labels">
                <span>0%</span>
                <span className="slider-marker" style={{ left: '25%' }}>25% typical</span>
                <span>100%</span>
              </div>
              <span className="input-hint">Historical crypto CAGR: 20-40% for mature assets. SOL 5yr avg ~50% but decelerating.</span>
            </div>
          )}

          {growthModel === 'powerlaw' && (
            <div className="input-group slider-group">
              <label htmlFor="powerLawSlope">Power Law Slope: <span className="slider-value">{(modelParams.powerLawSlope || 1.8).toFixed(1)}</span></label>
              <input
                id="powerLawSlope"
                type="range"
                min="1"
                max="3"
                step="0.1"
                value={modelParams.powerLawSlope || 1.8}
                onChange={(e) => setModelParams({ ...modelParams, powerLawSlope: Number(e.target.value) })}
              />
              <div className="slider-labels">
                <span>1.0 (conservative)</span>
                <span className="slider-marker" style={{ left: '40%' }}>1.8 typical</span>
                <span>3.0 (aggressive)</span>
              </div>
              <span className="input-hint">Higher slope = faster early growth that decelerates. BTC-like behavior around 1.5-2.0.</span>
            </div>
          )}

          {growthModel === 'scurve' && (
            <>
              <div className="input-group slider-group">
                <label htmlFor="sCurveMaxPrice">Max Price (Ceiling): <span className="slider-value">${(modelParams.sCurveMaxPrice || 50000).toLocaleString()}</span></label>
                <input
                  id="sCurveMaxPrice"
                  type="range"
                  min="1000"
                  max="100000"
                  step="1000"
                  value={modelParams.sCurveMaxPrice || 50000}
                  onChange={(e) => setModelParams({ ...modelParams, sCurveMaxPrice: Number(e.target.value) })}
                />
                <div className="slider-labels">
                  <span>$1K</span>
                  <span className="slider-marker" style={{ left: '30%' }}>$30K base case</span>
                  <span>$100K</span>
                </div>
                <span className="input-hint">If SOL captures 5-10% of global smart contract value, $20-50K plausible at full adoption.</span>
              </div>
              <div className="input-group slider-group">
                <label htmlFor="sCurveYearsToMidpoint">Years to 50% of Max: <span className="slider-value">{modelParams.sCurveYearsToMidpoint || 10} years</span></label>
                <input
                  id="sCurveYearsToMidpoint"
                  type="range"
                  min="5"
                  max="30"
                  value={modelParams.sCurveYearsToMidpoint || 10}
                  onChange={(e) => setModelParams({ ...modelParams, sCurveYearsToMidpoint: Number(e.target.value) })}
                />
                <div className="slider-labels">
                  <span>5 years (fast)</span>
                  <span className="slider-marker" style={{ left: '40%' }}>12-15yr typical</span>
                  <span>30 years (slow)</span>
                </div>
                <span className="input-hint">Internet took ~15 years from early adoption to mainstream. Crypto may be similar.</span>
              </div>
            </>
          )}

          {growthModel === 'rainbow' && (
            <div className="input-group">
              <label>Rainbow Band</label>
              <div className="rainbow-buttons">
                {([
                  { value: 'fire_sale' as const, label: 'Fire Sale', color: '#00bfff', mult: '0.3x', typical: false },
                  { value: 'buy' as const, label: 'Buy', color: '#00ff88', mult: '0.5x', typical: false },
                  { value: 'accumulate' as const, label: 'Accumulate', color: '#88ff00', mult: '0.75x', typical: true },
                  { value: 'hold' as const, label: 'Hold', color: '#ffff00', mult: '1.25x', typical: true },
                  { value: 'bubble' as const, label: 'Bubble', color: '#ff8800', mult: '2x', typical: false },
                  { value: 'fomo' as const, label: 'FOMO', color: '#ff0000', mult: '3.5x', typical: false },
                ]).map((band) => (
                  <button
                    key={band.value}
                    type="button"
                    className={`rainbow-btn ${modelParams.rainbowBand === band.value ? 'active' : ''} ${band.typical ? 'typical' : ''}`}
                    style={{ '--band-color': band.color } as React.CSSProperties}
                    onClick={() => setModelParams({ ...modelParams, rainbowBand: band.value })}
                  >
                    {band.label}
                    <span className="band-mult">{band.mult}</span>
                  </button>
                ))}
              </div>
              <span className="input-hint">Accumulate/Hold bands are typical fair value range. Multipliers shown relative to power law baseline.</span>
            </div>
          )}
        </section>

        {projection && (
          <section className="results-section">
            <div className="results-header">
              <h2>After {years} Years</h2>
              <button
                type="button"
                className="share-btn"
                onClick={() => shareProjection({
                  projection,
                  years,
                  growthModel,
                  dcaAmountUSD,
                  dcaFrequency,
                })}
              >
                Share
              </button>
            </div>

            <div className="summary-cards">
              <div className="summary-card">
                <span className="card-label">Portfolio Value</span>
                <span className="card-value highlight">{formatUSD(projection.finalValueUSD)}</span>
              </div>
              <div className="summary-card">
                <span className="card-label">SOL Accumulated</span>
                <span className="card-value">{formatSOL(projection.finalSOL)} SOL</span>
              </div>
              <div className="summary-card">
                <span className="card-label">SOL Price</span>
                <span className="card-value">${projection.finalPrice.toLocaleString()}</span>
              </div>
            </div>

            <div className="summary-row">
              <div className="summary-item">
                <span className="item-label">Total Invested:</span>
                <span className="item-value">{formatUSD(projection.totalInvestedUSD)}</span>
              </div>
              <div className="summary-item">
                <span className="item-label">Total Gain:</span>
                <span className="item-value gain">{formatUSD(projection.totalGainUSD)}</span>
              </div>
            </div>

            <div className="chart-container">
              <div className="chart-mode-toggle">
                <button
                  type="button"
                  className={`mode-btn ${!compareMode ? 'active' : ''}`}
                  onClick={() => setCompareMode(false)}
                >
                  Single Model
                </button>
                <button
                  type="button"
                  className={`mode-btn ${compareMode ? 'active' : ''}`}
                  onClick={() => setCompareMode(true)}
                >
                  Compare All
                </button>
              </div>
              {compareMode && currentPrice ? (
                <ComparisonChart
                  currentSOL={currentSOL}
                  currentPrice={currentPrice}
                  years={years}
                  dcaAmountUSD={dcaAmountUSD}
                  dcaFrequency={dcaFrequency}
                  modelParams={modelParams}
                />
              ) : (
                <GrowthChart
                  projections={projection.projections}
                />
              )}
            </div>

            <div className="projection-table">
              <h3>Year-by-Year Breakdown</h3>
              <table>
                <thead>
                  <tr>
                    <th>Year</th>
                    <th>SOL</th>
                    <th>Price</th>
                    <th>Value</th>
                    <th>Invested</th>
                  </tr>
                </thead>
                <tbody>
                  {projection.projections
                    .filter((_, i) => i % 5 === 4 || i === 0)
                    .map((p) => (
                      <tr key={p.year}>
                        <td>{p.year}</td>
                        <td>{formatSOL(p.solBalance)}</td>
                        <td>${p.solPrice.toLocaleString()}</td>
                        <td>{formatUSD(p.portfolioValueUSD)}</td>
                        <td>{formatUSD(p.totalInvestedUSD)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>

      <footer className="footer">
        <p>RetireOnSol - Plan your SOL accumulation journey</p>
        <p className="disclaimer">
          Not financial advice. Projections are hypothetical and do not guarantee future results.
        </p>
      </footer>
    </div>
  );
}

export default App;
