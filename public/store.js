// ============================================================
// Datenhaltung der App: alles liegt NUR im Browser-Speicher (localStorage)
// dieses Geräts. Kein Server. Techniken/Trainingsplan sind statische,
// mitgelieferte JSON-Dateien (data/*.js) ohne Personendaten.
// ============================================================

const STORAGE_KEYS = {
  members: 'jdt_members',
  progress: 'jdt_progress',
  attendance: 'jdt_attendance',
};

function loadJson(key, fallback) {
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch (err) {
    return fallback;
  }
}

function saveJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    showStatus('Speichern fehlgeschlagen (privater Modus oder Speicher voll?): ' + err.message, true);
    return false;
  }
}

// ---------- Gürtel-/Kyu-Logik (DJB: 8.-1. Kyu, eine Reihe für alle) ----------

// Judo: 'Weiß' = noch keine Graduierung. Danach 8. Kyu (weiß-gelb) bis 1. Kyu (braun).
const BELT_LEVELS = ['Weiß', 'Weiß-Gelb', 'Gelb', 'Gelb-Orange', 'Orange', 'Orange-Grün', 'Grün', 'Blau', 'Braun'];
const KYU_BY_BELT = {
  'Weiß-Gelb': 8, Gelb: 7, 'Gelb-Orange': 6, Orange: 5, 'Orange-Grün': 4, Grün: 3, Blau: 2, Braun: 1,
};

// Disziplinen: BJJ hat eine eigene Gürtelreihe, aber (noch) keinen Prüfungskatalog.
const DISZIPLINEN = ['Judo', 'BJJ'];
const DEFAULT_DISZIPLIN = 'Judo';
const BELT_LEVELS_BY_DISZIPLIN = {
  Judo: BELT_LEVELS,
  BJJ: ['Weiß', 'Blau', 'Lila', 'Braun', 'Schwarz'],
};

function memberDisziplin(member) {
  return DISZIPLINEN.includes(member.disziplin) ? member.disziplin : DEFAULT_DISZIPLIN;
}

function beltLevelsFor(disziplin) {
  return BELT_LEVELS_BY_DISZIPLIN[disziplin] || BELT_LEVELS;
}

function beltLabel(belt, disziplin) {
  const kyu = (disziplin || DEFAULT_DISZIPLIN) === 'Judo' ? KYU_BY_BELT[belt] : null;
  return kyu ? `${kyu}. Kyu – ${belt}` : belt;
}

function beltRank(name, disziplin) {
  const idx = beltLevelsFor(disziplin).indexOf(name);
  return idx === -1 ? 0 : idx;
}

function nextGuertel(member) {
  const levels = beltLevelsFor(memberDisziplin(member));
  const idx = levels.indexOf(member.guertel);
  if (idx === -1 || idx === levels.length - 1) return null;
  return levels[idx + 1];
}

// Nur Judo hat einen Prüfungskatalog.
function hasCatalog(member) {
  return memberDisziplin(member) === 'Judo';
}

function calcAlterFromGeburtsdatum(geburtsdatum) {
  if (!geburtsdatum) return null;
  const birth = new Date(geburtsdatum);
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  let alter = now.getFullYear() - birth.getFullYear();
  if (now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) {
    alter--;
  }
  return alter;
}

// Alter wird bei jedem Aufruf live aus dem Geburtsdatum berechnet, damit es
// sich automatisch mit jedem Geburtstag aktualisiert. Das gespeicherte
// member.alter dient nur als Fallback für Mitglieder ohne Geburtsdatum.
function currentAlter(member) {
  return member.geburtsdatum ? calcAlterFromGeburtsdatum(member.geburtsdatum) : member.alter;
}

function sortMembersByGraduierung(list) {
  return [...list].sort((a, b) => {
    const discDiff = DISZIPLINEN.indexOf(memberDisziplin(a)) - DISZIPLINEN.indexOf(memberDisziplin(b));
    if (discDiff !== 0) return discDiff;
    const diff = beltRank(a.guertel, memberDisziplin(a)) - beltRank(b.guertel, memberDisziplin(b));
    if (diff !== 0) return diff;
    return (a.nachname + a.vorname).localeCompare(b.nachname + b.vorname, 'de');
  });
}

function sortTechniquesByGraduierung(list) {
  return [...list].sort((a, b) => beltRank(a.guertel, 'Judo') - beltRank(b.guertel, 'Judo'));
}

// ---------- Bayerische Feiertage + feste Trainingstage ----------
// Vereinsspezifisch: Trainingstage (TRAINING_WEEKDAYS: 0 = So ... 6 = Sa)
// und Feiertagsregion bei Bedarf hier anpassen.

const TRAINING_WEEKDAYS = [2, 4]; // Dienstag, Donnerstag

function easterSunday(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

function addDays(date, days) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function toIso(date) {
  return date.toISOString().slice(0, 10);
}

function getBayernHolidays(year) {
  const easter = easterSunday(year);
  const dates = [
    new Date(Date.UTC(year, 0, 1)),
    new Date(Date.UTC(year, 0, 6)),
    addDays(easter, -2),
    addDays(easter, 1),
    new Date(Date.UTC(year, 4, 1)),
    addDays(easter, 39),
    addDays(easter, 50),
    addDays(easter, 60),
    new Date(Date.UTC(year, 7, 15)),
    new Date(Date.UTC(year, 9, 3)),
    new Date(Date.UTC(year, 10, 1)),
    new Date(Date.UTC(year, 11, 25)),
    new Date(Date.UTC(year, 11, 26)),
  ];
  return new Set(dates.map(toIso));
}

function isBayernHoliday(dateStr) {
  const year = Number(dateStr.slice(0, 4));
  return getBayernHolidays(year).has(dateStr);
}

function nextTrainingDay(fromDateStr) {
  const start = new Date(`${fromDateStr}T00:00:00Z`);
  for (let i = 0; i < 14; i++) {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() + i);
    const iso = d.toISOString().slice(0, 10);
    if (TRAINING_WEEKDAYS.includes(d.getUTCDay()) && !isBayernHoliday(iso)) return iso;
  }
  return null;
}

// ---------- Statische Trainingsdaten (Prüfungsinhalte, Trainingsplan) ----------

let techniques = [];
let trainingsplan = {};
let staticDataError = '';

// Katalog und Plan kommen als Skripte (data/*.js) – funktioniert auch per Doppelklick (file://).
async function loadStaticData() {
  const errors = [];
  const data = window.JUDO_TECHNIQUES;
  if (Array.isArray(data) && data.length) {
    techniques = sortTechniquesByGraduierung(data);
  } else {
    techniques = [];
    errors.push('Prüfungsinhalte nicht geladen (data/techniques.js fehlt oder ist leer)');
  }
  if (window.JUDO_TRAININGSPLAN && typeof window.JUDO_TRAININGSPLAN === 'object') {
    trainingsplan = window.JUDO_TRAININGSPLAN;
  } else {
    trainingsplan = {};
    errors.push('Trainingsplan nicht geladen (data/trainingsplan.js fehlt)');
  }
  staticDataError = errors.join(' | ');
  if (staticDataError) console.error(staticDataError);
}

function loadTrainingsplan(guertel) {
  return trainingsplan[guertel] || [];
}

// ---------- Mitglieder ----------

let members = [];
let progress = {};

function reloadFromStorage() {
  members = loadJson(STORAGE_KEYS.members, []);
  progress = loadJson(STORAGE_KEYS.progress, {});
}

function persistMembers() {
  members = sortMembersByGraduierung(members);
  saveJson(STORAGE_KEYS.members, members);
}

function markTechniquesUpToBeltAsDone(member) {
  if (!hasCatalog(member)) return;
  const newRank = beltRank(member.guertel, 'Judo');
  if (!progress[member.id]) progress[member.id] = {};
  for (const t of techniques) {
    if (beltRank(t.guertel, 'Judo') <= newRank) {
      progress[member.id][t.id] = true;
    }
  }
  saveJson(STORAGE_KEYS.progress, progress);
}

function generateMemberId() {
  return `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

function createMember({ vorname, nachname, geburtsdatum, disziplin }) {
  const member = {
    id: generateMemberId(),
    vorname: vorname || '',
    nachname: nachname || '',
    geburtsdatum: geburtsdatum || null,
    alter: calcAlterFromGeburtsdatum(geburtsdatum),
    austrittsdatum: null,
    active: true,
    disziplin: DISZIPLINEN.includes(disziplin) ? disziplin : DEFAULT_DISZIPLIN,
    guertel: 'Weiß',
    gekuendigt: false,
    ausgetreten: false,
    wettkaempfer: false,
    probetraining: true,
  };
  members.push(member);
  persistMembers();
  return member;
}

function setMemberGuertel(memberId, guertel) {
  const member = members.find((m) => m.id === memberId);
  if (!member) return;
  if (!beltLevelsFor(memberDisziplin(member)).includes(guertel)) return;
  member.guertel = guertel;
  markTechniquesUpToBeltAsDone(member);
  persistMembers();
}

// Gürtel bleibt, wenn der Name auch in der neuen Reihe existiert ("Weiß", "Braun"), sonst Reset auf "Weiß".
function setMemberDisziplin(memberId, disziplin) {
  const member = members.find((m) => m.id === memberId);
  if (!member || !DISZIPLINEN.includes(disziplin)) return;
  member.disziplin = disziplin;
  if (!beltLevelsFor(disziplin).includes(member.guertel)) member.guertel = 'Weiß';
  persistMembers();
}

function setMemberActive(memberId, active) {
  const member = members.find((m) => m.id === memberId);
  if (!member) return;
  member.active = Boolean(active);
  persistMembers();
}

function setMemberFlag(memberId, field, value) {
  const member = members.find((m) => m.id === memberId);
  if (!member) return;
  member[field] = Boolean(value);
  persistMembers();
}

function isDone(memberId, techniqueId) {
  return !!(progress[memberId] && progress[memberId][techniqueId]);
}

function toggleProgress(memberId, techniqueId, done) {
  if (!progress[memberId]) progress[memberId] = {};
  if (done) progress[memberId][techniqueId] = true;
  else delete progress[memberId][techniqueId];
  saveJson(STORAGE_KEYS.progress, progress);
}

// ---------- Anwesenheit (eine Trainingsgruppe: { Datum: { Mitglied: bool } }) ----------

function getAttendance() {
  return loadJson(STORAGE_KEYS.attendance, {});
}

function saveAttendance(attendance) {
  saveJson(STORAGE_KEYS.attendance, attendance);
}

function ensureSession(date, attendance) {
  if (!attendance[date]) attendance[date] = {};
  saveAttendance(attendance);
}

function deleteSession(date, attendance) {
  delete attendance[date];
  saveAttendance(attendance);
}

function setAttendance(date, memberId, present, attendance) {
  if (!attendance[date]) attendance[date] = {};
  attendance[date][memberId] = present;
  saveAttendance(attendance);
}

function getAttendanceSummary() {
  const attendance = getAttendance();
  const dates = Object.keys(attendance).sort();
  const months = [...new Set(dates.map((d) => d.slice(0, 7)))].sort();

  const totalByMonth = {};
  for (const month of months) {
    totalByMonth[month] = dates.filter((d) => d.slice(0, 7) === month).length;
  }

  const relevantMembers = members.filter((m) => !m.ausgetreten);
  return {
    months,
    members: relevantMembers.map((m) => {
      const byMonth = {};
      for (const month of months) {
        const attended = dates.filter((d) => d.slice(0, 7) === month && attendance[d][m.id]).length;
        byMonth[month] = {
          attended,
          total: totalByMonth[month],
          pct: totalByMonth[month] ? Math.round((attended / totalByMonth[month]) * 100) : 0,
        };
      }
      return { id: m.id, vorname: m.vorname, nachname: m.nachname, probetraining: m.probetraining, byMonth };
    }),
  };
}

// ---------- Excel: Mitgliederliste exportieren/importieren ----------

function excelDateToIso(serial) {
  if (!serial || Number.isNaN(Number(serial))) return null;
  const utcDays = Math.floor(Number(serial) - 25569);
  const date = new Date(utcDays * 86400 * 1000);
  return date.toISOString().slice(0, 10);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function exportMembersList() {
  const list = sortMembersByGraduierung(members.filter((m) => !m.ausgetreten));
  const header = [
    'Nr.', 'Vorname', 'Nachname', 'Geburtsdatum', 'Alter', 'Austrittsdatum', 'Status',
    'Disziplin', 'Gürtel', 'Wettkämpfer',
  ];
  const dataRows = list.map((m) => [
    m.id, m.vorname, m.nachname, m.geburtsdatum || '', currentAlter(m) ?? '', m.austrittsdatum || '',
    m.active ? 'Aktiv' : 'Inaktiv',
    memberDisziplin(m),
    m.guertel,
    m.wettkaempfer ? 'Ja' : 'Nein',
  ]);
  const ws = XLSX.utils.aoa_to_sheet([header, ...dataRows]);
  ws['!cols'] = [
    { wch: 10 }, { wch: 16 }, { wch: 16 }, { wch: 12 }, { wch: 8 }, { wch: 12 }, { wch: 10 },
    { wch: 10 }, { wch: 14 }, { wch: 12 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Mitgliederliste');
  const wbout = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
  downloadBlob(new Blob([wbout], { type: 'application/octet-stream' }), 'Mitgliederliste.xlsx');
}

function normalizeHeader(text) {
  return String(text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

// Spaltennamen statt fester Position auswerten - robust gegenüber
// abweichender Spaltenreihenfolge/-schreibweise in importierten Dateien.
const MEMBER_LIST_COLUMN_ALIASES = {
  id: ['nr', 'mitglnr', 'mitgliedsnr', 'id'],
  vorname: ['vorname'],
  nachname: ['nachname'],
  geburtsdatum: ['geburtsdatum'],
  alter: ['alter'],
  austrittsdatum: ['austrittsdatum'],
  status: ['status'],
  disziplin: ['disziplin', 'sportart'],
  guertel: ['gurtel'],
  wettkaempfer: ['wettkampfer'],
};
// Fallback-Positionen nur für Spalten OHNE gefundenen Namen (Standardlayout der Export-Datei).
const MEMBER_LIST_COLUMN_DEFAULTS = {
  id: 0, vorname: 1, nachname: 2, geburtsdatum: 3, alter: 4, austrittsdatum: 5, status: 6,
  disziplin: 7, guertel: 8, wettkaempfer: 9,
};

function resolveMemberListColumns(headerRow) {
  const normalized = headerRow.map(normalizeHeader);
  const cols = {};
  for (const [key, aliases] of Object.entries(MEMBER_LIST_COLUMN_ALIASES)) {
    const idx = normalized.findIndex((h) => aliases.includes(h));
    // Disziplin hat keinen Positions-Fallback: fehlt die Spalte, gilt überall "Judo".
    cols[key] = idx !== -1 ? idx : key === 'disziplin' ? -1 : MEMBER_LIST_COLUMN_DEFAULTS[key];
  }
  return cols;
}

function parseDisziplinCell(value) {
  const text = String(value || '').trim().toLowerCase().replace(/[^a-z]/g, '');
  if (!text) return { disziplin: DEFAULT_DISZIPLIN, valid: true };
  if (text === 'judo') return { disziplin: 'Judo', valid: true };
  if (text === 'bjj' || text === 'brazilianjiujitsu') return { disziplin: 'BJJ', valid: true };
  return { disziplin: DEFAULT_DISZIPLIN, valid: false };
}

function parseDatumCell(value) {
  if (value === '' || value == null) return null;
  if (value instanceof Date) return toIso(value);
  if (typeof value === 'number') return excelDateToIso(value);
  const text = String(value).trim();
  if (!text) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : toIso(parsed);
}

function importMembersListFromExcel(arrayBuffer) {
  const wb = XLSX.read(arrayBuffer, { type: 'array' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  if (rows.length < 2) throw new Error('Die Datei enthält keine Daten.');

  const cols = resolveMemberListColumns(rows[0]);
  const byId = new Map(members.map((m) => [m.id, m]));
  const importedIds = new Set();
  let created = 0;
  let updated = 0;
  let ausgetreten = 0;
  const warnings = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const memberId = String(row[cols.id] || '').trim();
    if (!memberId) continue;
    importedIds.add(memberId);

    const vorname = String(row[cols.vorname] || '').trim();
    const nachname = String(row[cols.nachname] || '').trim();
    const geburtsdatum = parseDatumCell(row[cols.geburtsdatum]);
    const austrittsdatum = parseDatumCell(row[cols.austrittsdatum]);
    const alterInput = String(row[cols.alter] || '').trim();
    const status = String(row[cols.status] || '').trim();
    const disziplinRaw = cols.disziplin >= 0 ? row[cols.disziplin] : '';
    const disziplinParsed = parseDisziplinCell(disziplinRaw);
    if (!disziplinParsed.valid) {
      warnings.push(`Mitglied ${memberId}: Disziplin "${String(disziplinRaw).trim()}" ist unbekannt (erlaubt: ${DISZIPLINEN.join(', ')}), auf "${DEFAULT_DISZIPLIN}" gesetzt.`);
    }
    const guertelInput = String(row[cols.guertel] || '').trim();
    const wettkaempfer = String(row[cols.wettkaempfer] || '').trim();

    const rawAlter = alterInput === '' ? null : Number(alterInput);
    const alterFromSpalte = Number.isNaN(rawAlter) ? null : rawAlter;
    const alter = geburtsdatum ? calcAlterFromGeburtsdatum(geburtsdatum) : alterFromSpalte;

    let member = byId.get(memberId);
    const isNew = !member;
    if (isNew) {
      member = {
        id: memberId,
        vorname,
        nachname,
        geburtsdatum: geburtsdatum || null,
        alter,
        austrittsdatum: austrittsdatum || null,
        active: true,
        disziplin: disziplinParsed.disziplin,
        guertel: 'Weiß',
        gekuendigt: Boolean(austrittsdatum),
        ausgetreten: false,
        wettkaempfer: false,
        probetraining: false,
      };
      byId.set(memberId, member);
    } else {
      member.ausgetreten = false;
      if (geburtsdatum) member.geburtsdatum = geburtsdatum;
      member.austrittsdatum = austrittsdatum || null;
    }

    member.active = status.toLowerCase() === 'inaktiv' ? false : true;
    // Spalte vorhanden -> Excel ist maßgeblich; fehlt sie, bleibt die bestehende Disziplin erhalten.
    if (isNew || cols.disziplin >= 0) member.disziplin = disziplinParsed.disziplin;
    if (alter != null) member.alter = alter;

    // Judo: akzeptiert "Gelb", "7. Kyu – Gelb" oder "7. Kyu". BJJ: Weiß/Blau/Lila/Braun/Schwarz.
    const levels = beltLevelsFor(memberDisziplin(member));
    const kyuMatch = memberDisziplin(member) === 'Judo' ? guertelInput.match(/(\d)\.\s*Kyu/i) : null;
    const byKyu = kyuMatch ? Object.keys(KYU_BY_BELT).find((b) => KYU_BY_BELT[b] === Number(kyuMatch[1])) : null;
    const plainBelt = guertelInput.split('–').pop().trim();
    if (levels.includes(guertelInput)) member.guertel = guertelInput;
    else if (levels.includes(plainBelt)) member.guertel = plainBelt;
    else if (byKyu) member.guertel = byKyu;
    else {
      member.guertel = 'Weiß';
      if (guertelInput) {
        warnings.push(`Mitglied ${memberId}: Gürtel "${guertelInput}" ist für ${memberDisziplin(member)} ungültig, auf "${member.guertel}" zurückgesetzt.`);
      }
    }
    member.wettkaempfer = wettkaempfer.toLowerCase() === 'ja';

    if (isNew) created++;
    else updated++;
  }

  for (const [id, current] of byId) {
    if (!importedIds.has(id) && !current.ausgetreten) {
      current.ausgetreten = true;
      current.active = false;
      ausgetreten++;
    }
  }

  members = Array.from(byId.values());
  persistMembers();
  return { created, updated, ausgetreten, warnings };
}

// ---------- JSON-Archivierung (Backup) ----------

const BACKUP_VERSION = 1;

function exportBackupObject() {
  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    members: loadJson(STORAGE_KEYS.members, []),
    progress: loadJson(STORAGE_KEYS.progress, {}),
    attendance: loadJson(STORAGE_KEYS.attendance, {}),
  };
}

function importBackupObject(backup) {
  if (!backup || !Array.isArray(backup.members)) {
    throw new Error('Diese Datei sieht nicht wie ein gültiges Archiv aus (keine Mitgliederliste gefunden).');
  }
  saveJson(STORAGE_KEYS.members, backup.members);
  saveJson(STORAGE_KEYS.progress, backup.progress || {});
  saveJson(STORAGE_KEYS.attendance, backup.attendance || {});
  reloadFromStorage();
}

function clearAllData() {
  localStorage.removeItem(STORAGE_KEYS.members);
  localStorage.removeItem(STORAGE_KEYS.progress);
  localStorage.removeItem(STORAGE_KEYS.attendance);
  reloadFromStorage();
}
