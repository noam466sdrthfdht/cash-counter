import { useState, useRef } from "react";

const BILL_DENOMS = [20, 50, 100, 200];
const COIN_KEYS = ["0.10", "0.50", "1", "2", "5", "10"];
const COIN_VALUES = { "0.10": 0.1, "0.50": 0.5, "1": 1, "2": 2, "5": 5, "10": 10 };
const COIN_LABELS = {
  "0.10": "10 אגורות",
  "0.50": "50 אגורות",
  "1": "₪1",
  "2": "₪2",
  "5": "₪5",
  "10": "₪10",
};
const TARGET = 1000;

function buildSuffixDPs(maxSum, billCounts) {
  const suffixDP = [];
  for (let i = 4; i >= 0; i--) {
    const dp = new Array(maxSum + 1).fill(false);
    dp[0] = true;
    for (let k = i; k < 4; k++) {
      const d = BILL_DENOMS[k];
      const count = Math.min(billCounts[d] || 0, Math.floor(maxSum / d));
      for (let c = 0; c < count; c++) {
        for (let j = maxSum; j >= d; j--) {
          if (dp[j - d]) dp[j] = true;
        }
      }
    }
    suffixDP[i] = dp;
  }
  return suffixDP;
}

function backtrack(target, suffixDPs, billCounts) {
  const result = Object.fromEntries(BILL_DENOMS.map((d) => [d, 0]));
  let rem = target;
  for (let i = 0; i < BILL_DENOMS.length; i++) {
    const d = BILL_DENOMS[i];
    const avail = billCounts[d] || 0;
    const maxUse = Math.min(avail, Math.floor(rem / d));
    for (let use = maxUse; use >= 0; use--) {
      const leftover = rem - use * d;
      if (suffixDPs[i + 1][leftover]) {
        result[d] = use;
        rem = leftover;
        break;
      }
    }
  }
  return result;
}

function solve(coinsTotal, billCounts) {
  if (coinsTotal > TARGET) {
    return {
      type: "coins_over",
      coinsInRegister: TARGET,
      coinsRemoved: +(coinsTotal - TARGET).toFixed(2),
      billsInRegister: Object.fromEntries(BILL_DENOMS.map((d) => [d, 0])),
      billsInEnvelope: { ...billCounts },
      totalInRegister: TARGET,
      gap: 0,
    };
  }

  const wholePart = Math.floor(coinsTotal);
  const fracPart = +(coinsTotal - wholePart).toFixed(2);
  const suffixDPs = buildSuffixDPs(TARGET, billCounts);
  const fullDP = suffixDPs[0];

  const baseNeeded = TARGET - wholePart;
  let bestK = -1;
  for (let k = 0; k <= wholePart; k++) {
    const billsNeeded = baseNeeded + k;
    if (billsNeeded > TARGET) break;
    if (fullDP[billsNeeded]) { bestK = k; break; }
  }

  if (bestK >= 0) {
    const billsNeeded = baseNeeded + bestK;
    const coinsKept = wholePart - bestK;
    const coinsRemoved = +(fracPart + bestK).toFixed(2);
    const billsInRegister = backtrack(billsNeeded, suffixDPs, billCounts);
    const billsInEnvelope = Object.fromEntries(
      BILL_DENOMS.map((d) => [d, (billCounts[d] || 0) - billsInRegister[d]])
    );
    return {
      type: coinsRemoved > 0 ? "exact_remove" : "exact",
      coinsInRegister: coinsKept,
      coinsRemoved,
      billsInRegister,
      billsInEnvelope,
      totalInRegister: TARGET,
      gap: 0,
    };
  }

  const billTarget = Math.floor(TARGET - coinsTotal);
  let maxBills = 0;
  for (let j = billTarget; j >= 0; j--) {
    if (fullDP[j]) { maxBills = j; break; }
  }
  const billsInRegister = backtrack(maxBills, suffixDPs, billCounts);
  const billsInEnvelope = Object.fromEntries(
    BILL_DENOMS.map((d) => [d, (billCounts[d] || 0) - billsInRegister[d]])
  );
  return {
    type: "best_effort",
    coinsInRegister: coinsTotal,
    coinsRemoved: 0,
    billsInRegister,
    billsInEnvelope,
    totalInRegister: +(coinsTotal + maxBills).toFixed(2),
    gap: +(TARGET - coinsTotal - maxBills).toFixed(2),
  };
}

const fmt = (n) =>
  n % 1 === 0 ? `₪${n.toLocaleString("he-IL")}` : `₪${n.toFixed(2)}`;

function generateReport({ coinInputs, coinMode, simpleCoins, simpleCoinsInput, billInputs, billMode }) {
  const coinRows = [];
  let totalCoins = 0;

  if (simpleCoins) {
    const total = Math.round((parseFloat(simpleCoinsInput) || 0) * 100) / 100;
    coinRows.push({ label: "מטבעות", amount: total });
    totalCoins = total;
  } else {
    COIN_KEYS.forEach(key => {
      const denom = COIN_VALUES[key];
      let amount;
      if (coinMode === "number") {
        const count = Math.max(0, parseInt(coinInputs[key]) || 0);
        amount = Math.round(count * denom * 100) / 100;
      } else {
        amount = Math.max(0, parseFloat(coinInputs[key]) || 0);
      }
      totalCoins = Math.round((totalCoins + amount) * 100) / 100;
      coinRows.push({ label: COIN_LABELS[key], amount });
    });
  }

  const billRows = [];
  let totalBills = 0;
  BILL_DENOMS.forEach(d => {
    let amount;
    if (billMode === "number") {
      const count = Math.max(0, parseInt(billInputs[d]) || 0);
      amount = count * d;
    } else {
      amount = Math.max(0, parseFloat(billInputs[d]) || 0);
    }
    totalBills += amount;
    billRows.push({ label: `₪${d}`, amount });
  });

  const grandTotal = Math.round((totalCoins + totalBills) * 100) / 100;

  const W = 660;
  const SCALE = 2;
  const HEADER_H = 82;
  const COL_HEADER_H = 38;
  const ROW_H = 34;
  const SUBTOTALS_H = 46;
  const GRAND_H = 60;
  const maxContentRows = Math.max(coinRows.length, billRows.length);
  const H = HEADER_H + COL_HEADER_H + maxContentRows * ROW_H + SUBTOTALS_H + GRAND_H;

  const canvas = document.createElement("canvas");
  canvas.width = W * SCALE;
  canvas.height = H * SCALE;
  const ctx = canvas.getContext("2d");
  ctx.scale(SCALE, SCALE);

  const MID = W / 2;
  const PAD = 18;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "#1a1d27";
  ctx.fillRect(0, 0, W, HEADER_H);

  ctx.font = 'bold 22px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = "#00e5a0";
  ctx.textAlign = "center";
  ctx.fillText("ספירת קופה", W / 2, 38);

  const dateStr = new Date().toLocaleDateString("he-IL");
  ctx.font = '13px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = "#888";
  ctx.fillText(dateStr, W / 2, 62);

  const chY = HEADER_H;
  ctx.fillStyle = "#f0f2f5";
  ctx.fillRect(0, chY, W, COL_HEADER_H);

  ctx.strokeStyle = "#dee2e6";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, chY + COL_HEADER_H);
  ctx.lineTo(W, chY + COL_HEADER_H);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(MID, chY);
  ctx.lineTo(MID, HEADER_H + COL_HEADER_H + maxContentRows * ROW_H + SUBTOTALS_H);
  ctx.stroke();

  ctx.font = 'bold 15px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = "#3b82f6";
  ctx.textAlign = "center";
  ctx.fillText("מטבעות", MID / 2, chY + 25);

  ctx.fillStyle = "#d97706";
  ctx.fillText("שטרות", MID + MID / 2, chY + 25);

  let y = HEADER_H + COL_HEADER_H;

  const drawCell = (label, amount, colStart, colEnd, rowY) => {
    ctx.font = '14px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = "#374151";
    ctx.textAlign = "left";
    ctx.fillText(label, colStart + PAD, rowY + ROW_H * 0.64);

    const amtStr = amount % 1 === 0
      ? `₪${amount.toLocaleString("he-IL")}`
      : `₪${amount.toFixed(2)}`;
    ctx.font = 'bold 14px "Segoe UI", Arial, sans-serif';
    ctx.fillStyle = amount > 0 ? "#111827" : "#9ca3af";
    ctx.textAlign = "right";
    ctx.fillText(amtStr, colEnd - PAD, rowY + ROW_H * 0.64);
  };

  for (let i = 0; i < maxContentRows; i++) {
    if (i % 2 === 1) {
      ctx.fillStyle = "#f9fafb";
      ctx.fillRect(0, y, W, ROW_H);
    }

    ctx.strokeStyle = "#e5e7eb";
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(0, y + ROW_H);
    ctx.lineTo(W, y + ROW_H);
    ctx.stroke();

    if (i < coinRows.length) {
      drawCell(coinRows[i].label, coinRows[i].amount, 0, MID, y);
    }
    if (i < billRows.length) {
      drawCell(billRows[i].label, billRows[i].amount, MID, W, y);
    }

    y += ROW_H;
  }

  ctx.fillStyle = "#eff6ff";
  ctx.fillRect(0, y, MID, SUBTOTALS_H);
  ctx.fillStyle = "#fffbeb";
  ctx.fillRect(MID, y, MID, SUBTOTALS_H);

  ctx.strokeStyle = "#93c5fd";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(MID, y);
  ctx.stroke();

  ctx.strokeStyle = "#fcd34d";
  ctx.beginPath();
  ctx.moveTo(MID, y);
  ctx.lineTo(W, y);
  ctx.stroke();

  ctx.strokeStyle = "#dee2e6";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(MID, y);
  ctx.lineTo(MID, y + SUBTOTALS_H);
  ctx.stroke();

  ctx.font = 'bold 14px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = "#3b82f6";
  ctx.textAlign = "left";
  ctx.fillText('סה"כ מטבעות', PAD, y + SUBTOTALS_H * 0.64);

  const coinTotalStr = totalCoins % 1 === 0
    ? `₪${totalCoins.toLocaleString("he-IL")}`
    : `₪${totalCoins.toFixed(2)}`;
  ctx.textAlign = "right";
  ctx.fillText(coinTotalStr, MID - PAD, y + SUBTOTALS_H * 0.64);

  ctx.fillStyle = "#d97706";
  ctx.textAlign = "left";
  ctx.fillText('סה"כ שטרות', MID + PAD, y + SUBTOTALS_H * 0.64);

  ctx.textAlign = "right";
  ctx.fillText(`₪${totalBills.toLocaleString("he-IL")}`, W - PAD, y + SUBTOTALS_H * 0.64);

  y += SUBTOTALS_H;

  ctx.fillStyle = "#1a1d27";
  ctx.fillRect(0, y, W, GRAND_H);

  ctx.font = 'bold 20px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = "#00e5a0";
  ctx.textAlign = "center";
  const grandStr = grandTotal % 1 === 0
    ? `₪${grandTotal.toLocaleString("he-IL")}`
    : `₪${grandTotal.toFixed(2)}`;
  ctx.fillText(`סה"כ כולל: ${grandStr}`, W / 2, y + GRAND_H * 0.62);

  canvas.toBlob(blob => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.download = `דוח-קופה-${dateStr.replace(/\//g, "-")}.png`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  }, "image/png");
}

export default function CashCounter() {
  const [coinMode, setCoinMode] = useState("number");
  const [billMode, setBillMode] = useState("number");
  const [simpleCoins, setSimpleCoins] = useState(false);
  const [coinInputs, setCoinInputs] = useState(
    Object.fromEntries(COIN_KEYS.map(k => [k, ""]))
  );
  const [simpleCoinsInput, setSimpleCoinsInput] = useState("");
  const [billInputs, setBillInputs] = useState({ 20: "", 50: "", 100: "", 200: "" });
  const [result, setResult] = useState(null);
  const [errors, setErrors] = useState({});
  const registerRef = useRef(null);

  const computeCoinsTotal = () => {
    if (simpleCoins) return parseFloat(simpleCoinsInput) || 0;
    return Math.round(
      COIN_KEYS.reduce((s, k) => {
        if (coinMode === "number") return s + (parseInt(coinInputs[k]) || 0) * COIN_VALUES[k];
        return s + (parseFloat(coinInputs[k]) || 0);
      }, 0) * 100
    ) / 100;
  };

  const computeBillsTotal = () =>
    BILL_DENOMS.reduce((s, d) => {
      if (billMode === "number") return s + (parseInt(billInputs[d]) || 0) * d;
      return s + (parseFloat(billInputs[d]) || 0);
    }, 0);

  const totalInventory = Math.round((computeCoinsTotal() + computeBillsTotal()) * 100) / 100;
  const displayCoinTotal = computeCoinsTotal();
  const displayBillTotal = computeBillsTotal();

  const validateCoinField = (k, raw, mode) => {
    if (raw === "") return undefined;
    const v = parseFloat(raw);
    if (mode === "number") {
      if (!Number.isFinite(v) || v < 0 || !Number.isInteger(v)) return "יש להזין מספר שלם";
    } else {
      if (!Number.isFinite(v) || v < 0) return "סכום לא תקין";
      if (v > 0) {
        const denomCents = Math.round(COIN_VALUES[k] * 100);
        const amountCents = Math.round(v * 100);
        if (amountCents % denomCents !== 0) return `חייב להיות כפולה של ${COIN_LABELS[k]}`;
      }
    }
    return undefined;
  };

  const validateBillField = (d, raw, mode) => {
    if (raw === "") return undefined;
    const v = parseFloat(raw);
    if (mode === "number") {
      if (!Number.isFinite(v) || v < 0 || !Number.isInteger(v)) return "יש להזין מספר שלם";
    } else {
      if (!Number.isFinite(v) || v < 0) return "סכום לא תקין";
      if (v > 0 && v % d !== 0) return `חייב להיות כפולה של ₪${d}`;
    }
    return undefined;
  };

  const validateSimpleCoins = (raw) => {
    if (raw === "") return undefined;
    const v = parseFloat(raw);
    if (!Number.isFinite(v) || v < 0) return "סכום לא תקין";
    return undefined;
  };

  const handleCalc = () => {
    const newErrors = {};
    if (simpleCoins) {
      const e = validateSimpleCoins(simpleCoinsInput);
      if (e) newErrors.simpleCoins = e;
    } else {
      COIN_KEYS.forEach(k => {
        const e = validateCoinField(k, coinInputs[k], coinMode);
        if (e) newErrors[`coin_${k}`] = e;
      });
    }
    BILL_DENOMS.forEach(d => {
      const e = validateBillField(d, billInputs[d], billMode);
      if (e) newErrors[`bill_${d}`] = e;
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    const coinsTotalVal = computeCoinsTotal();

    const billCounts = {};
    BILL_DENOMS.forEach(d => {
      if (billMode === "number") {
        billCounts[d] = Math.max(0, parseInt(billInputs[d]) || 0);
      } else {
        billCounts[d] = Math.max(0, Math.round((parseFloat(billInputs[d]) || 0) / d));
      }
    });

    setResult(solve(coinsTotalVal, billCounts));
    setTimeout(
      () => registerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      80
    );
  };

  const envelopeTotal = result
    ? BILL_DENOMS.reduce((s, d) => s + result.billsInEnvelope[d] * d, 0) + (result.coinsRemoved || 0)
    : 0;

  const isExact = result && result.gap === 0;

  const handleCoinModeChange = (newMode) => {
    if (newMode === coinMode) return;
    setCoinInputs(prev => {
      const converted = {};
      COIN_KEYS.forEach(k => {
        const raw = prev[k];
        if (raw === "") { converted[k] = ""; return; }
        if (newMode === "sum") {
          const count = parseInt(raw) || 0;
          converted[k] = count > 0 ? String(Math.round(count * COIN_VALUES[k] * 100) / 100) : "";
        } else {
          const sum = parseFloat(raw) || 0;
          const count = sum > 0 ? Math.round(sum / COIN_VALUES[k]) : 0;
          converted[k] = count > 0 ? String(count) : "";
        }
      });
      return converted;
    });
    setCoinMode(newMode);
    setResult(null);
    setErrors({});
  };

  const handleBillModeChange = (newMode) => {
    if (newMode === billMode) return;
    setBillInputs(prev => {
      const converted = {};
      BILL_DENOMS.forEach(d => {
        const raw = prev[d];
        if (raw === "") { converted[d] = ""; return; }
        if (newMode === "sum") {
          const count = parseInt(raw) || 0;
          converted[d] = count > 0 ? String(count * d) : "";
        } else {
          const sum = parseFloat(raw) || 0;
          const count = sum > 0 ? Math.round(sum / d) : 0;
          converted[d] = count > 0 ? String(count) : "";
        }
      });
      return converted;
    });
    setBillMode(newMode);
    setResult(null);
    setErrors({});
  };

  const ModeToggle = ({ mode, onChange, accent }) => (
    <div style={{
      display: "flex",
      background: "#080a14",
      border: "1px solid #1c2038",
      borderRadius: 8,
      overflow: "hidden",
      padding: 3,
      gap: 2,
    }}>
      {["number", "sum"].map(m => (
        <button
          key={m}
          onClick={() => onChange(m)}
          style={{
            padding: "5px 12px",
            border: "none",
            borderRadius: 6,
            background: mode === m ? (accent === "bill" ? "#f2b83b" : "#0fd690") : "transparent",
            color: mode === m ? "#070810" : "#4a5070",
            fontFamily: "inherit",
            fontSize: 12,
            cursor: "pointer",
            fontWeight: mode === m ? 700 : 500,
            transition: "all .2s",
            letterSpacing: ".3px",
            whiteSpace: "nowrap",
          }}
        >
          {m === "number" ? "כמות" : "סכום"}
        </button>
      ))}
    </div>
  );

  return (
    <div dir="rtl" style={{
      minHeight: "100vh",
      background: "#060810",
      color: "#c8cbdf",
      fontFamily: "'Heebo', sans-serif",
      paddingBottom: 80,
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700;800;900&display=swap');

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes resultSlide {
          from { opacity: 0; transform: translateY(14px) scale(.995); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes shimmer {
          from { background-position: -200% center; }
          to   { background-position:  200% center; }
        }
        @keyframes pulseGlow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(15,214,144,0); }
          50%       { box-shadow: 0 0 32px 0 rgba(15,214,144,.1); }
        }
        @keyframes spinnerRotate {
          to { transform: rotate(360deg); }
        }

        *, *::before, *::after {
          box-sizing: border-box;
          touch-action: manipulation;
        }

        /* ── BG mesh ── */
        .bg-mesh {
          position: fixed;
          inset: 0;
          z-index: 0;
          pointer-events: none;
          background:
            radial-gradient(ellipse 70% 50% at 20% 0%, rgba(15,214,144,.04) 0%, transparent 60%),
            radial-gradient(ellipse 60% 40% at 80% 100%, rgba(242,184,59,.04) 0%, transparent 60%);
        }
        .bg-dots {
          position: fixed;
          inset: 0;
          z-index: 0;
          pointer-events: none;
          background-image: radial-gradient(circle, #171a2a 1px, transparent 1px);
          background-size: 24px 24px;
          opacity: .45;
        }

        /* ── Sticky header ── */
        .sticky-header {
          position: sticky;
          top: 0;
          z-index: 100;
          background: rgba(6,8,16,.94);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border-bottom: 1px solid #141728;
          padding: 0 20px;
          height: 62px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 28px;
        }
        .header-logo {
          display: flex;
          align-items: center;
          gap: 11px;
        }
        .header-icon {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          background: linear-gradient(135deg, #0fd690 0%, #00a870 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          flex-shrink: 0;
          box-shadow: 0 0 0 1px rgba(15,214,144,.25), 0 4px 12px rgba(15,214,144,.15);
        }
        .header-title {
          font-size: 15px;
          font-weight: 700;
          color: #e0e3f5;
          line-height: 1.1;
          letter-spacing: -.2px;
        }
        .header-subtitle {
          font-size: 11px;
          color: #30334e;
          margin-top: 2px;
          font-weight: 500;
          letter-spacing: .3px;
        }
        .header-total-block {
          text-align: left;
          min-width: 90px;
        }
        .header-total-label {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 1.2px;
          text-transform: uppercase;
          color: #30334e;
          margin-bottom: 2px;
        }
        .header-total-amount {
          font-size: 20px;
          font-weight: 800;
          line-height: 1;
          letter-spacing: -.5px;
          transition: color .3s;
          font-variant-numeric: tabular-nums;
        }
        .header-total-amount.has-value { color: #0fd690; }
        .header-total-amount.no-value  { color: #252840; }

        /* ── Cards ── */
        .card {
          background: #0c0f1c;
          border: 1px solid #181b2c;
          border-radius: 18px;
          padding: 22px 20px;
          position: relative;
          overflow: hidden;
        }
        .card::before {
          content: '';
          position: absolute;
          top: 0; right: 0; left: 0;
          height: 2px;
          border-radius: 18px 18px 0 0;
        }
        .card-coins::before  { background: linear-gradient(90deg, #0fd690, rgba(15,214,144,0)); }
        .card-bills::before  { background: linear-gradient(90deg, #f2b83b, rgba(242,184,59,0)); }
        .card-register::before { background: linear-gradient(90deg, #0fd690, rgba(15,214,144,0)); }
        .card-register-approx::before { background: linear-gradient(90deg, #f2b83b, rgba(242,184,59,0)); }
        .card-envelope::before { background: linear-gradient(90deg, #252840, transparent); }

        .anim-1 { animation: fadeUp .5s cubic-bezier(.22,1,.36,1) .05s both; }
        .anim-2 { animation: fadeUp .5s cubic-bezier(.22,1,.36,1) .15s both; }
        .anim-3 { animation: fadeUp .5s cubic-bezier(.22,1,.36,1) .25s both; }
        .result-anim { animation: resultSlide .4s cubic-bezier(.22,1,.36,1) both; }

        /* ── Card header ── */
        .card-head {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
          gap: 10px;
          flex-wrap: wrap;
        }
        .card-head-left {
          display: flex;
          align-items: center;
          gap: 9px;
        }
        .section-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 13px;
          font-weight: 700;
          letter-spacing: .5px;
          color: #e0e3f5;
        }
        .section-badge-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          flex-shrink: 0;
        }
        .dot-coin { background: #0fd690; box-shadow: 0 0 6px rgba(15,214,144,.6); }
        .dot-bill { background: #f2b83b; box-shadow: 0 0 6px rgba(242,184,59,.6); }
        .card-head-controls {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-shrink: 0;
        }

        /* ── Switch ── */
        .sw-wrap {
          display: flex;
          align-items: center;
          gap: 7px;
        }
        .sw-track {
          width: 34px;
          height: 19px;
          background: #1a1d2e;
          border-radius: 10px;
          position: relative;
          cursor: pointer;
          border: 1px solid #252840;
          flex-shrink: 0;
          transition: background .2s, border-color .2s;
          padding: 0;
        }
        .sw-track::after {
          content: '';
          position: absolute;
          width: 13px;
          height: 13px;
          background: #3a3e58;
          border-radius: 50%;
          top: 2px;
          right: 2px;
          transition: right .2s, background .2s;
        }
        .sw-track.on {
          background: rgba(15,214,144,.2);
          border-color: rgba(15,214,144,.4);
        }
        .sw-track.on::after {
          right: 17px;
          background: #0fd690;
        }
        .sw-label {
          font-size: 11px;
          font-weight: 600;
          color: #353852;
          letter-spacing: .4px;
          text-transform: uppercase;
        }

        /* ── Inputs ── */
        .inp {
          background: #090b18;
          border: 1px solid #1a1d2e;
          border-radius: 10px;
          color: #d8daf0;
          padding: 10px 12px;
          font-family: inherit;
          font-size: 15px;
          width: 100%;
          outline: none;
          transition: border-color .2s, background .2s, box-shadow .2s;
          -moz-appearance: textfield;
          font-variant-numeric: tabular-nums;
        }
        .inp::-webkit-outer-spin-button,
        .inp::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        .inp:focus {
          border-color: #0fd690;
          background: #080f0d;
          box-shadow: 0 0 0 3px rgba(15,214,144,.06);
        }
        .inp.bill-focus:focus {
          border-color: #f2b83b;
          background: #0f0d07;
          box-shadow: 0 0 0 3px rgba(242,184,59,.06);
        }
        .inp.err {
          border-color: #f05252;
          box-shadow: 0 0 0 3px rgba(240,82,82,.06);
        }
        .inp::placeholder { color: #1e2235; }
        .inp[readonly] { opacity: .28; cursor: default; pointer-events: none; }

        /* ── Sub labels ── */
        .sub-label {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 1px;
          text-transform: uppercase;
          color: #2e3252;
          margin-bottom: 5px;
        }

        /* ── Denom chips ── */
        .denom-chip {
          display: inline-flex;
          align-items: center;
          padding: 3px 9px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: .3px;
          margin-bottom: 9px;
          font-variant-numeric: tabular-nums;
        }
        .chip-coin {
          background: rgba(15,214,144,.08);
          border: 1px solid rgba(15,214,144,.18);
          color: #0fd690;
        }
        .chip-bill {
          background: rgba(242,184,59,.08);
          border: 1px solid rgba(242,184,59,.18);
          color: #f2b83b;
        }

        /* ── Grid ── */
        .inp-row { display: flex; gap: 8px; }
        .grid-2 {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
        }

        /* ── Error msg ── */
        .err-msg {
          color: #f08080;
          font-size: 11px;
          margin-top: 5px;
          font-weight: 500;
        }

        /* ── Section total row ── */
        .section-total {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 18px;
          padding-top: 14px;
          border-top: 1px solid #14172a;
        }
        .section-total-label {
          font-size: 12px;
          font-weight: 700;
          letter-spacing: .8px;
          text-transform: uppercase;
          color: #353858;
        }
        .section-total-amount {
          font-size: 16px;
          font-weight: 800;
          letter-spacing: -.3px;
          font-variant-numeric: tabular-nums;
        }
        .coin-total-amount { color: #0fd690; }
        .bill-total-amount { color: #f2b83b; }

        /* ── Calculate button ── */
        .btn-calc {
          width: 100%;
          padding: 16px;
          border: none;
          border-radius: 14px;
          background: linear-gradient(135deg, #0fd690 0%, #00a870 100%);
          color: #050810;
          font-size: 15px;
          font-family: inherit;
          font-weight: 800;
          cursor: pointer;
          letter-spacing: .5px;
          transition: filter .15s, transform .1s, box-shadow .2s;
          position: relative;
          overflow: hidden;
          box-shadow: 0 4px 20px rgba(15,214,144,.2), 0 1px 4px rgba(0,0,0,.3);
        }
        .btn-calc::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,.22) 50%, transparent 100%);
          background-size: 200% auto;
          opacity: 0;
          transition: opacity .25s;
        }
        .btn-calc:hover::after { opacity: 1; animation: shimmer 1.1s linear infinite; }
        .btn-calc:hover {
          filter: brightness(1.08);
          box-shadow: 0 6px 28px rgba(15,214,144,.3), 0 2px 6px rgba(0,0,0,.3);
        }
        .btn-calc:active { transform: scale(.98); }

        /* ── Report button ── */
        .btn-report {
          width: 100%;
          padding: 13px;
          border: 1px solid #1c2038;
          border-radius: 14px;
          background: transparent;
          color: #353858;
          font-size: 13px;
          font-family: inherit;
          font-weight: 600;
          cursor: pointer;
          transition: all .2s;
          margin-top: 10px;
          letter-spacing: .3px;
        }
        .btn-report:hover {
          border-color: rgba(15,214,144,.25);
          color: #0fd690;
          background: rgba(15,214,144,.04);
        }
        .btn-report:active { transform: scale(.98); }

        /* ── Result section ── */
        .result-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 18px;
        }
        .result-label {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          color: #2e3252;
          margin-bottom: 8px;
        }
        .result-amount {
          font-size: 36px;
          font-weight: 900;
          letter-spacing: -1.5px;
          line-height: 1;
          font-variant-numeric: tabular-nums;
        }
        .amount-exact   { color: #0fd690; }
        .amount-approx  { color: #f2b83b; }
        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 5px 12px;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: .5px;
          margin-top: 3px;
          flex-shrink: 0;
        }
        .badge-exact {
          background: rgba(15,214,144,.1);
          border: 1px solid rgba(15,214,144,.3);
          color: #0fd690;
        }
        .badge-approx {
          background: rgba(242,184,59,.1);
          border: 1px solid rgba(242,184,59,.3);
          color: #f2b83b;
        }

        /* ── Result rows ── */
        .result-divider {
          height: 1px;
          background: #14172a;
          margin: 14px 0;
        }
        .res-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 0;
          font-size: 14px;
          border-bottom: 1px solid #0e1020;
        }
        .res-row:last-child { border-bottom: none; }
        .res-row-label { color: #4a5070; font-weight: 500; }
        .res-row-value { font-weight: 700; color: #9aa0c0; font-variant-numeric: tabular-nums; }

        /* ── Denomination pill ── */
        .denom-pill {
          display: inline-flex;
          align-items: center;
          padding: 1px 8px;
          border-radius: 5px;
          font-size: 11px;
          font-weight: 700;
          margin-left: 7px;
          font-variant-numeric: tabular-nums;
        }
        .pill-coin-reg {
          background: rgba(15,214,144,.08);
          border: 1px solid rgba(15,214,144,.2);
          color: #0fd690;
        }
        .pill-bill-reg {
          background: rgba(242,184,59,.08);
          border: 1px solid rgba(242,184,59,.2);
          color: #f2b83b;
        }
        .pill-env {
          background: rgba(255,255,255,.04);
          border: 1px solid rgba(255,255,255,.08);
          color: #3a3e58;
        }

        /* ── Notices ── */
        .notice {
          border-radius: 10px;
          padding: 11px 14px;
          font-size: 13px;
          margin-top: 12px;
          line-height: 1.55;
          font-weight: 500;
        }
        .notice-warn {
          background: rgba(240,82,82,.06);
          border: 1px solid rgba(240,82,82,.2);
          color: #f08080;
        }
        .notice-info {
          background: rgba(15,214,144,.06);
          border: 1px solid rgba(15,214,144,.18);
          color: #0fd690;
        }
        .notice-gap {
          background: rgba(242,184,59,.06);
          border: 1px solid rgba(242,184,59,.2);
          color: #d4a030;
        }

        /* ── Glow on exact register ── */
        .register-glow {
          animation: pulseGlow 3s ease-in-out infinite;
        }

        /* ── Scroll margin for sticky header ── */
        .scroll-target {
          scroll-margin-top: 76px;
        }

        @media (max-width: 430px) {
          .card { padding: 18px 15px; }
          .btn-calc { padding: 15px; font-size: 15px; min-height: 52px; }
          .btn-report { min-height: 48px; }
          .inp { padding: 10px 10px; min-height: 44px; font-size: 14px; }
          .inp-row { flex-direction: column; gap: 8px; }
          .result-amount { font-size: 30px; }
          .card-head { margin-bottom: 16px; }
          .grid-2 { gap: 12px; }
        }

        @media (max-width: 360px) {
          .card-head-controls { gap: 7px; }
          .sticky-header { padding: 0 14px; }
        }
      `}</style>

      <div className="bg-dots" />
      <div className="bg-mesh" />

      {/* ── Sticky header ── */}
      <header className="sticky-header">
        <div className="header-logo">
          <div className="header-icon">💰</div>
          <div>
            <div className="header-title">ספירת קופה</div>
            <div className="header-subtitle">יעד: ₪1,000 בקופה</div>
          </div>
        </div>
        <div className="header-total-block">
          <div className="header-total-label">מלאי</div>
          <div className={`header-total-amount ${totalInventory > 0 ? "has-value" : "no-value"}`}>
            {fmt(totalInventory)}
          </div>
        </div>
      </header>

      <div style={{ maxWidth: 520, margin: "0 auto", padding: "0 16px", position: "relative", zIndex: 1 }}>

        {/* ── Coins card ── */}
        <div className="card card-coins anim-1" style={{ marginBottom: 12 }}>
          <div className="card-head">
            <div className="card-head-left">
              <span className="section-badge">
                <span className="section-badge-dot dot-coin" />
                מטבעות
              </span>
            </div>
            <div className="card-head-controls">
              {!simpleCoins && <ModeToggle mode={coinMode} onChange={handleCoinModeChange} accent="coin" />}
              <div className="sw-wrap">
                <button
                  className={`sw-track${simpleCoins ? " on" : ""}`}
                  onClick={() => { setSimpleCoins(s => !s); setErrors({}); setResult(null); }}
                />
                <span className="sw-label">פשוט</span>
              </div>
            </div>
          </div>

          {simpleCoins ? (
            <div>
              <input
                className={`inp${errors.simpleCoins ? " err" : ""}`}
                type="number"
                inputMode="decimal"
                value={simpleCoinsInput}
                onChange={e => {
                  setSimpleCoinsInput(e.target.value);
                  setErrors(p => ({ ...p, simpleCoins: validateSimpleCoins(e.target.value) }));
                }}
                placeholder={'סה"כ מטבעות (₪)'}
                step="0.1"
                min="0"
              />
              {errors.simpleCoins && <div className="err-msg">{errors.simpleCoins}</div>}
            </div>
          ) : (
            <div className="grid-2">
              {COIN_KEYS.map(k => {
                const denom = COIN_VALUES[k];
                const rawVal = coinInputs[k];
                let numberDisplayVal, sumDisplayVal;
                if (coinMode === "number") {
                  numberDisplayVal = rawVal;
                  const count = parseInt(rawVal) || 0;
                  sumDisplayVal = rawVal !== "" && count > 0 ? String(Math.round(count * denom * 100) / 100) : "";
                } else {
                  sumDisplayVal = rawVal;
                  const sum = parseFloat(rawVal) || 0;
                  const count = rawVal !== "" && sum > 0 ? Math.round(sum / denom) : 0;
                  numberDisplayVal = rawVal !== "" && count > 0 ? String(count) : "";
                }
                return (
                  <div key={k}>
                    <div className="denom-chip chip-coin">{COIN_LABELS[k]}</div>
                    <div className="inp-row">
                      <div style={{ flex: 1 }}>
                        <div className="sub-label">כמות</div>
                        <input
                          className={`inp${errors[`coin_${k}`] && coinMode === "number" ? " err" : ""}`}
                          type="number"
                          inputMode="numeric"
                          value={numberDisplayVal}
                          readOnly={coinMode !== "number"}
                          onChange={coinMode === "number" ? e => {
                            setCoinInputs(p => ({ ...p, [k]: e.target.value }));
                            setErrors(p => ({ ...p, [`coin_${k}`]: validateCoinField(k, e.target.value, "number") }));
                          } : undefined}
                          placeholder="0"
                          step="1"
                          min="0"
                        />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div className="sub-label">סכום ₪</div>
                        <input
                          className={`inp${errors[`coin_${k}`] && coinMode === "sum" ? " err" : ""}`}
                          type="number"
                          inputMode="decimal"
                          value={sumDisplayVal}
                          readOnly={coinMode !== "sum"}
                          onChange={coinMode === "sum" ? e => {
                            setCoinInputs(p => ({ ...p, [k]: e.target.value }));
                            setErrors(p => ({ ...p, [`coin_${k}`]: validateCoinField(k, e.target.value, "sum") }));
                          } : undefined}
                          placeholder="0.00"
                          step={String(denom)}
                          min="0"
                        />
                      </div>
                    </div>
                    {errors[`coin_${k}`] && <div className="err-msg">{errors[`coin_${k}`]}</div>}
                  </div>
                );
              })}
            </div>
          )}

          {/* Coin total — only non-simple mode */}
          {!simpleCoins && displayCoinTotal > 0 && (
            <div className="section-total">
              <span className="section-total-label">סה"כ מטבעות</span>
              <span className="section-total-amount coin-total-amount">{fmt(displayCoinTotal)}</span>
            </div>
          )}
        </div>

        {/* ── Bills card ── */}
        <div className="card card-bills anim-2" style={{ marginBottom: 20 }}>
          <div className="card-head">
            <div className="card-head-left">
              <span className="section-badge">
                <span className="section-badge-dot dot-bill" />
                שטרות
              </span>
            </div>
            <ModeToggle mode={billMode} onChange={handleBillModeChange} accent="bill" />
          </div>

          <div className="grid-2">
            {BILL_DENOMS.map(d => {
              const rawVal = billInputs[d];
              let numberDisplayVal, sumDisplayVal;
              if (billMode === "number") {
                numberDisplayVal = rawVal;
                const count = parseInt(rawVal) || 0;
                sumDisplayVal = rawVal !== "" && count > 0 ? String(count * d) : "";
              } else {
                sumDisplayVal = rawVal;
                const sum = parseFloat(rawVal) || 0;
                const count = rawVal !== "" && sum > 0 ? Math.round(sum / d) : 0;
                numberDisplayVal = rawVal !== "" && count > 0 ? String(count) : "";
              }
              return (
                <div key={d}>
                  <div className="denom-chip chip-bill">₪{d}</div>
                  <div className="inp-row">
                    <div style={{ flex: 1 }}>
                      <div className="sub-label">כמות</div>
                      <input
                        className={`inp bill-focus${errors[`bill_${d}`] && billMode === "number" ? " err" : ""}`}
                        type="number"
                        inputMode="numeric"
                        value={numberDisplayVal}
                        readOnly={billMode !== "number"}
                        onChange={billMode === "number" ? e => {
                          setBillInputs(p => ({ ...p, [d]: e.target.value }));
                          setErrors(p => ({ ...p, [`bill_${d}`]: validateBillField(d, e.target.value, "number") }));
                        } : undefined}
                        placeholder="0"
                        step="1"
                        min="0"
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div className="sub-label">סכום ₪</div>
                      <input
                        className={`inp bill-focus${errors[`bill_${d}`] && billMode === "sum" ? " err" : ""}`}
                        type="number"
                        inputMode="numeric"
                        value={sumDisplayVal}
                        readOnly={billMode !== "sum"}
                        onChange={billMode === "sum" ? e => {
                          setBillInputs(p => ({ ...p, [d]: e.target.value }));
                          setErrors(p => ({ ...p, [`bill_${d}`]: validateBillField(d, e.target.value, "sum") }));
                        } : undefined}
                        placeholder={String(d * 3)}
                        step={String(d)}
                        min="0"
                      />
                    </div>
                  </div>
                  {errors[`bill_${d}`] && <div className="err-msg">{errors[`bill_${d}`]}</div>}
                </div>
              );
            })}
          </div>

          {/* Bills total */}
          {displayBillTotal > 0 && (
            <div className="section-total">
              <span className="section-total-label">סה"כ שטרות</span>
              <span className="section-total-amount bill-total-amount">{fmt(displayBillTotal)}</span>
            </div>
          )}
        </div>

        {/* ── Actions ── */}
        <div className="anim-3">
          <button className="btn-calc" onClick={handleCalc}>
            חשב חלוקה אופטימלית
          </button>
          <button
            className="btn-report"
            onClick={() => {
              const newErrors = {};
              if (simpleCoins) {
                const e = validateSimpleCoins(simpleCoinsInput);
                if (e) newErrors.simpleCoins = e;
              } else {
                COIN_KEYS.forEach(k => {
                  const e = validateCoinField(k, coinInputs[k], coinMode);
                  if (e) newErrors[`coin_${k}`] = e;
                });
              }
              BILL_DENOMS.forEach(d => {
                const e = validateBillField(d, billInputs[d], billMode);
                if (e) newErrors[`bill_${d}`] = e;
              });
              if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }
              generateReport({ coinInputs, coinMode, simpleCoins, simpleCoinsInput, billInputs, billMode });
            }}
          >
            📊 הפק דוח ספירה
          </button>
        </div>

        {/* ── Result ── */}
        {result && (
          <div style={{ marginTop: 24 }}>

            {/* Register card */}
            <div
              ref={registerRef}
              className={`card result-anim scroll-target ${isExact ? "card-register register-glow" : "card-register-approx"}`}
              style={{ marginBottom: 10, borderColor: isExact ? "rgba(15,214,144,.2)" : "rgba(242,184,59,.18)" }}
            >
              <div className="result-header">
                <div>
                  <div className="result-label">בקופה</div>
                  <div className={`result-amount ${isExact ? "amount-exact" : "amount-approx"}`}>
                    {fmt(result.totalInRegister)}
                  </div>
                </div>
                <div className={`status-badge ${isExact ? "badge-exact" : "badge-approx"}`}>
                  {isExact ? "✓ מדויק" : "קירוב"}
                </div>
              </div>

              <div className="result-divider" />

              <div>
                <div className="res-row">
                  <span className="res-row-label">מטבעות</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {result.coinsRemoved > 0 && result.type !== "coins_over" && (
                      <span style={{ color: "#f08080", fontSize: 12, fontWeight: 600 }}>
                        הוצא {fmt(result.coinsRemoved)}
                      </span>
                    )}
                    <span className="res-row-value" style={{ color: "#bcc0d8" }}>{fmt(result.coinsInRegister)}</span>
                  </div>
                </div>

                {result.type === "coins_over" && (
                  <div className="notice notice-warn">
                    ⚠️ המטבעות עולים על ₪1,000 — יש להוציא כ-{fmt(result.coinsRemoved)} מטבעות.
                  </div>
                )}

                {BILL_DENOMS.map(d =>
                  result.billsInRegister[d] > 0 ? (
                    <div key={d} className="res-row">
                      <span className="res-row-label" style={{ display: "flex", alignItems: "center" }}>
                        <span className={`denom-pill ${d <= 50 ? "pill-coin-reg" : "pill-bill-reg"}`}>₪{d}</span>
                        {result.billsInRegister[d]} שטרות
                      </span>
                      <span className="res-row-value">{fmt(result.billsInRegister[d] * d)}</span>
                    </div>
                  ) : null
                )}

                {result.type === "exact_remove" && (
                  <div className="notice notice-info">
                    💡 יש להוציא {fmt(result.coinsRemoved)} מהמטבעות כדי להגיע בדיוק ל-₪1,000
                  </div>
                )}

                {result.gap > 0 && (
                  <div className="notice notice-gap">
                    ⚠️ חסר {fmt(result.gap)} ל-₪1,000 — אין שטרות מתאימים להשלמה
                  </div>
                )}
              </div>
            </div>

            {/* Envelope card */}
            <div className="card card-envelope result-anim" style={{ animationDelay: ".08s", borderColor: "#141728" }}>
              <div className="result-header" style={{ marginBottom: envelopeTotal > 0 ? 0 : 0 }}>
                <div>
                  <div className="result-label">במעטפה</div>
                  <div style={{
                    fontSize: 22,
                    fontWeight: 800,
                    letterSpacing: "-.5px",
                    color: envelopeTotal > 0 ? "#4a5070" : "#1e2235",
                    fontVariantNumeric: "tabular-nums",
                  }}>
                    {fmt(envelopeTotal)}
                  </div>
                </div>
              </div>

              {envelopeTotal > 0 && (
                <>
                  <div className="result-divider" />
                  <div>
                    {(result.type === "coins_over" || result.type === "exact_remove") && result.coinsRemoved > 0 && (
                      <div className="res-row" style={{ opacity: .6 }}>
                        <span className="res-row-label">מטבעות להוצאה</span>
                        <span className="res-row-value">{fmt(result.coinsRemoved)}</span>
                      </div>
                    )}
                    {BILL_DENOMS.map(d =>
                      result.billsInEnvelope[d] > 0 ? (
                        <div key={d} className="res-row" style={{ opacity: .6 }}>
                          <span className="res-row-label" style={{ display: "flex", alignItems: "center" }}>
                            <span className="denom-pill pill-env">₪{d}</span>
                            {result.billsInEnvelope[d]} שטרות
                          </span>
                          <span className="res-row-value">{fmt(result.billsInEnvelope[d] * d)}</span>
                        </div>
                      ) : null
                    )}
                  </div>
                </>
              )}

              {envelopeTotal === 0 && (
                <div style={{ color: "#1e2235", fontSize: 13, marginTop: 6, fontWeight: 500 }}>
                  המעטפה ריקה — הכל בקופה
                </div>
              )}
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
