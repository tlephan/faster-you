/// <reference types="vite/client" />

declare const __APP_VERSION__: string;

interface Window {
  Neutralino: any;
  NL_PORT: number;
  NL_TOKEN: string;
  NL_ARGS: string[];
}
