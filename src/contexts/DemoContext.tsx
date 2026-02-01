import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type { ReactNode } from 'react';

interface DemoState {
  enabled: boolean;
  solBalance: number;
  jitoSolBalance: number;
  setEnabled: (v: boolean) => void;
  setSolBalance: (v: number) => void;
  setJitoSolBalance: (v: number) => void;
  handleLogoClick: () => void;
}

const DemoContext = createContext<DemoState>({
  enabled: false,
  solBalance: 10,
  jitoSolBalance: 5,
  setEnabled: () => {},
  setSolBalance: () => {},
  setJitoSolBalance: () => {},
  handleLogoClick: () => {},
});

export function useDemoMode() {
  return useContext(DemoContext);
}

export function DemoProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('demo') === 'true';
  });
  const [solBalance, setSolBalance] = useState(10);
  const [jitoSolBalance, setJitoSolBalance] = useState(5);

  // Logo click counter for hidden activation
  const clickCountRef = useRef(0);
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleLogoClick = useCallback(() => {
    clickCountRef.current += 1;
    if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
    clickTimerRef.current = setTimeout(() => {
      clickCountRef.current = 0;
    }, 2000);

    if (clickCountRef.current >= 5) {
      clickCountRef.current = 0;
      setEnabled((prev) => !prev);
    }
  }, []);

  // Update URL param when demo mode changes
  useEffect(() => {
    const url = new URL(window.location.href);
    if (enabled) {
      url.searchParams.set('demo', 'true');
    } else {
      url.searchParams.delete('demo');
    }
    window.history.replaceState({}, '', url.toString());
  }, [enabled]);

  return (
    <DemoContext.Provider
      value={{
        enabled,
        solBalance,
        jitoSolBalance,
        setEnabled,
        setSolBalance,
        setJitoSolBalance,
        handleLogoClick,
      }}
    >
      {children}
    </DemoContext.Provider>
  );
}
