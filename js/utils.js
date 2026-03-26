/**
 * utils.js — פונקציות עזר גלובליות
 * כל הפונקציות חשופות על window (ללא מודולים)
 */

'use strict';

// ─── ערבוב מערך — אלגוריתם Fisher-Yates ───────────────────────────────────
function shuffle(array) {
  // עובדים על עותק כדי לא לשנות את המקור
  const arr = array.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    // החלפה בין אינדקסים i ו-j
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ─── פורמט זמן — "mm:ss" ───────────────────────────────────────────────────
function formatTime(seconds) {
  if (typeof seconds !== 'number' || isNaN(seconds) || seconds < 0) {
    return '00:00';
  }
  const totalSec = Math.floor(seconds);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  // ריפוד עם אפסים לפי הצורך
  return String(mins).padStart(2, '0') + ':' + String(secs).padStart(2, '0');
}

// ─── פורמט תאריך עברי קצר — "DD/MM/YYYY" ──────────────────────────────────
function formatDate(date) {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    return '';
  }
  const day   = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0'); // חודשים מתחילים מ-0
  const year  = date.getFullYear();
  return day + '/' + month + '/' + year;
}

// ─── מספר שבוע ISO ─────────────────────────────────────────────────────────
function getWeekNumber(date) {
  if (!(date instanceof Date) || isNaN(date.getTime())) {
    return 1;
  }
  // לפי תקן ISO 8601: שבוע מתחיל ביום שני
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  // יום ראשון = 0, אנו רוצים שני = 1 כ-0
  const dayNum = d.getUTCDay() || 7;
  // מקדמים ל-יום חמישי הקרוב
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

// ─── Debounce — מונע קריאות חוזרות מהירות ──────────────────────────────────
function debounce(fn, ms) {
  let timer = null;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => {
      fn.apply(this, args);
    }, ms);
  };
}

// ─── הגנה מ-XSS — בריחה מתווים מסוכנים ──────────────────────────────────
function sanitizeHTML(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ─── הגבלת ערך למינימום/מקסימום ──────────────────────────────────────────
function clamp(val, min, max) {
  if (typeof val !== 'number') return min;
  return Math.min(Math.max(val, min), max);
}

// ─── פורמט ציון — "85%" ───────────────────────────────────────────────────
function formatScore(score) {
  if (typeof score !== 'number' || isNaN(score)) return '0%';
  const clamped = clamp(Math.round(score), 0, 100);
  return clamped + '%';
}

// ─── צבע לפי ציון (אדום / כתום / ירוק) ──────────────────────────────────
function scoreColor(score) {
  if (score >= 80) return '#22c55e'; // ירוק
  if (score >= 60) return '#f59e0b'; // כתום-ענבר
  return '#ef4444';                  // אדום
}

// ─── אחוזים מתוך שלם ──────────────────────────────────────────────────────
function toPercent(part, total) {
  if (!total || total === 0) return 0;
  return Math.round((part / total) * 100);
}

// ─── בדיקה: האם תאריך הוא היום ──────────────────────────────────────────
function isToday(date) {
  if (!(date instanceof Date)) {
    date = new Date(date);
  }
  const today = new Date();
  return (
    date.getDate()     === today.getDate() &&
    date.getMonth()    === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}

// ─── הבדל בין שני תאריכים בימים ──────────────────────────────────────────
function daysBetween(dateA, dateB) {
  const a = new Date(dateA);
  const b = new Date(dateB);
  // נאפס לחצות כדי לספור ימים שלמים בלבד
  a.setHours(0, 0, 0, 0);
  b.setHours(0, 0, 0, 0);
  const diff = Math.abs(b - a);
  return Math.round(diff / 86400000);
}

// ─── קבלת תאריך היום כמחרוזת ISO (YYYY-MM-DD) ────────────────────────────
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

// ─── Generate simple unique ID ───────────────────────────────────────────
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ─── חישוב ממוצע מ-array של מספרים ──────────────────────────────────────
function average(arr) {
  if (!arr || arr.length === 0) return 0;
  const sum = arr.reduce((acc, n) => acc + n, 0);
  return sum / arr.length;
}

// ─── קיצור טקסט ארוך ─────────────────────────────────────────────────────
function truncate(str, maxLen) {
  if (typeof str !== 'string') return '';
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 1) + '…';
}

// ─── הצגת הודעת Toast ─────────────────────────────────────────────────────
function showToast(message, type) {
  // type: 'success' | 'error' | 'info'
  type = type || 'info';

  // הסרת Toast קודם אם קיים
  const existing = document.getElementById('toast-notification');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'toast-notification';
  toast.setAttribute('role', 'alert');
  toast.setAttribute('aria-live', 'polite');

  // צבעי רקע לפי סוג
  const colors = {
    success: '#22c55e',
    error:   '#ef4444',
    info:    '#3b82f6'
  };
  const bgColor = colors[type] || colors.info;

  toast.style.cssText = [
    'position:fixed',
    'bottom:24px',
    'right:24px',
    'padding:12px 20px',
    'border-radius:8px',
    'color:#fff',
    'font-size:15px',
    'font-family:inherit',
    'direction:rtl',
    'z-index:9999',
    'box-shadow:0 4px 16px rgba(0,0,0,0.2)',
    'transition:opacity 0.4s',
    'max-width:320px',
    'background:' + bgColor
  ].join(';');

  toast.textContent = message;
  document.body.appendChild(toast);

  // הסתרה אחרי 3 שניות
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 400);
  }, 3000);
}

// ─── בטיחות: חשיפה לחלון הגלובלי ─────────────────────────────────────────
window.shuffle        = shuffle;
window.formatTime     = formatTime;
window.formatDate     = formatDate;
window.getWeekNumber  = getWeekNumber;
window.debounce       = debounce;
window.sanitizeHTML   = sanitizeHTML;
window.clamp          = clamp;
window.formatScore    = formatScore;
window.scoreColor     = scoreColor;
window.toPercent      = toPercent;
window.isToday        = isToday;
window.daysBetween    = daysBetween;
window.todayISO       = todayISO;
window.generateId     = generateId;
window.average        = average;
window.truncate       = truncate;
window.showToast      = showToast;
