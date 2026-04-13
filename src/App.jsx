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
  if (coinsTotal >= TARGET) {
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
    <div style={{ display: "flex", background: "#0f1117", border: "1px solid #2a2d3a", borderRadius: 6, overflow: "hidden" }}>
      {["number", "sum"].map(m => (
        <button
          key={m}
          onClick={() => onChange(m)}
          style={{
            padding: "4px 11px",
            border: "none",
            background: mode === m ? "#00e5a0" : "transparent",
            color: mode === m ? "#0f1117" : "#666",
            fontFamily: "inherit",
            fontSize: 11,
            cursor: "pointer",
            fontWeight: mode === m ? 700 : 400,
            transition: "all .15s",
          }}
        >
          {m === "number" ? "מספר" : "סכום"}
        </button>
      ))}
    </div>
  );

  return (
    <div dir="rtl" style={{ minHeight: "100vh", background: "#0f1117", color: "#e8e8e8", fontFamily: "'Courier New', 'Consolas', monospace", padding: "24px 16px 64px" }}>
      <style>{`
        @keyframes fadeIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:none; } }
        .card { background:#1a1d27; border:1px solid #2a2d3a; border-radius:12px; padding:20px; }
        .inp { background:#0f1117; border:1px solid #2a2d3a; border-radius:8px; color:#e8e8e8; padding:10px 12px; font-family:inherit; font-size:15px; width:100%; box-sizing:border-box; outline:none; transition:border-color .2s; }
        .inp:focus { border-color:#00e5a0; }
        .inp.err { border-color:#ff6b35; }
        .inp::placeholder { color:#444; }
        .err-msg { color:#ff9a6c; font-size:12px; margin-top:4px; }
        .btn { width:100%; padding:14px; border:none; border-radius:10px; background:linear-gradient(135deg,#00e5a0,#00b37d); color:#0f1117; font-size:16px; font-family:inherit; font-weight:700; cursor:pointer; letter-spacing:.5px; transition:filter .15s, transform .1s; }
        .btn:hover { filter:brightness(1.1); }
        .btn:active { transform:scale(.98); }
        .btn-report { width:100%; padding:12px; border:1px solid #2a2d3a; border-radius:10px; background:#1a1d27; color:#888; font-size:14px; font-family:inherit; font-weight:600; cursor:pointer; transition:all .15s; margin-top:10px; }
        .btn-report:hover { border-color:#00e5a0; color:#00e5a0; background:#0d1f18; }
        .btn-report:active { transform:scale(.98); }
        .pill { display:inline-block; border-radius:6px; padding:2px 8px; font-size:13px; font-weight:700; margin-left:6px; }
        .result-card { animation: fadeIn .3s ease; }
        .row { display:flex; justify-content:space-between; align-items:center; padding:7px 0; border-bottom:1px solid #1e2030; font-size:14px; }
        .notice { border-radius:8px; padding:10px 12px; font-size:13px; margin-top:10px; }
        .sw-track { width:36px; height:20px; background:#2a2d3a; border-radius:10px; position:relative; cursor:pointer; border:none; flex-shrink:0; transition:background .2s; }
        .sw-track.on { background:#00e5a0; }
        .sw-track::after { content:''; position:absolute; width:14px; height:14px; background:white; border-radius:50%; top:3px; right:3px; transition:right .2s; }
        .sw-track.on::after { right:19px; }
      `}</style>

      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <div style={{ fontSize: 28, marginBottom: 4 }}>🏧</div>
        <h1 style={{ margin: 0, fontSize: 22, letterSpacing: 1, color: "#00e5a0" }}>ספירת קופה</h1>
        <p style={{ margin: "6px 0 0", color: "#555", fontSize: 13 }}>יעד: ₪1,000 בקופה</p>
      </div>

      {/* Coins card */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <span style={{ fontSize: 13, color: "#888" }}>מטבעות</span>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {!simpleCoins && <ModeToggle mode={coinMode} onChange={handleCoinModeChange} />}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <button
                className={`sw-track${simpleCoins ? " on" : ""}`}
                onClick={() => { setSimpleCoins(s => !s); setErrors({}); setResult(null); }}
              />
              <span style={{ fontSize: 11, color: "#666" }}>פשוט</span>
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
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
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
                  <label style={{ fontSize: 12, color: "#666", display: "block", marginBottom: 4 }}>
                    {COIN_LABELS[k]}
                  </label>
                  <div style={{ display: "flex", gap: 4 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 10, color: "#555", marginBottom: 2 }}>כמות</div>
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
                        style={coinMode !== "number" ? { opacity: 0.4, cursor: "default" } : {}}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 10, color: "#555", marginBottom: 2 }}>סכום (₪)</div>
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
                        style={coinMode !== "sum" ? { opacity: 0.4, cursor: "default" } : {}}
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
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <span style={{ fontSize: 13, color: "#888" }}>שטרות</span>
          <ModeToggle mode={billMode} onChange={handleBillModeChange} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
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
                <label style={{ fontSize: 12, color: "#666", display: "block", marginBottom: 4 }}>
                  ₪{d}
                </label>
                <div style={{ display: "flex", gap: 4 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 10, color: "#555", marginBottom: 2 }}>כמות</div>
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
                      style={billMode !== "number" ? { opacity: 0.4, cursor: "default" } : {}}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 10, color: "#555", marginBottom: 2 }}>סכום (₪)</div>
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
                      style={billMode !== "sum" ? { opacity: 0.4, cursor: "default" } : {}}
                    />
                  </div>
                </div>
                {errors[`bill_${d}`] && <div className="err-msg">{errors[`bill_${d}`]}</div>}
              </div>
            );
          })}
        </div>
        {totalInventory > 0 && (
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid #2a2d3a", fontSize: 13, color: "#888", display: "flex", justifyContent: "space-between" }}>
            <span>סה"כ מלאי:</span>
            <span style={{ color: "#ccc" }}>{fmt(totalInventory)}</span>
          </div>
        )}
      </div>

      <button className="btn" onClick={handleCalc}>חשב חלוקה אופטימלית</button>
      <button
        className="btn-report"
        onClick={() => generateReport({ coinInputs, coinMode, simpleCoins, simpleCoinsInput, billInputs, billMode })}
      >
        📊 הפק דוח ספירה
      </button>

      {result && (
        <div ref={resultRef} className="result-card" style={{ marginTop: 24 }}>
          {/* Register */}
          <div className="card" style={{ borderColor: isExact ? "#00e5a0" : "#ffd166", marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <span style={{ fontWeight: 700, color: isExact ? "#00e5a0" : "#ffd166", fontSize: 15 }}>🏪 בקופה</span>
              <span style={{ fontSize: 22, fontWeight: 700, color: isExact ? "#00e5a0" : "#ffd166" }}>{fmt(result.totalInRegister)}</span>
            </div>

            <div className="row" style={{ color: "#ccc" }}>
              <span>מטבעות</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {result.coinsRemoved > 0 && result.type !== "coins_over" && (
                  <span style={{ color: "#ff9a6c", fontSize: 12 }}>הוצא {fmt(result.coinsRemoved)}</span>
                )}
                <span style={{ fontWeight: 600 }}>{fmt(result.coinsInRegister)}</span>
              </div>
            </div>

            {result.type === "coins_over" && (
              <div className="notice" style={{ background: "#2a1a0a", border: "1px solid #ff6b35", color: "#ff9a6c" }}>
                ⚠️ המטבעות עולים על ₪1,000 — יש להוציא כ-{fmt(result.coinsRemoved)} מטבעות.
              </div>
            )}

            {BILL_DENOMS.map(d =>
              result.billsInRegister[d] > 0 ? (
                <div key={d} className="row" style={{ color: "#ccc" }}>
                  <span>
                    <span className="pill" style={{ background: d <= 50 ? "#0d2d1a" : "#1a1504", color: d <= 50 ? "#00e5a0" : "#ffd166", border: `1px solid ${d <= 50 ? "#00e5a044" : "#ffd16644"}` }}>₪{d}</span>
                    {result.billsInRegister[d]} שטרות
                  </span>
                  <span style={{ fontWeight: 600 }}>{fmt(result.billsInRegister[d] * d)}</span>
                </div>
              ) : null
            )}

            {result.type === "exact_remove" && (
              <div className="notice" style={{ background: "#0d1f18", border: "1px solid #00e5a033", color: "#00b37d" }}>
                💡 יש להוציא {fmt(result.coinsRemoved)} מהמטבעות כדי להגיע בדיוק ל-₪1,000
              </div>
            )}

            {result.gap > 0 && (
              <div className="notice" style={{ background: "#1a160a", border: "1px solid #ffd166", color: "#ffd166" }}>
                ⚠️ חסר {fmt(result.gap)} ל-₪1,000 — אין שטרות מתאימים להשלמה
              </div>
            )}
          </div>

          {/* Envelope */}
          <div className="card" style={{ borderColor: "#3a2d1a" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: envelopeTotal > 0 ? 14 : 0 }}>
              <span style={{ fontWeight: 700, color: "#ffd166", fontSize: 15 }}>📬 במעטפה</span>
              <span style={{ fontSize: 15, color: "#888" }}>{fmt(envelopeTotal)}</span>
            </div>

            {(result.type === "coins_over" || result.type === "exact_remove") && result.coinsRemoved > 0 && (
              <div className="row" style={{ color: "#666" }}>
                <span>מטבעות להוצאה</span>
                <span style={{ fontWeight: 600, color: "#555" }}>{fmt(result.coinsRemoved)}</span>
              </div>
            )}

            {BILL_DENOMS.map(d =>
              result.billsInEnvelope[d] > 0 ? (
                <div key={d} className="row" style={{ color: "#666" }}>
                  <span>
                    <span className="pill" style={{ background: "#1a1504", color: "#ffd16688", border: "1px solid #ffd16622" }}>₪{d}</span>
                    {result.billsInEnvelope[d]} שטרות
                  </span>
                  <span style={{ fontWeight: 600, color: "#555" }}>{fmt(result.billsInEnvelope[d] * d)}</span>
                </div>
              ) : null
            )}

            {envelopeTotal === 0 && (
              <div style={{ color: "#444", fontSize: 13 }}>המעטפה ריקה — הכל בקופה</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
