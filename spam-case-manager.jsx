import { useState, useEffect, useRef } from "react";
import { db, auth } from "./src/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";

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

const SAMPLE_CASES = [
  {
    id: "1",
    caseNumber: "2025-001",
    defendant: "חברת א.א אורתופדיה ע.מ. 038630562",
    contactEmail: "Info@aaorthopedia.co.il",
    contactPhone: "039131999",
    contactAddress: "מרחוב שבזי 14, יהוד 5623104",
    channel: "אימייל",
    violations: ["פרסומת ללא הסכמה (סעיף 30א)", "ללא אפשרות הסרה"],
    messageCount: 2,
    firstMessageDate: "2025-06-15",
    stage: "prelegal",
    claimAmount: 2000,
    courtCosts: 2000,
    notes: "קיבלתי 2 פרסומות ללא הסכמה. שלחתי בקשת הסרה ב-20/6 ולא קיבלתי תגובה.",
    timeline: [
      { date: "2025-06-15", action: "התקבלה פרסומת ראשונה", type: "evidence" },
      { date: "2025-06-20", action: "בקשת הסרה נשלחה", type: "optout" },
      { date: "2025-07-01", action: "התראה בטרם נקיטת הליכים נשלחה", type: "prelegal" },
    ],
    screenshots: ["פרסומת_1.png", "פרסומת_2.png", "בקשת_הסרה.png"],
    createdAt: "2025-06-15",
  },
];

// ─── TEMPLATES ───────────────────────────────────────────────────────────────

const VIOLATION_CITATIONS = {
  "פרסומת ללא הסכמה (סעיף 30א)": {
    sectionTitle: "הפרת סעיף 30א(ב) — שליחת פרסומת ללא הסכמה מפורשת",
    legalText: `סעיף 30א(ב) לחוק התקשורת קובע:
"לא ישגר מפרסם דבר פרסומת באמצעות פקסימיליה, מערכת חיוג אוטומטי, הודעה אלקטרונית או הודעת מסר קצר, בלא קבלת הסכמה מפורשת מראש של הנמען, בכתב, לרבות בהודעה אלקטרונית או בשיחה מוקלטת."`,
    citations: [
      `לעניין איסור זה וחובת ההסכמה המפורשת, קבע כב' השופט ע' פוגלמן בבית המשפט העליון ברע"א 1954/14 חזני נ' הנגבי (4.8.2014):
"נקודת המוצא שבבסיסו היא שחל איסור לשלוח הודעות פרסומת למי שלא קיבל הסכמה על כך, ועל כן השולח מפר את הוראות החוק החל מהפרסומת הראשונה."`,
      `באשר לחובת ההסכמה המפורשת, הבהיר כב' השופט א' רובינשטיין ברע"א 2904/14 גלסברג נ' קלאב רמון (27.7.2014):
"לצורך שיגור דבר פרסומת נדרשת הסכמתו המפורשת של הנמען, והעובדה שהלה לא ביקש מן המפרסם להסירו מרשימת התפוצה אינה מעלה או מורידה לעניין עצם החבות."`,
    ],
  },

  "ללא אפשרות הסרה": {
    sectionTitle: "הפרת סעיף 30א(ד)(1) — היעדר אפשרות הסרה כדין",
    legalText: `סעיף 30א(ד)(1) לחוק התקשורת קובע:
"הסכים הנמען לקבל דברי פרסומת לפי הוראות סעיף קטן (ב) או לא הודיע על סירובו לקבלם לפי הוראות סעיף קטן (ג), רשאי הוא, בכל עת, להודיע למפרסם על סירובו לקבל דברי פרסומת [...] הודעת הסירוב תינתן בכתב או בדרך שבה שוגר דבר הפרסומת, לפי בחירת הנמען."`,
    citations: [
      `לעניין כשרות אפשרות הסרה באמצעות קישור, נקבע ברע"א 1954/14 חזני נ' הנגבי (4.8.2014), כי לחיצה על קישור הסרה:
"עלולה להפיץ וירוס שיזיק למחשב ועלול לגרום לאובדן של מידע יקר ערך, לעלויות הכרוכות בניסיון לשקמו ולעגמת נפש." (פסקה 2)`,
      `בית משפט השלום תל אביב קבע בת"צ 61428-12-23 תמיר נ' א.ל.ס סאער בע"מ (8.10.2025), מפי כב' השופטת א' בוסני:
"המפרסם אינו יוצא ידי חובתו במתן אפשרות הסרה באמצעות לחיצה על קישור, בפרט כאשר הוראת סעיף 30א(ד) לחוק התקשורת מחייבת מתן אפשרות הסרה בדרך בה נשלח דבר הפרסומת." (פסקה 29)`,
    ],
  },

  "היעדר פרטי שולח ודרכי התקשרות": {
    sectionTitle: "הפרת סעיף 30א(ה)(1) — היעדר פרטי שולח ודרכי התקשרות בהודעה",
    legalText: `סעיף 30א(ה)(1) לחוק התקשורת קובע:
"מפרסם המשגר דבר פרסומת באמצעות הודעת מסר קצר יציין בדבר הפרסומת רק את שמו ואת דרכי יצירת הקשר עמו לצורך מתן הודעת סירוב."`,
    citations: [
      `כב' השופט ט' חבקין קבע בת"ק 30204-08-14 הולנדר נ' דונה גיי בע"מ (5.7.2015), כי שני הסעיפים — 30א(ד) ו-30א(ה)(1):
"נועדו להקל על הנמען לבקש להסירו מרשימת התפוצה בהיותם מחייבים את השולח לאפשר את ההסרה בדרך הכרוכה במינימום משאבים וסיכון: לא באמצעות לחיצה על קישורית (שעלולה להיות נגועה בווירוס), אלא בדרך פשוטה שבה נתקבלה ההודעה."`,
      `באותו עניין קבע בית המשפט כי הנתבעת הפרה את שתי ההוראות, וציין:
"היא לא כללה בהודעות אפשרות להודיע על סירוב באמצעות משלוח הודעת מסר קצר, ואף לא ציינה בהודעה דרכי יצירת קשר עמה לצורך מתן הודעת סירוב. יש לתמרץ את הנתבעת לשנות את דרכיה ולפעול בהתאם לחוק."`,
    ],
  },

  "הסרה שלא בוצעה בפועל": {
    sectionTitle: "הפרת סעיף 30א(ד) — אי-ביצוע הסרה בפועל לאחר בקשה מפורשת",
    legalText: `סעיף 30א(י)(5)(א) לחוק קובע:
"חזקה על מפרסם ששיגר דבר פרסומת בניגוד להוראות סעיף זה, שעשה כך ביודעין [...] לעניין זה, לא תהיה למפרסם הגנה במקרים המפורטים להלן: (א) שיגור דבר הפרסומת נעשה לאחר שניתנה למפרסם הודעת סירוב מאת הנמען."`,
    citations: [
      `כב' השופט ט' חבקין הבחין בת"ק 44069-09-14 זילברג נ' קניה טובה באינטרנט בע"מ (11.3.2015) בין הפרה מצד אחד לבין התעלמות עקבית מצד שני, וקבע:
"התעלמות עקבית ומכוונת מבקשות הסרה והמשך שיגור דברי פרסומת היא נסיבה לחומרה."`,
      `כב' הרשמת הבכירה מ' בלאו קבעה בת"ק 33946-06-25 סגל נ' סלקום ישראל בע"מ (22.11.2025):
"התובע הראה כי שלח ביום 21.8.24 הודעה לצורך הסרתו מרשימת הדיוור של הנתבעת וחרף האמור נשלחו אליו ארבע הודעות נוספות לאחר מכן."`,
    ],
  },

  "הודעה לאחר הסרה": {
    sectionTitle: "הפרה חמורה במיוחד — משלוח פרסומת לאחר הודעת סירוב מפורשת",
    legalText: `סעיף 30א(י)(5)(א) לחוק קובע במפורש כי לא תהיה למפרסם הגנה כאשר:
"שיגור דבר הפרסומת נעשה לאחר שניתנה למפרסם הודעת סירוב מאת הנמען."`,
    citations: [
      `כב' השופט א' רובינשטיין קבע ברע"א 2904/14 גלסברג נ' קלאב רמון (27.7.2014), כי כאשר המפרסם ממשיך לשלוח לאחר בקשת הסרה יש לפסוק את מלוא הסכום:
"נוכח העובדה שהמשיבים לא חדלו מהפרותיהם גם כאשר התבקשו לעשות כן על-ידי המבקש, הסכום שייפסק הוא [...] 1,000 ₪ להפרות לאחר הבקשה." (פסקה טו)`,
      `כב' השופט ע' פוגלמן הוסיף ברע"א 1954/14 חזני נ' הנגבי (4.8.2014), כי בנסיבות של הפרה חוזרת לאחר בקשת הסרה:
"המדובר בהפרה חוזרת ונשנית [...] סבורני כי פיצוי בסך של 10,000 ש"ח הולם את הנסיבות האמורות ודי בו כדי להשיג את תכליות האכיפה וההרתעה." (פסקה 18)`,
    ],
  },
};

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
  const totalClaim = c.claimAmount + c.courtCosts;

  const violationSections = c.violations.map((v, idx) => {
    const citation = VIOLATION_CITATIONS[v];
    if (!citation) {
      return `\n${idx + 2}. ${v}\n   הנתבעת הפרה את הוראות החוק בעניין זה.\n`;
    }
    const citationText = citation.citations
      .map((cite) => `\n   ${cite}`)
      .join("\n");
    return `
${idx + 2}. ${citation.sectionTitle}

   ${citation.legalText}
${citationText}
`;
  });

  const nextSectionNum = c.violations.length + 2;

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

עניינה של תובענה זו במעשי ובמחדלי הנתבעת, שעיקרם במשלוח דברי פרסומת לתובע, ללא הסכמתו ובניגוד להוראות סעיף 30א לחוק התקשורת (בזק ושירותים), התשמ"ב – 1982 (להלן: "החוק").

פרטי התביעה:

1. הצדדים
   1.1 לשם הגילוי הנאות, יצוין, כי התובע הינו עו"ד בהשכלתו על אף שאינו עוסק במקצוע כבר מספר שנים, עם זאת כלל שיתבקש היתר לייצוג הרי שהתובע אינו מתנגד לכך.
   1.2 הנתבעת היא חברה פרטית שעיסוקה המרכזי הוא ${c.defendant}.
${violationSections.join("")}
${nextSectionNum}. סכום התביעה

   סכום התביעה חושב לפי מספר ההודעות שנשלחו בניגוד לחוק (${c.messageCount} הודעות), כפול סכום של 1,000 ₪ לכל הודעה.

   ${nextSectionNum}.1 בהתאם להוראות סעיף 30א(י)(1) לחוק, רשאי בית המשפט הנכבד לפסוק לתובע פיצויים ללא הוכחת נזק, בסכום שלא יעלה על 1,000 ₪ בשל כל דבר פרסומת שקיבל התובע מהנתבעת בניגוד להוראות החוק.

   ${nextSectionNum}.2 כב' השופט א' רובינשטיין קבע ברע"א 2904/14 גלסברג נ' קלאב רמון (27.7.2014) כי על בתי המשפט:
   "לראות ברף העליון שהציב המחוקק – 1,000 ש"ח – נקודת מוצא, ממנה כמובן ניתן להפחית, במקרים המתאימים." (פסקה יב)

${nextSectionNum + 1}. אשר על כן, מתבקש בית המשפט הנכבד לחייב את הנתבעת לשלם לתובע סך של:
   ${nextSectionNum + 1}.1 ${c.claimAmount.toLocaleString()} ₪ בגין ${c.messageCount} הפרות הוראות החוק.
   ${nextSectionNum + 1}.2 הוצאות משפט בסך ${c.courtCosts.toLocaleString()} ₪.
   ${nextSectionNum + 1}.3 סה"כ: ${totalClaim.toLocaleString()} ₪.
   ${nextSectionNum + 1}.4 לבית המשפט הנכבד הסמכות העניינית והמקומית לדון בתביעה.

[חתימה]
אשר דיבה, עו"ד

נספח 1
[צילומי מסך מצ"ב]`;
}

// ─── DOCX HELPERS ────────────────────────────────────────────────────────────

async function buildDocxBlob(c, type) {
  const [{ Document, Packer, Paragraph, TextRun, AlignmentType }, JSZip] =
    await Promise.all([import("docx"), import("jszip").then(m => m.default)]);

  const text = type === "warning" ? generateWarningLetter(c) : generateLawsuit(c);
  const lines = text.split("\n");
  const FONT = "David";

  const mkRun = (line, bold) =>
    new TextRun({
      text: line || "​",
      rightToLeft: true,                      // docx v9 renamed from `rtl`
      font: { name: FONT, cs: FONT },         // cs = complex-script (Hebrew) font
      size: bold ? 26 : 24,
      sizeComplexScript: bold ? 26 : 24,
      bold,
      boldComplexScript: bold,
      language: { bidirectional: "he-IL" },
    });

  const children = lines.map((line, idx) => {
    const isSenderHeader = type === "warning" && idx <= 5;
    const isDocTitle =
      line === "כתב תביעה" ||
      line === "הנדון: התראה בטרם נקיטת הליכים" ||
      line.startsWith("פרטי התביעה");
    const isSectionHeader =
      /^(התובע|הנתבעת|בית משפט לתביעות קטנות)/.test(line) ||
      line === "בכפר סבא";
    const isCentered = line === "כתב תביעה" || line === "- נ ג ד -" || line === "בכפר סבא";
    const bold = isSenderHeader || isDocTitle || isSectionHeader;

    return new Paragraph({
      bidirectional: true,
      alignment: isCentered ? AlignmentType.CENTER : AlignmentType.START,
      spacing: line.trim() === "" ? { after: 120 } : { after: 40 },
      children: [mkRun(line, bold)],
    });
  });

  const doc = new Document({
    styles: {
      // Document-level run/paragraph defaults
      default: {
        document: {
          run: {
            rightToLeft: true,
            font: { name: FONT, cs: FONT },
            size: 24,
            sizeComplexScript: 24,
            language: { bidirectional: "he-IL" },
          },
          paragraph: { bidirectional: true, alignment: AlignmentType.START },
        },
      },
      // Explicit Normal style — without this Word auto-generates a LTR Normal
      // on first open, which all other styles inherit from
      paragraphStyles: [
        {
          id: "Normal",
          name: "Normal",
          quickFormat: true,
          paragraph: {
            bidirectional: "1",           // string form required for style definitions
            alignment: AlignmentType.START,
          },
          run: {
            rightToLeft: true,
            font: { name: FONT, cs: FONT },
            size: 24,
            sizeComplexScript: 24,
          },
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 },   // A4 in twips
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
          },
        },
        children,
      },
    ],
  });

  // docx v9 has no API for section-level <w:bidi/>.
  // Without it Word treats the whole document as LTR layout (cursor direction,
  // ruler, new-paragraph defaults). Post-process the zip to inject it.
  const initialBlob = await Packer.toBlob(doc);
  const zip = await JSZip.loadAsync(initialBlob);
  const docXml = await zip.file("word/document.xml").async("string");
  zip.file("word/document.xml", docXml.replace("</w:sectPr>", "<w:bidi/></w:sectPr>"));
  return zip.generateAsync({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// Build a base64url-encoded RFC 2822 MIME message for Gmail API's `raw` field.
// attachments: array of { filename, mimeType, data (base64) }
function buildMimeMessage({ to, subject, bodyText, attachments = [] }) {
  const enc = (str) => {
    const bytes = new TextEncoder().encode(str);
    let bin = "";
    bytes.forEach((b) => (bin += String.fromCharCode(b)));
    return btoa(bin);
  };
  const wrap76 = (b64) => (b64.match(/.{1,76}/g) ?? []).join("\r\n");
  const boundary = `b_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;

  let mime =
    `To: ${to}\r\n` +
    `Subject: =?UTF-8?B?${enc(subject)}?=\r\n` +
    `MIME-Version: 1.0\r\n` +
    `Content-Type: multipart/mixed; boundary="${boundary}"\r\n\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: text/plain; charset=UTF-8\r\n` +
    `Content-Transfer-Encoding: base64\r\n\r\n` +
    wrap76(enc(bodyText)) + `\r\n`;

  for (const att of attachments) {
    mime +=
      `--${boundary}\r\n` +
      `Content-Type: ${att.mimeType}\r\n` +
      `Content-Disposition: attachment; filename="=?UTF-8?B?${enc(att.filename)}?="\r\n` +
      `Content-Transfer-Encoding: base64\r\n\r\n` +
      wrap76(att.data) + `\r\n`;
  }

  mime += `--${boundary}--`;

  const mimeBytes = new TextEncoder().encode(mime);
  let bin = "";
  mimeBytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
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
    const id = Date.now().toString();
    const newCase = {
      ...form,
      id,
      caseNumber: `2025-${String(Math.floor(Math.random() * 900) + 100)}`,
      stage: "new",
      claimAmount: form.messageCount * 1000,
      courtCosts: 2000,
      timeline: [{ date: form.firstMessageDate, action: "התקבלה פרסומת", type: "evidence" }],
      screenshots: [],
      createdAt: new Date().toISOString().split("T")[0],
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

function CaseDetail({ c, onUpdate, onBack, gmailToken, onGmailToken }) {
  const [showTemplate, setShowTemplate] = useState(null);
  const [addingNote, setAddingNote] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [newEventText, setNewEventText] = useState("");
  const [docxLoading, setDocxLoading] = useState(null);
  const [connectingGmail, setConnectingGmail] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailStatus, setEmailStatus] = useState(null);
  const [emailError, setEmailError] = useState(null);
  const fileInputRef = useRef(null);

  const handleDownloadDocx = async (type) => {
    setDocxLoading(type);
    try {
      const blob = await buildDocxBlob(c, type);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = type === "warning"
        ? `התראה_תיק_${c.caseNumber}.docx`
        : `כתב_תביעה_${c.caseNumber}.docx`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (err) {
      console.error("DOCX generation failed:", err);
      alert("שגיאה ביצירת המסמך. נסה שוב.");
    } finally {
      setDocxLoading(null);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const base64 = evt.target.result.split(",")[1];
      onUpdate({
        ...c,
        uploadedDocument: {
          name: file.name,
          type: file.type,
          uploadedAt: new Date().toISOString().split("T")[0],
          data: base64,
        },
      });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleConnectGmail = async () => {
    setConnectingGmail(true);
    setEmailError(null);
    try {
      const provider = new GoogleAuthProvider();
      provider.addScope("https://www.googleapis.com/auth/gmail.compose");
      const result = await signInWithPopup(auth, provider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      onGmailToken(credential.accessToken);
    } catch (err) {
      if (err.code !== "auth/popup-closed-by-user") {
        setEmailError(err.message);
      }
    } finally {
      setConnectingGmail(false);
    }
  };

  const handleCreateDraft = async () => {
    if (!c.contactEmail) return;
    setSendingEmail(true);
    setEmailStatus(null);
    setEmailError(null);
    try {
      const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

      // Attachment 1: warning letter — use uploaded doc if present, else generate
      let warningAttachment;
      if (c.uploadedDocument?.data) {
        warningAttachment = {
          filename: c.uploadedDocument.name,
          mimeType: c.uploadedDocument.type,
          data: c.uploadedDocument.data,
        };
      } else {
        const blob = await buildDocxBlob(c, "warning");
        warningAttachment = {
          filename: `מכתב_התראה_תיק_${c.caseNumber}.docx`,
          mimeType: DOCX_MIME,
          data: await blobToBase64(blob),
        };
      }

      // Attachment 2: lawsuit draft — always generated
      const lawsuitBlob = await buildDocxBlob(c, "lawsuit");
      const lawsuitAttachment = {
        filename: `טיוטת_כתב_תביעה_תיק_${c.caseNumber}.docx`,
        mimeType: DOCX_MIME,
        data: await blobToBase64(lawsuitBlob),
      };

      const subject = `התראה בטרם נקיטת הליכים — תיק #${c.caseNumber}`;
      const bodyText = `שלום רב,\nמצ״ב התראה בטרם נקיטת הליכים בעניין משלוח דברי פרסומת ללא הסכמה.\nאנא עיינו במסמך המצורף ופנו אלינו תוך 14 ימים.\n\nבכבוד רב,\nאשר דיבה, עו״ד | 052-3699372 | asherdiba@gmail.com`;

      const raw = buildMimeMessage({
        to: c.contactEmail,
        subject,
        bodyText,
        attachments: [warningAttachment, lawsuitAttachment],
      });

      const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/drafts", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${gmailToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: { raw } }),
      });

      if (res.status === 401) {
        onGmailToken(null);
        throw new Error("פג תוקף החיבור ל-Gmail. אנא חבר מחדש.");
      }
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error?.message ?? `Gmail API error ${res.status}`);
      }

      const today = new Date().toISOString().split("T")[0];
      onUpdate({
        ...c,
        stage: "prelegal",
        timeline: [
          ...c.timeline,
          { date: today, action: "מכתב התראה נשלח בדוא״ל לנתבע", type: "prelegal" },
        ],
      });
      setEmailStatus("sent");
    } catch (err) {
      setEmailStatus("error");
      setEmailError(err.message);
    } finally {
      setSendingEmail(false);
    }
  };

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
          <button
            onClick={() => handleDownloadDocx("warning")}
            disabled={!!docxLoading}
            style={{
              padding: "9px 16px", background: "#FFF7ED", color: "#9A3412",
              border: "1px solid #FED7AA", borderRadius: 8, fontWeight: 600,
              cursor: docxLoading ? "not-allowed" : "pointer", fontSize: 13,
              opacity: docxLoading === "warning" ? 0.6 : 1,
            }}
          >{docxLoading === "warning" ? "⏳ מכין..." : "📥 הורד DOCX — התראה"}</button>
          <button
            onClick={() => handleDownloadDocx("lawsuit")}
            disabled={!!docxLoading}
            style={{
              padding: "9px 16px", background: "#EEF2FF", color: "#3730A3",
              border: "1px solid #C7D2FE", borderRadius: 8, fontWeight: 600,
              cursor: docxLoading ? "not-allowed" : "pointer", fontSize: 13,
              opacity: docxLoading === "lawsuit" ? 0.6 : 1,
            }}
          >{docxLoading === "lawsuit" ? "⏳ מכין..." : "📥 הורד DOCX — כתב תביעה"}</button>
          {stageActions.map(a => (
            <button key={a.id} onClick={() => { moveStage(a.id); addEvent(a.label, a.eventType); }} style={{
              padding: "9px 16px", background: "#F0FDF4", color: "#065F46",
              border: "1px solid #BBF7D0", borderRadius: 8, fontWeight: 600, cursor: "pointer", fontSize: 13,
            }}>✓ {a.label}</button>
          ))}
        </div>
      </div>

      {/* Documents */}
      <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 14, padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 14 }}>מסמכים</div>
        {c.uploadedDocument && (
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            background: "#F0FDF4", border: "1px solid #BBF7D0",
            borderRadius: 8, padding: "10px 14px", marginBottom: 12,
          }}>
            <span style={{ color: "#10B981", fontSize: 16 }}>✓</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#065F46" }}>{c.uploadedDocument.name}</div>
              <div style={{ fontSize: 11, color: "#9CA3AF" }}>הועלה: {c.uploadedDocument.uploadedAt}</div>
            </div>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept=".docx,.pdf"
          style={{ display: "none" }}
          onChange={handleFileUpload}
        />
        <button
          onClick={() => fileInputRef.current.click()}
          style={{
            padding: "9px 16px", background: "#F9FAFB", color: "#374151",
            border: "1px solid #D1D5DB", borderRadius: 8, fontWeight: 600,
            cursor: "pointer", fontSize: 13,
          }}
        >
          {c.uploadedDocument ? "🔄 החלף מסמך" : "📤 העלה מסמך ערוך (.docx / .pdf)"}
        </button>
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
      <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 14, padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 10 }}>הערות</div>
        <div style={{ fontSize: 13, color: "#6B7280", lineHeight: 1.7, direction: "rtl" }}>{c.notes || "אין הערות."}</div>
        <div style={{ marginTop: 10, fontSize: 12, color: "#9CA3AF" }}>כתובת: {c.contactAddress} · {c.contactEmail}</div>
      </div>

      {/* Send to defendant */}
      <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 14, padding: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 14 }}>שליחה לנתבע</div>

        {/* Gmail connection status */}
        <div style={{ marginBottom: 14 }}>
          {gmailToken ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12 }}>
              <span style={{ color: "#10B981", fontWeight: 700 }}>✓ Gmail מחובר</span>
              <button
                onClick={() => { onGmailToken(null); setEmailStatus(null); }}
                style={{ background: "none", border: "none", color: "#9CA3AF", cursor: "pointer", fontSize: 12, textDecoration: "underline", padding: 0 }}
              >
                נתק
              </button>
            </div>
          ) : (
            <div>
              <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 8 }}>
                חבר את חשבון Gmail כדי ליצור טיוטת מייל לנתבע ישירות מהאפליקציה.
              </div>
              <button
                onClick={handleConnectGmail}
                disabled={connectingGmail}
                style={{
                  padding: "8px 18px",
                  background: connectingGmail ? "#9CA3AF" : "#fff",
                  color: connectingGmail ? "#fff" : "#374151",
                  border: "1px solid #D1D5DB", borderRadius: 8,
                  fontWeight: 600, fontSize: 13,
                  cursor: connectingGmail ? "not-allowed" : "pointer",
                  display: "flex", alignItems: "center", gap: 8,
                }}
              >
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="" style={{ width: 16, height: 16 }} />
                {connectingGmail ? "מתחבר..." : "חבר Gmail"}
              </button>
            </div>
          )}
        </div>

        {/* Draft creation — only shown when Gmail is connected and case has email */}
        {gmailToken && (
          c.contactEmail ? (
            <>
              <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 12, lineHeight: 1.6 }}>
                <span>יצירת טיוטה אל: </span>
                <strong>{c.contactEmail}</strong>
                {c.uploadedDocument
                  ? <span style={{ color: "#10B981", marginRight: 8 }}> · מסמך מועלה יצורף</span>
                  : <span style={{ color: "#9CA3AF", marginRight: 8 }}> · התראה תיווצר כ-DOCX אוטומטית</span>
                }
              </div>
              {emailStatus === "sent" && (
                <div style={{
                  background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 8,
                  padding: "10px 14px", marginBottom: 12, color: "#065F46", fontSize: 13,
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                }}>
                  <span>✓ הטיוטה נוצרה ב-Gmail — שלב התיק עודכן</span>
                  <a href="https://mail.google.com/#drafts" target="_blank" rel="noopener noreferrer"
                    style={{ color: "#059669", fontSize: 12, fontWeight: 600 }}>
                    פתח Gmail ←
                  </a>
                </div>
              )}
              {emailStatus === "error" && (
                <div style={{
                  background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: 8,
                  padding: "10px 14px", marginBottom: 12, color: "#991B1B", fontSize: 13,
                }}>
                  שגיאה: {emailError}
                </div>
              )}
              <button
                onClick={handleCreateDraft}
                disabled={sendingEmail}
                style={{
                  padding: "10px 22px",
                  background: sendingEmail ? "#9CA3AF" : "#7C3AED",
                  color: "#fff", border: "none", borderRadius: 8,
                  fontWeight: 700, fontSize: 14,
                  cursor: sendingEmail ? "not-allowed" : "pointer",
                }}
              >
                {sendingEmail ? "⏳ יוצר טיוטה..." : "✉️ צור טיוטה ב-Gmail"}
              </button>
            </>
          ) : (
            <div style={{ fontSize: 13, color: "#9CA3AF" }}>אין כתובת אימייל לנתבע בתיק זה.</div>
          )
        )}
      </div>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────

export default function App() {
  const [cases, setCases] = useState(SAMPLE_CASES);
  const [selectedCase, setSelectedCase] = useState(null);
  const [showNewCase, setShowNewCase] = useState(false);
  const [filterStage, setFilterStage] = useState("all");
  const [search, setSearch] = useState("");
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [gmailToken, setGmailToken] = useState(null);

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

  // Load from storage
  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(doc(db, "spamtrack", "asher", "data", "cases"));
        if (snap.exists()) setCases(snap.data().list);
      } catch (e) { console.error(e); }
      setLoaded(true);
    })();
  }, []);

  // Save to storage
  useEffect(() => {
    if (!loaded) return;
    (async () => {
      try {
        await setDoc(doc(db, "spamtrack", "asher", "data", "cases"), { list: cases });
      } catch (e) { console.error(e); }
    })();
  }, [cases, loaded]);

  const updateCase = (updated) => {
    setCases(cs => cs.map(c => c.id === updated.id ? updated : c));
    setSelectedCase(updated);
  };

  const addCase = (newCase) => {
    setCases(cs => [newCase, ...cs]);
    setShowNewCase(false);
    setSelectedCase(newCase);
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
            <div style={{ fontSize: 12, color: "#9CA3AF" }}>מערכת ניהול תביעות ספאם</div>
            <button onClick={handleLogout} style={{ background: "#F3F4F6", color: "#6B7280", border: "none", borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 12 }}>התנתק</button>
          </div>
        </div>
        <CaseDetail
          c={selectedCase}
          onUpdate={updateCase}
          onBack={() => setSelectedCase(null)}
          gmailToken={gmailToken}
          onGmailToken={setGmailToken}
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
            <button onClick={handleLogout} style={{ background: "rgba(255,255,255,0.2)", color: "#fff", border: "none", borderRadius: 8, padding: "6px 14px", cursor: "pointer", fontSize: 12 }}>
              התנתק
            </button>
            <button onClick={() => setShowNewCase(true)} style={{
              background: "#fff", color: "#7C3AED", border: "none", borderRadius: 10,
              padding: "10px 20px", fontWeight: 800, cursor: "pointer", fontSize: 14,
            }}>+ תיק חדש</button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 20px" }}>

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
      </div>
    </div>
  );
}
