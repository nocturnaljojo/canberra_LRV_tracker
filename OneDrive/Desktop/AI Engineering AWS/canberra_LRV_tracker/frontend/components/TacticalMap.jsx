"use client";
import { useState, useEffect, useRef } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const TRAM_COLORS = {
  LRV3:  "#00ff88",
  LRV12: "#00ddff",
  LRV13: "#ffaa00",
  LRV17: "#ff4488",
};

// ─── ASSET LOOKUPS ────────────────────────────────────────────────────────────
const LRV_IMAGES = {
  LRV1:  "/lrvs/LRV001.jpg",
  LRV2:  "/lrvs/LRV002.jpg",
  LRV3:  "/lrvs/LRV003.jpg",
  LRV4:  "/lrvs/LRV004.jpg",
  LRV6:  "/lrvs/LRV006.jpg",
  LRV7:  "/lrvs/LRV007.jpg",
  LRV8:  "/lrvs/LRV008.jpg",
  LRV9:  "/lrvs/LRV009.jpg",
  LRV10: "/lrvs/LRV010.jpg",
  LRV12: "/lrvs/LRV0012.jpg",
  LRV13: "/lrvs/LRV0013.jpg",
  LRV14: "/lrvs/LRV0014.jpg",
};

const STOP_IMAGES = {
  1:  "/stopmaps/gungahlin.jpg",
  2:  "/stopmaps/manning-clark.jpg",
  3:  "/stopmaps/mapleton.jpg",
  4:  "/stopmaps/nullarbor.jpg",
  5:  "/stopmaps/well-station.jpg",
  6:  "/stopmaps/sandford.jpg",
  14: "/stopmaps/alinga.jpg",
};

// ─── STOPS — two-leg geometry ─────────────────────────────────────────────────
// LEG 1 — Northbourne Avenue (ALG→DKN): nearly straight N-S, lng ~149.130
// SHARP TURN at Swinden St / Dickson onto Flemington Road
// LEG 2 — Flemington Road (SWN→GGN): swings east through Mitchell/EPIC
//          then curves back west to terminate at Gungahlin
// Coordinates from GTFS static stops.txt — Transport ACT (authoritative)
// 14 stops. Easternmost: Mapleton Avenue (149.1510). Sandford Street confirmed present.
const STOPS = [
  // ── Flemington Road leg — peaks east at Mapleton (149.1510), then curves SW ──
  {id:1,  name:"Gungahlin Place",     lat:-35.185639, lng:149.135481, code:"GGN", ix:true,  busR:["R1","R8"],  busL:["18","19","20","21","22","24","25","26","27","28"], labelYOff:-18},
  {id:2,  name:"Manning Clark",       lat:-35.186986, lng:149.143372, code:"MCK", ix:false, busR:[], busL:[], labelYOff:-14},
  {id:3,  name:"Mapleton Avenue",     lat:-35.193381, lng:149.150972, code:"MPN", ix:false, busR:[], busL:[]},  // easternmost
  {id:4,  name:"Nullarbor Avenue",    lat:-35.200550, lng:149.149294, code:"NLR", ix:false, busR:[], busL:[]},
  {id:5,  name:"Well Station Drive",  lat:-35.209050, lng:149.147350, code:"WSN", ix:false, busR:[], busL:[]},
  {id:6,  name:"Sandford Street",     lat:-35.221631, lng:149.144661, code:"SFD", ix:false, busR:[], busL:[]},
  {id:7,  name:"EPIC and Racecourse", lat:-35.228500, lng:149.144220, code:"EPC", ix:false, busR:[], busL:[]},
  {id:8,  name:"Phillip Avenue",      lat:-35.235794, lng:149.143928, code:"PLP", ix:false, busR:[], busL:[]},
  {id:9,  name:"Swinden Street",      lat:-35.244470, lng:149.134620, code:"SWN", ix:false, busR:[], busL:[]},  // turn point
  // ── Northbourne Avenue leg — near-straight N-S ──────────────────────────────
  {id:10, name:"Dickson Interchange", lat:-35.250558, lng:149.133739, code:"DKN", ix:true,  busR:["R1","R9"],  busL:["50","51","53","30","31","18"]},
  {id:11, name:"Macarthur Avenue",    lat:-35.260158, lng:149.132228, code:"MCR", ix:false, busR:[], busL:[]},
  {id:12, name:"Ipima Street",        lat:-35.265897, lng:149.131283, code:"IPA", ix:false, busR:[], busL:[]},
  {id:13, name:"Elouera Street",      lat:-35.272617, lng:149.130172, code:"ELA", ix:false, busR:[], busL:[]},
  {id:14, name:"Alinga Street, City", lat:-35.277933, lng:149.129331, code:"ALG", ix:true,  busR:["R1","R2","R3","R4","R5","R6","R7","R10"], busL:["50","51","53","54","55","56","57","58","59","31","32"]},
];

// ─── SUBURB ZONE LABELS ───────────────────────────────────────────────────────
// Anchored west of track midpoints; rot follows corridor angle
const ZONES = [
  { label:"GUNGAHLIN", lat:-35.1858, lng:149.1295, rot:-80 },
  { label:"HARRISON",  lat:-35.1935, lng:149.1400, rot:-65 },
  { label:"MITCHELL",  lat:-35.2160, lng:149.1370, rot:-82 },  // SFD area
  { label:"WATSON",    lat:-35.2310, lng:149.1360, rot:-82 },  // EPC/PLP area
  { label:"DOWNER",    lat:-35.2430, lng:149.1295, rot:-85 },
  { label:"DICKSON",   lat:-35.2515, lng:149.1278, rot:-85 },
  { label:"BRADDON",   lat:-35.2615, lng:149.1265, rot:-85 },
  { label:"TURNER",    lat:-35.2695, lng:149.1255, rot:-85 },
  { label:"CITY",      lat:-35.2778, lng:149.1245, rot:-85 },
];

// ─── TIMETABLE RUNTIMES (seconds, 13 segments for 14 stops) ─────────────────
// seg i = STOPS[i] → STOPS[i+1]
// SB order: GGN MCK MPN NLR WSN SFD EPC PLP SWN DKN MCR IPA ELA ALG
const SB_RUNTIMES = [124, 110, 96, 112, 125, 117, 136, 129, 110, 120, 90, 109, 117];
// NB_RUNTIMES[i] = seconds from STOPS[i+1] back to STOPS[i]
// NB order: ALG ELA IPA MCR DKN SWN PLP EPC SFD WSN NLR MPN MCK GGN
const NB_RUNTIMES = [118, 119, 96, 129, 120, 128, 135, 124, 117, 114, 76, 85, 114];
const DWELL = 20; // seconds dwell at each stop

const CAMS = [
  {id:"C01",n:"Gungahlin TC",    lat:-35.1847,lng:149.1332,s:"ON"},
  {id:"C02",n:"Mapleton Xing",   lat:-35.1928,lng:149.1385,s:"ON"},
  {id:"C03",n:"Well Station OB", lat:-35.2065,lng:149.1445,s:"DG"},
  {id:"C04",n:"EPIC Gate",       lat:-35.2215,lng:149.1460,s:"ON"},
  {id:"C05",n:"Phillip Xing",    lat:-35.2335,lng:149.1430,s:"ON"},
  {id:"C06",n:"Antill Crossing", lat:-35.2415,lng:149.1375,s:"ON"},
  {id:"C07",n:"Dickson Plat",    lat:-35.2505,lng:149.1345,s:"OFF"},
  {id:"C08",n:"Macarthur Jn",    lat:-35.2560,lng:149.1335,s:"ON"},
  {id:"C09",n:"Ipima Xing",      lat:-35.2635,lng:149.1320,s:"ON"},
  {id:"C10",n:"Alinga W",        lat:-35.2780,lng:149.1300,s:"ON"},
];

const FAULTS = [
  {id:"F1",loc:"Macarthur / Northbourne",lat:-35.2471,lng:149.1320,sev:"HIGH"},
  {id:"F2",loc:"Dickson / Cowper St",    lat:-35.2545,lng:149.1330,sev:"MED"},
  {id:"F3",loc:"Braddon / Lonsdale",     lat:-35.2640,lng:149.1300,sev:"HIGH"},
];

const EVENTS = [
  {id:"E1",t:"CONSTRUCTION",n:"LR Stage 2A Cwlth Ave",  lat:-35.282,lng:149.129,sev:"MAJOR"},
  {id:"E2",t:"CLOSURE",     n:"Northbourne Ave lane cut",lat:-35.270,lng:149.131,sev:"MOD"},
  {id:"E3",t:"EVENT",       n:"Farmers Market EPIC",     lat:-35.2188,lng:149.1476,sev:"LOW"},
  {id:"E4",t:"UTILITIES",   n:"ActewAGL Antill St",      lat:-35.250,lng:149.1325,sev:"MOD"},
];

const ESA_DATA = [
  {id:"ESA1",type:"FIRE",n:"Structure Fire - Downer",  lat:-35.242,lng:149.142,st:"Responding"},
  {id:"ESA2",type:"AMBO",n:"Medical - Dickson Shops",  lat:-35.252,lng:149.137,st:"On Scene"},
  {id:"ESA3",type:"SES", n:"Tree Down - Lyneham",      lat:-35.228,lng:149.136,st:"Responding"},
];

const LANDMARKS = [
  {id:"LM1",n:"CIT Gungahlin",lat:-35.186,lng:149.138,icon:"\uD83C\uDF93"},
  {id:"LM2",n:"Mitchell",     lat:-35.213,lng:149.143,icon:"\u25C8"},
  {id:"LM3",n:"UC Hospital",  lat:-35.224,lng:149.132,icon:"\uD83C\uDFE5"},
  {id:"LM4",n:"ANU",          lat:-35.277,lng:149.119,icon:"\uD83C\uDF93"},
  {id:"LM5",n:"Calvary Hosp", lat:-35.253,lng:149.126,icon:"\uD83C\uDFE5"},
  {id:"LM6",n:"Canberra Ctr", lat:-35.279,lng:149.133,icon:"\uD83D\uDED2"},
];

const RAPID_ROUTES = [
  {id:"R1",color:"#ff4444",lats:[-35.185,-35.253,-35.278],lngs:[149.133,149.134,149.130]},
  {id:"R8",color:"#ff8844",lats:[-35.185,-35.21], lngs:[149.133,149.145]},
  {id:"R9",color:"#aa44ff",lats:[-35.253,-35.235],lngs:[149.134,149.150]},
];

const ROAD_LINES = [
  // Northbourne Ave / main corridor spine
  [[-35.185,149.1332],[-35.212,149.1420],[-35.242,149.138],[-35.278,149.130]],
  // Flemington Rd — crosses near Sandford Street (stop 6, lat -35.2140)
  [[-35.2140,149.118],[-35.2140,149.158]],
  // Federal Hwy — crosses near Phillip Avenue (stop 8, lat -35.2340)
  [[-35.2340,149.119],[-35.2340,149.156]],
  // Antill St — crosses near Swinden Street (stop 9, lat -35.2420)
  [[-35.2420,149.120],[-35.2420,149.154]],
  // Cowper St / Dickson area
  [[-35.253,149.122],[-35.253,149.148]],
  // Lonsdale / Braddon
  [[-35.264,149.121],[-35.264,149.140]],
  // London Circuit / City
  [[-35.278,149.120],[-35.278,149.142]],
  // Barry Drive
  [[-35.272,149.122],[-35.272,149.145]],
];

// ─── MAP PROJECTION ───────────────────────────────────────────────────────────
const BOUNDS = {minLat:-35.285, maxLat:-35.175, minLng:149.118, maxLng:149.162};
const MW = 460, MH = 720, MP = 30;

function toXY(lat, lng) {
  return {
    x: MP + ((lng - BOUNDS.minLng) / (BOUNDS.maxLng - BOUNDS.minLng)) * (MW - 2*MP),
    y: MP + (1 - ((lat - BOUNDS.minLat) / (BOUNDS.maxLat - BOUNDS.minLat))) * (MH - 2*MP),
  };
}

// ─── ROUTE SNAP ───────────────────────────────────────────────────────────────
// Metric scaling: 1°lat = 111320m, 1°lng at -35.22° ≈ 91050m
// Must use proper scaling or segments with E-W components snap incorrectly
const LAT_M = 111320;
const LNG_M = 111320 * Math.cos(-35.22 * Math.PI / 180); // ≈ 91050

// Dense route polyline derived from GTFS shapes.txt shape_id=1003 (SB GGN→ALG).
// Decimated to 5 pts/segment. Each entry: [lat, lng, stopSegIndex]
const ROUTE_WPT = [
  [-35.185604, 149.135487, 0], [-35.185890, 149.137138, 0], [-35.186156, 149.138721, 0],
  [-35.186231, 149.139165, 0], [-35.186961, 149.143422, 0],
  [-35.186961, 149.143422, 1], [-35.187507, 149.146618, 1], [-35.188189, 149.149430, 1],
  [-35.190397, 149.151338, 1], [-35.193435, 149.151014, 1],
  [-35.193435, 149.151014, 2], [-35.195136, 149.150603, 2], [-35.196859, 149.150190, 2],
  [-35.198580, 149.149782, 2], [-35.200691, 149.149296, 2],
  [-35.200691, 149.149296, 3], [-35.202792, 149.148802, 3], [-35.204896, 149.148300, 3],
  [-35.207002, 149.147798, 3], [-35.209051, 149.147405, 3],
  [-35.209051, 149.147405, 4], [-35.212243, 149.146801, 4], [-35.215493, 149.145893, 4],
  [-35.218669, 149.145181, 4], [-35.221615, 149.144789, 4],
  [-35.221615, 149.144789, 5], [-35.222649, 149.144279, 5], [-35.224004, 149.143865, 5],
  [-35.225614, 149.143593, 5], [-35.228498, 149.144243, 5],
  [-35.228498, 149.144243, 6], [-35.231824, 149.144776, 6], [-35.234103, 149.145604, 6],
  [-35.234551, 149.145676, 6], [-35.235845, 149.143932, 6],
  [-35.235845, 149.143932, 7], [-35.237467, 149.141540, 7], [-35.239500, 149.138609, 7],
  [-35.241751, 149.135741, 7], [-35.244468, 149.134621, 7],
  [-35.244468, 149.134621, 8], [-35.245897, 149.134387, 8], [-35.246803, 149.134235, 8],
  [-35.247596, 149.134152, 8], [-35.250559, 149.133755, 8],
  [-35.250559, 149.133755, 9], [-35.260159, 149.132197, 9],
  [-35.260159, 149.132197, 10], [-35.260405, 149.132158, 10], [-35.260632, 149.132121, 10],
  [-35.265897, 149.131272, 10],
  [-35.265897, 149.131272, 11], [-35.266146, 149.131232, 11], [-35.272618, 149.130198, 11],
  [-35.272618, 149.130198, 12], [-35.275571, 149.129726, 12], [-35.275924, 149.129667, 12],
  [-35.277044, 149.129491, 12], [-35.277934, 149.129346, 12],
];

function closestPointOnSegment(pLat, pLng, aLat, aLng, bLat, bLng) {
  const dx = (bLat - aLat) * LAT_M;
  const dy = (bLng - aLng) * LNG_M;
  const lenSq = dx*dx + dy*dy;
  if (lenSq === 0) return { lat:aLat, lng:aLng, t:0 };
  const px = (pLat - aLat) * LAT_M;
  const py = (pLng - aLng) * LNG_M;
  const t = Math.max(0, Math.min(1, (px*dx + py*dy) / lenSq));
  return { lat: aLat + t*(bLat-aLat), lng: aLng + t*(bLng-aLng), t };
}

function snapAndLocate(lat, lng) {
  let best = { dist:Infinity, seg:0, t:0, lat, lng };
  for (let i = 0; i < ROUTE_WPT.length - 1; i++) {
    const [aLat, aLng, aSeg] = ROUTE_WPT[i];
    const [bLat, bLng, bSeg] = ROUTE_WPT[i+1];
    if (aSeg !== bSeg) continue; // don't snap across stop boundaries
    const { lat:sLat, lng:sLng, t } = closestPointOnSegment(lat, lng, aLat, aLng, bLat, bLng);
    const dlat = (lat-sLat) * LAT_M;
    const dlng = (lng-sLng) * LNG_M;
    const d = dlat*dlat + dlng*dlng;
    if (d < best.dist) {
      // Compute t relative to full stop segment for ETA accuracy
      const segStart = ROUTE_WPT.find(w => w[2] === aSeg);
      const segPts = ROUTE_WPT.filter(w => w[2] === aSeg);
      best = { dist:d, seg:aSeg, t, lat:sLat, lng:sLng };
    }
  }
  return best;
}

// ─── ETA HELPERS ──────────────────────────────────────────────────────────────
function calcUpcomingStops(seg, routeT, dir) {
  const results = [];
  if (dir === "SB") {
    let cumSec = SB_RUNTIMES[seg] * (1 - routeT);
    for (let i = seg + 1; i < STOPS.length; i++) {
      results.push({ stop: STOPS[i], etaSec: Math.round(cumSec) });
      if (i < STOPS.length - 1) cumSec += DWELL + SB_RUNTIMES[i];
    }
  } else {
    let cumSec = NB_RUNTIMES[seg] * routeT;
    for (let i = seg; i >= 0; i--) {
      results.push({ stop: STOPS[i], etaSec: Math.round(cumSec) });
      if (i > 0) cumSec += DWELL + NB_RUNTIMES[i-1];
    }
  }
  return results;
}

function fmtEta(sec) {
  if (sec < 60) return `${sec}s`;
  return `${Math.floor(sec/60)}m ${String(sec % 60).padStart(2,"0")}s`;
}

function nextArrivalsAt(stopId, trams) {
  const sb = [], nb = [];
  for (const t of trams) {
    if (t.seg == null) continue;
    const upcoming = calcUpcomingStops(t.seg, t.routeT, t.dir);
    const hit = upcoming.find(u => u.stop.id === stopId);
    if (hit) (t.dir === "SB" ? sb : nb).push({ tram:t, etaSec:hit.etaSec });
  }
  sb.sort((a,b) => a.etaSec - b.etaSec);
  nb.sort((a,b) => a.etaSec - b.etaSec);
  return { sb: sb[0]||null, nb: nb[0]||null };
}

// ─── TRIANGLE MARKER ──────────────────────────────────────────────────────────
function triPoints(px, py, dir, s=7) {
  return dir === "SB"
    ? `${px},${py+s} ${px-s*0.75},${py-s*0.55} ${px+s*0.75},${py-s*0.55}`
    : `${px},${py-s} ${px-s*0.75},${py+s*0.55} ${px+s*0.75},${py+s*0.55}`;
}

// ─── DEAD RECKONING ───────────────────────────────────────────────────────────
// Straight-line stop-to-stop segment length in metres
function segLengthM(i) {
  const a = STOPS[i], b = STOPS[i+1];
  const dlat = (b.lat - a.lat) * LAT_M;
  const dlng = (b.lng - a.lng) * LNG_M;
  return Math.sqrt(dlat*dlat + dlng*dlng);
}

// Advance a tram along the route using speed × elapsed time since last GPS fix.
// Returns { lat, lng, seg, routeT } — smoothed display position.
function deadReckon(tram, nowMs) {
  if (!tram.updatedAt || tram.status === "STOPPED") {
    return { lat:tram.lat, lng:tram.lng, seg:tram.seg, routeT:tram.routeT };
  }
  const elapsed = Math.min((nowMs - tram.updatedAt) / 1000, 25); // cap at 25s
  const speedMs = parseFloat(tram.speed) / 3.6;
  if (speedMs < 0.5) return { lat:tram.lat, lng:tram.lng, seg:tram.seg, routeT:tram.routeT };

  let dist = speedMs * elapsed;
  let seg  = tram.seg;
  let t    = tram.routeT;
  const maxSeg = STOPS.length - 2;

  while (dist > 0) {
    const len = segLengthM(seg);
    if (tram.dir === "SB") {
      const rem = len * (1 - t);
      if (dist < rem)        { t += dist / len; dist = 0; }
      else if (seg < maxSeg) { dist -= rem; seg++; t = 0; }
      else                   { t = 1; dist = 0; }
    } else {
      const rem = len * t;
      if (dist < rem)  { t -= dist / len; dist = 0; }
      else if (seg > 0){ dist -= rem; seg--; t = 1; }
      else             { t = 0; dist = 0; }
    }
  }

  const a = STOPS[seg], b = STOPS[seg+1];
  return { lat: a.lat + t*(b.lat-a.lat), lng: a.lng + t*(b.lng-a.lng), seg, routeT:t };
}

function noise(s) { const x = Math.sin(s)*10000; return x - Math.floor(x); }

const ESA_COLORS = {FIRE:"#ff2222", AMBO:"#00aaff", SES:"#ff8800", HAZMAT:"#ff8800", OTHER:"#aaaaaa"};
const ESA_ICONS  = {FIRE:"\uD83D\uDD25", AMBO:"\uD83D\uDE91", SES:"\uD83C\uDF0A", HAZMAT:"☣", OTHER:"⚠"};

const WEATHER_SYMBOL = {
  CLEAR:"CLR", CLOUDY:"CLD", RAIN:"RAIN", STORM:"STM", SNOW:"SNW", FOG:"FOG",
};

// ─── CORRIDOR STATUS ──────────────────────────────────────────────────────────
function getCorridorStatus(trams, esaIncidents, roadEvents, faults) {
  const activeTrams    = trams.length;
  const hasESA         = esaIncidents.length > 0;
  const hasMajorClosure= roadEvents.some(e => e.sev === "MAJOR");
  const hasHighFault   = faults.some(f => f.sev === "HIGH");

  if (activeTrams === 0 || hasMajorClosure)
    return { level:"RED",   label:"DISRUPTED", color:"#ff3333" };
  if (hasESA || hasHighFault || activeTrams < 3)
    return { level:"AMBER", label:"DEGRADED",  color:"#ffaa00" };
  return   { level:"GREEN", label:"NOMINAL",   color:"#00ff88" };
}

// ═════════════════════════════════════════════════════════════════════════════
export default function CMETv4() {
  const [time,      setTime]      = useState(new Date());
  const [tramState, setTramState] = useState([]);
  const [sel,       setSel]       = useState({ t:null, d:null });
  const [ly,        setLy]        = useState({
    route:true, stops:true, trams:true, cam:true,
    faults:true, events:true, esa:true, bus:false, lm:true,
  });
  const [vm,      setVm]      = useState("SAT");
  const [logs,    setLogs]    = useState([]);
  const [tab,     setTab]     = useState("intel");
  const [leftTab, setLeftTab] = useState("fleet");
  const [sweep,        setSweep]        = useState(0);
  const [displayTrams, setDisplayTrams] = useState([]);
  const [view,         setView]         = useState({ x:0, y:0, z:1 });
  const [esaState,     setEsaState]     = useState([]);
  const [roadState,    setRoadState]    = useState([]);
  const [weatherState, setWeatherState] = useState(null);
  const [newsState,    setNewsState]    = useState([]);
  const [tickerPaused, setTickerPaused] = useState(false);
  const tramStateRef = useRef([]);
  const mapSvgRef    = useRef(null);
  const dragRef      = useRef(null);
  const fr = useRef(0);
  const cx = MW / 2, cy = MH / 2;

  // ── Zoom & Pan handlers ──────────────────────────────────────────────────
  const handleWheel = (e) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.18 : 1 / 1.18;
    setView(prev => {
      const newZ = Math.max(1, Math.min(6, prev.z * factor));
      const rect  = mapSvgRef.current?.getBoundingClientRect();
      if (!rect) return prev;
      // Mouse position in current SVG coordinate space
      const mx = prev.x + (e.clientX - rect.left)  / rect.width  * (MW / prev.z);
      const my = prev.y + (e.clientY - rect.top)   / rect.height * (MH / prev.z);
      // New origin so mx/my stays under cursor
      const nx = mx - (e.clientX - rect.left)  / rect.width  * (MW / newZ);
      const ny = my - (e.clientY - rect.top)   / rect.height * (MH / newZ);
      return {
        z: newZ,
        x: Math.max(0, Math.min(MW - MW / newZ, nx)),
        y: Math.max(0, Math.min(MH - MH / newZ, ny)),
      };
    });
  };

  const handleMouseDown = (e) => {
    // Middle or left button only; ignore clicks on interactive children via target check
    if (e.button !== 0 && e.button !== 1) return;
    dragRef.current = { sx: e.clientX, sy: e.clientY };
    e.currentTarget.style.cursor = "grabbing";
  };

  const handleMouseMove = (e) => {
    if (!dragRef.current) return;
    setView(prev => {
      const rect = mapSvgRef.current?.getBoundingClientRect();
      if (!rect) return prev;
      const dx = (e.clientX - dragRef.current.sx) / rect.width  * (MW / prev.z);
      const dy = (e.clientY - dragRef.current.sy) / rect.height * (MH / prev.z);
      dragRef.current = { sx: e.clientX, sy: e.clientY };
      return {
        ...prev,
        x: Math.max(0, Math.min(MW - MW / prev.z, prev.x - dx)),
        y: Math.max(0, Math.min(MH - MH / prev.z, prev.y - dy)),
      };
    });
  };

  const handleMouseUp = (e) => {
    dragRef.current = null;
    if (e?.currentTarget) e.currentTarget.style.cursor = "grab";
  };

  const resetView = () => setView({ x:0, y:0, z:1 });

  // Keep ref current so the animation interval can read tramState without stale closure
  useEffect(() => { tramStateRef.current = tramState; }, [tramState]);

  // Attach wheel listener as non-passive so preventDefault() works (stops page scroll)
  useEffect(() => {
    const el = mapSvgRef.current;
    if (!el) return;
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, []);

  // Clock, radar sweep, activity log, dead-reckoned tram positions
  useEffect(() => {
    const iv = setInterval(() => {
      setTime(new Date());
      fr.current++;
      setSweep(prev => (prev + 2.5) % 360);
      // Advance each tram along the route using speed × elapsed time
      const now = Date.now();
      setDisplayTrams(tramStateRef.current.map(t => {
        const dr = deadReckon(t, now);
        return { ...t, lat:dr.lat, lng:dr.lng, seg:dr.seg, routeT:dr.routeT };
      }));
      if (fr.current % 35 === 0) {
        const ms = [
          {m:"ESA DISPATCH Structure fire Downer - ACTAS responding",  t:"error"},
          {m:"SIGNAL PRIORITY LRV granted Dickson junction",           t:"info"},
          {m:"CROSSING ACTIVATED Well Station - boom gates down",      t:"warn"},
          {m:"AMBO ON SCENE Dickson Shops - medical incident",         t:"error"},
          {m:"SL FAULT Macarthur/Northbourne - crew dispatched",       t:"warn"},
          {m:"R1 RAPID delayed 4min at Gungahlin Interchange",         t:"info"},
          {m:"ALL CLEAR Gungahlin-EPIC corridor nominal",              t:"ok"},
          {m:"CONGESTION SEVERE Braddon-Civic 12min delay",            t:"error"},
          {m:"SES RESPONDING tree down Lyneham near corridor",         t:"warn"},
          {m:"LR STAGE 2A Commonwealth Ave closure tonight",           t:"info"},
        ];
        const picked = ms[Math.floor(Math.random() * ms.length)];
        setLogs(prev => [{...picked, time:new Date(), id:Date.now()}, ...prev].slice(0,15));
      }
    }, 700);
    return () => clearInterval(iv);
  }, []);

  // Live tram positions — poll backend every 5s, snap to route
  useEffect(() => {
    const fetchTrams = async () => {
      try {
        const res  = await fetch(`${API_URL}/api/trams`);
        const data = await res.json();
        const now    = Date.now();
        const trams  = data.trams.map(t => {
          const snap = snapAndLocate(t.latitude, t.longitude);
          const dir  = t.bearing > 90 && t.bearing < 270 ? "SB" : "NB";
          return {
            id:        t.vehicle_label,
            lat:       snap.lat,
            lng:       snap.lng,
            rawLat:    t.latitude,
            rawLng:    t.longitude,
            seg:       snap.seg,
            routeT:    snap.t,
            speed:     (t.speed * 3.6).toFixed(1),
            status:    t.current_status === "IN_TRANSIT" ? "TRANSIT" : "STOPPED",
            bearing:   t.bearing,
            near:      t.stop_id,
            dir,
            c:         TRAM_COLORS[t.vehicle_label] ?? "#00ff88",
            updatedAt: now,
            occ:       null,
            del:       null,
          };
        });
        setTramState(trams);
        // Seed displayTrams immediately so there's no blank frame before first tick
        setDisplayTrams(trams);
      } catch (err) { console.warn("[fetchTrams] fetch failed:", err?.message); }
    };
    fetchTrams();
    const iv = setInterval(fetchTrams, 5000);
    return () => clearInterval(iv);
  }, []);

  // Live ESA incidents — poll every 60s, map to frontend marker format
  useEffect(() => {
    const fetchESA = async () => {
      try {
        const res  = await fetch(`${API_URL}/api/incidents`);
        const data = await res.json();
        setEsaState((data.incidents || []).map(e => ({
          id:  e.id || String(e.latitude)+String(e.longitude),
          type: e.service || "OTHER",
          n:   e.title,
          lat: e.latitude,
          lng: e.longitude,
          st:  e.updated ? "Active" : "Responding",
        })));
      } catch (_) {}
    };
    fetchESA();
    const iv = setInterval(fetchESA, 60000);
    return () => clearInterval(iv);
  }, []);

  // Live road closures — poll every 60s, map to marker format
  useEffect(() => {
    const fetchRoads = async () => {
      try {
        const res  = await fetch(`${API_URL}/api/road-closures`);
        const data = await res.json();
        const SEV_MAP = {
          "emergency":"MAJOR", "light rail":"MAJOR",
          "road works":"MOD",  "utilities":"MOD",
          "special event":"LOW",
        };
        setRoadState((data.closures || []).filter(e => {
          // Must have parseable geometry
          const loc = e.location || e.geometry;
          return loc && (loc.coordinates || loc.latitude);
        }).map((e, i) => {
          const loc = e.location || e.geometry || {};
          const coords = loc.coordinates || [];
          const lat = parseFloat(e.latitude  || (coords[1]));
          const lng = parseFloat(e.longitude || (coords[0]));
          const typeKey = (e.type || "").toLowerCase();
          const sev = Object.entries(SEV_MAP).find(([k]) => typeKey.includes(k))?.[1] || "LOW";
          return {
            id:  e.rowid || String(i),
            t:   (e.type || "CLOSURE").toUpperCase(),
            n:   e.project_title || e.roads_closed || "Road Closure",
            lat, lng, sev,
          };
        }).filter(e => !isNaN(e.lat) && !isNaN(e.lng)));
      } catch (_) {}
    };
    fetchRoads();
    const iv = setInterval(fetchRoads, 60000);
    return () => clearInterval(iv);
  }, []);

  // Weather — poll every 300s
  useEffect(() => {
    const fetchWeather = async () => {
      try {
        const res  = await fetch(`${API_URL}/api/weather`);
        const data = await res.json();
        if (!data.error) setWeatherState(data);
      } catch (_) {}
    };
    fetchWeather();
    const iv = setInterval(fetchWeather, 300000);
    return () => clearInterval(iv);
  }, []);

  // News ticker — poll every 120s
  useEffect(() => {
    const fetchNews = async () => {
      try {
        const res  = await fetch(`${API_URL}/api/news`);
        const data = await res.json();
        if (data.items?.length) setNewsState(data.items);
      } catch (_) {}
    };
    fetchNews();
    const iv = setInterval(fetchNews, 120000);
    return () => clearInterval(iv);
  }, []);

  // Route line uses dense waypoints so the SVG path follows the road curves
  const routePts = ROUTE_WPT.map(w => toXY(w[0], w[1]));
  const routeD   = routePts.map((p,i) => (i===0?"M":"L")+p.x+","+p.y).join(" ");

  const themes = {
    SAT:  {a:"#00ffaa", bg:"rgba(2,8,4,0.97)",   terr:"#030d07"},
    NV:   {a:"#44ff44", bg:"rgba(0,15,0,0.97)",  terr:"#001200"},
    FLIR: {a:"#ff7700", bg:"rgba(12,5,0,0.97)",  terr:"#0a0300"},
    CRT:  {a:"#33ffcc", bg:"rgba(0,8,6,0.97)",   terr:"#000a06"},
  };
  const th  = themes[vm];
  // For trams, always resolve D from displayTrams so Intel panel tracks dead-reckoned position
  const D   = sel.t === "tram"
    ? (displayTrams.find(t => t.id === sel.d?.id) ?? sel.d)
    : sel.d;
  const lc  = Object.values(ly).filter(Boolean).length;
  // Live data — fall back to static mock arrays if API hasn't returned yet
  const activeESA   = esaState.length   > 0 ? esaState   : ESA_DATA;
  const activeRoads = roadState.length  > 0 ? roadState  : EVENTS;
  const corridorStatus = getCorridorStatus(displayTrams, esaState, roadState, FAULTS);
  const filters = {
    SAT:"none",
    NV:"brightness(1.3) saturate(0.2) sepia(0.5) hue-rotate(70deg)",
    FLIR:"brightness(1.1) contrast(1.4) saturate(0) invert(1) hue-rotate(180deg)",
    CRT:"brightness(0.85) contrast(1.2)",
  };

  const InfoRow = ({label, value, color}) => (
    <div style={{display:"flex",justifyContent:"space-between",padding:"2px 0",borderBottom:"1px solid "+th.a+"08"}}>
      <span style={{opacity:0.35}}>{label}</span>
      <span style={{color:color||"inherit"}}>{value}</span>
    </div>
  );

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div style={{fontFamily:"'Courier New',monospace",background:"#000a04",color:th.a,
      height:"100vh",overflow:"hidden",filter:filters[vm],position:"relative"}}>

      {vm==="CRT" && <div style={{position:"absolute",inset:0,zIndex:99,pointerEvents:"none",
        backgroundImage:"repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.15) 2px,rgba(0,0,0,0.15) 4px)",
        mixBlendMode:"multiply"}} />}

      {/* HEADER */}
      <div style={{borderBottom:"1px solid "+th.a+"25",padding:"5px 10px",display:"flex",
        justifyContent:"space-between",alignItems:"center",background:th.bg,zIndex:10,position:"relative"}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{width:7,height:7,borderRadius:"50%",background:th.a,
            boxShadow:"0 0 6px "+th.a,animation:"pulse 2s infinite"}} />
          <span style={{fontSize:9,letterSpacing:5,opacity:0.4}}>CMET</span>
          <span style={{fontSize:12,fontWeight:"bold",letterSpacing:3}}>WORLDVIEW</span>
          <span style={{fontSize:8,opacity:0.2,letterSpacing:2}}>v4 TAC/SAT</span>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center",fontSize:8}}>
          {/* Corridor status badge */}
          <span style={{
            background: corridorStatus.color+"18",
            border:     "1px solid "+corridorStatus.color+"55",
            padding:    "1px 7px", color: corridorStatus.color,
            letterSpacing:2, fontSize:7,
            animation:  corridorStatus.level==="RED" ? "pulse 1s infinite" : "none",
          }}>
            {"● "+corridorStatus.label}
          </span>
          {/* Live ESA count */}
          {activeESA.length > 0 && (
            <span style={{background:"#ff222218",border:"1px solid #ff222244",
              padding:"1px 5px",color:"#ff4444",letterSpacing:1,animation:"pulse 1.5s infinite"}}>
              {"● "+activeESA.length+" ESA"}
            </span>
          )}
          <span style={{opacity:0.3}}>35°16′S 149°07′E</span>
          <span suppressHydrationWarning style={{background:th.a+"12",border:"1px solid "+th.a+"25",padding:"1px 6px",letterSpacing:2}}>
            {time.toLocaleTimeString("en-AU",{hour12:false,timeZone:"Australia/Canberra"})}Z
          </span>
        </div>
      </div>

      <div style={{display:"flex",height:"calc(100vh - 34px)"}}>

        {/* ── LEFT PANEL ── */}
        <div style={{width:170,borderRight:"1px solid "+th.a+"15",background:th.bg,
          overflowY:"auto",fontSize:8,padding:8}}>

          <div style={{letterSpacing:3,marginBottom:4,opacity:0.3,fontSize:7}}>{"LAYERS ("+lc+"/9)"}</div>
          {[["route","LR CORRIDOR"],["stops","STOPS (14)"],["trams","LRV FLEET"],["cam","CAMERAS"],
            ["faults","SL FAULTS"],["events","ROAD EVENTS"],["esa","ESA INCIDENTS"],
            ["bus","RAPID ROUTES"],["lm","LANDMARKS"]].map(([k,l]) => {
            const layerColor = k==="esa"?"#ff2222":k==="faults"?"#ff8800":k==="bus"?"#ff4444":th.a;
            return (
              <div key={k} onClick={()=>setLy(prev=>({...prev,[k]:!prev[k]}))}
                style={{display:"flex",justifyContent:"space-between",alignItems:"center",
                  padding:"3px 5px",marginBottom:1,cursor:"pointer",
                  background:ly[k]?th.a+"08":"transparent",
                  border:"1px solid "+(ly[k]?th.a+"18":"transparent"),borderRadius:1}}>
                <span style={{opacity:ly[k]?1:0.3}}>{l}</span>
                <span style={{width:5,height:5,borderRadius:1,background:ly[k]?layerColor:"#222"}} />
              </div>
            );
          })}

          <div style={{letterSpacing:3,marginTop:10,marginBottom:4,opacity:0.3,fontSize:7}}>OPTICS</div>
          {["SAT","NV","FLIR","CRT"].map(k => {
            const labels = {SAT:"SATELLITE",NV:"NIGHT VISION",FLIR:"THERMAL",CRT:"CRT RETRO"};
            return (
              <div key={k} onClick={()=>setVm(k)}
                style={{padding:"3px 5px",marginBottom:1,cursor:"pointer",
                  background:vm===k?th.a+"15":"transparent",fontWeight:vm===k?"bold":"normal",
                  borderLeft:vm===k?"2px solid "+th.a:"2px solid transparent"}}>
                {labels[k]}
              </div>
            );
          })}

          {/* FLEET | STOPS tab bar */}
          <div style={{display:"flex",borderBottom:"1px solid "+th.a+"15",marginTop:10,marginBottom:4}}>
            {["fleet","stops"].map(lt => (
              <div key={lt} onClick={()=>setLeftTab(lt)}
                style={{flex:1,textAlign:"center",padding:"3px 0",cursor:"pointer",
                  fontSize:7,letterSpacing:2,
                  borderBottom:leftTab===lt?"2px solid "+th.a:"2px solid transparent",
                  opacity:leftTab===lt?1:0.3}}>
                {lt.toUpperCase()}
              </div>
            ))}
          </div>

          {leftTab==="fleet" && <>
            {tramState.map(t => (
              <div key={t.id} onClick={()=>setSel({t:"tram",d:t})}
                style={{padding:"3px 5px",marginBottom:2,cursor:"pointer",
                  borderLeft:"2px solid "+t.c,
                  background:sel.d?.id===t.id&&sel.t==="tram"?t.c+"15":"transparent"}}>
                <div style={{color:t.c,fontWeight:"bold",fontSize:9}}>
                  {t.id+" "}
                  <span style={{opacity:0.4,fontWeight:"normal"}}>{t.dir}</span>
                </div>
                <div style={{opacity:0.4,fontSize:7}}>
                  {(t.status==="STOPPED"?">> ":"> ")+t.near+" "+Math.round(t.speed)+"km/h"}
                </div>
              </div>
            ))}
          </>}

          {leftTab==="stops" && <>
            {STOPS.map(s => (
              <div key={s.id} onClick={()=>setSel({t:"stop",d:s})}
                style={{padding:"3px 5px",marginBottom:1,cursor:"pointer",
                  borderLeft:"2px solid "+(s.ix?th.a:th.a+"44"),
                  background:sel.d?.id===s.id&&sel.t==="stop"?th.a+"0a":"transparent"}}>
                <span style={{fontWeight:s.ix?"bold":"normal",fontSize:s.ix?8:7,
                  opacity:s.ix?0.9:0.5}}>{s.name.toUpperCase()}</span>
                {s.ix && <span style={{fontSize:6,opacity:0.3,marginLeft:4}}>IX</span>}
              </div>
            ))}
          </>}

          <div style={{letterSpacing:3,marginTop:10,marginBottom:4,opacity:0.3,fontSize:7}}>ESA ACTIVE</div>
          {activeESA.length === 0
            ? <div style={{opacity:0.2,fontSize:7,padding:"3px 5px"}}>NO ACTIVE INCIDENTS</div>
            : activeESA.map(e => (
                <div key={e.id} onClick={()=>setSel({t:"esa",d:e})}
                  style={{padding:"3px 5px",marginBottom:2,cursor:"pointer",
                    borderLeft:"2px solid "+(ESA_COLORS[e.type]||"#aaa")}}>
                  <div style={{color:ESA_COLORS[e.type]||"#aaa",fontSize:8}}>
                    {(ESA_ICONS[e.type]||"⚠")+" "+e.type+" - "+e.st}
                  </div>
                  <div style={{opacity:0.4,fontSize:7}}>{e.n}</div>
                </div>
              ))
          }

          <div style={{letterSpacing:3,marginTop:10,marginBottom:4,opacity:0.3,fontSize:7}}>CORRIDOR</div>
          <div style={{opacity:0.4,lineHeight:1.8,fontSize:8}}>
            12km | 14 stops | {tramState.length} LRVs<br/>
            Interchanges: GUN DKN CVC<br/>
            Rapid: R1 R8 R9<br/>
            CAMs: {CAMS.filter(c=>c.s==="ON").length}/{CAMS.length}
          </div>
        </div>

        {/* ── CENTER MAP ── */}
        <div style={{flex:1,position:"relative",display:"flex",justifyContent:"center",
          alignItems:"center",overflow:"hidden",background:th.terr}}>

          {/* Terrain texture + grid + roads */}
          <svg width="100%" height="100%" style={{position:"absolute",inset:0}}>
            {Array.from({length:120},(_,i) => {
              const x=noise(i*7.3)*MW, y2=noise(i*13.1)*MH;
              const w=6+noise(i*3.7)*25, h=4+noise(i*5.1)*18;
              return <rect key={"tr"+i} x={x} y={y2} width={w} height={h} fill={th.a}
                opacity={0.02+noise(i*2.1)*0.05} rx={1}
                transform={"rotate("+(noise(i*9)*40-20)+" "+(x+w/2)+" "+(y2+h/2)+")"}/>;
            })}
            {Array.from({length:40},(_,i) =>
              <line key={"gh"+i} x1={0} y1={i*20} x2="100%" y2={i*20}
                stroke={th.a} strokeWidth={0.3} opacity={0.035}/>)}
            {Array.from({length:55},(_,i) =>
              <line key={"gv"+i} x1={i*20} y1={0} x2={i*20} y2="100%"
                stroke={th.a} strokeWidth={0.3} opacity={0.035}/>)}
            {ROAD_LINES.map((road,ri) => {
              const pts = road.map(p=>toXY(p[0],p[1]));
              return <polyline key={"rd"+ri} points={pts.map(p=>p.x+","+p.y).join(" ")}
                fill="none" stroke={th.a} strokeWidth={1.2} opacity={0.06}/>;
            })}
          </svg>

          {/* Scope / radar overlay */}
          <svg width={MW} height={MH} viewBox={"0 0 "+MW+" "+MH}
            style={{position:"absolute",inset:0,pointerEvents:"none",zIndex:8}}>
            <defs>
              <radialGradient id="vig" cx="50%" cy="50%" r="50%">
                <stop offset="65%" stopColor="transparent"/>
                <stop offset="85%" stopColor="rgba(0,0,0,0.25)"/>
                <stop offset="100%" stopColor="rgba(0,0,0,0.65)"/>
              </radialGradient>
            </defs>
            <rect width={MW} height={MH} fill="url(#vig)"/>
            {[70,140,210,290].map((r,i) => (
              <g key={"rr"+i}>
                <circle cx={cx} cy={cy} r={r} fill="none" stroke={th.a}
                  strokeWidth={0.4} opacity={0.07} strokeDasharray="4,8"/>
                <text x={cx+r+3} y={cy-3} fill={th.a} fontSize={6} opacity={0.1}>{(i+1)*3+"km"}</text>
              </g>
            ))}
            <line x1={cx} y1={0} x2={cx} y2={MH} stroke={th.a} strokeWidth={0.3} opacity={0.08}/>
            <line x1={0} y1={cy} x2={MW} y2={cy} stroke={th.a} strokeWidth={0.3} opacity={0.08}/>
            {[-20,-10,10,20].map(d => (
              <g key={"tick"+d}>
                <line x1={cx+d} y1={cy-4} x2={cx+d} y2={cy+4} stroke={th.a} strokeWidth={0.5} opacity={0.12}/>
                <line x1={cx-4} y1={cy+d} x2={cx+4} y2={cy+d} stroke={th.a} strokeWidth={0.5} opacity={0.12}/>
              </g>
            ))}
            <line x1={cx} y1={cy}
              x2={cx+Math.cos(sweep*Math.PI/180)*300}
              y2={cy+Math.sin(sweep*Math.PI/180)*300}
              stroke={th.a} strokeWidth={0.8} opacity={0.06}/>
            {[["N",-90],["E",0],["S",90],["W",180]].map(([label,angle]) => {
              const rad = angle*Math.PI/180;
              return <text key={"cp"+label} x={cx+Math.cos(rad)*310} y={cy+Math.sin(rad)*310+3}
                fill={th.a} fontSize={9} fontWeight="bold" textAnchor="middle" opacity={0.2}>{label}</text>;
            })}
          </svg>

          {/* DATA LAYERS SVG — zoom/pan via viewBox */}
          <svg
            ref={mapSvgRef}
            width={MW} height={MH}
            viewBox={`${view.x.toFixed(1)} ${view.y.toFixed(1)} ${(MW/view.z).toFixed(1)} ${(MH/view.z).toFixed(1)}`}
            style={{position:"relative", zIndex:5, cursor:"grab"}}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onDoubleClick={resetView}
          >

            {/* Suburb zone labels — below route */}
            {ZONES.map((z,i) => {
              const p = toXY(z.lat, z.lng);
              return (
                <text key={"zn"+i} x={p.x} y={p.y} fill={th.a} opacity={0.10}
                  fontSize={7} letterSpacing={4}
                  fontFamily="'Courier New',monospace"
                  transform={`rotate(${z.rot} ${p.x} ${p.y})`}>
                  {z.label}
                </text>
              );
            })}

            {/* Rapid bus routes */}
            {ly.bus && RAPID_ROUTES.map(r => {
              const pts = r.lats.map((lat,i)=>toXY(lat,r.lngs[i]));
              const d = pts.map((p,i)=>(i===0?"M":"L")+p.x+","+p.y).join(" ");
              return (
                <g key={"br"+r.id}>
                  <path d={d} fill="none" stroke={r.color} strokeWidth={1.5}
                    opacity={0.15} strokeDasharray="6,3"/>
                  <text x={pts[0].x-5} y={pts[0].y-5} fill={r.color} fontSize={7}
                    fontWeight="bold" opacity={0.4}>{r.id}</text>
                </g>
              );
            })}

            {/* LR Route */}
            {ly.route && (
              <g>
                <path d={routeD} fill="none" stroke={th.a} strokeWidth={1} opacity={0.1}/>
                <path d={routeD} fill="none" stroke={th.a} strokeWidth={2.5} opacity={0.3}
                  strokeDasharray="6,4" strokeLinecap="round">
                  <animate attributeName="stroke-dashoffset" from="0" to="-20"
                    dur="1.5s" repeatCount="indefinite"/>
                </path>
              </g>
            )}

            {/* Road events — live data, falls back to static mock */}
            {ly.events && activeRoads.map(e => {
              const p = toXY(e.lat, e.lng);
              const co = e.sev==="MAJOR"?"#ff3333":e.sev==="MOD"?"#ffaa00":"#88ff44";
              const isSel = sel.t==="event" && D?.id===e.id;
              return (
                <g key={"ev"+e.id} onClick={()=>setSel({t:"event",d:e})} style={{cursor:"pointer"}}>
                  {isSel && <circle cx={p.x} cy={p.y} r={14} fill="none" stroke={co}
                    strokeWidth={1} opacity={0.4} strokeDasharray="3,2">
                    <animate attributeName="r" values="10;16;10" dur="1.5s" repeatCount="indefinite"/>
                  </circle>}
                  <polygon points={p.x+","+(p.y-7)+" "+(p.x+6)+","+(p.y+4)+" "+(p.x-6)+","+(p.y+4)}
                    fill={co+"22"} stroke={co} strokeWidth={1} opacity={0.7}/>
                  <text x={p.x} y={p.y+2} textAnchor="middle" fill={co} fontSize={6} fontWeight="bold">!</text>
                </g>
              );
            })}

            {/* SL Faults */}
            {ly.faults && FAULTS.map(f => {
              const p = toXY(f.lat, f.lng);
              const co = f.sev==="HIGH"?"#ff2222":"#ffaa00";
              return (
                <g key={"fl"+f.id} onClick={()=>setSel({t:"fault",d:f})} style={{cursor:"pointer"}}>
                  <circle cx={p.x} cy={p.y} r={6} fill={co+"11"} stroke={co} strokeWidth={0.8} opacity={0.5}>
                    <animate attributeName="opacity" values="0.3;0.7;0.3" dur="2s" repeatCount="indefinite"/>
                  </circle>
                  <circle cx={p.x} cy={p.y} r={3} fill={co} opacity={0.6}/>
                </g>
              );
            })}

            {/* ESA incidents — live data, falls back to static mock */}
            {ly.esa && activeESA.map(e => {
              const p = toXY(e.lat, e.lng);
              const co = ESA_COLORS[e.type];
              return (
                <g key={"esa"+e.id} onClick={()=>setSel({t:"esa",d:e})} style={{cursor:"pointer"}}>
                  <circle cx={p.x} cy={p.y} r={20} fill="none" stroke={co} strokeWidth={1.5} opacity={0.12}>
                    <animate attributeName="r" values="10;24;10" dur="1.2s" repeatCount="indefinite"/>
                    <animate attributeName="opacity" values="0.3;0;0.3" dur="1.2s" repeatCount="indefinite"/>
                  </circle>
                  <circle cx={p.x} cy={p.y} r={6} fill={co+"44"} stroke={co} strokeWidth={1.5}/>
                  <text x={p.x} y={p.y+4} textAnchor="middle" fontSize={10}>{ESA_ICONS[e.type]}</text>
                  <text x={p.x+12} y={p.y-6} fill={co} fontSize={6} fontWeight="bold" fontFamily="monospace">{e.type}</text>
                </g>
              );
            })}

            {/* Landmarks */}
            {ly.lm && LANDMARKS.map(l => {
              const p = toXY(l.lat, l.lng);
              return (
                <g key={"lm"+l.id}>
                  <text x={p.x} y={p.y+3} textAnchor="middle" fontSize={9} opacity={0.25}>{l.icon}</text>
                  <text x={p.x+8} y={p.y+3} fill={th.a} fontSize={6} opacity={0.15} fontFamily="monospace">{l.n}</text>
                </g>
              );
            })}

            {/* Stops — IX squares 14×14, regular circles, smart label positioning */}
            {ly.stops && STOPS.map(s => {
              const p = toXY(s.lat, s.lng);
              const isSel = sel.t==="stop" && D?.id===s.id;
              // Label side logic:
              // Flemington leg (1-8): all RIGHT — eastern corridor space is clear
              // SWN (9): LEFT — the route bends west here
              // Northbourne leg (10-14): alternate L/R to prevent vertical stacking
              const onRight = s.id <= 8
                ? true
                : s.id === 9
                  ? false
                  : s.id % 2 === 1; // DKN(10)=L, MCR(11)=R, IPA(12)=L, ELA(13)=R, ALG(14)=L
              const markerEdge = s.ix ? 8 : 4;
              const gap = 5;
              const lx = p.x + (onRight ? markerEdge + gap : -(markerEdge + gap));
              const anchor = onRight ? "start" : "end";
              // Tick line endpoint
              const tx1 = p.x + (onRight ? markerEdge : -markerEdge);
              const tx2 = p.x + (onRight ? markerEdge + gap - 1 : -(markerEdge + gap - 1));
              // Optional vertical offset to clear crowded track areas (e.g. GGN, MCK)
              const yo = s.labelYOff ?? 0;

              return (
                <g key={"st"+s.id} onClick={()=>setSel({t:"stop",d:s})} style={{cursor:"pointer"}}>
                  {isSel && <circle cx={p.x} cy={p.y} r={13} fill="none" stroke={th.a}
                    strokeWidth={0.8} opacity={0.35}>
                    <animate attributeName="r" values="9;15;9" dur="2s" repeatCount="indefinite"/>
                  </circle>}

                  {/* Marker */}
                  {s.ix ? (
                    <g>
                      <rect x={p.x-7} y={p.y-7} width={14} height={14}
                        fill={isSel?th.a+"44":"#00000099"} stroke={th.a}
                        strokeWidth={isSel?2:1.5} rx={1}/>
                      <text x={p.x} y={p.y+3} textAnchor="middle" fill={th.a}
                        fontSize={6} fontWeight="bold" opacity={0.9}>IX</text>
                    </g>
                  ) : (
                    <circle cx={p.x} cy={p.y} r={isSel?4:3}
                      fill={isSel?th.a:"#000"} stroke={th.a} strokeWidth={1.2}
                      opacity={isSel?1:0.65}/>
                  )}

                  {/* Connector tick — angled when label is offset */}
                  <line x1={tx1} y1={p.y} x2={tx2} y2={p.y+yo}
                    stroke={th.a} strokeWidth={0.6} opacity={isSel?0.5:0.18}/>

                  {/* Stop code — prominent identifier */}
                  <text x={lx} y={p.y+yo+2} textAnchor={anchor} fill={th.a}
                    fontSize={s.ix?8.5:7.5} fontWeight="bold" letterSpacing={1}
                    opacity={isSel?1:s.ix?0.85:0.65} fontFamily="monospace">
                    {s.code}
                  </text>

                  {/* Stop name — secondary, smaller */}
                  <text x={lx} y={p.y+yo+11} textAnchor={anchor} fill={th.a}
                    fontSize={s.ix?7:6} opacity={isSel?0.85:s.ix?0.55:0.38}
                    fontFamily="monospace">
                    {s.name.toUpperCase()}
                  </text>

                  {/* Bus interchange routes — tertiary info */}
                  {s.ix && s.busR.length > 0 &&
                    <text x={lx} y={p.y+yo+20} textAnchor={anchor} fill={th.a}
                      fontSize={5.5} opacity={0.28} fontFamily="monospace" letterSpacing={1}>
                      {s.busR.join("·")}
                    </text>}
                </g>
              );
            })}

            {/* Cameras */}
            {ly.cam && CAMS.map(cam => {
              const p = toXY(cam.lat, cam.lng);
              const co = cam.s==="ON"?"#00ccff":cam.s==="DG"?"#ffaa00":"#ff3333";
              const isSel = sel.t==="cam" && D?.id===cam.id;
              return (
                <g key={"cm"+cam.id} onClick={()=>setSel({t:"cam",d:cam})} style={{cursor:"pointer"}}>
                  <rect x={p.x-2} y={p.y-2} width={4} height={4} fill={co}
                    opacity={isSel?1:0.5} transform={"rotate(45 "+p.x+" "+p.y+")"}/>
                  {isSel && <circle cx={p.x} cy={p.y} r={9} fill="none" stroke={co}
                    strokeWidth={0.6} opacity={0.4} strokeDasharray="2,2"/>}
                </g>
              );
            })}

            {/* Trams — direction triangles with callout labels */}
            {ly.trams && displayTrams.map(t => {
              const p = toXY(t.lat, t.lng);
              const isSel = sel.t==="tram" && D?.id===t.id;
              const triS  = isSel ? 8 : 6;
              const arrow = t.dir === "SB" ? "▼" : "▲";
              const labelW = isSel ? 54 : 46;
              const labelH = isSel ? 24 : 20;
              // Pill sits above the triangle; connector line bridges the gap
              const pillX = p.x - labelW / 2;
              const pillY = p.y - triS - 6 - labelH;
              return (
                <g key={"tm"+t.id} onClick={()=>setSel({t:"tram",d:t})} style={{cursor:"pointer"}}>
                  {/* glow halo */}
                  <circle cx={p.x} cy={p.y} r={isSel?18:10} fill={t.c} opacity={0.05}>
                    <animate attributeName="r" values={isSel?"14;20;14":"8;12;8"}
                      dur="1.5s" repeatCount="indefinite"/>
                  </circle>
                  {/* direction triangle */}
                  <polygon
                    points={triPoints(p.x, p.y, t.dir, triS)}
                    fill={t.c}
                    stroke={isSel?"#fff":t.c}
                    strokeWidth={isSel?1.5:0.6}
                    style={{filter:`drop-shadow(0 0 3px ${t.c})`}}
                  />
                  {/* callout connector: pill bottom → triangle top */}
                  <line x1={p.x} y1={pillY+labelH} x2={p.x} y2={p.y-triS}
                    stroke={t.c} strokeWidth={0.5} opacity={isSel?0.5:0.3}
                    strokeDasharray={isSel?"none":"2,1"}/>
                  {/* label pill background */}
                  <rect x={pillX} y={pillY} width={labelW} height={labelH}
                    fill="#000a04" fillOpacity={0.90}
                    stroke={t.c} strokeWidth={isSel?1:0.5} rx={2}/>
                  {/* ID + direction arrow — primary */}
                  <text x={p.x} y={pillY+(isSel?10:9)} textAnchor="middle"
                    fill={t.c} fontSize={isSel?7.5:7} fontWeight="bold"
                    fontFamily="monospace" letterSpacing={0.5}>
                    {t.id+" "+arrow}
                  </text>
                  {/* speed + status — secondary */}
                  <text x={p.x} y={pillY+(isSel?19:16)} textAnchor="middle"
                    fill={t.c} fontSize={isSel?6:5.5} opacity={0.55}
                    fontFamily="monospace">
                    {t.speed+"km/h · "+(t.status==="STOPPED"?"STP":"MVG")}
                  </text>
                </g>
              );
            })}
          </svg>

          {/* HUD overlays */}
          <div style={{position:"absolute",top:8,left:"50%",transform:"translateX(-50%)",
            fontSize:7,opacity:0.12,zIndex:10,letterSpacing:5,color:th.a,textAlign:"center"}}>
            CLASSIFIED // CMET OPERATIONS
          </div>
          <div style={{position:"absolute",top:10,left:10,fontSize:7,opacity:0.15,zIndex:10,lineHeight:1.6,color:th.a}}>
            N NORTH<br/>GUN to CVC<br/>12km CORRIDOR
          </div>
          <div style={{position:"absolute",bottom:26,left:10,fontSize:6,opacity:0.15,zIndex:10,lineHeight:1.6,color:th.a}}>
            BEARING 180 TRUE<br/>ELEV 580m ASL<br/>MGRS 55HFA 931 856<br/>WGS84 1:25000
            {weatherState && <>
              <br/>────────────<br/>
              {"WX "+WEATHER_SYMBOL[weatherState.condition]}<br/>
              {weatherState.temp+"°C // "+weatherState.wind+"km/h"}<br/>
              {"RH "+weatherState.humidity+"%"}
            </>}
          </div>
          <div style={{position:"absolute",bottom:26,right:10,fontSize:6,opacity:0.15,zIndex:10,textAlign:"right",lineHeight:1.6,color:th.a}}>
            {"SENSOR: "+vm}<br/>REFRESH: 700ms<br/>FEEDS: 7 ACTIVE<br/>{"FRAME: "+fr.current}<br/>UPLINK: NOMINAL
          </div>
          {/* Zoom controls */}
          <div style={{position:"absolute",bottom:26,left:"50%",transform:"translateX(-50%)",
            zIndex:10,display:"flex",alignItems:"center",gap:4}}>
            <div onClick={()=>setView(p=>({...p,z:Math.max(1,p.z/1.3)}))}
              style={{width:18,height:18,border:"1px solid "+th.a+"30",color:th.a,
                display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",
                fontSize:14,opacity:0.4,background:th.bg,userSelect:"none",lineHeight:1}}>−</div>
            <div onDoubleClick={resetView}
              style={{fontSize:7,opacity:0.3,color:th.a,letterSpacing:2,
                border:"1px solid "+th.a+"18",padding:"2px 5px",background:th.bg,
                minWidth:32,textAlign:"center",cursor:"default"}}>
              {view.z.toFixed(1)}×
            </div>
            <div onClick={()=>setView(p=>({...p,z:Math.min(6,p.z*1.3)}))}
              style={{width:18,height:18,border:"1px solid "+th.a+"30",color:th.a,
                display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",
                fontSize:14,opacity:0.4,background:th.bg,userSelect:"none",lineHeight:1}}>+</div>
          </div>
        </div>

        {/* ── RIGHT PANEL ── */}
        <div style={{width:220,borderLeft:"1px solid "+th.a+"15",background:th.bg,
          display:"flex",flexDirection:"column",fontSize:8}}>
          <div style={{display:"flex",borderBottom:"1px solid "+th.a+"12"}}>
            {["intel","log"].map(tabName => (
              <div key={tabName} onClick={()=>setTab(tabName)}
                style={{flex:1,padding:"5px 0",textAlign:"center",cursor:"pointer",
                  letterSpacing:2,fontSize:7,
                  background:tab===tabName?th.a+"0a":"transparent",
                  borderBottom:tab===tabName?"2px solid "+th.a:"2px solid transparent",
                  opacity:tab===tabName?1:0.3}}>
                {tabName.toUpperCase()}
              </div>
            ))}
          </div>

          <div style={{flex:1,overflowY:"auto",padding:8}}>
            {tab==="intel" && (
              <div>
                <div style={{letterSpacing:2,marginBottom:5,opacity:0.3,fontSize:7}}>
                  {sel.t?sel.t.toUpperCase()+" INTEL":"AWAITING TARGET"}
                </div>

                {/* ── TRAM INTEL ── */}
                {sel.t==="tram" && D && (
                  <div>
                    {/* LRV photo */}
                    {LRV_IMAGES[D.id] ? (
                      <div style={{marginBottom:8,borderRadius:2,overflow:"hidden",
                        border:"1px solid "+D.c+"40",boxShadow:"0 0 8px "+D.c+"20"}}>
                        <img src={LRV_IMAGES[D.id]} alt={D.id}
                          style={{width:"100%",display:"block",objectFit:"cover",maxHeight:110}}/>
                        <div style={{background:"#000a",padding:"2px 5px",fontSize:6,
                          letterSpacing:2,color:D.c,opacity:0.7}}>
                          {D.id} // CMET FLEET
                        </div>
                      </div>
                    ) : (
                      <div style={{marginBottom:8,height:70,border:"1px solid "+D.c+"25",
                        borderRadius:2,display:"flex",flexDirection:"column",
                        alignItems:"center",justifyContent:"center",gap:3,
                        background:"#00100610"}}>
                        <span style={{fontSize:7,opacity:0.2,letterSpacing:3}}>NO IMAGE</span>
                        <span style={{fontSize:6,opacity:0.12,letterSpacing:2}}>// CLASSIFIED</span>
                      </div>
                    )}
                    <div style={{fontSize:14,fontWeight:"bold",color:D.c,marginBottom:5}}>{D.id}</div>
                    <InfoRow label="STATUS"  value={D.status}/>
                    <InfoRow label="SPEED"   value={Math.round(D.speed)+" km/h"}/>
                    <InfoRow label="DIR"     value={D.dir==="SB"?"SOUTHBOUND":"NORTHBOUND"}/>
                    <InfoRow label="BEARING" value={Math.round(D.bearing)+"°"}/>
                    <InfoRow label="NEAR"    value={"Stop "+D.near}/>
                    <InfoRow label="POS"     value={D.rawLat?.toFixed(4)+"S "+D.rawLng?.toFixed(4)+"E"}/>

                    {D.seg!=null && <>
                      <div style={{marginTop:8,letterSpacing:2,fontSize:7,opacity:0.3,marginBottom:3}}>
                        NEXT STOPS
                      </div>
                      {calcUpcomingStops(D.seg, D.routeT, D.dir).slice(0,6).map(({stop,etaSec}) => (
                        <div key={stop.id} style={{display:"flex",justifyContent:"space-between",
                          padding:"2px 0",borderBottom:"1px solid "+th.a+"08"}}>
                          <span style={{opacity:stop.ix?1:0.6,fontSize:7}}>{stop.name}</span>
                          <span style={{color:etaSec<120?"#ffaa00":th.a,fontSize:7}}>{fmtEta(etaSec)}</span>
                        </div>
                      ))}
                    </>}
                  </div>
                )}

                {/* ── STOP INTEL ── */}
                {sel.t==="stop" && D && (
                  <div>
                    {/* Platform / stop map photo */}
                    {STOP_IMAGES[D.id] && (
                      <div style={{marginBottom:8,borderRadius:2,overflow:"hidden",
                        border:"1px solid "+th.a+"30",boxShadow:"0 0 8px "+th.a+"10"}}>
                        <img src={STOP_IMAGES[D.id]} alt={D.name}
                          style={{width:"100%",display:"block",objectFit:"cover",maxHeight:120}}/>
                        <div style={{background:"#000a",padding:"2px 5px",fontSize:6,
                          letterSpacing:2,color:th.a,opacity:0.5}}>
                          {D.code} // PLATFORM VIEW
                        </div>
                      </div>
                    )}
                    <div style={{fontSize:13,fontWeight:"bold",marginBottom:5}}>{D.name.toUpperCase()}</div>
                    {D.ix && (
                      <div style={{background:th.a+"08",border:"1px solid "+th.a+"15",
                        padding:4,marginBottom:6,borderRadius:2,fontSize:7}}>
                        <div style={{opacity:0.5,marginBottom:2}}>MODE INTERCHANGE</div>
                        <div>{"Rapid: "+D.busR.join(", ")}</div>
                        <div style={{opacity:0.5}}>{"Local: "+D.busL.join(", ")}</div>
                      </div>
                    )}
                    <InfoRow label="ZONE"        value={D.z}/>
                    <InfoRow label="STOP"        value={D.id+"/14"}/>
                    <InfoRow label="INTERCHANGE" value={D.ix?"YES":"NO"}/>
                    <InfoRow label="POS"         value={D.lat.toFixed(4)+"S "+D.lng.toFixed(4)+"E"}/>

                    {/* Next arrivals */}
                    {(() => {
                      const {sb,nb} = nextArrivalsAt(D.id, displayTrams);
                      return (
                        <div style={{marginTop:8}}>
                          <div style={{letterSpacing:2,fontSize:7,opacity:0.3,marginBottom:4}}>NEXT ARRIVALS</div>
                          {sb && (
                            <div style={{display:"flex",justifyContent:"space-between",
                              padding:"3px 0",borderBottom:"1px solid "+th.a+"08"}}>
                              <span><span style={{opacity:0.4}}>SB </span>
                                <span style={{color:sb.tram.c}}>{sb.tram.id}</span></span>
                              <span style={{color:sb.tram.c}}>~{fmtEta(sb.etaSec)}</span>
                            </div>
                          )}
                          {nb && (
                            <div style={{display:"flex",justifyContent:"space-between",
                              padding:"3px 0",borderBottom:"1px solid "+th.a+"08"}}>
                              <span><span style={{opacity:0.4}}>NB </span>
                                <span style={{color:nb.tram.c}}>{nb.tram.id}</span></span>
                              <span style={{color:nb.tram.c}}>~{fmtEta(nb.etaSec)}</span>
                            </div>
                          )}
                          {!sb && !nb && (
                            <div style={{opacity:0.2,fontSize:7}}>No trams currently in service</div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* ── ESA INTEL ── */}
                {sel.t==="esa" && D && (
                  <div>
                    <div style={{fontSize:13,fontWeight:"bold",color:ESA_COLORS[D.type],marginBottom:5}}>
                      {ESA_ICONS[D.type]+" "+D.type+" INCIDENT"}
                    </div>
                    <InfoRow label="DETAIL"  value={D.n}/>
                    <InfoRow label="STATUS"  value={D.st}/>
                    <InfoRow label="SERVICE" value={D.type==="FIRE"?"ACT Fire & Rescue":D.type==="AMBO"?"ACT Ambulance":"ACT SES"}/>
                    <InfoRow label="POS"     value={D.lat.toFixed(4)+"S"}/>
                    <InfoRow label="SOURCE"  value="ESA GeoRSS"/>
                    <div style={{marginTop:6,padding:5,background:ESA_COLORS[D.type]+"08",
                      border:"1px solid "+ESA_COLORS[D.type]+"22",borderRadius:2,fontSize:7,lineHeight:1.6}}>
                      Warning: Active emergency within LR corridor. CMET control notified.
                      LRV drivers alerted via radio.
                    </div>
                  </div>
                )}

                {/* ── CAMERA INTEL ── */}
                {sel.t==="cam" && D && (
                  <div>
                    <div style={{fontSize:11,fontWeight:"bold",marginBottom:5}}>{D.n.toUpperCase()}</div>
                    <div style={{width:"100%",height:100,marginBottom:6,borderRadius:2,
                      background:"linear-gradient(135deg,"+th.terr+",#0a0a0a,#111)",
                      border:"1px solid "+th.a+"18",display:"flex",flexDirection:"column",
                      alignItems:"center",justifyContent:"center",position:"relative",overflow:"hidden"}}>
                      {D.s==="OFF"
                        ? <div style={{color:"#ff3333",fontWeight:"bold",letterSpacing:3,fontSize:9}}>NO SIGNAL</div>
                        : <div style={{textAlign:"center"}}>
                            <div style={{fontSize:8,opacity:0.4}}>LIVE FEED</div>
                            <div style={{fontSize:18,marginTop:4,opacity:0.12}}>cam</div>
                            <div style={{fontSize:6,opacity:0.25,marginTop:8}}>
                              {D.id+" | "+time.toLocaleTimeString("en-AU",{hour12:false})}
                            </div>
                          </div>}
                    </div>
                    <InfoRow label="STATUS" value={D.s==="ON"?"ONLINE":D.s==="DG"?"DEGRADED":"OFFLINE"}
                      color={D.s==="OFF"?"#ff3333":D.s==="DG"?"#ffaa00":"#00ff88"}/>
                  </div>
                )}

                {/* ── FAULT INTEL ── */}
                {sel.t==="fault" && D && (
                  <div>
                    <div style={{fontSize:11,fontWeight:"bold",
                      color:D.sev==="HIGH"?"#ff3333":"#ffaa00",marginBottom:5}}>STREETLIGHT FAULT</div>
                    <InfoRow label="LOCATION" value={D.loc}/>
                    <InfoRow label="SEVERITY" value={D.sev} color={D.sev==="HIGH"?"#ff3333":"#ffaa00"}/>
                    <InfoRow label="STATUS"   value="INVESTIGATING"/>
                    <InfoRow label="SOURCE"   value="TCCS / Fix My Street"/>
                  </div>
                )}

                {/* ── EVENT INTEL ── */}
                {sel.t==="event" && D && (
                  <div>
                    <div style={{fontSize:11,fontWeight:"bold",
                      color:D.sev==="MAJOR"?"#ff3333":"#ffaa00",marginBottom:5}}>
                      {D.n.toUpperCase()}
                    </div>
                    <InfoRow label="TYPE"     value={D.t}/>
                    <InfoRow label="SEVERITY" value={D.sev} color={D.sev==="MAJOR"?"#ff3333":"#ffaa00"}/>
                    <InfoRow label="SOURCE"   value="Built for CBR"/>
                  </div>
                )}

                {!sel.t && (
                  <div style={{opacity:0.2,lineHeight:1.8,fontStyle:"italic",fontSize:8}}>
                    Select target on tactical map for intelligence briefing.
                  </div>
                )}
              </div>
            )}

            {tab==="log" && logs.map(a => {
              const borderColor = a.t==="error"?"#ff3333":a.t==="warn"?"#ffaa00":a.t==="ok"?"#00ff88":"#00ccff";
              return (
                <div key={a.id} style={{padding:"3px 5px",marginBottom:2,fontSize:7,
                  lineHeight:1.5,borderLeft:"2px solid "+borderColor,opacity:0.6}}>
                  <span style={{opacity:0.3}}>{a.time.toLocaleTimeString("en-AU",{hour12:false})} </span>
                  {a.m}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* NEWS TICKER */}
      {newsState.length > 0 && (
        <div style={{position:"fixed",bottom:20,left:0,right:0,height:22,
          borderTop:"1px solid "+th.a+"18",borderBottom:"1px solid "+th.a+"18",
          background:th.bg,display:"flex",alignItems:"center",
          overflow:"hidden",zIndex:19,fontSize:8}}>
          {/* Static label */}
          <div style={{flexShrink:0,padding:"0 8px",borderRight:"1px solid "+th.a+"25",
            letterSpacing:3,opacity:0.4,fontSize:7,height:"100%",
            display:"flex",alignItems:"center"}}>
            NEWS
          </div>
          {/* Scrolling content */}
          <div style={{flex:1,overflow:"hidden",position:"relative",height:"100%"}}>
            <div
              key={newsState.length}
              onClick={()=>setTickerPaused(p=>!p)}
              style={{
                whiteSpace:"nowrap",position:"absolute",top:"50%",transform:"translateY(-50%)",
                animation: tickerPaused ? "none" : `ticker ${newsState.length * 8}s linear infinite`,
                cursor:"pointer", opacity:0.4, letterSpacing:1,
              }}>
              {newsState.map(n => (
                <span key={n.title} style={{marginRight:32}}>
                  <span style={{opacity:0.5}}>{n.source+" // "}</span>{n.title}
                  <span style={{opacity:0.25}}>{" ///"}</span>
                </span>
              ))}
            </div>
          </div>
          {tickerPaused && (
            <div style={{flexShrink:0,padding:"0 6px",fontSize:6,opacity:0.3,letterSpacing:2}}>
              PAUSED
            </div>
          )}
        </div>
      )}

      {/* BOTTOM BAR */}
      <div style={{position:"fixed",bottom:0,left:0,right:0,borderTop:"1px solid "+th.a+"15",
        padding:"2px 10px",display:"flex",justifyContent:"space-between",
        background:th.bg,fontSize:7,opacity:0.4,zIndex:20}}>
        <span>OPS CENTRE MAWSON ACT</span>
        <span>GTFS-R | SODA | ESA | ACTmapi | Waze | BuiltForCBR</span>
        <span>{vm+" | "+lc+"/9"}</span>
      </div>

      <style>{
        "@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}" +
        "@keyframes ticker{0%{transform:translateY(-50%) translateX(100vw)}100%{transform:translateY(-50%) translateX(-100%)}}" +
        "::-webkit-scrollbar{width:3px}" +
        "::-webkit-scrollbar-thumb{background:"+th.a+"33;border-radius:2px}" +
        "::-webkit-scrollbar-track{background:transparent}"
      }</style>
    </div>
  );
}
