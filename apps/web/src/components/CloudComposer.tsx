import { useState, useRef } from "react";

interface CloudComposerProps {
  onGenerate: (prompt: string) => void;
}

export default function CloudComposer({ onGenerate }: CloudComposerProps) {
  const [prompt, setPrompt] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPrompt(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  };

  const handleSubmit = () => {
    if (prompt.trim() !== "") {
      onGenerate(prompt);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="avant-composer" role="search" aria-label="أداة كتابة الأوامر">
      <div className="avant-composer__backdrop-glow" aria-hidden="true" />
      
      <div className="avant-composer__surface">
        <textarea
          ref={textareaRef}
          id="cloud-prompt-input"
          className="avant-composer__input"
          aria-label="صِف التطبيق السحابي الذي تريد بناءه..."
          placeholder="صِف التطبيق الذي تود بناءه... (اضغط Enter للبدء)"
          rows={1}
          value={prompt}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          spellCheck={false}
        />

        <div className="avant-composer__controls">
          <div className="avant-composer__tools">
            <button 
              aria-label="إضافة مرفق" 
              className="avant-btn avant-btn--ghost" 
              type="button"
            >
              <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
              </svg>
            </button>
            <button className="avant-badge avant-badge--max" type="button" onClick={handleSubmit}>
              <span className="avant-badge__dot" />
              توليد ذكي
            </button>
          </div>

          <button 
             aria-label="إرسال" 
             className="avant-btn avant-btn--primary send-btn" 
             type="button"
             onClick={handleSubmit}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 2 11 13" />
              <path d="M22 2 15 22 11 13 2 9 22 2z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
