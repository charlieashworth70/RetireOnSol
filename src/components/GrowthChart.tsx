import { useState } from 'react';
import {
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  ComposedChart,
} from 'recharts';
import type { YearlyProjection } from '../utils/calculations';
import { formatUSD } from '../utils/calculations';

interface GrowthChartProps {
  projections: YearlyProjection[];
}

interface ChartDataPoint {
  year: number;
  value: number;           // Portfolio value in USD
  invested: number;        // Total invested in USD
}

export function GrowthChart({ projections }: GrowthChartProps) {
  const [useLogScale, setUseLogScale] = useState(false);

  // Transform data for the chart
  const chartData: ChartDataPoint[] = projections.map((p) => ({
    year: p.year,
    value: p.portfolioValueUSD,
    invested: p.totalInvestedUSD,
  }));

  // Custom tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="chart-tooltip">
          <p className="tooltip-year">Year {label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }}>
              {entry.name}: {formatUSD(entry.value)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="chart-wrapper">
      <div className="chart-controls">
        <button
          type="button"
          className={`scale-toggle ${useLogScale ? 'active' : ''}`}
          onClick={() => setUseLogScale(!useLogScale)}
        >
          {useLogScale ? 'Log Scale' : 'Linear Scale'}
        </button>
        <span className="scale-hint">
          {useLogScale ? 'Power law appears as straight line' : 'Shows absolute growth'}
        </span>
      </div>
      <ResponsiveContainer width="100%" height={350}>
        <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 30 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
          <XAxis dataKey="year" stroke="#888" />
          <YAxis
            stroke="#888"
            tickFormatter={(v) => formatUSD(v)}
            width={70}
            scale={useLogScale ? 'log' : 'auto'}
            domain={useLogScale ? ['auto', 'auto'] : [0, 'auto']}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ paddingTop: '10px' }} />

        {/* Shaded area for portfolio value */}
        <Area
          type="monotone"
          dataKey="value"
          stroke="none"
          fill="#9945FF"
          fillOpacity={0.2}
          legendType="none"
        />

        {/* Portfolio value line */}
        <Line
          type="monotone"
          dataKey="value"
          stroke="#9945FF"
          strokeWidth={3}
          dot={false}
          name="Portfolio Value"
        />

        {/* Total invested line */}
        <Line
          type="monotone"
          dataKey="invested"
          stroke="#14F195"
          strokeWidth={2}
          dot={false}
          name="Total Invested"
        />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
