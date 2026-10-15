import '@fontsource-variable/geist/wght.css';
import '@fontsource-variable/geist-mono/wght.css';
import '../shared/tokens.css';
import '../shared/logo.css';
import './styles.css';
import { render } from 'preact';
import { App } from './App';
import { setTransport } from './api';
import { httpTransport } from './transport-http';

// The browser page: HTTP to the extension on 127.0.0.1. The view inside the conversation is
// ../views/dashboard.tsx, whose theme follows Claude's; this page follows the computer's.
const dark = matchMedia('(prefers-color-scheme: dark)');
const theme = () => (document.documentElement.dataset.theme = dark.matches ? 'dark' : 'light');
theme();
dark.addEventListener('change', theme);

setTransport(httpTransport());
render(<App />, document.getElementById('app')!);
