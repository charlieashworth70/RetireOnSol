import { useEffect } from 'react';

declare global {
  interface Window {
    Jupiter: any;
  }
}

export function JupiterTerminal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    let attempts = 0;
    const maxAttempts = 20; // Try for ~10 seconds

    function initJupiter() {
      attempts++;
      
      if (window.Jupiter?.init) {
        console.log('[Jupiter] Initializing plugin...');
        try {
          // Clear the container first (Jupiter Plugin expects an empty div)
          const container = document.getElementById('integrated-terminal');
          if (container) {
            container.innerHTML = '';
            console.log('[Jupiter] Cleared container');
          }
          
          window.Jupiter.init({
            displayMode: 'integrated',
            integratedTargetId: 'integrated-terminal',
            endpoint: 'https://solana-mainnet.phantom.app/YBPpkkN4g91xDiAnTE9r0RcMkjg0sKUIWvAfoFVJ',
            defaultExplorer: 'SolanaFM',
            formProps: {
              fixedOutputMint: true,
              initialOutputMint: 'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn', // JitoSOL
              initialInputMint: 'So11111111111111111111111111111111111111112', // SOL
            },
          });
          console.log('[Jupiter] Plugin initialized successfully');
        } catch (err) {
          console.error('[Jupiter] Init error:', err);
        }
      } else if (attempts < maxAttempts) {
        console.log(`[Jupiter] Not ready yet, attempt ${attempts}/${maxAttempts}. Retrying...`);
        setTimeout(initJupiter, 500);
      } else {
        console.error('[Jupiter] Failed to load after', maxAttempts, 'attempts');
      }
    }

    // Check if script already exists
    const existingScript = document.querySelector('script[src*="plugin.jup.ag"]');
    if (existingScript) {
      console.log('[Jupiter] Script already loaded, initializing...');
      initJupiter();
      return;
    }

    // Load Jupiter Plugin script
    console.log('[Jupiter] Loading plugin script...');
    const script = document.createElement('script');
    script.src = 'https://plugin.jup.ag/plugin-v1.js';
    script.defer = true;
    script.onload = () => {
      console.log('[Jupiter] Script loaded, waiting for window.Jupiter...');
      setTimeout(initJupiter, 100); // Give it a moment to attach to window
    };
    script.onerror = () => {
      console.error('[Jupiter] Failed to load script from plugin.jup.ag');
    };
    document.head.appendChild(script);
  }, []);

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.85)', zIndex: 10000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        width: '100%', maxWidth: '400px', height: '600px',
        background: '#303030', borderRadius: '16px', overflow: 'hidden',
        position: 'relative',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)'
      }}>
        <button 
          onClick={onClose}
          style={{
            position: 'absolute', top: '12px', right: '12px',
            zIndex: 50, background: 'rgba(40,40,40,0.8)', color: '#fff',
            border: '1px solid #555', borderRadius: '50%', width: '32px', height: '32px',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '14px', fontWeight: 'bold'
          }}
        >✕</button>
        <div id="integrated-terminal" style={{ width: '100%', height: '100%' }}>
          <div style={{ 
            height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', 
            color: '#888', fontSize: '0.9rem' 
          }}>
            Loading Jupiter...
          </div>
        </div>
      </div>
    </div>
  );
}
