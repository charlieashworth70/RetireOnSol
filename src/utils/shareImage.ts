import type { ProjectionResult, YearlyProjection } from './calculations';
import { formatUSD, formatSOL } from './calculations';
import { getModelDisplayName } from './growthModels';
import type { GrowthModel } from './growthModels';

interface ShareImageOptions {
  projection: ProjectionResult;
  years: number;
  growthModel: GrowthModel;
  dcaAmountUSD: number;
  dcaFrequency: string;
}

/**
 * Draw a mini chart on the canvas
 */
function drawChart(
  ctx: CanvasRenderingContext2D,
  projections: YearlyProjection[],
  x: number,
  y: number,
  width: number,
  height: number
) {
  const padding = 20;
  const chartX = x + padding;
  const chartY = y + padding;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;

  // Find max value for scaling
  const maxValue = Math.max(...projections.map(p => p.portfolioValueUSD));

  // Draw chart background
  ctx.fillStyle = 'rgba(26, 26, 26, 0.8)';
  ctx.fillRect(x, y, width, height);

  // Draw grid lines
  ctx.strokeStyle = 'rgba(136, 136, 136, 0.2)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const lineY = chartY + (chartHeight / 4) * i;
    ctx.beginPath();
    ctx.moveTo(chartX, lineY);
    ctx.lineTo(chartX + chartWidth, lineY);
    ctx.stroke();
  }

  // Draw invested line (teal)
  ctx.strokeStyle = '#14F195';
  ctx.lineWidth = 2;
  ctx.beginPath();
  projections.forEach((p, i) => {
    const px = chartX + (i / (projections.length - 1)) * chartWidth;
    const py = chartY + chartHeight - (p.totalInvestedUSD / maxValue) * chartHeight;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.stroke();

  // Draw portfolio value line (purple)
  ctx.strokeStyle = '#9945FF';
  ctx.lineWidth = 3;
  ctx.beginPath();
  projections.forEach((p, i) => {
    const px = chartX + (i / (projections.length - 1)) * chartWidth;
    const py = chartY + chartHeight - (p.portfolioValueUSD / maxValue) * chartHeight;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.stroke();

  // Fill area under portfolio value
  ctx.fillStyle = 'rgba(153, 69, 255, 0.2)';
  ctx.beginPath();
  ctx.moveTo(chartX, chartY + chartHeight);
  projections.forEach((p, i) => {
    const px = chartX + (i / (projections.length - 1)) * chartWidth;
    const py = chartY + chartHeight - (p.portfolioValueUSD / maxValue) * chartHeight;
    ctx.lineTo(px, py);
  });
  ctx.lineTo(chartX + chartWidth, chartY + chartHeight);
  ctx.closePath();
  ctx.fill();

  // Draw legend
  ctx.font = '14px -apple-system, BlinkMacSystemFont, sans-serif';

  // Portfolio Value legend
  ctx.fillStyle = '#9945FF';
  ctx.fillRect(chartX, y + height - 15, 12, 12);
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'left';
  ctx.fillText('Portfolio Value', chartX + 18, y + height - 5);

  // Total Invested legend
  ctx.fillStyle = '#14F195';
  ctx.fillRect(chartX + 130, y + height - 15, 12, 12);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText('Total Invested', chartX + 148, y + height - 5);

  // Y-axis labels
  ctx.fillStyle = '#888888';
  ctx.font = '12px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(formatUSD(maxValue), chartX - 5, chartY + 10);
  ctx.fillText('$0', chartX - 5, chartY + chartHeight);

  // X-axis labels
  ctx.textAlign = 'center';
  ctx.fillText('Year 1', chartX, chartY + chartHeight + 15);
  ctx.fillText(`Year ${projections.length}`, chartX + chartWidth, chartY + chartHeight + 15);
}

/**
 * Generate a shareable image of the projection results
 */
export async function generateShareImage(options: ShareImageOptions): Promise<Blob> {
  const { projection, years, growthModel, dcaAmountUSD, dcaFrequency } = options;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;

  // Set canvas size (optimized for social sharing)
  canvas.width = 1200;
  canvas.height = 800;

  // Background gradient
  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, '#0D0D0D');
  gradient.addColorStop(1, '#1A1A2E');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Add subtle grid pattern
  ctx.strokeStyle = 'rgba(153, 69, 255, 0.1)';
  ctx.lineWidth = 1;
  for (let x = 0; x < canvas.width; x += 60) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y < canvas.height; y += 60) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  // Title
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 42px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('RetireOnSol', canvas.width / 2, 50);

  // Subtitle
  ctx.fillStyle = '#888888';
  ctx.font = '22px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillText(`${years}-Year ${getModelDisplayName(growthModel)} Projection`, canvas.width / 2, 85);

  // Main result - Portfolio Value
  ctx.fillStyle = '#14F195';
  ctx.font = 'bold 72px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillText(formatUSD(projection.finalValueUSD), canvas.width / 2, 170);

  ctx.fillStyle = '#888888';
  ctx.font = '22px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillText('Projected Portfolio Value', canvas.width / 2, 205);

  // Stats row
  const statsY = 270;
  const statsGap = 280;
  const statsStartX = (canvas.width - statsGap * 3) / 2;

  // SOL Accumulated
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 32px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(formatSOL(projection.finalSOL) + ' SOL', statsStartX, statsY);
  ctx.fillStyle = '#888888';
  ctx.font = '16px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillText('SOL Accumulated', statsStartX, statsY + 25);

  // SOL Price
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 32px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillText('$' + projection.finalPrice.toLocaleString(), statsStartX + statsGap, statsY);
  ctx.fillStyle = '#888888';
  ctx.font = '16px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillText('Projected SOL Price', statsStartX + statsGap, statsY + 25);

  // Total Invested
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 32px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillText(formatUSD(projection.totalInvestedUSD), statsStartX + statsGap * 2, statsY);
  ctx.fillStyle = '#888888';
  ctx.font = '16px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillText('Total Invested', statsStartX + statsGap * 2, statsY + 25);

  // Total Gain
  ctx.fillStyle = '#14F195';
  ctx.font = 'bold 32px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillText(formatUSD(projection.totalGainUSD), statsStartX + statsGap * 3, statsY);
  ctx.fillStyle = '#888888';
  ctx.font = '16px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillText('Total Gain', statsStartX + statsGap * 3, statsY + 25);

  // Draw chart
  drawChart(ctx, projection.projections, 100, 330, 1000, 350);

  // DCA info
  ctx.fillStyle = '#9945FF';
  ctx.font = '20px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(
    `DCA Strategy: $${dcaAmountUSD} ${dcaFrequency}`,
    canvas.width / 2,
    720
  );

  // Footer
  ctx.fillStyle = '#666666';
  ctx.font = '16px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillText('Not financial advice. Projections are hypothetical and do not guarantee future results.', canvas.width / 2, 760);

  // Branding
  ctx.fillStyle = '#9945FF';
  ctx.font = 'bold 18px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.fillText('retireonsol.com', canvas.width / 2, 785);

  // Convert to blob
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve(blob!);
    }, 'image/png');
  });
}

/**
 * Share or download the projection image
 */
export async function shareProjection(options: ShareImageOptions): Promise<void> {
  const blob = await generateShareImage(options);
  const file = new File([blob], 'retireonsol-projection.png', { type: 'image/png' });

  // Try native share if available (mobile)
  if (navigator.share && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: 'My RetireOnSol Projection',
        text: `Check out my ${options.years}-year SOL projection: ${formatUSD(options.projection.finalValueUSD)}`,
      });
      return;
    } catch (err) {
      // User cancelled or share failed, fall back to download
      if ((err as Error).name === 'AbortError') return;
    }
  }

  // Fall back to download
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'retireonsol-projection.png';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
