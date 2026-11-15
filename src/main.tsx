import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import {initPreloader} from './preloader.ts';

initPreloader();
createRoot(document.getElementById('root')!).render(<App />);
