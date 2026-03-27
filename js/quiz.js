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

// ─── הסברים פשוטים לפני כל שאלה (כמו לילד) ─────────────────────────────────
const TOPIC_LESSONS = {
  'thermochemistry': {
    emoji: '🔥',
    animation: 'lesson-fire',
    title: 'חום בתגובות כימיות',
    simple: 'כל תגובה כימית אוהבת לשחרר חום — או לקחת חום.',
    analogy: '🪵 כשמדליקים מדורה — חום יוצא החוצה. כשמחממים מים — חום נכנס פנימה. זה הכל!',
    keyword: 'ΔH שלילי = חום יוצא = חם 🔥 | ΔH חיובי = חום נכנס = קר ❄️'
  },
  'thermodynamics': {
    emoji: '⚡',
    animation: 'lesson-chaos',
    title: 'האם תגובה "תרצה" לקרות?',
    simple: 'לכל תגובה יש "רצון" לקרות — אנרגיית גיבס ΔG קובעת אם היא קורה מעצמה.',
    analogy: '⚽ כדור תמיד מתגלגל מטה מעצמו (ΔG שלילי = ספונטני). הוא לא מתגלגל לעלה מעצמו (ΔG חיובי). פשוט כך.',
    keyword: 'ΔG = ΔH - TΔS | ΔG שלילי = קורה מעצמו ✅ | ΔG חיובי = לא קורה ❌'
  },
  'equilibrium': {
    emoji: '⚖️',
    animation: 'lesson-balance',
    title: 'תגובות שלא מסיימות עד הסוף',
    simple: 'חלק מהתגובות לא הופכות הכל למוצרים — הן מגיעות לנקודת איזון בין שני הכיוונים.',
    analogy: '🔄 דמיין מגלשה ים שצד אחד עולה וצד אחד יורד — בסוף מספר אנשים בכל צד נשאר קבוע. זה שיווי משקל!',
    keyword: 'Kc גדול = הרבה מוצרים | Kc קטן = מעט מוצרים | כלל: מוצרים למעלה, מגיבים למטה'
  },
  'le-chatelier': {
    emoji: '↔️',
    animation: 'lesson-push',
    title: 'עיקרון לה שאטליה — התגובה נלחמת',
    simple: 'שינית משהו? התגובה תנסה לחזור לאיזון על ידי מעבר לכיוון ההפוך.',
    analogy: '🌊 לחצת על בלון? הוא נלחם נגדך ודוחף בחזרה. כך גם תגובה כימית — תלחץ, היא תדחוף בחזרה.',
    keyword: 'הוספת חומר → מתרחק ממנו | הגברת לחץ → לצד עם פחות מולים | חימום → לצד האנדותרמי'
  },
  'kinetics': {
    emoji: '🏃',
    animation: 'lesson-speed',
    title: 'קינטיקה — כמה מהר?',
    simple: 'קינטיקה לא שואלת "האם" תגובה תקרה — אלא "כמה מהר" היא קורה.',
    analogy: '🍳 שמן חם = מהיר. מים קרים = איטי. יותר חומר = יותר התנגשויות = מהיר יותר. זרז = קיצור דרך!',
    keyword: 'טמפרטורה גבוהה → מהיר | ריכוז גבוה → מהיר | קטליזטור → מהיר (לא משנה את Keq!)'
  },
  'redox': {
    emoji: '⚡',
    animation: 'lesson-electron',
    title: 'חמצון-חיזור — העברת אלקטרונים',
    simple: 'בתגובות אלו, אלקטרונים עוברים מחומר אחד לאחר — כמו כסף שעובר בין ידיים.',
    analogy: '🔋 סוללה עובדת בדיוק כך — אלקטרונים זורמים מקוטב אחד לשני ויוצרים חשמל. ברזל חלד = אלקטרונים עוזבים את הברזל.',
    keyword: 'מתחמצן = מאבד אלקטרונים (OIL) | מתחזר = מקבל אלקטרונים (RIG) | OIL RIG!'
  },
  'nuclear': {
    emoji: '☢️',
    animation: 'lesson-nuclear',
    title: 'פיצוח גרעיני',
    simple: 'גרעין האטום יכול להתפרק ולשחרר אנרגיה עצומה — אנרגיה גדולה מכל תגובה כימית רגילה.',
    analogy: '💣 תגובה כימית רגילה = נר קטן. תגובה גרעינית = שמש. אותה עוצמה, אבל מיליון פעמים חזק יותר.',
    keyword: 'α = גרעין הליום | β = אלקטרון | γ = קרינה | t½ = זמן שמחצית החומר מתפרקת'
  },
  'acids-bases': {
    emoji: '🧪',
    animation: 'lesson-ph',
    title: 'חומצות ובסיסים',
    simple: 'חומצות נותנות H⁺ (מימן). בסיסים לוקחים H⁺. זה כל ההבדל!',
    analogy: '🍋 לימון = חומצי = pH נמוך. 🧼 סבון = בסיסי = pH גבוה. מים = ניטרלי = pH=7. פשוט!',
    keyword: 'pH<7 = חומצי | pH=7 = ניטרלי | pH>7 = בסיסי | pH+pOH=14 תמיד'
  },
  'ph-calculations': {
    emoji: '🔢',
    animation: 'lesson-ph',
    title: 'חישובי pH',
    simple: 'pH = כמה חומצי הנוזל. חישוב פשוט: pH = -log[H⁺].',
    analogy: '📏 pH כמו סולם הפוך: ריכוז H⁺ גבוה → pH נמוך → יותר חומצי. pH=1 = חמצה חזקה. pH=13 = בסיס חזק.',
    keyword: 'pH = -log[H⁺] | [H⁺][OH⁻] = 10⁻¹⁴ | חומצה חזקה: מתפרקת 100% | חלשה: Kaוחישוב ICE'
  },
  'molecular-geometry': {
    emoji: '🔷',
    animation: 'lesson-shape',
    title: 'צורת המולקולה',
    simple: 'מולקולות לא שטוחות! הצורה שלהן תלויה בכמה זוגות אלקטרונים יש סביב האטום המרכזי.',
    analogy: '🎈 כמו בלונים שנקשרים למרכז — כל בלון רוצה מקום לעצמו ודוחה את השאר. כך אלקטרונים קובעים את הצורה.',
    keyword: '2 זוגות = קווי | 3 = משולש | 4 = רביעוני | זוג בודד = מקטין זוויות!'
  },
  'intermolecular': {
    emoji: '🔗',
    animation: 'lesson-bond',
    title: 'כוחות בין מולקולות',
    simple: 'מולקולות מושכות אחת את השנייה. ככל שהמשיכה חזקה יותר — נקודת הרתיחה גבוהה יותר.',
    analogy: '🧲 מולקולות כמו מגנטים קטנים. קשר מימן = מגנט חזק (מים רותחים ב-100°C). ון דר ואלס = מגנט חלש.',
    keyword: 'קשר מימן (O-H, N-H, F-H) = הכי חזק | דיפול-דיפול = בינוני | לונדון = הכי חלש'
  },
  'organic': {
    emoji: '⛓️',
    animation: 'lesson-chain',
    title: 'כימיה אורגנית — שרשראות פחמן',
    simple: 'פחמן (C) אוהב להיקשר לפחמנים אחרים ויוצר שרשראות ארוכות. זה בסיס כל החיים!',
    analogy: '🔗 דמיין לגו — פחמן זה קוביית לגו עם 4 חיבורים. אפשר לבנות שרשראות, טבעות, וצורות אינסופיות.',
    keyword: 'אלקן (C-C) | אלקן (C=C) | אלקין (C≡C) | OH = אלכוהול | COOH = חומצה | CHO = אלדהיד'
  },
  'spectroscopy': {
    emoji: '🌈',
    animation: 'lesson-light',
    title: 'ספקטרוסקופיה — טביעת אצבע של אטומים',
    simple: 'כל אטום פולט אור בצבע ייחודי שלו. כך אנחנו יודעים מה יש בשמש או בכוכבים!',
    analogy: '🎭 כמו מסכה — כל אטום "מסתיר" את זהותו מאחורי צבע אור ייחודי. ספקטרוסקופ מגלה מי מסתתר.',
    keyword: 'פוטון = כמות קטנה של אור | E = hν | אנרגיה גבוהה = תדר גבוה = UV | נמוכה = IR'
  },
  'stereoisomers': {
    emoji: '🤝',
    animation: 'lesson-mirror',
    title: 'איזומרים מרחביים — אותו אבל שונה',
    simple: 'אותם אטומים, אותם קשרים — אבל מסודרים אחרת במרחב. כמו יד ימין ויד שמאל!',
    analogy: '👐 ידיים שלך — אותם אצבעות, אותה מבנה. אבל לא ניתן להכניס יד ימין לכפפה של שמאל. כך אנאנטיומרים.',
    keyword: 'אנאנטיומרים = ראי | דיאסטריאומרים = לא ראי | כירלי = לאטום יש 4 קבוצות שונות'
  },
  'organic-reactions': {
    emoji: '⚗️',
    animation: 'lesson-react',
    title: 'תגובות אורגניות',
    simple: 'תגובות שמשנות מולקולות אורגניות — מוסיפים, מורידים, או מחליפים חלקים.',
    analogy: '🔧 כמו מכניק שרכב — מחליף חלקים, מוסיף שמן, מסיר חלודה. אותו עיקרון, רק עם מולקולות.',
    keyword: 'חמצון = הוספת O / הסרת H | חיזור = הוספת H | הסטרה = OH + COOH → אסטר + מים'
  },
  'biochemistry': {
    emoji: '🧬',
    animation: 'lesson-dna',
    title: 'ביוכימיה — כימיה של החיים',
    simple: 'גוף האדם הוא מפעל כימי — מיליוני תגובות בשנייה שמחזיקות אותנו חיים.',
    analogy: '🏭 תא = מפעל | DNA = ספר ההוראות | חלבון = מכונה | פחמימה = דלק | שומן = מחסן אנרגיה',
    keyword: 'DNA → RNA → חלבון | אנזים = קטליזטור ביולוגי | ATP = מטבע האנרגיה של הגוף'
  },
  'periodic-table': {
    emoji: '📊',
    animation: 'lesson-table',
    title: 'הטבלה המחזורית',
    simple: 'כל היסודות מסודרים בטבלה לפי מספר הפרוטונים שלהם. כל שורה = שכבת אלקטרונים חדשה.',
    analogy: '📚 כמו ספרייה מסודרת — כל יסוד יש לו "מגרה" קבועה. טורים = משפחות עם תכונות דומות.',
    keyword: 'שורה = פריודה | טור = קבוצה | ימינה = יותר שלילי-חשמלי | למעלה = רדיוס קטן יותר'
  },
  'gas-laws': {
    emoji: '💨',
    animation: 'lesson-gas',
    title: 'חוקי הגז',
    simple: 'גז = חלקיקים שעפים ולוחצים על דפנות הכלי. חמם → מהירים יותר → לחץ גדל.',
    analogy: '🎈 בלון = גז לכוד. חמם אותו → הוא מתנפח. לחץ עליו → מתכווץ. טס לגובה → מתנפח כי פחות לחץ חיצוני.',
    keyword: 'PV = nRT | P גדל ↔ V קטן (בטמפ קבועה) | T גדל ↔ P גדל (בנפח קבוע)'
  },
  'electrochemistry': {
    emoji: '🔋',
    animation: 'lesson-battery',
    title: 'אלקטרוכימיה — כימיה וחשמל',
    simple: 'תגובות כימיות יכולות לייצר חשמל — וחשמל יכול לגרום לתגובות כימיות!',
    analogy: '🔋 סוללה = תגובה כימית שמייצרת חשמל. מטען טלפון = חשמל שמחזיר את התגובה. שניהם אלקטרוכימיה!',
    keyword: 'אנודה = חמצון | קתודה = חיזור | E°תא = E°קתודה - E°אנודה | חיובי = ספונטני'
  },
  'buffers': {
    emoji: '🛡️',
    animation: 'lesson-buffer',
    title: 'בופרים — שומרי pH',
    simple: 'בופר = תמיסה שמתנגדת לשינויי pH. הוסף חומצה? לא ישתנה הרבה. הוסף בסיס? גם לא.',
    analogy: '🏋️ בופר כמו אלוף ג\'ודו — תדחוף, הוא יספוג ויישאר במקום. הדם שלך pH 7.4 בגלל בופר ביקרבונט.',
    keyword: 'pH = pKa + log([בסיס]/[חומצה]) | כאשר [חומצה]=[בסיס] → pH = pKa'
  },
  'solubility': {
    emoji: '💧',
    animation: 'lesson-dissolve',
    title: 'מסיסות',
    simple: 'מסיסות = כמה חומר יכול להתמוסס בנוזל. "דומה ממיס דומה" — מים ממיסים מלח, לא שמן.',
    analogy: '☕ כמה סוכר אפשר להוסיף לקפה? עד רוויה. אחרי זה הוא לא נמס — זה גבול המסיסות!',
    keyword: 'Ksp = מכפלת ריכוזי יוני תוצר | Q < Ksp = לא רווי (יתמוסס) | Q > Ksp = שקיעה'
  },
  'colligative-properties': {
    emoji: '🌡️',
    animation: 'lesson-boil',
    title: 'תכונות קולגטיביות',
    simple: 'הוסף חומר מומס למים — נקודת הרתיחה עולה ונקודת הקיפאון יורדת! כמות החלקיקים קובעת.',
    analogy: '🍝 מים לפסטה עולים ב-100°C. הוסף מלח? עולים ב-100.5°C. שם המשחק: יותר חלקיקים = קשה יותר לרתוח.',
    keyword: 'ΔTb = Kb×m | ΔTf = Kf×m | לחץ אוסמוטי = nRT/V | מ = מולליות'
  }
};

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

    // ─ כרטיסיית הסבר לפני השאלה ─
    const lessonHTML = this._renderLessonCard(q);

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
        ${lessonHTML}
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

  // ─── כרטיסיית הסבר פשוט לפני כל שאלה ──────────────────────────────────
  _renderLessonCard(q) {
    const topicKey = q.topic || q.topicId || '';
    const lesson = TOPIC_LESSONS[topicKey];
    if (!lesson) return '';

    return `
      <div class="ql-lesson" id="ql-lesson">
        <div class="ql-lesson__header" onclick="document.getElementById('ql-lesson-body').classList.toggle('ql-lesson__body--collapsed'); this.querySelector('.ql-lesson__toggle').textContent = document.getElementById('ql-lesson-body').classList.contains('ql-lesson__body--collapsed') ? '▶ הצג' : '▼ הסתר'">
          <div class="ql-lesson__emoji ql-anim-${lesson.animation}">${lesson.emoji}</div>
          <div class="ql-lesson__head-text">
            <span class="ql-lesson__label">💡 לפני השאלה — קרא קודם:</span>
            <strong class="ql-lesson__title">${sanitizeHTML(lesson.title)}</strong>
          </div>
          <button class="ql-lesson__toggle" aria-label="הצג/הסתר הסבר">▼ הסתר</button>
        </div>
        <div class="ql-lesson__body" id="ql-lesson-body">
          <p class="ql-lesson__simple">${sanitizeHTML(lesson.simple)}</p>
          <div class="ql-lesson__analogy">${sanitizeHTML(lesson.analogy)}</div>
          <div class="ql-lesson__keyword">📌 ${sanitizeHTML(lesson.keyword)}</div>
        </div>
      </div>`;
  },

  // ─── רינדור: בחירה מרובה ─────────────────────────────────────────────────
  _renderMultipleChoice(q) {
    // ערבוב אפשרויות (שמירת האינדקס המקורי כ-data-index)
    const options = q.options.map((opt, i) => ({ text: opt, index: i }));
    const shuffledOpts = shuffle(options);

    const letters = ['א','ב','ג','ד','ה'];
    return shuffledOpts.map((opt, pos) => `
      <button class="answer-option"
              data-index="${opt.index}"
              onclick="QuizEngine.submitAnswer(${opt.index})"
              aria-label="${sanitizeHTML(opt.text)}">
        <span class="answer-letter">${letters[pos] || (pos+1)}</span>
        <span class="answer-text">${sanitizeHTML(opt.text)}</span>
        <span class="answer-status" aria-hidden="true"></span>
      </button>`
    ).join('');
  },

  // ─── רינדור: נכון/לא נכון ────────────────────────────────────────────────
  _renderTrueFalse(q) {
    return `
      <button class="answer-option answer-option--tf"
              data-index="0"
              onclick="QuizEngine.submitAnswer(0)">
        <span class="answer-letter">✓</span>
        <span class="answer-text">נכון</span>
        <span class="answer-status" aria-hidden="true"></span>
      </button>
      <button class="answer-option answer-option--tf"
              data-index="1"
              onclick="QuizEngine.submitAnswer(1)">
        <span class="answer-letter">✗</span>
        <span class="answer-text">לא נכון</span>
        <span class="answer-status" aria-hidden="true"></span>
      </button>`;
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

    const q              = this.state.questions[this.state.current];
    const correctVal     = parseFloat(q.correctAnswer ?? q.answer);
    const tolerance      = q.tolerance !== undefined ? parseFloat(q.tolerance) : 0.01;

    // בדיקת קרבה (אחוזית או מוחלטת)
    let isCorrect;
    if (q.toleranceType === 'percent') {
      isCorrect = Math.abs((val - correctVal) / correctVal) <= tolerance;
    } else {
      isCorrect = Math.abs(val - correctVal) <= tolerance;
    }

    // מסמנים את השדה
    input.disabled = true;
    const submitBtn = document.getElementById('numeric-submit');
    if (submitBtn) submitBtn.disabled = true;

    // מעבירים לפונקציה המרכזית עם אינדקס מיוחד
    this._handleResult(isCorrect, isCorrect ? correctVal : null, q);
  },

  // ─── הגשת תשובה (multiple-choice / true-false) ───────────────────────────
  submitAnswer(selectedIndex) {
    if (this.state.locked) return; // הגנה מכפל-הגשה
    this.state.locked = true;

    const q         = this.state.questions[this.state.current];
    const correct   = parseInt(q.correctAnswer ?? q.answer, 10); // אינדקס תשובה נכונה — תמיכה בשני שמות שדה
    const isCorrect = selectedIndex === correct;

    // נעילת כל הכפתורים מיידית
    const buttons = document.querySelectorAll('#quiz-options .answer-option');
    buttons.forEach(btn => {
      btn.style.pointerEvents = 'none';
      btn.setAttribute('aria-disabled', 'true');
      btn.classList.add('locked');

      const btnIndex = parseInt(btn.getAttribute('data-index'), 10);
      if (btnIndex === correct) {
        btn.classList.add('correct');
      } else if (btnIndex === selectedIndex && !isCorrect) {
        btn.classList.add('wrong');
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
    // Confetti on correct
    if (isCorrect && typeof launchConfetti === 'function') launchConfetti();

    const feedbackEl = document.getElementById('quiz-feedback');
    if (feedbackEl) {
      if (isCorrect) {
        feedbackEl.innerHTML = `
          <div class="quiz-feedback--correct" role="status" style="animation: scaleIn 0.3s cubic-bezier(0.34,1.56,0.64,1)">
            <span class="quiz-feedback__icon" aria-hidden="true">✓</span>
            <span>נכון! 🎉</span>
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
          // support both 'topic' and 'topicId' field names
          questions = questions.filter(q => (q.topic || q.topicId) === filter.topicId);
        } else if (filter && filter.weekId) {
          questions = questions.filter(q => (q.week || q.weekId) == filter.weekId);
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
