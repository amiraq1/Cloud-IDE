import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Code2,
  Database,
  Globe2,
  PanelsTopLeft,
  Presentation,
  Smartphone,
  Sparkles
} from "lucide-react";
import CloudComposer from "./components/CloudComposer";
import Workspace from "./components/Workspace";
import { useFileSystem } from "./store/filesystem";

const navLinks = ["المنتج", "الفرق", "التسعير", "المستندات"];

const buildSurfaces: Array<{ label: string; hint: string; icon: LucideIcon }> = [
  { label: "موقع", hint: "صفحة تسويق مع CMS ولوحة تحليلات", icon: Globe2 },
  { label: "لوحة تحكم", hint: "لوحة عمليات للفريق مع صلاحيات", icon: PanelsTopLeft },
  { label: "تطبيق جوال", hint: "تطبيق عميل بمهام ومزامنة", icon: Smartphone },
  { label: "أداة داخلية", hint: "بوابة فرق مع مهام وأتمتة", icon: Code2 },
  { label: "API", hint: "واجهة خلفية مع Auth وقواعد بيانات", icon: Database },
  { label: "عرض", hint: "عرض تفاعلي قابل للمشاركة", icon: Presentation }
];

const examplePrompts = [
  "منصة حجوزات عربية مع لوحة تشغيل لفريق الدعم",
  "لوحة مالية للشركات الصغيرة مع تنبيهات ذكية",
  "بوابة عملاء لوكالة إبداعية مع ملفات وفواتير"
];

const shellStats = [
  { label: "مسارات التوليد", value: "4 Agents" },
  { label: "زمن فتح مساحة العمل", value: "< 90s" },
  { label: "جاهزية النشر", value: "Deploy-ready" }
];

type AppState = "landing" | "generating" | "workspace";

function App() {
  const [appState, setAppState] = useState<AppState>("landing");
  const [promptInput, setPromptInput] = useState("");
  const [activePrompt, setActivePrompt] = useState("");
  const [loadingStep, setLoadingStep] = useState(0);

  const loadingSequence = [
    "قراءة المتطلبات وتحديد المعمارية...",
    "تجهيز الملفات والواجهات الأساسية...",
    "ربط المحرر والتشغيل والمعاينة...",
    "فتح مساحة العمل الجاهزة للتنفيذ..."
  ];

  const handleGenerate = async (prompt: string) => {
    const trimmed = prompt.trim();
    if (!trimmed) return;

    setActivePrompt(trimmed);
    setAppState("generating");
    setLoadingStep(0);

    try {
      // Initialize generation
      // 1. Fetch from Fastify server locally
      // Switch this URL dynamically using env vars in production.
      const functionUrl = import.meta.env.VITE_API_URL || "http://localhost:8787/api/generate";
      
      const response = await fetch(functionUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: trimmed }),
      });

      if (!response.ok) {
        throw new Error("فشل الاتصال بنموذج التوليد");
      }

      setLoadingStep(1); // Preparing files
      const data = await response.json();
      
      if (data.fileTree) {
        // Inject real files into the Zustand store
        useFileSystem.getState().setData(data.fileTree);
      }
      
      setLoadingStep(3); // Opening workspace
      window.setTimeout(() => setAppState("workspace"), 600);

    } catch (error) {
      console.error("Agent failed:", error);
      alert("تعذر توليد مساحة العمل. تأكد من عمل خادم Node.js ومفاتيح الـ API.");
      setAppState("landing");
      setLoadingStep(0);
    }
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
      {appState === "generating" && (
        <div className="generation-overlay" aria-live="polite">
          <div className="generation-card">
            <div className="generation-ring" />
            <div className="generation-copy">
              <span className="generation-kicker">Cloud IDE Agent</span>
              <strong>{loadingSequence[Math.min(loadingStep, loadingSequence.length - 1)]}</strong>
            </div>
            <div className="generation-progress-bar">
              <div
                className="generation-progress-bar__fill"
                style={{ width: `${(loadingStep / loadingSequence.length) * 100}%` }}
              />
            </div>
          </div>
        </div>
      )}

      <div className={`landing-container ${appState === "generating" ? "blurred" : ""}`}>
        <header className="site-nav">
          <a className="brand" href="/">
            <span className="brand__mark" />
            <span className="brand__text">Cloud IDE</span>
          </a>

          <nav aria-label="روابط رئيسية" className="site-nav__links">
            {navLinks.map((item) => (
              <a key={item} className="site-nav__link" href="#">
                {item}
              </a>
            ))}
          </nav>

          <div className="site-nav__actions">
            <button className="nav-chip" type="button">
              دخول
            </button>
            <button className="nav-chip nav-chip--primary" type="button">
              ابدأ مجانًا
            </button>
          </div>
        </header>

        <main className="landing-shell">
          <section className="landing-hero">
            <span className="landing-eyebrow">
              <Sparkles size={14} />
              Agent-first product studio
            </span>

            <h1 className="landing-title">
              ما الذي تريد بناءه
              <span className="landing-title__accent"> اليوم؟</span>
            </h1>

            <p className="landing-lede">
              اكتب الفكرة فقط. سنحوّلها إلى مساحة عمل قابلة للتشغيل شبيهة بتجربة
              Replit: ملفات، محرر، تشغيل، ومعاينة ضمن غلاف واحد.
            </p>

            <CloudComposer value={promptInput} onChange={setPromptInput} onGenerate={handleGenerate} />

            <div className="build-lane" aria-label="أنواع المشاريع">
              {buildSurfaces.map(({ label, hint, icon: Icon }) => (
                <button
                  key={label}
                  className="build-pill"
                  type="button"
                  onClick={() => setPromptInput(hint)}
                >
                  <span className="build-pill__icon">
                    <Icon size={16} />
                  </span>
                  <span>{label}</span>
                </button>
              ))}
            </div>

            <div className="example-lane">
              <span className="example-lane__label">جرّب مثالًا جاهزًا</span>
              {examplePrompts.map((prompt) => (
                <button
                  key={prompt}
                  className="example-pill"
                  type="button"
                  onClick={() => setPromptInput(prompt)}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </section>

          <section className="hero-preview" aria-label="معاينة مساحة العمل">
            <div className="hero-preview__topbar">
              <span className="hero-preview__badge">Agent Session</span>
              <span className="hero-preview__badge">Deploy-ready</span>
            </div>

            <div className="hero-preview__content">
              <aside className="hero-preview__sidebar">
                <span className="hero-preview__sidebar-title">workspace</span>
                <span className="hero-preview__file">app.tsx</span>
                <span className="hero-preview__file">routes/dashboard.ts</span>
                <span className="hero-preview__file">lib/auth.ts</span>
                <span className="hero-preview__file">styles/theme.css</span>
              </aside>

              <div className="hero-preview__main">
                <div className="hero-preview__chat">
                  <div className="hero-preview__message">أنشئ لوحة تشغيل للعملاء مع صلاحيات متعددة.</div>
                  <div className="hero-preview__message hero-preview__message--accent">
                    تم تقسيم المهمة إلى واجهة، بيانات، وتشغيل فوري.
                  </div>
                </div>

                <div className="hero-preview__canvas">
                  <div className="hero-preview__canvas-header">
                    <span>Preview</span>
                    <span>https://launchpad.app</span>
                  </div>

                  <div className="hero-preview__canvas-grid">
                    <div className="hero-preview__tile hero-preview__tile--accent" />
                    <div className="hero-preview__tile" />
                    <div className="hero-preview__tile hero-preview__tile--wide" />
                    <div className="hero-preview__tile" />
                    <div className="hero-preview__tile" />
                  </div>
                </div>
              </div>
            </div>

            <div className="hero-preview__stats">
              {shellStats.map((item) => (
                <article key={item.label} className="hero-preview__stat">
                  <span className="hero-preview__stat-label">{item.label}</span>
                  <strong className="hero-preview__stat-value">{item.value}</strong>
                </article>
              ))}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

export default App;
