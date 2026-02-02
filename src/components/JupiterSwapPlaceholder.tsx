/**
 * JupiterSwapPlaceholder — Placeholder for Jupiter Terminal integration
 *
 * Currently opens Jupiter in a new tab. In the future, this will embed
 * the Jupiter Terminal widget for in-app swaps.
 *
 * Jupiter Terminal v3 integration (uses api.jup.ag endpoints)
 * 1. Script tag: <script src="https://terminal.jup.ag/main-v3.js" />
 * 2. Calls window.Jupiter.init({ ... }) with config
 * 3. Embeds terminal in modal overlay
 */

import { useState } from 'react';
import './JupiterSwapPlaceholder.css';
import { JupiterTerminal } from './JupiterTerminal';

interface JupiterSwapPlaceholderProps {
  fromToken?: string;
  toToken?: string;
}

export function JupiterSwapPlaceholder({
  fromToken = 'SOL',
  toToken = 'JitoSOL',
}: JupiterSwapPlaceholderProps) {
  const [showTerminal, setShowTerminal] = useState(false);

  return (
    <>
      <div className="jupiter-swap-placeholder">
        <div className="jupiter-swap-header">
          <span className="jupiter-icon">⚡</span>
          <span className="jupiter-title">Jupiter Swap</span>
        </div>
        <p className="jupiter-description">
          Swap directly in-app via Jupiter.
        </p>
        <button
          type="button"
          className="jupiter-swap-btn"
          onClick={() => setShowTerminal(true)}
        >
          Swap {fromToken} → {toToken}
        </button>
      </div>
      {showTerminal && <JupiterTerminal onClose={() => setShowTerminal(false)} />}
    </>
  );
}
