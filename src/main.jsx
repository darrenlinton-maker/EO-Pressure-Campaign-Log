import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

const style = document.createElement('style');
style.textContent = `
  @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&family=Source+Sans+3:wght@400;500;600;700&display=swap');

  :root {
    /* Primary */
    --nats-green:           #1B8838;
    --nats-green-dark:      #14652A;
    --nats-green-darker:    #0E4A1E;
    --nats-gold:            #FFD200;
    --nats-gold-dark:       #E0B800;

    /* Neutrals */
    --nats-white:           #FFFFFF;
    --nats-off-white:       #F7F8F6;
    --nats-grey-100:        #EAECE8;
    --nats-grey-200:        #CDD1CA;
    --nats-grey-500:        #6B7266;
    --nats-grey-800:        #2C3029;
    --nats-black:           #1A1D18;

    /* Semantic */
    --nats-error:           #C23934;
    --nats-error-bg:        #FDE8E8;
    --nats-success:         #1B8838;
    --nats-success-bg:      #E6F4EA;
    --nats-warning:         #E0A100;
    --nats-warning-bg:      #FFF8E1;
    --nats-info:            #1A73A7;
    --nats-info-bg:         #E3F2FD;

    /* Surfaces */
    --surface-primary:      var(--nats-white);
    --surface-secondary:    var(--nats-off-white);

    /* Shadows */
    --shadow-sm:  0 1px 2px rgba(26, 29, 24, 0.06);
    --shadow-md:  0 4px 12px rgba(26, 29, 24, 0.08);
    --shadow-lg:  0 8px 24px rgba(26, 29, 24, 0.12);

    /* Radius */
    --radius-sm:  4px;
    --radius-md:  8px;
    --radius-lg:  12px;
    --radius-full: 9999px;

    /* Typography */
    --font-heading: 'Montserrat', 'Helvetica Neue', Arial, sans-serif;
    --font-body:    'Source Sans 3', 'Helvetica Neue', Arial, sans-serif;

    /* Spacing (4px base) */
    --space-1:  0.25rem;
    --space-2:  0.5rem;
    --space-3:  0.75rem;
    --space-4:  1rem;
    --space-5:  1.25rem;
    --space-6:  1.5rem;
    --space-8:  2rem;
    --space-10: 2.5rem;
    --space-12: 3rem;
  }

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
  body {
    font-family: var(--font-body);
    background: var(--surface-secondary);
    color: var(--nats-grey-800);
    min-height: 100vh;
  }
  h1, h2, h3, h4, h5, h6 {
    font-family: var(--font-heading);
    color: var(--nats-black);
  }
  @media (max-width: 640px) {
    .form-grid-responsive { grid-template-columns: 1fr !important; }
    .dash-grid-responsive { grid-template-columns: 1fr !important; }
    .stat-row-responsive { flex-wrap: wrap; }
    .stat-row-responsive > div { flex: 1 1 45% !important; }
  }
  ::selection { background: var(--nats-green); color: var(--nats-white); }
  input:focus, select:focus, textarea:focus {
    outline: none;
    border-color: var(--nats-green) !important;
    box-shadow: 0 0 0 3px rgba(27, 136, 56, 0.15);
  }
  button { transition: all 150ms ease; }
  button:hover { opacity: 0.92; }
  button:active { transform: scale(0.98); }
  button:focus-visible {
    outline: 3px solid var(--nats-gold);
    outline-offset: 2px;
  }
  pre { margin: 0; }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes slideUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
  .toast-anim { animation: fadeIn 0.2s ease; }
  .card-anim { animation: slideUp 0.25s ease; }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      transition-duration: 0.01ms !important;
    }
  }
`;
document.head.appendChild(style);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
