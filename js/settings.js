// ─── SETTINGS ──────────────────────────────────────────────

var _settings = {};

function getSettings() { return _settings; }

async function fetchSettingsFromServer() {
  try {
    const r = await authFetch('/api/settings');
    if (!r.ok) return;
    const d = await r.json();
    if (d && typeof d === 'object') {
      _settings = d;
      applySettings();
    }
  } catch(e) {}
}

async function saveSettingsToServer(data) {
  try {
    await authFetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
  } catch(e) {}
}

// ── Curated emoji set for flag picker ────────────────────────
const EMOJI_PICKS = [
  // Alerts & priority
  '⭐','🔴','🟡','🟢','🚨','⚠️',
  // Health & absence
  '🏠','🤒','💊','🏥','🩺','🛏️',
  // School & work
  '📚','🎒','📝','📋','📌','✏️',
  // Communication
  '📞','📱','💬','📧','🔔','🔕',
  // People & interaction
  '✋','🙋','👍','👪','❤️','😴',
  // Activities
  '🏃','🎵','🎨','🚌','🚗','⚽',
  // Symbols
  '✅','❌','💡','🔒','⏰','⚡',
];

// ── Default keys/colors (labels come from t() so they respect language) ─────
const DEFAULT_STATUSES = [
  { key: 'out',  color: '#ef4444' },
  { key: 'late', color: '#f59e0b' }
];
const DEFAULT_FLAGS = [
  { key: 'starred',   emoji: '⭐', activeColor: '#f59e0b', cardColor: '' },
  { key: 'athome',    emoji: '🏠', activeColor: '#6366f1', cardColor: '' },
  { key: 'keepphone', emoji: '📱', activeColor: '#0ea5e9', cardColor: '' }
];

const _defaultStatusLabels = { out: 'default.status.out', late: 'default.status.late' };
const _defaultFlagLabels   = { starred: 'default.flag.starred', athome: 'default.flag.athome', keepphone: 'default.flag.keepphone' };

function getStatuses() {
  const base = (_settings.statuses && _settings.statuses.length) ? _settings.statuses : DEFAULT_STATUSES;
  return base.map(st => ({ ...st, label: _defaultStatusLabels[st.key] ? t(_defaultStatusLabels[st.key]) : st.label }));
}
function getFlags() {
  const base = (_settings.flags && _settings.flags.length) ? _settings.flags : DEFAULT_FLAGS;
  return base.map(fl => ({ ...fl, label: _defaultFlagLabels[fl.key] ? t(_defaultFlagLabels[fl.key]) : fl.label }));
}

function applySettings() {
  const generated = buildClassList(_settings);
  if (generated.length > 0) CLASSES = generated;
  const sn = document.getElementById('sidebarSchoolName');
  if (sn && _settings.schoolName) sn.textContent = _settings.schoolName;
}

function buildClassList(s) {
  const override = (s.classOverride || '').trim();
  if (override) return override.split(',').map(c => c.trim()).filter(Boolean);

  const yearSections = s.yearSections || {};
  const years = Object.keys(yearSections).filter(y => yearSections[y] > 0);
  if (!years.length) return [];

  const ALL_YEARS = ['F','1','2','3','4','5','6','7','8','9'];
  years.sort((a, b) => ALL_YEARS.indexOf(a) - ALL_YEARS.indexOf(b));

  const format = s.classFormat || 'letter';
  const result = [];
  years.forEach(y => {
    const count = parseInt(yearSections[y]) || 1;
    const suffixes = generateSuffixes(format, count);
    suffixes.forEach(sfx => {
      if (!sfx) result.push(String(y));
      else if (format === 'dot') result.push(y + '.' + sfx);
      else result.push(y + sfx);
    });
  });
  return result;
}

function generateSuffixes(format, count) {
  if (format === 'none') return [''];
  if (format === 'letter') return 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.slice(0, count).split('');
  if (format === 'number' || format === 'dot') return Array.from({length: count}, (_, i) => String(i + 1));
  return [''];
}

function renderSettings() {
  const s = _settings;
  const yearSections = s.yearSections || {};
  const format = s.classFormat || 'letter';
  const ALL_YEARS = ['F','1','2','3','4','5','6','7','8','9'];

  const fmtOpt = (val, label) =>
    `<label style="display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border:0.5px solid var(--border2);border-radius:20px;cursor:pointer;font-size:13px;background:${format===val?'var(--text)':'var(--surface)'};color:${format===val?'var(--bg)':'var(--text2)'}">
      <input type="radio" name="classFormat" value="${val}" ${format===val?'checked':''} onchange="settingsFormatChange(this)" style="display:none">${label}
    </label>`;

  const sectionSelect = (y) => {
    const cur = yearSections[y] || 0;
    const active = cur > 0;
    return `<div style="display:flex;align-items:center;gap:6px;padding:4px 8px;background:${active?'var(--surface2)':'transparent'};border:0.5px solid ${active?'var(--border2)':'transparent'};border-radius:6px;transition:all 0.15s" id="yearRow_${y}">
      <label style="display:flex;align-items:center;gap:5px;cursor:pointer;min-width:54px">
        <input type="checkbox" value="${y}" ${active?'checked':''} onchange="settingsYearToggle(this,'${y}')" style="width:14px;height:14px;cursor:pointer;flex-shrink:0">
        <span style="font-size:12px;font-weight:600;color:${active?'var(--text)':'var(--text3)'}">${t('settings.year')} ${y}</span>
      </label>
      <div style="display:flex;align-items:center;gap:3px;${active?'':'opacity:0.25;pointer-events:none'}" id="yearControls_${y}">
        ${[1,2,3,4,5,6,7,8].map(n =>
          `<button onclick="settingsSetSections('${y}',${n})" id="sec_${y}_${n}"
            style="width:22px;height:22px;border-radius:4px;border:0.5px solid var(--border2);background:${cur===n?'var(--text)':'var(--surface)'};color:${cur===n?'var(--bg)':'var(--text3)'};font-size:11px;font-weight:600;cursor:pointer;line-height:1">${n}</button>`
        ).join('')}
      </div>
    </div>`;
  };

  const preview = buildClassList(s);

  const container = document.getElementById('viewSettings');
  if (!container) return;
  container.innerHTML = `
    <div class="settings-layout">

      <!-- Left nav -->
      <nav class="settings-nav">
        <div class="settings-nav-title">${t('settings.title')}</div>
        <button class="settings-nav-item active" onclick="switchSettingsSection('school',this)">${t('settings.section_school')}</button>
        <button class="settings-nav-item" onclick="switchSettingsSection('classes',this)">${t('settings.section_classes')}</button>
        <button class="settings-nav-item" onclick="switchSettingsSection('statuses',this)">${t('settings.section_statuses')}</button>
        <button class="settings-nav-item" onclick="switchSettingsSection('automation',this)">${t('settings.section_automation')}</button>
        <button class="settings-nav-item" onclick="switchSettingsSection('data',this)">${t('settings.section_data')}</button>
        ${getMyRole() === 'admin' ? `
          <button class="settings-nav-item" onclick="switchSettingsSection('notifications',this)">${t('settings.section_notifications')}</button>
          <button class="settings-nav-item" onclick="switchSettingsSection('users',this);settingsLoadUsers();settingsLoadInvites()">${t('settings.section_users')}</button>
        ` : ''}
      </nav>

      <!-- Right content -->
      <div class="settings-content">

        <!-- School section -->
        <div class="settings-section active" id="settingsSec_school">
          <div class="settings-card">
            <div class="settings-card-title">${t('settings.section_school')}</div>
            <div class="settings-card-sub">${t('settings.school_sub')}</div>
            <div class="settings-field">
              <label>${t('settings.school_name')}</label>
              <input id="setting_schoolName" value="${escHtml(s.schoolName || '')}" placeholder="${t('settings.school_ph')}">
              <div class="hint">${t('settings.school_hint')}</div>
            </div>

            <div class="settings-field" style="margin-top:16px;padding-top:16px;border-top:0.5px solid var(--border)">
              <label style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:8px;display:block">${t('settings.studentnum_title')}</label>
              <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;margin-bottom:10px">
                <input type="checkbox" id="setting_studentNumEnabled" ${s.studentNumEnabled ? 'checked' : ''} style="width:16px;height:16px;cursor:pointer">
                ${t('settings.studentnum_enable')}
              </label>
              <label style="font-size:12px;color:var(--text2);margin-bottom:3px;display:block">${t('settings.studentnum_label')}</label>
              <input id="setting_studentNumLabel" value="${escHtml(s.studentNumLabel || '')}" placeholder="${t('settings.studentnum_label_ph')}" style="max-width:260px">
            </div>

            <div class="settings-save-bar">
              <button class="btn" onclick="saveSettings()" style="padding:9px 22px;font-size:14px;font-weight:600;background:var(--text);color:var(--bg);border-color:var(--text)">
                <i class="ti ti-device-floppy"></i>${t('settings.save')}
              </button>
            </div>
          </div>
        </div>

        <!-- Classes section -->
        <div class="settings-section" id="settingsSec_classes">
          <div class="settings-card">
            <div class="settings-card-title">${t('settings.section_classes')}</div>
            <div class="settings-card-sub">${t('settings.classes_sub')}</div>

            <!-- Format pills — full width -->
            <div class="settings-field" style="margin-bottom:12px">
              <label style="margin-bottom:6px">${t('settings.class_format')}</label>
              <div style="display:flex;flex-wrap:wrap;gap:6px">
                ${fmtOpt('letter','5A, 5B, 5C')}
                ${fmtOpt('dot','5.1, 5.2, 5.3')}
                ${fmtOpt('number','51, 52, 53')}
                ${fmtOpt('none', t('settings.fmt_none'))}
              </div>
            </div>

            <!-- Two-column: year list left, preview+custom right -->
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;align-items:start">

              <!-- Left: year groups -->
              <div>
                <div style="font-size:12px;font-weight:600;color:var(--text);margin-bottom:4px">${t('settings.year_groups')}</div>
                <div style="font-size:11px;color:var(--text3);margin-bottom:8px">${t('settings.year_hint')}</div>
                <div style="display:flex;flex-direction:column;gap:2px">
                  ${ALL_YEARS.map(y => sectionSelect(y)).join('')}
                </div>
              </div>

              <!-- Right: preview + custom override -->
              <div style="display:flex;flex-direction:column;gap:12px">
                <div>
                  <div style="font-size:12px;font-weight:600;color:var(--text);margin-bottom:6px">${t('settings.preview')}</div>
                  <div id="classPreview" style="display:flex;flex-wrap:wrap;gap:4px;padding:10px;background:var(--surface2);border-radius:var(--radius);border:0.5px solid var(--border);min-height:48px">
                    ${preview.length ? preview.map(c => `<span style="padding:2px 8px;background:var(--surface);border:0.5px solid var(--border2);border-radius:10px;font-size:12px;font-weight:500">${c}</span>`).join('') : `<span style="font-size:12px;color:var(--text3)">${t('settings.preview_empty')}</span>`}
                  </div>
                </div>
                <div>
                  <div style="font-size:12px;font-weight:600;color:var(--text);margin-bottom:4px">${t('settings.custom')} <span style="font-weight:400;color:var(--text3);font-size:11px">${t('settings.custom_sub')}</span></div>
                  <input id="setting_classOverride" value="${escHtml(s.classOverride || '')}" placeholder="${t('settings.custom_ph')}" oninput="settingsUpdatePreview()" style="width:100%">
                  <div style="font-size:11px;color:var(--text3);margin-top:4px">${t('settings.custom_hint')}</div>
                </div>
              </div>

            </div>

            <div class="settings-save-bar">
              <button class="btn" onclick="saveSettings()" style="padding:9px 22px;font-size:14px;font-weight:600;background:var(--text);color:var(--bg);border-color:var(--text)">
                <i class="ti ti-device-floppy"></i>${t('settings.save')}
              </button>
            </div>
          </div>
        </div>

        <!-- Statuses & Flags section -->
        <div class="settings-section" id="settingsSec_statuses">
          <div class="settings-card">
            <div class="settings-card-title">${t('settings.section_statuses')}</div>
            <div class="settings-card-sub">${t('settings.statuses_sub')}</div>
            <div class="settings-row">
              <div>
                <div style="font-size:13px;font-weight:600;margin-bottom:8px">${t('settings.statuses')}</div>
                <div style="font-size:12px;color:var(--text3);margin-bottom:10px">${t('settings.statuses_hint')}</div>
                <div id="statusList" style="display:flex;flex-direction:column;gap:8px">
                  ${getStatuses().map((st, i) => renderStatusRow(st, i)).join('')}
                </div>
                <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">
                  <button class="btn" onclick="settingsAddStatus()" style="font-size:12px">
                    <i class="ti ti-plus"></i>${t('settings.add_status')}
                  </button>
                  <button class="btn" onclick="settingsAddConfirmed()" style="font-size:12px;color:#16a34a;border-color:#86efac">
                    ${t('settings.add_confirmed')}
                  </button>
                </div>
              </div>
              <div>
                <div style="font-size:13px;font-weight:600;margin-bottom:8px">${t('settings.flags')}</div>
                <div style="font-size:12px;color:var(--text3);margin-bottom:10px">${t('settings.flags_hint')}</div>
                <div id="flagList" style="display:flex;flex-direction:column;gap:8px">
                  ${getFlags().map((fl, i) => renderFlagRow(fl, i)).join('')}
                </div>
                <button class="btn" onclick="settingsAddFlag()" style="margin-top:8px;font-size:12px">
                  <i class="ti ti-plus"></i>${t('settings.add_flag')}
                </button>
              </div>
            </div>
            <div class="settings-save-bar">
              <button class="btn" onclick="saveSettings()" style="padding:9px 22px;font-size:14px;font-weight:600;background:var(--text);color:var(--bg);border-color:var(--text)">
                <i class="ti ti-device-floppy"></i>${t('settings.save')}
              </button>
            </div>
          </div>
        </div>

        <!-- Automation section -->
        <div class="settings-section" id="settingsSec_automation">
          <div class="settings-card">
            <div class="settings-card-title">${t('settings.section_automation')}</div>
            <div class="settings-card-sub">${t('settings.automation_sub')}</div>
            <div class="settings-row">
              <div>
                <div style="font-size:13px;font-weight:600;margin-bottom:12px">${t('eod.section')}</div>
                <div style="display:flex;flex-direction:column;gap:12px">
                  <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px">
                    <input type="checkbox" id="setting_eodEnabled" ${s.eodEnabled ? 'checked' : ''} style="width:16px;height:16px;cursor:pointer">
                    ${t('eod.enable')}
                  </label>
                  <div style="display:flex;align-items:center;gap:10px">
                    <label for="setting_eodTime" style="font-size:12px;color:var(--text2);min-width:50px">${t('eod.time')}</label>
                    <input type="time" id="setting_eodTime" value="${s.eodTime || '16:00'}" style="height:34px;padding:0 8px;border:0.5px solid var(--border2);border-radius:var(--radius);background:var(--surface2);color:var(--text);font-size:13px;width:auto">
                  </div>
                  <div style="display:flex;align-items:center;gap:10px">
                    <label for="setting_eodAction" style="font-size:12px;color:var(--text2);min-width:50px">${t('eod.action')}</label>
                    <select id="setting_eodAction" style="height:34px;padding:0 8px;border:0.5px solid var(--border2);border-radius:var(--radius);background:var(--surface2);color:var(--text);font-size:13px;width:auto">
                      <option value="clear" ${(s.eodAction || 'clear') === 'clear' ? 'selected' : ''}>${t('eod.clear')}</option>
                      <option value="remind" ${s.eodAction === 'remind' ? 'selected' : ''}>${t('eod.remind')}</option>
                    </select>
                  </div>
                  <button class="btn" onclick="manualEodReset()" style="font-size:12px;align-self:flex-start">
                    <i class="ti ti-restore"></i>${t('eod.manual_btn')}
                  </button>
                </div>
              </div>
              <div>
                <div style="font-size:13px;font-weight:600;margin-bottom:12px">${t('retention.section')}</div>
                <div style="font-size:12px;color:var(--text3);margin-bottom:10px">${t('retention.label')}</div>
                <select id="setting_retentionDays" style="width:100%;height:36px;padding:0 10px;border:0.5px solid var(--border2);border-radius:var(--radius);background:var(--surface2);color:var(--text);font-size:13px">
                  <option value="30"  ${(s.dataRetentionDays || 90) == 30  ? 'selected' : ''}>${t('retention.30')}</option>
                  <option value="60"  ${(s.dataRetentionDays || 90) == 60  ? 'selected' : ''}>${t('retention.60')}</option>
                  <option value="90"  ${(s.dataRetentionDays || 90) == 90  ? 'selected' : ''}>${t('retention.90')}</option>
                  <option value="180" ${(s.dataRetentionDays || 90) == 180 ? 'selected' : ''}>${t('retention.180')}</option>
                  <option value="365" ${(s.dataRetentionDays || 90) == 365 ? 'selected' : ''}>${t('retention.365')}</option>
                  <option value="0"   ${(s.dataRetentionDays || 90) == 0   ? 'selected' : ''}>${t('retention.never')}</option>
                </select>
              </div>
            </div>
            <div class="settings-save-bar">
              <button class="btn" onclick="saveSettings()" style="padding:9px 22px;font-size:14px;font-weight:600;background:var(--text);color:var(--bg);border-color:var(--text)">
                <i class="ti ti-device-floppy"></i>${t('settings.save')}
              </button>
            </div>
          </div>
        </div>

        <!-- Data section -->
        <div class="settings-section" id="settingsSec_data">
          <div class="settings-card">
            <div class="settings-card-title">${t('settings.section_data')}</div>
            <div class="settings-card-sub">${t('settings.data_sub')}</div>

            <!-- Students -->
            <div style="margin-bottom:20px;padding-bottom:20px;border-bottom:0.5px solid var(--border)">
              <div style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:4px">${t('settings.students_heading') || 'Elever'}</div>
              <div style="font-size:12px;color:var(--text3);margin-bottom:10px">${t('settings.students_csv_hint') || 'CSV-format: id, förnamn, efternamn, klass — kolumnnamn identifieras automatiskt.'}</div>
              <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:8px">
                <button class="btn" onclick="openImportModal()" style="font-size:13px">
                  <i class="ti ti-upload"></i>${t('topbar.import') || 'Importera elever'}
                </button>
                <button class="btn" onclick="settingsGoAddStudent()" style="font-size:13px">
                  <i class="ti ti-user-plus"></i>${t('students.add_btn') || '+ Lägg till elev'}
                </button>
              </div>
              <div style="margin-top:4px">
                <div style="font-size:11px;color:var(--text3);margin-bottom:5px">
                  ${t('settings.csv_paste_label') || 'Eller klistra in CSV direkt:'} <span style="font-family:\'DM Mono\',monospace;color:var(--text3);opacity:0.7">id, förnamn, efternamn, klass, nummer</span>
                </div>
                <textarea id="csvPasteArea" rows="4"
                  placeholder="12345678, Anna, Andersson, 7A&#10;87654321, Erik, Eriksson, 7B"
                  style="width:100%;box-sizing:border-box;padding:8px 10px;font-family:'DM Mono',monospace;font-size:12px;border:0.5px solid var(--border2);border-radius:var(--radius);background:var(--surface);color:var(--text);resize:vertical;line-height:1.6"></textarea>
                <button class="btn" onclick="importFromPaste()" style="margin-top:6px;font-size:12px">
                  <i class="ti ti-table-import"></i>${t('settings.csv_paste_btn') || 'Importera inklistrad data'}
                </button>
              </div>
            </div>

            <!-- Backup & Privacy -->
            <div>
              <div style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:8px">${t('backup.section') || 'Säkerhetskopiering'}</div>
              <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center">
                <button class="btn" onclick="createBackup()" style="font-size:13px"><i class="ti ti-device-floppy"></i>${t('backup.create_btn')}</button>
                <button class="btn" onclick="showBackups()" style="font-size:13px"><i class="ti ti-history"></i>${t('backup.restore_lnk')}</button>
                <button onclick="openPrivacyModal()" style="background:none;border:none;color:var(--text3);font-size:12px;cursor:pointer;text-decoration:underline;padding:4px 0">${t('privacy.link')}</button>
              </div>
            </div>

          </div>
        </div>

        <!-- Notifications section (admin only) -->
        <div class="settings-section" id="settingsSec_notifications">
          <div class="settings-card">
            <div class="settings-card-title">${t('settings.section_notifications')}</div>
            <div class="settings-card-sub">${t('settings.notif_sub')}</div>

            <div style="padding:10px 12px;background:rgba(30,58,95,0.05);border:0.5px solid rgba(30,58,95,0.15);border-radius:var(--radius);font-size:12px;color:var(--text2);margin-bottom:18px;line-height:1.6">
              <i class="ti ti-info-circle" style="margin-right:5px;color:var(--text3)"></i>${t('settings.notif_resend_hint')}
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px">
              <div class="settings-field">
                <label>${t('settings.notif_from_name')}</label>
                <input id="setting_emailFromName" value="${escHtml(s.emailFromName || '')}" placeholder="${t('settings.notif_from_name_ph')}">
              </div>
              <div class="settings-field">
                <label>${t('settings.notif_from_email')}</label>
                <input id="setting_emailFromAddress" type="email" value="${escHtml(s.emailFromAddress || '')}" placeholder="${t('settings.notif_from_email_ph')}">
              </div>
            </div>

            <div class="settings-field" style="margin-bottom:14px">
              <label>${t('settings.notif_subject')}</label>
              <input id="setting_emailSubject" value="${escHtml(s.emailSubject || '')}" placeholder="${t('settings.notif_subject_ph')}">
            </div>

            <div class="settings-field" style="margin-bottom:6px">
              <label>${t('settings.notif_body')}</label>
              <textarea id="setting_emailBody" rows="12"
                style="width:100%;box-sizing:border-box;padding:10px 12px;font-family:'DM Mono',monospace;font-size:11px;border:0.5px solid var(--border2);border-radius:var(--radius);background:var(--surface);color:var(--text);resize:vertical;line-height:1.6"
                placeholder="HTML e-postinnehåll…"
              >${escHtml(s.emailBody || '')}</textarea>
              <div style="font-size:11px;color:var(--text3);margin-top:4px"><i class="ti ti-variable" style="font-size:10px;margin-right:3px"></i>${t('settings.notif_vars')}</div>
            </div>

            <div class="settings-save-bar">
              <button class="btn" onclick="saveSettings()" style="padding:9px 22px;font-size:14px;font-weight:600;background:var(--text);color:var(--bg);border-color:var(--text)">
                <i class="ti ti-device-floppy"></i>${t('settings.save')}
              </button>
            </div>
          </div>
        </div>

        <!-- Users section (admin only) -->
        <div class="settings-section" id="settingsSec_users">
          <div class="settings-card">
            <div class="settings-card-title">${t('settings.section_users')}</div>
            <div class="settings-card-sub">${t('settings.users_sub')}</div>

            <!-- Team list -->
            <div id="usersListContainer" style="display:flex;flex-direction:column;gap:8px;margin-bottom:4px">
              <div style="font-size:13px;color:var(--text3)">${t('settings.users_loading')}</div>
            </div>

            <!-- Invite section -->
            <div style="margin-top:24px;padding-top:20px;border-top:0.5px solid var(--border)">
              <div style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:12px">${t('settings.invite_section')}</div>
              <div style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap;margin-bottom:16px">
                <div style="flex:1;min-width:140px">
                  <label style="font-size:11px;color:var(--text3);margin-bottom:4px;display:block">${t('settings.invite_days_label')}</label>
                  <select id="inviteExpiryDays" style="width:100%;height:36px;padding:0 10px;border:0.5px solid var(--border2);border-radius:var(--radius);background:var(--surface2);color:var(--text);font-size:13px">
                    <option value="1">1 ${t('settings.invite_day')}</option>
                    <option value="7" selected>7 ${t('settings.invite_days')}</option>
                    <option value="30">30 ${t('settings.invite_days')}</option>
                  </select>
                </div>
                <div style="flex:2;min-width:180px">
                  <label style="font-size:11px;color:var(--text3);margin-bottom:4px;display:block">${t('settings.invite_email_label')}</label>
                  <input id="inviteEmail" type="email" placeholder="${t('settings.invite_email_ph')}"
                    style="width:100%;padding:0 10px;height:36px;box-sizing:border-box;border:0.5px solid var(--border2);border-radius:var(--radius);background:var(--surface2);color:var(--text);font-size:13px">
                </div>
                <button class="btn" onclick="settingsGenerateInvite()" id="generateInviteBtn"
                  style="height:36px;padding:0 16px;font-size:13px;white-space:nowrap;flex-shrink:0;background:var(--text);color:var(--bg);border-color:var(--text)">
                  <i class="ti ti-plus"></i>${t('settings.invite_generate')}
                </button>
              </div>
              <div id="inviteListContainer">
                <div style="font-size:12px;color:var(--text3)">${t('settings.users_loading')}</div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>

  `;
}

function switchSettingsSection(name, btn) {
  document.querySelectorAll('.settings-section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.settings-nav-item').forEach(b => b.classList.remove('active'));
  const sec = document.getElementById('settingsSec_' + name);
  if (sec) sec.classList.add('active');
  if (btn) btn.classList.add('active');
}

function settingsGetCurrentYearSections() {
  const ys = Object.assign({}, _settings.yearSections || {});
  document.querySelectorAll('[id^="yearRow_"]').forEach(row => {
    const y = row.id.replace('yearRow_', '');
    const cb = row.querySelector('input[type="checkbox"]');
    if (!cb.checked) { ys[y] = 0; return; }
    let active = 0;
    for (let n = 1; n <= 8; n++) {
      const btn = document.getElementById(`sec_${y}_${n}`);
      if (btn && btn.style.background.includes('var(--text)')) { active = n; break; }
    }
    ys[y] = active || 1;
  });
  return ys;
}

function settingsUpdatePreview() {
  const override = document.getElementById('setting_classOverride')?.value.trim() || '';
  const format   = document.querySelector('input[name="classFormat"]:checked')?.value || 'letter';
  const yearSections = settingsGetCurrentYearSections();
  const preview  = buildClassList({ yearSections, classFormat: format, classOverride: override });
  const el = document.getElementById('classPreview');
  if (!el) return;
  el.innerHTML = preview.length
    ? preview.map(c => `<span style="padding:3px 10px;background:var(--surface);border:0.5px solid var(--border2);border-radius:12px;font-size:12px;font-weight:500">${c}</span>`).join('')
    : `<span style="font-size:12px;color:var(--text3)">${t('settings.preview_empty')}</span>`;
}

function settingsYearToggle(cb, y) {
  const controls = document.getElementById('yearControls_' + y);
  const row = document.getElementById('yearRow_' + y);
  if (controls) controls.style.cssText = cb.checked ? 'display:flex;align-items:center;gap:6px' : 'display:flex;align-items:center;gap:6px;opacity:0.3;pointer-events:none';
  if (row) { row.style.background = cb.checked ? 'var(--surface2)' : 'var(--surface)'; row.style.borderColor = cb.checked ? 'var(--border2)' : 'var(--border)'; }
  if (cb.checked) settingsSetSections(y, _settings.yearSections?.[y] || 1);
  settingsUpdatePreview();
}

function settingsSetSections(y, n) {
  for (let i = 1; i <= 8; i++) {
    const btn = document.getElementById(`sec_${y}_${i}`);
    if (!btn) continue;
    btn.style.background = i === n ? 'var(--text)' : 'var(--surface)';
    btn.style.color = i === n ? 'var(--bg)' : 'var(--text2)';
  }
  settingsUpdatePreview();
}

function settingsFormatChange(radio) {
  document.querySelectorAll('input[name="classFormat"]').forEach(r => {
    const lbl = r.closest('label');
    lbl.style.background = r.checked ? 'var(--text)' : 'var(--surface)';
    lbl.style.color = r.checked ? 'var(--bg)' : 'var(--text2)';
  });
  settingsUpdatePreview();
}

async function saveSettings() {
  const schoolName    = document.getElementById('setting_schoolName').value.trim();
  const classOverride = document.getElementById('setting_classOverride').value.trim();
  const format        = document.querySelector('input[name="classFormat"]:checked')?.value || 'letter';
  const yearSections  = settingsGetCurrentYearSections();

  const statuses = [];
  document.querySelectorAll('#statusList [data-status-idx]').forEach(row => {
    const i   = row.dataset.statusIdx;
    const labelEl = row.querySelector('[data-status-label]');
    const colorEl = row.querySelector('[data-status-color]');
    const label = labelEl ? labelEl.value.trim() : '';
    if (!label) return;
    statuses.push({
      key:         row.dataset.statusKey || ('status_' + i),
      label,
      color:       colorEl ? colorEl.value : '#ef4444',
      isConfirmed: row.dataset.statusConfirmed === '1'
    });
  });

  const flags = [];
  document.querySelectorAll('#flagList [data-flag-idx]').forEach((row, i) => {
    const label          = (row.querySelector('[data-flag-label]')?.value || '').trim();
    const emojiEl        = row.querySelector('[id^="emojiVal_"]');
    const colorEl        = row.querySelector('[data-flag-color]');
    const cardEnabledEl  = row.querySelector('[data-flag-card-enabled]');
    const cardColorEl    = row.querySelector('[data-flag-card-color]');
    if (!label) return;
    flags.push({
      key:         row.dataset.flagKey || ('flag_' + i),
      label,
      emoji:       emojiEl ? emojiEl.value.trim() || '⭐' : '⭐',
      activeColor: colorEl ? colorEl.value : '#6366f1',
      cardColor:   (cardEnabledEl?.checked && cardColorEl) ? cardColorEl.value : ''
    });
  });

  const eodEnabled        = document.getElementById('setting_eodEnabled')?.checked || false;
  const eodTime           = document.getElementById('setting_eodTime')?.value || '16:00';
  const eodAction         = document.getElementById('setting_eodAction')?.value || 'clear';
  const dataRetentionDays = parseInt(document.getElementById('setting_retentionDays')?.value) || 90;
  const studentNumEnabled = document.getElementById('setting_studentNumEnabled')?.checked || false;
  const studentNumLabel   = document.getElementById('setting_studentNumLabel')?.value.trim() || '';

  const emailFromName    = document.getElementById('setting_emailFromName')?.value.trim() || '';
  const emailFromAddress = document.getElementById('setting_emailFromAddress')?.value.trim() || '';
  const emailSubject     = document.getElementById('setting_emailSubject')?.value.trim() || '';
  const emailBody        = document.getElementById('setting_emailBody')?.value || '';

  const data = {
    schoolName,
    yearSections,
    classFormat: format,
    classOverride,
    statuses,
    flags,
    eodEnabled,
    eodTime,
    eodAction,
    dataRetentionDays,
    studentNumEnabled,
    studentNumLabel,
    emailFromName,
    emailFromAddress,
    emailSubject,
    emailBody,
  };

  _settings = data;
  applySettings();
  await saveSettingsToServer(data);
  showToast(t('toast.settings_saved'));
  renderStudentList();
  renderDash();
}

function renderStatusRow(st, i) {
  const confirmedBadge = st.isConfirmed
    ? `<span style="font-size:10px;font-weight:600;background:#dcfce7;color:#16a34a;padding:2px 8px;border-radius:10px;white-space:nowrap;flex-shrink:0">${t('settings.confirmed_badge')}</span>`
    : '';
  return `<div style="display:flex;align-items:center;gap:7px;padding:8px 10px;background:var(--surface2);border-radius:var(--radius);border:0.5px solid var(--border)"
    id="statusRow_${i}"
    data-status-idx="${i}"
    data-status-key="${escHtml(st.key || '')}"
    data-status-confirmed="${st.isConfirmed ? '1' : '0'}">
    <div style="width:20px;height:20px;border-radius:50%;background:var(--surface3);color:var(--text3);font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0">${i + 1}</div>
    <div id="colorSwatch_${i}" style="width:12px;height:12px;border-radius:50%;background:${st.color || '#ef4444'};flex-shrink:0"></div>
    <input value="${escHtml(st.label)}" placeholder="${t('settings.status_ph')}" data-status-label="${i}"
      style="flex:1;padding:5px 8px;border:0.5px solid var(--border2);border-radius:var(--radius);background:var(--surface);color:var(--text);font-size:13px">
    ${confirmedBadge}
    <input type="color" value="${st.color || '#ef4444'}" data-status-color="${i}"
      onchange="document.getElementById('colorSwatch_${i}').style.background=this.value"
      style="width:28px;height:28px;border:0.5px solid var(--border2);border-radius:4px;padding:2px;cursor:pointer;background:var(--surface)">
    <button onclick="settingsMoveStatus(${i},-1)" title="${t('settings.move_up') || '↑'}"
      style="background:none;border:0.5px solid var(--border2);border-radius:4px;color:var(--text3);cursor:pointer;font-size:12px;width:24px;height:26px;display:flex;align-items:center;justify-content:center">↑</button>
    <button onclick="settingsMoveStatus(${i},1)" title="${t('settings.move_down') || '↓'}"
      style="background:none;border:0.5px solid var(--border2);border-radius:4px;color:var(--text3);cursor:pointer;font-size:12px;width:24px;height:26px;display:flex;align-items:center;justify-content:center">↓</button>
    <button onclick="settingsRemoveStatus(${i})" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:16px;padding:2px 5px" title="Remove">✕</button>
  </div>`;
}

function renderFlagRow(fl, i) {
  const pickerEmojis = EMOJI_PICKS.map(e =>
    `<button type="button" onclick="pickEmoji(${i},'${e}')"
      style="font-size:19px;background:none;border:none;cursor:pointer;padding:3px 4px;border-radius:6px;line-height:1;transition:background 0.1s"
      onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background='none'">${e}</button>`
  ).join('');

  return `<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:var(--surface2);border-radius:var(--radius);border:0.5px solid var(--border)"
    id="flagRow_${i}"
    data-flag-idx="${i}"
    data-flag-key="${escHtml(fl.key || '')}">
    <!-- Emoji picker trigger -->
    <div style="position:relative;flex-shrink:0">
      <button type="button" id="emojiBtn_${i}" onclick="openEmojiPicker(${i},event)"
        style="font-size:20px;width:38px;height:34px;border:0.5px solid var(--border2);border-radius:var(--radius);background:var(--surface);cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1">
        ${fl.emoji}
      </button>
      <input type="hidden" data-flag-emoji="${i}" id="emojiVal_${i}" value="${escHtml(fl.emoji)}">
      <!-- Picker dropdown -->
      <div id="emojiPicker_${i}"
        style="display:none;position:absolute;top:38px;left:0;z-index:200;background:var(--surface);border:0.5px solid var(--border2);border-radius:var(--radius-lg);padding:8px;box-shadow:0 6px 24px rgba(0,0,0,0.13);width:228px">
        <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:2px">
          ${pickerEmojis}
        </div>
      </div>
    </div>
    <input value="${escHtml(fl.label)}" placeholder="${t('settings.flag_ph')}" data-flag-label="${i}"
      style="flex:1;padding:5px 8px;border:0.5px solid var(--border2);border-radius:var(--radius);background:var(--surface);color:var(--text);font-size:13px">
    <input type="color" value="${fl.activeColor}" data-flag-color="${i}"
      title="${t('settings.flag_icon_color')}"
      style="width:32px;height:28px;border:0.5px solid var(--border2);border-radius:4px;padding:2px;cursor:pointer;background:var(--surface)">
    <label title="${t('settings.flag_card_color')}" style="display:flex;align-items:center;gap:3px;cursor:pointer;flex-shrink:0">
      <input type="checkbox" data-flag-card-enabled="${i}" ${fl.cardColor ? 'checked' : ''}
        onchange="var cp=this.closest('[data-flag-idx]').querySelector('[data-flag-card-color]');cp.style.opacity=this.checked?'1':'0.35';cp.style.pointerEvents=this.checked?'':'none'"
        style="cursor:pointer;width:13px;height:13px;accent-color:var(--text)">
      <input type="color" value="${fl.cardColor || '#a78bfa'}" data-flag-card-color="${i}"
        style="width:32px;height:28px;border:0.5px solid var(--border2);border-radius:4px;padding:2px;cursor:pointer;background:var(--surface);opacity:${fl.cardColor ? '1' : '0.35'};pointer-events:${fl.cardColor ? 'auto' : 'none'}">
    </label>
    <button onclick="settingsMoveFlag(${i},-1)" title="${t('settings.move_up') || '↑'}"
      style="background:none;border:0.5px solid var(--border2);border-radius:4px;color:var(--text3);cursor:pointer;font-size:12px;width:24px;height:26px;display:flex;align-items:center;justify-content:center">↑</button>
    <button onclick="settingsMoveFlag(${i},1)" title="${t('settings.move_down') || '↓'}"
      style="background:none;border:0.5px solid var(--border2);border-radius:4px;color:var(--text3);cursor:pointer;font-size:12px;width:24px;height:26px;display:flex;align-items:center;justify-content:center">↓</button>
    <button type="button" onclick="settingsRemoveFlag(${i})" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:16px;padding:2px 6px" title="Remove">✕</button>
  </div>`;
}

function settingsAddStatus() {
  const list = document.getElementById('statusList');
  const i = list.children.length;
  const div = document.createElement('div');
  div.innerHTML = renderStatusRow({ key: 'status_new_' + i, label: '', color: '#6366f1' }, i);
  list.appendChild(div.firstElementChild);
}

function settingsAddConfirmed() {
  // Only allow one confirmed status
  const existing = document.querySelector('#statusList [data-status-confirmed="1"]');
  if (existing) { existing.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
  const list = document.getElementById('statusList');
  const i = list.children.length;
  const div = document.createElement('div');
  div.innerHTML = renderStatusRow({
    key: 'confirmed',
    label: currentLang === 'en' ? 'Handed in' : 'Inlämnad',
    color: '#16a34a',
    isConfirmed: true
  }, i);
  list.appendChild(div.firstElementChild);
}

function settingsMoveStatus(i, dir) {
  const rows = [...document.querySelectorAll('#statusList [data-status-idx]')];
  const j = i + dir;
  if (j < 0 || j >= rows.length) return;
  // Read all current state from DOM
  const data = rows.map(row => ({
    key:         row.dataset.statusKey || '',
    label:       row.querySelector('[data-status-label]').value,
    color:       row.querySelector('[data-status-color]').value,
    isConfirmed: row.dataset.statusConfirmed === '1'
  }));
  [data[i], data[j]] = [data[j], data[i]];
  const list = document.getElementById('statusList');
  list.innerHTML = data.map((st, idx) => renderStatusRow(st, idx)).join('');
}

function settingsRemoveStatus(i) {
  const el = document.getElementById('statusRow_' + i);
  if (el) el.remove();
  // Re-number remaining rows
  const rows = [...document.querySelectorAll('#statusList [data-status-idx]')];
  const data = rows.map(row => ({
    key:         row.dataset.statusKey || '',
    label:       row.querySelector('[data-status-label]').value,
    color:       row.querySelector('[data-status-color]').value,
    isConfirmed: row.dataset.statusConfirmed === '1'
  }));
  const list = document.getElementById('statusList');
  list.innerHTML = data.map((st, idx) => renderStatusRow(st, idx)).join('');
}

function settingsAddFlag() {
  const list = document.getElementById('flagList');
  const i = list.children.length;
  const div = document.createElement('div');
  div.innerHTML = renderFlagRow({ key: 'flag_new_' + i, label: '', emoji: '⭐', activeColor: '#6366f1', cardColor: '' }, i);
  list.appendChild(div.firstElementChild);
}

function _readFlagRows() {
  return [...document.querySelectorAll('#flagList [data-flag-idx]')].map(row => {
    const cardEnabledEl = row.querySelector('[data-flag-card-enabled]');
    const cardColorEl   = row.querySelector('[data-flag-card-color]');
    return {
      key:         row.dataset.flagKey || '',
      label:       row.querySelector('[data-flag-label]').value,
      emoji:       row.querySelector('[id^="emojiVal_"]').value || '⭐',
      activeColor: row.querySelector('[data-flag-color]').value,
      cardColor:   (cardEnabledEl?.checked && cardColorEl) ? cardColorEl.value : ''
    };
  });
}

function settingsMoveFlag(i, dir) {
  const data = _readFlagRows();
  const j = i + dir;
  if (j < 0 || j >= data.length) return;
  [data[i], data[j]] = [data[j], data[i]];
  document.getElementById('flagList').innerHTML = data.map((fl, idx) => renderFlagRow(fl, idx)).join('');
}

function settingsRemoveFlag(i) {
  const el = document.getElementById('flagRow_' + i);
  if (el) el.remove();
  const data = _readFlagRows();
  document.getElementById('flagList').innerHTML = data.map((fl, idx) => renderFlagRow(fl, idx)).join('');
}

// ── Emoji picker ──────────────────────────────────────────────
function openEmojiPicker(i, e) {
  e.stopPropagation();
  // Close any other open pickers
  document.querySelectorAll('[id^="emojiPicker_"]').forEach(p => {
    if (p.id !== 'emojiPicker_' + i) p.style.display = 'none';
  });
  const picker = document.getElementById('emojiPicker_' + i);
  if (!picker) return;
  picker.style.display = picker.style.display === 'none' ? 'block' : 'none';
}

function pickEmoji(i, emoji) {
  const btn = document.getElementById('emojiBtn_' + i);
  const val = document.getElementById('emojiVal_' + i);
  const picker = document.getElementById('emojiPicker_' + i);
  if (btn) btn.textContent = emoji;
  if (val) val.value = emoji;
  if (picker) picker.style.display = 'none';
}

// Close all emoji pickers when clicking outside
document.addEventListener('click', function() {
  document.querySelectorAll('[id^="emojiPicker_"]').forEach(p => p.style.display = 'none');
});

function settingsGoAddStudent() {
  switchView('students');
  setTimeout(() => {
    const p = document.getElementById('addPanel');
    if (p) p.classList.add('open');
  }, 80);
}

function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
}

// ── Users & Invite management ────────────────────────────────

async function settingsLoadUsers() {
  const container = document.getElementById('usersListContainer');
  if (!container) return;
  container.innerHTML = `<div style="font-size:13px;color:var(--text3)">${t('settings.users_loading')}</div>`;

  try {
    const r = await authFetch('/api/school-users');
    if (!r.ok) {
      container.innerHTML = `<div style="font-size:13px;color:var(--text3)">${t('settings.users_error')}</div>`;
      return;
    }
    const users = await r.json();
    if (!users.length) {
      container.innerHTML = `<div style="font-size:13px;color:var(--text3)">${t('settings.users_empty')}</div>`;
      return;
    }

    const myId = getMyUserId();
    container.innerHTML = users.map(u => {
      const isMe = u.userId === myId;
      const isAdmin = u.role === 'admin';
      const roleLabel = isAdmin ? t('settings.users_role_admin') : t('settings.users_role_teacher');
      const joined = new Date(u.joinedAt).toLocaleDateString('sv-SE');
      const initial = (u.name || u.email || '?')[0].toUpperCase();

      const roleBadge = `<span style="font-size:10px;font-weight:600;padding:2px 7px;border-radius:10px;flex-shrink:0;
        ${isAdmin
          ? 'background:rgba(232,64,64,0.1);color:#e84040;border:0.5px solid rgba(232,64,64,0.25)'
          : 'background:var(--surface3);color:var(--text3);border:0.5px solid var(--border2)'}"
      >${roleLabel}</span>`;

      const roleToggleBtn = !isMe
        ? `<button onclick="settingsSetUserRole('${u.userId}','${isAdmin ? 'teacher' : 'admin'}','${escHtml(u.email)}')"
            title="${isAdmin ? t('settings.users_demote') : t('settings.users_promote')}"
            style="flex-shrink:0;background:none;border:0.5px solid var(--border2);border-radius:6px;color:var(--text2);cursor:pointer;font-size:11px;padding:4px 10px;font-family:'DM Sans',sans-serif">
            ${isAdmin ? '↓ ' + t('settings.users_demote') : '↑ ' + t('settings.users_promote')}
          </button>`
        : '';

      return `<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--surface2);border:0.5px solid var(--border);border-radius:var(--radius)">
        <div style="width:32px;height:32px;border-radius:50%;background:var(--surface3);display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:600;flex-shrink:0;color:var(--text2)">${initial}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:13px;font-weight:500;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(u.name || u.email)}</div>
          <div style="font-size:11px;color:var(--text3)">${escHtml(u.email)} · ${joined}</div>
        </div>
        ${roleBadge}
        ${isMe ? `<span style="font-size:11px;color:var(--text3);padding:2px 8px;border:0.5px solid var(--border2);border-radius:10px;flex-shrink:0">${t('settings.users_you')}</span>` : ''}
        ${roleToggleBtn}
        ${!isMe ? `<button onclick="settingsRemoveUser('${u.userId}','${escHtml(u.email)}')" style="flex-shrink:0;background:none;border:0.5px solid var(--red-border);border-radius:6px;color:var(--red-text);cursor:pointer;font-size:12px;padding:4px 10px">${t('settings.users_remove')}</button>` : ''}
      </div>`;
    }).join('');
  } catch(e) {
    if (container) container.innerHTML = `<div style="font-size:13px;color:var(--text3)">${t('settings.users_error')}</div>`;
  }
}

async function settingsRemoveUser(userId, email) {
  if (!confirm(t('settings.users_remove_confirm', { email }))) return;
  try {
    const r = await authFetch(`/api/school-users?userId=${encodeURIComponent(userId)}`, { method: 'DELETE' });
    if (r.ok) {
      settingsLoadUsers();
    } else {
      const d = await r.json().catch(() => ({}));
      showToast(d.error === 'cannot_remove_self' ? t('settings.users_cannot_remove_self') : t('settings.users_remove_error'));
    }
  } catch(e) { showToast(t('settings.users_remove_error')); }
}

async function settingsSetUserRole(userId, newRole, email) {
  const actionLabel = newRole === 'admin' ? t('settings.users_promote') : t('settings.users_demote');
  if (!confirm(`${actionLabel}: ${email}?`)) return;
  try {
    const r = await authFetch('/api/school-users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, role: newRole })
    });
    const d = await r.json().catch(() => ({}));
    if (r.ok) {
      showToast(t('settings.users_role_changed'));
      settingsLoadUsers();
    } else if (d.error === 'cannot_demote_last_admin') {
      showToast(t('settings.users_last_admin'));
    } else {
      showToast(d.error || t('settings.users_remove_error'));
    }
  } catch(e) { showToast(t('settings.users_remove_error')); }
}

async function settingsLoadInvites() {
  const container = document.getElementById('inviteListContainer');
  if (!container) return;
  container.innerHTML = `<div style="font-size:12px;color:var(--text3)">${t('settings.users_loading')}</div>`;

  try {
    const r = await authFetch('/api/invites');
    if (!r.ok) { container.innerHTML = ''; return; }
    const invites = await r.json();

    if (!invites.length) {
      container.innerHTML = `<div style="font-size:12px;color:var(--text3)">${t('settings.invite_list_empty')}</div>`;
      return;
    }

    container.innerHTML = `<div style="display:flex;flex-direction:column;gap:6px">` + invites.map(inv => {
      const used = !!inv.used_by && !!inv.email; // open invites (no email) never lock
      const expires = new Date(inv.expires_at).toLocaleDateString('sv-SE');
      const joinUrl = `${window.location.origin}/?join=${inv.code}`;
      const canSendEmail = !used && !!inv.email;
      const emailSentDate = inv.email_sent_at ? new Date(inv.email_sent_at).toLocaleDateString('sv-SE') : null;
      return `<div style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:var(--surface2);border:0.5px solid var(--border);border-radius:var(--radius);${used ? 'opacity:0.5' : ''}">
        <div style="flex:1;min-width:0">
          <div style="font-size:11px;color:var(--text3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${joinUrl}</div>
          ${inv.email ? `<div style="font-size:10px;color:var(--text3);margin-top:1px">${escHtml(inv.email)}</div>` : ''}
        </div>
        <div style="font-size:11px;color:var(--text3);white-space:nowrap;flex-shrink:0">
          ${used ? `<span>${t('settings.invite_used')}</span>` : `exp ${expires}`}
        </div>
        ${emailSentDate ? `<span title="${t('settings.invite_email_sent_on')} ${emailSentDate}" style="flex-shrink:0;display:flex;align-items:center;gap:3px;font-size:10px;color:#16a34a;padding:2px 7px;background:rgba(22,163,74,0.08);border:0.5px solid rgba(22,163,74,0.25);border-radius:10px;white-space:nowrap"><i class="ti ti-mail-check" style="font-size:11px"></i>${emailSentDate}</span>` : ''}
        ${!used ? `<button onclick="settingsCopyInviteLink('${escHtml(joinUrl)}')" title="${t('settings.invite_copy')}" style="flex-shrink:0;background:none;border:0.5px solid var(--border2);border-radius:6px;color:var(--text3);cursor:pointer;font-size:12px;padding:3px 10px"><i class="ti ti-copy"></i></button>` : ''}
        ${canSendEmail ? `<button onclick="settingsSendInviteEmail('${inv.id}','${escHtml(inv.email)}')" title="${emailSentDate ? t('settings.invite_resend') : t('settings.notif_send')}" style="flex-shrink:0;background:none;border:0.5px solid var(--border2);border-radius:6px;color:var(--text2);cursor:pointer;font-size:12px;padding:3px 10px;display:flex;align-items:center;gap:4px"><i class="ti ti-send"></i>${emailSentDate ? t('settings.invite_resend') : t('settings.notif_send')}</button>` : ''}
        <button onclick="settingsDeleteInvite('${inv.id}')" title="Delete" style="flex-shrink:0;background:none;border:none;color:var(--text3);cursor:pointer;font-size:15px;padding:2px 4px;line-height:1">✕</button>
      </div>`;
    }).join('') + `</div>`;
  } catch(e) {
    if (container) container.innerHTML = '';
  }
}

async function settingsGenerateInvite() {
  const expiryDays = parseInt(document.getElementById('inviteExpiryDays')?.value || '7');
  const email      = (document.getElementById('inviteEmail')?.value || '').trim() || null;
  const btn        = document.getElementById('generateInviteBtn');

  if (btn) btn.disabled = true;
  try {
    const r = await authFetch('/api/invites', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ expiryDays, email })
    });
    const d = await r.json().catch(() => ({}));
    if (r.ok) {
      const emailInput = document.getElementById('inviteEmail');
      if (emailInput) emailInput.value = '';
      await settingsLoadInvites();
      settingsCopyInviteLink(`${window.location.origin}/?join=${d.code}`);
    } else {
      showToast(d.error || t('settings.invite_error'));
    }
  } catch(e) { showToast(t('settings.invite_error')); }
  if (btn) btn.disabled = false;
}

async function settingsDeleteInvite(id) {
  try {
    const r = await authFetch(`/api/invites?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (r.ok) settingsLoadInvites();
  } catch(e) {}
}

function settingsCopyInviteLink(url) {
  navigator.clipboard.writeText(url).then(() => showToast(t('settings.invite_code_copied')));
}

async function settingsSendInviteEmail(inviteId, email) {
  if (!confirm(`${t('settings.notif_send')}: ${email}?`)) return;
  try {
    const r = await authFetch('/api/send-invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inviteId })
    });
    const d = await r.json().catch(() => ({}));
    if (r.ok) {
      showToast(t('settings.notif_sent'));
      settingsLoadInvites();
    } else if (d.error === 'email_not_configured') {
      showToast(t('settings.notif_no_api'));
    } else {
      showToast(d.error || t('settings.notif_send_error'));
    }
  } catch(e) { showToast(t('settings.notif_send_error')); }
}
