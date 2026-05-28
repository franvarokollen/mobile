// ─── STATE ─────────────────────────────────────────────────

// Auth state
let currentRole = 'staff';
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
let statusFilter = 'ALL';
let trendClass = 'ALL';
let trendPeriod = 'all';

// Extra dirty flag (blocks overwrite for 10s after any change)
let _extraDirtyUntil = 0;

// Global barcode capture buffers
let globalBuf = '';
let globalTimer = null;

// Toast timer
let toastTimer = null;

// View navigation history
let viewHistory = [];

// EOD reset tracking
let _eodCheckedToday = localStorage.getItem('phc_eod_checked') === new Date().toISOString().slice(0, 10);
