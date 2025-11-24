import React, { useState } from 'react';
import { Sparkles, Loader2, Plus } from 'lucide-react';

export default function InputSection({ onGenerate, onAdd, isGenerating }) {
  const [input, setInput] = useState('');
  const textareaRef = React.useRef(null);

  const adjustHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${textarea.scrollHeight}px`;
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    onGenerate(input);
    setInput('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      if (e.shiftKey) {
        // Shift + Enter -> Manual Add
        e.preventDefault();
        if (!input.trim()) return;
        onAdd(input);
        setInput('');
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
        }
      } else if (!e.nativeEvent.isComposing) {
        // Enter (without Shift) -> AI Generate
        // Check isComposing to avoid triggering during IME conversion (Japanese input)
        handleSubmit(e);
      }
    }
  };

  return (
    <div className="glass-panel" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
      <form onSubmit={handleSubmit}>
        <div style={{ position: 'relative' }}>
          <textarea
            ref={textareaRef}
            className="input-field"
            placeholder="例: 明日10時に牛乳を買って、そのあと14時から会議の準備をする"
            rows={3}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              adjustHeight();
            }}
            onKeyDown={handleKeyDown}
            disabled={isGenerating}
            style={{
              resize: 'vertical',
              minHeight: '80px',
              overflow: 'hidden'
            }}
          />
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: '1rem'
          }}>
            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
              Enter でAI解析 / Shift + Enter でそのまま追加
            </span>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isGenerating || !input.trim()}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="animate-spin" size={18} />
                  生成中...
                </>
              ) : (
                <>
                  <Sparkles size={18} />
                  AIで解析
                </>
              )}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                if (!input.trim()) return;
                onAdd(input);
                setInput('');
                if (textareaRef.current) {
                  textareaRef.current.style.height = 'auto';
                }
              }}
              disabled={isGenerating || !input.trim()}
              style={{ marginLeft: '0.5rem' }}
            >
              <Plus size={18} />
              そのまま追加
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
