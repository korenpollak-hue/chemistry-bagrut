/**
 * simulator.js — סימולטור מבחן בגרות מלא
 * תלות: utils.js, storage.js
 *
 * מאפיינים:
 *   - 2 שעות זמן (7200 שניות), הגשה אוטומטית בסיום
 *   - ניווט חופשי בין שאלות (לא כמו חידון)
 *   - ציון לפי חלקים (פרקים) + ציון כולל
 *   - שמירת תשובות ב-memory בזמן אמת
 *   - רשת ניווט (grid) צבעונית
 *
 * התפלגות שאלות (קירוב לבגרות):
 *   פרק א — 40% (כימיה כללית, מושגים)
 *   פרק ב — 35% (כימיה אורגנית, תגובות)
 *   פרק ג — 25% (חישובים, סטוכיומטריה)
 */

'use strict';

const BagrutSimulator = {

  // ─── מצב פנימי ─────────────────────────────────────────────────────────
  state: {
    questions:      [],    // כל שאלות הסימולטור
    current:        0,     // אינדקס שאלה מוצגת
    answers:        {},    // { index: selectedValue }
    timeLeft:       7200,  // 2 שעות בשניות
    timerInterval:  null,  // ID של setInterval
    submitted:      false, // האם הוגש?
    startTime:      null,  // Date.now() — לחישוב זמן
    container:      null,
    navContainer:   null,
    timerEl:        null
  },

  // התפלגות שאלות לפי פרק (מספרים = מקסימום שאלות מהנושא)
  DISTRIBUTION: {
    'general':    { label: 'פרק א — כימיה כללית',    weight: 0.40, maxQ: 20 },
    'organic':    { label: 'פרק ב — כימיה אורגנית',  weight: 0.35, maxQ: 18 },
    'stoich':     { label: 'פרק ג — חישובים',         weight: 0.25, maxQ: 12 }
  },

  // ─── התחלת סימולטור ───────────────────────────────────────────────────────
  start() {
    const container    = document.getElementById('simulator-container');
    const navContainer = document.getElementById('simulator-nav');
    const timerEl      = document.getElementById('simulator-timer');

    if (!container) {
      console.error('[BagrutSimulator] חסר אלמנט #simulator-container');
      return;
    }

    this.state.container    = container;
    this.state.navContainer = navContainer;
    this.state.timerEl      = timerEl;

    container.innerHTML = '<div class="loading" aria-live="polite">בונה מבחן...</div>';

    // טעינת כל השאלות
    fetch('data/questions.json')
      .then(res => {
        if (!res.ok) throw new Error('שגיאה בטעינת questions.json: ' + res.status);
        return res.json();
      })
      .then(data => {
        const allQ = Array.isArray(data) ? data : (data.questions || []);
        this._buildExam(allQ);
      })
      .catch(err => {
        console.error('[BagrutSimulator] start:', err);
        container.innerHTML = '<p class="empty-state">שגיאה בטעינת השאלות.</p>';
      });
  },

  // ─── בניית מבחן מאוזן לפי התפלגות ──────────────────────────────────────
  _buildExam(allQuestions) {
    const selected = [];

    // מיון לפי קטגוריות
    const bySection = {
      general: allQuestions.filter(q => q.section === 'general' || q.topicId === 'general'),
      organic:  allQuestions.filter(q => q.section === 'organic'  || q.topicId === 'organic'),
      stoich:   allQuestions.filter(q => q.section === 'stoich'   || q.topicId === 'stoich')
    };

    // שאלות ללא קטגוריה — מחלקים שווה
    const uncategorized = allQuestions.filter(q =>
      !q.section && !['general','organic','stoich'].includes(q.topicId)
    );

    const TOTAL_TARGET = 50; // מספר שאלות מטרה

    Object.entries(this.DISTRIBUTION).forEach(([key, cfg]) => {
      const pool    = shuffle(bySection[key] || []);
      const howMany = Math.round(TOTAL_TARGET * cfg.weight);
      const taken   = pool.slice(0, Math.min(howMany, cfg.maxQ, pool.length));
      // מסמנים פרק
      taken.forEach(q => {
        selected.push(Object.assign({}, q, { _section: key, _sectionLabel: cfg.label }));
      });
    });

    // השלמה עם שאלות לא-קטגוריות אם יש
    if (selected.length < TOTAL_TARGET && uncategorized.length > 0) {
      const remaining = shuffle(uncategorized).slice(0, TOTAL_TARGET - selected.length);
      remaining.forEach(q => selected.push(Object.assign({}, q, {
        _section: 'general', _sectionLabel: this.DISTRIBUTION.general.label
      })));
    }

    // אם אין מספיק שאלות — נשתמש בכל מה שיש
    if (selected.length === 0) {
      allQuestions.slice(0, 50).forEach(q => selected.push(Object.assign({}, q, {
        _section: 'general', _sectionLabel: this.DISTRIBUTION.general.label
      })));
    }

    this.state.questions  = selected;
    this.state.current    = 0;
    this.state.answers    = {};
    this.state.submitted  = false;
    this.state.startTime  = Date.now();
    this.state.timeLeft   = 7200;

    // הפעלת טיימר
    this._startTimer();

    // רינדור ראשון
    this.renderNav();
    this.goto(0);
  },

  // ─── ניווט לשאלה לפי אינדקס ──────────────────────────────────────────────
  goto(index) {
    if (this.state.submitted) return;

    const q = this.state.questions[index];
    if (!q) return;

    // שמירת תשובה נוכחית לפני מעבר (לסוג numeric)
    this._saveCurrentNumericAnswer();

    this.state.current = index;
    this._renderQuestion(q, index);
    this._highlightNav(index);
  },

  // ─── רינדור שאלה בודדת ───────────────────────────────────────────────────
  _renderQuestion(q, index) {
    const { container, questions, answers } = this.state;
    if (!container) return;

    const total      = questions.length;
    const answered   = Object.keys(answers).length;
    const savedAns   = answers[index];
    const type       = q.type || 'multiple-choice';

    // כותרת פרק
    const sectionBadge = q._sectionLabel
      ? `<span class="sim-section-badge">${sanitizeHTML(q._sectionLabel)}</span>`
      : '';

    // גוף לפי סוג
    let optionsHTML = '';
    if (type === 'true-false') {
      optionsHTML = this._tfHTML(index, savedAns);
    } else if (type === 'numeric') {
      optionsHTML = this._numericHTML(index, savedAns);
    } else {
      optionsHTML = this._mcHTML(q, index, savedAns);
    }

    container.innerHTML = `
      <div class="sim-question-wrap">
        <div class="sim-question-header">
          ${sectionBadge}
          <span class="sim-question-num">שאלה ${index + 1} מתוך ${total}</span>
          <span class="sim-answered-count">${answered} נענו</span>
        </div>

        <div class="sim-question-body">
          <p class="sim-question-text">${sanitizeHTML(q.question)}</p>
          ${q.image
            ? `<img src="${sanitizeHTML(q.image)}" alt="תמונה לשאלה ${index + 1}"
                   class="sim-question-img" loading="lazy">`
            : ''}
        </div>

        <div class="sim-options" id="sim-options" data-type="${sanitizeHTML(type)}">
          ${optionsHTML}
        </div>

        <div class="sim-nav-btns">
          <button class="btn btn--secondary"
                  onclick="BagrutSimulator.goto(${index - 1})"
                  ${index === 0 ? 'disabled aria-disabled="true"' : ''}
                  aria-label="שאלה קודמת">
            &larr; קודם
          </button>
          <button class="btn btn--secondary"
                  onclick="BagrutSimulator.goto(${index + 1})"
                  ${index === total - 1 ? 'disabled aria-disabled="true"' : ''}
                  aria-label="שאלה הבאה">
            הבא &rarr;
          </button>
        </div>
      </div>`;

    // סוג numeric — חיבור אירועים
    if (type === 'numeric') {
      const inp = document.getElementById('sim-numeric-' + index);
      if (inp) {
        inp.addEventListener('change', () => {
          this._saveCurrentNumericAnswer();
          this.renderNav(); // עדכון צבע גריד
        });
      }
    }
  },

  // ─── HTML לשאלת בחירה מרובה ──────────────────────────────────────────────
  _mcHTML(q, index, savedAns) {
    if (!q.options || !q.options.length) return '<p>שגיאה: אין אפשרויות לשאלה</p>';
    return q.options.map((opt, i) => {
      const checked = savedAns === i ? 'checked' : '';
      return `
        <label class="sim-option ${savedAns === i ? 'sim-option--selected' : ''}">
          <input type="radio" name="sim_q_${index}" value="${i}"
                 ${checked}
                 onchange="BagrutSimulator._saveAnswer(${index}, ${i})">
          <span class="sim-option__text">${sanitizeHTML(opt)}</span>
        </label>`;
    }).join('');
  },

  // ─── HTML לנכון/לא נכון ──────────────────────────────────────────────────
  _tfHTML(index, savedAns) {
    return [
      { val: 0, label: 'נכון' },
      { val: 1, label: 'לא נכון' }
    ].map(opt => {
      const checked = savedAns === opt.val ? 'checked' : '';
      return `
        <label class="sim-option ${savedAns === opt.val ? 'sim-option--selected' : ''}">
          <input type="radio" name="sim_q_${index}" value="${opt.val}"
                 ${checked}
                 onchange="BagrutSimulator._saveAnswer(${index}, ${opt.val})">
          <span class="sim-option__text">${opt.label}</span>
        </label>`;
    }).join('');
  },

  // ─── HTML לקלט מספרי ─────────────────────────────────────────────────────
  _numericHTML(index, savedAns) {
    const q    = this.state.questions[index];
    const unit = q.unit ? `<span class="sim-unit">${sanitizeHTML(q.unit)}</span>` : '';
    return `
      <div class="sim-numeric">
        <label for="sim-numeric-${index}" class="sim-numeric__label">
          הזן תשובה:
        </label>
        <div class="sim-numeric__row">
          <input type="number" id="sim-numeric-${index}"
                 class="sim-numeric__input"
                 value="${savedAns !== undefined ? savedAns : ''}"
                 placeholder="0" autocomplete="off"
                 aria-label="קלט מספרי לשאלה ${index + 1}">
          ${unit}
        </div>
      </div>`;
  },

  // ─── שמירת תשובה (radio/tf) ──────────────────────────────────────────────
  _saveAnswer(index, value) {
    this.state.answers[index] = value;
    // עדכון צבע גריד
    this.renderNav();
  },

  // ─── שמירת תשובה מספרית מהשדה הנוכחי ────────────────────────────────────
  _saveCurrentNumericAnswer() {
    const idx = this.state.current;
    const q   = this.state.questions[idx];
    if (!q || (q.type || 'multiple-choice') !== 'numeric') return;

    const inp = document.getElementById('sim-numeric-' + idx);
    if (!inp) return;

    const val = parseFloat(inp.value);
    if (!isNaN(val)) {
      this.state.answers[idx] = val;
    }
  },

  // ─── רינדור גריד ניווט ───────────────────────────────────────────────────
  renderNav() {
    const { navContainer, questions, answers, current } = this.state;
    if (!navContainer) return;

    const cells = questions.map((q, i) => {
      const isAnswered = answers[i] !== undefined;
      const isCurrent  = i === current;

      let cls = 'sim-nav-cell';
      if (isCurrent)  cls += ' sim-nav-cell--active';
      if (isAnswered) cls += ' sim-nav-cell--answered';

      return `
        <button class="${cls}"
                onclick="BagrutSimulator.goto(${i})"
                aria-label="שאלה ${i + 1}${isAnswered ? ' — נענתה' : ''}"
                aria-current="${isCurrent ? 'true' : 'false'}">
          ${i + 1}
        </button>`;
    }).join('');

    const total    = questions.length;
    const answered = Object.keys(answers).length;

    navContainer.innerHTML = `
      <div class="sim-nav-summary" aria-live="polite">
        <span>${answered} / ${total} נענו</span>
      </div>
      <div class="sim-nav-grid" role="group" aria-label="ניווט שאלות">
        ${cells}
      </div>
      <button class="btn btn--danger sim-submit-btn"
              onclick="BagrutSimulator._confirmSubmit()"
              aria-label="הגש מבחן">
        הגש מבחן
      </button>`;
  },

  // ─── הדגשת תא ניווט פעיל ─────────────────────────────────────────────────
  _highlightNav(index) {
    const cells = document.querySelectorAll('.sim-nav-cell');
    cells.forEach((cell, i) => {
      cell.classList.toggle('sim-nav-cell--active', i === index);
      cell.setAttribute('aria-current', i === index ? 'true' : 'false');
    });
  },

  // ─── אישור הגשה ──────────────────────────────────────────────────────────
  _confirmSubmit() {
    const { questions, answers } = this.state;
    const unanswered = questions.length - Object.keys(answers).length;

    if (unanswered > 0) {
      const confirmed = window.confirm(
        `נשארו ${unanswered} שאלות ללא תשובה.\nהאם אתה בטוח שברצונך להגיש?`
      );
      if (!confirmed) return;
    }
    this.submit();
  },

  // ─── הגשת המבחן ───────────────────────────────────────────────────────────
  submit() {
    if (this.state.submitted) return;
    this.state.submitted = true;

    // עצירת טיימר
    clearInterval(this.state.timerInterval);
    this.state.timerInterval = null;

    // שמירת תשובה מספרית אחרונה
    this._saveCurrentNumericAnswer();

    const { questions, answers, startTime } = this.state;
    const elapsed = Math.round((Date.now() - startTime) / 1000);

    // ── חישוב ציונים ──
    const results = questions.map((q, i) => {
      const userAns = answers[i];
      let isCorrect = false;

      if (userAns === undefined) {
        isCorrect = false;
      } else if ((q.type || 'multiple-choice') === 'numeric') {
        const correct   = parseFloat(q.correctAnswer);
        const tolerance = q.tolerance !== undefined ? parseFloat(q.tolerance) : 0.01;
        if (q.toleranceType === 'percent') {
          isCorrect = Math.abs((userAns - correct) / correct) <= tolerance;
        } else {
          isCorrect = Math.abs(userAns - correct) <= tolerance;
        }
      } else {
        isCorrect = parseInt(userAns, 10) === parseInt(q.correctAnswer, 10);
      }

      return { q, userAns, isCorrect, section: q._section || 'general' };
    });

    // ציון כולל
    const totalCorrect = results.filter(r => r.isCorrect).length;
    const totalScore   = Math.round((totalCorrect / questions.length) * 100);

    // ציון לפי פרק
    const sectionScores = {};
    Object.keys(this.DISTRIBUTION).forEach(sec => {
      const secResults = results.filter(r => r.section === sec);
      if (secResults.length === 0) return;
      const correct = secResults.filter(r => r.isCorrect).length;
      sectionScores[sec] = {
        label:   this.DISTRIBUTION[sec].label,
        correct: correct,
        total:   secResults.length,
        score:   Math.round((correct / secResults.length) * 100)
      };
    });

    const passed = totalScore >= 56; // סף מעבר בגרות (56 בד"כ)

    // שמירה ב-storage
    Storage.addQuizResult('simulator', totalScore);
    Storage.updateStreak();

    this._renderResults(results, totalScore, totalCorrect, sectionScores, elapsed, passed);
  },

  // ─── רינדור מסך תוצאות ───────────────────────────────────────────────────
  _renderResults(results, totalScore, totalCorrect, sectionScores, elapsed, passed) {
    const { container, navContainer, timerEl, questions } = this.state;

    // ניקוי ניווט וטיימר
    if (navContainer) navContainer.innerHTML = '';
    if (timerEl)      timerEl.textContent    = '00:00';

    const passText  = passed ? 'עברת את הבגרות!' : 'לא עברת';
    const passClass = passed ? 'results--pass' : 'results--fail';
    const passColor = passed ? '#22c55e' : '#ef4444';
    const emoji     = passed ? '🎓' : '📖';

    // טבלת ציונים לפי פרק
    const sectionRows = Object.values(sectionScores).map(sec => `
      <tr>
        <td>${sanitizeHTML(sec.label)}</td>
        <td>${sec.correct} / ${sec.total}</td>
        <td style="color:${scoreColor(sec.score)};font-weight:bold">${formatScore(sec.score)}</td>
      </tr>`).join('');

    // שאלות שגויות (מוגבל ל-10 ראשונות)
    const wrongResults = results.filter(r => !r.isCorrect).slice(0, 10);
    const wrongHTML    = wrongResults.map((r, i) => `
      <div class="sim-wrong-item">
        <p class="sim-wrong-item__q">
          <strong>${i + 1}.</strong> ${sanitizeHTML(r.q.question)}
        </p>
        ${r.q.explanation
          ? `<p class="sim-wrong-item__exp">${sanitizeHTML(r.q.explanation)}</p>`
          : ''}
      </div>`).join('');

    if (!container) return;

    container.innerHTML = `
      <div class="sim-results ${passClass}" role="main" aria-label="תוצאות המבחן">

        <div class="sim-results__hero">
          <div class="sim-results__emoji" aria-hidden="true">${emoji}</div>
          <h1 class="sim-results__title" style="color:${passColor}">${passText}</h1>

          <div class="sim-results__score-ring" aria-label="ציון ${totalScore}%">
            <svg viewBox="0 0 140 140" width="140" height="140" aria-hidden="true">
              <circle cx="70" cy="70" r="58" fill="none"
                      stroke="#e5e7eb" stroke-width="12"/>
              <circle cx="70" cy="70" r="58" fill="none"
                      stroke="${passColor}" stroke-width="12"
                      stroke-dasharray="${(2 * Math.PI * 58 * totalScore / 100).toFixed(1)} ${(2 * Math.PI * 58 * (100 - totalScore) / 100).toFixed(1)}"
                      transform="rotate(-90 70 70)"/>
              <text x="70" y="75" text-anchor="middle"
                    font-size="28" font-weight="bold" fill="${passColor}">
                ${totalScore}%
              </text>
            </svg>
          </div>

          <div class="sim-results__meta">
            <span>${totalCorrect} / ${questions.length} נכון</span>
            <span>זמן: ${formatTime(elapsed)}</span>
          </div>
        </div>

        <!-- ציונים לפי פרק -->
        <div class="sim-results__sections">
          <h2>ציונים לפי פרק</h2>
          <table class="sim-section-table" aria-label="ציונים לפי פרק">
            <thead>
              <tr>
                <th scope="col">פרק</th>
                <th scope="col">נכון</th>
                <th scope="col">ציון</th>
              </tr>
            </thead>
            <tbody>${sectionRows}</tbody>
          </table>
        </div>

        <!-- שאלות שגויות -->
        ${wrongHTML ? `
          <div class="sim-results__wrong">
            <h2>שאלות לחזרה${wrongResults.length < results.filter(r => !r.isCorrect).length ? ' (10 ראשונות)' : ''}</h2>
            ${wrongHTML}
          </div>` : ''}

        <div class="sim-results__actions">
          <button class="btn btn--primary" onclick="BagrutSimulator.start()">
            מבחן חדש
          </button>
          <a href="index.html" class="btn btn--secondary">
            חזור לדף הבית
          </a>
        </div>
      </div>`;
  },

  // ─── טיימר ───────────────────────────────────────────────────────────────
  _startTimer() {
    // עצירת טיימר קיים
    if (this.state.timerInterval) {
      clearInterval(this.state.timerInterval);
    }

    this._updateTimerDisplay();

    this.state.timerInterval = setInterval(() => {
      this.tick();
    }, 1000);
  },

  tick() {
    if (this.state.submitted) {
      clearInterval(this.state.timerInterval);
      return;
    }

    this.state.timeLeft--;
    this._updateTimerDisplay();

    // אזהרות בנקודות מפתח
    if (this.state.timeLeft === 600) { // 10 דקות
      showToast('נשארו 10 דקות למבחן!', 'error');
    } else if (this.state.timeLeft === 300) { // 5 דקות
      showToast('נשארו 5 דקות — מהר!', 'error');
    }

    if (this.state.timeLeft <= 0) {
      showToast('הזמן נגמר — המבחן הוגש אוטומטית', 'info');
      this.submit();
    }
  },

  _updateTimerDisplay() {
    const { timerEl, timeLeft } = this.state;
    if (!timerEl) return;

    const formatted = formatTime(timeLeft);
    timerEl.textContent = formatted;

    // צביעה אדומה כשנשארות פחות מ-10 דקות
    if (timeLeft <= 600) {
      timerEl.classList.add('timer--warning');
    }
    if (timeLeft <= 60) {
      timerEl.classList.add('timer--critical');
    }
  }
};

// חשיפה גלובלית
window.BagrutSimulator = BagrutSimulator;
