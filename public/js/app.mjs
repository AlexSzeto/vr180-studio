// Main application entry point for VR180 Studio.
import { render } from 'preact'
import { html } from 'htm/preact'
import { useEffect, useState } from 'preact/hooks'
import { Page } from './custom-ui/layout/page.mjs'
import { Panel } from './custom-ui/layout/panel.mjs'
import { Caption, H1, VerticalLayout } from './custom-ui/themed-base.mjs'
import { currentTheme } from './custom-ui/theme.mjs'

/**
 * Root application component.
 *
 * Subscribes to `currentTheme` so the whole tree re-renders on a theme switch,
 * per the project's theming convention.
 */
function App() {
  const [, setTheme] = useState(currentTheme.value)
  useEffect(() => currentTheme.subscribe(setTheme), [])

  return html`
    <${Page}>
      <${Panel} padding="large">
        <${VerticalLayout}>
          <${H1}>VR180 Studio<//>
          <${Caption}
            >Project scaffold — features arrive through the kanban board.<//
          >
        <//>
      <//>
    <//>
  `
}

render(html`<${App} />`, document.getElementById('app'))
