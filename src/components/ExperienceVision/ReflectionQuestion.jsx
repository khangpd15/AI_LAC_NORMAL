import React from 'react';

/**
 * ReflectionQuestion
 * "🧠 Kiểm tra người thân"
 * 
 * Cinematic frosted overlay for the 3 selected questions in the journey.
 * - Only appears AFTER voice has finished speaking
 * - 1 short question, 2 options
 * - Instant concise explanation
 */
export default function ReflectionQuestion({
  questionData,
  selectedOption,
  onSelectOption,
  className = '',
}) {
  if (!questionData) return null;

  return (
    <div className={`reflection-cinematic-card ${className}`}>
      <div className="rc-badge-pill">
        <span>{questionData.prompt || '🧠 Kiểm tra người thân'}</span>
      </div>

      <h3 className="rc-question-text">{questionData.question}</h3>

      <div className="rc-options-row" role="group" aria-label="Lựa chọn">
        {questionData.options.map((opt) => {
          const isSelected = selectedOption === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              className={`rc-choice-btn ${isSelected ? 'selected' : ''}`}
              onClick={() => onSelectOption?.(opt.id)}
            >
              <span className="choice-text">{opt.label}</span>
              {isSelected && <span className="choice-check">✓</span>}
            </button>
          );
        })}
      </div>

      {/* Immediate Concise Explanation */}
      {selectedOption && (
        <div className="rc-explanation-bubble fade-in">
          <span className="bulb-emoji">💡</span>
          <p className="explanation-content">
            {questionData.explanation}
          </p>
        </div>
      )}
    </div>
  );
}
