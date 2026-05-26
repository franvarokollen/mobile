// ─── STATE ─────────────────────────────────────────────────

// Auth / PIN state
let currentRole = null; // 'view'|'staff'|'guardian'
let pinMode = null;
let pinBuf = '';
let inactivityTimer = null;
let warningTimer = null;
let countdownInterval = null;
let warningActive = false;

// Server is always available in the online version (Vercel API routes)
const SERVER = true;
let syncInterval = null;
var currentView = 'dash';
let lastSyncTime = null;
let serverOnline = false;
let pollCount = 0;

// Date / filter state
let currentDate = (function(){ return new Date().toISOString().slice(0, 10); })();
let currentClass = 'ALL';
let currentStudentClass = 'ALL';
let statusFilter = 'ALL'; // ALL | out | late | ok
let trendClass = 'ALL';
let trendPeriod = 'week';

// Extra dirty flag (blocks overwrite for 10s after any change)
let _extraDirtyUntil = 0;

// Global barcode capture buffers
let globalBuf = '';
let globalTimer = null;

// Toast timer
let toastTimer = null;

// View navigation history
let viewHistory = [];
