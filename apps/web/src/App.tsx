import { useState } from "react";
import CloudComposer from "./components/CloudComposer";
import Workspace from "./components/Workspace";

const navLinks = [
  { label: "الأسئلة الشائعة", href: "#" },
  { label: "التوثيق", href: "#" },
  { label: "الأسعار", href: "#" },
  { label: "ماكس", href: "#", accent: true }
];

const previewCards = [
  {
    title: "المعاينة الحية",
    tag: "IOS",
    lines: ["مشروع أطلس", "التحديث الفوري مستقر", "هدف النشر جاهز"]
  },
  {
    title: "مساحة العمل",
    tag: "WEB",
    lines: ["cloud-ide/app.tsx", "جسر التشغيل متصل", "تمت مزامنة ٣ ملفات"]
  },
  {
    title: "وحدة التحكم",
    tag: "EDGE",
    lines: ["اكتمل البناء", "٠ أخطاء حرجة", "تم جدولة النشر"]
  }
];

type AppState = "landing" | "generating" | "workspace";

function App() {
  const [appState, setAppState] = useState<AppState>("landing");
  const [activePrompt, setActivePrompt] = useState("");
  const [loadingStep, setLoadingStep] = useState(0);

  const loadingSequence = [
    "تحليل الموجه اللغوي...",
    "بناء الهيكل الطليعي (Avant-Garde)...",
    "توصيل محرك العرض المباشر...",
    "جسر السحابة جاهز للإقلاع"
  ];

  const handleGenerate = (prompt: string) => {
    setActivePrompt(prompt);
    setAppState("generating");
    
    // Simulate complex AI generation steps
    let step = 0;
    const interval = setInterval(() => {
      step++;
      setLoadingStep(step);
      if (step >= loadingSequence.length) {
        clearInterval(interval);
        setTimeout(() => setAppState("workspace"), 600);
      }
    }, 900);
  };

  const handleCloseWorkspace = () => {
    setAppState("landing");
    setLoadingStep(0);
    setActivePrompt("");
  };

  if (appState === "workspace") {
    return <Workspace prompt={activePrompt} onClose={handleCloseWorkspace} />;
  }

  return (
    <div className="page-shell">
      {/* Abstract Overlay during generation */}
      {appState === "generating" && (
        <div className="generation-overlay">
          <div className="generation-core">
            <div className="pulse-ring" />
            <div className="generation-text-sequence">
               <span className="gen-step">{loadingSequence[Math.min(loadingStep, loadingSequence.length - 1)]}</span>
            </div>
            
            {/* Minimalist Progress Line */}
            <div className="generation-progress-bar">
               <div className="progress-fill" style={{ width: `${(loadingStep / loadingSequence.length) * 100}%` }} />
            </div>
          </div>
        </div>
      )}

      {/* Main UI blurred lightly if generating */}
      <div className={`landing-container ${appState === 'generating' ? 'blurred' : ''}`}>
        <header className="topbar">
          <a className="brand" href="/">
            <span className="brand__dot" />
            <span className="brand__text">Cloud IDE</span>
          </a>

          <nav aria-label="الرئيسية" className="topnav">
            {navLinks.map((item) => (
              <a key={item.label} className="topnav__link" data-accent={item.accent} href={item.href}>
                {item.label}
              </a>
            ))}
          </nav>

          <div className="topbar__actions">
            <a aria-label="منصة X" className="icon-chip" href="https://x.com" rel="noreferrer" target="_blank">
              X
            </a>
            <button aria-label="اللغة" className="locale-chip" type="button">
              AR
            </button>
            <button className="signin-chip" type="button">
              تسجيل الدخول
            </button>
          </div>
        </header>

        <main className="landing">
          <section className="hero">
            <h1>ابنِ تطبيقات سحابية حقيقية، <span className="text-highlight">بسرعة.</span></h1>
            <p className="hero__lede">
              صمم منتجات سحابية قابلة للنشر عبر محادثة الذكاء الاصطناعي. من فكرة إلى مساحة عمل في دقائق، وإلى الإنتاج في ساعات.
            </p>

            <div className="uploader-row">
              <label className="upload-chip" htmlFor="brief-upload">
                اختيار ملف
              </label>
              <input id="brief-upload" type="file" />
            </div>

            <CloudComposer onGenerate={handleGenerate} />
          </section>

          <section className="feature-callout" aria-labelledby="max-title">
            <h2 id="max-title">
              نقدم لكم Cloud IDE <span>ماكس</span>
            </h2>
            <p>
              مخرجات بصرية أقوى، تنسيق أعمق لمساحة العمل، حلقات معاينة أسرع، ومسار أكثر نقاءً من الموجه النصي إلى النشر.
            </p>
            <a className="feature-callout__link" href="#">
              ← اكتشف المزيد عن Cloud IDE ماكس
            </a>
          </section>

          <section className="showcase" aria-label="معاينة المنتج">
            <div className="showcase__glow" />
            <div className="showcase__panel">
              {previewCards.map((card, index) => (
                <article
                  key={card.title}
                  className="preview-card"
                  data-index={index + 1}
                  aria-label={card.title}
                >
                  <div className="preview-card__header">
                    <span>{card.title}</span>
                    <strong>{card.tag}</strong>
                  </div>
                  <div className="preview-card__screen">
                    <div className="screen-grid" />
                    <div className="screen-content">
                      {card.lines.map((line) => (
                        <span key={line}>{line}</span>
                      ))}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </main>

        <footer className="footer">
          <div className="footer__links">
            <a href="#">الشروط</a>
            <span>•</span>
            <a href="#">الخصوصية</a>
            <span>•</span>
            <a href="#">الشركاء</a>
          </div>
          <p>صُنع بحب في بغداد، تبليسي، ولندن</p>
        </footer>
      </div>
    </div>
  );
}

export default App;
