/// <reference types="vite/client" />

declare module '*.css';

type CSSModule = { readonly [className: string]: string };

declare module '*.module.css' {
  const classes: CSSModule;
  export default classes;
}

interface ImportMetaEnv {
  readonly VITE_SERVER_URL?: string
  // add more env variables here as needed
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
