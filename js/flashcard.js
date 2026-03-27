/**
 * flashcard.js — מנוע כרטיסיות חכמות עם SM-2
 * תלות: utils.js, storage.js
 *
 * מבנה כרטיסיה ב-flashcards.json:
 * {
 *   id:      "card_001",
 *   topicId: "organic_chemistry",
 *   weekId:  1,
 *   front:   "מה הנוסחה המולקולרית של מתאן?",
 *   back:    "CH₄",
 *   hint:    "פחמן אחד + ..."  (אופציונלי)
 * }
 *
 * דירוג SM-2:
 *   0 = שוב (again)   — לא זכרתי כלל
 *   3 = קשה (hard)    — זכרתי בקושי
 *   5 = קל  (easy)    — זכרתי מיד
 */

'use strict';

const FlashcardEngine = {

  // ─── מצב פנימי ─────────────────────────────────────────────────────────
  state: {
    cards:    [],    // כל הכרטיסיות לסשן זה (אחרי פילטר)
    due:      [],    // כרטיסיות שמועד חזרתן הגיע
    current:  0,     // אינדקס הכרטיסיה הנוכחית ב-due[]
    flipped:  false, // האם הכרטיסיה הפוכה (גב מוצג)
    topicId:  null,  // פילטר נושא
    reviewed: 0,     // כמה כרטיסיות עברו בסשן זה
    container: null  // DOM: #flashcard-container
  },

  // ─── אתחול: טעינה ופילטור ────────────────────────────────────────────────
  init(topicId) {
    topicId = topicId || null;

    const container = document.getElementById('flashcard-container');
    if (!container) {
      console.error('[FlashcardEngine] לא נמצא אלמנט #flashcard-container');
      return;
    }

    this.state.topicId  = topicId;
    this.state.container = container;
    container.innerHTML = '<div class="loading" aria-live="polite">טוען כרטיסיות...</div>';

    fetch('data/flashcards.json')
      .then(res => {
        if (!res.ok) throw new Error('שגיאה בטעינת flashcards.json: ' + res.status);
        return res.json();
      })
      .then(data => {
        let all = Array.isArray(data) ? data : (data.flashcards || []);

        // פילטר לפי נושא
        if (topicId) {
          all = all.filter(c => (c.topic || c.topicId) === topicId);
        }

        this.state.cards   = all;
        this.state.due     = Storage.getDueFlashcards(all);
        this.state.current = 0;
        this.state.flipped = false;
        this.state.reviewed = 0;

        if (this.state.due.length === 0) {
          this._renderAllDone(true); // כלום לא בתור — כבר עברנו הכל
        } else {
          // ערבוב כרטיסיות בתור
          this.state.due = shuffle(this.state.due);
          this.render();
        }
      })
      .catch(err => {
        console.error('[FlashcardEngine] init:', err);
        container.innerHTML = '<p class="empty-state">שגיאה בטעינת הכרטיסיות. בדוק שקובץ flashcards.json קיים.</p>';
      });
  },

  // ─── רינדור כרטיסיה נוכחית ───────────────────────────────────────────────
  render() {
    const { due, current, container } = this.state;
    const card  = due[current];
    const total = due.length;

    if (!container || !card) return;

    this.state.flipped = false;

    // פס התקדמות
    const pct = Math.round((this.state.reviewed / total) * 100);

    container.innerHTML = `
      <div class="fc-session">

        <!-- כותרת סשן ומונה -->
        <div class="fc-header" style="display:flex;align-items:center;gap:1rem;margin-bottom:1rem;">
          <span class="fc-counter" aria-live="polite" style="font-weight:700;color:#6b7280;font-size:0.95rem;">
            ${this.state.reviewed + 1} / ${total}
          </span>
          <div class="fc-progress" role="progressbar"
               style="flex:1;height:6px;background:#e5e7eb;border-radius:999px;overflow:hidden;"
               aria-valuenow="${this.state.reviewed}"
               aria-valuemin="0" aria-valuemax="${total}">
            <div style="width:${pct}%;height:100%;background:var(--color-primary,#2563eb);border-radius:999px;transition:width 0.3s;"></div>
          </div>
        </div>

        <!-- הכרטיסיה עצמה — perspective wrapper חייב להיות ישיר מעל הכרטיסיה -->
        <div style="perspective:1000px;max-width:540px;margin:0 auto 1.5rem;">
          <div class="flashcard" id="flashcard-card" tabindex="0"
               role="button"
               aria-label="כרטיסיה: ${sanitizeHTML(card.front)} — לחץ להצגת התשובה"
               onclick="FlashcardEngine.flip()"
               onkeydown="if(event.key==='Enter'||event.key===' ') FlashcardEngine.flip()">

            <!-- פנים -->
            <div class="flashcard-front">
              <div class="card-label">שאלה</div>
              <div class="card-content">${sanitizeHTML(card.front).replace(/\n/g,'<br>')}</div>
              ${card.hint
                ? `<div class="flip-hint" style="margin-top:0.5rem;font-size:0.8rem;color:#9ca3af;">💡 ${sanitizeHTML(card.hint)}</div>`
                : ''}
              <div class="flip-hint">לחץ להצגת התשובה ↓</div>
            </div>

            <!-- גב (נסתר עד הפיכה) -->
            <div class="flashcard-back">
              <div class="card-label">תשובה</div>
              <div class="card-content" style="white-space:pre-line;">${sanitizeHTML(card.back)}</div>
            </div>
          </div>
        </div>

        <!-- כפתורי דירוג — נסתרים עד הפיכה -->
        <div class="fc-answer-buttons" id="fc-answer-buttons" aria-label="דרג את הכרטיסיה">
          <button class="btn-again"
                  onclick="FlashcardEngine.rate(0)"
                  aria-label="לא זכרתי">↩ שוב</button>
          <button class="btn-hard"
                  onclick="FlashcardEngine.rate(3)"
                  aria-label="זכרתי בקושי">😓 קשה</button>
          <button class="btn-easy"
                  onclick="FlashcardEngine.rate(5)"
                  aria-label="זכרתי בקלות">😊 קל</button>
        </div>

      </div>`;

    // פוקוס לכרטיסיה לנגישות
    requestAnimationFrame(() => {
      const cardEl = document.getElementById('flashcard-card');
      if (cardEl) cardEl.focus();
    });
  },

  // ─── הפיכת כרטיסיה (אנימציה CSS) ────────────────────────────────────────
  flip() {
    if (this.state.flipped) return; // כבר הפוכה

    this.state.flipped = true;

    const cardEl  = document.getElementById('flashcard-card');
    const buttons = document.getElementById('fc-answer-buttons');

    if (cardEl) {
      cardEl.classList.add('flipped');
      const card = this.state.due[this.state.current];
      cardEl.setAttribute('aria-label',
        'תשובה: ' + sanitizeHTML(card.back) + ' — בחר דירוג');
      cardEl.setAttribute('aria-pressed', 'true');
    }

    // הצגת כפתורי דירוג עם אנימציה
    if (buttons) {
      buttons.classList.add('visible');
      buttons.style.animation = 'fadeInUp 0.35s ease';
      const hardBtn = buttons.querySelector('.btn-hard');
      if (hardBtn) setTimeout(() => hardBtn.focus(), 400);
    }
  },

  // ─── דירוג כרטיסיה (0=שוב, 3=קשה, 5=קל) ────────────────────────────────
  rate(quality) {
    const card = this.state.due[this.state.current];
    if (!card) return;

    // עדכון SM-2 ב-storage
    const newState = Storage.updateFlashcardSM2(card.id, quality);

    this.state.reviewed++;

    // אם דרגנו "שוב" (0) — מוסיפים לסוף התור כדי לחזור עליה
    if (quality < 3) {
      const again = Object.assign({}, card, { _retrying: true });
      this.state.due.push(again);
    }

    // אנימציית יציאה
    const cardEl = document.getElementById('flashcard-card');
    if (cardEl) {
      // הוספת קלאס לפי דירוג לצבע האנימציה
      const classMap = { 0: 'exit--again', 3: 'exit--hard', 5: 'exit--easy' };
      cardEl.classList.add(classMap[quality] || 'exit--easy');
    }

    // מעבר לכרטיסיה הבאה אחרי אנימציה
    setTimeout(() => {
      this.next();
    }, 350);
  },

  // ─── כרטיסיה הבאה ────────────────────────────────────────────────────────
  next() {
    this.state.current++;

    // בדיקה: האם כל הכרטיסיות עברו (ללא כרטיסיות "שוב" שממתינות)
    if (this.state.current >= this.state.due.length) {
      this.showDone();
    } else {
      this.state.flipped = false;
      this.render();
    }
  },

  // ─── מסך סיום ─────────────────────────────────────────────────────────────
  showDone() {
    const { container, reviewed, due } = this.state;
    if (!container) return;

    // ספירת כמה היו "קשה"/"שוב" לעומת "קל"
    const totalReviewed = reviewed;
    const hasMore = due.some(c => c._retrying);

    container.innerHTML = `
      <div class="fc-done" role="status" aria-live="polite">
        <div class="fc-done__emoji" aria-hidden="true">🎉</div>
        <h2 class="fc-done__title">כל הכרטיסיות של היום עברו!</h2>
        <p class="fc-done__subtitle">
          סיימת ${totalReviewed} כרטיסיות בסשן זה
        </p>
        <div class="fc-done__actions">
          <button class="btn btn--primary" onclick="FlashcardEngine.init('${sanitizeHTML(this.state.topicId || '')}')">
            סשן נוסף
          </button>
          <a href="index.html" class="btn btn--secondary">
            חזור לדף הבית
          </a>
        </div>
        <p class="fc-done__next" aria-label="מידע על חזרה הבאה">
          הכרטיסיות הבאות יוצגו בהתאם לתאריך החזרה שחושב על ידי המערכת.
        </p>
      </div>`;

    // עדכון לימוד בסטריק
    Storage.updateStreak();
  },

  // ─── עזר: מסך "כלום לחזרה היום" ─────────────────────────────────────────
  _renderAllDone(isEmpty) {
    const { container } = this.state;
    if (!container) return;

    container.innerHTML = `
      <div class="fc-done fc-done--empty" role="status" aria-live="polite">
        <div class="fc-done__emoji" aria-hidden="true">${isEmpty ? '🌟' : '✅'}</div>
        <h2 class="fc-done__title">
          ${isEmpty ? 'אין כרטיסיות לחזרה היום!' : 'סיימת את כל הכרטיסיות'}
        </h2>
        <p class="fc-done__subtitle">
          ${isEmpty
            ? 'עדיין לא נוספו כרטיסיות לנושא זה, או שכולן מחכות לתאריך חזרתן.'
            : 'כל הכרטיסיות ייחזרו בהתאם לתוכנית המרווחת.'}
        </p>
        <div class="fc-done__actions">
          <button class="btn btn--primary"
                  onclick="FlashcardEngine._studyAllAnyway()">
            חזור על הכל בכל מקרה
          </button>
          <a href="index.html" class="btn btn--secondary">
            חזור לדף הבית
          </a>
        </div>
      </div>`;
  },

  // ─── לימוד כל הכרטיסיות ללא קשר לתאריך ─────────────────────────────────
  _studyAllAnyway() {
    this.state.due     = shuffle(this.state.cards);
    this.state.current = 0;
    this.state.flipped = false;
    this.state.reviewed = 0;

    if (this.state.due.length === 0) {
      showToast('אין כרטיסיות לנושא זה', 'info');
      return;
    }
    this.render();
  }
};

// חשיפה גלובלית
window.FlashcardEngine = FlashcardEngine;
