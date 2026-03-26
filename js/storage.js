/**
 * storage.js — שכבת אחסון localStorage
 * אלגוריתם SM-2 לחזרה מרווחת (Spaced Repetition)
 * תלות: utils.js (todayISO, daysBetween)
 */

'use strict';

const Storage = {

  // ─── מפתחות localStorage ─────────────────────────────────────────────────
  keys: {
    progress:    'bagrut_progress',
    flashcards:  'bagrut_flashcards',
    quizHistory: 'bagrut_quiz_history',
    streak:      'bagrut_streak',
    lastSeen:    'bagrut_last_seen',
    studyStart:  'bagrut_study_start'
  },

  // ─── קריאה בסיסית עם try/catch ───────────────────────────────────────────
  get(key) {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return null;
      return JSON.parse(raw);
    } catch (e) {
      console.warn('[Storage] שגיאה בקריאה עבור מפתח:', key, e);
      return null;
    }
  },

  // ─── כתיבה בסיסית ─────────────────────────────────────────────────────────
  set(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
      return true;
    } catch (e) {
      // localStorage מלא (QuotaExceededError)
      console.error('[Storage] שגיאה בכתיבה עבור מפתח:', key, e);
      return false;
    }
  },

  // ─── מחיקת מפתח ──────────────────────────────────────────────────────────
  remove(key) {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn('[Storage] שגיאה במחיקה:', key, e);
    }
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  מעקב התקדמות
  // ══════════════════════════════════════════════════════════════════════════

  // מחזיר מבנה ברירת מחדל של התקדמות
  getProgress() {
    const saved = this.get(this.keys.progress);
    return saved || {
      topicProgress: {}, // { topicId: { score, correct, total, attempts, lastStudied } }
      weekProgress:  {}, // { weekNum: { score, studied } }
      totalScore:    0
    };
  },

  // עדכון ציון עבור נושא
  setTopicProgress(topicId, score, correct, total) {
    if (!topicId) return;
    const data = this.getProgress();

    const prev = data.topicProgress[topicId] || {
      score: 0, correct: 0, total: 0, attempts: 0, lastStudied: null
    };

    // שמירת הניסיון הטוב ביותר כציון הנוכחי
    data.topicProgress[topicId] = {
      score:       Math.max(prev.score, score),
      correct:     correct,
      total:       total,
      attempts:    prev.attempts + 1,
      lastStudied: todayISO()
    };

    // חישוב ממוצע כולל מכלל הנושאים
    const scores = Object.values(data.topicProgress).map(t => t.score);
    data.totalScore = scores.length
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : 0;

    this.set(this.keys.progress, data);
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  סטריק (רצף לימוד)
  // ══════════════════════════════════════════════════════════════════════════

  // מחזיר מצב סטריק נוכחי
  getStreak() {
    const saved = this.get(this.keys.streak);
    return saved || {
      current:       0,
      longest:       0,
      lastStudyDate: null
    };
  },

  // קרא בכל ביקור/פתרון — מעדכן סטריק
  updateStreak() {
    const streak  = this.getStreak();
    const today   = todayISO();

    if (streak.lastStudyDate === today) {
      // כבר למדנו היום, אין מה לעדכן
      return streak;
    }

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);

    if (streak.lastStudyDate === yesterdayStr) {
      // המשך הרצף — אתמול למדנו
      streak.current += 1;
    } else if (streak.lastStudyDate === null) {
      // פתיחה ראשונה
      streak.current = 1;
    } else {
      // שבירת הרצף — יום (לפחות) חסר
      streak.current = 1;
    }

    streak.longest       = Math.max(streak.longest, streak.current);
    streak.lastStudyDate = today;

    this.set(this.keys.streak, streak);
    return streak;
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  היסטוריית חידונים
  // ══════════════════════════════════════════════════════════════════════════

  // הוספת תוצאת חידון
  addQuizResult(topicId, score, date) {
    const history = this.get(this.keys.quizHistory) || [];

    history.push({
      topicId: topicId,
      score:   score,
      date:    date || todayISO(),
      ts:      Date.now()
    });

    // הגבלה ל-100 ערכים אחרונים
    if (history.length > 100) {
      history.splice(0, history.length - 100);
    }

    this.set(this.keys.quizHistory, history);
  },

  // קבלת היסטוריה (מסוננת לפי נושא אם צוין)
  getQuizHistory(topicId) {
    const history = this.get(this.keys.quizHistory) || [];
    if (topicId === null || topicId === undefined) {
      return history;
    }
    return history.filter(h => h.topicId === topicId);
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  כרטיסיות — SM-2 Spaced Repetition
  // ══════════════════════════════════════════════════════════════════════════

  // מחזיר מצב SM-2 של כרטיסיה אחת
  getFlashcardState(cardId) {
    const all = this.get(this.keys.flashcards) || {};
    return all[cardId] || {
      interval:    1,      // ימים עד לחזרה הבאה
      repetitions: 0,      // מספר חזרות מוצלחות ברצף
      easeFactor:  2.5,    // גורם קלות (ברירת מחדל SM-2)
      nextReview:  todayISO() // היום — חדש
    };
  },

  // עדכון SM-2 לאחר דירוג (quality: 0–5)
  updateFlashcardSM2(cardId, quality) {
    quality = Math.round(clamp(quality, 0, 5));

    const all   = this.get(this.keys.flashcards) || {};
    const state = this.getFlashcardState(cardId);

    // חישוב עפ"י אלגוריתם SM-2 הקלאסי
    if (quality < 3) {
      // תשובה לא מוצלחת — מאפסים חזרות
      state.repetitions = 0;
      state.interval    = 1;
    } else {
      // תשובה מוצלחת (3=קשה, 4=טוב, 5=קל)
      if (state.repetitions === 0) {
        state.interval = 1;
      } else if (state.repetitions === 1) {
        state.interval = 6;
      } else {
        // n >= 2: I(n) = I(n-1) × EF
        state.interval = Math.round(state.interval * state.easeFactor);
      }
      state.repetitions += 1;
    }

    // עדכון גורם קלות: EF' = EF + (0.1 - (5-q)×(0.08 + (5-q)×0.02))
    const newEF = state.easeFactor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    state.easeFactor = Math.max(1.3, parseFloat(newEF.toFixed(2))); // מינימום 1.3

    // חישוב תאריך החזרה הבאה
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + state.interval);
    state.nextReview = nextDate.toISOString().slice(0, 10);

    all[cardId] = state;
    this.set(this.keys.flashcards, all);
    return state;
  },

  // מסנן כרטיסיות שמועד חזרתן היום או לפני
  getDueFlashcards(allCards) {
    if (!Array.isArray(allCards)) return [];
    const today = todayISO();
    const all   = this.get(this.keys.flashcards) || {};

    return allCards.filter(card => {
      const state = all[card.id];
      // כרטיסיה חדשה — לא נלמדה מעולם, תמיד בתוספת
      if (!state) return true;
      // מועד חזרה הגיע
      return state.nextReview <= today;
    });
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  ייצוא / יבוא נתונים
  // ══════════════════════════════════════════════════════════════════════════

  exportData() {
    const data = {};
    // איסוף כל המפתחות של האפליקציה
    Object.values(this.keys).forEach(key => {
      const val = localStorage.getItem(key);
      if (val !== null) {
        data[key] = val; // גולמי (JSON string) כדי לשמור את הפורמט
      }
    });
    return JSON.stringify(data, null, 2);
  },

  importData(jsonStr) {
    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch (e) {
      console.error('[Storage] importData: JSON לא תקין', e);
      return false;
    }

    // אימות שהנתונים שייכים לאפליקציה שלנו
    const validKeys = new Set(Object.values(this.keys));
    let count = 0;

    Object.entries(parsed).forEach(([key, val]) => {
      if (validKeys.has(key)) {
        // val כבר JSON string (מייצוא)
        try {
          // נוודא שהוא תקין לפני שמירה
          JSON.parse(val);
          localStorage.setItem(key, val);
          count++;
        } catch (e) {
          console.warn('[Storage] importData: ערך לא תקין עבור', key);
        }
      }
    });

    console.info('[Storage] יובאו', count, 'מפתחות');
    return count > 0;
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  ניקוי נתונים ישנים
  // ══════════════════════════════════════════════════════════════════════════

  cleanup() {
    const history = this.get(this.keys.quizHistory) || [];
    const cutoff  = new Date();
    cutoff.setDate(cutoff.getDate() - 60); // 60 ימים אחורה
    const cutoffStr = cutoff.toISOString().slice(0, 10);

    const cleaned = history.filter(h => h.date >= cutoffStr);

    if (cleaned.length < history.length) {
      this.set(this.keys.quizHistory, cleaned);
      console.info('[Storage] הוסרו', history.length - cleaned.length, 'רשומות ישנות');
    }
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  תאריך תחילת לימוד
  // ══════════════════════════════════════════════════════════════════════════

  // שמירת תאריך הפעלה ראשונה (לחישוב שבוע לימוד)
  initStudyStart() {
    if (!this.get(this.keys.studyStart)) {
      this.set(this.keys.studyStart, todayISO());
    }
  },

  getStudyStart() {
    return this.get(this.keys.studyStart) || todayISO();
  },

  // מחשב כמה שבועות עברו מתחילת הלימוד
  getStudyWeekNumber() {
    const start    = new Date(this.getStudyStart());
    const today    = new Date();
    const diffDays = daysBetween(start, today);
    return Math.floor(diffDays / 7) + 1; // שבוע 1 = השבוע הראשון
  }
};

// חשיפה גלובלית
window.Storage = Storage;
