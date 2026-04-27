import { useEffect, useId, useMemo, useRef, useState } from 'react'
import './SelectMenu.css'

function findSelectedIndex(options, value) {
  return options.findIndex((option) => String(option.value) === String(value))
}

function getNextEnabledIndex(options, currentIndex, direction) {
  if (options.length === 0) {
    return -1
  }

  const fallbackIndex = direction > 0 ? 0 : options.length - 1
  if (currentIndex < 0) {
    return fallbackIndex
  }

  const startIndex = currentIndex
  return Math.min(
    options.length - 1,
    Math.max(0, startIndex + direction),
  )
}

export default function SelectMenu({
  options = [],
  value,
  onChange,
  name,
  placeholder = 'Select an option',
  disabled = false,
  className = '',
  'aria-invalid': ariaInvalid,
  id,
}) {
  const generatedId = useId()
  const triggerId = id || `select-menu-trigger-${generatedId}`
  const listboxId = `select-menu-listbox-${generatedId}`
  const [isOpen, setIsOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(() =>
    Math.max(0, findSelectedIndex(options, value)),
  )
  const containerRef = useRef(null)
  const optionRefs = useRef([])
  const selectedIndex = useMemo(
    () => findSelectedIndex(options, value),
    [options, value],
  )
  const selectedOption = selectedIndex >= 0 ? options[selectedIndex] : null
  const displayLabel = selectedOption ? selectedOption.label : placeholder

  useEffect(() => {
    function handleClickOutside(event) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target)
      ) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const nextHighlightedIndex = selectedIndex >= 0 ? selectedIndex : 0
    setHighlightedIndex(nextHighlightedIndex)
  }, [isOpen, selectedIndex])

  useEffect(() => {
    if (!isOpen || highlightedIndex < 0) {
      return
    }

    optionRefs.current[highlightedIndex]?.scrollIntoView({
      block: 'nearest',
    })
  }, [highlightedIndex, isOpen])

  const openMenu = (initialIndex = selectedIndex >= 0 ? selectedIndex : 0) => {
    if (disabled) {
      return
    }

    setHighlightedIndex(Math.max(0, initialIndex))
    setIsOpen(true)
  }

  const closeMenu = () => {
    setIsOpen(false)
  }

  const handleToggle = () => {
    if (disabled) {
      return
    }

    if (isOpen) {
      closeMenu()
      return
    }

    openMenu()
  }

  const handleSelect = (optionValue) => {
    onChange?.({
      target: {
        name,
        value: optionValue,
      },
    })
    closeMenu()
  }

  const handleKeyDown = (event) => {
    if (disabled) {
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()

      if (!isOpen) {
        openMenu(selectedIndex >= 0 ? selectedIndex : 0)
        return
      }

      setHighlightedIndex((currentIndex) =>
        getNextEnabledIndex(options, currentIndex, 1),
      )
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()

      if (!isOpen) {
        openMenu(selectedIndex >= 0 ? selectedIndex : options.length - 1)
        return
      }

      setHighlightedIndex((currentIndex) =>
        getNextEnabledIndex(options, currentIndex, -1),
      )
      return
    }

    if (event.key === 'Home') {
      event.preventDefault()
      openMenu(0)
      return
    }

    if (event.key === 'End') {
      event.preventDefault()
      openMenu(options.length - 1)
      return
    }

    if (event.key === 'Escape') {
      closeMenu()
      return
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()

      if (!isOpen) {
        openMenu()
        return
      }

      const highlightedOption = options[highlightedIndex]

      if (highlightedOption) {
        handleSelect(highlightedOption.value)
      }
    }
  }

  const activeOptionId =
    isOpen && options[highlightedIndex]
      ? `${listboxId}-option-${highlightedIndex}`
      : undefined

  return (
    <div
      className={`select-menu-container ${className}`.trim()}
      ref={containerRef}
    >
      <button
        type="button"
        id={triggerId}
        className="select-menu-trigger"
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={isOpen ? listboxId : undefined}
        aria-activedescendant={activeOptionId}
        aria-invalid={ariaInvalid}
        disabled={disabled}
      >
        <span
          className={
            selectedOption
              ? 'select-menu-value'
              : 'select-menu-value select-menu-placeholder'
          }
        >
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
          aria-hidden="true"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {isOpen && !disabled ? (
        <ul
          id={listboxId}
          className="select-menu-dropdown"
          role="listbox"
          aria-labelledby={triggerId}
        >
          {options.length === 0 ? (
            <li
              className="select-menu-item select-menu-item--empty"
              aria-disabled="true"
            >
              No options available
            </li>
          ) : (
            options.map((option, index) => {
              const isSelected = String(value) === String(option.value)
              const isHighlighted = highlightedIndex === index

              return (
                <li
                  key={option.value}
                  id={`${listboxId}-option-${index}`}
                  ref={(element) => {
                    optionRefs.current[index] = element
                  }}
                  role="option"
                  aria-selected={isSelected}
                  className={
                    [
                      'select-menu-item',
                      isSelected ? 'select-menu-item--selected' : '',
                      isHighlighted ? 'select-menu-item--highlighted' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')
                  }
                  onMouseEnter={() => setHighlightedIndex(index)}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => handleSelect(option.value)}
                >
                  {option.label}
                </li>
              )
            })
          )}
        </ul>
      ) : null}
    </div>
  )
}
