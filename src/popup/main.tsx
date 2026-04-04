import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import App from '../modal/App';
import Settings from './Settings';
import './styles.css';

function Root() {
  const [view, setView] = useState<'app' | 'settings'>('app');

  if (view === 'settings') {
    return <Settings onBack={() => setView('app')} />;
  }

  return <App onShowSettings={() => setView('settings')} />;
}

const root = createRoot(document.getElementById('root')!);
root.render(<Root />);
