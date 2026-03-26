/**
 * progress.js — גרפי SVG להצגת התקדמות (ללא ספריות חיצוניות)
 * תלות: utils.js, storage.js
 *
 * כולל:
 *   - גרף קו (היסטוריית ציונים)
 *   - גרף עמודות אופקיות (שליטה לפי נושא)
 *   - לוח שנה חום (GitHub-style streak)
 *   - loadAll() — אתחול דף progress.html
 */

'use strict';

const Progress = {

  // ─── קבועים ויזואליים ─────────────────────────────────────────────────────
  COLORS: {
    green:  '#22c55e',
    amber:  '#f59e0b',
    red:    '#ef4444',
    blue:   '#3b82f6',
    grid:   '#e5e7eb',
    text:   '#374151',
    bg:     '#f9fafb'
  },

  // ─── עזר: יצירת אלמנט SVG עם namespace נכון ──────────────────────────────
  _svgEl(tag, attrs) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    if (attrs) {
      Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    }
    return el;
  },

  // ─── עזר: טקסט SVG ────────────────────────────────────────────────────────
  _svgText(content, attrs) {
    const el = this._svgEl('text', attrs);
    el.textContent = content;
    return el;
  },

  // ─── ניקוי container ──────────────────────────────────────────────────────
  _clear(containerId) {
    const el = document.getElementById(containerId);
    if (el) el.innerHTML = '';
    return el;
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  גרף קו — היסטוריית ציונים
  // ══════════════════════════════════════════════════════════════════════════
  /**
   * @param {string} containerId
   * @param {Array}  data — [{ date: "YYYY-MM-DD", score: 85, label: "..." }]
   */
  renderLineChart(containerId, data) {
    const container = this._clear(containerId);
    if (!container) return;

    if (!data || data.length === 0) {
      container.innerHTML = '<p class="empty-state">אין נתוני ציון עדיין.</p>';
      return;
    }

    // ממדים
    const W  = 560, H  = 260;
    const PL = 50,  PR = 20, PT = 20, PB = 40; // padding
    const chartW = W - PL - PR;
    const chartH = H - PT - PB;

    const svg = this._svgEl('svg', {
      viewBox:  `0 0 ${W} ${H}`,
      width:    '100%',
      role:     'img',
      'aria-label': 'גרף היסטוריית ציונים'
    });

    // רקע
    svg.appendChild(this._svgEl('rect', {
      x: 0, y: 0, width: W, height: H,
      fill: this.COLORS.bg, rx: 8
    }));

    // ─ קווי רשת ─
    const gridLines = [0, 25, 50, 75, 100];
    gridLines.forEach(val => {
      const y = PT + chartH - (val / 100) * chartH;
      // קו
      svg.appendChild(this._svgEl('line', {
        x1: PL, y1: y, x2: PL + chartW, y2: y,
        stroke: this.COLORS.grid,
        'stroke-width': 1,
        'stroke-dasharray': val === 0 ? 'none' : '4 4'
      }));
      // תווית ציר Y
      svg.appendChild(this._svgText(val + '%', {
        x: PL - 8, y: y + 4,
        'text-anchor': 'end',
        'font-size': '11',
        fill: this.COLORS.text
      }));
    });

    // ─ קו סף מעבר (70%) ─
    const passY = PT + chartH - 0.70 * chartH;
    svg.appendChild(this._svgEl('line', {
      x1: PL, y1: passY, x2: PL + chartW, y2: passY,
      stroke: this.COLORS.amber,
      'stroke-width': 1.5,
      'stroke-dasharray': '6 3',
      opacity: '0.7'
    }));
    svg.appendChild(this._svgText('70% מעבר', {
      x: PL + chartW + 4, y: passY + 4,
      'font-size': '10',
      fill: this.COLORS.amber
    }));

    // ─ חישוב נקודות ─
    const n      = data.length;
    const xStep  = n > 1 ? chartW / (n - 1) : chartW;

    const points = data.map((d, i) => ({
      x: PL + (n === 1 ? chartW / 2 : i * xStep),
      y: PT + chartH - clamp(d.score, 0, 100) / 100 * chartH,
      score: d.score,
      date:  d.date,
      label: d.label || ''
    }));

    // ─ אזור גרדיאנט מתחת לקו ─
    const gradId = 'line-grad-' + containerId;
    const defs   = this._svgEl('defs');
    const grad   = this._svgEl('linearGradient', {
      id: gradId, x1: '0', y1: '0', x2: '0', y2: '1'
    });
    const stop1 = this._svgEl('stop', {
      offset: '0%', 'stop-color': this.COLORS.blue, 'stop-opacity': '0.3'
    });
    const stop2 = this._svgEl('stop', {
      offset: '100%', 'stop-color': this.COLORS.blue, 'stop-opacity': '0'
    });
    grad.appendChild(stop1);
    grad.appendChild(stop2);
    defs.appendChild(grad);
    svg.appendChild(defs);

    // ─ פוליגון מלא ─
    const polyPts = [
      `${PL},${PT + chartH}`,
      ...points.map(p => `${p.x},${p.y}`),
      `${points[points.length - 1].x},${PT + chartH}`
    ].join(' ');
    svg.appendChild(this._svgEl('polygon', {
      points: polyPts,
      fill: `url(#${gradId})`
    }));

    // ─ פוליליין ─
    const linePts = points.map(p => `${p.x},${p.y}`).join(' ');
    svg.appendChild(this._svgEl('polyline', {
      points: linePts,
      fill: 'none',
      stroke: this.COLORS.blue,
      'stroke-width': '2.5',
      'stroke-linejoin': 'round',
      'stroke-linecap': 'round'
    }));

    // ─ נקודות ותוויות ─
    points.forEach((p, i) => {
      const color = p.score >= 80
        ? this.COLORS.green
        : p.score >= 60
          ? this.COLORS.amber
          : this.COLORS.red;

      // עיגול
      const circle = this._svgEl('circle', {
        cx: p.x, cy: p.y, r: '5',
        fill: color, stroke: '#fff', 'stroke-width': '2'
      });
      // Tooltip
      const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
      title.textContent = `${p.date}: ${p.score}%`;
      circle.appendChild(title);
      svg.appendChild(circle);

      // תווית תאריך על ציר X (כל 2-3 נקודות כדי לא לדחוק)
      if (i === 0 || i === n - 1 || (n <= 7) || i % Math.ceil(n / 5) === 0) {
        svg.appendChild(this._svgText(p.date ? p.date.slice(5) : '', { // MM-DD
          x: p.x, y: H - PT + 6,
          'text-anchor': 'middle',
          'font-size': '10',
          fill: this.COLORS.text
        }));
      }
    });

    // ─ כותרת ─
    svg.appendChild(this._svgText('היסטוריית ציונים', {
      x: PL, y: PT - 5,
      'font-size': '13',
      'font-weight': 'bold',
      fill: this.COLORS.text
    }));

    container.appendChild(svg);
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  גרף עמודות אופקיות — שליטה לפי נושא
  // ══════════════════════════════════════════════════════════════════════════
  /**
   * @param {string} containerId
   * @param {Object} topicProgress — { topicId: { score, label?, attempts } }
   */
  renderTopicBars(containerId, topicProgress) {
    const container = this._clear(containerId);
    if (!container) return;

    const entries = Object.entries(topicProgress);
    if (entries.length === 0) {
      container.innerHTML = '<p class="empty-state">לא נלמדו נושאים עדיין.</p>';
      return;
    }

    // מיון לפי ציון יורד
    entries.sort((a, b) => b[1].score - a[1].score);

    const rowH  = 42;
    const W     = 560;
    const PL    = 140; // מקום לתוויות
    const PR    = 60;  // מקום לאחוזים
    const BAR_W = W - PL - PR;
    const H     = entries.length * rowH + 40;

    const svg = this._svgEl('svg', {
      viewBox:  `0 0 ${W} ${H}`,
      width:    '100%',
      role:     'img',
      'aria-label': 'שליטה לפי נושא'
    });

    // רקע
    svg.appendChild(this._svgEl('rect', {
      x: 0, y: 0, width: W, height: H,
      fill: this.COLORS.bg, rx: 8
    }));

    // כותרת
    svg.appendChild(this._svgText('שליטה לפי נושא', {
      x: 10, y: 22,
      'font-size': '13',
      'font-weight': 'bold',
      fill: this.COLORS.text
    }));

    entries.forEach(([topicId, data], i) => {
      const y      = 30 + i * rowH;
      const score  = clamp(data.score || 0, 0, 100);
      const label  = data.label || topicId;
      const bw     = Math.round((score / 100) * BAR_W);
      const color  = score >= 80
        ? this.COLORS.green
        : score >= 60
          ? this.COLORS.amber
          : this.COLORS.red;

      // תווית נושא (משמאל)
      svg.appendChild(this._svgText(truncate(label, 18), {
        x: PL - 8, y: y + 16,
        'text-anchor': 'end',
        'font-size': '12',
        fill: this.COLORS.text
      }));

      // רקע עמודה (אפור)
      svg.appendChild(this._svgEl('rect', {
        x: PL, y: y + 4, width: BAR_W, height: 22,
        fill: this.COLORS.grid, rx: 4
      }));

      // עמודה צבועה
      if (bw > 0) {
        const bar = this._svgEl('rect', {
          x: PL, y: y + 4, width: bw, height: 22,
          fill: color, rx: 4
        });
        const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
        title.textContent = `${label}: ${score}%`;
        bar.appendChild(title);
        svg.appendChild(bar);
      }

      // אחוז (מימין)
      svg.appendChild(this._svgText(formatScore(score), {
        x: PL + BAR_W + 8, y: y + 16,
        'font-size': '12',
        'font-weight': 'bold',
        fill: color
      }));

      // מספר ניסיונות
      if (data.attempts) {
        svg.appendChild(this._svgText(`(${data.attempts} ניסיונות)`, {
          x: PL + BAR_W + 8, y: y + 26,
          'font-size': '9',
          fill: '#9ca3af'
        }));
      }
    });

    container.appendChild(svg);
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  לוח שנה חום — GitHub-style (8 שבועות × 7 ימים)
  // ══════════════════════════════════════════════════════════════════════════
  /**
   * @param {string} containerId
   * @param {Array}  history — [{ date: "YYYY-MM-DD", score }]
   */
  renderStreakCalendar(containerId, history) {
    const container = this._clear(containerId);
    if (!container) return;

    // בניית מפה תאריך → מספר פגישות
    const activityMap = {};
    (history || []).forEach(h => {
      if (!h.date) return;
      activityMap[h.date] = (activityMap[h.date] || 0) + 1;
    });

    // 8 שבועות × 7 ימים = 56 ימים אחורה
    const WEEKS = 8;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // מצא את יום ראשון (0) של השבוע הנוכחי
    const currentDayOfWeek = today.getDay(); // 0=ראשון
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - currentDayOfWeek - (WEEKS - 1) * 7);

    const CELL  = 16; // גודל תא
    const GAP   = 3;  // רווח
    const STEP  = CELL + GAP;
    const W     = WEEKS * STEP + 80;
    const H     = 7    * STEP + 50;
    const PL    = 30;  // מקום לתוויות ימים
    const PT    = 26;  // מקום לתוויות שבועות

    const svg = this._svgEl('svg', {
      viewBox:  `0 0 ${W} ${H}`,
      width:    '100%',
      role:     'img',
      'aria-label': 'לוח פעילות לימוד'
    });

    // רקע
    svg.appendChild(this._svgEl('rect', {
      x: 0, y: 0, width: W, height: H,
      fill: this.COLORS.bg, rx: 8
    }));

    // כותרת
    svg.appendChild(this._svgText('פעילות לימוד — 8 שבועות אחרונים', {
      x: 10, y: 16,
      'font-size': '12',
      'font-weight': 'bold',
      fill: this.COLORS.text
    }));

    // תוויות ימים (ש,ו,ה,ד,ג,ב,א)
    const dayLabels = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];
    dayLabels.forEach((label, d) => {
      svg.appendChild(this._svgText(label, {
        x: PL - 6, y: PT + d * STEP + CELL - 3,
        'text-anchor': 'end',
        'font-size': '10',
        fill: '#9ca3af'
      }));
    });

    // ציור תאים
    for (let w = 0; w < WEEKS; w++) {
      // תווית שבוע (חודש)
      const weekStart = new Date(startDate);
      weekStart.setDate(startDate.getDate() + w * 7);
      const monthLabel = weekStart.toLocaleDateString('he-IL', { month: 'short' });

      // הצג חודש רק בתחילת כל חודש חדש
      if (w === 0 || weekStart.getDate() <= 7) {
        svg.appendChild(this._svgText(monthLabel, {
          x: PL + w * STEP + CELL / 2, y: PT - 6,
          'text-anchor': 'middle',
          'font-size': '9',
          fill: '#9ca3af'
        }));
      }

      for (let d = 0; d < 7; d++) {
        const cellDate = new Date(startDate);
        cellDate.setDate(startDate.getDate() + w * 7 + d);
        const dateStr = cellDate.toISOString().slice(0, 10);

        const count = activityMap[dateStr] || 0;
        const isFuture = cellDate > today;

        // צבע לפי פעילות
        let fillColor;
        if (isFuture) {
          fillColor = 'transparent';
        } else if (count === 0) {
          fillColor = '#e5e7eb';
        } else if (count === 1) {
          fillColor = '#bbf7d0'; // ירוק בהיר
        } else if (count === 2) {
          fillColor = '#4ade80'; // ירוק
        } else {
          fillColor = '#16a34a'; // ירוק כהה
        }

        const x = PL + w * STEP;
        const y = PT + d * STEP;

        const cell = this._svgEl('rect', {
          x: x, y: y, width: CELL, height: CELL,
          fill: fillColor, rx: 3
        });

        // Tooltip
        if (!isFuture) {
          const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
          title.textContent = `${dateStr}: ${count} פגישות לימוד`;
          cell.appendChild(title);
        }

        svg.appendChild(cell);
      }
    }

    // אגדה
    const legendX = PL;
    const legendY = H - 12;
    svg.appendChild(this._svgText('פחות', {
      x: legendX, y: legendY,
      'font-size': '9', fill: '#9ca3af'
    }));

    ['#e5e7eb', '#bbf7d0', '#4ade80', '#16a34a'].forEach((c, i) => {
      svg.appendChild(this._svgEl('rect', {
        x: legendX + 32 + i * (CELL + 2),
        y: legendY - CELL + 2,
        width: CELL, height: CELL,
        fill: c, rx: 2
      }));
    });

    svg.appendChild(this._svgText('יותר', {
      x: legendX + 32 + 4 * (CELL + 2) + 4,
      y: legendY,
      'font-size': '9', fill: '#9ca3af'
    }));

    container.appendChild(svg);
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  גרף עוגה פשוט — לחלוקה כלשהי (עזר)
  // ══════════════════════════════════════════════════════════════════════════
  /**
   * @param {string} containerId
   * @param {Array}  segments — [{ label, value, color }]
   */
  renderPieChart(containerId, segments) {
    const container = this._clear(containerId);
    if (!container) return;

    const total = segments.reduce((s, seg) => s + seg.value, 0);
    if (total === 0) {
      container.innerHTML = '<p class="empty-state">אין נתונים.</p>';
      return;
    }

    const CX = 80, CY = 80, R = 70;
    const W  = 260, H  = 180;

    const svg = this._svgEl('svg', {
      viewBox: `0 0 ${W} ${H}`, width: '100%',
      role: 'img', 'aria-label': 'גרף עוגה'
    });

    let startAngle = -Math.PI / 2; // מתחיל מלמעלה

    segments.forEach(seg => {
      const angle   = (seg.value / total) * 2 * Math.PI;
      const endAngle = startAngle + angle;
      const x1 = CX + R * Math.cos(startAngle);
      const y1 = CY + R * Math.sin(startAngle);
      const x2 = CX + R * Math.cos(endAngle);
      const y2 = CY + R * Math.sin(endAngle);
      const largeArc = angle > Math.PI ? 1 : 0;

      const path = this._svgEl('path', {
        d: `M ${CX},${CY} L ${x1},${y1} A ${R},${R} 0 ${largeArc},1 ${x2},${y2} Z`,
        fill: seg.color || this.COLORS.blue
      });
      const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
      title.textContent = `${seg.label}: ${Math.round((seg.value / total) * 100)}%`;
      path.appendChild(title);
      svg.appendChild(path);

      startAngle = endAngle;
    });

    // אגדה מצד שמאל
    segments.forEach((seg, i) => {
      const ly = 20 + i * 20;
      svg.appendChild(this._svgEl('rect', {
        x: CX * 2 + 10, y: ly - 10, width: 12, height: 12,
        fill: seg.color || this.COLORS.blue, rx: 2
      }));
      svg.appendChild(this._svgText(
        `${seg.label} (${Math.round((seg.value / total) * 100)}%)`,
        {
          x: CX * 2 + 26, y: ly,
          'font-size': '11', fill: this.COLORS.text
        }
      ));
    });

    container.appendChild(svg);
  },

  // ══════════════════════════════════════════════════════════════════════════
  //  loadAll — אתחול דף progress.html
  // ══════════════════════════════════════════════════════════════════════════
  loadAll() {
    const progressData  = Storage.getProgress();
    const streak        = Storage.getStreak();
    const quizHistory   = Storage.getQuizHistory();

    // ─ עדכון כרטיסי סטטיסטיקה ─
    this._updateStatCards(progressData, streak);

    // ─ גרף קו — ציונים לאורך זמן ─
    const lineData = quizHistory
      .filter(h => h.score !== undefined && h.date)
      .slice(-30) // 30 רשומות אחרונות
      .map(h => ({
        date:  h.date,
        score: h.score,
        label: h.topicId || 'חידון'
      }));

    this.renderLineChart('progress-line-chart', lineData);

    // ─ גרף עמודות — שליטה לפי נושא ─
    this.renderTopicBars('progress-topic-bars', progressData.topicProgress || {});

    // ─ לוח שנה ─
    this.renderStreakCalendar('progress-streak-cal', quizHistory);

    // ─ ניקוי ישן ─
    Storage.cleanup();
  },

  // ─── עדכון כרטיסי סטטיסטיקה בדף ────────────────────────────────────────
  _updateStatCards(progressData, streak) {
    const ids = {
      'stat-streak':      streak.current + ' ימים',
      'stat-longest':     streak.longest + ' ימים',
      'stat-avg-score':   formatScore(progressData.totalScore || 0),
      'stat-topics-done': Object.keys(progressData.topicProgress || {}).length + ' נושאים'
    };

    Object.entries(ids).forEach(([id, val]) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    });
  }
};

// חשיפה גלובלית
window.Progress = Progress;
