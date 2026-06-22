import { Bar, Doughnut } from 'react-chartjs-2';
import '../lib/charts'; // side-effect: register required Chart.js pieces
import type { Cashflow, CategorySlice } from '../types';
import { formatNumber } from '../lib/format';
import { useTheme } from '../theme';

/** Màu chữ/lưới của biểu đồ theo theme hiện hành. */
function useChartColors() {
  const { resolved } = useTheme();
  const dark = resolved === 'dark';
  return {
    tick: dark ? '#9aa3b5' : '#5b6275',
    grid: dark ? 'rgba(255,255,255,0.08)' : 'rgba(31,36,48,0.08)',
  };
}

export function CashflowChart({ cashflow }: { cashflow: Cashflow }) {
  const c = useChartColors();
  return (
    <Bar
      height={180}
      data={{
        labels: cashflow.labels,
        datasets: [
          { label: 'Thu', data: cashflow.income, backgroundColor: '#10b981', borderRadius: 6 },
          { label: 'Chi', data: cashflow.expense, backgroundColor: '#ef4444', borderRadius: 6 },
        ],
      }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 }, color: c.tick } },
          tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${formatNumber(Number(ctx.raw))} đ` } },
        },
        scales: {
          y: { ticks: { callback: (v) => formatNumber(Number(v) / 1_000_000) + 'tr', font: { size: 10 }, color: c.tick }, grid: { color: c.grid } },
          x: { ticks: { font: { size: 10 }, color: c.tick }, grid: { color: c.grid } },
        },
      }}
    />
  );
}

export function BreakdownChart({ items }: { items: CategorySlice[] }) {
  const c = useChartColors();
  if (!items.length) return <div className="empty">Chưa có dữ liệu</div>;
  return (
    <Doughnut
      height={200}
      data={{
        labels: items.map((i) => i.name),
        datasets: [{ data: items.map((i) => i.amount), backgroundColor: items.map((i) => i.color), borderWidth: 0 }],
      }}
      options={{
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 }, color: c.tick } },
          tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${formatNumber(Number(ctx.raw))} đ` } },
        },
      }}
    />
  );
}
