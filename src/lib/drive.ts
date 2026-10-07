// Google Drive integration — same GIS pattern as business-architect.
// drive.file scope: the app only sees files it created. Token lives in
// memory only; only the *intent* to stay connected persists to localStorage.

const CLIENT_ID = (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID as string | undefined;
const SCOPE = 'https://www.googleapis.com/auth/drive.file';
const INTENT_KEY = 'margin-master:drive-intent';
const FOLDER_NAME = 'Margin Master';

declare global {
  interface Window {
    google?: any;
  }
}

let accessToken: string | null = null;
let tokenClient: any = null;
let accountEmail: string | null = null;

export function isConfigured(): boolean {
  return !!CLIENT_ID;
}

export function wantsReconnect(): boolean {
  try {
    return localStorage.getItem(INTENT_KEY) === '1';
  } catch {
    return false;
  }
}

export function getAccountEmail(): string | null {
  return accountEmail;
}

function loadGis(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Failed to load Google sign-in'));
    document.head.appendChild(s);
  });
}

export async function connect(): Promise<string> {
  if (!CLIENT_ID) throw new Error('Google Client ID is not configured');
  await loadGis();
  return new Promise((resolve, reject) => {
    tokenClient =
      tokenClient ||
      window.google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPE,
        callback: async (resp: any) => {
          if (resp?.access_token) {
            accessToken = resp.access_token;
            const token: string = resp.access_token;
            try {
              localStorage.setItem(INTENT_KEY, '1');
            } catch {}
            accountEmail = await fetchAccountEmail().catch(() => null);
            resolve(token);
          } else {
            reject(new Error(resp?.error || 'Sign-in was cancelled'));
          }
        },
      });
    tokenClient.requestAccessToken({ prompt: '' });
  });
}

export function disconnect(): void {
  if (accessToken && window.google?.accounts?.oauth2) {
    try {
      window.google.accounts.oauth2.revoke(accessToken, () => {});
    } catch {}
  }
  accessToken = null;
  accountEmail = null;
  try {
    localStorage.removeItem(INTENT_KEY);
  } catch {}
}

export function isConnected(): boolean {
  return !!accessToken;
}

async function fetchAccountEmail(): Promise<string | null> {
  if (!accessToken) return null;
  const r = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!r.ok) return null;
  const j = await r.json();
  return j.email ?? null;
}

async function driveFetch(path: string, init: RequestInit = {}): Promise<Response> {
  if (!accessToken) throw new Error('Not connected to Google Drive');
  const r = await fetch(`https://www.googleapis.com${path}`, {
    ...init,
    headers: { ...(init.headers || {}), Authorization: `Bearer ${accessToken}` },
  });
  if (r.status === 401) {
    // Token expired — user needs to reconnect (GIS token flow has no silent refresh)
    accessToken = null;
    throw new Error('Google session expired — please reconnect Google Drive');
  }
  return r;
}

async function findOrCreateFolder(): Promise<string> {
  const q = encodeURIComponent(
    `mimeType='application/vnd.google-apps.folder' and name='${FOLDER_NAME}' and trashed=false`
  );
  const list = await driveFetch(`/drive/v3/files?q=${q}&fields=files(id,name)`);
  const j = await list.json();
  if (j.files?.length) return j.files[0].id;
  const created = await driveFetch('/drive/v3/files?fields=id', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' }),
  });
  const cj = await created.json();
  return cj.id;
}

/** Upload a binary Blob (e.g. a .docx) into the Margin Master folder. Returns the file id. */
export async function uploadBlobFile(filename: string, blob: Blob, mimeType: string): Promise<string> {
  const folderId = await findOrCreateFolder();
  const boundary = 'marginmaster' + Date.now().toString(36);
  const metadata = JSON.stringify({ name: filename, parents: [folderId], mimeType });
  const metaPart = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`;
  const metaBytes = new TextEncoder().encode(metaPart);
  const headerBytes = new TextEncoder().encode(`--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`);
  const footerBytes = new TextEncoder().encode(`\r\n--${boundary}--`);
  const bodyBlob = new Blob([metaBytes, headerBytes, blob, footerBytes]);
  const r = await driveFetch('/upload/drive/v3/files?uploadType=multipart&fields=id,name', {
    method: 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body: bodyBlob,
  });
  if (!r.ok) throw new Error(`Drive upload failed (${r.status})`);
  const j = await r.json();
  return j.id;
}

/** Upload a text/JSON/CSV file into the Margin Master folder. Returns the file id. */
export async function uploadTextFile(filename: string, text: string, mimeType: string): Promise<string> {
  const folderId = await findOrCreateFolder();
  const boundary = 'marginmaster' + Date.now().toString(36);
  const metadata = JSON.stringify({ name: filename, parents: [folderId], mimeType });
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
    `--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n${text}\r\n` +
    `--${boundary}--`;
  const r = await driveFetch('/upload/drive/v3/files?uploadType=multipart&fields=id,name', {
    method: 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
    body,
  });
  if (!r.ok) throw new Error(`Drive upload failed (${r.status})`);
  const j = await r.json();
  return j.id;
}
