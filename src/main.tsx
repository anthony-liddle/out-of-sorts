import '@fontsource/baloo-2/500.css'
import '@fontsource/baloo-2/700.css'
import '@fontsource/nunito/400.css'
import '@fontsource/nunito/600.css'
import '@fontsource/nunito/700.css'
import { createRoot } from 'react-dom/client'
import { App } from './ui/App'
import { browserServices } from './ui/services'
import { initAnalytics } from './analytics'

void initAnalytics()

createRoot(document.getElementById('root')!).render(
  <App services={browserServices()} />,
)
