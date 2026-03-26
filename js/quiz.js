/**
 * quiz.js — מנוע חידון עם הגנה מלמידה מזויפת
 * תלות: utils.js, storage.js
 *
 * סוגי שאלות נתמכים:
 *   'multiple-choice' — בחירה מרובה (4 אפשרויות)
 *   'true-false'      — נכון/לא נכון
 *   'numeric'         — קלט מספרי עם סובלנות
 *
 * הגנה מלמידה מזויפת:
 *   - נעילה מיידית לאחר בחירה (אין אפשרות לשנות)
 *   - הסבר מוצג רק על תשובה שגויה (מונע אישוש confirmation bias)
 *   - ערבוב שאלות ותשובות בכל הפעלה
 */

'use strict';

const QuizEngine = {

  // ─── מצב פנימי ─────────────────────────────────────────────────────────
  state: {
    questions:  [],    // מערך השאלות לסשן זה
    current:    0,     // אינדקס שאלה נוכחית
    score:      0,     // ציון נצבר (0–100)
    answers:    [],    // { index, selected, correct, isCorrect, timeMs }
    startTime:  null,  // Date.now() בתחילת החידון
    topicId:    null,  // ID הנושא הנוכחי
    locked:     false, // מניעת כפל-הגשה
    container:  null   // אלמנט DOM של מיכל החידון
  },

  // ─── אתחול: טעינת שאלות והתחלה ──────────────────────────────────────────
  start(questions, topicId) {
    if (!questions || questions.length === 0) {
      console.warn('[QuizEngine] אין שאלות להצגה');
      return;
    }

    // ערבוב שאלות
    const shuffled = shuffle(questions);

    this.state = {
      questions:  shuffled,
      current:    0,
      score:      0,
      answers:    [],
      startTime:  Date.now(),
      topicId:    topicId || null,
      locked:     false,
      container:  document.getElementById('quiz-container')
    };

    if (!this.state.container) {
      console.error('[QuizEngine] לא נמצא אלמנט #quiz-container');
      return;
    }

    // עדכון סטריק לימוד
    Storage.updateStreak();

    this.render();
  },

  // ─── רינדור שאלה נוכחית ──────────────────────────────────────────────────
  render() {
    const { questions, current, container } = this.state;
    if (!container) return;

    const q     = questions[current];
    const total = questions.length;
    const pct   = Math.round((current / total) * 100);

    // ─ פס התקדמות ─
    const progressHTML = `
      <div class="quiz-progress" role="progressbar"
           aria-valuenow="${current}" aria-valuemin="0" aria-valuemax="${total}"
           aria-label="שאלה ${current + 1} מתוך ${total}">
        <div class="quiz-progress__bar" style="width:${pct}%"></div>
        <span class="quiz-progress__text">שאלה ${current + 1} / ${total}</span>
      </div>`;

    // ─ גוף השאלה לפי סוג ─
    let bodyHTML = '';
    const type = q.type || 'multiple-choice';

    if (type === 'true-false') {
      bodyHTML = this._renderTrueFalse(q);
    } else if (type === 'numeric') {
      bodyHTML = this._renderNumeric(q);
    } else {
      bodyHTML = this._renderMultipleChoice(q);
    }

    container.innerHTML = `
      <div class="quiz-card" data-type="${sanitizeHTML(type)}">
        ${progressHTML}
        <div class="quiz-question">
          <p class="quiz-question__text">${sanitizeHTML(q.question)}</p>
          ${q.image ? `<img src="${sanitizeHTML(q.image)}" alt="תמונה לשאלה" class="quiz-question__img" loading="lazy">` : ''}
        </div>
        <div class="quiz-options" id="quiz-options">
          ${bodyHTML}
        </div>
        <div class="quiz-feedback" id="quiz-feedback" aria-live="assertive"></div>
      </div>`;

    // אירועים לסוג numeric
    if (type === 'numeric') {
      this._attachNumericEvents(q);
    }
  },

  // ─── רינדור: בחירה מרובה ─────────────────────────────────────────────────
  _renderMultipleChoice(q) {
    // ערבוב אפשרויות (שמירת האינדקס המקורי כ-data-index)
    const options = q.options.map((opt, i) => ({ text: opt, index: i }));
    const shuffledOpts = shuffle(options);

    return shuffledOpts.map(opt => `
      <button class="quiz-option"
              data-index="${opt.index}"
              onclick="QuizEngine.submitAnswer(${opt.index})"
              aria-label="${sanitizeHTML(opt.text)}">
        ${sanitizeHTML(opt.text)}
      </button>`
    ).join('');
  },

  // ─── רינדור: נכון/לא נכון ────────────────────────────────────────────────
  _renderTrueFalse(q) {
    return `
      <button class="quiz-option quiz-option--tf"
              data-index="0"
              onclick="QuizEngine.submitAnswer(0)">נכון</button>
      <button class="quiz-option quiz-option--tf"
              data-index="1"
              onclick="QuizEngine.submitAnswer(1)">לא נכון</button>`;
  },

  // ─── רינדור: קלט מספרי ───────────────────────────────────────────────────
  _renderNumeric(q) {
    const unit = q.unit ? `<span class="quiz-numeric__unit">${sanitizeHTML(q.unit)}</span>` : '';
    return `
      <div class="quiz-numeric">
        <label class="quiz-numeric__label" for="numeric-input">הכנס תשובה מספרית:</label>
        <div class="quiz-numeric__row">
          <input type="number" id="numeric-input" class="quiz-numeric__input"
                 step="${q.tolerance || 'any'}" autocomplete="off"
                 placeholder="0" aria-label="קלט מספרי">
          ${unit}
        </div>
        <button class="btn btn--primary quiz-numeric__submit"
                id="numeric-submit" onclick="QuizEngine._submitNumeric()">
          אשר תשובה
        </button>
      </div>`;
  },

  // חיבור אירועי Enter לשדה המספרי
  _attachNumericEvents(q) {
    const input = document.getElementById('numeric-input');
    if (input) {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') this._submitNumeric();
      });
      input.focus();
    }
  },

  // ─── הגשת תשובה מספרית ───────────────────────────────────────────────────
  _submitNumeric() {
    if (this.state.locked) return;
    const input = document.getElementById('numeric-input');
    if (!input) return;

    const val = parseFloat(input.value);
    if (isNaN(val)) {
      showToast('יש להזין מספר תקין', 'error');
      return;
    }

    const q         = this.state.questions[this.state.current];
    const correct   = parseFloat(q.correctAnswer);
    const tolerance = q.tolerance !== undefined ? parseFloat(q.tolerance) : 0.01;

    // בדיקת קרבה (אחוזית או מוחלטת)
    let isCorrect;
    if (q.toleranceType === 'percent') {
      isCorrect = Math.abs((val - correct) / correct) <= tolerance;
    } else {
      isCorrect = Math.abs(val - correct) <= tolerance;
    }

    // מסמנים את השדה
    input.disabled = true;
    const submitBtn = document.getElementById('numeric-submit');
    if (submitBtn) submitBtn.disabled = true;

    // מעבירים לפונקציה המרכזית עם אינדקס מיוחד
    this._handleResult(isCorrect, isCorrect ? q.correctAnswer : null, q);
  },

  // ─── הגשת תשובה (multiple-choice / true-false) ───────────────────────────
  submitAnswer(selectedIndex) {
    if (this.state.locked) return; // הגנה מכפל-הגשה
    this.state.locked = true;

    const q         = this.state.questions[this.state.current];
    const correct   = parseInt(q.correctAnswer, 10); // אינדקס תשובה נכונה
    const isCorrect = selectedIndex === correct;

    // נעילת כל הכפתורים מיידית
    const buttons = document.querySelectorAll('#quiz-options .quiz-option');
    buttons.forEach(btn => {
      btn.style.pointerEvents = 'none'; // נעילה ויזואלית
      btn.setAttribute('aria-disabled', 'true');

      const btnIndex = parseInt(btn.getAttribute('data-index'), 10);
      if (btnIndex === correct) {
        btn.classList.add('quiz-option--correct');
      } else if (btnIndex === selectedIndex && !isCorrect) {
        btn.classList.add('quiz-option--wrong');
      }
    });

    this._handleResult(isCorrect, selectedIndex, q);
  },

  // ─── טיפול בתוצאה (משותף לכל סוגי השאלות) ──────────────────────────────
  _handleResult(isCorrect, selected, q) {
    this.state.locked = true;

    // צבירת ציון
    if (isCorrect) {
      this.state.score += Math.round(100 / this.state.questions.length);
    }

    // שמירת התשובה
    this.state.answers.push({
      questionId: q.id || this.state.current,
      selected:   selected,
      correct:    q.correctAnswer,
      isCorrect:  isCorrect,
      timeMs:     Date.now() - this.state.startTime
    });

    // משוב — הסבר רק על תשובה שגויה (הגנה מהטיית אישור)
    const feedbackEl = document.getElementById('quiz-feedback');
    if (feedbackEl) {
      if (isCorrect) {
        feedbackEl.innerHTML = `
          <div class="quiz-feedback--correct" role="status">
            <span class="quiz-feedback__icon" aria-hidden="true">✓</span>
            <span>נכון!</span>
          </div>`;
      } else {
        // הסבר מוצג רק על שגיאה
        const explanation = q.explanation
          ? `<p class="quiz-feedback__explanation">${sanitizeHTML(q.explanation)}</p>`
          : '';
        feedbackEl.innerHTML = `
          <div class="quiz-feedback--wrong" role="alert">
            <span class="quiz-feedback__icon" aria-hidden="true">✗</span>
            <span>לא נכון</span>
          </div>
          ${explanation}`;
      }
    }

    // כפתור המשך
    this._appendContinueButton();
  },

  // ─── הוספת כפתור "המשך" ──────────────────────────────────────────────────
  _appendContinueButton() {
    const { questions, current } = this.state;
    const isLast = current >= questions.length - 1;

    const btn = document.createElement('button');
    btn.className   = 'btn btn--primary quiz-next-btn';
    btn.textContent = isLast ? 'סיים חידון' : 'שאלה הבאה';
    btn.setAttribute('aria-label', isLast ? 'סיים חידון וראה תוצאות' : 'עבור לשאלה הבאה');
    btn.onclick = () => this.next();

    const container = document.getElementById('quiz-container');
    if (container) container.appendChild(btn);

    // פוקוס לכפתור לנגישות
    btn.focus();
  },

  // ─── שאלה הבאה ───────────────────────────────────────────────────────────
  next() {
    this.state.current++;
    this.state.locked = false;

    if (this.state.current >= this.state.questions.length) {
      this.showResults();
    } else {
      this.render();
    }
  },

  // ─── מסך תוצאות ──────────────────────────────────────────────────────────
  showResults() {
    const { questions, score, answers, topicId, startTime } = this.state;
    const total      = questions.length;
    const correct    = answers.filter(a => a.isCorrect).length;
    const finalScore = Math.round((correct / total) * 100);
    const passed     = finalScore >= 70; // סף מעבר לבגרות
    const elapsed    = Math.round((Date.now() - startTime) / 1000);
    const container  = this.state.container;

    // שמירה ב-storage
    Storage.setTopicProgress(topicId, finalScore, correct, total);
    Storage.addQuizResult(topicId, finalScore);

    const passText    = passed ? 'עברת!' : 'לא עברת';
    const passClass   = passed ? 'results--pass' : 'results--fail';
    const passColor   = passed ? '#22c55e' : '#ef4444';
    const emoji       = passed ? '🎉' : '📚';

    // רשימת שאלות שגויות לחזרה
    const wrongItems = answers
      .filter(a => !a.isCorrect)
      .map((a, i) => {
        const q = questions.find(q => (q.id || questions.indexOf(q)) === a.questionId)
                  || questions[i];
        return q
          ? `<li class="results__wrong-item">${sanitizeHTML(q.question)}</li>`
          : '';
      }).join('');

    const wrongSection = wrongItems
      ? `<div class="results__wrong">
           <h3>שאלות לחזור עליהן:</h3>
           <ul>${wrongItems}</ul>
         </div>`
      : '';

    if (!container) return;

    container.innerHTML = `
      <div class="quiz-results ${passClass}" role="main" aria-label="תוצאות החידון">
        <div class="results__icon" aria-hidden="true" style="font-size:3rem">${emoji}</div>
        <h2 class="results__title" style="color:${passColor}">${passText}</h2>

        <div class="results__score-circle" aria-label="ציון ${finalScore}%">
          <svg viewBox="0 0 120 120" width="120" height="120" aria-hidden="true">
            <circle cx="60" cy="60" r="50" fill="none"
                    stroke="#e5e7eb" stroke-width="10"/>
            <circle cx="60" cy="60" r="50" fill="none"
                    stroke="${passColor}" stroke-width="10"
                    stroke-dasharray="${Math.round(2 * Math.PI * 50 * finalScore / 100)} ${Math.round(2 * Math.PI * 50 * (100 - finalScore) / 100)}"
                    stroke-dashoffset="${Math.round(2 * Math.PI * 50 * 0.25)}"
                    transform="rotate(-90 60 60)"/>
            <text x="60" y="65" text-anchor="middle"
                  font-size="24" font-weight="bold" fill="${passColor}">
              ${finalScore}%
            </text>
          </svg>
        </div>

        <div class="results__stats">
          <div class="results__stat">
            <span class="results__stat-value">${correct}/${total}</span>
            <span class="results__stat-label">תשובות נכונות</span>
          </div>
          <div class="results__stat">
            <span class="results__stat-value">${formatTime(elapsed)}</span>
            <span class="results__stat-label">זמן</span>
          </div>
        </div>

        ${wrongSection}

        <div class="results__actions">
          <button class="btn btn--primary" onclick="QuizEngine.retry()">
            נסה שוב
          </button>
          <a href="index.html" class="btn btn--secondary">
            חזור לדף הבית
          </a>
        </div>
      </div>`;
  },

  // ─── ניסיון חוזר (אותו נושא) ─────────────────────────────────────────────
  retry() {
    this.start(this.state.questions, this.state.topicId);
  },

  // ─── טעינת שאלות מ-JSON ──────────────────────────────────────────────────
  loadQuestions(filter) {
    // filter: { topicId } | { weekId } | null (הכל)
    return fetch('data/questions.json')
      .then(res => {
        if (!res.ok) throw new Error('שגיאה בטעינת questions.json: ' + res.status);
        return res.json();
      })
      .then(data => {
        let questions = Array.isArray(data) ? data : (data.questions || []);

        if (filter && filter.topicId) {
          questions = questions.filter(q => q.topicId === filter.topicId);
        } else if (filter && filter.weekId) {
          questions = questions.filter(q => q.weekId === filter.weekId);
        }

        return questions;
      })
      .catch(err => {
        console.error('[QuizEngine] loadQuestions:', err);
        return [];
      });
  },

  // ─── נקודת כניסה עם טעינה אוטומטית ────────────────────────────────────
  startWithFetch(filter, topicId) {
    const container = document.getElementById('quiz-container');
    if (container) {
      container.innerHTML = '<div class="loading" aria-live="polite">טוען שאלות...</div>';
    }

    this.loadQuestions(filter).then(questions => {
      if (questions.length === 0) {
        if (container) {
          container.innerHTML = '<p class="empty-state">לא נמצאו שאלות לנושא זה.</p>';
        }
        return;
      }
      this.start(questions, topicId);
    });
  }
};

// חשיפה גלובלית
window.QuizEngine = QuizEngine;
