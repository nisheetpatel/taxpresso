// MCP Apps view shown inline with open_dashboard where the host supports it (spike S3 check).
// It reads only the tool result the host hands it and asks the host to open the link.
import { App, applyDocumentTheme } from '@modelcontextprotocol/ext-apps';
import { wordmark } from '../shared/logo';

const strings = {
  en: {
    title: 'Your dashboard is ready',
    lead: 'Tax year {year} · Geneva. It runs on this computer only, while Claude Desktop is open.',
    open: 'Open dashboard',
    fallback: 'If nothing opens, copy this link into a browser on this computer:',
  },
  fr: {
    title: 'Votre tableau de bord est prêt',
    lead: 'Année fiscale {year} · Genève. Il fonctionne uniquement sur cet ordinateur, tant que Claude Desktop est ouvert.',
    open: 'Ouvrir le tableau de bord',
    fallback: "Si rien ne s'ouvre, copiez ce lien dans un navigateur de cet ordinateur :",
  },
};

interface Result {
  url: string;
  status: { taxYear: number; uiLanguage: keyof typeof strings };
}

const $ = (id: string) => document.getElementById(id)!;
$('mark').innerHTML = wordmark(true);
const app = new App({ name: 'Taxpresso dashboard card', version: '0.0.1' });

app.ontoolresult = ({ structuredContent }) => {
  const result = structuredContent as Result | undefined;
  if (!result?.url) return;
  const lang = result.status.uiLanguage in strings ? result.status.uiLanguage : 'en';
  const s = strings[lang];
  document.documentElement.lang = lang;
  $('title').textContent = s.title;
  $('lead').textContent = s.lead.replace('{year}', String(result.status.taxYear));
  const showFallback = () => {
    $('fallback').textContent = s.fallback;
    $('url').textContent = result.url;
    $('fallback').hidden = false;
    $('url').hidden = false;
  };
  const open = $('open') as HTMLButtonElement;
  open.textContent = s.open;
  open.disabled = false;
  open.onclick = async () => {
    const { isError } = await app.openLink({ url: result.url });
    if (isError) showFallback();
  };
};

app.onhostcontextchanged = (ctx) => {
  if (ctx.theme) applyDocumentTheme(ctx.theme);
};

await app.connect();
const theme = app.getHostContext()?.theme;
if (theme) applyDocumentTheme(theme);
