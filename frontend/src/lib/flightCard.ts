import type { UAVInput, PredictResponse, DesignScoreResponse } from '../types';

const W = 900, H = 1200;
const GRADE_COLOR: Record<string, string> = { A: '#22C55E', B: '#4FD1C5', C: '#F5A623', D: '#F5A623', F: '#EF4444' };
const PLANE_PATH_2D = (ctx: CanvasRenderingContext2D) => {
  ctx.beginPath();
  ctx.moveTo(4, 20); ctx.lineTo(120, 12); ctx.lineTo(140, -20); ctx.lineTo(158, -20);
  ctx.lineTo(148, 12); ctx.lineTo(266, 12); ctx.lineTo(300, 0); ctx.lineTo(312, 4);
  ctx.lineTo(282, 20); ctx.lineTo(312, 36); ctx.lineTo(300, 40); ctx.lineTo(266, 28);
  ctx.lineTo(148, 28); ctx.lineTo(158, 60); ctx.lineTo(140, 60); ctx.lineTo(120, 28);
  ctx.lineTo(4, 20); ctx.closePath();
};

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * Renders a shareable "flight card" — aircraft silhouette, design score
 * badge, and key stats — to a PNG and triggers a download. Pure Canvas 2D
 * API, no image library dependency, no server round-trip.
 */
export function drawFlightCard(input: UAVInput, result: PredictResponse, score: DesignScoreResponse) {
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // background
  const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
  bgGrad.addColorStop(0, '#0B1220');
  bgGrad.addColorStop(1, '#121A2B');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  // border
  ctx.strokeStyle = 'rgba(79,209,197,0.35)';
  ctx.lineWidth = 2;
  roundRect(ctx, 12, 12, W - 24, H - 24, 18);
  ctx.stroke();

  // header
  ctx.fillStyle = '#4FD1C5';
  ctx.font = '600 22px monospace';
  ctx.fillText('UAV FLIGHT ENVELOPE PLATFORM', 48, 70);
  ctx.fillStyle = '#8A9BB5';
  ctx.font = '14px monospace';
  ctx.fillText('AIRCRAFT DESIGN CARD', 48, 96);

  // aircraft silhouette
  ctx.save();
  ctx.translate(W / 2 - 40, 220);
  ctx.scale(1.3, 1.3);
  ctx.fillStyle = '#4FD1C5';
  ctx.globalAlpha = 0.9;
  PLANE_PATH_2D(ctx);
  ctx.fill();
  ctx.restore();

  // grade badge
  const gradeColor = GRADE_COLOR[score.grade] || '#4FD1C5';
  ctx.beginPath();
  ctx.arc(W - 140, 200, 70, 0, Math.PI * 2);
  ctx.fillStyle = gradeColor;
  ctx.fill();
  ctx.fillStyle = '#0B1220';
  ctx.font = '700 64px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(score.grade, W - 140, 224);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#8A9BB5';
  ctx.font = '13px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`SCORE ${score.total.toFixed(0)}/100`, W - 140, 300);
  ctx.textAlign = 'left';

  // safety status
  const statusColor = result.physics.safety_status === 'SAFE' ? '#22C55E' : result.physics.safety_status === 'CAUTION' ? '#F5A623' : '#EF4444';
  ctx.fillStyle = statusColor;
  ctx.beginPath();
  ctx.arc(60, 380, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = '600 16px monospace';
  ctx.fillText(result.physics.safety_status, 80, 386);

  // stat grid
  const stats: [string, string, string][] = [
    ['RECOMMENDED ALTITUDE', `${Math.round(result.physics.recommended_altitude_m)}`, 'm'],
    ['ENDURANCE', result.physics.endurance_hr.toFixed(2), 'hr'],
    ['RANGE', `${Math.round(result.physics.range_km)}`, 'km'],
    ['L / D RATIO', result.physics.l_over_d.toFixed(2), ''],
    ['MASS', `${input.mass_kg}`, 'kg'],
    ['WING AREA', `${input.wing_area_m2}`, 'm²'],
    ['CRUISE SPEED', `${input.cruise_speed_ms}`, 'm/s'],
    ['BATTERY', `${input.battery_wh}`, 'Wh'],
  ];
  const colW = (W - 96) / 2;
  stats.forEach(([label, value, unit], i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = 48 + col * colW;
    const y = 460 + row * 110;
    roundRect(ctx, x, y, colW - 24, 88, 10);
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.stroke();
    ctx.fillStyle = '#8A9BB5';
    ctx.font = '11px monospace';
    ctx.fillText(label, x + 16, y + 26);
    ctx.fillStyle = '#4FD1C5';
    ctx.font = '600 28px monospace';
    ctx.fillText(`${value}${unit ? ' ' + unit : ''}`, x + 16, y + 62);
  });

  // footer
  ctx.fillStyle = '#8A9BB5';
  ctx.font = '11px monospace';
  ctx.fillText(`Generated ${new Date().toLocaleDateString()} · ${result.ml.model_used} surrogate model`, 48, H - 40);

  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'uav-flight-card.png';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }, 'image/png');
}
