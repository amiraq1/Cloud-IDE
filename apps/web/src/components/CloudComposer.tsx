import { useRef } from "react";
import { ArrowUpRight, Paperclip, Sparkles } from "lucide-react";

interface CloudComposerProps {
  value: string;
  onChange: (value: string) => void;
  onGenerate: (prompt: string) => void;
}

export default function CloudComposer({ value, onChange, onGenerate }: CloudComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const resize = () => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = "auto";
    textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 240)}px`;
  };

  const handleInput = (nextValue: string) => {
    onChange(nextValue);
    window.requestAnimationFrame(resize);
  };

  const handleSubmit = () => {
    if (value.trim()) {
      onGenerate(value.trim());
    }
  };

  return (
    <div className="prompt-composer" role="search" aria-label="أداة وصف المشروع">
      <div className="prompt-composer__surface">
        <textarea
          ref={textareaRef}
          className="prompt-composer__textarea"
          rows={1}
          value={value}
          onChange={(event) => handleInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              handleSubmit();
            }
          }}
          placeholder="صف فكرتك: المنتج، الجمهور، الشاشة الأساسية، وما الذي يجب أن يعمل أولًا..."
          aria-label="صف فكرتك"
          spellCheck={false}
        />

        <div className="prompt-composer__footer">
          <div className="prompt-composer__meta">
            <button aria-label="إرفاق ملف مرجعي" className="prompt-composer__ghost" type="button">
              <Paperclip size={15} />
            </button>
            <span className="prompt-composer__hint">Shift + Enter لسطر جديد</span>
          </div>

          <button className="prompt-composer__primary" type="button" onClick={handleSubmit}>
            <Sparkles size={15} />
            ابدأ
            <ArrowUpRight size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
