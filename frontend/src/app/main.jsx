import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { AuthProvider } from './providers/AuthProvider'
import { runStep8To11DemoResetOnce } from '../shared/utils/storage'
import '../shared/styles/global.css'

runStep8To11DemoResetOnce()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
)
