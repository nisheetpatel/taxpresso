import '@fontsource-variable/geist/wght.css';
import '@fontsource-variable/geist-mono/wght.css';
import '../shared/tokens.css';
import '../shared/logo.css';
import './styles.css';
import { render } from 'preact';
import { App } from './App';

render(<App />, document.getElementById('app')!);
