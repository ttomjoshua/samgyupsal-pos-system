import React, { useState, useRef, useEffect } from 'react';
import './SelectMenu.css';

export default function SelectMenu({
  options = [],
  value,
  onChange,
  name,
  placeholder = 'Select an option',
  disabled = false,
  className = '',
  'aria-invalid': ariaInvalid,
  id
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  // Close on Outside Click
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleToggle = () => {
    if (!disabled) {
      setIsOpen((prev) => !prev);
    }
  };

  const handleSelect = (optionValue) => {
    // Fire a synthetic event object mimicking native <select> event
    if (onChange) {
      onChange({ target: { name, value: optionValue } });
    }
    setIsOpen(false);
  };

  const selectedOption = options.find((opt) => opt.value === value) || options.find((opt) => opt.value === String(value));
  const displayLabel = selectedOption ? selectedOption.label : placeholder;

  return (
    <div className={`select-menu-container ${className}`} ref={containerRef}>
      <button
        type="button"
        id={id}
        className="select-menu-trigger"
        onClick={handleToggle}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-invalid={ariaInvalid}
        disabled={disabled}
      >
        <span className={selectedOption ? 'select-menu-value' : 'select-menu-value select-menu-placeholder'}>
          {displayLabel}
        </span>
        <svg
          className="select-menu-icon"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>

      {isOpen && !disabled && (
        <ul className="select-menu-dropdown" role="listbox">
          {options.length === 0 ? (
            <li className="select-menu-item" style={{ opacity: 0.6, cursor: 'default' }}>
              No options available
            </li>
          ) : (
            options.map((option) => (
              <li
                key={option.value}
                role="option"
                aria-selected={value === option.value}
                className={
                  value === option.value
                    ? 'select-menu-item select-menu-item--selected'
                    : 'select-menu-item'
                }
                onClick={() => handleSelect(option.value)}
              >
                {option.label}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
