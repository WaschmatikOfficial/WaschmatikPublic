import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('WASCHMATIK: #root wurde nicht gefunden.');

createRoot(root).render(<App />);
