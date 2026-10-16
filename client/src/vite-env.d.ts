/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_API_PROXY_TARGET?: string;
  readonly VITE_CONNECTYCUBE_APP_ID?: string;
  readonly VITE_CONNECTYCUBE_AUTH_KEY?: string;
  readonly VITE_CONNECTYCUBE_AUTH_SECRET?: string;
  readonly VITE_CONNECTYCUBE_LOGIN_PREFIX?: string;
  readonly VITE_CONNECTYCUBE_USER_PASSWORD?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
