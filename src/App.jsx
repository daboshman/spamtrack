import { useState, useEffect } from "react";
import { auth, db } from "./firebase";
import { GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";

// ─── DATA ────────────────────────────────────────────────────────────────────

const STAGES = [
  { id: "new",        label: "ראיות חדשות",     color: "#6B7280" },
  { id: "optout",     label: "בקשת הסרה נשלחה", color: "#3B82F6" },
  { id: "prelegal",   label: "התראה נשלחה",     color: "#F59E0B" },
  { id: "negotiating",label: "משא ומתן",         color: "#8B5CF6" },
  { id: "settled",    label: "הסתיים בפשרה",    color: "#10B981" },
  { id: "court",      label: "הוגשה לבית משפט", color: "#EF4444" },
  { id: "closed",     label: "סגור",             color: "#374151" },
];

const CHANNELS = ["אימייל", "SMS", "וואטסאפ", "פקס"];
const VIOLATION_TYPES = [
  "פרסומת ללא הסכמה (סעיף 30א)",
  "ללא אפשרות הסרה",
  "היעדר פרטי שולח ודרכי התקשרות",
  "הסרה שלא בוצעה בפועל",
  "הודעה לאחר הסרה",
];


// ─── TEMPLATES ───────────────────────────────────────────────────────────────

function generateWarningLetter(c) {
  const today = new Date().toLocaleDateString("he-IL", { year: "numeric", month: "long", day: "numeric" });
  return `אשר דיבה
Asher Diba
רח' חטיבת הבקעה 2
כפר סבא 4424437
נייד: 052-3699372 :cell
מייל: asherdiba@gmail.com :E-Mail

${today}
מבלי לפגוע בזכויות
באמצעות אימייל ודואר רשום

לכבוד
${c.defendant}
${c.contactAddress}

א.ג.ב.

הנדון: התראה בטרם נקיטת הליכים

הריני מתכבד לפנות כדלקמן:

1. לאור העובדה שבחרתם לשלוח אלי מסרי פרסומת בניגוד להוראות החוק.

2. מצ"ב למכתבי טיוטת כתב תביעה שתוגש לבית המשפט לתביעות קטנות בכפר סבא.

3. לצרכי פשרה בלבד ולשם צמצום הוצאותי מועברת אליכם טיוטה זו.

4. באפשרותכם למנוע את הגשת התביעה לאמור בהתאם לאמור בכתב התביעה בתוך 14 ימים.

5. באפשרותכם ליצור קשר עם הח.מ.

6. אין באמור במכתב זה ו/או האמור בו כדי לגרוע ו/או לפגוע ו/או לטעון ו/או דרישה של הח.מ.

בכבוד רב,

אשר דיבה, עו"ד
נייד 052-3699372
מייל asherdiba@gmail.com`;
}

function generateLawsuit(c) {
  const violationText = c.violations.join(", ");
  const totalClaim = c.claimAmount + c.courtCosts;
  return `בית משפט לתביעות קטנות
בכפר סבא

התובע:    אשר דיבה, עו"ד ת"ז 052997483 (להלן: "התובע")
          מרחוב חטיבת הבקעה 2 כפר סבא 4424437
          טלפון: 052-3699372

- נ ג ד -

הנתבעת:  ${c.defendant} (להלן: "הנתבעת")
          ${c.contactAddress}
          טלפון: ${c.contactPhone}
          אימייל: ${c.contactEmail}

סכום התביעה: ${c.claimAmount.toLocaleString()} ₪

כתב תביעה

עניינה של תובענה זו במעשי ובמחדלי הנתבעת, שעיקרם במשלוח דברי פרסומת לתובע, ללא הסכמתו ובניגוד להוראות סעיף 30א לחוק הטלקומוניקציה (בזק ושירותים), התשמ"ב – 1982 (להלן: "החוק").

פרטי התביעה:

1. הצדדים
   1.1 לשם הגילוי הנאות, יצוין, כי התובע הינו עו"ד בהשכלתו על אף שאינו עוסק במקצוע כבר מספר שנים, עם זאת כלל שיתבקש היתר ליייצוג הרי שהתובע אינו מתנגד לכך.
   1.2 הנתבעת היא חברה פרטית שעיסוקה המרכזי הוא הפעלת רשת למוצרי ${c.defendant.includes("אורתופד") ? "אורתופדיה" : "מסחר"}.

2. עיננו הרואות כי הנתבעת מפרה את סעיף 30א לחוק הטלקומוניקציה (בזק ושירותים), תשמ"ב-1982 (להלן: "חוק הספאם"), תוך שהיא שולחת דברי פרסומת מניידיו לתובע, ללא כל הסכמה.

   ויובהר כי לנתבעת היה אסור לשלוח לתובע דברי פרסומת מבלי שקיבלה את הסכמתו המפורשת לכך:

   (ב) לא ישגר מפרסם דבר פרסומת באמצעות פקסימיליה, מערכת חיוג אוטומטי, הודעה אלקטרונית או הודעת מסר קצר, בלא קבלת הסכמה מפורשת מאיש הנמען, בכתב, לתדועה אלקטרונית או בשיחה חד-פעמית מוקלטת; פניה חד-פעמית בסעיף זה, המחוייה לזכות לקבל דברי פרסומת לפי הדרכים האמורות בסעיף זה, לא תחשב כהסרה שהפרדה שהספרה של הוראות סעיף זה.

3. עיננו הרואות כי הנתבעת מפרה את סעיף 30א לחוק הטלקומוניקציה (בזק ושירותים), תשמ"ב-1982 (להלן: "חוק הספאם"), תוך שהיא שולחת דברי פרסומת, ללא כל הסכמה, ומבלי שהיא מאפשרת לתובע להפסיק את משלוח ההודעות הפרסומיות בדרך הקבועה בחוק.

4. לעניין זה, יפים דבריו של כב' השופט ע' פוגלמן ברע"א 1954/14, אילן חזני נ' שמעון הגבי (סיטונית מועדון דאיה ורחיפה במצנחים):
   מכאן לשאלה הראשונה: האם היה מקום להטיל על המשיב נטל להסיר את עצמו מרשימת התפוצה? בעניין גלסברג השיב חברי השופט א' רובינשטיין בשלילה לשאלה זו בשלה כי ניתן לגנוע לעצם החבות...

5. סכום התביעה חושב לפי מספר ההודעות שנשלחו בניגוד לחוק, כפול סכום של 1,000 ₪ לכל הודעה.

   5.1 בהתאם להוראות סעיף 30א (י) (1) לחוק, רשאי בית המשפט הנכבד לפסוק לתובעים פיצויים ללא הוכחת נזק, בסכום שלא יעלה על 1,000 ₪ בשל כל דבר פרסומת שקיבל התובע מהנתבעת בניגוד להוראות החוק.

6. אשר על כן, מתבקש בית המשפט הנכבד לחייב את הנתבעת לשלם לתובע סך של:
   6.1 ${c.claimAmount.toLocaleString()} ₪ בגין הפרת הוראות החוק בתוספת הוצאות משפט.
   6.2 לבית המשפט הנכבד הסמכות העניינית והמקומית לדון בתביעה.

[חתימה]
אשר דיבה, עו"ד

נספח 1
[צילומי מסך מצ"ב]`;
}

// ─── COMPONENTS ──────────────────────────────────────────────────────────────

function Badge({ stage }) {
  const s = STAGES.find(x => x.id === stage) || STAGES[0];
  return (
    <span style={{
      background: s.color + "22",
      color: s.color,
      border: `1px solid ${s.color}44`,
      borderRadius: 6,
      padding: "2px 10px",
      fontSize: 12,
      fontWeight: 600,
      fontFamily: "'Heebo', sans-serif",
      whiteSpace: "nowrap",
    }}>{s.label}</span>
  );
}

function Timeline({ events }) {
  const typeStyles = {
    evidence:  { color: "#6B7280", icon: "📷" },
    optout:    { color: "#3B82F6", icon: "✉️" },
    prelegal:  { color: "#F59E0B", icon: "⚖️" },
    offer:     { color: "#8B5CF6", icon: "🤝" },
    settled:   { color: "#10B981", icon: "✅" },
    court:     { color: "#EF4444", icon: "🏛️" },
  };
  return (
    <div style={{ position: "relative", paddingRight: 28 }}>
      {events.map((ev, i) => {
        const ts = typeStyles[ev.type] || typeStyles.evidence;
        return (
          <div key={i} style={{ display: "flex", gap: 12, marginBottom: 12, alignItems: "flex-start" }}>
            <div style={{
              width: 28, height: 28, borderRadius: "50%",
              background: ts.color + "18",
              border: `1.5px solid ${ts.color}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 13, flexShrink: 0,
            }}>{ts.icon}</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#111" }}>{ev.action}</div>
              <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 1 }}>{ev.date}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CaseCard({ c, onClick }) {
  const daysOpen = Math.floor((new Date() - new Date(c.createdAt)) / 86400000);
  return (
    <div onClick={onClick} style={{
      background: "#fff",
      border: "1px solid #E5E7EB",
      borderRadius: 12,
      padding: "16px 18px",
      cursor: "pointer",
      transition: "box-shadow 0.15s, border-color 0.15s",
      marginBottom: 10,
    }}
    onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.08)"; e.currentTarget.style.borderColor = "#C4B5FD"; }}
    onMouseLeave={e => { e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.borderColor = "#E5E7EB"; }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: "#111", marginBottom: 2 }}>{c.defendant}</div>
          <div style={{ fontSize: 12, color: "#9CA3AF" }}>תיק #{c.caseNumber} · {c.channel} · {daysOpen} ימים</div>
        </div>
        <Badge stage={c.stage} />
      </div>
      <div style={{ display: "flex", gap: 16, marginTop: 10 }}>
        <div style={{ fontSize: 12, color: "#6B7280" }}>📩 {c.messageCount} הודעות</div>
        <div style={{ fontSize: 12, color: "#6B7280" }}>💰 ₪{c.claimAmount.toLocaleString()}</div>
        <div style={{ fontSize: 12, color: "#6B7280" }}>📎 {c.screenshots.length} צילומים</div>
      </div>
    </div>
  );
}

function TemplateModal({ c, type, onClose }) {
  const text = type === "warning" ? generateWarningLetter(c) : generateLawsuit(c);
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 24,
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "#fff", borderRadius: 16, padding: 28, maxWidth: 700, width: "100%",
        maxHeight: "85vh", display: "flex", flexDirection: "column", gap: 16,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
            {type === "warning" ? "התראה בטרם נקיטת הליכים" : "טיוטת כתב תביעה"}
          </h3>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#9CA3AF" }}>✕</button>
        </div>
        <div style={{ background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 10, padding: 18, overflow: "auto", flex: 1 }}>
          <pre style={{ margin: 0, fontFamily: "'Heebo', 'David', serif", fontSize: 13, lineHeight: 1.8, whiteSpace: "pre-wrap", direction: "rtl", textAlign: "right" }}>
            {text}
          </pre>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={copy} style={{
            flex: 1, padding: "10px 0", background: copied ? "#10B981" : "#7C3AED",
            color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, cursor: "pointer", fontSize: 14,
          }}>{copied ? "✓ הועתק!" : "העתק למקלחת"}</button>
          <button onClick={onClose} style={{
            padding: "10px 18px", background: "#F3F4F6", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 14,
          }}>סגור</button>
        </div>
      </div>
    </div>
  );
}

function NewCaseModal({ onSave, onClose }) {
  const [form, setForm] = useState({
    defendant: "", contactEmail: "", contactPhone: "", contactAddress: "",
    channel: "אימייל", violations: [], messageCount: 1,
    firstMessageDate: new Date().toISOString().split("T")[0], notes: "",
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const toggleViolation = v => set("violations", form.violations.includes(v)
    ? form.violations.filter(x => x !== v) : [...form.violations, v]);

  const save = () => {
    if (!form.defendant.trim()) return;
    const newCase = {
      ...form,
      caseNumber: `2025-${String(Math.floor(Math.random() * 900) + 100)}`,
      stage: "new",
      claimAmount: form.messageCount * 1000,
      courtCosts: 2000,
      timeline: [{ date: form.firstMessageDate, action: "התקבלה פרסומת", type: "evidence" }],
      screenshots: [],
    };
    onSave(newCase);
  };

  const inputStyle = {
    width: "100%", padding: "9px 12px", border: "1px solid #D1D5DB",
    borderRadius: 8, fontSize: 14, fontFamily: "'Heebo', sans-serif",
    direction: "rtl", boxSizing: "border-box",
  };
  const labelStyle = { fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 4, display: "block" };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 24,
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "#fff", borderRadius: 16, padding: 28, maxWidth: 600, width: "100%",
        maxHeight: "90vh", overflow: "auto",
      }}>
        <h3 style={{ margin: "0 0 20px", fontSize: 20, fontWeight: 700, direction: "rtl" }}>תיק ספאם חדש</h3>

        <div style={{ display: "flex", flexDirection: "column", gap: 14, direction: "rtl" }}>
          <div>
            <label style={labelStyle}>שם הנתבע / חברה *</label>
            <input style={inputStyle} value={form.defendant} onChange={e => set("defendant", e.target.value)} placeholder="שם חברה ומספר ח.פ." />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>אימייל נתבע</label>
              <input style={inputStyle} value={form.contactEmail} onChange={e => set("contactEmail", e.target.value)} />
            </div>
            <div>
              <label style={labelStyle}>טלפון נתבע</label>
              <input style={inputStyle} value={form.contactPhone} onChange={e => set("contactPhone", e.target.value)} />
            </div>
          </div>
          <div>
            <label style={labelStyle}>כתובת נתבע</label>
            <input style={inputStyle} value={form.contactAddress} onChange={e => set("contactAddress", e.target.value)} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={labelStyle}>ערוץ</label>
              <select style={inputStyle} value={form.channel} onChange={e => set("channel", e.target.value)}>
                {CHANNELS.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>מספר הודעות</label>
              <input style={inputStyle} type="number" min={1} value={form.messageCount} onChange={e => set("messageCount", parseInt(e.target.value) || 1)} />
            </div>
          </div>
          <div>
            <label style={labelStyle}>תאריך הודעה ראשונה</label>
            <input style={inputStyle} type="date" value={form.firstMessageDate} onChange={e => set("firstMessageDate", e.target.value)} />
          </div>
          <div>
            <label style={labelStyle}>סוגי הפרות</label>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {VIOLATION_TYPES.map(v => (
                <label key={v} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13 }}>
                  <input type="checkbox" checked={form.violations.includes(v)} onChange={() => toggleViolation(v)} />
                  {v}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label style={labelStyle}>הערות</label>
            <textarea style={{ ...inputStyle, height: 80, resize: "vertical" }} value={form.notes} onChange={e => set("notes", e.target.value)} />
          </div>
          <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 8, padding: 12, textAlign: "right" }}>
            <div style={{ fontSize: 13, color: "#065F46", fontWeight: 600 }}>סכום תביעה מחושב:</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#059669" }}>₪{(form.messageCount * 1000).toLocaleString()}</div>
            <div style={{ fontSize: 11, color: "#6B7280" }}>+ ₪2,000 הוצאות משפט = ₪{(form.messageCount * 1000 + 2000).toLocaleString()} סה"כ</div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <button onClick={save} style={{
            flex: 1, padding: "11px 0", background: "#7C3AED", color: "#fff",
            border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer", fontSize: 15,
          }}>פתח תיק</button>
          <button onClick={onClose} style={{
            padding: "11px 18px", background: "#F3F4F6", border: "none",
            borderRadius: 8, cursor: "pointer", fontSize: 14,
          }}>ביטול</button>
        </div>
      </div>
    </div>
  );
}

function CaseDetail({ c, onUpdate, onBack }) {
  const [showTemplate, setShowTemplate] = useState(null);
  const [addingNote, setAddingNote] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [newEventText, setNewEventText] = useState("");

  const moveStage = (stageId) => onUpdate({ ...c, stage: stageId });

  const addEvent = (action, type) => {
    const today = new Date().toISOString().split("T")[0];
    onUpdate({ ...c, timeline: [...c.timeline, { date: today, action, type }] });
  };

  const stageActions = [
    { id: "optout",      label: "שלחתי בקשת הסרה",       type: "optout",   eventType: "optout" },
    { id: "prelegal",    label: "שלחתי התראה",            type: "prelegal", eventType: "prelegal" },
    { id: "negotiating", label: "קיבלתי הצעת פשרה",      type: "offer",    eventType: "offer" },
    { id: "settled",     label: "הסכמנו על פשרה",        type: "settled",  eventType: "settled" },
    { id: "court",       label: "הגשתי לבית משפט",       type: "court",    eventType: "court" },
    { id: "closed",      label: "סגור",                   type: "closed",   eventType: "settled" },
  ];

  const currentStageIdx = STAGES.findIndex(s => s.id === c.stage);

  return (
    <div style={{ maxWidth: 780, margin: "0 auto", padding: "0 20px 40px", direction: "rtl" }}>
      {showTemplate && <TemplateModal c={c} type={showTemplate} onClose={() => setShowTemplate(null)} />}

      <button onClick={onBack} style={{ background: "none", border: "none", color: "#7C3AED", fontWeight: 600, cursor: "pointer", fontSize: 14, padding: "16px 0", display: "flex", alignItems: "center", gap: 4 }}>
        ← חזרה לכל התיקים
      </button>

      {/* Header */}
      <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 14, padding: 24, marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 11, color: "#9CA3AF", marginBottom: 4 }}>תיק #{c.caseNumber}</div>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#111" }}>{c.defendant}</h2>
          </div>
          <Badge stage={c.stage} />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginTop: 16 }}>
          {[
            { label: "ערוץ", value: c.channel },
            { label: "הודעות", value: c.messageCount },
            { label: "תביעה", value: `₪${c.claimAmount.toLocaleString()}` },
            { label: "ראיות", value: `${c.screenshots.length} קבצים` },
          ].map(m => (
            <div key={m.label} style={{ background: "#F9FAFB", borderRadius: 8, padding: "10px 14px", textAlign: "center" }}>
              <div style={{ fontSize: 11, color: "#9CA3AF" }}>{m.label}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#111" }}>{m.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Stage pipeline */}
      <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 14, padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 14 }}>מצב התיק</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {STAGES.map((s, i) => (
            <button key={s.id} onClick={() => moveStage(s.id)} style={{
              padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer",
              background: c.stage === s.id ? s.color : "#F3F4F6",
              color: c.stage === s.id ? "#fff" : "#6B7280",
              border: c.stage === s.id ? `1.5px solid ${s.color}` : "1.5px solid #E5E7EB",
              transition: "all 0.15s",
            }}>{s.label}</button>
          ))}
        </div>
      </div>

      {/* Quick actions */}
      <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 14, padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 14 }}>פעולות מהירות</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          <button onClick={() => setShowTemplate("warning")} style={{
            padding: "9px 16px", background: "#FEF3C7", color: "#92400E",
            border: "1px solid #FDE68A", borderRadius: 8, fontWeight: 600, cursor: "pointer", fontSize: 13,
          }}>⚖️ צור התראה</button>
          <button onClick={() => setShowTemplate("lawsuit")} style={{
            padding: "9px 16px", background: "#EDE9FE", color: "#5B21B6",
            border: "1px solid #DDD6FE", borderRadius: 8, fontWeight: 600, cursor: "pointer", fontSize: 13,
          }}>📄 צור כתב תביעה</button>
          {stageActions.map(a => (
            <button key={a.id} onClick={() => { moveStage(a.id); addEvent(a.label, a.eventType); }} style={{
              padding: "9px 16px", background: "#F0FDF4", color: "#065F46",
              border: "1px solid #BBF7D0", borderRadius: 8, fontWeight: 600, cursor: "pointer", fontSize: 13,
            }}>✓ {a.label}</button>
          ))}
        </div>
      </div>

      {/* Timeline */}
      <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 14, padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 16 }}>ציר זמן</div>
        <Timeline events={c.timeline} />
        <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
          <input
            value={newEventText}
            onChange={e => setNewEventText(e.target.value)}
            placeholder="הוסף פעולה ידנית..."
            style={{ flex: 1, padding: "8px 12px", border: "1px solid #D1D5DB", borderRadius: 8, fontSize: 13, direction: "rtl" }}
          />
          <button onClick={() => { if (newEventText.trim()) { addEvent(newEventText.trim(), "evidence"); setNewEventText(""); } }} style={{
            padding: "8px 16px", background: "#7C3AED", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600,
          }}>הוסף</button>
        </div>
      </div>

      {/* Violations */}
      {c.violations.length > 0 && (
        <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 14, padding: 20, marginBottom: 16 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 12 }}>הפרות שזוהו</div>
          {c.violations.map(v => (
            <div key={v} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <span style={{ color: "#EF4444" }}>⚠</span>
              <span style={{ fontSize: 13, color: "#374151" }}>{v}</span>
            </div>
          ))}
        </div>
      )}

      {/* Notes */}
      <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 14, padding: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 10 }}>הערות</div>
        <div style={{ fontSize: 13, color: "#6B7280", lineHeight: 1.7, direction: "rtl" }}>{c.notes || "אין הערות."}</div>
        <div style={{ marginTop: 10, fontSize: 12, color: "#9CA3AF" }}>כתובת: {c.contactAddress} · {c.contactEmail}</div>
      </div>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────

export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedCase, setSelectedCase] = useState(null);
  const [showNewCase, setShowNewCase] = useState(false);
  const [filterStage, setFilterStage] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });
  }, []);

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ login_hint: "asherdiba@gmail.com" });
    await signInWithPopup(auth, provider);
  };

  const handleLogout = () => signOut(auth);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    (async () => {
      try {
        const snap = await getDoc(doc(db, "spamtrack", user.uid, "data", "cases"));
        if (snap.exists()) setCases(snap.data().list);
      } catch (err) {
        setError("שגיאה בטעינת התיקים: " + err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const updateCase = async (updated) => {
    try {
      const updatedCases = cases.map(c => c.id === updated.id ? updated : c);
      await setDoc(doc(db, "spamtrack", user.uid, "data", "cases"), { list: updatedCases });
      setCases(updatedCases);
      setSelectedCase(updated);
    } catch (err) {
      setError("שגיאה בעדכון התיק: " + err.message);
    }
  };

  const addCase = async (newCase) => {
    try {
      const caseWithMeta = {
        ...newCase,
        id: Date.now().toString(),
        createdAt: new Date().toISOString().split("T")[0],
      };
      const updatedCases = [caseWithMeta, ...cases];
      await setDoc(doc(db, "spamtrack", user.uid, "data", "cases"), { list: updatedCases });
      setCases(updatedCases);
      setShowNewCase(false);
      setSelectedCase(caseWithMeta);
    } catch (err) {
      setError("שגיאה בשמירת התיק: " + err.message);
    }
  };

  const filtered = cases.filter(c => {
    const matchStage = filterStage === "all" || c.stage === filterStage;
    const matchSearch = !search || c.defendant.includes(search) || c.caseNumber.includes(search);
    return matchStage && matchSearch;
  });

  const stats = {
    total: cases.length,
    open: cases.filter(c => !["settled", "closed"].includes(c.stage)).length,
    totalClaim: cases.reduce((s, c) => s + c.claimAmount, 0),
    settled: cases.filter(c => c.stage === "settled").length,
  };

  if (authLoading) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", minHeight:"100vh", fontFamily:"'Heebo', sans-serif" }}>
      טוען...
    </div>
  );

  if (!user) return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", minHeight:"100vh", background:"#F9FAFB", fontFamily:"'Heebo', sans-serif" }}>
      <div style={{ background:"#fff", borderRadius:16, padding:40, textAlign:"center", border:"1px solid #E5E7EB", maxWidth:360 }}>
        <div style={{ fontSize:32, marginBottom:8 }}>⚖️</div>
        <div style={{ fontSize:22, fontWeight:800, color:"#7C3AED", marginBottom:4 }}>SpamTrack</div>
        <div style={{ fontSize:13, color:"#9CA3AF", marginBottom:24 }}>מערכת ניהול תביעות ספאם</div>
        <button onClick={handleLogin} style={{ width:"100%", padding:"12px 0", background:"#7C3AED", color:"#fff", border:"none", borderRadius:10, fontWeight:700, fontSize:15, cursor:"pointer" }}>
          התחבר עם Google
        </button>
      </div>
    </div>
  );

  if (selectedCase) {
    return (
      <div style={{ fontFamily: "'Heebo', sans-serif", background: "#F9FAFB", minHeight: "100vh" }}>
        <div style={{ background: "#fff", borderBottom: "1px solid #E5E7EB", padding: "12px 28px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontWeight: 800, fontSize: 18, color: "#7C3AED" }}>SpamTrack ⚖️</div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {user && <span style={{ fontSize: 12, color: "#9CA3AF" }}>{user.email}</span>}
            <button onClick={handleLogout} style={{ fontSize: 12, color: "#6B7280", background: "none", border: "1px solid #E5E7EB", borderRadius: 6, padding: "4px 10px", cursor: "pointer", fontFamily: "'Heebo', sans-serif" }}>התנתקות</button>
          </div>
        </div>
        {error && (
          <div style={{ background: "#FEE2E2", border: "1px solid #FCA5A5", borderRadius: 8, padding: "12px 20px", margin: "16px 28px", color: "#991B1B", fontSize: 14, direction: "rtl" }}>
            {error}
            <button onClick={() => setError(null)} style={{ float: "left", background: "none", border: "none", cursor: "pointer", color: "#991B1B", fontWeight: 700 }}>✕</button>
          </div>
        )}
        <CaseDetail
          c={selectedCase}
          onUpdate={updateCase}
          onBack={() => setSelectedCase(null)}
        />
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "'Heebo', sans-serif", background: "#F9FAFB", minHeight: "100vh", direction: "rtl" }}>
      {showNewCase && <NewCaseModal onSave={addCase} onClose={() => setShowNewCase(false)} />}

      {/* Header */}
      <div style={{ background: "#7C3AED", padding: "18px 28px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", maxWidth: 900, margin: "0 auto" }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 22, color: "#fff", letterSpacing: -0.5 }}>SpamTrack ⚖️</div>
            <div style={{ fontSize: 12, color: "#C4B5FD" }}>מערכת ניהול תביעות ספאם — אשר דיבה, עו"ד</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {user && <span style={{ fontSize: 12, color: "#C4B5FD" }}>{user.email}</span>}
            <button onClick={handleLogout} style={{ background: "rgba(255,255,255,0.2)", color: "#fff", border: "none", borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 12 }}>התנתק</button>
            <button onClick={() => setShowNewCase(true)} style={{
              background: "#fff", color: "#7C3AED", border: "none", borderRadius: 10,
              padding: "10px 20px", fontWeight: 800, cursor: "pointer", fontSize: 14,
            }}>+ תיק חדש</button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 20px" }}>

        {/* Error banner */}
        {error && (
          <div style={{ background: "#FEE2E2", border: "1px solid #FCA5A5", borderRadius: 8, padding: "12px 16px", marginBottom: 20, color: "#991B1B", fontSize: 14, direction: "rtl", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>{error}</span>
            <button onClick={() => setError(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#991B1B", fontWeight: 700, fontSize: 16 }}>✕</button>
          </div>
        )}

        {/* Loading state */}
        {loading ? (
          <div style={{ textAlign: "center", padding: "80px 0", color: "#9CA3AF" }}>
            <div style={{ fontSize: 36, marginBottom: 16 }}>⏳</div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>טוען תיקים...</div>
          </div>
        ) : (
          <>
            {/* Stats */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 24 }}>
              {[
                { label: "סה״כ תיקים", value: stats.total, color: "#7C3AED" },
                { label: "תיקים פתוחים", value: stats.open, color: "#F59E0B" },
                { label: "סכום כולל", value: `₪${stats.totalClaim.toLocaleString()}`, color: "#10B981" },
                { label: "נסגרו בפשרה", value: stats.settled, color: "#3B82F6" },
              ].map(s => (
                <div key={s.label} style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: "14px 18px" }}>
                  <div style={{ fontSize: 11, color: "#9CA3AF", marginBottom: 4 }}>{s.label}</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: s.color }}>{s.value}</div>
                </div>
              ))}
            </div>

            {/* Filters */}
            <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center", flexWrap: "wrap" }}>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="חיפוש לפי שם..."
                style={{ padding: "8px 14px", border: "1px solid #D1D5DB", borderRadius: 8, fontSize: 13, direction: "rtl", minWidth: 200 }}
              />
              <button onClick={() => setFilterStage("all")} style={{
                padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
                background: filterStage === "all" ? "#7C3AED" : "#F3F4F6",
                color: filterStage === "all" ? "#fff" : "#6B7280", border: "none",
              }}>הכל ({cases.length})</button>
              {STAGES.map(s => {
                const count = cases.filter(c => c.stage === s.id).length;
                if (count === 0) return null;
                return (
                  <button key={s.id} onClick={() => setFilterStage(s.id)} style={{
                    padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
                    background: filterStage === s.id ? s.color : "#F3F4F6",
                    color: filterStage === s.id ? "#fff" : "#6B7280", border: "none",
                  }}>{s.label} ({count})</button>
                );
              })}
            </div>

            {/* Cases list */}
            {filtered.length === 0 ? (
              <div style={{ textAlign: "center", padding: "60px 0", color: "#9CA3AF" }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
                <div style={{ fontSize: 16, fontWeight: 600 }}>אין תיקים</div>
                <div style={{ fontSize: 13, marginTop: 6 }}>לחץ על "+ תיק חדש" להוספת תיק ספאם</div>
              </div>
            ) : (
              filtered.map(c => (
                <CaseCard key={c.id} c={c} onClick={() => setSelectedCase(c)} />
              ))
            )}
          </>
        )}
      </div>
    </div>
  );
}
