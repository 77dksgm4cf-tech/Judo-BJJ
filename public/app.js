// UI-Logik. Datenhaltung kommt komplett aus store.js (localStorage).

const GRADUATION_BELT_KEY = 'judo_graduation_belt';
let selectedGraduationBelt = localStorage.getItem(GRADUATION_BELT_KEY);
const expandedGraduation = new Set();
let selectedMemberId = null;
let currentView = 'members';

const statusEl = document.getElementById('status');

function showStatus(msg, isError) {
  statusEl.textContent = msg;
  statusEl.style.color = isError ? '#ff6b6b' : '#7ee787';
  if (msg) setTimeout(() => { if (statusEl.textContent === msg) statusEl.textContent = ''; }, 4000);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text == null ? '' : String(text);
  return div.innerHTML;
}

function memberFullName(m) {
  return `${m.vorname} ${m.nachname}`;
}

let attendanceCounts = null;

function invalidateAttendanceCounts() {
  attendanceCounts = null;
}

function attendanceCountFor(m) {
  if (!attendanceCounts) {
    attendanceCounts = {};
    for (const sessionMap of Object.values(getAttendance())) {
      for (const [memberId, present] of Object.entries(sessionMap)) {
        if (present) attendanceCounts[memberId] = (attendanceCounts[memberId] || 0) + 1;
      }
    }
  }
  return attendanceCounts[m.id] || 0;
}

function memberName(m) {
  const initial = m.nachname ? `${m.nachname.trim().charAt(0).toUpperCase()}.` : '';
  const alter = currentAlter(m);
  const base = [m.vorname, initial, alter != null ? String(alter) : null].filter(Boolean).join(' ');
  // Disziplin-Kürzel nur bei BJJ und nur, wenn nicht ohnehin nach BJJ gefiltert ist.
  const tag = memberDisziplin(m) === 'BJJ' && disziplinFilter !== 'BJJ' ? ' [BJJ]' : '';
  return `${base} (${attendanceCountFor(m)})${tag}`;
}

// ---------- Disziplin-Filter (Alle | Judo | BJJ) ----------

const DISZIPLIN_KEY = 'judo_disziplin';
let disziplinFilter = localStorage.getItem(DISZIPLIN_KEY);
if (disziplinFilter !== 'all' && !DISZIPLINEN.includes(disziplinFilter)) disziplinFilter = 'all';

function updateTitle() {
  const name = disziplinFilter === 'all' ? 'Judo & BJJ' : disziplinFilter;
  document.getElementById('appTitle').textContent = `🥋 ${name}`;
  document.title = name;
}

function updateDisziplinUI() {
  for (const btn of document.querySelectorAll('#disziplinSwitch .seg')) {
    btn.classList.toggle('active', btn.dataset.disziplin === disziplinFilter);
  }
  updateTitle();
}

function setDisziplinFilter(next) {
  if (next !== 'all' && !DISZIPLINEN.includes(next)) return;
  disziplinFilter = next;
  localStorage.setItem(DISZIPLIN_KEY, next);
  const visibleIds = new Set(getFilteredMembers().map((m) => m.id));
  if (selectedMemberId && !visibleIds.has(selectedMemberId)) selectedMemberId = null;
  updateDisziplinUI();
  renderAll();
  if (currentView === 'attendance') loadAttendanceView();
}

for (const btn of document.querySelectorAll('#disziplinSwitch .seg')) {
  btn.addEventListener('click', () => setDisziplinFilter(btn.dataset.disziplin));
}

const nameCollator = new Intl.Collator('de', { sensitivity: 'base' });

function compareMembers(a, b) {
  return nameCollator.compare(a.vorname || '', b.vorname || '') ||
    nameCollator.compare(a.nachname || '', b.nachname || '');
}

async function init() {
  await loadStaticData();
  reloadFromStorage();
  updateDisziplinUI();
  renderPlanGuertelOptions();
  renderAll();
  setView('members');
  // Ladefehler dauerhaft anzeigen (showStatus blendet nach 4 s aus).
  if (staticDataError) {
    statusEl.textContent = staticDataError + ' – Seite mit Strg+F5 neu laden; der Ordner public/data muss vollständig vorhanden sein.';
    statusEl.style.color = '#ff6b6b';
  }
}

function renderAll() {
  invalidateAttendanceCounts();
  renderMemberList();
  renderMemberDetail();
  renderMemberTechniques();
  renderGraduation();
  renderOverviewMatrix();
}

function getFilteredMembers() {
  const filter = document.getElementById('activeFilter').value;
  let result;
  if (filter === 'ausgetreten') result = members.filter((m) => m.ausgetreten);
  else if (filter === 'all') result = members.slice();
  else if (filter === 'inactive') result = members.filter((m) => !m.active && !m.ausgetreten);
  else result = members.filter((m) => m.active && !m.ausgetreten);

  if (document.getElementById('filterWettkaempfer').checked) result = result.filter((m) => m.wettkaempfer);
  if (disziplinFilter !== 'all') result = result.filter((m) => memberDisziplin(m) === disziplinFilter);

  return result.sort(compareMembers);
}

// ---------- Mitglieder-Ansicht ----------

function renderMemberList() {
  const search = document.getElementById('memberSearch').value.trim().toLowerCase();
  const list = document.getElementById('memberList');
  list.innerHTML = '';
  const filtered = getFilteredMembers().filter((m) => memberFullName(m).toLowerCase().includes(search));
  for (const m of filtered) {
    const btn = document.createElement('button');
    btn.className =
      'pill' +
      (m.id === selectedMemberId ? ' selected' : '') +
      (m.gekuendigt ? ' gekuendigt' : '') +
      (m.ausgetreten ? ' ausgetreten' : '') +
      (m.probetraining ? ' probetraining' : '');
    btn.textContent = memberName(m);
    btn.onclick = () => {
      selectedMemberId = m.id;
      renderMemberList();
      renderMemberDetail();
      renderMemberTechniques();
    };
    list.appendChild(btn);
  }
}

function renderMemberDetail() {
  const detail = document.getElementById('memberDetail');
  const gekuendigtInfo = document.getElementById('memberGekuendigt');
  const member = members.find((m) => m.id === selectedMemberId);
  if (!member) {
    detail.classList.add('hidden');
    gekuendigtInfo.classList.add('hidden');
    return;
  }
  detail.classList.remove('hidden');
  const alter = currentAlter(member);
  document.getElementById('memberAge').textContent = alter != null ? `${alter} Jahre` : '';

  if (member.gekuendigt) {
    gekuendigtInfo.textContent = `Gekündigt zum ${member.austrittsdatum}`;
    gekuendigtInfo.classList.remove('hidden');
  } else {
    gekuendigtInfo.classList.add('hidden');
  }

  const activeCheckbox = document.getElementById('memberActive');
  activeCheckbox.checked = !!member.active;
  activeCheckbox.onchange = () => {
    setMemberActive(member.id, activeCheckbox.checked);
    renderMemberList();
    renderOverviewMatrix();
  };

  const FLAG_ID = { wettkaempfer: 'memberWettkaempfer', probetraining: 'memberProbetraining' };
  for (const field of Object.keys(FLAG_ID)) {
    const checkbox = document.getElementById(FLAG_ID[field]);
    checkbox.checked = !!member[field];
    checkbox.onchange = () => {
      setMemberFlag(member.id, field, checkbox.checked);
      renderMemberList();
      renderMemberTechniques();
      renderOverviewMatrix();
    };
  }

  const disziplinSelect = document.getElementById('memberDisziplin');
  disziplinSelect.value = memberDisziplin(member);
  disziplinSelect.onchange = () => {
    setMemberDisziplin(member.id, disziplinSelect.value);
    // Bei aktivem Filter verschwindet das Mitglied ggf. aus der Liste.
    const stillVisible = getFilteredMembers().some((m) => m.id === member.id);
    if (!stillVisible) selectedMemberId = null;
    renderAll();
  };

  const select = document.getElementById('memberGuertel');
  const disziplin = memberDisziplin(member);
  select.innerHTML = '';
  for (const belt of beltLevelsFor(disziplin)) {
    const opt = document.createElement('option');
    opt.value = belt;
    opt.textContent = beltLabel(belt, disziplin);
    select.appendChild(opt);
  }
  select.value = member.guertel;
  select.onchange = () => {
    setMemberGuertel(member.id, select.value);
    renderMemberList();
    renderMemberTechniques();
    renderOverviewMatrix();
  };
}

function renderMemberTechniques() {
  const container = document.getElementById('memberTechniques');
  const nextInfo = document.getElementById('memberNextInfo');
  container.innerHTML = '';
  nextInfo.classList.add('hidden');
  if (!selectedMemberId) return;

  const member = members.find((m) => m.id === selectedMemberId);
  if (!member) return;
  const disziplin = memberDisziplin(member);
  const next = nextGuertel(member);

  if (!next) {
    nextInfo.textContent = disziplin === 'Judo'
      ? 'Höchste Kyu-Graduierung erreicht (Dan-Anforderungen sind nicht Teil dieser App).'
      : 'Höchste Graduierung erreicht.';
    nextInfo.classList.remove('hidden');
    return;
  }
  if (!hasCatalog(member)) {
    nextInfo.textContent = `Nächster Gürtel: ${beltLabel(next, disziplin)}. Für ${disziplin} sind keine Prüfungsinhalte hinterlegt.`;
    nextInfo.classList.remove('hidden');
    return;
  }
  nextInfo.textContent = `Prüfungsinhalte für die nächste Graduierung: ${beltLabel(next, disziplin)}`;
  nextInfo.classList.remove('hidden');

  const relevant = techniques.filter((t) => t.guertel === next);
  if (!relevant.length) {
    nextInfo.textContent += ` – KEINE Einträge gefunden (Katalog: ${techniques.length} Einträge geladen).`;
    return;
  }
  appendTechniqueChecklist(container, member.id, relevant, 'chk_member', renderOverviewMatrix);
}

function appendTechniqueChecklist(container, memberId, techs, idPrefix, onToggle) {
  const categories = [...new Set(techs.map((t) => t.category))];
  for (const cat of categories) {
    const title = document.createElement('div');
    title.className = 'categoryTitle';
    title.textContent = cat;
    container.appendChild(title);

    for (const t of techs.filter((x) => x.category === cat)) {
      const done = isDone(memberId, t.id);
      const row = document.createElement('div');
      row.className = 'techItem' + (done ? ' done' : '');
      const checkboxId = `${idPrefix}_${t.id}`;
      row.innerHTML = `
        <input type="checkbox" id="${checkboxId}" ${done ? 'checked' : ''} />
        <label for="${checkboxId}">${escapeHtml(t.name)}<span class="techLabelSmall">${escapeHtml(t.label)}</span></label>
      `;
      row.querySelector('input').addEventListener('change', (e) => {
        toggleProgress(memberId, t.id, e.target.checked);
        row.classList.toggle('done', e.target.checked);
        onToggle();
      });
      container.appendChild(row);
    }
  }
}

function addMember() {
  const vorname = prompt('Vorname?');
  if (vorname === null) return;
  const nachname = prompt('Nachname?');
  if (nachname === null) return;
  const geburtsdatum = prompt('Geburtsdatum (JJJJ-MM-TT, optional)?') || null;
  const disziplin = disziplinFilter === 'all' ? DEFAULT_DISZIPLIN : disziplinFilter;
  const member = createMember({ vorname: vorname.trim(), nachname: nachname.trim(), geburtsdatum, disziplin });
  selectedMemberId = member.id;
  renderAll();
  showStatus(`${memberName(member)} wurde angelegt.`);
}

document.getElementById('btnAddMember').onclick = addMember;

// ---------- Graduierung (Ziel-Gürtel wählen, Mitglieder mit Prüfungsinhalten) ----------

function graduationBelts() {
  const present = new Set(techniques.map((t) => t.guertel));
  return BELT_LEVELS.filter((b) => present.has(b));
}

function renderGraduation() {
  const select = document.getElementById('graduationBelt');
  const container = document.getElementById('graduationList');
  // Nur Judo-Mitglieder haben einen Prüfungskatalog.
  const candidates = getFilteredMembers().filter(hasCatalog);
  const targetBelts = graduationBelts();
  const countFor = (belt) => candidates.filter((m) => nextGuertel(m) === belt).length;

  if (!targetBelts.includes(selectedGraduationBelt)) {
    selectedGraduationBelt = targetBelts.find((b) => countFor(b) > 0) || targetBelts[0] || null;
  }

  select.innerHTML = '';
  for (const belt of targetBelts) {
    const opt = document.createElement('option');
    opt.value = belt;
    opt.textContent = `${beltLabel(belt)} (${countFor(belt)})`;
    select.appendChild(opt);
  }
  select.value = selectedGraduationBelt || '';
  container.innerHTML = '';

  if (disziplinFilter === 'BJJ') {
    container.innerHTML = '<p class="childNextInfo">Für BJJ sind keine Prüfungsinhalte hinterlegt. Disziplin-Filter auf „Judo“ oder „Alle“ stellen.</p>';
    return;
  }
  if (!selectedGraduationBelt) {
    container.innerHTML = '<p class="childNextInfo">Es sind keine Prüfungsinhalte geladen.</p>';
    return;
  }
  localStorage.setItem(GRADUATION_BELT_KEY, selectedGraduationBelt);

  const techs = techniques.filter((t) => t.guertel === selectedGraduationBelt);
  const list = candidates.filter((m) => nextGuertel(m) === selectedGraduationBelt);
  if (!list.length) {
    container.innerHTML = `<p class="childNextInfo">Kein Mitglied arbeitet derzeit auf den ${escapeHtml(beltLabel(selectedGraduationBelt))} hin.</p>`;
    return;
  }
  for (const m of list) container.appendChild(buildGraduationCard(m, techs));
}

function buildGraduationCard(m, techs) {
  const card = document.createElement('div');
  card.className =
    'gradCard' +
    (m.gekuendigt ? ' gekuendigt' : '') +
    (m.ausgetreten ? ' ausgetreten' : '') +
    (m.probetraining ? ' probetraining' : '');

  const head = document.createElement('button');
  head.type = 'button';
  head.className = 'gradHead';
  head.innerHTML = `
    <span class="gradName">${escapeHtml(memberName(m))}</span>
    <span class="gradCount"></span>
    <span class="gradBar"><span class="gradBarFill"></span></span>
  `;
  const countEl = head.querySelector('.gradCount');
  const fillEl = head.querySelector('.gradBarFill');
  const body = document.createElement('div');
  body.className = 'gradBody';

  const updateHead = () => {
    const done = techs.filter((t) => isDone(m.id, t.id)).length;
    countEl.textContent = `${done}/${techs.length}`;
    fillEl.style.width = techs.length ? `${Math.round((done / techs.length) * 100)}%` : '0%';
    card.classList.toggle('complete', techs.length > 0 && done === techs.length);
  };

  const setOpen = (open) => {
    card.classList.toggle('open', open);
    head.setAttribute('aria-expanded', String(open));
    if (open) {
      expandedGraduation.add(m.id);
      if (!body.hasChildNodes()) {
        appendTechniqueChecklist(body, m.id, techs, `grad_${m.id}`, () => {
          updateHead();
          renderOverviewMatrix();
        });
      }
    } else {
      expandedGraduation.delete(m.id);
    }
  };

  head.onclick = () => setOpen(!card.classList.contains('open'));
  card.appendChild(head);
  card.appendChild(body);
  updateHead();
  if (expandedGraduation.has(m.id)) setOpen(true);
  return card;
}

document.getElementById('graduationBelt').addEventListener('change', (e) => {
  selectedGraduationBelt = e.target.value;
  renderGraduation();
});

document.getElementById('activeFilter').addEventListener('change', renderAll);
document.getElementById('filterWettkaempfer').addEventListener('change', renderAll);
document.getElementById('memberSearch').addEventListener('input', renderMemberList);

// ---------- Übersicht (Matrix) ----------

function renderOverviewMatrix() {
  const container = document.getElementById('overviewMatrix');
  if (!container) return;
  container.innerHTML = '';
  const visibleMembers = getFilteredMembers().filter(hasCatalog);
  if (!visibleMembers.length || !techniques.length) return;

  const filterMissing = document.getElementById('filterMissing').checked;
  const visibleTechniques = techniques.filter(
    (t) => !filterMissing || !visibleMembers.every((m) => isDone(m.id, t.id))
  );

  const table = document.createElement('table');
  table.className = 'matrixTable';

  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  headRow.appendChild(document.createElement('th'));
  for (const t of visibleTechniques) {
    const th = document.createElement('th');
    th.innerHTML = `${escapeHtml(t.name)}<span class="techLabelSmall">${escapeHtml(beltLabel(t.guertel))}</span>`;
    headRow.appendChild(th);
  }
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  for (const m of visibleMembers) {
    const row = document.createElement('tr');
    const nameCell = document.createElement('th');
    nameCell.className =
      'matrixRowHead' +
      (m.gekuendigt ? ' gekuendigt' : '') +
      (m.ausgetreten ? ' ausgetreten' : '') +
      (m.probetraining ? ' probetraining' : '');
    nameCell.textContent = memberName(m);
    row.appendChild(nameCell);

    for (const t of visibleTechniques) {
      const done = isDone(m.id, t.id);
      const cell = document.createElement('td');
      cell.className = 'matrixCell' + (done ? ' done' : '');
      if (filterMissing && done) {
        cell.classList.add('cell-hidden-filtered');
      } else {
        cell.textContent = done ? '✓' : '';
      }
      cell.onclick = () => {
        toggleProgress(m.id, t.id, !done);
        renderOverviewMatrix();
      };
      row.appendChild(cell);
    }
    tbody.appendChild(row);
  }
  table.appendChild(tbody);
  container.appendChild(table);
}

document.getElementById('filterMissing').addEventListener('change', renderOverviewMatrix);

// ---------- Trainingsplan (eigener Vorschlag, keine DJB-Vorgabe) ----------

function renderPlanGuertelOptions() {
  const guertelSelect = document.getElementById('planGuertel');
  guertelSelect.innerHTML = '';
  for (const belt of BELT_LEVELS.filter((b) => KYU_BY_BELT[b])) {
    const opt = document.createElement('option');
    opt.value = belt;
    opt.textContent = beltLabel(belt);
    guertelSelect.appendChild(opt);
  }
}

function renderPlanTable() {
  const guertel = document.getElementById('planGuertel').value;
  const container = document.getElementById('planTable');
  container.innerHTML = '';
  if (!guertel) return;

  const plan = loadTrainingsplan(guertel);
  if (!plan.length) {
    container.textContent = 'Für diese Graduierung liegt noch kein Trainingsplan vor.';
    return;
  }

  const table = document.createElement('table');
  table.className = 'matrixTable';
  const thead = document.createElement('thead');
  thead.innerHTML = '<tr><th>Woche</th><th>Schwerpunkt</th><th>Technik</th><th>Anwendung</th><th>Spiel</th></tr>';
  table.appendChild(thead);
  const tbody = document.createElement('tbody');
  for (const row of plan) {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${row.woche}</td><td>${escapeHtml(row.schwerpunkt)}</td><td>${escapeHtml(row.technik)}</td><td>${escapeHtml(row.anwendung)}</td><td>${escapeHtml(row.spiel)}</td>`;
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  container.appendChild(table);
}

document.getElementById('planGuertel').addEventListener('change', renderPlanTable);

// ---------- Anwesenheit ----------

let attendanceData = {};

function attendanceMembers() {
  return members
    .filter((m) => m.active && !m.ausgetreten && (disziplinFilter === 'all' || memberDisziplin(m) === disziplinFilter))
    .sort(compareMembers);
}

function loadAttendanceView() {
  attendanceData = getAttendance();

  const today = new Date().toISOString().slice(0, 10);
  const nextDate = nextTrainingDay(today);
  const isToday = nextDate === today;
  const nextInfo = document.getElementById('attendanceNextInfo');

  if (isToday && !attendanceData[nextDate]) {
    ensureSession(nextDate, attendanceData);
  }

  if (isToday) {
    nextInfo.classList.add('hidden');
  } else {
    nextInfo.textContent = `Heute kein Trainingstag. Nächstes Training: ${nextDate}`;
    nextInfo.classList.remove('hidden');
  }

  const sessionSelect = document.getElementById('attendanceSessionSelect');
  const dates = Object.keys(attendanceData).sort();
  sessionSelect.innerHTML = '';
  for (const date of dates) {
    const opt = document.createElement('option');
    opt.value = date;
    opt.textContent = date;
    sessionSelect.appendChild(opt);
  }
  sessionSelect.value = isToday ? nextDate : dates[dates.length - 1] || '';

  renderAttendanceList();
  renderAttendanceSummary();
}

function renderAttendanceList() {
  const date = document.getElementById('attendanceSessionSelect').value;
  const container = document.getElementById('attendanceList');
  const quickActions = document.getElementById('attendanceQuickActions');
  container.innerHTML = '';

  if (!date) {
    quickActions.classList.add('hidden');
    return;
  }
  quickActions.classList.remove('hidden');

  const sessionMap = attendanceData[date] || {};
  const allDates = Object.keys(attendanceData);
  const search = document.getElementById('attendanceSearch').value.trim().toLowerCase();
  const relevant = attendanceMembers().filter((m) => memberFullName(m).toLowerCase().includes(search));

  for (const m of relevant) {
    const present = !!sessionMap[m.id];

    const row = document.createElement('div');
    row.className = 'memberItem' + (present ? ' done' : '') + (m.probetraining ? ' probetraining' : '');
    const checkboxId = `att_${m.id}`;
    row.innerHTML = `
      <input type="checkbox" id="${checkboxId}" ${present ? 'checked' : ''} />
      <label for="${checkboxId}"><span class="memberLabelName"></span><span class="techLabelSmall"></span></label>
    `;
    const nameEl = row.querySelector('.memberLabelName');
    const pctEl = row.querySelector('.techLabelSmall');
    const updateLabels = () => {
      const attended = attendanceCountFor(m);
      nameEl.textContent = memberName(m);
      pctEl.textContent = `${allDates.length ? Math.round((attended / allDates.length) * 100) : 0}% Beteiligung`;
    };
    updateLabels();
    row.querySelector('input').addEventListener('change', (e) => {
      setAttendance(date, m.id, e.target.checked, attendanceData);
      invalidateAttendanceCounts();
      row.classList.toggle('done', e.target.checked);
      updateLabels();
    });
    container.appendChild(row);
  }
}

function renderAttendanceSummary() {
  const container = document.getElementById('attendanceSummary');
  container.innerHTML = '';

  const summary = getAttendanceSummary();
  if (!summary.months.length) {
    container.textContent = 'Noch keine Trainingstermine erfasst.';
    return;
  }

  // Nur nach Disziplin filtern (auch inaktive Mitglieder mit früherer Teilnahme bleiben sichtbar).
  const visibleIds = new Set(
    members
      .filter((m) => disziplinFilter === 'all' || memberDisziplin(m) === disziplinFilter)
      .map((m) => m.id)
  );
  summary.members = summary.members.filter((m) => visibleIds.has(m.id)).sort(compareMembers);

  const table = document.createElement('table');
  table.className = 'matrixTable';
  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  headRow.appendChild(document.createElement('th'));
  for (const month of summary.months) {
    const th = document.createElement('th');
    th.textContent = month;
    headRow.appendChild(th);
  }
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  for (const m of summary.members) {
    const row = document.createElement('tr');
    const nameCell = document.createElement('th');
    nameCell.className = 'matrixRowHead' + (m.probetraining ? ' probetraining' : '');
    nameCell.textContent = `${m.vorname} ${m.nachname}`;
    row.appendChild(nameCell);
    for (const month of summary.months) {
      const cell = document.createElement('td');
      const data = m.byMonth[month];
      cell.textContent = `${data.attended}/${data.total} (${data.pct}%)`;
      row.appendChild(cell);
    }
    tbody.appendChild(row);
  }
  table.appendChild(tbody);
  container.appendChild(table);
}

document.getElementById('attendanceSessionSelect').addEventListener('change', renderAttendanceList);
document.getElementById('attendanceSearch').addEventListener('input', renderAttendanceList);

document.getElementById('btnCreateSession').onclick = () => {
  const date = document.getElementById('attendanceDate').value;
  if (!date) {
    showStatus('Bitte ein Datum wählen.', true);
    return;
  }
  ensureSession(date, attendanceData);
  loadAttendanceView();
  document.getElementById('attendanceSessionSelect').value = date;
  renderAttendanceList();
};

document.getElementById('btnDeleteSession').onclick = () => {
  const date = document.getElementById('attendanceSessionSelect').value;
  if (!date) return;
  deleteSession(date, attendanceData);
  invalidateAttendanceCounts();
  loadAttendanceView();
};

document.getElementById('btnMarkAllPresent').onclick = () => bulkMarkAttendance(true);
document.getElementById('btnMarkAllAbsent').onclick = () => bulkMarkAttendance(false);

function bulkMarkAttendance(present) {
  const date = document.getElementById('attendanceSessionSelect').value;
  if (!date) return;
  for (const m of attendanceMembers()) {
    setAttendance(date, m.id, present, attendanceData);
  }
  invalidateAttendanceCounts();
  renderAttendanceList();
}

// ---------- Excel: Mitgliederliste exportieren/importieren ----------

function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

document.getElementById('btnExportMembers').onclick = () => {
  try {
    exportMembersList();
  } catch (err) {
    showStatus('Fehler beim Export: ' + err.message, true);
  }
};

document.getElementById('importMembersFile').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  showStatus('Importiere Mitgliederliste…');
  try {
    const buffer = await readFileAsArrayBuffer(file);
    const result = importMembersListFromExcel(buffer);
    renderAll();
    let msg = `Mitgliederliste importiert: ${result.created} neu angelegt, ${result.updated} aktualisiert, ${result.ausgetreten} ausgetreten.`;
    if (result.warnings.length) msg += ` ${result.warnings.length} Warnung(en), siehe Konsole.`;
    showStatus(msg, result.warnings.length > 0);
    if (result.warnings.length) console.warn(result.warnings.join('\n'));
  } catch (err) {
    showStatus('Fehler beim Import: ' + err.message, true);
  }
  e.target.value = '';
});

// ---------- Daten/Archiv (JSON-Backup) ----------

document.getElementById('btnExportBackup').onclick = () => {
  const backup = exportBackupObject();
  downloadBlob(
    new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }),
    `judo-archiv-${new Date().toISOString().slice(0, 10)}.json`
  );
  showStatus('Archiv wurde heruntergeladen.');
};

document.getElementById('importBackupFile').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const backup = JSON.parse(reader.result);
      importBackupObject(backup);
      renderAll();
      showStatus('Archiv wurde importiert.');
    } catch (err) {
      showStatus('Fehler beim Importieren: ' + err.message, true);
    }
  };
  reader.readAsText(file);
  e.target.value = '';
});

document.getElementById('btnClearAll').onclick = () => {
  if (!confirm('Wirklich ALLE lokalen Daten (Mitglieder, Fortschritt, Anwesenheit) auf diesem Gerät löschen? Vorher unbedingt ein Archiv exportieren!')) return;
  clearAllData();
  selectedMemberId = null;
  renderAll();
  showStatus('Alle lokalen Daten wurden gelöscht.');
};

// ---------- View-Umschaltung ----------

const VIEW_CONTAINERS = {
  members: 'viewMembers',
  graduation: 'viewGraduation',
  overview: 'viewOverview',
  plan: 'viewPlan',
  attendance: 'viewAttendance',
  backup: 'viewBackup',
  more: 'viewMore',
};
const NAV_BUTTONS = {
  members: 'btnViewMembers',
  attendance: 'btnViewAttendance',
  graduation: 'btnViewGraduation',
  more: 'btnViewMore',
};
const MORE_VIEWS = ['overview', 'plan', 'backup', 'more'];
const FILTER_VIEWS = ['members', 'graduation', 'overview'];

function setView(view) {
  currentView = view;
  for (const [name, id] of Object.entries(VIEW_CONTAINERS)) {
    document.getElementById(id).classList.toggle('hidden', name !== view);
  }
  const activeNav = MORE_VIEWS.includes(view) ? 'more' : view;
  for (const [navView, btnId] of Object.entries(NAV_BUTTONS)) {
    document.getElementById(btnId).classList.toggle('active', navView === activeNav);
  }
  document.getElementById('filterBox').classList.toggle('hidden', !FILTER_VIEWS.includes(view));
}

document.getElementById('btnViewMembers').onclick = () => {
  setView('members');
  renderMemberList();
  renderMemberTechniques();
};
document.getElementById('btnViewMore').onclick = () => setView('more');
document.getElementById('btnViewGraduation').onclick = () => { setView('graduation'); renderGraduation(); };
document.getElementById('btnViewOverview').onclick = () => { setView('overview'); renderOverviewMatrix(); };
document.getElementById('btnViewPlan').onclick = () => { setView('plan'); renderPlanTable(); };
document.getElementById('btnViewAttendance').onclick = () => { setView('attendance'); loadAttendanceView(); };
document.getElementById('btnViewBackup').onclick = () => setView('backup');

// ---------- Start ----------

document.getElementById('attendanceDate').value = new Date().toISOString().slice(0, 10);

init();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}
