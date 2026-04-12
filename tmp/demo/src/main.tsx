import '../../../web/app/node_modules/antd/dist/reset.css';

import { createRoot } from 'react-dom/client';

import { App } from './app/App';
import './styles/global.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('root element not found');
}

createRoot(rootElement).render(<App />);
