/**
 * JupiterSwapPlaceholder — Placeholder for Jupiter Terminal integration
 *
 * Currently opens Jupiter in a new tab. In the future, this will embed
 * the Jupiter Terminal widget for in-app swaps.
 *
 * TODO: Jupiter Terminal integration
 * 1. Add script tag: <script src="https://terminal.jup.ag/main-v2.js" />
 * 2. Call window.Jupiter.init({ ... }) with config
 * 3. Replace placeholder with embedded terminal
 */

import './JupiterSwapPlaceholder.css';

interface JupiterSwapPlaceholderProps {
  fromToken?: string;
  toToken?: string;
}

export function JupiterSwapPlaceholder({
  fromToken = 'SOL',
  toToken = 'JitoSOL',
}: JupiterSwapPlaceholderProps) {
  const jupUrl = `https://jup.ag/swap/${fromToken}-${toToken}`;

  const handleSwapClick = () => {
    window.open(jupUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="jupiter-swap-placeholder">
      <div className="jupiter-swap-header">
        <span className="jupiter-icon">⚡</span>
        <span className="jupiter-title">Jupiter Swap</span>
      </div>
      <p className="jupiter-description">
        In-app swap coming soon. For now, swap on Jupiter directly.
      </p>
      <button
        type="button"
        className="jupiter-swap-btn"
        onClick={handleSwapClick}
      >
        Swap {fromToken} → {toToken} on Jupiter ↗
      </button>
    </div>
  );
}
