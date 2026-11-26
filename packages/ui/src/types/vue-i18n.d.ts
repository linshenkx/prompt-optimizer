import 'vue-i18n'

type MessageSchema = typeof import('../i18n/locales/en-US').default

declare module 'vue-i18n' {
  export interface DefineLocaleMessage extends MessageSchema {}
  export function useI18n(): {
    t: (key: string, ...args: unknown[]) => string;
    locale: import('vue').Ref<string>;
  }
} 
