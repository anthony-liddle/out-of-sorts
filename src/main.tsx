import { createRoot } from 'react-dom/client'
import { App } from './ui/App'
import { browserServices } from './ui/services'
import { initAnalytics } from './analytics'

void initAnalytics()

createRoot(document.getElementById('root')!).render(
  <App services={browserServices()} />,
)
