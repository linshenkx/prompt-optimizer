import { shallowRef, type App } from "vue";
import { createI18n } from "vue-i18n";

import zhCN from "../i18n/locales/zh-CN";
import zhTW from "../i18n/locales/zh-TW";
import enUS from "../i18n/locales/en-US";
import {
  getPreference,
  setPreference,
} from '../composables/storage/usePreferenceManager';
import { UI_SETTINGS_KEYS } from "@prompt-optimizer/core";
import type { AppServices } from "../types/services";

// 定义支持的语言类型
type SupportedLocale = "zh-CN" | "zh-TW" | "en-US";
const SUPPORTED_LOCALES: SupportedLocale[] = ["zh-CN", "zh-TW", "en-US"];

// 服务引用
const servicesRef = shallowRef<AppServices | null>(null);

// 设置服务引用的函数
export function setI18nServices(services: AppServices) {
  servicesRef.value = services;
}

// 创建i18n实例
const i18n = createI18n({
  legacy: false,
  locale: "zh-CN" as SupportedLocale,
  fallbackLocale: {
    "zh-TW": ["zh-CN", "en-US"],
    "zh-CN": ["en-US"],
    default: ["en-US"],
  },
  messages: {
    "zh-CN": zhCN,
    "zh-TW": zhTW,
    "en-US": enUS,
  },
});

// 初始化语言设置
async function initializeLanguage() {
  try {
    if (!servicesRef.value) {
      console.warn("初始化语言设置时服务不可用，使用默认语言");
      return;
    }

    const defaultLocale: SupportedLocale = navigator.language.startsWith("zh")
      ? navigator.language === "zh-TW" ||
        navigator.language === "zh-HK" ||
        navigator.language.includes("Hant")
        ? "zh-TW"
        : "zh-CN"
      : "en-US";
    const savedLanguage = await getPreference(
      servicesRef,
      UI_SETTINGS_KEYS.PREFERRED_LANGUAGE,
      defaultLocale,
    );

    if (SUPPORTED_LOCALES.includes(savedLanguage as SupportedLocale)) {
      i18n.global.locale.value = savedLanguage as SupportedLocale;
    } else {
      i18n.global.locale.value = defaultLocale;
      await setPreference(
        servicesRef,
        UI_SETTINGS_KEYS.PREFERRED_LANGUAGE,
        defaultLocale,
      );
    }
  } catch (error) {
    console.error("初始化语言设置失败:", error);
    // 降级到默认语言
    i18n.global.locale.value = "zh-CN";
  }
}

// 导出插件安装函数
export function installI18n(app: App) {
  initializeLanguage(); // 异步初始化，不阻塞应用启动
  app.use(i18n);
}

// 导出延迟初始化函数 - 用于Extension等需要等待服务初始化的场景
export async function initializeI18nWithStorage() {
  await initializeLanguage();
}

// 导出基础安装函数 - 只安装插件，不初始化语言
export function installI18nOnly(app: App) {
  app.use(i18n);
}

// 导出i18n实例
export { i18n };
