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

  // White background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  // Header
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

  // Column header bg
  const chY = HEADER_H;
  ctx.fillStyle = "#f0f2f5";
  ctx.fillRect(0, chY, W, COL_HEADER_H);

  // Borders
  ctx.strokeStyle = "#dee2e6";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, chY + COL_HEADER_H);
  ctx.lineTo(W, chY + COL_HEADER_H);
  ctx.stroke();

  // Center divider line (from col header to subtotals)
  ctx.beginPath();
  ctx.moveTo(MID, chY);
  ctx.lineTo(MID, HEADER_H + COL_HEADER_H + maxContentRows * ROW_H + SUBTOTALS_H);
  ctx.stroke();

  // Column header labels
  ctx.font = 'bold 15px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = "#3b82f6";
  ctx.textAlign = "center";
  ctx.fillText("מטבעות", MID / 2, chY + 25);

  ctx.fillStyle = "#d97706";
  ctx.fillText("שטרות", MID + MID / 2, chY + 25);

  // Content rows
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

    // Row separator
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

  // Subtotals
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

  // Center divider in subtotals
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

  // Grand total
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
  const resultRef = useRef(null);

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
      () => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
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

  const ModeToggle = ({ mode, onChange }) => (
    <div style={{
      display: "flex",
      background: "#0b0d14",
      border: "1px solid #1e2133",
      borderRadius: 8,
      overflow: "hidden",
      padding: 2,
      gap: 2,
    }}>
      {["number", "sum"].map(m => (
        <button
          key={m}
          onClick={() => onChange(m)}
          style={{
            padding: "5px 13px",
            border: "none",
            borderRadius: 6,
            background: mode === m ? "#00e5a0" : "transparent",
            color: mode === m ? "#0b0d14" : "#555",
            fontFamily: "inherit",
            fontSize: 12,
            cursor: "pointer",
            fontWeight: mode === m ? 700 : 400,
            transition: "all .2s",
            letterSpacing: ".3px",
          }}
        >
          {m === "number" ? "מספר" : "סכום"}
        </button>
      ))}
    </div>
  );

  return (
    <div dir="rtl" style={{
      minHeight: "100vh",
      background: "#0b0d14",
      color: "#d0d4e8",
      fontFamily: "'Heebo', sans-serif",
      padding: "0 0 80px",
    }}>
      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: none; }
        }
        @keyframes resultIn {
          from { opacity: 0; transform: translateY(12px) scale(.99); }
          to   { opacity: 1; transform: none; }
        }
        @keyframes glowPulse {
          0%, 100% { box-shadow: 0 0 0px rgba(0,229,160,0); }
          50%       { box-shadow: 0 0 28px rgba(0,229,160,.12); }
        }
        @keyframes shimmer {
          from { background-position: -200% center; }
          to   { background-position:  200% center; }
        }

        *, *::before, *::after { box-sizing: border-box; }

        .card {
          background: #13151e;
          border: 1px solid #1e2133;
          border-radius: 16px;
          padding: 22px;
        }
        .anim-1 { animation: slideUp .45s cubic-bezier(.22,1,.36,1) .05s both; }
        .anim-2 { animation: slideUp .45s cubic-bezier(.22,1,.36,1) .15s both; }
        .anim-3 { animation: slideUp .45s cubic-bezier(.22,1,.36,1) .25s both; }

        .inp {
          background: #0e1020;
          border: 1px solid #1e2133;
          border-radius: 10px;
          color: #d0d4e8;
          padding: 9px 11px;
          font-family: inherit;
          font-size: 15px;
          width: 100%;
          outline: none;
          transition: border-color .2s, background .2s;
          -moz-appearance: textfield;
        }
        .inp::-webkit-outer-spin-button,
        .inp::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
        .inp:focus { border-color: #00e5a0; background: #0b1a14; }
        .inp.err { border-color: #ff6b35; }
        .inp::placeholder { color: #282b3e; }
        .inp[readonly] { opacity: .32; cursor: default; }

        .err-msg { color: #ff9a6c; font-size: 12px; margin-top: 4px; }

        .section-title {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 1.8px;
          text-transform: uppercase;
          color: #383c58;
        }

        .sub-label {
          font-size: 10px;
          color: #383c58;
          margin-bottom: 3px;
          letter-spacing: .6px;
          text-transform: uppercase;
          font-weight: 600;
        }

        .denom-chip {
          display: inline-flex;
          align-items: center;
          padding: 2px 9px;
          border-radius: 5px;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: .3px;
          margin-bottom: 8px;
        }
        .denom-chip.coin {
          background: #0a1f16;
          border: 1px solid #00e5a022;
          color: #00e5a0;
        }
        .denom-chip.bill {
          background: #1a1504;
          border: 1px solid #ffd16622;
          color: #ffd166;
        }

        .btn {
          width: 100%;
          padding: 15px;
          border: none;
          border-radius: 12px;
          background: linear-gradient(135deg, #00e5a0, #00b37d);
          color: #0b0d14;
          font-size: 16px;
          font-family: inherit;
          font-weight: 700;
          cursor: pointer;
          letter-spacing: .5px;
          transition: filter .15s, transform .1s;
          position: relative;
          overflow: hidden;
        }
        .btn::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,.18) 50%, transparent 100%);
          background-size: 200% auto;
          opacity: 0;
          transition: opacity .25s;
        }
        .btn:hover::after { opacity: 1; animation: shimmer 1.1s linear infinite; }
        .btn:hover { filter: brightness(1.07); }
        .btn:active { transform: scale(.98); }

        .btn-report {
          width: 100%;
          padding: 13px;
          border: 1px solid #1e2133;
          border-radius: 12px;
          background: transparent;
          color: #555;
          font-size: 14px;
          font-family: inherit;
          font-weight: 600;
          cursor: pointer;
          transition: all .2s;
          margin-top: 10px;
          letter-spacing: .3px;
        }
        .btn-report:hover { border-color: #00e5a033; color: #00e5a0; background: #0d1f1855; }
        .btn-report:active { transform: scale(.98); }

        .pill {
          display: inline-block;
          border-radius: 6px;
          padding: 2px 8px;
          font-size: 12px;
          font-weight: 700;
          margin-left: 6px;
        }

        .result-card { animation: resultIn .38s cubic-bezier(.22,1,.36,1) both; }

        .row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 0;
          border-bottom: 1px solid #181b28;
          font-size: 14px;
        }
        .row:last-child { border-bottom: none; }

        .notice {
          border-radius: 10px;
          padding: 10px 14px;
          font-size: 13px;
          margin-top: 12px;
          line-height: 1.55;
        }

        .sw-track {
          width: 36px;
          height: 20px;
          background: #1e2133;
          border-radius: 10px;
          position: relative;
          cursor: pointer;
          border: none;
          flex-shrink: 0;
          transition: background .2s;
        }
        .sw-track.on { background: #00e5a0; }
        .sw-track::after {
          content: '';
          position: absolute;
          width: 14px;
          height: 14px;
          background: white;
          border-radius: 50%;
          top: 3px;
          right: 3px;
          transition: right .2s;
        }
        .sw-track.on::after { right: 19px; }

        .register-exact {
          border-color: #00e5a055 !important;
          animation: glowPulse 2.8s ease-in-out infinite;
        }

        .dot-grid {
          position: fixed;
          inset: 0;
          z-index: 0;
          background-image: radial-gradient(circle, #1c1f30 1px, transparent 1px);
          background-size: 28px 28px;
          opacity: .5;
          pointer-events: none;
        }
      `}</style>

      <div className="dot-grid" />

      {/* Sticky header */}
      <div style={{
        position: "sticky", top: 0, zIndex: 50,
        background: "rgba(11,13,20,.88)",
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        borderBottom: "1px solid #1a1d2e",
        padding: "12px 20px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 24,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 9,
            background: "linear-gradient(135deg, #00e5a0, #00b37d)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 17, flexShrink: 0,
          }}>💰</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#e0e4f0", lineHeight: 1.1 }}>ספירת קופה</div>
            <div style={{ fontSize: 11, color: "#383c58", marginTop: 1, fontWeight: 500 }}>יעד: ₪1,000 בקופה</div>
          </div>
        </div>
        {totalInventory > 0 && (
          <div style={{ textAlign: "left" }}>
            <div style={{ fontSize: 10, color: "#383c58", fontWeight: 600, letterSpacing: "1px", textTransform: "uppercase" }}>מלאי</div>
            <div style={{
              fontSize: 19, fontWeight: 800, lineHeight: 1.1,
              color: totalInventory >= 1000 ? "#00e5a0" : "#e0e4f0",
            }}>
              {fmt(totalInventory)}
            </div>
          </div>
        )}
      </div>

      <div style={{ maxWidth: 500, margin: "0 auto", padding: "0 16px", position: "relative", zIndex: 1 }}>

        {/* Coins card */}
        <div className="card anim-1" style={{ marginBottom: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
            <span className="section-title">מטבעות</span>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {!simpleCoins && <ModeToggle mode={coinMode} onChange={handleCoinModeChange} />}
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <button
                  className={`sw-track${simpleCoins ? " on" : ""}`}
                  onClick={() => { setSimpleCoins(s => !s); setErrors({}); setResult(null); }}
                />
                <span style={{ fontSize: 11, color: "#383c58", fontWeight: 600 }}>פשוט</span>
              </div>
            </div>
          </div>

          {simpleCoins ? (
            <div>
              <input
                className={`inp${errors.simpleCoins ? " err" : ""}`}
                type="number"
                value={simpleCoinsInput}
                onChange={e => { setSimpleCoinsInput(e.target.value); setErrors(p => ({ ...p, simpleCoins: validateSimpleCoins(e.target.value) })); }}
                placeholder={'סה"כ מטבעות (₪)'}
                step="0.1"
                min="0"
              />
              {errors.simpleCoins && <div className="err-msg">{errors.simpleCoins}</div>}
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
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
                    <div className="denom-chip coin">{COIN_LABELS[k]}</div>
                    <div style={{ display: "flex", gap: 5 }}>
                      <div style={{ flex: 1 }}>
                        <div className="sub-label">כמות</div>
                        <input
                          className={`inp${errors[`coin_${k}`] && coinMode === "number" ? " err" : ""}`}
                          type="number"
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
        </div>

        {/* Bills card */}
        <div className="card anim-2" style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
            <span className="section-title">שטרות</span>
            <ModeToggle mode={billMode} onChange={handleBillModeChange} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
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
                  <div className="denom-chip bill">₪{d}</div>
                  <div style={{ display: "flex", gap: 5 }}>
                    <div style={{ flex: 1 }}>
                      <div className="sub-label">כמות</div>
                      <input
                        className={`inp${errors[`bill_${d}`] && billMode === "number" ? " err" : ""}`}
                        type="number"
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
                        className={`inp${errors[`bill_${d}`] && billMode === "sum" ? " err" : ""}`}
                        type="number"
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
        </div>

        {/* Actions */}
        <div className="anim-3">
          <button className="btn" onClick={handleCalc}>חשב חלוקה אופטימלית</button>
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

        {/* Result */}
        {result && (
          <div ref={resultRef} className="result-card" style={{ marginTop: 20 }}>

            {/* Register card */}
            <div className={`card${isExact ? " register-exact" : ""}`} style={{
              borderColor: isExact ? "#00e5a055" : "#ffd16633",
              marginBottom: 10,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                <div>
                  <div className="section-title" style={{ marginBottom: 6 }}>בקופה</div>
                  <div style={{
                    fontSize: 34, fontWeight: 800, letterSpacing: "-1px", lineHeight: 1,
                    color: isExact ? "#00e5a0" : "#ffd166",
                  }}>
                    {fmt(result.totalInRegister)}
                  </div>
                </div>
                <div style={{
                  padding: "4px 11px", borderRadius: 20, marginTop: 2,
                  background: isExact ? "#00e5a018" : "#ffd16618",
                  border: `1px solid ${isExact ? "#00e5a040" : "#ffd16640"}`,
                  fontSize: 11, fontWeight: 700, letterSpacing: ".5px",
                  color: isExact ? "#00e5a0" : "#ffd166",
                }}>
                  {isExact ? "✓ מדויק" : "קירוב"}
                </div>
              </div>

              <div style={{ borderTop: "1px solid #181b28", paddingTop: 12 }}>
                <div className="row" style={{ color: "#8890aa" }}>
                  <span>מטבעות</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {result.coinsRemoved > 0 && result.type !== "coins_over" && (
                      <span style={{ color: "#ff9a6c", fontSize: 12 }}>הוצא {fmt(result.coinsRemoved)}</span>
                    )}
                    <span style={{ fontWeight: 600, color: "#c0c8e0" }}>{fmt(result.coinsInRegister)}</span>
                  </div>
                </div>

                {result.type === "coins_over" && (
                  <div className="notice" style={{ background: "#1a0e0a", border: "1px solid #ff6b3540", color: "#ff9a6c" }}>
                    ⚠️ המטבעות עולים על ₪1,000 — יש להוציא כ-{fmt(result.coinsRemoved)} מטבעות.
                  </div>
                )}

                {BILL_DENOMS.map(d =>
                  result.billsInRegister[d] > 0 ? (
                    <div key={d} className="row" style={{ color: "#8890aa" }}>
                      <span style={{ display: "flex", alignItems: "center" }}>
                        <span className="pill" style={{
                          background: d <= 50 ? "#0d2d1a" : "#1a1504",
                          color: d <= 50 ? "#00e5a0" : "#ffd166",
                          border: `1px solid ${d <= 50 ? "#00e5a033" : "#ffd16633"}`,
                        }}>₪{d}</span>
                        {result.billsInRegister[d]} שטרות
                      </span>
                      <span style={{ fontWeight: 600, color: "#c0c8e0" }}>{fmt(result.billsInRegister[d] * d)}</span>
                    </div>
                  ) : null
                )}

                {result.type === "exact_remove" && (
                  <div className="notice" style={{ background: "#0d1a11", border: "1px solid #00e5a020", color: "#00b37d" }}>
                    💡 יש להוציא {fmt(result.coinsRemoved)} מהמטבעות כדי להגיע בדיוק ל-₪1,000
                  </div>
                )}

                {result.gap > 0 && (
                  <div className="notice" style={{ background: "#1a140a", border: "1px solid #ffd16630", color: "#ffd166" }}>
                    ⚠️ חסר {fmt(result.gap)} ל-₪1,000 — אין שטרות מתאימים להשלמה
                  </div>
                )}
              </div>
            </div>

            {/* Envelope card */}
            <div className="card" style={{ borderColor: "#181b28" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: envelopeTotal > 0 ? 16 : 0 }}>
                <div>
                  <div className="section-title" style={{ marginBottom: 6 }}>במעטפה</div>
                  <div style={{
                    fontSize: 22, fontWeight: 700,
                    color: envelopeTotal > 0 ? "#8890aa" : "#2e3248",
                  }}>
                    {fmt(envelopeTotal)}
                  </div>
                </div>
              </div>

              {envelopeTotal > 0 && (
                <div style={{ borderTop: "1px solid #181b28", paddingTop: 12 }}>
                  {(result.type === "coins_over" || result.type === "exact_remove") && result.coinsRemoved > 0 && (
                    <div className="row" style={{ color: "#4a5070" }}>
                      <span>מטבעות להוצאה</span>
                      <span style={{ fontWeight: 600, color: "#606880" }}>{fmt(result.coinsRemoved)}</span>
                    </div>
                  )}

                  {BILL_DENOMS.map(d =>
                    result.billsInEnvelope[d] > 0 ? (
                      <div key={d} className="row" style={{ color: "#4a5070" }}>
                        <span style={{ display: "flex", alignItems: "center" }}>
                          <span className="pill" style={{ background: "#1a1504", color: "#ffd16660", border: "1px solid #ffd16620" }}>₪{d}</span>
                          {result.billsInEnvelope[d]} שטרות
                        </span>
                        <span style={{ fontWeight: 600, color: "#606880" }}>{fmt(result.billsInEnvelope[d] * d)}</span>
                      </div>
                    ) : null
                  )}
                </div>
              )}

              {envelopeTotal === 0 && (
                <div style={{ color: "#2e3248", fontSize: 13 }}>המעטפה ריקה — הכל בקופה</div>
              )}
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
