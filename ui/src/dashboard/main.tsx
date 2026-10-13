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
// ../views/dashboard.tsx.
setTransport(httpTransport());
render(<App />, document.getElementById('app')!);
