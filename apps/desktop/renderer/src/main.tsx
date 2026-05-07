import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles/global.css'
import './styles/themes.css'

const container = document.getElementById('root')
if (!container) throw new Error('#root not found')

createRoot(container).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
