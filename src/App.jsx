import { useState, useEffect } from "react";

// ═══════════════════════════════════════════════════════════════════
// INDIA RISK DASHBOARD — V19.0 — TAKSHASHILA DESIGN LANGUAGE (Aug 12 2026)
// Same content model, same data bindings, same daily-update workflow.
// V19.0 changes:
// 1. DESIGN LANGUAGE: rebuilt on the Takshashila specification — wine
//    #620d3c + marigold #f1a222 on paper, warm off-white #F7F5F2 bands,
//    Inter for words and Roboto Mono for metadata, every rule a 1px
//    hairline, zero border-radius, zero box-shadow, left-aligned
//    throughout. Hover fills, never lifts.
// 2. STRUCTURE: What Changed now leads the Overview band, followed by
//    the situation strip and the brief. One band, one scroll.
// 3. BRIEF: five points to four (the day/risk line was a restatement of
//    the masthead and the risk tile), which also closes the empty cell
//    in the two-column grid.
// 4. CHARTS: horizontal gridlines only, direct end-labelling instead of
//    floating value labels, mono axis labels, a source line under every
//    figure. No gradients, no glow.
// 5. EMOJI: stripped at render (noEmoji) so JSON copy written with flags
//    or warning signs still renders in house style without re-editing.
//
// Daily update remains JSON-only: _asOf, _updated, ticker, brief,
// whatChanged, exec, timeline entry, budget, shareLine.
// ═══════════════════════════════════════════════════════════════════

// ─── Takshashila tokens ───────────────────────────────────────────
// Flat hex throughout so opacity suffixes stay valid anywhere.
const T = {
  wine:"#620d3c", wineDark:"#4a0a2e", wineSoft:"#f5e6ec",
  gold:"#f1a222", goldSoft:"#fcf0d9",
  paper:"#FFFFFF", deep:"#F7F5F2",
  ink:"#171413", ink70:"#5d5b5a", ink50:"#8b8a89",
  ink20:"#dad9d9", ink10:"#ececec",
};

// Categorical + status, mapped onto the keys war-intel.json already uses
// (red / orange / amber / cyan / green / purple) so the JSON needs no edit.
const C = {
  wine:T.wine, gold:T.gold,
  red:"#a3282d",      // negative
  green:"#2f6b4a",    // positive
  amber:T.gold,       // caution — marigold does double duty
  cyan:"#2f6b6b",     // teal
  orange:"#a8703a",   // bronze
  purple:"#4a5a7a",   // slate
  sub:T.ink70, muted:T.ink50, text:T.ink, white:T.ink,
  card:T.paper, deep:T.deep, border:T.ink20,
};

const SANS = "Inter, -apple-system, BlinkMacSystemFont, system-ui, sans-serif";
const MONO = "'Roboto Mono', ui-monospace, SFMono-Regular, Menlo, monospace";
const HAIR = `1px solid ${T.ink20}`;
const NUM  = {fontVariantNumeric:"tabular-nums"};

// ─── Fallbacks ────────────────────────────────────────────────────
const TICKER_FB = [];
const RADAR_FB  = [];

// War start — single source of truth for day numbering.
const WAR_START = "2026-02-28";
const dayOf = (iso, start=WAR_START) =>
  Math.floor((Date.parse(iso+"T00:00:00Z") - Date.parse(start+"T00:00:00Z")) / 86400000) + 1;
const dayToDate = (d, start=WAR_START) => {
  const ms = Date.parse(start+"T00:00:00Z") + (d-1)*86400000;
  return new Date(ms).toLocaleDateString("en-US", {month:"short", day:"numeric", timeZone:"UTC"});
};

// Loose "Mon D" parser for free-text event dates ("Sep 27", "Sep 15-16") —
// used only to place a point on the map time-slider, not for display.
const MONTH_IDX = {Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11};
const parseWarDay = (s) => {
  const m = String(s||"").match(/([A-Z][a-z]{2})\s+(\d{1,2})/);
  if (!m || !(m[1] in MONTH_IDX)) return null;
  const iso = `2026-${String(MONTH_IDX[m[1]]+1).padStart(2,"0")}-${String(+m[2]).padStart(2,"0")}`;
  return dayOf(iso);
};

// Approximate coordinates for the fixed set of Indian cities war-intel.json
// tracks — not in the JSON since the city list itself rarely changes.
const CITY_LL = {
  "Delhi NCR":[28.61,77.21], "Mumbai":[19.08,72.88], "Ahmedabad":[23.03,72.58],
  "Jaipur":[26.91,75.79], "Kochi":[9.93,76.27], "Goa":[15.30,74.12],
  "Lucknow":[26.85,80.95], "Chennai":[13.08,80.27],
};

// State-level population (2026 est., millions, StatisticsTimes) and coastal
// exposure, for the state-population map layer. Coordinates are each
// state's capital/largest city, used as a single representative point.
// Not in war-intel.json: this is background reference data, not daily news.
const STATE_DATA = {
  "Uttar Pradesh":  {lat:26.85, lon:80.95, pop:243.5, coastal:false},
  "Bihar":          {lat:25.61, lon:85.14, pop:132.9, coastal:false},
  "Maharashtra":    {lat:19.08, lon:72.88, pop:129.3, coastal:true},
  "West Bengal":    {lat:22.57, lon:88.36, pop:100.5, coastal:true},
  "Madhya Pradesh": {lat:23.26, lon:77.41, pop:90.0,  coastal:false},
  "Rajasthan":      {lat:26.91, lon:75.79, pop:83.9,  coastal:false},
  "Tamil Nadu":     {lat:13.08, lon:80.27, pop:79.0,  coastal:true},
  "Gujarat":        {lat:23.03, lon:72.58, pop:74.3,  coastal:true},
  "Karnataka":      {lat:12.97, lon:77.59, pop:70.8,  coastal:true},
  "Andhra Pradesh": {lat:16.51, lon:80.62, pop:53.7,  coastal:true},
  "Telangana":      {lat:17.39, lon:78.49, pop:38.7,  coastal:false},
  "Kerala":         {lat:9.93,  lon:76.27, pop:36.2,  coastal:true},
  "Punjab":         {lat:30.73, lon:76.78, pop:31.4,  coastal:false},
  "Haryana":        {lat:28.46, lon:77.03, pop:31.4,  coastal:false},
  "Delhi NCT":      {lat:28.61, lon:77.21, pop:22.3,  coastal:false},
  "Goa":            {lat:15.30, lon:74.12, pop:1.6,   coastal:true},
};

// Rough centroid of Iran's five tracked nuclear sites — used only as a
// proxy origin for "closer to Iran" in the indicative state-risk score
// below, the same way the app already reasons about downwind exposure.
const IRAN_CENTER = [32.8, 51.1];

// Indicative composite: proximity to Iran (an analyst's stand-in for wind/
// missile exposure), coastal exposure (oil-shock/shipping channel) and
// population (people exposed, not hazard intensity). Computed client-side
// from the table above, not sourced per-state — labelled as such in the UI.
const deriveStateRisk = () => {
  const rows = Object.entries(STATE_DATA).map(([name,s]) => ({
    name, ...s,
    dist: Math.hypot(s.lat-IRAN_CENTER[0], s.lon-IRAN_CENTER[1]),
  }));
  const dists = rows.map(r=>r.dist), dMin=Math.min(...dists), dMax=Math.max(...dists);
  const pops = rows.map(r=>Math.sqrt(r.pop)), pMin=Math.min(...pops), pMax=Math.max(...pops);
  return rows.map(r => {
    const proximity = dMax>dMin ? 1-((r.dist-dMin)/(dMax-dMin)) : 0.5;
    const popScale = pMax>pMin ? (Math.sqrt(r.pop)-pMin)/(pMax-pMin) : 0.5;
    const coastalScale = r.coastal ? 1 : 0.35;
    const risk = Math.round(100 * (0.55*proximity + 0.30*coastalScale + 0.15*popScale));
    return {...r, risk};
  });
};

// Pre-war baselines — overridable via intel.preWar.
const PRE_FB = {brent:65, rupee:91.49, nifty:22124, lpg:853, petrol:94.72, diesel:87.62};

// Sentence clamp. Splits only at a terminator followed by whitespace and a
// capital or digit, and never after a known abbreviation. The V18 version
// used a single match() whose backtracking silently dropped the text either
// side of a decimal ("$2.44%" swallowed the clause before it); this walks
// the string instead, so nothing is lost.
const ABBR = /(?:^|\s)(?:Rs|Mr|Mrs|Ms|Dr|Prof|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec|St|Lt|Gen|Col|Capt|No|Fig|vs|approx|est|Cr|Lk|U\.S|U\.K|a\.m|p\.m)$/i;
const splitSentences = (s) => {
  const parts = [];
  const re = /[.!?]+(?=\s+["\u201c(]?[A-Z0-9\u20b9$])|[.!?]+\s*$/g;
  let start = 0, m;
  while ((m = re.exec(s)) !== null) {
    const before = s.slice(start, m.index);
    if (ABBR.test(before)) continue;           // Rs. 12,000 is not a full stop
    parts.push(s.slice(start, m.index + m[0].length).trim());
    start = m.index + m[0].length;
  }
  if (start < s.length) parts.push(s.slice(start).trim());
  return parts.filter(Boolean);
};
const clampSentences = (txt, n) => {
  const s = String(txt ?? "").trim();
  if (!s) return "";
  const parts = splitSentences(s);
  if (parts.length <= n) return s;
  return parts.slice(0, n).join(" ").trim() + " \u2026";
};

// The house style never uppercases a heading — uppercase belongs to mono
// labels only. Intel is often written in caps, so shouted strings are
// recased at render. It only fires on predominantly-uppercase input, so
// copy already written in sentence case passes through untouched.
const KEEP = new Set(["US","UK","UN","EU","UAE","IAEA","LPG","LNG","OMC","GDP","VIX","FII","FPI","RBI","IST","UTC","OPEC","CENTCOM","IRGC","NATO","BRICS","MEA","WPI","CPI","MPC","HEU","MH","IT","FMCG","BSE","NSE","SBI","HSBC","UBS","ORF","CSIS","IEA","EIA","MT","MV","AI","OK","GST","IMF","WTO","WHO","ONGC","IOC","BPCL","HPCL","GAIL","IDF","UNSC","JCPOA","NPT","SPR","VLCC","EEZ","PM","MoD","EAM","ISRO","DRDO","IAF","INS","NSG","GCC","KSA","IEA","OPEC+","QIA","NSA","LOC","MSC","P5"]);
const SMALL = new Set(["a","an","and","as","at","but","by","for","from","in","into","is","its","of","on","or","over","the","to","vs","with","within","after","before","than","that","this","was","were","are","not","no","up","down","off","out"]);
const deshout = (txt) => {
  const s = String(txt ?? "").trim();
  const letters = s.replace(/[^A-Za-z]/g, "");
  if (letters.length < 8) return s;
  const upperRatio = (s.match(/[A-Z]/g)||[]).length / letters.length;
  if (upperRatio < 0.8) return s;              // already sentence case
  return s.split(/(\s+)/).map((tok, i) => {
    if (/^\s+$/.test(tok) || !tok) return tok;
    const core = tok.replace(/^[^A-Za-z0-9₹$]+|[^A-Za-z0-9%]+$/g, "");
    if (!core || /[0-9₹$%]/.test(core)) return tok;          // figures, tickers
    if (KEEP.has(core.replace(/[^A-Za-z+]/g,"").toUpperCase())) return tok;   // acronyms
    // Unlisted acronyms are usually vowel-less (BSE, GST, FMCG). Ordinary
    // three-letter words (PUT, TWO, WAR) are not, so they get recased.
    if (core === core.toUpperCase() && core.length <= 5 && !/[AEIOU]/.test(core)) return tok;
    const lower = tok.toLowerCase();
    if (i > 0 && SMALL.has(core.toLowerCase())) return lower;
    return lower.replace(/[a-z\u00e0-\u00ff]/, c => c.toUpperCase());
  }).join("");
};

// The house style carries no emoji. Editors write JSON however they like;
// this strips pictographs at render so copy never has to be re-edited.
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/gu;
const noEmoji = s => typeof s === "string"
  ? s.replace(EMOJI, "").replace(/\s{2,}/g, " ").replace(/^[\s\u00b7—–-]+/, "").trim()
  : s;

// Coded enumeration — the house tic. 01, 02, 03 …
const code = i => String(i+1).padStart(2, "0");

// ─── Primitives ───────────────────────────────────────────────────
const Eyebrow = ({children, color=T.ink50, style}) => (
  <div style={{fontFamily:MONO, fontSize:11, letterSpacing:"0.14em",
    textTransform:"uppercase", color, ...style}}>{children}</div>
);

const Empty = ({label}) => (
  <div style={{border:HAIR, padding:"18px 16px", fontSize:13,
    color:T.ink50, fontFamily:MONO}}>
    {label} unavailable — data feed not loaded. Refresh to retry.
  </div>
);

const Chip = ({children, color=T.wine, filled=false}) => (
  <span style={{display:"inline-block", padding:"4px 10px",
    background:filled?color:"transparent", border:`1px solid ${filled?color:T.ink20}`,
    color:filled?"#fff":color, fontSize:10, fontFamily:MONO, letterSpacing:"0.1em",
    textTransform:"uppercase", whiteSpace:"nowrap"}}>{children}</span>
);

const Bar = ({value, max=100, color=T.wine, h=4}) => (
  <div style={{height:h, background:T.ink10, marginTop:5}}>
    <div style={{height:"100%", width:`${Math.min((value/max)*100,100)}%`,
      background:color, transition:"width 0.5s ease"}}/>
  </div>
);

// Section band. Bands are the whole page skeleton: stacked, hairline-closed.
const Band = ({id, deep, children, style}) => (
  <section id={id} className="band" style={{background:deep?T.deep:T.paper,
    scrollMarginTop:56, ...style}}>
    <div className="wrap">{children}</div>
  </section>
);

const Head = ({eyebrow, title, em, lede, right}) => (
  <div style={{marginBottom:24}}>
    {eyebrow && <Eyebrow style={{marginBottom:10}}>{eyebrow}</Eyebrow>}
    <div style={{display:"flex", alignItems:"baseline", justifyContent:"space-between",
      gap:24, flexWrap:"wrap"}}>
      <h2 className="h2" style={{margin:0, fontWeight:400, color:T.ink,
        letterSpacing:"-0.02em", lineHeight:1.1, textWrap:"balance"}}>
        {title}{em && <> <em style={{color:T.wine, fontStyle:"italic"}}>{em}</em></>}
      </h2>
      {right}
    </div>
    {lede && <p style={{margin:"12px 0 0", fontSize:15, lineHeight:1.55,
      color:T.ink70, maxWidth:760, textWrap:"pretty"}}>{lede}</p>}
  </div>
);

// Definition row — mono uppercase label left, Inter value right. The house
// pattern for metadata blocks.
const Def = ({label, children}) => (
  <div style={{display:"grid", gridTemplateColumns:"minmax(96px,140px) 1fr",
    gap:18, padding:"9px 0", borderBottom:HAIR, alignItems:"baseline"}}>
    <span style={{fontFamily:MONO, fontSize:10.5, letterSpacing:"0.08em",
      textTransform:"uppercase", color:T.ink50}}>{label}</span>
    <span style={{fontSize:14, lineHeight:1.6, color:T.ink70}}>{children}</span>
  </div>
);

// KPI cell for the gapless ruled grid. Long strings step down from the
// 30px figure to a 16px card title so the strip never breaks.
const Kpi = ({label, value, delta, deltaColor, sub, tone}) => {
  const v = deshout(noEmoji(value == null ? "—" : String(value)));
  const tier = v.length <= 14 ? "figure" : v.length <= 64 ? "title" : "prose";
  const font = tier==="figure" ? {fontSize:30, fontWeight:400, letterSpacing:"-0.02em", lineHeight:1.05}
             : tier==="title"  ? {fontSize:16, fontWeight:500, letterSpacing:"-0.005em", lineHeight:1.3}
             :                   {fontSize:14.5, fontWeight:400, lineHeight:1.55};
  return (
    <div style={{padding:"20px 22px", display:"flex", flexDirection:"column", gap:6}}>
      <Eyebrow style={{fontSize:10.5, letterSpacing:"0.12em"}}>{label}</Eyebrow>
      <div style={{...font, color:tier==="prose"?T.ink70:(tone||T.ink), textWrap:"pretty", ...NUM}}>
        {tier==="prose" ? clampSentences(v, 2) : v}</div>
      {delta && <div style={{fontFamily:MONO, fontSize:11, letterSpacing:"0.04em",
        color:deltaColor||T.ink50, ...NUM}}>{noEmoji(delta)}</div>}
      {sub && <div style={{fontSize:12.5, lineHeight:1.55, color:T.ink70,
        textWrap:"pretty"}}>{deshout(noEmoji(sub))}</div>}
    </div>
  );
};

// ─── Line chart ───────────────────────────────────────────────────
// Horizontal gridlines only, mono axis labels, series labelled at the
// right-hand end rather than by legend.
const MiniLine = ({data, dataKey, color, h=300, unit=""}) => {
  const [hover, setHover] = useState(null);
  const filtered = data.filter(d => typeof d[dataKey] === "number");
  if (!filtered.length) return null;
  const vals = filtered.map(d => d[dataKey]);
  const mn = Math.min(...vals), mx = Math.max(...vals), rng = mx - mn || 1;
  const W = 1100, pad = {l:56, r:96, t:18, b:34};
  const iw = W - pad.l - pad.r, ih = h - pad.t - pad.b;
  const pts = filtered.map((d, i) => ({
    x: pad.l + (i / Math.max(filtered.length - 1, 1)) * iw,
    y: pad.t + (1 - (d[dataKey] - mn) / rng) * ih,
    v: d[dataKey], l: d.l || d.w || "",
  }));
  const line = pts.map((p, i) => `${i===0?"M":"L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const last = pts[pts.length-1];
  const fmt = v => v > 9999 ? (v/1000).toFixed(1)+"k"
    : v < 1000 && !Number.isInteger(v) ? v.toFixed(2)
    : Math.round(v).toLocaleString("en-IN");
  // Show at most seven x labels, first and last always, and drop any that
  // would collide with the one before it.
  const want = Math.min(7, pts.length);
  const idx = [];
  for (let k=0; k<want; k++) idx.push(Math.round(k*(pts.length-1)/(want-1||1)));
  const ticks = [...new Set(idx)].filter((v,i,a) => i===0 || pts[v].x - pts[a[i-1]].x > 110);
  const nearestIdx = px => {
    let best = 0, bd = Infinity;
    pts.forEach((p,i) => { const d = Math.abs(p.x-px); if (d<bd) { bd=d; best=i; } });
    return best;
  };
  const onMove = e => {
    const svg = e.currentTarget.ownerSVGElement || e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const px = ((clientX - rect.left) / rect.width) * W;
    setHover(nearestIdx(px));
  };
  const hp = hover!=null ? pts[hover] : null;
  return (
    <svg viewBox={`0 0 ${W} ${h}`} style={{width:"100%", height:"auto", display:"block", overflow:"visible"}}>
      {[0,25,50,75,100].map(pct => {
        const y = pad.t + (pct/100) * ih;
        return (
          <g key={pct}>
            <line x1={pad.l} y1={y} x2={pad.l+iw} y2={y} stroke={T.ink10} strokeWidth="1.5"/>
            <text x={pad.l-12} y={y+4} fill={T.ink50} fontSize="12" textAnchor="end" fontFamily={MONO}>
              {fmt(mx - (pct/100) * rng)}
            </text>
          </g>
        );
      })}
      <path d={line} fill="none" stroke={color} strokeWidth={color===T.gold?3.2:2.2}
        strokeLinecap="square" strokeLinejoin="miter"/>
      {ticks.map(i => (
        <text key={i} x={pts[i].x} y={h-8} fill={T.ink50} fontSize="12" textAnchor="middle" fontFamily={MONO}>
          {pts[i].l}
        </text>
      ))}
      <rect x={last.x-4} y={last.y-4} width="8" height="8" fill={color}/>
      <text x={last.x+14} y={last.y+5} fill={color} fontSize="15" fontFamily={MONO}
        fontWeight="500" style={NUM}>{unit}{fmt(last.v)}</text>

      {/* Hover/tap layer — invisible hit area plus a guide line and tooltip */}
      <rect x={pad.l} y={0} width={iw} height={h} fill="transparent"
        style={{cursor:"crosshair"}}
        onMouseMove={onMove} onMouseLeave={()=>setHover(null)}
        onTouchMove={onMove} onTouchEnd={()=>setHover(null)}/>
      {hp && (
        <g style={{pointerEvents:"none"}}>
          <line x1={hp.x} y1={pad.t} x2={hp.x} y2={pad.t+ih} stroke={T.ink50} strokeWidth="1" strokeDasharray="3 3"/>
          <circle cx={hp.x} cy={hp.y} r="5" fill={T.paper} stroke={color} strokeWidth="2.5"/>
          {(() => {
            const boxW = 108, boxX = Math.min(Math.max(hp.x-boxW/2, pad.l), pad.l+iw-boxW);
            const boxY = hp.y > h/2 ? hp.y-46 : hp.y+14;
            return (
              <g>
                <rect x={boxX} y={boxY} width={boxW} height={32} fill={T.ink} opacity="0.94"/>
                <text x={boxX+boxW/2} y={boxY+13} fill="#fff" fontSize="10.5" fontFamily={MONO}
                  textAnchor="middle" letterSpacing="0.04em">{hp.l}</text>
                <text x={boxX+boxW/2} y={boxY+26} fill="#fff" fontSize="13" fontFamily={MONO}
                  fontWeight="500" textAnchor="middle" style={NUM}>{unit}{fmt(hp.v)}</text>
              </g>
            );
          })()}
        </g>
      )}
    </svg>
  );
};

// Normalised multi-series comparison — % change since the first logged
// session for each series, direct-labelled at the line end rather than a
// legend. Used to show how correlated oil/equities/currency have been.
const CompareLines = ({data, series, h=220}) => {
  const base = {};
  series.forEach(s => {
    const first = data.find(d => typeof d[s.key]==="number" && d[s.key]);
    base[s.key] = first ? first[s.key] : null;
  });
  const W = 1100, pad = {l:38, r:112, t:16, b:28};
  const iw = W-pad.l-pad.r, ih = h-pad.t-pad.b;
  const lines = series.map(s => {
    const rows = data.filter(d=>typeof d[s.key]==="number");
    const pts = rows.map((d,i)=>({
      x: pad.l+(i/Math.max(rows.length-1,1))*iw,
      v: base[s.key] ? ((d[s.key]/base[s.key])-1)*100 : 0,
      l: d.l||"",
    }));
    return {...s, pts};
  }).filter(l=>l.pts.length>1);
  if (!lines.length) return null;
  const allV = lines.flatMap(l=>l.pts.map(p=>p.v));
  const mn = Math.min(0,...allV), mx = Math.max(0,...allV), rng = (mx-mn)||1;
  const y = v => pad.t + (1-(v-mn)/rng)*ih;
  const zeroY = y(0);
  return (
    <svg viewBox={`0 0 ${W} ${h}`} style={{width:"100%", height:"auto", display:"block", overflow:"visible"}}>
      <line x1={pad.l} y1={zeroY} x2={pad.l+iw} y2={zeroY} stroke={T.ink20} strokeWidth="1.5"/>
      <text x={pad.l-8} y={zeroY+4} fill={T.ink50} fontSize="11" fontFamily={MONO} textAnchor="end">0%</text>
      <text x={pad.l} y={h-6} fill={T.ink50} fontSize="11" fontFamily={MONO}>
        {lines[0].pts[0].l} {"→"} {lines[0].pts[lines[0].pts.length-1].l}
      </text>
      {lines.map((l,li)=>{
        const d = l.pts.map((p,i)=>`${i===0?"M":"L"}${p.x.toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
        const last = l.pts[l.pts.length-1];
        return (
          <g key={li}>
            <path d={d} fill="none" stroke={l.color} strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter"/>
            <rect x={l.pts[l.pts.length-1].x-3} y={y(last.v)-3} width="6" height="6" fill={l.color}/>
            <text x={pad.l+iw+10} y={y(last.v)+4} fill={l.color} fontSize="12.5" fontFamily={MONO}
              fontWeight="500">{l.label} {last.v>=0?"+":""}{last.v.toFixed(0)}%</text>
          </g>
        );
      })}
    </svg>
  );
};

const Figure = ({eyebrow, title, source, children}) => (
  <div style={{border:HAIR, padding:"22px 24px 18px", marginBottom:20, background:T.paper}}>
    <Eyebrow style={{marginBottom:6}}>{eyebrow}</Eyebrow>
    <div style={{fontSize:18, fontWeight:500, letterSpacing:"-0.005em",
      color:T.ink, marginBottom:16, textWrap:"balance"}}>{title}</div>
    {children}
    {source && <div style={{fontFamily:MONO, fontSize:10, letterSpacing:"0.06em",
      color:T.ink50, marginTop:14, paddingTop:10, borderTop:HAIR}}>{source}</div>}
  </div>
);

// ─── Risk radar ───────────────────────────────────────────────────
const RadarSVG = ({data, day, compact=false}) => {
  if (!data?.length) return null;
  const W=520, H = compact ? 300 : 380, cx=W/2, cy=H/2, r = compact ? 100 : 118, n=data.length;
  const ang = i => (Math.PI*2*i)/n - Math.PI/2;
  const pt = (i, v) => ({x: cx + Math.cos(ang(i)) * (v/100) * r, y: cy + Math.sin(ang(i)) * (v/100) * r});
  const poly = (key, col, dash, w) => (
    <polygon points={data.map((d,i)=>pt(i,d[key])).map(p=>`${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")}
      fill={`${col}1f`} stroke={col} strokeWidth={w} strokeDasharray={dash||"none"}/>
  );
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{width:"100%", height:"auto", overflow:"visible"}}>
      {[20,40,60,80,100].map(v => (
        <polygon key={v} points={data.map((_,i)=>pt(i,v)).map(p=>`${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")}
          fill="none" stroke={T.ink10} strokeWidth="1"/>
      ))}
      {data.map((_,i) => {
        const p = pt(i, 100);
        return <line key={i} x1={cx} y1={cy} x2={p.x.toFixed(1)} y2={p.y.toFixed(1)} stroke={T.ink10} strokeWidth="1"/>;
      })}
      {!compact && poly("w1", C.cyan, null, 1.4)}
      {!compact && poly("w4", C.orange, "4 3", 1.4)}
      {poly("now", T.wine, null, compact ? 1.6 : 2)}
      {data.map((d, i) => {
        const lp = pt(i, 128);
        return (
          <text key={i} x={lp.x.toFixed(1)} y={lp.y.toFixed(1)} fill={T.ink50}
            fontSize={compact ? 10.5 : 13} textAnchor="middle" dominantBaseline="middle"
            fontFamily={MONO} letterSpacing="0.04em">{compact ? d.axis.split(" ")[0] : d.axis}</text>
        );
      })}
    </svg>
  );
};

// ─── Household budget calculator ──────────────────────────────────
const BUDGET_FB = {petrolPre:94.72, petrolNow:103.54, dieselPre:87.62, dieselNow:90.03, lpgPre:853, lpgNow:912.5};
const BudgetCalc = ({budget}) => {
  const b = {...BUDGET_FB, ...(budget||{})};
  const [petrol, setPetrol] = useState(40);
  const [diesel, setDiesel] = useState(0);
  const [lpg,    setLpg]    = useState(1);
  const extra = petrol*(b.petrolNow-b.petrolPre) + diesel*(b.dieselNow-b.dieselPre) + lpg*(b.lpgNow-b.lpgPre);
  const fmt = n => "₹"+Math.round(n).toLocaleString("en-IN");
  const rows = [
    {label:"Petrol", unit:"litres", val:petrol, set:setPetrol, pre:b.petrolPre, now:b.petrolNow},
    {label:"Diesel", unit:"litres", val:diesel, set:setDiesel, pre:b.dieselPre, now:b.dieselNow},
    {label:"LPG cylinder (14.2kg)", unit:"cylinders", val:lpg, set:setLpg, pre:b.lpgPre, now:b.lpgNow},
  ];
  return (
    <div style={{border:HAIR, padding:"24px 26px", marginTop:20, background:T.paper}}>
      <Eyebrow style={{marginBottom:6}}>Calculator</Eyebrow>
      <div style={{fontSize:18, fontWeight:500, color:T.ink, marginBottom:6}}>Your monthly war cost</div>
      <p style={{margin:"0 0 14px", fontSize:14, color:T.ink70, lineHeight:1.55, maxWidth:620}}>
        Enter your household's monthly usage. The figure is the extra cost against
        pre-war (27 February) Delhi rates, not your total fuel bill.
      </p>
      {rows.map((r,i)=>(
        <div key={i} style={{display:"flex", alignItems:"center", gap:14, flexWrap:"wrap",
          padding:"12px 0", borderBottom:HAIR}}>
          <div style={{flex:"1 1 200px", minWidth:170}}>
            <div style={{fontSize:15, fontWeight:500, color:T.ink}}>{r.label}</div>
            <div style={{fontFamily:MONO, fontSize:10.5, color:T.ink50, letterSpacing:"0.06em", ...NUM}}>
              ₹{r.pre} → ₹{r.now} per {r.unit.replace(/s$/,"")}
            </div>
          </div>
          <label style={{display:"flex", alignItems:"center", gap:8}}>
            <span style={{fontFamily:MONO, fontSize:10.5, color:T.ink50,
              letterSpacing:"0.08em", textTransform:"uppercase"}}>{r.unit}/month</span>
            <input type="number" min="0" value={r.val} aria-label={`${r.label} ${r.unit} per month`}
              onChange={e=>r.set(Math.max(0, Number(e.target.value)||0))}
              style={{width:76, padding:"7px 9px", border:HAIR, background:T.paper,
                color:T.ink, fontSize:14, fontFamily:MONO, textAlign:"right", ...NUM}}/>
          </label>
          <div style={{fontFamily:MONO, fontSize:14, color:T.ink, minWidth:92,
            textAlign:"right", ...NUM}}>+{fmt(r.val*(r.now-r.pre))}</div>
        </div>
      ))}
      <div style={{display:"flex", justifyContent:"space-between", alignItems:"flex-end",
        flexWrap:"wrap", gap:20, marginTop:20}}>
        <div>
          <Eyebrow style={{marginBottom:4}}>Extra per month</Eyebrow>
          <div style={{fontSize:40, fontWeight:400, letterSpacing:"-0.02em", lineHeight:1,
            color:extra>0?C.red:C.green, ...NUM}}>{extra>0?"+":""}{fmt(extra)}</div>
        </div>
        <div style={{textAlign:"left"}}>
          <Eyebrow style={{marginBottom:4}}>Per year at these rates</Eyebrow>
          <div style={{fontFamily:MONO, fontSize:18, color:T.ink, ...NUM}}>
            {extra>0?"+":""}{fmt(extra*12)}</div>
        </div>
      </div>
    </div>
  );
};

// ─── War in numbers ───────────────────────────────────────────────
// Severity heat-strip — one tick per logged session, oldest to newest, so a
// reader can see when things got worse before reading a word of the log.
const SeverityStrip = ({timeline, onPick}) => {
  if (!timeline?.length) return null;
  const tl = [...timeline].sort((a,b)=>a.d-b.d);
  const col = sev => sev>=5 ? C.red : sev>=4 ? T.wine : sev>=3 ? C.orange : T.ink20;
  return (
    <div style={{marginBottom:20}}>
      <div style={{display:"flex", alignItems:"flex-end", gap:2, height:36}}>
        {tl.map((d,i)=>(
          <div key={i} role="button" tabIndex={0} title={`Day ${d.d} · ${d.l} · severity ${d.sev??"—"}/5`}
            onClick={()=>onPick?.(d.l)}
            onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();onPick?.(d.l);}}}
            style={{flex:"1 1 0", minWidth:2, cursor:onPick?"pointer":"default",
              height:`${10+((d.sev??1)/5)*26}px`, background:col(d.sev), alignSelf:"flex-end"}}/>
        ))}
      </div>
      <div style={{display:"flex", justifyContent:"space-between", marginTop:6,
        fontFamily:MONO, fontSize:10, letterSpacing:"0.06em", color:T.ink50, ...NUM}}>
        <span>DAY {tl[0].d} · {tl[0].l}</span>
        <span>SEVERITY, LOW → HIGH</span>
        <span>DAY {tl[tl.length-1].d} · {tl[tl.length-1].l}</span>
      </div>
    </div>
  );
};

const WarInNumbers = ({timeline}) => {
  if (!timeline?.length) return null;
  const tl = [...timeline].sort((a,b)=>a.d-b.d);
  const d1 = tl[0], today = tl[tl.length-1];
  const mid = tl.reduce((best,t)=>Math.abs(t.d-100)<Math.abs(best.d-100)?t:best, tl[0]);
  if (mid.d===d1.d || mid.d===today.d) return null;
  const pct = (a,b) => (a==null||b==null||!b) ? "—" : `${a>=b?"+":""}${Math.round((a/b-1)*100)}%`;
  const rows = [
    {m:"Brent, $/bbl", f:t=>t.brent!=null?"$"+t.brent:"—", chg:pct(today.brent,d1.brent)},
    {m:"Rupee per dollar", f:t=>t.rupee!=null?t.rupee.toFixed(2):"—", chg:pct(today.rupee,d1.rupee)},
    {m:"Nifty 50", f:t=>t.nifty!=null?Math.round(t.nifty).toLocaleString("en-IN"):"—", chg:pct(today.nifty,d1.nifty)},
    {m:"War dead", f:t=>t.deaths!=null?t.deaths.toLocaleString("en-IN"):"—", chg:pct(today.deaths,d1.deaths)},
  ];
  const cols = [d1, mid, today];
  const th = {fontFamily:MONO, fontSize:10.5, textTransform:"uppercase", letterSpacing:"0.08em",
    color:T.ink50, fontWeight:400, borderBottom:HAIR, padding:"10px 0"};
  return (
    <div style={{overflowX:"auto", marginBottom:24}}>
      <table style={{width:"100%", minWidth:460, borderCollapse:"collapse", ...NUM}}>
        <thead>
          <tr>
            <th style={{...th, textAlign:"left"}}>Metric</th>
            {cols.map((t,i)=>(
              <th key={i} style={{...th, textAlign:"right"}}>
                {i===2?`Today · D${t.d}`:`Day ${t.d}`}<br/>
                <span style={{letterSpacing:"0.04em"}}>{t.l}</span>
              </th>
            ))}
            <th style={{...th, textAlign:"right"}}>vs Day 1</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r,i)=>(
            <tr key={i}>
              <td style={{fontSize:14, borderBottom:HAIR, padding:"10px 0", color:T.ink}}>{r.m}</td>
              {cols.map((t,j)=>(
                <td key={j} style={{fontSize:14, borderBottom:HAIR, padding:"10px 0 10px 16px",
                  textAlign:"right", color:j===2?T.ink:T.ink70}}>{r.f(t)}</td>
              ))}
              <td style={{fontSize:14, borderBottom:HAIR, padding:"10px 0 10px 16px",
                textAlign:"right", color:T.wine}}>{r.chg}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// ─── Share card (canvas PNG) ──────────────────────────────────────
const wrapText = (ctx, text, x, y, maxW, lh, maxLines=3) => {
  const words = (text||"").split(/\s+/); let line="", lines=0;
  for (let i=0;i<words.length;i++){
    const test = line ? line+" "+words[i] : words[i];
    if (ctx.measureText(test).width > maxW && line){
      if (lines===maxLines-1){ ctx.fillText(line.replace(/.{3}$/,"")+"…", x, y); return y; }
      ctx.fillText(line, x, y); y+=lh; lines++; line=words[i];
    } else line = test;
  }
  if (line) ctx.fillText(line, x, y);
  return y;
};

const makeShareCard = ({day, level, brent, brentChg, nifty, rupee, lpg, rupeePre, lpgPre, headline, updated}) => {
  const cv = document.createElement("canvas");
  cv.width = 1080; cv.height = 1080;
  const x = cv.getContext("2d");
  x.fillStyle = T.paper; x.fillRect(0,0,1080,1080);
  // wine masthead
  x.fillStyle = T.wine; x.fillRect(0,0,1080,132);
  x.fillStyle = "#ffffff"; x.font = "400 26px 'Roboto Mono', monospace";
  x.fillText("WEST ASIA WAR — INDIA RISK TRACKER", 64, 64);
  x.fillStyle = "rgba(255,255,255,0.7)"; x.font = "400 21px 'Roboto Mono', monospace";
  x.fillText((updated||"").toUpperCase(), 64, 102);
  // day + risk
  x.fillStyle = T.ink; x.font = "400 132px Inter, sans-serif";
  x.fillText(`Day ${day}`, 64, 300);
  x.fillStyle = T.ink50; x.font = "400 22px 'Roboto Mono', monospace";
  x.fillText("RISK TO INDIA", 64, 350);
  x.fillStyle = T.wine; x.font = "400 60px Inter, sans-serif";
  x.fillText(String(level), 64, 412);
  x.strokeStyle = T.ink20; x.lineWidth = 2;
  x.beginPath(); x.moveTo(64,452); x.lineTo(1016,452); x.stroke();
  // metric grid — a ruled 2x2, hairlines only
  const cells = [
    ["OIL — BRENT", `$${brent}`, brentChg],
    ["NIFTY 50", nifty, ""],
    ["RUPEE / USD", `₹${rupee}`, rupeePre ? `was ₹${rupeePre} pre-war` : ""],
    ["LPG 14.2KG", lpg, lpgPre ? `was ₹${lpgPre} pre-war` : ""],
  ];
  cells.forEach((cel,i)=>{
    const cx = 64 + (i%2)*476, cy = 452 + Math.floor(i/2)*164;
    x.strokeStyle = T.ink20; x.lineWidth = 2;
    x.strokeRect(cx, cy, 476, 164);
    x.fillStyle = T.ink50; x.font = "400 20px 'Roboto Mono', monospace";
    x.fillText(cel[0], cx+28, cy+46);
    x.fillStyle = T.ink; x.font = "400 62px Inter, sans-serif";
    x.fillText(String(cel[1]), cx+28, cy+112);
    x.fillStyle = T.ink50; x.font = "400 18px 'Roboto Mono', monospace";
    x.fillText(String(cel[2]||""), cx+28, cy+142);
  });
  // headline
  x.fillStyle = T.ink; x.font = "400 34px Inter, sans-serif";
  wrapText(x, noEmoji(headline), 64, 880, 952, 46, 3);
  // footer
  x.fillStyle = T.wine; x.fillRect(0,1000,1080,80);
  x.fillStyle = T.gold; x.font = "400 22px 'Roboto Mono', monospace";
  x.fillText("NITHIYAGEO.GITHUB.IO/INDIA-RISK-DASHBOARD", 64, 1048);
  return cv;
};

const shareCard = (payload) => {
  const cv = makeShareCard(payload);
  cv.toBlob(async blob => {
    if (!blob) return;
    const file = new File([blob], `india-risk-day${payload.day}.png`, {type:"image/png"});
    if (navigator.canShare && navigator.canShare({files:[file]})) {
      try { await navigator.share({files:[file], title:`West Asia War — Day ${payload.day}`}); return; }
      catch(e){ /* cancelled → fall through to download */ }
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = file.name; a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href), 5000);
  }, "image/png");
};

// ─── Geospatial map ───────────────────────────────────────────────
// Static basemap (public/geo-base.json, Natural Earth via world-atlas) plus
// points from intel.geoint. Equirectangular, 20px/degree, 30E-80E / 3N-40N.
// No map library: one SVG, points positioned arithmetically.
const GEO_KIND = {
  chokepoint:{l:"Chokepoint", c:T.wine},
  incident:  {l:"Incident",   c:C.red},
  energy:    {l:"Energy",     c:C.orange},
  base:      {l:"Base",       c:C.purple},
  india:     {l:"India",      c:C.green},
  nuclear:   {l:"Nuclear",    c:T.ink},
};
const geoXY = p => [(p.lon-30)*20, (40-p.lat)*20];

// Illustrative Gulf-to-India tanker/cargo lanes, Hormuz to three major
// west-coast ports. Not tracked vessel data -- a schematic of the route,
// labelled as such, to show what the blockade actually threatens.
const SHIP_ROUTES = [
  {to:"Mundra",  from:[26.57,56.25], end:[22.84,69.72]},
  {to:"Mumbai",  from:[26.57,56.25], end:[19.08,72.88]},
  {to:"Kochi",   from:[26.57,56.25], end:[9.93,76.27]},
];

const GeoMap = ({geo, nukes, today}) => {
  const [base, setBase] = useState(null);
  const [kind, setKind] = useState("all");
  const [sel,  setSel]  = useState(null);
  const [showRoutes, setShowRoutes] = useState(false);
  useEffect(() => {
    fetch("./geo-base.json").then(r=>r.ok?r.json():null).then(setBase).catch(()=>{});
  }, []);
  const pts = [
    ...(geo?.points ?? []),
    ...(nukes ?? []).filter(n=>n.lat!=null && n.lon!=null)
      .map(n=>({n:noEmoji(n.name), t:"nuclear", lat:n.lat, lon:n.lon, d:"", i:noEmoji(n.status||"")})),
  ];

  // Time slider — points carrying a parseable "Mon D" date can be scrubbed
  // through; undated points (bases, refineries, nuclear sites) are treated
  // as persistent infrastructure and always shown.
  const dated = pts.map(p=>parseWarDay(p.d)).filter(d=>d!=null);
  const minDay = dated.length ? Math.min(...dated) : null;
  const maxDay = dated.length ? Math.max(...dated, today||0) : null;
  const [sliderDay, setSliderDay] = useState(null);
  const activeDay = sliderDay ?? maxDay;
  const hasSlider = minDay!=null && maxDay!=null && minDay < maxDay;

  const shown = pts.filter(p => {
    if (kind!=="all" && p.t!==kind) return false;
    if (!hasSlider) return true;
    const d = parseWarDay(p.d);
    return d==null || d<=activeDay;
  });
  const cur = sel!=null ? pts[sel] : null;
  return (
    <div>
      <div style={{display:"flex", gap:8, flexWrap:"wrap", marginBottom:14}}>
        {["all",...Object.keys(GEO_KIND)].map(k=>(
          <button key={k} onClick={()=>{setKind(k); setSel(null);}}
            style={{cursor:"pointer", background:kind===k?T.wine:"transparent",
              color:kind===k?"#fff":T.ink70, border:`1px solid ${kind===k?T.wine:T.ink20}`,
              padding:"4px 10px", fontFamily:MONO, fontSize:10, letterSpacing:"0.1em",
              textTransform:"uppercase"}}>
            {k==="all"?"All":GEO_KIND[k].l}
          </button>
        ))}
        <button onClick={()=>setShowRoutes(!showRoutes)} aria-pressed={showRoutes}
          style={{cursor:"pointer", background:showRoutes?T.ink:"transparent",
            color:showRoutes?"#fff":T.ink70, border:`1px solid ${showRoutes?T.ink:T.ink20}`,
            padding:"4px 10px", fontFamily:MONO, fontSize:10, letterSpacing:"0.1em",
            textTransform:"uppercase"}}>
          {showRoutes?"Hide":"Show"} shipping lanes
        </button>
      </div>
      <div style={{border:HAIR, background:"#fff"}}>
        <svg viewBox="0 0 1000 740" role="img" aria-label="Map of the Gulf, Red Sea and India with tracked incidents"
          style={{width:"100%", height:"auto", display:"block"}}>
          <rect width="1000" height="740" fill="#f4f7f9"/>
          {base && <path d={base.L} fill="#ebe7e0" stroke="none"/>}
          {base && <path d={base.B} fill="none" stroke={T.ink20} strokeWidth="0.6"/>}
          {showRoutes && SHIP_ROUTES.map((r,i) => {
            const [x1,y1] = geoXY({lat:r.from[0], lon:r.from[1]});
            const [x2,y2] = geoXY({lat:r.end[0],  lon:r.end[1]});
            const mx = (x1+x2)/2, my = (y1+y2)/2 + 45;
            return (
              <g key={i}>
                <path d={`M${x1},${y1} Q${mx},${my} ${x2},${y2}`} fill="none"
                  stroke={T.wine} strokeWidth="1" opacity="0.3"/>
                <path d={`M${x1},${y1} Q${mx},${my} ${x2},${y2}`} fill="none"
                  stroke={T.wine} strokeWidth="2" strokeLinecap="round" strokeDasharray="1 10" opacity="0.85">
                  <animate attributeName="stroke-dashoffset" from="0" to="-44" dur="2.2s" repeatCount="indefinite"/>
                </path>
              </g>
            );
          })}
          {shown.map(p=>{
            const i = pts.indexOf(p); const [x,y] = geoXY(p);
            const on = sel===i; const col = GEO_KIND[p.t]?.c || T.ink;
            const pDay = parseWarDay(p.d);
            const isLatest = hasSlider && pDay!=null && maxDay!=null && pDay===maxDay && activeDay===maxDay;
            return (
              <g key={i} onClick={()=>setSel(on?null:i)} style={{cursor:"pointer"}}>
                {isLatest && <circle cx={x} cy={y} r={11} fill="none" stroke={col} strokeWidth="1.5" opacity="0.55">
                  <animate attributeName="r" values="7;15;7" dur="2.4s" repeatCount="indefinite"/>
                  <animate attributeName="opacity" values="0.6;0;0.6" dur="2.4s" repeatCount="indefinite"/>
                </circle>}
                {/* Enlarged, invisible hit area — keeps the visible dot small
                    while still giving mobile touch a real target. */}
                <circle cx={x} cy={y} r={16} fill="transparent"/>
                <circle cx={x} cy={y} r={on?9:6} fill={col} stroke="#fff" strokeWidth="1.5"/>
                {(on || p.t==="chokepoint") && (
                  <text x={x+10} y={y+4} fontSize="12" fontFamily={MONO} fill={T.ink}
                    stroke="#fff" strokeWidth="3" paintOrder="stroke">{p.n}</text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {hasSlider && (
        <div style={{display:"flex", alignItems:"center", gap:14, margin:"14px 0 2px", flexWrap:"wrap"}}>
          <Eyebrow style={{whiteSpace:"nowrap"}}>Show as of</Eyebrow>
          <input type="range" min={minDay} max={maxDay} value={activeDay}
            aria-label="Show map as of a given day"
            onChange={e=>{setSliderDay(+e.target.value); setSel(null);}}
            style={{flex:"1 1 160px", minWidth:120, accentColor:T.wine}}/>
          <span style={{fontFamily:MONO, fontSize:11.5, letterSpacing:"0.04em", color:T.ink, minWidth:74, ...NUM}}>
            {dayToDate(activeDay)}{activeDay===maxDay ? " · today" : ""}
          </span>
          {activeDay!==maxDay && (
            <button className="btn-plain" onClick={()=>setSliderDay(null)}>Jump to today →</button>
          )}
        </div>
      )}

      <div style={{display:"flex", gap:16, flexWrap:"wrap", margin:"10px 0 4px",
        fontFamily:MONO, fontSize:10, letterSpacing:"0.08em", color:T.ink50, textTransform:"uppercase"}}>
        {Object.entries(GEO_KIND).map(([k,v])=>(
          <span key={k}><span style={{display:"inline-block", width:8, height:8, borderRadius:"50%",
            background:v.c, marginRight:6}}/>{v.l}</span>
        ))}
      </div>
      {showRoutes && (
        <div style={{fontFamily:MONO, fontSize:10, letterSpacing:"0.04em", color:T.ink50, margin:"0 0 14px"}}>
          Shipping lanes are schematic (Hormuz to Mundra, Mumbai and Kochi) — illustrative of the
          route the blockade threatens, not tracked vessel positions.
        </div>
      )}
      {cur && (
        <div style={{borderTop:`2px solid ${T.ink}`, marginBottom:18}}>
          <Def label={cur.n}>{cur.i}{cur.d ? ` (${cur.d})` : ""}</Def>
        </div>
      )}
      <div style={{fontFamily:MONO, fontSize:10, letterSpacing:"0.06em", color:T.ink50}}>
        {geo?._note}
      </div>
    </div>
  );
};

// ─── Hormuz timeline ──────────────────────────────────────────────
// Entries are written with a shouted "DAY 104-105 —" lead, which was all a
// one-sentence preview ever showed. The lead is stripped for the preview and
// the list opens at eight rows rather than fifty.
const stripDayLead = s => String(s||"")
  .replace(/^DAYS?\s+[\d\u2013\u2014-]+(?:\s+[A-Z][A-Za-z.]*)*\s*(?:[\u2014\u2013-]|\.)\s*/, "").trim();

// One combined, sorted bar chart for nuclear-site risk -- replaces five
// separate inline bars so the comparison happens in one place, not per row.
const NukeRiskBars = ({sites}) => {
  if (!sites?.length) return null;
  const sorted = [...sites].sort((a,b)=>(b.risk||0)-(a.risk||0));
  return (
    <div style={{marginBottom:24}}>
      {sorted.map((n,i)=>(
        <div key={i} style={{display:"grid", gridTemplateColumns:"128px 1fr 36px", gap:14,
          alignItems:"center", padding:"7px 0"}}>
          <span style={{fontSize:12.5, color:T.ink70, whiteSpace:"nowrap",
            overflow:"hidden", textOverflow:"ellipsis"}}>{noEmoji(n.name)}</span>
          <Bar value={n.risk} color={n.risk>85?C.red:T.wine} h={9}/>
          <span style={{fontFamily:MONO, fontSize:11.5, color:T.ink50,
            textAlign:"right", ...NUM}}>{n.risk}</span>
        </div>
      ))}
    </div>
  );
};

// City exposure as a small India inset -- reuses the same basemap and
// coordinate system as GeoMap, just cropped to India's bounding box.
const CityMap = ({cities}) => {
  const [base, setBase] = useState(null);
  const [layer, setLayer] = useState("cities");
  const [sel, setSel] = useState(null);
  useEffect(() => {
    fetch("./geo-base.json").then(r=>r.ok?r.json():null).then(setBase).catch(()=>{});
  }, []);
  const cityPts = (cities||[]).map(c => CITY_LL[c.city] ? {...c, lat:CITY_LL[c.city][0], lon:CITY_LL[c.city][1]} : null)
    .filter(Boolean);
  const statePts = deriveStateRisk();
  if (!cityPts.length) return null;
  const pts = layer==="cities" ? cityPts : statePts;
  const popMin = Math.sqrt(Math.min(...statePts.map(s=>s.pop)));
  const popMax = Math.sqrt(Math.max(...statePts.map(s=>s.pop)));
  const cur = sel!=null ? pts[sel] : null;
  // India is a tall, narrow shape -- cropped tight to the city spread rather
  // than reusing the wide Gulf-map bounds, which left most of the box empty.
  const x0=(68-30)*20, y0=(40-31)*20, x1=(84-30)*20, y1=(40-8)*20;
  const vw = x1-x0, vh = y1-y0;
  return (
    <div style={{marginBottom:20, maxWidth:460}}>
      <div style={{display:"flex", gap:8, marginBottom:10, flexWrap:"wrap", alignItems:"baseline"}}>
        {[["cities","Cities \u00b7 today's exposure"],["states","States \u00b7 population & risk"]].map(([k,l])=>(
          <button key={k} onClick={()=>{setLayer(k); setSel(null);}}
            style={{cursor:"pointer", background:layer===k?T.wine:"transparent",
              color:layer===k?"#fff":T.ink70, border:`1px solid ${layer===k?T.wine:T.ink20}`,
              padding:"4px 10px", fontFamily:MONO, fontSize:10, letterSpacing:"0.08em",
              textTransform:"uppercase"}}>{l}</button>
        ))}
        {layer==="states" && (
          <span style={{fontFamily:MONO, fontSize:10, letterSpacing:"0.04em", color:T.ink50}}>
            Tap a state for its name and figures
          </span>
        )}
      </div>
      <div style={{border:HAIR, background:"#fff"}}>
        <svg viewBox={`${x0} ${y0} ${vw} ${vh}`} role="img" aria-label="Map of Indian city and state exposure scores"
          style={{width:"100%", height:"auto", display:"block", aspectRatio:`${vw} / ${vh}`}}>
          <rect x={x0} y={y0} width={vw} height={vh} fill="#f4f7f9"/>
          {base && <path d={base.L} fill="#ebe7e0" stroke="none"/>}
          {base && <path d={base.B} fill="none" stroke={T.ink20} strokeWidth="0.6"/>}
          {pts.map((c,i)=>{
            const [x,y] = geoXY(c);
            const on = sel===i;
            const r = layer==="cities"
              ? 6 + (Math.min(c.tot,100)/100)*9
              : 5 + (popMax>popMin ? (Math.sqrt(c.pop)-popMin)/(popMax-popMin) : 0.5)*13;
            const risk = layer==="cities" ? c.tot : c.risk;
            const col = risk>55?C.red:risk>40?C.orange:T.wine;
            // States crowd together (Delhi/Haryana/Punjab especially), so
            // only label on select there; the 8 cities have room to spare.
            const showLabel = layer==="cities" || on;
            return (
              <g key={i} onClick={()=>setSel(on?null:i)} style={{cursor:"pointer"}}>
                <circle cx={x} cy={y} r={r} fill={col} opacity={on?0.92:0.62} stroke="#fff" strokeWidth="1.5"/>
                {showLabel && (
                  <text x={x} y={y-r-6} fontSize="11.5" fontFamily={MONO} fill={T.ink} textAnchor="middle"
                    stroke="#fff" strokeWidth="3" paintOrder="stroke">
                    {c.name||c.city}{" \u00b7 "}{layer==="cities" ? risk : `${c.pop}M`}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
      {layer==="states" && (
        <div style={{fontFamily:MONO, fontSize:10, letterSpacing:"0.04em", color:T.ink50, margin:"8px 0"}}>
          Bubble size = 2026 est. population. Colour = an indicative composite of proximity to
          Iran, coastal/shipping exposure and population, computed here rather than sourced \u2014
          not the tracker's editorial city scores above.
        </div>
      )}
      {cur && (
        <div style={{borderTop:`2px solid ${T.ink}`, marginTop:8}}>
          {layer==="cities"
            ? <Def label={cur.city}>{noEmoji(cur.info)}</Def>
            : <Def label={cur.name}>{`Pop. ${cur.pop}M \u00b7 ${cur.coastal?"coastal":"landlocked"} \u00b7 indicative risk ${cur.risk}/100`}</Def>}
        </div>
      )}
    </div>
  );
};

const HormuzTimeline = ({events, phaseData}) => {
  const [active, setActive] = useState(null);
  const [showAll, setShowAll] = useState(false);
  if (!events || !events.length) return null;
  const phases = phaseData?.length ? phaseData : [];
  const shown = showAll ? events : events.slice(0, 8);
  return (
    <div>
      {phases.length > 0 && (
        <div className="ruled c4" style={{marginBottom:20}}>
          {phases.map((p,i)=>(
            <div key={i} style={{padding:"12px 14px"}}>
              <div style={{fontFamily:MONO, fontSize:10, letterSpacing:"0.1em",
                color:T.wine, marginBottom:4}}>{code(i)} · {noEmoji(p.label)}</div>
              <div style={{fontFamily:MONO, fontSize:10.5, color:T.ink50, ...NUM}}>{p.days}</div>
            </div>
          ))}
        </div>
      )}
      <div style={{borderTop:`2px solid ${T.ink}`}}>
        {shown.map((e,i)=>(
          <div key={i} role="button" tabIndex={0} aria-expanded={active===i}
            className="rowlink"
            style={{display:"grid", gridTemplateColumns:"84px 1fr auto", gap:16,
              alignItems:"baseline", padding:"14px 8px", borderBottom:HAIR, cursor:"pointer"}}
            onClick={()=>setActive(active===i?null:i)}
            onKeyDown={ev=>{if(ev.key==="Enter"||ev.key===" "){ev.preventDefault();setActive(active===i?null:i);}}}>
            <span style={{fontFamily:MONO, fontSize:10.5, letterSpacing:"0.08em",
              textTransform:"uppercase", color:T.wine, ...NUM}}>{e.d}</span>
            <span style={{fontSize:14.5, lineHeight:1.6, color:active===i?T.ink:T.ink70, textWrap:"pretty"}}>
              {active===i ? noEmoji(e.e) : clampSentences(stripDayLead(noEmoji(e.e)), 2)}
            </span>
            <span style={{fontFamily:MONO, fontSize:10, letterSpacing:"0.08em", color:T.ink50}}>
              {active===i ? "CLOSE" : "OPEN"}
            </span>
          </div>
        ))}
      </div>
      {events.length > 8 && (
        <button className="btn-plain" style={{marginTop:16}} onClick={()=>setShowAll(!showAll)}>
          {showAll ? "Show recent only —" : `All ${events.length} entries →`}
        </button>
      )}
    </div>
  );
};

const NAV = [
  {id:"overview",  l:"Overview"},
  {id:"hormuz",    l:"Maritime"},
  {id:"kitchen",   l:"Household"},
  {id:"economic",  l:"Markets"},
  {id:"military",  l:"Military"},
  {id:"geoint",   l:"Geospatial"},
  {id:"nuclear",   l:"Nuclear"},
  {id:"radar",     l:"Risk Index"},
  {id:"warlog",    l:"Archive"},
  {id:"assessment",l:"Assessment"},
  {id:"sources",   l:"Sources"},
];

// ─── Main App ─────────────────────────────────────────────────────
export default function App() {
  const [expNuke,     setExpNuke]     = useState(null);
  const [activeNav,   setActiveNav]   = useState(null);
  const [live,        setLive]        = useState(null);
  const [intel,       setIntel]       = useState(null);
  const [logExpanded, setLogExpanded] = useState(false);
  const [logSearch,   setLogSearch]   = useState("");
  const [aboutOpen,   setAboutOpen]   = useState(false);
  const [wcExpanded,  setWcExpanded]  = useState({});
  const [milExpanded, setMilExpanded] = useState({});
  const [hzExpanded,  setHzExpanded]  = useState({});
  const [econExpanded,setEconExpanded]= useState(false);
  const [loadErr,     setLoadErr]     = useState(false);

  useEffect(() => {
    fetch("./market-data.json?t="+Date.now())
      .then(r=>r.ok?r.json():null).then(d=>d&&setLive(d)).catch(()=>setLoadErr(true));
    fetch("./war-intel.json?t="+Date.now())
      .then(r=>r.ok?r.json():null).then(d=>d?setIntel(d):setLoadErr(true))
      .catch(()=>setLoadErr(true));
  }, []);

  useEffect(() => {
    const els = NAV.map(n=>document.getElementById(n.id)).filter(Boolean);
    if (!els.length || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(entries => {
      const vis = entries.filter(e=>e.isIntersecting)
        .sort((a,b)=>a.boundingClientRect.top-b.boundingClientRect.top)[0];
      if (vis) setActiveNav(vis.target.id);
    }, {rootMargin:"-56px 0px -70% 0px", threshold:0});
    els.forEach(el=>io.observe(el));
    return () => io.disconnect();
  }, [intel]);

  const go = id => {
    setActiveNav(id);
    document.getElementById(id)?.scrollIntoView({behavior:"smooth", block:"start"});
  };

  const iT        = intel?.ticker        ?? TICKER_FB;
  const iDay      = intel?._asOf ? dayOf(intel._asOf, intel?._start ?? WAR_START)
                                 : (intel?._day ?? 0);
  const iUpdated  = intel?._updated      ?? "Loading…";
  const iDeaths   = intel?.deaths        ?? "—";
  const iWC       = intel?.whatChanged   ?? {label:"Loading intelligence…", items:[]};
  const iEcon     = intel?.econ          ?? null;
  const iRadar    = intel?.radar         ?? RADAR_FB;
  const iAssess   = intel?.assessment    ?? null;
  const iHLatest  = intel?.hormuzLatest  ?? [];
  const iKitchen  = intel?.kitchen       ?? [];
  const iMilitary = intel?.military      ?? [];
  const iNukes    = intel?.nukes         ?? [];
  const iCities   = intel?.cities        ?? [];
  const iHormuz   = intel?.hormuzStatus  ?? null;
  const iHEvents  = intel?.hormuzEvents  ?? iHLatest;
  const iPhase    = intel?._phase        ?? "BLOCKADE";
  const PRE       = {...PRE_FB, ...(intel?.preWar||{})};
  const iFeatured = intel?.featured      ?? [];
  const iOpeds    = intel?.opeds         ?? [];
  const iAuthor   = intel?.author        ?? null;
  const citedOn   = new Date().toLocaleDateString("en-GB",
    {day:"numeric", month:"long", year:"numeric"});
  const iMilTop   = intel?.milTop        ?? [];

  const iExec    = intel?.exec ?? {};
  const radarNow = k => (intel?.radar ?? []).find(r=>r.axis===k)?.now;
  const riskAvg  = (intel?.radar?.length)
    ? Math.round(intel.radar.reduce((s,r)=>s+(r.now||0),0)/intel.radar.length) : null;
  const derivedLevel = riskAvg==null ? null
    : riskAvg>=75 ? "SEVERE" : riskAvg>=60 ? "HIGH" : riskAvg>=45 ? "ELEVATED" : "MODERATE";
  const riskLevel = iExec.level ?? derivedLevel ?? "—";
  const riskColor = riskLevel==="SEVERE" ? C.red : riskLevel==="HIGH" ? C.orange
    : riskLevel==="ELEVATED" ? T.wine : C.green;

  const fullTL = [...(intel?.timeline ?? [])].sort((a,b)=>a.d-b.d);
  const prevTL  = fullTL.length>1 ? fullTL[fullTL.length-2] : null;
  const todayTL = fullTL.length   ? fullTL[fullTL.length-1] : null;

  const brentRaw  = live?.brent?.price     ?? 100;
  const brentChg  = live?.brent?.changePct ?? 0;
  const niftyRaw  = live?.nifty?.price     ?? 23719;
  const niftyChg  = live?.nifty?.change    ?? 0;
  const sensexRaw = live?.sensex?.price    ? Math.round(live.sensex.price) : 75415;
  const rupeeRaw  = live?.rupee?.price     ?? 95.50;
  const mktSource = live?._source ?? "Yahoo Finance";

  const isBlockade   = iPhase === "BLOCKADE";
  const isEscalation = iPhase === "ESCALATION";

  const lpgNow = intel?.budget?.lpgNow ?? 912.5;
  // Four points. The day-and-risk line was dropped in V19.0 — the masthead
  // carries the day and the situation strip carries the risk level.
  const iBrief = intel?.brief ?? [
    `Oil: Brent crude is around $${brentRaw} a barrel — about ${Math.round((brentRaw/PRE.brent-1)*100)}% higher than before the war. Most of India's imported oil passes through the Strait of Hormuz, which is currently disrupted.`,
    `Your money: the rupee is at ₹${typeof rupeeRaw==="number"?rupeeRaw.toFixed(2):rupeeRaw} per dollar (₹${PRE.rupee} pre-war), which makes imports costlier. Petrol has already been hiked; an LPG cylinder now costs ₹${lpgNow}.`,
    `Markets: the Nifty is at ${typeof niftyRaw==="number"?Math.round(niftyRaw).toLocaleString("en-IN"):niftyRaw}. Volatile, but not crashing.`,
    `Bottom line: there seem to be no shortages in India today, but fuel and kitchen costs are rising. Check the Household section for what that means for your budget.`,
  ];

  const sharePayload = {
    day: iDay, level: riskLevel,
    brent: brentRaw, brentChg: (brentChg>0?"+":"")+brentChg.toFixed(1)+"% today",
    nifty: typeof niftyRaw==="number"?Math.round(niftyRaw).toLocaleString("en-IN"):String(niftyRaw),
    rupee: typeof rupeeRaw==="number"?rupeeRaw.toFixed(2):String(rupeeRaw),
    lpg: "₹"+lpgNow, rupeePre: PRE.rupee, lpgPre: PRE.lpg,
    headline: intel?.shareLine ?? (iAssess?.headline||"").split(/\.\s/)[0].slice(0,160) ?? "",
    updated: iUpdated,
  };

  const asOfMs   = intel?._asOf ? Date.parse(intel._asOf+"T00:00:00+05:30") : null;
  const hoursOld = asOfMs ? (Date.now()-asOfMs)/3600000 : null;
  const isStale  = hoursOld != null && hoursOld > 36;
  const liveStamp = live?._updated || null;

  const filteredTL = logSearch.trim()
    ? [...fullTL].reverse().filter(d =>
        d.tag?.toLowerCase().includes(logSearch.toLowerCase()) ||
        d.l?.toLowerCase().includes(logSearch.toLowerCase()))
    : [...fullTL].reverse();

  const share = (platform) => {
    const url = "https://nithiyageo.github.io/india-risk-dashboard/";
    const txt = `West Asia War: India Risk Dashboard — Day ${iDay} | ${iUpdated}`;
    if (platform==="x")    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(txt)}&url=${encodeURIComponent(url)}`,"_blank");
    if (platform==="li")   window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,"_blank");
    if (platform==="wa")   window.open(`https://wa.me/?text=${encodeURIComponent(txt+"\n\n"+url)}`,"_blank");
    if (platform==="copy") navigator.clipboard?.writeText(url);
  };

  const sessionSource = `Source: ${mktSource}, synced every four hours; session closes logged daily in war-intel.json. ${fullTL.length} logged sessions, Day 1–${iDay}.`;

  return (
    <div style={{background:T.paper, color:T.ink, fontFamily:SANS, fontSize:15, lineHeight:1.5}}>
      <style>{`
        @keyframes ticker { 0%{transform:translateX(0)} 100%{transform:translateX(-50%)} }
        @keyframes fadein { from{opacity:0} to{opacity:1} }
        * { box-sizing:border-box; }
        body { background:${T.paper}; }
        a { color:${T.wine}; text-decoration:none; }
        a:hover { text-decoration:underline; }

        .wrap { max-width:1240px; margin:0 auto; padding:0 40px; }
        .band { padding:48px 0; border-bottom:${HAIR}; }
        @media(max-width:960px){ .wrap{ padding:0 24px; } }
        @media(max-width:560px){ .wrap{ padding:0 18px; } .band{ padding:32px 0; } }

        .h1 { font-size:40px; font-weight:400; letter-spacing:-0.022em; line-height:1.08;
              margin:0; text-wrap:balance; }
        .h2 { font-size:28px; }
        @media(max-width:960px){ .h1{ font-size:32px; } }
        @media(max-width:560px){ .h1{ font-size:26px; } .h2{ font-size:22px; } }

        /* Gapless ruled grid — hairlines drawn by the 1px gap showing through. */
        .ruled { display:grid; gap:1px; background:${T.ink20}; border:${HAIR}; }
        .ruled > * { background:${T.paper}; transition:background 0.15s ease; }
        .ruled.hoverable > *:hover { background:${T.deep}; }
        .c2 { grid-template-columns:repeat(2,1fr); }
        .c3 { grid-template-columns:repeat(3,1fr); }
        .c4 { grid-template-columns:repeat(4,1fr); }
        @media(max-width:960px){ .c3,.c4{ grid-template-columns:repeat(2,1fr); } }
        @media(max-width:560px){ .c2,.c3,.c4{ grid-template-columns:1fr; } }

        .split { display:grid; grid-template-columns:7fr 5fr; gap:48px; align-items:start; }
        @media(max-width:960px){ .split{ grid-template-columns:1fr; gap:28px; } }

        .overview-grid { display:grid; grid-template-columns:minmax(260px,380px) 1fr; gap:32px; align-items:start; }
        @media(max-width:720px){ .overview-grid{ grid-template-columns:1fr; gap:24px; } }

        .brief-grid { display:grid; grid-template-columns:1fr 1fr; column-gap:48px; }
        @media(max-width:720px){ .brief-grid{ grid-template-columns:1fr; } }

        .rowlink:hover { background:${T.deep}; }

        .btn { font-family:${MONO}; font-size:12px; letter-spacing:0.1em; text-transform:uppercase;
               padding:11px 22px; border:none; background:${T.wine}; color:#fff; cursor:pointer;
               transition:background 0.15s ease; }
        .btn:hover { background:${T.wineDark}; }
        .btn-ghost { font-family:${MONO}; font-size:11px; letter-spacing:0.1em; text-transform:uppercase;
               padding:8px 14px; border:${HAIR}; background:transparent; color:${T.ink};
               cursor:pointer; transition:background 0.15s ease; }
        .btn-ghost:hover { background:${T.deep}; }
        .btn-plain { font-family:${MONO}; font-size:11px; letter-spacing:0.1em; text-transform:uppercase;
               background:none; border:none; padding:0; color:${T.wine}; cursor:pointer; }
        .btn-plain:hover { text-decoration:underline; }

        .nav { position:sticky; top:0; z-index:100; background:${T.wine}; }
        .nav-inner { display:flex; gap:8px; overflow-x:auto; scrollbar-width:none; }
        .nav-inner::-webkit-scrollbar { display:none; }
        .nav a, .nav button { font-family:${SANS}; font-size:15px; font-weight:400;
               letter-spacing:0.3px; text-transform:none; color:rgba(255,255,255,0.9);
               background:none; border:none; cursor:pointer; white-space:nowrap;
               padding:18px 12px; border-bottom:2px solid transparent; }
        .nav button:hover { color:#fff; }
        .nav button[data-active="true"] { color:#fff; border-bottom-color:${T.gold}; }

        .mini-strip { display:none; position:sticky; top:54px; z-index:99; background:${T.paper};
               border-bottom:${HAIR}; }
        @media(max-width:720px){ .mini-strip{ display:block; } }
        .mini-strip .wrap::-webkit-scrollbar { display:none; }

        input[type=number], input[type=text] { border-radius:0; }
        input:focus-visible, button:focus-visible, a:focus-visible, [tabindex]:focus-visible {
          outline:2px solid ${T.wine}; outline-offset:2px; }
        .nav button:focus-visible { outline:2px solid ${T.gold}; outline-offset:-4px; }
        .skip-link { position:absolute; left:-9999px; top:0; z-index:200; }
        .skip-link:focus { left:8px; top:8px; background:${T.paper}; color:${T.ink};
          padding:10px 16px; border:${HAIR}; font-family:${MONO}; font-size:12px; }

        .ticker-wrap:hover .ticker-track, .ticker-wrap:focus-within .ticker-track { animation-play-state:paused; }
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after { animation-duration:0.001ms !important; animation-iteration-count:1 !important;
            transition-duration:0.001ms !important; scroll-behavior:auto !important; }
          .ticker-track { animation:none !important; transform:none !important; }
        }
        @media print {
          .nav, .mini-strip, .ticker-wrap, .btn, .btn-ghost, .btn-plain,
          input[type=range] { display:none !important; }
          body { background:#fff !important; }
          .band { break-inside:avoid; }
        }
      `}</style>

      <a href="#overview" className="skip-link">Skip to today's situation</a>

      {/* ══ TICKER — wine ground, mono ══ */}
      {iT.length > 0 && (
        <div className="ticker-wrap" aria-label="Latest headlines"
          style={{background:T.wine, padding:"9px 0", overflow:"hidden", width:"100%"}}>
          <div className="ticker-track" style={{display:"flex", width:"max-content", flexWrap:"nowrap",
            animation:"ticker 240s linear infinite", willChange:"transform"}}>
            {[...iT,...iT,...iT].map((t,i) => (
              <span key={i} style={{fontSize:12, color:"rgba(255,255,255,0.9)", fontFamily:MONO,
                letterSpacing:"0.04em", paddingRight:48, whiteSpace:"nowrap", flexShrink:0}}>
                {noEmoji(t)}<span style={{paddingLeft:48, color:"rgba(255,255,255,0.35)"}}>·</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ══ MASTHEAD ══ */}
      <header className="band" style={{paddingTop:40}}>
        <div className="wrap">
          <div style={{display:"flex", alignItems:"baseline", justifyContent:"space-between",
            gap:20, flexWrap:"wrap", marginBottom:24}}>
            <Eyebrow>Takshashila · India Risk Assessment</Eyebrow>
            <div style={{display:"flex", gap:8, flexWrap:"wrap"}}>
              {[{l:"X",p:"x"},{l:"LinkedIn",p:"li"},{l:"WhatsApp",p:"wa"},{l:"Copy Link",p:"copy"}].map((s,i)=>(
                <button key={i} className="btn-ghost" onClick={()=>share(s.p)}
                  aria-label={`Share on ${s.l}`}>{s.l}</button>
              ))}
            </div>
          </div>

          <div className="split" style={{gap:40}}>
            <div>
              <h1 className="h1">
                How the West Asia War Is Hitting <em style={{color:T.wine, fontStyle:"italic"}}>India</em>
              </h1>
              <p style={{margin:"16px 0 0", fontSize:20, fontWeight:300, lineHeight:1.45,
                color:T.ink70, maxWidth:640, textWrap:"pretty"}}>
                A daily reading of what the war does to India's oil, currency, markets,
                shipping lanes and kitchen budgets. Market data syncs every four hours;
                the war brief is written by hand from open sources.
              </p>
            </div>
            <div>
              <div style={{display:"flex", alignItems:"baseline", gap:14, flexWrap:"wrap", marginBottom:14}}>
                <span style={{background:T.gold, color:T.ink, fontFamily:MONO, fontSize:12,
                  fontWeight:600, letterSpacing:"0.1em", padding:"10px 16px", whiteSpace:"nowrap"}}>
                  DAY {iDay}
                </span>
                <button className="btn" onClick={()=>shareCard(sharePayload)}
                  title="Download today's summary as an image">Share today's card →</button>
                <button className="btn-ghost" onClick={()=>window.print()}
                  title="Print or save this page as a PDF">Print / Save PDF →</button>
              </div>
              <div style={{borderTop:HAIR}}>
                <Def label="Intel">{iUpdated}</Def>
                {liveStamp && <Def label="Markets">{liveStamp}</Def>}
                <Def label="Phase">{noEmoji(iExec.phase ?? iPhase)}</Def>
                {isStale && (
                  <Def label="Freshness">
                    <span style={{color:C.red}}>Brief is {Math.floor(hoursOld/24)} day(s) old.</span>
                  </Def>
                )}
              </div>
              {intel?._phaseBadge && (
                <div style={{borderLeft:`2px solid ${T.wine}`, paddingLeft:20, marginTop:20}}>
                  <div style={{fontSize:14, lineHeight:1.6, color:T.ink70, textWrap:"pretty"}}>
                    {deshout(noEmoji(intel._phaseBadge))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {loadErr && (
        <div role="alert" style={{background:T.wineSoft, borderBottom:HAIR, padding:"12px 0"}}>
          <div className="wrap" style={{fontFamily:MONO, fontSize:11.5, letterSpacing:"0.06em", color:C.red}}>
            LIVE DATA FEED UNREACHABLE — FIGURES BELOW MAY BE INCOMPLETE. REFRESH TO RETRY.
          </div>
        </div>
      )}

      {/* ══ NAV — Inter, Title Case, wine ground ══ */}
      <nav className="nav" aria-label="Sections">
        <div className="wrap">
          <div className="nav-inner">
            {NAV.map(n=>(
              <button key={n.id} onClick={()=>go(n.id)} data-active={activeNav===n.id}>{n.l}</button>
            ))}
          </div>
        </div>
      </nav>

      {/* Mobile-only mini strip — the situation at a glance, visible once the
          reader has scrolled past the full Overview KPI grid. */}
      {activeNav && activeNav!=="overview" && (
        <div className="mini-strip" role="status" aria-label="Current situation summary">
          <div className="wrap" style={{display:"flex", alignItems:"center", gap:16,
            padding:"8px 0", overflowX:"auto"}}>
            <span style={{fontFamily:MONO, fontSize:11, letterSpacing:"0.06em", color:T.wine,
              whiteSpace:"nowrap", ...NUM}}>DAY {iDay}</span>
            <span style={{fontFamily:MONO, fontSize:11, letterSpacing:"0.06em", color:riskColor,
              whiteSpace:"nowrap", ...NUM}}>{riskLevel}</span>
            <span style={{fontFamily:MONO, fontSize:11, letterSpacing:"0.06em", color:T.ink70,
              whiteSpace:"nowrap", ...NUM}}>BRENT ${brentRaw}</span>
            <span style={{fontFamily:MONO, fontSize:11, letterSpacing:"0.06em", color:T.ink70,
              whiteSpace:"nowrap", ...NUM}}>
              NIFTY {typeof niftyRaw==="number"?Math.round(niftyRaw).toLocaleString("en-IN"):niftyRaw}
            </span>
          </div>
        </div>
      )}

      {/* ══ OVERVIEW — what changed, then the strip, then the brief ══ */}
      <Band id="overview">
        <Head eyebrow={noEmoji(iWC.label || "What changed")} title="What changed" em="today"
          lede="The day's developments, newest first. Open an item for the reasoning behind it."/>

        {!(iWC.items||[]).length && <Empty label="Today's changes"/>}
        <div style={{borderTop:`2px solid ${T.ink}`, marginBottom:40}}>
          {(iWC.items||[]).map((item,i)=>{
            const isOpen = wcExpanded[i];
            return (
              <div key={i} style={{borderBottom:HAIR}}>
                <button className="rowlink" onClick={()=>setWcExpanded(p=>({...p,[i]:!p[i]}))}
                  aria-expanded={!!isOpen}
                  style={{width:"100%", textAlign:"left", background:"transparent", border:"none",
                    padding:"16px 8px", display:"grid", gridTemplateColumns:"40px 1fr auto",
                    gap:16, alignItems:"baseline", cursor:"pointer", fontFamily:SANS,
                    transition:"background 0.15s ease"}}>
                  <span style={{fontFamily:MONO, fontSize:11, letterSpacing:"0.08em", color:T.wine}}>
                    {code(i)}
                  </span>
                  <span style={{fontSize:16, fontWeight:500, lineHeight:1.35, color:T.ink,
                    letterSpacing:"-0.005em", textWrap:"balance"}}>
                    {deshout(noEmoji(item.bold))}
                  </span>
                  <span style={{fontFamily:MONO, fontSize:10, letterSpacing:"0.08em", color:T.ink50}}>
                    {isOpen?"CLOSE":"OPEN"}
                  </span>
                </button>
                {isOpen && item.text && (
                  <div style={{padding:"0 8px 18px 64px", fontSize:14.5, lineHeight:1.65,
                    color:T.ink70, animation:"fadein 0.2s ease both", textWrap:"pretty"}}>
                    {noEmoji(item.text)}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Situation strip */}
        <Eyebrow style={{marginBottom:12}}>The situation · Day {iDay}</Eyebrow>
        <div className="ruled c3 hoverable" style={{marginBottom:40}}>
          <Kpi label="Risk level" value={riskLevel} tone={riskColor}
            delta={`Composite ${riskAvg ?? "—"}/100`}
            sub={noEmoji(iExec.phase ?? iPhase) + (
              (iExec.level && derivedLevel && iExec.level !== derivedLevel)
                ? ` · the index itself reads ${derivedLevel}` : "")}/>
          <Kpi label="Oil — Brent" value={`$${brentRaw}`}
            delta={`${brentChg>0?"+":""}${brentChg.toFixed(1)}% today · $${PRE.brent} pre-war`}
            deltaColor={brentChg>0?C.red:C.green}
            sub={iExec.oilNote ?? "Pre-war, 40% of India's crude, 60% of its LNG and 90% of its LPG came through Hormuz — since diversified."}/>
          <Kpi label="Markets — Nifty 50"
            value={typeof niftyRaw==="number"?Math.round(niftyRaw).toLocaleString("en-IN"):niftyRaw}
            delta={`${niftyChg>=0?"+":""}${Math.round(niftyChg).toLocaleString("en-IN")} · Sensex ${sensexRaw.toLocaleString("en-IN")}`}
            deltaColor={niftyChg>=0?C.green:C.red}
            sub={`Auto-synced every four hours from ${mktSource}.`}/>
          <Kpi label="Shipping — Hormuz" value={iExec.shipping ?? "DISRUPTED"}
            sub={iExec.shippingSub ?? `Pre-war flow ${iHormuz?.preWarFlow||"about 90–140 ships a day"}; ${iHormuz?.indianSeafarers??"—"} Indian seafarers in the Gulf.`}/>
          <Kpi label="Military" value={iExec.military ?? `${radarNow("Mil. Exposure") ?? "—"}/100`}
            delta={`Exposure ${radarNow("Mil. Exposure") ?? "—"}/100 · war dead ${iDeaths}`}
            sub={iExec.militarySub}/>
          <Kpi label="India impact — rupee"
            value={`₹${typeof rupeeRaw==="number"?rupeeRaw.toFixed(2):rupeeRaw}`}
            delta={`per US dollar · ₹${PRE.rupee} pre-war`}
            sub={iExec.indiaSub ?? `Household pressure ${radarNow("Household") ?? "—"}/100.`}/>
        </div>

        {/* Risk index preview + since-last-update delta */}
        <div className="overview-grid" style={{marginBottom:40}}>
          <div>
            <div style={{display:"flex", justifyContent:"space-between", alignItems:"baseline",
              marginBottom:10}}>
              <Eyebrow>Risk index at a glance</Eyebrow>
              <button className="btn-plain" onClick={()=>go("radar")}>Full index →</button>
            </div>
            <div style={{border:HAIR, padding:"16px 16px 10px"}}>
              <RadarSVG data={iRadar} day={iDay} compact/>
            </div>
          </div>
          {prevTL && todayTL && (
            <div>
              <Eyebrow style={{marginBottom:10}}>
                {`Since ${prevTL.l} (Day ${prevTL.d})`}
              </Eyebrow>
              <div className="ruled c2" style={{border:HAIR}}>
                {[
                  {l:"Brent", now:todayTL.brent, was:prevTL.brent, fmt:v=>v!=null?`$${v}`:"—", invert:true},
                  {l:"Nifty 50", now:todayTL.nifty, was:prevTL.nifty, fmt:v=>v!=null?Math.round(v).toLocaleString("en-IN"):"—"},
                  {l:"Rupee/USD", now:todayTL.rupee, was:prevTL.rupee, fmt:v=>v!=null?`₹${v.toFixed(2)}`:"—", invert:true},
                  {l:"War dead", now:todayTL.deaths, was:prevTL.deaths, fmt:v=>v!=null?v.toLocaleString("en-IN"):"—", invert:true},
                ].map((r,i)=>{
                  const chg = (r.now!=null && r.was) ? (r.now-r.was) : null;
                  const pct = (r.now!=null && r.was) ? ((r.now/r.was-1)*100) : null;
                  const good = chg==null ? null : r.invert ? chg<=0 : chg>=0;
                  return (
                    <div key={i} style={{padding:"14px 16px"}}>
                      <Eyebrow style={{marginBottom:6}}>{r.l}</Eyebrow>
                      <div style={{fontSize:20, fontWeight:400, letterSpacing:"-0.01em",
                        color:T.ink, ...NUM}}>{r.fmt(r.now)}</div>
                      {pct!=null && (
                        <div style={{fontFamily:MONO, fontSize:11, color:good?C.green:C.red, ...NUM}}>
                          {chg>=0?"+":""}{pct.toFixed(1)}%
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* 60-second brief */}
        <div style={{borderTop:`2px solid ${T.ink}`, paddingTop:20}}>
          <div style={{display:"flex", justifyContent:"space-between", alignItems:"baseline",
            gap:20, flexWrap:"wrap", marginBottom:14}}>
            <Eyebrow>The 60-second brief</Eyebrow>
            <Eyebrow>Plain language</Eyebrow>
          </div>
          <div className="brief-grid">
            {iBrief.map((line,i)=>(
              <div key={i} style={{display:"grid", gridTemplateColumns:"32px 1fr", gap:12,
                padding:"12px 0", borderBottom:i>=iBrief.length-2?"none":HAIR, alignItems:"baseline"}}>
                <span style={{fontFamily:MONO, fontSize:11, letterSpacing:"0.08em", color:T.wine}}>{code(i)}</span>
                <span style={{fontSize:14.5, lineHeight:1.6, color:T.ink70, textWrap:"pretty"}}>{noEmoji(line)}</span>
              </div>
            ))}
          </div>
        </div>

        <button className="btn-plain" style={{marginTop:24}} onClick={()=>setAboutOpen(!aboutOpen)}
          aria-expanded={aboutOpen}>
          {aboutOpen ? "Hide —" : "What is this tracker? →"}
        </button>
        {aboutOpen && (
          <div style={{borderLeft:`2px solid ${T.wine}`, paddingLeft:24, marginTop:16,
            maxWidth:820, animation:"fadein 0.2s ease both"}}>
            <p style={{margin:0, fontSize:15, lineHeight:1.65, color:T.ink70, textWrap:"pretty"}}>
              This is India's war tracker rather than a global one. It follows what the
              Iran-Gulf war means for energy prices, food security, financial markets,
              nuclear exposure and Indian seafarers in the Gulf. Hormuz matters here
              because before the war roughly 40% of India's crude, 60% of its LNG and 90%
              of its LPG imports crossed that 39km chokepoint; emergency rerouting and a
              pivot toward Russian crude have since cut the exposure, though not removed it.
              Market data syncs automatically every four hours. War intelligence is compiled
              by hand from open sources and should be read as an assessment, not a record.
            </p>
          </div>
        )}
      </Band>

      {/* ══ MARITIME ══ */}
      <Band id="hormuz" deep>
        <Head eyebrow="Maritime" title="Hormuz, India's energy" em="lifeline"
          lede="A 39km chokepoint that carried 40% of India's crude, 60% of its LNG and 90% of its LPG before the war. What happens here still lands at the pump."/>

        <div className="ruled c2" style={{marginBottom:20, background:T.ink20}}>
          <div style={{padding:"20px 22px"}}>
            <Eyebrow style={{marginBottom:8}}>Status</Eyebrow>
            <div style={{fontSize:14.5, lineHeight:1.6, color:T.ink70, textWrap:"pretty"}}>
              {noEmoji(hzExpanded.status ? (iHormuz?.status || "Status pending.") : clampSentences(iHormuz?.status || "Status pending.", 2))}
            </div>
            {noEmoji(iHormuz?.status||"").length > noEmoji(clampSentences(iHormuz?.status||"", 2)).length && (
              <button className="btn-plain" style={{marginTop:8, fontSize:11}}
                aria-expanded={!!hzExpanded.status}
                onClick={()=>setHzExpanded(p=>({...p, status:!p.status}))}>
                {hzExpanded.status ? "Less —" : "More detail →"}
              </button>
            )}
          </div>
          <div style={{padding:"20px 22px"}}>
            <Eyebrow style={{marginBottom:8}}>Ship traffic</Eyebrow>
            <div style={{fontSize:16, fontWeight:500, color:T.ink, marginBottom:6}}>
              {deshout(noEmoji(hzExpanded.flow ? (iHormuz?.currentFlow || "Near-zero commercial transit") : clampSentences(iHormuz?.currentFlow || "Near-zero commercial transit", 1)))}
            </div>
            <div style={{fontFamily:MONO, fontSize:10.5, letterSpacing:"0.06em", color:T.ink50, ...NUM}}>
              PRE-WAR: {(iHormuz?.preWarFlow || "~90–140 SHIPS/DAY").toUpperCase()}
            </div>
            {noEmoji(iHormuz?.currentFlow||"").length > noEmoji(clampSentences(iHormuz?.currentFlow||"", 1)).length && (
              <button className="btn-plain" style={{marginTop:8, fontSize:11}}
                aria-expanded={!!hzExpanded.flow}
                onClick={()=>setHzExpanded(p=>({...p, flow:!p.flow}))}>
                {hzExpanded.flow ? "Less —" : "More detail →"}
              </button>
            )}
          </div>
        </div>

        {(iHormuz?.indianCasualties ?? 0) > 0 && (
          <div style={{borderLeft:`2px solid ${C.red}`, paddingLeft:24, marginBottom:20}}>
            <Eyebrow style={{marginBottom:6}}>India · blockade enforcement</Eyebrow>
            <div style={{display:"flex", alignItems:"baseline", gap:14, marginBottom:6}}>
              <span style={{fontSize:40, fontWeight:400, letterSpacing:"-0.02em", color:C.red, ...NUM}}>
                {iHormuz.indianCasualties}
              </span>
              <span style={{fontSize:15, color:T.ink}}>Indian sailors killed</span>
            </div>
            <div style={{fontSize:14, lineHeight:1.6, color:T.ink70}}>
              {noEmoji(hzExpanded.casualty ? (iHormuz?.indianCasualtyDetail || "Details pending.") : clampSentences(iHormuz?.indianCasualtyDetail || "Details pending.", 1))}
            </div>
            {noEmoji(iHormuz?.indianCasualtyDetail||"").length > noEmoji(clampSentences(iHormuz?.indianCasualtyDetail||"", 1)).length && (
              <button className="btn-plain" style={{marginTop:8, fontSize:11}}
                aria-expanded={!!hzExpanded.casualty}
                onClick={()=>setHzExpanded(p=>({...p, casualty:!p.casualty}))}>
                {hzExpanded.casualty ? "Less —" : "Full detail →"}
              </button>
            )}
          </div>
        )}

        <Eyebrow style={{marginBottom:12}}>India's Hormuz exposure</Eyebrow>
        <div className="ruled c3" style={{marginBottom:24}}>
          {[
            {l:"Ships in Gulf", v:iHormuz?.indianVesselsNear ?? "—",
             sub:`${iHormuz?.indianSeafarers ?? "—"} seafarers on Indian-flagged vessels`},
            {l:"Crossed safely", v:iHormuz?.indianTransited ?? "—",
             sub:iHormuz?.totalShipsWaiting || "Status pending"},
            {l:"Navy escort", v:"Active", sub:"Operation Urja Suraksha"},
          ].map((s,i)=>(
            <div key={i} style={{padding:"20px 22px"}}>
              <Eyebrow style={{marginBottom:8}}>{s.l}</Eyebrow>
              <div style={{fontSize:30, fontWeight:400, letterSpacing:"-0.02em", lineHeight:1,
                color:T.ink, marginBottom:8, ...NUM}}>{s.v}</div>
              <div style={{fontSize:13, lineHeight:1.5, color:T.ink70}}>{clampSentences(noEmoji(s.sub), 2)}</div>
            </div>
          ))}
        </div>

        <Eyebrow style={{marginBottom:12}}>Timeline · latest first · select a row to expand</Eyebrow>
        <HormuzTimeline events={iHEvents.length ? iHEvents : iHLatest} phaseData={intel?.hormuzPhases}/>
        <div style={{borderTop:HAIR, marginTop:20}}>
          <Def label="Latest transit">{noEmoji(iHormuz?.lastTransit || "Status pending.")}</Def>
        </div>
      </Band>

      {/* ══ HOUSEHOLD ══ */}
      <Band id="kitchen">
        <Head eyebrow="Household" title="The kitchen" em="table"
          lede="What the war costs an Indian household today, item by item, against pre-war prices."/>
        {!iKitchen.length && <Empty label="Household price table"/>}
        {iKitchen.length > 0 && (
          <div style={{borderTop:`2px solid ${T.ink}`}}>
            {iKitchen.map((h,i)=>{
              const st = h.status||h.s;
              const sCol = st==="red" ? C.red : st==="orange" ? C.orange : C.green;
              return (
                <div key={i} style={{padding:"20px 0", borderBottom:HAIR}}>
                  <div style={{display:"flex", justifyContent:"space-between", alignItems:"baseline",
                    gap:20, flexWrap:"wrap", marginBottom:10}}>
                    <span style={{fontSize:18, fontWeight:500, letterSpacing:"-0.005em", color:T.ink}}>
                      {noEmoji(h.item)}
                    </span>
                    <span style={{fontFamily:MONO, fontSize:10.5, letterSpacing:"0.08em",
                      textTransform:"uppercase", color:sCol, textAlign:"right", maxWidth:520}}>
                      {noEmoji(h.statusText || h.chg || "")}
                    </span>
                  </div>
                  <div style={{display:"flex", gap:32, flexWrap:"wrap", marginBottom:10}}>
                    {[["Pre-war", h.pre], ["Now", h.now], ["Two weeks", h.twoWeek||h.proj]].map(([l,v],j)=>(
                      <div key={j} style={{minWidth:120}}>
                        <div style={{fontFamily:MONO, fontSize:10, letterSpacing:"0.08em",
                          textTransform:"uppercase", color:T.ink50, marginBottom:3}}>{l}</div>
                        <div style={{fontSize:14, color:j===1?T.ink:T.ink70, ...NUM}}>{noEmoji(v)}</div>
                      </div>
                    ))}
                  </div>
                  {(h.detail||h.note) && (
                    <div style={{fontSize:14, lineHeight:1.6, color:T.ink70, maxWidth:900, textWrap:"pretty"}}>
                      {noEmoji(h.detail||h.note)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <BudgetCalc budget={intel?.budget}/>
      </Band>

      {/* ══ MARKETS ══ */}
      <Band id="economic" deep>
        <Head eyebrow="Markets" title="Economic impact on" em="India"
          lede="Index levels, foreign flows and the two series that move the rest — crude and the rupee."/>

        <div className="ruled c4" style={{marginBottom:24}}>
          <Kpi label="BSE market cap" value={iEcon?.wealth||"—"}/>
          <Kpi label="FII flow" value={iEcon?.fpi||"—"} sub={iEcon?.fpiDelta||""}/>
          <Kpi label="Sensex" value={iEcon?.sensex||"—"} sub={clampSentences(iEcon?.sensexSub||"", 2)}/>
          <Kpi label="India VIX" value={iEcon?.vix||"—"} sub={iEcon?.vixDelta||"Volatility gauge"}/>
        </div>

        <Figure eyebrow="Equities" title="Nifty 50, logged session closes" source={sessionSource}>
          <MiniLine data={fullTL} dataKey="nifty" color={C.cyan} h={160}/>
        </Figure>

        <Figure eyebrow="Energy" title={`Brent crude, US$ per barrel — currently about $${brentRaw}`}
          source={sessionSource}>
          <MiniLine data={fullTL} dataKey="brent" color={T.wine} h={160} unit="$"/>
        </Figure>

        <Figure eyebrow="Correlation" title="Brent, Nifty and the rupee — % change since Day 1"
          source={sessionSource}>
          <CompareLines data={fullTL} h={200} series={[
            {key:"brent", label:"Brent", color:T.wine},
            {key:"nifty", label:"Nifty", color:C.cyan},
            {key:"rupee", label:"Rupee", color:C.orange},
          ]}/>
        </Figure>

        {iEcon?.analysis && (
          <div style={{borderLeft:`2px solid ${T.wine}`, paddingLeft:24}}>
            <Eyebrow style={{marginBottom:8}}>Market analysis</Eyebrow>
            <div style={{fontSize:15, lineHeight:1.65, color:T.ink70, maxWidth:900, textWrap:"pretty"}}>
              {noEmoji(econExpanded ? iEcon.analysis : clampSentences(iEcon.analysis, 2))}
            </div>
            {noEmoji(iEcon.analysis).length > noEmoji(clampSentences(iEcon.analysis, 2)).length && (
              <button className="btn-plain" style={{marginTop:8, fontSize:11}}
                aria-expanded={econExpanded}
                onClick={()=>setEconExpanded(!econExpanded)}>
                {econExpanded ? "Less —" : "More detail →"}
              </button>
            )}
          </div>
        )}
      </Band>

      {/* ══ MILITARY ══ */}
      <Band id="military">
        <Head eyebrow="Military" title="Military and strategic" em="updates"
          lede="Developments with a bearing on Indian shipping, energy routes or citizens in the region."/>
        {!iMilitary.length && !iMilTop.length && <Empty label="Military updates"/>}
        {(iMilitary.length || iMilTop.length) > 0 && (
          <div style={{borderTop:`2px solid ${T.ink}`}}>
            {(iMilitary.length ? iMilitary : iMilTop).map((m,i)=>{
              const mOpen = !!milExpanded[i];
              const full = noEmoji(m.d);
              const short = noEmoji(clampSentences(m.d, 2));
              const hasMore = full.length > short.length;
              return (
                <div key={i} style={{display:"grid", gridTemplateColumns:"40px 1fr", gap:16,
                  padding:"18px 0", borderBottom:HAIR, alignItems:"baseline"}}>
                  <span style={{fontFamily:MONO, fontSize:11, letterSpacing:"0.08em", color:T.wine}}>
                    {code(i)}
                  </span>
                  <div>
                    <div style={{display:"flex", justifyContent:"space-between", alignItems:"baseline",
                      gap:16, flexWrap:"wrap", marginBottom:8}}>
                      <span style={{fontSize:17, fontWeight:500, letterSpacing:"-0.005em",
                        lineHeight:1.3, color:T.ink, textWrap:"balance"}}>{deshout(noEmoji(m.t))}</span>
                      {m.lv && <Chip color={m.lv==="BREAKING"?C.red:T.ink50}>{m.lv}</Chip>}
                    </div>
                    <div style={{fontSize:14.5, lineHeight:1.6, color:T.ink70, maxWidth:900, textWrap:"pretty"}}>
                      {mOpen ? full : short}
                    </div>
                    {hasMore && (
                      <button className="btn-plain" style={{marginTop:8, fontSize:11}}
                        aria-expanded={mOpen}
                        onClick={()=>setMilExpanded(p=>({...p,[i]:!p[i]}))}>
                        {mOpen ? "Less —" : "More detail →"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Band>

      {/* ══ GEOSPATIAL ══ */}
      {intel?.geoint && (
        <Band id="geoint" deep>
          <Head eyebrow="Geospatial" title="Where it is" em="happening"
            lede="Chokepoints, incidents, energy nodes, bases and Indian exposure on one map. Select a point for detail."/>
          <GeoMap geo={intel.geoint} nukes={iNukes} today={iDay}/>
          <Eyebrow style={{margin:"28px 0 8px"}}>Free sources for verification</Eyebrow>
          <div style={{borderTop:`2px solid ${T.ink}`}}>
            {(intel.geoint.sources ?? []).map((s,i)=>(
              <Def key={i} label={s.n}>
                {s.use} <a href={s.u} target="_blank" rel="noopener noreferrer" style={{whiteSpace:"nowrap"}}>Open ↗</a>
              </Def>
            ))}
          </div>
        </Band>
      )}

      {/* ══ NUCLEAR ══ */}
      <Band id="nuclear">
        <Head eyebrow="Nuclear" title="Nuclear" em="exposure"
          lede="Iranian site status and India's downwind position. Scores here are analytical estimates, not measurements."/>

        <div style={{borderLeft:`2px solid ${T.wine}`, paddingLeft:24, marginBottom:28, maxWidth:900}}>
          <Eyebrow style={{marginBottom:8}}>India nuclear risk — headline</Eyebrow>
          <p style={{margin:0, fontSize:15, lineHeight:1.65, color:T.ink70, textWrap:"pretty"}}>
            Bushehr, a working reactor, has been struck: the IAEA reports strikes 250 feet
            from the operating unit. Iran holds roughly 460kg of 60% enriched uranium,
            material sufficient for approximately eleven weapons on the IAEA's own arithmetic.
            Delhi sits four to seven days downwind at 500 hPa, and India has no national
            iodine prophylaxis programme.
          </p>
        </div>

        <Eyebrow style={{marginBottom:10}}>Atmospheric transport — assessment</Eyebrow>
        <div style={{borderTop:HAIR, marginBottom:28, maxWidth:900}}>
          <Def label="Key insight">Prevailing westerlies at 500 hPa place north-west India four to seven days downwind of Iranian nuclear sites.</Def>
          <Def label="Watchlist">Bushehr reactor integrity; the Isfahan HEU tunnel complex; IAEA site access.</Def>
          <Def label="Confidence">Analytical estimate. No radiological release has been confirmed to date. Fallout modelling: <a href="https://www.ready.noaa.gov/HYSPLIT.php" target="_blank" rel="noopener noreferrer" style={{whiteSpace:"nowrap"}}>NOAA HYSPLIT ↗</a></Def>
        </div>

        <Eyebrow style={{marginBottom:12}}>Iranian nuclear sites — status</Eyebrow>
        {!iNukes.length && <Empty label="Nuclear site status"/>}
        {iNukes.length > 0 && <NukeRiskBars sites={iNukes}/>}
        {iNukes.length > 0 && (
          <div style={{borderTop:`2px solid ${T.ink}`, marginBottom:32}}>
            {iNukes.map((n,i)=>(
              <div key={i} role="button" tabIndex={0} aria-expanded={expNuke===i} className="rowlink"
                onClick={()=>setExpNuke(expNuke===i?null:i)}
                onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();setExpNuke(expNuke===i?null:i);}}}
                style={{padding:"16px 8px", borderBottom:HAIR, cursor:"pointer"}}>
                <div style={{display:"flex", justifyContent:"space-between", alignItems:"baseline",
                  gap:16, flexWrap:"wrap"}}>
                  <div>
                    <span style={{fontSize:17, fontWeight:500, color:T.ink}}>{noEmoji(n.name)}</span>
                    <span style={{fontFamily:MONO, fontSize:10.5, letterSpacing:"0.08em",
                      textTransform:"uppercase", color:T.ink50, marginLeft:12}}>{n.type}</span>
                  </div>
                  <Chip color={(n.status||"").match(/HIT|DAMAGED|STRUCK|WAR ZONE/)?C.red:T.wine}>
                    {noEmoji(n.status||n.st)}
                  </Chip>
                </div>
                <div style={{display:"flex", justifyContent:"space-between", marginTop:6,
                  fontFamily:MONO, fontSize:10, letterSpacing:"0.08em", color:T.ink50, ...NUM}}>
                  <span>{n.risk}/100 RISK</span>
                  <span>{expNuke===i?"CLOSE":"OPEN"}</span>
                </div>
                {expNuke===i && (
                  <div style={{fontSize:14.5, lineHeight:1.65, color:T.ink70, marginTop:12,
                    maxWidth:900, animation:"fadein 0.2s ease both", textWrap:"pretty"}}>
                    {noEmoji(n.info)}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {iCities.length > 0 && (
          <>
            <Eyebrow style={{marginBottom:8}}>Indian city exposure</Eyebrow>
            <p style={{margin:"0 0 16px", fontSize:14, color:T.ink70, maxWidth:760}}>
              A composite of wind trajectory (nuclear), sea proximity (oil shock) and distance
              to nuclear facilities. Weights are the tracker's own; treat the ranking as
              indicative rather than measured.
            </p>
            <CityMap cities={iCities}/>
            <div className="ruled c2">
              {iCities.map((c,i)=>(
                <div key={i} style={{padding:"20px 22px"}}>
                  <div style={{display:"flex", justifyContent:"space-between",
                    alignItems:"baseline", gap:12, marginBottom:12}}>
                    <div>
                      <span style={{fontSize:17, fontWeight:500, color:T.ink}}>{c.city}</span>
                      <span style={{fontFamily:MONO, fontSize:10.5, letterSpacing:"0.06em",
                        color:T.ink50, marginLeft:10, ...NUM}}>POP {c.pop}</span>
                    </div>
                    <div style={{...NUM}}>
                      <span style={{fontSize:30, fontWeight:400, letterSpacing:"-0.02em",
                        color:c.tot>55?C.red:T.wine}}>{c.tot}</span>
                      <span style={{fontFamily:MONO, fontSize:11, color:T.ink50}}>/100</span>
                    </div>
                  </div>
                  <div style={{display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12, marginBottom:12}}>
                    {[{l:"Wind",v:c.wind},{l:"Sea",v:c.sea},{l:"Nuclear",v:c.nuke}].map((vv,j)=>(
                      <div key={j}>
                        <div style={{fontFamily:MONO, fontSize:10, letterSpacing:"0.06em",
                          color:T.ink50, ...NUM}}>{vv.l.toUpperCase()} {vv.v}</div>
                        <Bar value={vv.v} color={T.wine} h={4}/>
                      </div>
                    ))}
                  </div>
                  <div style={{fontSize:13.5, lineHeight:1.6, color:T.ink70}}>{noEmoji(c.info)}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </Band>

      {/* ══ RISK INDEX ══ */}
      <Band id="radar" deep>
        <Head eyebrow="Risk index" title="Where the risk" em="sits"
          lede="Six axes scored 0–100. Week 1 is the war's opening reading, the outlook is a twelve-week extrapolation rather than a forecast."/>
        {!iRadar.length && <Empty label="Risk index"/>}
        {iRadar.length > 0 && (
          <div className="split">
            <div style={{border:HAIR, padding:"24px 24px 16px"}}>
              <RadarSVG data={iRadar} day={iDay}/>
              <div style={{display:"flex", gap:20, flexWrap:"wrap", marginTop:12,
                paddingTop:12, borderTop:HAIR}}>
                {[{l:"Week 1", c:C.cyan},{l:`Now · Day ${iDay}`, c:T.wine},{l:"Week 12 outlook", c:C.orange}].map((lg,i)=>(
                  <span key={i} style={{display:"flex", alignItems:"center", gap:7,
                    fontFamily:MONO, fontSize:10, letterSpacing:"0.08em",
                    textTransform:"uppercase", color:T.ink50}}>
                    <span style={{width:12, height:3, background:lg.c, display:"inline-block"}}/>
                    {lg.l}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <Eyebrow style={{marginBottom:10}}>Current scores</Eyebrow>
              <div style={{borderTop:HAIR}}>
                {iRadar.map((r,i)=>(
                  <div key={i} style={{display:"grid", gridTemplateColumns:"1fr 48px", gap:16,
                    alignItems:"center", padding:"12px 0", borderBottom:HAIR}}>
                    <div>
                      <div style={{fontSize:14, color:T.ink, marginBottom:2}}>{r.axis}</div>
                      <Bar value={r.now} color={r.now>70?C.red:T.wine} h={4}/>
                    </div>
                    <span style={{fontSize:20, fontWeight:400, textAlign:"right",
                      color:r.now>70?C.red:T.ink, ...NUM}}>{r.now}</span>
                  </div>
                ))}
              </div>
              <div style={{fontFamily:MONO, fontSize:10, letterSpacing:"0.06em",
                color:T.ink50, marginTop:12}}>
                SOURCE: TRACKER'S OWN SCORING, REVIEWED DAILY. ANALYTICAL ESTIMATE.
              </div>
            </div>
          </div>
        )}
      </Band>

      {/* ══ ARCHIVE ══ */}
      <Band id="warlog">
        <Head eyebrow="Archive" title="The war" em="log"
          lede="Every logged session since Day 1, newest first."/>
        <WarInNumbers timeline={intel?.timeline}/>
        <SeverityStrip timeline={intel?.timeline} onPick={l=>{setLogSearch(l); setLogExpanded(true);}}/>

        <div style={{display:"flex", justifyContent:"space-between", alignItems:"center",
          gap:16, flexWrap:"wrap", marginBottom:8}}>
          <button className="btn-ghost" onClick={()=>setLogExpanded(!logExpanded)}>
            {logExpanded?"Collapse archive":"Full archive →"}
          </button>
          <input placeholder="Search the war log" aria-label="Search the war log"
            value={logSearch} onChange={e=>setLogSearch(e.target.value)}
            style={{padding:"9px 12px", border:HAIR, background:T.paper, color:T.ink,
              fontSize:14, fontFamily:MONO, minWidth:180, flex:"0 1 260px"}}/>
        </div>

        <div style={{borderTop:`2px solid ${T.ink}`}}>
          {(logExpanded || logSearch ? filteredTL : filteredTL.slice(0,6)).map((d,i)=>(
            <div key={i} style={{display:"grid", gridTemplateColumns:"84px 1fr", gap:16,
              padding:"14px 0", borderBottom:HAIR, alignItems:"baseline"}}>
              <div>
                <div style={{fontFamily:MONO, fontSize:11, letterSpacing:"0.08em",
                  color:T.wine, ...NUM}}>D{d.d}</div>
                <div style={{fontFamily:MONO, fontSize:10.5, color:T.ink50, ...NUM}}>{d.l}</div>
              </div>
              <div>
                <div style={{fontSize:14, lineHeight:1.6, color:T.ink70, textWrap:"pretty"}}>
                  {noEmoji(clampSentences(d.tag, logExpanded?4:2))}
                </div>
                <div style={{display:"flex", gap:20, flexWrap:"wrap", marginTop:6,
                  fontFamily:MONO, fontSize:10.5, letterSpacing:"0.06em", color:T.ink50, ...NUM}}>
                  <span>NIFTY {d.nifty?.toLocaleString("en-IN") ?? "—"}</span>
                  <span>BRENT ${d.brent ?? "—"}</span>
                  <span>₹ {d.rupee?.toFixed(2) ?? "—"}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
        {!logExpanded && !logSearch && fullTL.length > 6 && (
          <div style={{fontFamily:MONO, fontSize:10.5, letterSpacing:"0.06em",
            color:T.ink50, marginTop:12}}>
            {fullTL.length - 6} MORE SESSIONS — OPEN THE FULL ARCHIVE OR SEARCH ABOVE
          </div>
        )}
      </Band>

      {/* ══ ASSESSMENT ══ */}
      <Band id="assessment" deep>
        <Head eyebrow="Assessment" title="Strategic" em="assessment"
          lede="The tracker's reading of where this is going, and what would change it."/>
        {!iAssess && <Empty label="Strategic assessment"/>}
        {iAssess && (
          <div style={{borderLeft:`2px solid ${T.wine}`, paddingLeft:28, maxWidth:900}}>
            {iAssess.headline && (
              <div style={{fontSize:22, fontWeight:400, letterSpacing:"-0.01em", lineHeight:1.35,
                color:T.ink, marginBottom:20, paddingBottom:18, borderBottom:HAIR, textWrap:"balance"}}>
                {deshout(noEmoji(iAssess.headline))}
              </div>
            )}
            <div style={{fontSize:15, lineHeight:1.7, color:T.ink70}}>
              {(iAssess.body||"").split("\n").map((p,i)=>{
                if (!p.trim()) return null;
                const isHead = /^[A-Z][A-Z\s\+\-\']+$/.test(p.trim()) && p.trim().length < 60;
                return isHead
                  ? <div key={i} style={{fontFamily:MONO, fontSize:11, letterSpacing:"0.14em",
                      textTransform:"uppercase", color:T.ink50, marginTop:24, marginBottom:8,
                      paddingTop:16, borderTop:HAIR}}>{noEmoji(p)}</div>
                  : <p key={i} style={{margin:"0 0 12px", textWrap:"pretty"}}>{noEmoji(p)}</p>;
              })}
            </div>
          </div>
        )}
      </Band>

      {/* ══ FEATURED RESEARCH ══ */}
      {iFeatured.length > 0 && (
        <Band>
          <Head eyebrow="Takshashila" title="Related" em="research"/>
          <div style={{borderTop:`2px solid ${T.ink}`}}>
            {iFeatured.map((pub,i)=>(
              <a key={i} href={pub.url} target="_blank" rel="noopener noreferrer" className="rowlink"
                style={{display:"grid", gridTemplateColumns:"40px 1fr auto", gap:16,
                  alignItems:"baseline", padding:"16px 8px", borderBottom:HAIR,
                  textDecoration:"none", transition:"background 0.15s ease"}}>
                <span style={{fontFamily:MONO, fontSize:11, letterSpacing:"0.08em", color:T.wine}}>
                  {code(i)}
                </span>
                <span>
                  <span style={{display:"block", fontSize:17, fontWeight:500,
                    letterSpacing:"-0.005em", color:T.ink, marginBottom:4, textWrap:"balance"}}>
                    {noEmoji(pub.title)}
                  </span>
                  <span style={{fontFamily:MONO, fontSize:10.5, letterSpacing:"0.08em",
                    textTransform:"uppercase", color:T.ink50}}>
                    {pub.org}{pub.date ? ` · ${pub.date}` : ""}
                  </span>
                </span>
                <span style={{fontFamily:MONO, fontSize:11, letterSpacing:"0.08em", color:T.wine}}>
                  READ ↗
                </span>
              </a>
            ))}
          </div>
        </Band>
      )}

      {/* ══ RELATED OP-EDS & BLOGS — short writing, distinct from long-form research above ══ */}
      {iOpeds.length > 0 && (
        <Band deep>
          <Head eyebrow="Short writing" title="Related op-eds" em="& blogs"
            lede="Shorter pieces and opinion writing on the war, published alongside the tracker."/>
          <div style={{borderTop:HAIR}}>
            {iOpeds.map((w,i)=>{
              const row = (
                <>
                  <span style={{fontFamily:MONO, fontSize:11, letterSpacing:"0.08em", color:T.wine}}>
                    {code(i)}
                  </span>
                  <span>
                    <span style={{display:"block", fontSize:16, fontWeight:500,
                      letterSpacing:"-0.005em", color:T.ink, marginBottom:4, textWrap:"balance"}}>
                      {noEmoji(w.title)}
                    </span>
                    <span style={{fontFamily:MONO, fontSize:10.5, letterSpacing:"0.08em",
                      textTransform:"uppercase", color:T.ink50}}>
                      {w.org}{w.date ? ` · ${w.date}` : ""}{w.type ? ` · ${w.type}` : ""}
                    </span>
                  </span>
                  <span style={{fontFamily:MONO, fontSize:11, letterSpacing:"0.08em",
                    color:w.url ? T.wine : T.ink50}}>
                    {w.url ? "READ ↗" : "LINK PENDING"}
                  </span>
                </>
              );
              const rowStyle = {display:"grid", gridTemplateColumns:"40px 1fr auto", gap:16,
                alignItems:"baseline", padding:"14px 8px", borderBottom:HAIR,
                textDecoration:"none", transition:"background 0.15s ease"};
              return w.url
                ? <a key={i} href={w.url} target="_blank" rel="noopener noreferrer"
                    className="rowlink" style={rowStyle}>{row}</a>
                : <div key={i} style={{...rowStyle, cursor:"default"}}>{row}</div>;
            })}
          </div>
        </Band>
      )}

      {/* ══ FOOTER — wine ground ══ */}
      <footer id="sources" style={{background:T.wine, color:"rgba(255,255,255,0.85)",
        padding:"64px 0 48px", scrollMarginTop:56}}>
        <div className="wrap">
          <div className="split" style={{gap:56, marginBottom:40}}>
            <div>
              <div style={{fontSize:20, fontWeight:400, color:"#fff", marginBottom:12,
                letterSpacing:"-0.01em"}}>
                West Asia War: India Risk Dashboard
              </div>
              <p style={{margin:"0 0 20px", fontSize:14, lineHeight:1.6,
                color:"rgba(255,255,255,0.8)", maxWidth:520, textWrap:"pretty"}}>
                Built and maintained by {iAuthor?.name || "Nithiyanandam Yogeswaran"}. Market data syncs
                automatically; war intelligence is compiled by hand and should be read as assessment.
              </p>
              <button className="btn" style={{background:T.gold, color:T.ink, fontWeight:600}}
                onClick={()=>shareCard(sharePayload)}>Share today's card →</button>
            </div>
            <div>
              <div style={{fontFamily:MONO, fontSize:11, letterSpacing:"0.1em",
                textTransform:"uppercase", color:"rgba(255,255,255,0.5)", marginBottom:12}}>
                Explore
              </div>
              <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:"6px 24px"}}>
                {NAV.map(n=>(
                  <button key={n.id} onClick={()=>go(n.id)}
                    style={{background:"none", border:"none", padding:0, textAlign:"left",
                      fontFamily:SANS, fontSize:14, lineHeight:1.4, cursor:"pointer",
                      color:"rgba(255,255,255,0.8)"}}>{n.l}</button>
                ))}
              </div>
            </div>
          </div>

          <div style={{borderTop:"1px solid rgba(255,255,255,0.18)", paddingTop:28}}>
            {[
              {h:"Sources", t:"Al Jazeera, AP, Reuters, NASA FIRMS, Copernicus Sentinel, IMF PortWatch, UKMTO, GDELT, Bloomberg, CNN, CBS, NBC, ABC, NPR, CNBC, Iran International, Times of Israel, ACLED, Atlantic Council, Amnesty International, Business Standard, Business Today, Goodreturns, Trading Economics, IAEA, Human Rights Watch, CSIS, IEA, EIA, Kpler, MarineTraffic, MUFG, ORF, Ministry of External Affairs, Nomura, Elara, UBS, HSBC, Kotak, SBI Securities, Choice Broking."},
              {h:"Methodology", t:"Nuclear and contamination scores are analytical estimates, not confirmed measurements. Projections are trend extrapolations rather than forecasts. All timestamps are IST (UTC+5:30). Hormuz shipping figures draw on Kpler, MarineTraffic, Windward and news reporting. Market series come from Yahoo Finance and an exchange-rate API, synced every four hours."},
              {h:"Citation", t:`${(iAuthor?.name||"Nithiyanandam Yogeswaran").split(" ").slice(-1)[0]}, ${(iAuthor?.name||"Nithiyanandam Yogeswaran").split(" ").slice(0,-1).join(" ")} (2026) West Asia War: India Risk Dashboard. Takshashila Institution. Available at: https://nithiyageo.github.io/india-risk-dashboard/ (Accessed: ${citedOn}).`},
              {h:"Contact", t:`Queries and media enquiries: ${iAuthor?.contact || "geospatial@takshashila.org.in"}`},
              {h:"Disclaimer", t:"Built with AI tools; an ongoing project. Not financial, safety or evacuation advice."},
            ].map((s,i)=>(
              <div key={i} style={{display:"grid", gridTemplateColumns:"minmax(110px,150px) 1fr",
                gap:24, padding:"12px 0", borderBottom:"1px solid rgba(255,255,255,0.18)"}}>
                <span style={{fontFamily:MONO, fontSize:11, letterSpacing:"0.1em",
                  textTransform:"uppercase", color:"rgba(255,255,255,0.5)"}}>{s.h}</span>
                <span style={{fontSize:13, lineHeight:1.65, color:"rgba(255,255,255,0.8)",
                  textWrap:"pretty"}}>{s.t}</span>
              </div>
            ))}
          </div>

          <div style={{display:"flex", gap:10, flexWrap:"wrap", marginTop:28}}>
            {[{l:"Share on X",p:"x"},{l:"Share on LinkedIn",p:"li"},
              {l:"Share on WhatsApp",p:"wa"},{l:"Copy Link",p:"copy"}].map((s,i)=>(
              <button key={i} onClick={()=>share(s.p)}
                style={{fontFamily:MONO, fontSize:11, letterSpacing:"0.1em",
                  textTransform:"uppercase", padding:"9px 16px", cursor:"pointer",
                  border:"1px solid rgba(255,255,255,0.3)", background:"transparent",
                  color:"rgba(255,255,255,0.85)"}}>{s.l}</button>
            ))}
          </div>

          <div style={{marginTop:28, paddingTop:20, borderTop:"1px solid rgba(255,255,255,0.18)"}}>
            <a href={iAuthor?.twitter || "https://x.com/prof_nithiya"} target="_blank"
              rel="noopener noreferrer" style={{fontFamily:MONO, fontSize:11, letterSpacing:"0.1em",
                textTransform:"uppercase", color:"rgba(255,255,255,0.55)", textDecoration:"none"}}>
              Follow {(iAuthor?.name || "Nithiyanandam Yogeswaran").split(" ")[0]} on X ↗
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
