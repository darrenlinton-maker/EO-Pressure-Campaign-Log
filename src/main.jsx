import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

const style = document.createElement('style');
style.textContent = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
  body {
    font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
    background: #f8fafc;
    color: #1e293b;
    min-height: 100vh;
  }
  @media (max-width: 640px) {
    .form-grid-responsive { grid-template-columns: 1fr !important; }
    .dash-grid-responsive { grid-template-columns: 1fr !important; }
    .stat-row-responsive { flex-wrap: wrap; }
    .stat-row-responsive > div { flex: 1 1 45% !important; }
  }
  ::selection { background: #1e293b; color: #fff; }
  input:focus, select:focus, textarea:focus {
    outline: none;
    border-color: #1e293b !important;
    box-shadow: 0 0 0 2px rgba(30,41,59,0.1);
  }
  button:hover { opacity: 0.9; }
  button:active { transform: scale(0.98); }
  pre { margin: 0; }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes slideUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
  .toast-anim { animation: fadeIn 0.2s ease; }
  .card-anim { animation: slideUp 0.25s ease; }
`;
document.head.appendChild(style);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
