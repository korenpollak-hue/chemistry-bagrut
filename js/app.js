/**
 * app.js — אתחול האפליקציה וניהול ניווט
 * תלות: utils.js, storage.js (ו-quiz/flashcard/simulator/progress לפי דף)
 *
 * זיהוי דף לפי:
 *   1. data-page attribute על <body>
 *   2. שם קובץ ב-URL
 *
 * דפים נתמכים:
 *   index      — דף הבית עם לוח בקרה
 *   quiz       — חידון לפי נושא
 *   flashcards — כרטיסיות SM-2
 *   simulator  — מבחן מלא
 *   progress   — גרפי התקדמות
 */

'use strict';

const App = {

  // ─── מצב ───────────────────────────────────────────────────────────────
  currentPage: null,
  studyPlan:   null, // נטען מ-data/study-plan.json

  // ─── נקודת כניסה ─────────────────────────────────────────────────────────
  init() {
    // זיהוי דף
    this.currentPage = this._detectPage();

    // אתחול storage בסיסי
    Storage.initStudyStart();
    Storage.updateStreak();

    // עדכון ניווט
    this._updateNav();

    // הגדרת כיוון RTL גלובלית
    document.documentElement.setAttribute('dir', 'rtl');
    document.documentElement.setAttribute('lang', 'he');

    // האזנה לשינויים ב-URL (SPA-style אם צריך)
    window.addEventListener('popstate', () => {
      this.currentPage = this._detectPage();
      this._initPage();
    });

    // אתחול לפי דף
    this._initPage();

    // ייצוא/יבוא נתונים — אם קיים כפתור
    this._bindDataButtons();

    console.info('[App] אותחל בדף:', this.currentPage);
  },

  // ─── זיהוי דף ─────────────────────────────────────────────────────────────
  _detectPage() {
    // 1. data-page attribute על body
    const bodyPage = document.body.getAttribute('data-page');
    if (bodyPage) return bodyPage;

    // 2. שם קובץ ב-URL
    const path     = window.location.pathname;
    const filename = path.split('/').pop().replace('.html', '').toLowerCase();

    const pageMap = {
      '':           'index',
      'index':      'index',
      'quiz':       'quiz',
      'flashcards': 'flashcards',
      'simulator':  'simulator',
      'progress':   'progress'
    };

    return pageMap[filename] || 'index';
  },

  // ─── אתחול לפי דף ────────────────────────────────────────────────────────
  _initPage() {
    switch (this.currentPage) {
      case 'index':
        this._loadStudyPlan().then(() => this.updateDashboard());
        break;

      case 'quiz':
        this._initQuizPage();
        break;

      case 'flashcards':
        this._initFlashcardsPage();
        break;

      case 'simulator':
        this._initSimulatorPage();
        break;

      case 'progress':
        // Progress.loadAll() מחכה עד שה-DOM מוכן
        if (typeof Progress !== 'undefined') {
          Progress.loadAll();
        }
        break;

      default:
        break;
    }
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  דף הבית — לוח בקרה
  // ══════════════════════════════════════════════════════════════════════════

  updateDashboard() {
    const progressData = Storage.getProgress();
    const streak       = Storage.getStreak();
    const quizHistory  = Storage.getQuizHistory();

    // ─ סטריק ─
    this._setText('dash-streak',    streak.current + ' ימים');
    this._setText('dash-streak-longest', streak.longest + ' ימים');

    // ─ ציון ממוצע ─
    this._setText('dash-avg-score', formatScore(progressData.totalScore || 0));

    // ─ כמה נושאים נלמדו היום ─
    const todayStr = todayISO();
    const topicsToday = Object.values(progressData.topicProgress || {})
      .filter(t => t.lastStudied === todayStr).length;
    this._setText('dash-topics-today', topicsToday + ' נושאים');

    // ─ רינדור מיני-גרף על דף הבית ─
    if (document.getElementById('dash-mini-chart')) {
      const lineData = quizHistory.slice(-10).map(h => ({
        date:  h.date || todayStr,
        score: h.score
      }));
      if (typeof Progress !== 'undefined') {
        Progress.renderLineChart('dash-mini-chart', lineData);
      }
    }

    // ─ מה ללמוד היום ─
    const todayTask = this.getTodayTask();
    if (todayTask) {
      this._setText('dash-today-task', todayTask.title || todayTask.topicId || 'כימיה כללית');
      const todayLink = document.getElementById('dash-today-link');
      if (todayLink && todayTask.topicId) {
        todayLink.href = `quiz.html?topic=${encodeURIComponent(todayTask.topicId)}`;
      }
    }

    // ─ כרטיסיות לחזרה היום ─
    if (typeof Storage !== 'undefined') {
      const dueCount = this._getDueCount();
      this._setText('dash-due-cards', dueCount + ' כרטיסיות');
    }

    // ─ רינדור נושאים על דף הבית ─
    this._renderTopicGrid(progressData.topicProgress || {});
  },

  // ─── ספירת כרטיסיות לחזרה (ניסיון בלי fetch) ─────────────────────────────
  _getDueCount() {
    // נסה לקרוא מ-cache אם נטען קודם
    if (this._cachedFlashcards) {
      return Storage.getDueFlashcards(this._cachedFlashcards).length;
    }
    return '?';
  },

  // ─── עמודת נושאים בדשבורד ────────────────────────────────────────────────
  _renderTopicGrid(topicProgress) {
    const container = document.getElementById('dash-topic-grid');
    if (!container) return;

    const entries = Object.entries(topicProgress);
    if (entries.length === 0) {
      container.innerHTML = '<p class="empty-state">עדיין לא נלמד נושא. <a href="quiz.html">התחל עכשיו!</a></p>';
      return;
    }

    container.innerHTML = entries.map(([topicId, data]) => {
      const score = data.score || 0;
      const color = scoreColor(score);
      return `
        <a href="quiz.html?topic=${encodeURIComponent(topicId)}"
           class="topic-card"
           aria-label="${sanitizeHTML(data.label || topicId)}: ${formatScore(score)}">
          <div class="topic-card__header">
            <span class="topic-card__name">${sanitizeHTML(data.label || topicId)}</span>
            <span class="topic-card__score" style="color:${color}">
              ${formatScore(score)}
            </span>
          </div>
          <div class="topic-card__bar-bg">
            <div class="topic-card__bar"
                 style="width:${score}%; background:${color}"
                 role="progressbar"
                 aria-valuenow="${score}" aria-valuemin="0" aria-valuemax="100">
            </div>
          </div>
          <div class="topic-card__meta">
            ${data.attempts || 0} ניסיונות
            ${data.lastStudied ? '· ' + data.lastStudied : ''}
          </div>
        </a>`;
    }).join('');
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  מה ללמוד היום
  // ══════════════════════════════════════════════════════════════════════════

  getTodayTask() {
    if (!this.studyPlan || !this.studyPlan.weeks) return null;

    const weekNum = Storage.getStudyWeekNumber(); // שבוע ראשון, שני...
    const dayOfWeek = new Date().getDay(); // 0=ראשון, 6=שבת

    // חיפוש שבוע מתאים בתוכנית
    const week = this.studyPlan.weeks.find(w => w.week === weekNum)
              || this.studyPlan.weeks[this.studyPlan.weeks.length - 1]; // שבוע אחרון כ-fallback

    if (!week || !week.days) return week || null;

    // יום מתאים
    const dayTask = week.days.find(d => d.day === dayOfWeek)
                 || week.days[0];

    return dayTask || null;
  },

  // ─── טעינת תוכנית לימודים ────────────────────────────────────────────────
  _loadStudyPlan() {
    return fetch('data/study-plan.json')
      .then(res => {
        if (!res.ok) throw new Error('לא ניתן לטעון study-plan.json');
        return res.json();
      })
      .then(data => {
        this.studyPlan = data;
      })
      .catch(err => {
        console.warn('[App] _loadStudyPlan:', err.message);
        this.studyPlan = null;
      });
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  אתחול דפים ספציפיים
  // ══════════════════════════════════════════════════════════════════════════

  _initQuizPage() {
    if (typeof QuizEngine === 'undefined') return;

    // קריאת פרמטר topic מה-URL
    const params  = new URLSearchParams(window.location.search);
    const topicId = params.get('topic') || null;
    const weekId  = params.get('week')  || null;

    const filter = topicId ? { topicId }
                 : weekId  ? { weekId }
                 : null;

    // כפתורי נושאים — אם קיימים בדף
    this._bindTopicButtons();

    // אם יש נושא ב-URL — מתחילים ישר
    if (topicId || weekId) {
      QuizEngine.startWithFetch(filter, topicId || weekId);
    } else {
      // הצגת בחירת נושא
      this._renderTopicPicker('quiz-container', (selectedTopic) => {
        QuizEngine.startWithFetch({ topicId: selectedTopic }, selectedTopic);
      });
    }
  },

  _initFlashcardsPage() {
    if (typeof FlashcardEngine === 'undefined') return;

    const params  = new URLSearchParams(window.location.search);
    const topicId = params.get('topic') || null;

    FlashcardEngine.init(topicId);
  },

  _initSimulatorPage() {
    if (typeof BagrutSimulator === 'undefined') return;

    // כפתור "התחל מבחן"
    const startBtn = document.getElementById('simulator-start-btn');
    if (startBtn) {
      startBtn.addEventListener('click', () => {
        startBtn.style.display = 'none';
        BagrutSimulator.start();
      });
    } else {
      // מתחיל אוטומטית אם אין כפתור
      BagrutSimulator.start();
    }
  },

  // ─── בחירת נושא — widget כללי ─────────────────────────────────────────────
  _renderTopicPicker(containerId, onSelect) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = '<div class="loading" aria-live="polite">טוען נושאים...</div>';

    fetch('data/topics.json')
      .then(res => res.ok ? res.json() : Promise.reject('שגיאה'))
      .then(data => {
        const topics = Array.isArray(data) ? data : (data.topics || []);
        const progressData = Storage.getProgress();

        if (topics.length === 0) {
          container.innerHTML = '<p class="empty-state">לא נמצאו נושאים.</p>';
          return;
        }

        container.innerHTML = `
          <div class="topic-picker" role="list" aria-label="בחר נושא לחידון">
            <h2 class="topic-picker__title">בחר נושא</h2>
            ${topics.map(t => {
              const prog   = progressData.topicProgress[t.id] || {};
              const score  = prog.score || 0;
              const color  = scoreColor(score);
              return `
                <button class="topic-picker__item"
                        role="listitem"
                        onclick="App._pickTopic('${sanitizeHTML(t.id)}')"
                        aria-label="${sanitizeHTML(t.title)}, ציון ${formatScore(score)}">
                  <span class="topic-picker__icon" aria-hidden="true">${sanitizeHTML(t.icon || '🧪')}</span>
                  <span class="topic-picker__name">${sanitizeHTML(t.title)}</span>
                  <span class="topic-picker__score" style="color:${color}">
                    ${score > 0 ? formatScore(score) : 'חדש'}
                  </span>
                </button>`;
            }).join('')}
          </div>`;

        // שמירה ל-callback
        this._topicPickerCallback = onSelect;
      })
      .catch(err => {
        console.warn('[App] _renderTopicPicker:', err);
        container.innerHTML = '<p class="empty-state">לא ניתן לטעון נושאים.</p>';
      });
  },

  _pickTopic(topicId) {
    if (this._topicPickerCallback) {
      this._topicPickerCallback(topicId);
    }
  },

  // ─── כפתורי נושאים שכבר בדף ────────────────────────────────────────────
  _bindTopicButtons() {
    document.querySelectorAll('[data-topic]').forEach(btn => {
      btn.addEventListener('click', () => {
        const topicId = btn.getAttribute('data-topic');
        if (topicId && typeof QuizEngine !== 'undefined') {
          QuizEngine.startWithFetch({ topicId }, topicId);
        }
      });
    });
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  ניווט
  // ══════════════════════════════════════════════════════════════════════════

  _updateNav() {
    const page    = this.currentPage;
    const navLinks = document.querySelectorAll('[data-nav]');

    navLinks.forEach(link => {
      const linkPage = link.getAttribute('data-nav');
      link.classList.toggle('nav__link--active', linkPage === page);
      link.setAttribute('aria-current', linkPage === page ? 'page' : 'false');
    });
  },

  // המבורגר מניו לנייד
  toggleMenu() {
    const nav = document.querySelector('nav') || document.querySelector('.nav');
    if (nav) {
      nav.classList.toggle('menu-open');
      const isOpen = nav.classList.contains('menu-open');
      // עדכון aria לכפתור ההמבורגר
      const hamburger = document.getElementById('hamburger-btn');
      if (hamburger) {
        hamburger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      }
    }
  },

  // ─── סגירת מניו בלחיצה מחוצה לו ─────────────────────────────────────────
  _bindMenuClose() {
    document.addEventListener('click', (e) => {
      const nav = document.querySelector('nav') || document.querySelector('.nav');
      if (!nav) return;
      const hamburger = document.getElementById('hamburger-btn');
      if (
        nav.classList.contains('menu-open') &&
        !nav.contains(e.target) &&
        e.target !== hamburger
      ) {
        nav.classList.remove('menu-open');
      }
    });
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  ייצוא/יבוא נתונים
  // ══════════════════════════════════════════════════════════════════════════

  _bindDataButtons() {
    // כפתור ייצוא
    const exportBtn = document.getElementById('export-data-btn');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        const json     = Storage.exportData();
        const blob     = new Blob([json], { type: 'application/json' });
        const url      = URL.createObjectURL(blob);
        const a        = document.createElement('a');
        a.href         = url;
        a.download     = 'bagrut-backup-' + todayISO() + '.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('נתונים יוצאו בהצלחה!', 'success');
      });
    }

    // כפתור יבוא
    const importBtn   = document.getElementById('import-data-btn');
    const importInput = document.getElementById('import-data-input');
    if (importBtn && importInput) {
      importBtn.addEventListener('click', () => importInput.click());
      importInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
          const ok = Storage.importData(evt.target.result);
          if (ok) {
            showToast('נתונים יובאו בהצלחה! מרענן...', 'success');
            setTimeout(() => window.location.reload(), 1500);
          } else {
            showToast('שגיאה בייבוא — קובץ לא תקין', 'error');
          }
        };
        reader.readAsText(file, 'UTF-8');
        // איפוס input לאפשר בחירה חוזרת
        importInput.value = '';
      });
    }
  },

  // ═══ עזרים ───────────────────────────────────────────────────────────────

  // עדכון טקסט של אלמנט ב-ID
  _setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }
};

// ─── כפתור המבורגר גלובלי ─────────────────────────────────────────────────
function toggleMenu() {
  App.toggleMenu();
}

// ─── Auto-init ───────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function () {
  App.init();
});

// חשיפה גלובלית
window.App        = App;
window.toggleMenu = toggleMenu;
