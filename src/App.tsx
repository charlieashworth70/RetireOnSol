import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import {
  calculateProjection,
  formatUSD,
  formatSOL,
  type ProjectionInput,
  type ProjectionResult,
  type GrowthModel,
  type GrowthModelParams,
} from './utils/calculations';
import { calculateDCASchedule } from './utils/dcaSchedule';
import { notificationService } from './services/notificationService';
import { getModelDisplayName, getModelDescription, getFuturePowerLawFairValue, type CAGRDecayType } from './utils/growthModels';
import { toTodaysDollars, type InflationParams } from './utils/inflation';
import { runMonteCarloSimulation, type MonteCarloParams, type MonteCarloResult, type VolatilityDecayType } from './utils/monteCarlo';
import { fetchSOLPrice, startPriceRefresh } from './utils/solPrice';
import { loadSettings, saveSettings, clearSettings, saveActivePlan, loadActivePlan, clearActivePlan, DEFAULT_SETTINGS, type ActivePlan, type StoredSettings } from './utils/storage';
import { GrowthChart } from './components/GrowthChart';
import { ComparisonChart } from './components/ComparisonChart';
import { SpendTab } from './components/SpendTab';
import { CancelPlanModal } from './components/CancelPlanModal';
import { MonitorAccum } from './components/MonitorAccum';
import { MonitorDecum } from './components/MonitorDecum';
import { useWalletBalance } from './hooks/useWalletBalance';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { shareProjection } from './utils/shareImage';
import { useDemoMode } from './contexts/DemoContext';
import { DemoPanel } from './components/DemoPanel';
import './App.css';

type DCAFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';
type MainTab = 'plan' | 'monitor';
type PlanSubTab = 'grow' | 'spend';
type MonitorSubTab = 'accum' | 'decum';

// Load initial settings from localStorage
const initialSettings = loadSettings();

function App() {
  const demo = useDemoMode();

  // Tab state - two-level navigation
  const [mainTab, setMainTab] = useState<MainTab>('plan');
  const [planTab, setPlanTab] = useState<PlanSubTab>('grow');
  const [monitorTab, setMonitorTab] = useState<MonitorSubTab>('accum');

  // Active plan state
  const [activePlan, setActivePlan] = useState<ActivePlan | null>(() => loadActivePlan());
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showExecuteModal, setShowExecuteModal] = useState(false);

  // Spend Now mode - skip grow phase and go straight to spend
  const [spendNowMode, setSpendNowMode] = useState(false);

  // Form state (with localStorage defaults)
  const [currentSOL, setCurrentSOL] = useState<number>(initialSettings.currentSOL ?? DEFAULT_SETTINGS.currentSOL);
  const [currentJitoSOL, setCurrentJitoSOL] = useState<number>(initialSettings.currentJitoSOL ?? DEFAULT_SETTINGS.currentJitoSOL);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [priceLoading, setPriceLoading] = useState<boolean>(true);
  const [priceError, setPriceError] = useState<string | null>(null);
  const [years, setYears] = useState<number>(initialSettings.years ?? DEFAULT_SETTINGS.years);
  const [dcaAmountUSD, setDcaAmountUSD] = useState<number>(initialSettings.dcaAmountUSD ?? DEFAULT_SETTINGS.dcaAmountUSD);
  const [dcaMaxLimit, setDcaMaxLimit] = useState<number>(initialSettings.dcaMaxLimit ?? DEFAULT_SETTINGS.dcaMaxLimit);
  const [dcaFrequency, setDcaFrequency] = useState<DCAFrequency>(initialSettings.dcaFrequency ?? DEFAULT_SETTINGS.dcaFrequency);

  // Growth model state (with localStorage defaults)
  const [growthModel, setGrowthModel] = useState<GrowthModel>(initialSettings.growthModel ?? DEFAULT_SETTINGS.growthModel);
  const [modelParams, setModelParams] = useState<GrowthModelParams>({
    cagr: initialSettings.modelParams?.cagr ?? DEFAULT_SETTINGS.modelParams.cagr,
    cagrDecay: initialSettings.modelParams?.cagrDecay ?? DEFAULT_SETTINGS.modelParams.cagrDecay,
    powerLawSlope: initialSettings.modelParams?.powerLawSlope ?? DEFAULT_SETTINGS.modelParams.powerLawSlope,
    sCurveYearsToHalfRemaining: initialSettings.modelParams?.sCurveYearsToHalfRemaining ?? DEFAULT_SETTINGS.modelParams.sCurveYearsToHalfRemaining,
  });

  // Calculate dynamic asymptotic ceiling based on power law growth (normalized to current price)
  const dynamicCeiling = useMemo(() => {
    if (currentPrice === null) return 50000; // fallback
    const slope = modelParams.powerLawSlope || 1.6;
    // Get power law fair values for today and future to derive growth multiplier
    const todayFairValue = getFuturePowerLawFairValue(0, slope);
    const futureFairValue = getFuturePowerLawFairValue(years, slope);
    const growthMultiplier = futureFairValue / todayFairValue;
    // Apply multiplier to current price (normalized approach)
    const normalizedCeiling = currentPrice * growthMultiplier;
    // Round to nearest $1000
    return Math.round(normalizedCeiling / 1000) * 1000;
  }, [years, modelParams.powerLawSlope, currentPrice]);
  const [compareMode, setCompareMode] = useState(false);
  const [growthModelExpanded, setGrowthModelExpanded] = useState(false);

  // Inflation & Debasement state (with localStorage defaults)
  const [inflationEnabled, setInflationEnabled] = useState(initialSettings.inflationEnabled ?? DEFAULT_SETTINGS.inflationEnabled);
  const [inflationExpanded, setInflationExpanded] = useState(false);
  const [inflationType, setInflationType] = useState<'linear' | 'cyclical'>(initialSettings.inflationType ?? DEFAULT_SETTINGS.inflationType);
  const [inflationRate, setInflationRate] = useState(initialSettings.inflationRate ?? DEFAULT_SETTINGS.inflationRate);
  const [inflationAmplitude, setInflationAmplitude] = useState(initialSettings.inflationAmplitude ?? DEFAULT_SETTINGS.inflationAmplitude);
  const [inflationCyclePeriod, setInflationCyclePeriod] = useState(initialSettings.inflationCyclePeriod ?? DEFAULT_SETTINGS.inflationCyclePeriod);
  const [debasementRate, setDebasementRate] = useState(initialSettings.debasementRate ?? DEFAULT_SETTINGS.debasementRate);

  // Monte Carlo state (with localStorage defaults)
  const [mcEnabled, setMcEnabled] = useState(initialSettings.mcEnabled ?? DEFAULT_SETTINGS.mcEnabled);
  const [mcExpanded, setMcExpanded] = useState(false);
  const [mcVolatility, setMcVolatility] = useState(initialSettings.mcVolatility ?? DEFAULT_SETTINGS.mcVolatility);
  const [mcVolatilityDecay, setMcVolatilityDecay] = useState<VolatilityDecayType>(initialSettings.mcVolatilityDecay ?? DEFAULT_SETTINGS.mcVolatilityDecay);
  const [mcSimulations, setMcSimulations] = useState(initialSettings.mcSimulations ?? DEFAULT_SETTINGS.mcSimulations);
  const [mcCalculating, setMcCalculating] = useState(false);

  // JitoSOL staking state
  const [jitoSOLEnabled, setJitoSOLEnabled] = useState(initialSettings.jitoSOLEnabled ?? false);
  const [jitoSOLAPR, setJitoSOLAPR] = useState(initialSettings.jitoSOLAPR ?? 0.075);

  // Reset key - incremented when Reset All Settings is clicked to trigger SpendTab reset
  const [resetKey, setResetKey] = useState(0);

  // Scroll to top on tab change
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [mainTab, planTab, monitorTab]);

  // Demo Mode: Check for due notifications when time advances
  const lastNotifiedRef = useRef<string | null>(null);

  useEffect(() => {
    if (demo.enabled && activePlan && demo.demoDate) {
      const schedule = calculateDCASchedule(
        activePlan.activatedAt,
        activePlan.settings.dcaFrequency,
        activePlan.settings.dcaAmountUSD,
        demo.demoDate
      );
      
      const latestDueDate = schedule.allDueDates[schedule.allDueDates.length - 1];
      
      // Notify if we have a due date that hasn't been marked complete
      // And we haven't already notified for this specific date in this session
      if (latestDueDate) {
        const dateIso = latestDueDate.toISOString();
        if (dateIso !== lastNotifiedRef.current && !demo.completedDCAs.has(dateIso)) {
          // Fire notification
          notificationService.scheduleMissedDCAReminder(
            activePlan.settings.dcaAmountUSD,
            Math.max(0, Math.floor((demo.demoDate.getTime() - latestDueDate.getTime()) / (1000 * 60 * 60 * 24)))
          );
          lastNotifiedRef.current = dateIso;
        }
      }
    }
  }, [demo.demoDate, demo.enabled, activePlan, demo.completedDCAs]);

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

  // Save settings to localStorage when they change
  useEffect(() => {
    saveSettings({
      currentSOL,
      currentJitoSOL,
      years,
      dcaAmountUSD,
      dcaMaxLimit,
      dcaFrequency,
      growthModel,
      modelParams,
      inflationEnabled,
      inflationType,
      inflationRate,
      inflationAmplitude,
      inflationCyclePeriod,
      debasementRate,
      mcEnabled,
      mcVolatility,
      mcVolatilityDecay,
      mcSimulations,
      jitoSOLEnabled,
      jitoSOLAPR,
    });
  }, [
    currentSOL, currentJitoSOL, years, dcaAmountUSD, dcaMaxLimit, dcaFrequency,
    growthModel, modelParams,
    inflationEnabled, inflationType, inflationRate, inflationAmplitude, inflationCyclePeriod, debasementRate,
    mcEnabled, mcVolatility, mcVolatilityDecay, mcSimulations,
    jitoSOLEnabled, jitoSOLAPR,
  ]);

  // Reset all settings to defaults
  const resetSettings = useCallback(() => {
    if (window.confirm('Reset all settings to defaults? This cannot be undone.')) {
      clearSettings();
      setCurrentSOL(DEFAULT_SETTINGS.currentSOL);
      setCurrentJitoSOL(DEFAULT_SETTINGS.currentJitoSOL);
      setYears(DEFAULT_SETTINGS.years);
      setDcaAmountUSD(DEFAULT_SETTINGS.dcaAmountUSD);
      setDcaMaxLimit(DEFAULT_SETTINGS.dcaMaxLimit);
      setDcaFrequency(DEFAULT_SETTINGS.dcaFrequency);
      setGrowthModel(DEFAULT_SETTINGS.growthModel);
      setModelParams({
        cagr: DEFAULT_SETTINGS.modelParams.cagr,
        cagrDecay: DEFAULT_SETTINGS.modelParams.cagrDecay,
        powerLawSlope: DEFAULT_SETTINGS.modelParams.powerLawSlope,
        sCurveYearsToHalfRemaining: DEFAULT_SETTINGS.modelParams.sCurveYearsToHalfRemaining,
      });
      setInflationEnabled(DEFAULT_SETTINGS.inflationEnabled);
      setInflationType(DEFAULT_SETTINGS.inflationType);
      setInflationRate(DEFAULT_SETTINGS.inflationRate);
      setInflationAmplitude(DEFAULT_SETTINGS.inflationAmplitude);
      setInflationCyclePeriod(DEFAULT_SETTINGS.inflationCyclePeriod);
      setDebasementRate(DEFAULT_SETTINGS.debasementRate);
      setMcEnabled(DEFAULT_SETTINGS.mcEnabled);
      setMcVolatility(DEFAULT_SETTINGS.mcVolatility);
      setMcVolatilityDecay(DEFAULT_SETTINGS.mcVolatilityDecay);
      setMcSimulations(DEFAULT_SETTINGS.mcSimulations);
      setJitoSOLEnabled(false);
      setJitoSOLAPR(0.075);
      // Trigger SpendTab reset
      setResetKey(k => k + 1);
    }
  }, []);

  // Execute Plan handler - saves current settings as active plan
  const executePlan = useCallback(() => {
    // Reload latest settings from storage to capture changes made in SpendTab
    const latestSettings = loadSettings();

    const currentSettings: StoredSettings = {
      currentSOL,
      currentJitoSOL,
      years,
      dcaAmountUSD,
      dcaMaxLimit,
      dcaFrequency,
      growthModel,
      modelParams,
      inflationEnabled,
      inflationType,
      inflationRate,
      inflationAmplitude,
      inflationCyclePeriod,
      debasementRate,
      mcEnabled,
      mcVolatility,
      mcVolatilityDecay,
      mcSimulations,
      jitoSOLEnabled,
      jitoSOLAPR,
      // Use latest spend settings from storage
      spendMonthlyIncome: latestSettings.spendMonthlyIncome ?? DEFAULT_SETTINGS.spendMonthlyIncome,
      spendMonthlyIncomeMax: latestSettings.spendMonthlyIncomeMax ?? DEFAULT_SETTINGS.spendMonthlyIncomeMax,
      spendRetirementYears: latestSettings.spendRetirementYears ?? DEFAULT_SETTINGS.spendRetirementYears,
      spendVolatility: latestSettings.spendVolatility ?? DEFAULT_SETTINGS.spendVolatility,
      spendRealGrowthRate: latestSettings.spendRealGrowthRate ?? DEFAULT_SETTINGS.spendRealGrowthRate,
      spendInflationRate: latestSettings.spendInflationRate ?? DEFAULT_SETTINGS.spendInflationRate,
      spendSimulations: latestSettings.spendSimulations ?? DEFAULT_SETTINGS.spendSimulations,
    };
    const plan: ActivePlan = {
      activatedAt: new Date().toISOString(),
      settings: currentSettings,
      startPhase: spendNowMode ? 'decum' : 'accum',
    };
    saveActivePlan(plan);
    setActivePlan(plan);
    setShowExecuteModal(false);
    setMainTab('monitor');
    setMonitorTab('accum');
  }, [currentSOL, currentJitoSOL, years, dcaAmountUSD, dcaMaxLimit, dcaFrequency, growthModel, modelParams, inflationEnabled, inflationType, inflationRate, inflationAmplitude, inflationCyclePeriod, debasementRate, mcEnabled, mcVolatility, mcVolatilityDecay, mcSimulations, jitoSOLEnabled, jitoSOLAPR]);

  // Cancel execution handler (confirmed from modal)
  const cancelExecution = useCallback(() => {
    clearActivePlan();
    setActivePlan(null);
    setShowCancelModal(false);
    setMainTab('plan');
  }, []);

  // Wallet integration for "Import from Wallet"
  const { connected } = useWallet();
  const { setVisible: setWalletModalVisible } = useWalletModal();
  const { balance: walletBalance, jitoSolBalance: walletJitoSolBalance, loading: walletLoading, error: walletError } = useWalletBalance();
  const [walletImported, setWalletImported] = useState(false);
  const walletImportTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track if we're waiting for wallet connection to import
  const [pendingImport, setPendingImport] = useState(false);

  // When wallet connects and we have a pending import, do the import
  useEffect(() => {
    if (pendingImport && connected && !walletLoading) {
      if (walletBalance !== null) {
        setCurrentSOL(walletBalance);
        setCurrentJitoSOL(walletJitoSolBalance ?? 0);
        setPendingImport(false);
        setWalletImported(true);
        if (walletImportTimerRef.current) clearTimeout(walletImportTimerRef.current);
        walletImportTimerRef.current = setTimeout(() => setWalletImported(false), 3000);
      } else if (walletError) {
        setPendingImport(false);
        alert(`Failed to import wallet balance: ${walletError}`);
      }
    }
  }, [pendingImport, connected, walletLoading, walletBalance, walletJitoSolBalance, walletError]);

  // Import from wallet handler
  const importFromWallet = useCallback(() => {
    // In Demo Mode, simulate wallet import with demo balances
    if (demo.enabled) {
      setCurrentSOL(demo.solBalance);
      setCurrentJitoSOL(demo.jitoSolBalance);
      setWalletImported(true);
      if (walletImportTimerRef.current) clearTimeout(walletImportTimerRef.current);
      walletImportTimerRef.current = setTimeout(() => setWalletImported(false), 3000);
      return;
    }

    if (connected && walletBalance !== null) {
      // Already connected — import immediately
      setCurrentSOL(walletBalance);
      setCurrentJitoSOL(walletJitoSolBalance ?? 0);
      setWalletImported(true);
      if (walletImportTimerRef.current) clearTimeout(walletImportTimerRef.current);
      walletImportTimerRef.current = setTimeout(() => setWalletImported(false), 3000);
    } else if (connected && walletError) {
      alert(`Could not fetch wallet balance: ${walletError}`);
    } else {
      // Not connected or loading — open modal and set pending
      setPendingImport(true);
      setWalletModalVisible(true);
    }
  }, [connected, walletBalance, walletJitoSolBalance, setWalletModalVisible, walletError, demo.enabled, demo.solBalance, demo.jitoSolBalance]);

  // Effective model params with dynamic ceiling for scurve
  const effectiveModelParams = useMemo(() => ({
    ...modelParams,
    // Always use dynamic ceiling for scurve (no manual override anymore)
    sCurveMaxPrice: dynamicCeiling,
  }), [modelParams, dynamicCeiling]);

  // Calculate projections
  // When JitoSOL staking is enabled, JitoSOL holdings are included in the total SOL
  // since JitoSOL ≈ SOL (liquid staking token) and earns the JitoSOL APR
  const effectiveSOL = jitoSOLEnabled ? currentSOL + currentJitoSOL : currentSOL + currentJitoSOL;
  const projection = useMemo<ProjectionResult | null>(() => {
    if (currentPrice === null) return null;
    const input: ProjectionInput = {
      currentSOL: effectiveSOL,
      currentPrice,
      years,
      dcaAmountUSD,
      dcaFrequency,
      growthModel,
      modelParams: effectiveModelParams,
      jitoSOLEnabled,
      jitoSOLAPR,
    };
    return calculateProjection(input);
  }, [effectiveSOL, currentPrice, years, dcaAmountUSD, dcaFrequency, growthModel, effectiveModelParams, jitoSOLEnabled, jitoSOLAPR]);

  // Inflation params for today's dollars calculation
  const inflationParams: InflationParams = useMemo(() => ({
    enabled: inflationEnabled,
    type: inflationType,
    rate: inflationRate,
    amplitude: inflationAmplitude,
    cyclePeriod: inflationCyclePeriod,
    debasementRate: debasementRate,
  }), [inflationEnabled, inflationType, inflationRate, inflationAmplitude, inflationCyclePeriod, debasementRate]);

  // Calculate today's dollars value
  const todaysDollarsValue = useMemo(() => {
    if (!projection || !inflationEnabled) return null;
    return toTodaysDollars(projection.finalValueUSD, years, inflationParams);
  }, [projection, years, inflationParams, inflationEnabled]);

  // Inflation adjustment function for charts (adjusts value at specific year)
  const inflationAdjustmentFn = useCallback((value: number, year: number) => {
    return toTodaysDollars(value, year, inflationParams);
  }, [inflationParams]);

  // Monte Carlo params
  const mcParams: MonteCarloParams = useMemo(() => ({
    enabled: mcEnabled,
    volatility: mcVolatility,
    volatilityDecay: mcVolatilityDecay,
    simulations: mcSimulations,
  }), [mcEnabled, mcVolatility, mcVolatilityDecay, mcSimulations]);

  // Monte Carlo simulation results (with loading state)
  const [mcResult, setMcResult] = useState<MonteCarloResult | null>(null);

  useEffect(() => {
    if (!mcEnabled || currentPrice === null) {
      setMcResult(null);
      setMcCalculating(false);
      return;
    }

    // Show loading state
    setMcCalculating(true);

    // Use setTimeout to allow UI to update before heavy calculation
    // Small delay ensures spinner is visible even on fast machines
    const timeoutId = setTimeout(() => {
      const result = runMonteCarloSimulation(
        effectiveSOL,
        currentPrice,
        years,
        dcaAmountUSD,
        dcaFrequency,
        growthModel,
        effectiveModelParams,
        mcParams,
        jitoSOLEnabled,
        jitoSOLAPR
      );
      setMcResult(result);
      setMcCalculating(false);
    }, 50);

    return () => clearTimeout(timeoutId);
  }, [mcEnabled, effectiveSOL, currentPrice, years, dcaAmountUSD, dcaFrequency, growthModel, effectiveModelParams, mcParams, jitoSOLEnabled, jitoSOLAPR]);

  return (
    <div className="app">
      <header className="header">
        <div className="header-top">
          <div className="header-brand">
            <img
              src="/icons/icon.svg"
              alt="RetireOnSol"
              className="header-logo"
              onClick={demo.handleLogoClick}
              style={{ cursor: 'pointer' }}
            />
            <div className="header-title-group">
              <h1>RetireOnSol</h1>
              <p className="subtitle">Plan your SOL accumulation journey</p>
            </div>
            {demo.enabled && (
              <span style={{
                background: 'rgba(245, 166, 35, 0.2)',
                border: '1px solid #F5A623',
                color: '#F5A623',
                padding: '2px 8px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 'bold',
                marginLeft: '8px',
                whiteSpace: 'nowrap',
              }}>
                🧪 DEMO
              </span>
            )}
          </div>
          {/* Wallet button removed from header — import from wallet is near holdings inputs */}
        </div>
      </header>

      {/* Main Tab Navigation */}
      <nav className="main-tab-nav">
        <button
          type="button"
          className={`main-tab-btn ${mainTab === 'plan' ? 'active' : ''}`}
          onClick={() => setMainTab('plan')}
        >
          Plan
        </button>
        <button
          type="button"
          className={`main-tab-btn ${mainTab === 'monitor' ? 'active' : ''}`}
          onClick={() => setMainTab('monitor')}
        >
          Monitor
          {activePlan && <span className="active-plan-badge">Active</span>}
        </button>
      </nav>

      {/* Sub Tab Navigation */}
      {mainTab === 'plan' && (
        <nav className="sub-tab-nav">
          <button
            type="button"
            className={`sub-tab-btn ${planTab === 'grow' ? 'active' : ''}`}
            onClick={() => setPlanTab('grow')}
          >
            Grow
          </button>
          <button
            type="button"
            className={`sub-tab-btn ${planTab === 'spend' ? 'active' : ''}`}
            onClick={() => setPlanTab('spend')}
          >
            Spend
          </button>
        </nav>
      )}

      {mainTab === 'monitor' && (
        <nav className="sub-tab-nav">
          <button
            type="button"
            className={`sub-tab-btn ${monitorTab === 'accum' ? 'active' : ''}`}
            onClick={() => setMonitorTab('accum')}
          >
            Accum
          </button>
          <button
            type="button"
            className={`sub-tab-btn ${monitorTab === 'decum' ? 'active' : ''}`}
            onClick={() => setMonitorTab('decum')}
          >
            Decum
          </button>
        </nav>
      )}

      <main className="main">
        {activePlan && mainTab === 'plan' && (
          <div style={{
            background: 'rgba(245, 166, 35, 0.1)',
            border: '1px solid rgba(245, 166, 35, 0.3)',
            borderRadius: '8px',
            padding: '12px',
            marginBottom: '16px',
            fontSize: '0.9rem',
            color: '#F5A623',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <span style={{ fontSize: '1.2rem' }}>📝</span>
            <div>
              <strong>Editing Mode</strong>
              <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>
                You have an active plan running. Changes made here won't affect your tracked plan unless you click <strong>Execute Plan</strong> again.
              </div>
            </div>
          </div>
        )}

        {/* GROW TAB */}
        {mainTab === 'plan' && planTab === 'grow' && (
          <>
        <section className="input-section">
          <div className="holdings-header">
            <h2>Your SOL Holdings</h2>
            <button
              type="button"
              className="import-wallet-btn"
              onClick={importFromWallet}
              disabled={walletLoading}
            >
              {walletLoading ? '⏳ Loading...' : '🔗 Import from Wallet'}
            </button>
          </div>
          {walletImported && (
            <div className="wallet-imported-notice">
              ✅ Imported from wallet
            </div>
          )}

          <div className="input-row">
            <div className="input-group">
              <label htmlFor="currentSOL">Current SOL</label>
              <div className="sol-input-wrapper">
                <input
                  id="currentSOL"
                  type="number"
                  min="0"
                  step="1"
                  value={currentSOL || ''}
                  onChange={(e) => setCurrentSOL(e.target.value === '' ? 0 : Number(e.target.value))}
                />
              </div>
            </div>

            <div className="input-group">
              <label htmlFor="currentJitoSOL">Current JitoSOL</label>
              <div className="sol-input-wrapper">
                <input
                  id="currentJitoSOL"
                  type="number"
                  min="0"
                  step="0.01"
                  value={currentJitoSOL || ''}
                  onChange={(e) => setCurrentJitoSOL(e.target.value === '' ? 0 : Number(e.target.value))}
                />
              </div>
            </div>
          </div>

          <div className="input-row">
            <div className="input-group">
              <label>Current Price</label>
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

          {currentPrice !== null && (
            <div className="current-value-display">
              Current Value: <span className="highlight">{formatUSD((currentSOL + currentJitoSOL) * currentPrice)}</span>
              {currentJitoSOL > 0 && (
                <span className="value-breakdown"> ({currentSOL} SOL + {currentJitoSOL} JitoSOL)</span>
              )}
            </div>
          )}

          {/* Spend Now Toggle */}
          <div className="spend-now-toggle">
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={spendNowMode}
                onChange={(e) => setSpendNowMode(e.target.checked)}
              />
              <span className="toggle-slider"></span>
            </label>
            <div className="toggle-text">
              <span className="toggle-label">Spend Now</span>
              <span className="toggle-hint">
                {spendNowMode
                  ? 'Skip to Spend tab with current holdings'
                  : 'Plan accumulation before spending'}
              </span>
            </div>
          </div>
        </section>

        {/* JitoSOL Staking Toggle */}
        {!spendNowMode && (
          <section className="input-section jitosol-section">
            <div className="jitosol-toggle">
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={jitoSOLEnabled}
                  onChange={(e) => setJitoSOLEnabled(e.target.checked)}
                />
                <span className="toggle-slider"></span>
              </label>
              <div className="toggle-text">
                <span className="toggle-label">Stake to JitoSOL</span>
                <span className="toggle-hint">
                  {jitoSOLEnabled
                    ? `Earning ~${(jitoSOLAPR * 100).toFixed(1)}% APR compounding on SOL balance`
                    : 'Earn staking yield on your SOL holdings'}
                </span>
              </div>
            </div>

            {jitoSOLEnabled && (
              <div className="jitosol-params">
                <div className="input-group slider-group">
                  <label htmlFor="jitoSOLAPR">
                    JitoSOL APR: <span className="slider-value">{(jitoSOLAPR * 100).toFixed(1)}%</span>
                  </label>
                  <input
                    id="jitoSOLAPR"
                    type="range"
                    min="3"
                    max="12"
                    step="0.5"
                    value={jitoSOLAPR * 100}
                    onChange={(e) => setJitoSOLAPR(Number(e.target.value) / 100)}
                  />
                  <div className="slider-labels">
                    <span>3%</span>
                    <span className="slider-marker" style={{ left: '50%' }}>7.5% current</span>
                    <span>12%</span>
                  </div>
                  <span className="input-hint">
                    JitoSOL earns MEV-boosted staking rewards. Current APR ~7-8%. Compounds your SOL balance annually.
                  </span>
                </div>
              </div>
            )}
          </section>
        )}

        {!spendNowMode && (
          <>
          <section className="input-section">
            <h2>Accumulation Plan</h2>

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

          <div className="input-group slider-group">
            <label htmlFor="dcaAmountUSD">DCA per Period: <span className="slider-value">${dcaAmountUSD}</span></label>
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
        </section>

        <section className="input-section">
          <h2>Growth Model</h2>

          <div className="input-group">
            <label>Price Projection Model</label>
            <div className="model-buttons">
              {(['cagr', 'powerlaw', 'scurve'] as GrowthModel[]).map((model) => (
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

          {/* Expandable parameters toggle */}
          <button
            type="button"
            className={`params-toggle ${growthModelExpanded ? 'expanded' : ''}`}
            onClick={() => setGrowthModelExpanded(!growthModelExpanded)}
          >
            <span className="params-toggle-label">Parameters</span>
            <span className="params-toggle-summary">
              {growthModel === 'cagr' && `${Math.round((modelParams.cagr || 0.25) * 100)}%${modelParams.cagrDecay === 'auto' ? ' + auto decay' : ''}`}
              {growthModel === 'powerlaw' && `slope ${(modelParams.powerLawSlope || 1.6).toFixed(1)}`}
              {growthModel === 'scurve' && `$${(dynamicCeiling / 1000).toFixed(0)}K ceiling, ${modelParams.sCurveYearsToHalfRemaining || 12}yr`}
            </span>
            <span className={`toggle-arrow ${growthModelExpanded ? 'expanded' : ''}`}>▼</span>
          </button>

          {/* Model-specific parameters */}
          <div className={`growth-params-content ${growthModelExpanded ? 'expanded' : ''}`}>
          {growthModel === 'cagr' && (
            <>
              <div className="input-group slider-group">
                <label htmlFor="cagr">Starting Growth Rate: <span className="slider-value">{Math.round((modelParams.cagr || 0.25) * 100)}%</span></label>
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
              <div className="input-group">
                <label>CAGR Decay</label>
                <div className="decay-buttons">
                  {([
                    { value: 'none' as CAGRDecayType, label: 'None' },
                    { value: 'auto' as CAGRDecayType, label: 'Auto' },
                  ]).map((decay) => (
                    <button
                      key={decay.value}
                      type="button"
                      className={`decay-btn ${modelParams.cagrDecay === decay.value ? 'active' : ''}`}
                      onClick={() => setModelParams({ ...modelParams, cagrDecay: decay.value })}
                    >
                      {decay.label}
                    </button>
                  ))}
                </div>
                <span className="input-hint">
                  {modelParams.cagrDecay === 'none'
                    ? 'Constant CAGR forever - unrealistic but simple.'
                    : 'Realistic decay adapts to your time horizon. Fast decay early, stabilizing over time. Floor: 3%.'}
                </span>
              </div>
            </>
          )}

          {growthModel === 'powerlaw' && (
            <div className="input-group slider-group">
              <label htmlFor="powerLawSlope">Power Law Slope: <span className="slider-value">{(modelParams.powerLawSlope || 1.6).toFixed(1)}</span></label>
              <input
                id="powerLawSlope"
                type="range"
                min="1"
                max="3"
                step="0.1"
                value={modelParams.powerLawSlope || 1.6}
                onChange={(e) => setModelParams({ ...modelParams, powerLawSlope: Number(e.target.value) })}
              />
              <div className="slider-labels">
                <span>1.0</span>
                <span className="slider-marker" style={{ left: '30%' }}>1.6 SOL default</span>
                <span>3.0</span>
              </div>
              <span className="input-hint">Growth rate derived from SOL historical regression. Normalized to today's price.</span>
            </div>
          )}

          {growthModel === 'scurve' && (
            <>
              <div className="input-group">
                <label>Price Ceiling</label>
                <div className="ceiling-display">
                  <span className="ceiling-value">${dynamicCeiling.toLocaleString()}</span>
                  <span className="ceiling-note">at {years} years</span>
                </div>
                <span className="input-hint">Ceiling adjusts based on your time to retirement.</span>
              </div>
              <div className="input-group slider-group">
                <label htmlFor="sCurveYearsToHalfRemaining">Years to 50% of Remaining: <span className="slider-value">{modelParams.sCurveYearsToHalfRemaining || 12} years</span></label>
                <input
                  id="sCurveYearsToHalfRemaining"
                  type="range"
                  min="5"
                  max="30"
                  value={modelParams.sCurveYearsToHalfRemaining || 12}
                  onChange={(e) => setModelParams({ ...modelParams, sCurveYearsToHalfRemaining: Number(e.target.value) })}
                />
                <div className="slider-labels">
                  <span>5 years (fast)</span>
                  <span className="slider-marker" style={{ left: '28%' }}>12yr typical</span>
                  <span>30 years (slow)</span>
                </div>
                <span className="input-hint">Years to capture half the remaining upside to ceiling. Lower = faster adoption.</span>
              </div>
            </>
          )}

          </div>
        </section>

        {/* Inflation & Debasement Collapsible Section */}
        <section className="inflation-section">
          <div className={`inflation-toggle ${inflationEnabled ? 'enabled' : ''} ${inflationExpanded ? 'expanded-below' : ''}`}>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={inflationEnabled}
                onChange={(e) => setInflationEnabled(e.target.checked)}
              />
              <span className="toggle-slider"></span>
            </label>
            <div className="toggle-text">
              <span className="toggle-label">Inflation & Debasement</span>
              <span className="inflation-summary">
                {!inflationEnabled
                  ? 'Off'
                  : `${inflationType === 'cyclical'
                      ? `~${(inflationRate * 100).toFixed(1)}% cyclical`
                      : `${(inflationRate * 100).toFixed(1)}%`} + ${(debasementRate * 100).toFixed(0)}% debasement`}
              </span>
            </div>
            <button
              type="button"
              className="toggle-arrow-btn"
              onClick={() => setInflationExpanded(!inflationExpanded)}
              aria-label={inflationExpanded ? 'Collapse' : 'Expand'}
            >
              <span className={`toggle-arrow ${inflationExpanded ? 'expanded' : ''}`}>▼</span>
            </button>
          </div>

          <div className={`inflation-content ${inflationExpanded ? 'expanded' : ''}`}>
            <div className="input-group">
              <label>Inflation Model</label>
              <div className="decay-buttons">
                <button
                  type="button"
                  className={`decay-btn ${inflationType === 'linear' ? 'active' : ''}`}
                  onClick={() => setInflationType('linear')}
                >
                  Linear
                </button>
                <button
                  type="button"
                  className={`decay-btn ${inflationType === 'cyclical' ? 'active' : ''}`}
                  onClick={() => setInflationType('cyclical')}
                >
                  Cyclical
                </button>
              </div>
              <span className="input-hint">
                {inflationType === 'linear'
                  ? 'Constant inflation rate each year.'
                  : 'Models business cycle with peaks and troughs. Avg cycle: 6-7 years.'}
              </span>
            </div>

            <div className="input-group slider-group">
              <label htmlFor="inflationRate">
                {inflationType === 'linear' ? 'Inflation Rate' : 'Base Inflation'}: <span className="slider-value">{(inflationRate * 100).toFixed(1)}%</span>
              </label>
              <input
                id="inflationRate"
                type="range"
                min="0"
                max="10"
                step="0.5"
                value={inflationRate * 100}
                onChange={(e) => setInflationRate(Number(e.target.value) / 100)}
              />
              <div className="slider-labels">
                <span>0%</span>
                <span className="slider-marker" style={{ left: '35%' }}>3.5% historical avg</span>
                <span>10%</span>
              </div>
            </div>

            {inflationType === 'cyclical' && (
              <>
                <div className="input-group slider-group">
                  <label htmlFor="inflationAmplitude">Cycle Amplitude: <span className="slider-value">±{(inflationAmplitude * 100).toFixed(1)}%</span></label>
                  <input
                    id="inflationAmplitude"
                    type="range"
                    min="0"
                    max="5"
                    step="0.5"
                    value={inflationAmplitude * 100}
                    onChange={(e) => setInflationAmplitude(Number(e.target.value) / 100)}
                  />
                  <div className="slider-labels">
                    <span>0%</span>
                    <span className="slider-marker" style={{ left: '40%' }}>±2% typical</span>
                    <span>±5%</span>
                  </div>
                  <span className="input-hint">With 3.5% base and 2% amplitude: inflation swings between 1.5% and 5.5%.</span>
                </div>

                <div className="input-group slider-group">
                  <label htmlFor="inflationCycle">Cycle Period: <span className="slider-value">{inflationCyclePeriod} years</span></label>
                  <input
                    id="inflationCycle"
                    type="range"
                    min="4"
                    max="12"
                    step="1"
                    value={inflationCyclePeriod}
                    onChange={(e) => setInflationCyclePeriod(Number(e.target.value))}
                  />
                  <div className="slider-labels">
                    <span>4 yrs</span>
                    <span className="slider-marker" style={{ left: '38%' }}>7 yrs historical</span>
                    <span>12 yrs</span>
                  </div>
                </div>
              </>
            )}

            <div className="input-group slider-group">
              <label htmlFor="debasement">Currency Debasement: <span className="slider-value">{(debasementRate * 100).toFixed(1)}%</span></label>
              <input
                id="debasement"
                type="range"
                min="0"
                max="15"
                step="0.5"
                value={debasementRate * 100}
                onChange={(e) => setDebasementRate(Number(e.target.value) / 100)}
              />
              <div className="slider-labels">
                <span>0%</span>
                <span className="slider-marker" style={{ left: '47%' }}>7% M2 avg</span>
                <span>15%</span>
              </div>
              <span className="input-hint">M2 money supply growth. Affects purchasing power vs hard assets like property.</span>
            </div>
          </div>
        </section>

        {/* Monte Carlo Simulation Section */}
        <section className="montecarlo-section">
          <div className={`montecarlo-toggle ${mcEnabled ? 'enabled' : ''} ${mcExpanded ? 'expanded-below' : ''}`}>
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={mcEnabled}
                onChange={(e) => setMcEnabled(e.target.checked)}
              />
              <span className="toggle-slider"></span>
            </label>
            <div className="toggle-text">
              <span className="toggle-label">Monte Carlo Simulation</span>
              <span className="montecarlo-summary">
                {!mcEnabled
                  ? 'Off'
                  : `${Math.round(mcVolatility * 100)}% vol${mcVolatilityDecay === 'auto' ? ' + decay' : ''}, ${mcSimulations} sims`}
              </span>
            </div>
            <button
              type="button"
              className="toggle-arrow-btn"
              onClick={() => setMcExpanded(!mcExpanded)}
              aria-label={mcExpanded ? 'Collapse' : 'Expand'}
            >
              <span className={`toggle-arrow ${mcExpanded ? 'expanded' : ''}`}>▼</span>
            </button>
          </div>

          <div className={`montecarlo-content ${mcExpanded ? 'expanded' : ''}`}>
            <div className="input-group slider-group">
              <label htmlFor="mcVolatility">Starting Volatility: <span className="slider-value">{Math.round(mcVolatility * 100)}%</span></label>
              <input
                id="mcVolatility"
                type="range"
                min="20"
                max="150"
                step="5"
                value={mcVolatility * 100}
                onChange={(e) => setMcVolatility(Number(e.target.value) / 100)}
              />
              <div className="slider-labels">
                <span>20%</span>
                <span className="slider-marker" style={{ left: '46%' }}>80% SOL typical</span>
                <span>150%</span>
              </div>
              <span className="input-hint">SOL historical volatility: 80-100%. Higher = wider range of outcomes.</span>
            </div>

            <div className="input-group">
              <label>Volatility Decay</label>
              <div className="decay-buttons">
                {([
                  { value: 'none' as VolatilityDecayType, label: 'None' },
                  { value: 'auto' as VolatilityDecayType, label: 'Auto' },
                ]).map((decay) => (
                  <button
                    key={decay.value}
                    type="button"
                    className={`decay-btn ${mcVolatilityDecay === decay.value ? 'active' : ''}`}
                    onClick={() => setMcVolatilityDecay(decay.value)}
                  >
                    {decay.label}
                  </button>
                ))}
              </div>
              <span className="input-hint">
                {mcVolatilityDecay === 'none'
                  ? 'Constant volatility forever - pessimistic assumption.'
                  : 'Realistic decay as asset matures. 80% → ~30% over 25 years. Floor: 25%.'}
              </span>
            </div>

            <div className="input-group slider-group">
              <label htmlFor="mcSimulations">Simulations: <span className="slider-value">{mcSimulations}</span></label>
              <input
                id="mcSimulations"
                type="range"
                min="100"
                max="2000"
                step="100"
                value={mcSimulations}
                onChange={(e) => setMcSimulations(Number(e.target.value))}
              />
              <div className="slider-labels">
                <span>100</span>
                <span className="slider-marker" style={{ left: '21%' }}>500 default</span>
                <span>2000</span>
              </div>
              <span className="input-hint">More simulations = smoother results but slower. 500 is a good balance.</span>
            </div>
          </div>
        </section>
          </>
        )}

        {!spendNowMode && projection && (
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
                  modelParams: effectiveModelParams,
                  dcaAmountUSD,
                  dcaFrequency,
                  currentSOL,
                  currentPrice: currentPrice!,
                  mcEnabled,
                  mcResult,
                  mcVolatility,
                  mcSimulations,
                  inflationEnabled,
                  inflationParams,
                  todaysDollarsValue,
                  inflationAdjustmentFn,
                })}
              >
                Share
              </button>
            </div>

            <div className="summary-cards">
              <div className="summary-card">
                <span className="card-label">
                  {mcEnabled ? "Median Value" : (inflationEnabled ? "Today's Dollars" : "Portfolio Value")}
                </span>
                <span className="card-value highlight">
                  {mcEnabled && mcResult
                    ? formatUSD(inflationEnabled ? inflationAdjustmentFn(mcResult.finalP50, years) : mcResult.finalP50)
                    : formatUSD(inflationEnabled && todaysDollarsValue ? todaysDollarsValue : projection.finalValueUSD)}
                </span>
                {mcEnabled && mcResult ? (
                  <span className="card-subvalue mc-range">
                    {formatUSD(inflationEnabled ? inflationAdjustmentFn(mcResult.finalP10, years) : mcResult.finalP10)} - {formatUSD(inflationEnabled ? inflationAdjustmentFn(mcResult.finalP90, years) : mcResult.finalP90)}
                  </span>
                ) : inflationEnabled && (
                  <span className="card-subvalue">
                    Nominal: {formatUSD(projection.finalValueUSD)}
                  </span>
                )}
              </div>
              <div className="summary-card">
                <span className="card-label">{mcEnabled ? "Median SOL" : "SOL Accumulated"}</span>
                <span className="card-value">
                  {mcEnabled && mcResult
                    ? `${formatSOL(mcResult.finalSolP50)} SOL`
                    : `${formatSOL(projection.finalSOL)} SOL`}
                </span>
                {mcEnabled && mcResult && (
                  <span className="card-subvalue mc-range">
                    {formatSOL(mcResult.finalSolP10)} - {formatSOL(mcResult.finalSolP90)}
                  </span>
                )}
              </div>
              <div className="summary-card">
                <span className="card-label">SOL Price</span>
                <span className="card-value">${projection.finalPrice.toLocaleString()}</span>
                {mcEnabled && (
                  <span className="card-subvalue mc-note">
                    (model expected)
                  </span>
                )}
              </div>
            </div>

            <div className="summary-row">
              <div className="summary-item">
                <span className="item-label">Total Invested:</span>
                <span className="item-value">{formatUSD(projection.totalInvestedUSD)}</span>
              </div>
              <div className="summary-item">
                <span className="item-label">{mcEnabled ? "Median Gain:" : (inflationEnabled ? "Real Gain:" : "Total Gain:")}</span>
                <span className="item-value gain">
                  {(() => {
                    if (mcEnabled && mcResult) {
                      const medianValue = inflationEnabled
                        ? inflationAdjustmentFn(mcResult.finalP50, years)
                        : mcResult.finalP50;
                      return formatUSD(medianValue - projection.totalInvestedUSD);
                    }
                    return formatUSD(inflationEnabled && todaysDollarsValue
                      ? todaysDollarsValue - projection.totalInvestedUSD
                      : projection.totalGainUSD);
                  })()}
                </span>
              </div>
            </div>

            <div className="chart-container">
              {mcCalculating && (
                <div className="mc-loading-overlay">
                  <div className="mc-spinner"></div>
                  <span>Running simulations...</span>
                </div>
              )}
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
                  modelParams={effectiveModelParams}
                  inflationAdjustment={inflationAdjustmentFn}
                  showRealValue={inflationEnabled}
                  mcParams={mcEnabled ? mcParams : null}
                />
              ) : (
                <GrowthChart
                  projections={projection.projections}
                  inflationAdjustment={inflationAdjustmentFn}
                  showRealValue={inflationEnabled}
                  mcResult={mcEnabled ? mcResult : null}
                />
              )}
            </div>

            <div className="projection-table">
              <h3>
                Year-by-Year Breakdown
                {mcEnabled && <span className="table-note"> (Median)</span>}
                {inflationEnabled && !mcEnabled && <span className="table-note"> (Today's Dollars)</span>}
                {inflationEnabled && mcEnabled && <span className="table-note"> (Today's Dollars)</span>}
              </h3>
              <table>
                <thead>
                  <tr>
                    <th>Year</th>
                    <th>SOL</th>
                    <th>Price</th>
                    <th>{mcEnabled ? "Median Value" : (inflationEnabled ? "Real Value" : "Value")}</th>
                    <th>Invested</th>
                  </tr>
                </thead>
                <tbody>
                  {projection.projections
                    .map((p, i) => ({ p, i }))
                    .filter(({ i }) => i % 5 === 4 || i === 0)
                    .map(({ p, i }) => {
                      // Use original index for MC percentiles lookup
                      const mcPercentile = mcEnabled && mcResult?.percentiles[i];

                      // Value to display
                      const displayValue = mcPercentile
                        ? (inflationEnabled ? inflationAdjustmentFn(mcPercentile.p50, p.year) : mcPercentile.p50)
                        : (inflationEnabled ? inflationAdjustmentFn(p.portfolioValueUSD, p.year) : p.portfolioValueUSD);

                      return (
                        <tr key={p.year}>
                          <td>{p.year}</td>
                          <td>{formatSOL(p.solBalance)}</td>
                          <td>${p.solPrice.toLocaleString()}</td>
                          <td>{formatUSD(displayValue)}</td>
                          <td>{formatUSD(p.totalInvestedUSD)}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </section>
        )}
          </>
        )}

        {/* Navigation Buttons */}
        {mainTab === 'plan' && planTab === 'grow' && !spendNowMode && (
          <div className="execute-plan-container">
            <button
              type="button"
              className="execute-plan-btn"
              onClick={() => setPlanTab('spend')}
              style={{ background: 'transparent', border: '1px solid var(--sol-purple)', color: 'var(--sol-purple)' }}
            >
              Next: Plan Spend Strategy →
            </button>
          </div>
        )}

        {/* SPEND TAB */}
        {mainTab === 'plan' && planTab === 'spend' && (
          <>
            <SpendTab
              startingSOL={
                spendNowMode
                  ? currentSOL
                  : (mcEnabled && mcResult ? mcResult.finalSolP50 : (projection?.finalSOL || 0))
              }
              startingPrice={
                spendNowMode
                  ? (currentPrice || 0)
                  : (projection?.finalPrice || 0)
              }
              startingValueUSD={
                spendNowMode
                  ? (currentSOL * (currentPrice || 0))
                  : (mcEnabled && mcResult
                      ? (inflationEnabled ? inflationAdjustmentFn(mcResult.finalP50, years) : mcResult.finalP50)
                      : (inflationEnabled && todaysDollarsValue ? todaysDollarsValue : (projection?.finalValueUSD || 0)))
              }
              defaultInflationRate={inflationRate}
              defaultVolatility={mcVolatility}
              defaultSimulations={mcSimulations}
              resetKey={resetKey}
            />
            
            <div className="execute-plan-container">
              <button
                type="button"
                className="execute-plan-btn"
                onClick={() => setShowExecuteModal(true)}
              >
                🚀 Execute Plan
              </button>
              <p className="execute-plan-hint">
                Save your plan and start tracking progress
              </p>
            </div>
          </>
        )}
        {/* MONITOR TAB */}
        {mainTab === 'monitor' && (
          <>
            {!activePlan ? (
              <section className="input-section monitor-section">
                <div className="monitor-no-plan">
                  <div className="monitor-icon">📋</div>
                  <h2>No Active Plan</h2>
                  <p className="monitor-description">
                    Go to the Plan tab to configure your accumulation and spending strategy, then click &quot;Execute Plan&quot; to start tracking.
                  </p>
                  <button
                    type="button"
                    className="go-to-plan-btn"
                    onClick={() => setMainTab('plan')}
                  >
                    Go to Plan →
                  </button>
                </div>
              </section>
            ) : (
              <>
                <section className="input-section monitor-plan-active">
                  <div className="plan-activated-banner">
                    ✅ Plan activated on {new Date(activePlan.activatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                </section>

                {/* ACCUM SUB-TAB */}
                {monitorTab === 'accum' && (
                  <section className="input-section monitor-section">
                    <h2>Accumulation Tracker</h2>
                    <div className="monitor-plan-summary">
                      <div className="plan-summary-grid">
                        <div className="plan-summary-item">
                          <span className="plan-summary-label">Starting SOL</span>
                          <span className="plan-summary-value">{activePlan.settings.currentSOL}</span>
                        </div>
                        <div className="plan-summary-item">
                          <span className="plan-summary-label">Starting JitoSOL</span>
                          <span className="plan-summary-value">{activePlan.settings.currentJitoSOL}</span>
                        </div>
                        <div className="plan-summary-item">
                          <span className="plan-summary-label">DCA Amount</span>
                          <span className="plan-summary-value">${activePlan.settings.dcaAmountUSD}/{activePlan.settings.dcaFrequency}</span>
                        </div>
                        <div className="plan-summary-item">
                          <span className="plan-summary-label">Target Years</span>
                          <span className="plan-summary-value">{activePlan.settings.years}</span>
                        </div>
                        <div className="plan-summary-item">
                          <span className="plan-summary-label">Growth Model</span>
                          <span className="plan-summary-value">{activePlan.settings.growthModel.toUpperCase()}</span>
                        </div>
                        <div className="plan-summary-item">
                          <span className="plan-summary-label">JitoSOL Staking</span>
                          <span className="plan-summary-value">{activePlan.settings.jitoSOLEnabled ? `${(activePlan.settings.jitoSOLAPR * 100).toFixed(1)}% APR` : 'Off'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="monitor-wallet-connect">
                      {demo.enabled ? (
                        <div style={{
                          padding: '10px 20px',
                          background: 'rgba(20, 241, 149, 0.1)',
                          border: '1px solid #14F195',
                          borderRadius: '8px',
                          color: '#14F195',
                          fontWeight: 'bold',
                          textAlign: 'center',
                        }}>
                          ✅ Demo Wallet Connected
                        </div>
                      ) : (
                        <WalletMultiButton />
                      )}
                    </div>

                    <MonitorAccum
                      activePlan={activePlan}
                      walletSOL={walletBalance}
                      walletJitoSOL={walletJitoSolBalance}
                      currentPrice={currentPrice}
                      connected={demo.enabled || connected}
                      demoDate={demo.enabled ? demo.demoDate : null}
                      completedDCAs={demo.enabled ? demo.completedDCAs : undefined}
                      onMarkDCAComplete={demo.enabled ? demo.markDCAComplete : undefined}
                    />
                  </section>
                )}

                {/* DECUM SUB-TAB */}
                {monitorTab === 'decum' && (
                  <section className="input-section monitor-section">
                    <h2>Decumulation Tracker</h2>
                    <div className="monitor-plan-summary">
                      <div className="plan-summary-grid">
                        <div className="plan-summary-item">
                          <span className="plan-summary-label">Monthly Income</span>
                          <span className="plan-summary-value">${activePlan.settings.spendMonthlyIncome?.toLocaleString() ?? 'N/A'}</span>
                        </div>
                        <div className="plan-summary-item">
                          <span className="plan-summary-label">Retirement Years</span>
                          <span className="plan-summary-value">{activePlan.settings.spendRetirementYears ?? 'N/A'}</span>
                        </div>
                        <div className="plan-summary-item">
                          <span className="plan-summary-label">Inflation Rate</span>
                          <span className="plan-summary-value">{activePlan.settings.spendInflationRate ? `${(activePlan.settings.spendInflationRate * 100).toFixed(1)}%` : 'N/A'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="monitor-wallet-connect">
                      {demo.enabled ? (
                        <div style={{
                          padding: '10px 20px',
                          background: 'rgba(20, 241, 149, 0.1)',
                          border: '1px solid #14F195',
                          borderRadius: '8px',
                          color: '#14F195',
                          fontWeight: 'bold',
                          textAlign: 'center',
                        }}>
                          ✅ Demo Wallet Connected
                        </div>
                      ) : (
                        <WalletMultiButton />
                      )}
                    </div>

                    <MonitorDecum
                      activePlan={activePlan}
                      walletSOL={walletBalance}
                      walletJitoSOL={walletJitoSolBalance}
                      currentPrice={currentPrice}
                      connected={demo.enabled || connected}
                      demoDate={demo.enabled ? demo.demoDate : null}
                    />
                  </section>
                )}

                <div className="cancel-execution-container">
                  <button
                    type="button"
                    className="cancel-execution-btn"
                    onClick={() => setShowCancelModal(true)}
                  >
                    ← Back to Planning
                  </button>
                </div>

                {showCancelModal && activePlan && (
                  <CancelPlanModal
                    activePlan={activePlan}
                    currentPrice={currentPrice}
                    onConfirm={cancelExecution}
                    onClose={() => setShowCancelModal(false)}
                    demoDate={demo.enabled ? demo.demoDate : null}
                  />
                )}
              </>
            )}
          </>
        )}

        {showExecuteModal && (
          <div className="cancel-modal-overlay">
            <div className="cancel-modal" style={{ borderColor: '#14F195', boxShadow: '0 8px 40px rgba(20, 241, 149, 0.2)' }}>
              <div className="cancel-modal-header" style={{ background: 'rgba(20, 241, 149, 0.1)', borderBottomColor: 'rgba(20, 241, 149, 0.2)' }}>
                <div className="cancel-modal-icon">🚀</div>
                <h2 style={{ color: '#14F195' }}>Execute Plan?</h2>
              </div>
              <div className="cancel-modal-body">
                <div className="cancel-stats-row">
                  <div className="cancel-stat">
                    <span className="cancel-stat-label">Accumulation</span>
                    <span className="cancel-stat-value cancel-stat-green">{years} Years</span>
                    <span className="cancel-stat-sub">DCA {formatUSD(dcaAmountUSD)} / {dcaFrequency}</span>
                  </div>
                  <div className="cancel-stat">
                    <span className="cancel-stat-label">Retirement</span>
                    <span className="cancel-stat-value cancel-stat-green">
                      {loadSettings().spendRetirementYears ?? DEFAULT_SETTINGS.spendRetirementYears} Years
                    </span>
                    <span className="cancel-stat-sub">
                      Withdraw {formatUSD(loadSettings().spendMonthlyIncome ?? DEFAULT_SETTINGS.spendMonthlyIncome)}/mo
                    </span>
                  </div>
                </div>
                <p style={{ fontSize: '0.9rem', color: '#ccc', textAlign: 'center', margin: '0' }}>
                  This will save your plan and start tracking your progress against these targets.
                </p>
                <div className="cancel-actions" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <button
                    type="button"
                    onClick={() => setShowExecuteModal(false)}
                    style={{
                      padding: '12px',
                      background: 'transparent',
                      border: '1px solid #555',
                      borderRadius: '8px',
                      color: '#ccc',
                      cursor: 'pointer',
                      fontWeight: '600',
                    }}
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={executePlan}
                    style={{
                      padding: '12px',
                      background: 'linear-gradient(135deg, var(--sol-purple), var(--sol-green))',
                      border: 'none',
                      borderRadius: '8px',
                      color: '#fff',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                    }}
                  >
                    Confirm & Execute
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="footer">
        <div className="footer-brand">
          <img src="/icons/icon.svg" alt="RetireOnSol" className="footer-logo" />
          <span className="footer-name">RetireOnSol</span>
        </div>
        <div className="footer-links">
          <a href={`${import.meta.env.BASE_URL}privacy`} className="footer-link">Privacy Policy</a>
          <span className="footer-divider">|</span>
          <a href={`${import.meta.env.BASE_URL}terms`} className="footer-link">Terms of Service</a>
          <span className="footer-divider">|</span>
          <button
            type="button"
            className="footer-link reset-link"
            onClick={resetSettings}
          >
            Reset Settings
          </button>
        </div>
        <div className="footer-disclaimer">
          <p>For educational and entertainment purposes only.</p>
          <p>Not financial advice. Projections are hypothetical and do not guarantee future results.</p>
          <p>Past performance does not indicate future returns. Always do your own research.</p>
        </div>
        <p className="footer-copyright">&copy; {new Date().getFullYear()} RetireOnSol. All rights reserved.</p>
        <p className="footer-version">v3.0.0-alpha.3</p>
      </footer>
      <DemoPanel />
    </div>
  );
}

export default App;
