import { useState } from "react";

const navLinks = [
  { label: "FAQ", href: "#" },
  { label: "Docs", href: "#" },
  { label: "Pricing", href: "#" },
  { label: "Max", href: "#", accent: true }
];

const previewCards = [
  {
    title: "Live Preview",
    tag: "IOS",
    lines: ["Project Atlas", "Hot reload stable", "Deploy target ready"]
  },
  {
    title: "Workspace",
    tag: "WEB",
    lines: ["cloud-ide/app.tsx", "Runtime bridge online", "3 files synchronized"]
  },
  {
    title: "Console",
    tag: "EDGE",
    lines: ["build completed", "0 critical errors", "publish queued"]
  }
];

function App() {
  const [prompt, setPrompt] = useState("");

  return (
    <div className="page-shell">
      <header className="topbar">
        <a className="brand" href="/">
          <span className="brand__dot" />
          <span>Cloud IDE</span>
        </a>

        <nav aria-label="Primary" className="topnav">
          {navLinks.map((item) => (
            <a key={item.label} className="topnav__link" data-accent={item.accent} href={item.href}>
              {item.label}
            </a>
          ))}
        </nav>

        <div className="topbar__actions">
          <a aria-label="X" className="icon-chip" href="https://x.com" rel="noreferrer" target="_blank">
            X
          </a>
          <button className="locale-chip" type="button">
            US
          </button>
          <button className="signin-chip" type="button">
            Sign in
          </button>
        </div>
      </header>

      <main className="landing">
        <section className="hero">
          <h1>Build real cloud apps, fast.</h1>
          <p className="hero__lede">
            Create deployable cloud products by chatting with AI. Idea to workspace in minutes,
            to production in hours.
          </p>

          <div className="uploader-row">
            <label className="upload-chip" htmlFor="brief-upload">
              Choose File
            </label>
            <input id="brief-upload" type="file" />
          </div>

          <div className="composer" role="group" aria-label="App request composer">
            <textarea
              aria-label="Describe the app you want to build"
              className="composer__input"
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="Describe the cloud app you want to build..."
              rows={3}
              value={prompt}
            />

            <div className="composer__footer">
              <div className="composer__left">
                <button aria-label="Add attachment" className="round-button" type="button">
                  +
                </button>
                <button className="mode-pill" type="button">
                  <span className="mode-pill__spark" />
                  Cloud IDE Max
                </button>
              </div>

              <button aria-label="Voice input" className="round-button round-button--soft" type="button">
                <span className="mic-glyph" />
              </button>
            </div>
          </div>
        </section>

        <section className="feature-callout" aria-labelledby="max-title">
          <h2 id="max-title">
            Introducing Cloud IDE <span>Max</span>
          </h2>
          <p>
            Stronger visual output, richer workspace orchestration, faster preview loops, and a
            cleaner path from prompt to deployment.
          </p>
          <a className="feature-callout__link" href="#">
            Learn more about Cloud IDE Max →
          </a>
        </section>

        <section className="showcase" aria-label="Product preview">
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
          <a href="#">Terms</a>
          <span>•</span>
          <a href="#">Privacy</a>
          <span>•</span>
          <a href="#">Affiliates</a>
        </div>
        <p>Made with love in Baghdad, Tbilisi and London</p>
      </footer>
    </div>
  );
}

export default App;
