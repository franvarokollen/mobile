// ─── DATE NAVIGATION ───────────────────────────────────────

function updateDateDisplay() {
  var d = new Date(currentDate + 'T12:00:00');
  var days   = t('date.days').split(',');
  var months = t('date.months').split(',');
  var dayEl = document.getElementById('dateDay');
  var numEl = document.getElementById('dateDayNum');
  var monEl = document.getElementById('dateMonth');
  var wkEl  = document.getElementById('dateWeekLabel');
  if (dayEl) dayEl.textContent = days[d.getDay()];
  if (numEl) numEl.textContent = d.getDate();
  if (monEl) monEl.textContent = months[d.getMonth()];
  // ISO week
  var tmp = new Date(d); tmp.setHours(0, 0, 0, 0); tmp.setDate(tmp.getDate() + 3 - (tmp.getDay() + 6) % 7);
  var w1 = new Date(tmp.getFullYear(), 0, 4);
  var wk = 1 + Math.round(((tmp.getTime() - w1.getTime()) / 86400000 - 3 + (w1.getDay() + 6) % 7) / 7);
  if (wkEl) wkEl.textContent = t('date.today_week', { wk: wk });
  // Tab active states
  ['navDash', 'navTrends', 'navStudents', 'navReport'].forEach(function(id) {
    var el = document.getElementById(id); if (el) el.classList.remove('tab-active');
  });
  var activeMap = { dash: 'navDash', trends: 'navTrends', students: 'navStudents', report: 'navReport' };
  var activeEl = document.getElementById(activeMap[currentView] || 'navDash');
  if (activeEl) activeEl.classList.add('tab-active');
}

function changeDate(delta) {
  var d = new Date(currentDate + 'T12:00:00');
  d.setDate(d.getDate() + delta);
  // Skip weekends: Saturday → Friday (back) or Monday (forward); Sunday → Friday (back) or Monday (forward)
  var dow = d.getDay();
  if (dow === 6) d.setDate(d.getDate() + (delta > 0 ? 2 : -1)); // Sat → Mon or Fri
  if (dow === 0) d.setDate(d.getDate() + (delta > 0 ? 1 : -2)); // Sun → Mon or Fri
  var y = d.getFullYear(), mo = String(d.getMonth() + 1).padStart(2, '0'), dy = String(d.getDate()).padStart(2, '0');
  currentDate = y + '-' + mo + '-' + dy;
  var dp = document.getElementById('datePicker');
  if (dp) dp.value = currentDate;
  updateDateDisplay();
  pollServer();
  renderDash();
}

function getISOWeek(d) {
  var date = new Date(d);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
  var week1 = new Date(date.getFullYear(), 0, 4);
  return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
}

function weekToMonday(year, week) {
  var jan4 = new Date(year, 0, 4);
  var startW1 = new Date(jan4);
  startW1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7));
  var mon = new Date(startW1.getTime() + (week - 1) * 7 * 86400000);
  return mon;
}

function goBack() {
  if (viewHistory.length < 2) return;
  viewHistory.pop();
  const prev = viewHistory.pop();
  switchView(prev);
}
