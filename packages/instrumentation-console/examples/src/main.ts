import './styles.css';

import { setupConsoleDemo } from './console.ts';

const appElement = document.querySelector<HTMLDivElement>('#app');
if (appElement) {
  appElement.innerHTML = `
    <div>
      <h1>Console Instrumentation Demo</h1>
      <div id="console-demo"></div>
    </div>
  `;

  const demosElement = document.querySelector<HTMLDivElement>('#console-demo');
  if (demosElement) {
    setupConsoleDemo(demosElement);
  }
}
