function PasswordVisibilityIcon({ isVisible }) {
  if (isVisible) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M4 4l16 16M9.9 9.9A3 3 0 0012 15a2.99 2.99 0 002.1-.9M6.7 6.7C4.5 8.2 3 10.3 2 12c2.2 3.9 5.8 6 10 6 1.9 0 3.6-.4 5.1-1.2m1.9-1.5c1.3-1 2.3-2.2 3-3.3-2.2-3.9-5.8-6-10-6-.8 0-1.5.1-2.2.2"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M2 12c2.2-3.9 5.8-6 10-6s7.8 2.1 10 6c-2.2 3.9-5.8 6-10 6S4.2 15.9 2 12z"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
      <circle
        cx="12"
        cy="12"
        r="3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  )
}

export default PasswordVisibilityIcon
