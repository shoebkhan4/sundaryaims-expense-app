/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Application (client) ID of the Azure app registration in the aimsgt.com
   * tenant. Without it the app cannot sign in to the company mailbox, and
   * sending falls back to the phone's mail app — which uses whatever account
   * that app defaults to.
   */
  readonly VITE_MS_CLIENT_ID?: string;
  /** Directory (tenant) ID. Defaults to work and school accounts only. */
  readonly VITE_MS_TENANT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
