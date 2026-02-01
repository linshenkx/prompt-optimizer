// Naive UI 主题配置 - 全面基于 Naive UI 的 themeOverrides 系统
import { computed, ref, watch } from 'vue'

import { darkTheme, lightTheme, type GlobalThemeOverrides, type GlobalTheme } from 'naive-ui'
import { pinia } from '../plugins/pinia'
import { useGlobalSettings } from '../stores/settings/useGlobalSettings'

// 当前主题ID
export const currentThemeId = ref<string>('light')

// 主题类型定义
export interface ThemeConfig {
  id: string
  name: string
  naiveTheme: GlobalTheme | null
  themeOverrides: GlobalThemeOverrides
}

// 纯Naive UI主题配置 - 完全消除CSS依赖
export const naiveThemeConfigs: Record<string, ThemeConfig> = {
  light: {
    id: 'light',
    name: '日间模式',
    naiveTheme: lightTheme,
    themeOverrides: {
      common: {
        primaryColor: '#4b5563',
        primaryColorHover: '#3f4854',
        primaryColorPressed: '#374151',
        primaryColorSuppl: '#9ca3af',
        successColor: '#059669',
        successColorHover: '#047857',
        successColorPressed: '#065f46',
        successColorSuppl: '#dcfce7',
        errorColor: '#dc2626',
        errorColorHover: '#b91c1c',
        errorColorPressed: '#991b1b',
        errorColorSuppl: '#fee2e2',
        bodyColor: '#f5f6f8',
        cardColor: '#ffffff',
        modalColor: '#ffffff',
        popoverColor: '#ffffff',
        tableColor: '#f8f9fb',
        hoverColor: 'rgba(79, 89, 102, 0.08)',
        textColorBase: '#1f2933',
        textColor1: '#1f2933',
        textColor2: '#4b5563',
        textColor3: '#6b7280',
        placeholderColor: '#9ca3af',
        borderColor: '#e5e7eb',
        dividerColor: '#eef1f4',
        scrollbarColor: 'rgba(148, 163, 184, 0.35)',
        scrollbarColorHover: 'rgba(107, 114, 128, 0.55)',
        closeIconColor: 'rgba(79, 89, 102, 0.65)',
        closeIconColorHover: '#4b5563',
        closeIconColorPressed: '#374151',
        clearColor: 'rgba(79, 89, 102, 0.2)',
        clearColorHover: 'rgba(79, 89, 102, 0.28)',
        clearColorPressed: 'rgba(79, 89, 102, 0.36)'
      },
      Button: {
        textColorPrimary: '#f9fafb',
        textColorHoverPrimary: '#f9fafb',
        textColorPressedPrimary: '#f9fafb',
        textColorFocusPrimary: '#f9fafb',
        textColorDisabledPrimary: 'rgba(249, 250, 251, 0.55)',
        colorPrimary: '#4b5563',
        colorHoverPrimary: '#3f4854',
        colorPressedPrimary: '#374151',
        colorFocusPrimary: '#4b5563',
        colorDisabledPrimary: '#c4c8ce',
        borderPrimary: '1px solid #4b5563',
        borderHoverPrimary: '1px solid #3f4854',
        borderPressedPrimary: '1px solid #374151',
        borderFocusPrimary: '1px solid #4b5563',
        borderDisabledPrimary: '1px solid #c4c8ce',
        rippleColorPrimary: 'rgba(79, 89, 102, 0.25)',
        textColor: '#4b5563',
        textColorHover: '#374151',
        textColorPressed: '#1f2933',
        color: '#f4f5f7',
        colorHover: '#e7e9ed',
        colorPressed: '#d9dce2',
        border: '1px solid #e5e7eb',
        borderHover: '1px solid #d5d7dc',
        borderPressed: '1px solid #c4c7cd'
      },
      Input: {
        color: '#f7f8fa',
        colorDisabled: '#f1f2f4',
        colorFocus: '#ffffff',
        textColor: '#1f2933',
        textColorDisabled: 'rgba(31, 41, 51, 0.45)',
        placeholderColor: '#9ca3af',
        placeholderColorDisabled: 'rgba(156, 163, 175, 0.6)',
        iconColor: '#9ca3af',
        iconColorHover: '#6b7280',
        iconColorPressed: '#4b5563',
        iconColorDisabled: 'rgba(156, 163, 175, 0.5)',
        clearColor: 'rgba(79, 89, 102, 0.2)',
        clearColorHover: 'rgba(79, 89, 102, 0.3)',
        clearColorPressed: 'rgba(79, 89, 102, 0.4)',
        border: '1px solid #d9dce1',
        borderDisabled: '1px solid rgba(213, 215, 220, 0.6)',
        borderHover: '1px solid #c6cbd2',
        borderFocus: '1px solid #aeb4bd',
        boxShadowFocus: '0 0 0 2px rgba(75, 85, 99, 0.12)',
        caretColor: '#4b5563',
        suffixTextColor: '#6b7280',
        prefixTextColor: '#6b7280'
      },
      Card: {
        color: '#ffffff',
        colorModal: '#ffffff',
        colorTarget: '#ffffff',
        textColor: '#1f2933',
        titleTextColor: '#181f2a',
        borderColor: '#e5e7eb',
        actionColor: '#f4f5f7',
        closeIconColor: '#9ca3af',
        closeIconColorHover: '#6b7280',
        closeIconColorPressed: '#4b5563',
        boxShadow: '0 12px 28px rgba(15, 23, 42, 0.08)'
      },
      Tabs: {
        tabColor: '#f3f4f6',
        tabColorActive: '#e5e7eb',
        tabBorderColor: '#e5e7eb',
        tabTextColorBar: '#6b7280',
        tabTextColorBarHover: '#4b5563',
        tabTextColorBarActive: '#1f2933',
        tabTextColorCard: '#6b7280',
        tabTextColorCardActive: '#1f2933',
        barColor: '#d1d5db'
      },
      Radio: {
        buttonBorderColor: '#e5e7eb',
        buttonBorderColorActive: '#cbd0d6',
        buttonColor: '#f4f5f7',
        buttonColorActive: '#dfe2e7',
        buttonTextColor: '#6b7280',
        buttonTextColorActive: '#1f2933'
      },
      Dropdown: {
        color: '#ffffff',
        optionTextColor: '#4b5563',
        optionTextColorHover: '#1f2933',
        optionTextColorActive: '#1f2933',
        optionColorHover: '#f1f2f5',
        optionColorActive: '#e6e8ec',
        borderColor: '#e5e7eb'
      }
    }
  },

  dark: {
    id: 'dark', 
    name: '夜间模式',
    naiveTheme: darkTheme,
    themeOverrides: {
      common: {
        primaryColor: '#64748b',
        primaryColorHover: '#475569',
        primaryColorPressed: '#334155',
        primaryColorSuppl: '#94a3b8',
        successColor: '#22c55e',
        successColorHover: '#16a34a',
        successColorPressed: '#15803d',
        successColorSuppl: '#22543d',
        errorColor: '#ef4444',
        errorColorHover: '#dc2626',
        errorColorPressed: '#b91c1c',
        errorColorSuppl: '#7f1d1d',
      }
    }
  },

  blue: {
    id: 'blue',
    name: '蓝色模式',
    naiveTheme: lightTheme,
    themeOverrides: {
      common: {
        primaryColor: '#1f6bd1',
        primaryColorHover: '#185cb8',
        primaryColorPressed: '#134c98',
        primaryColorSuppl: '#6caef7',
        bodyColor: '#e4f0ff',
        cardColor: '#f6faff',
        modalColor: '#f6faff',
        popoverColor: '#f6faff',
        tableColor: '#eef5ff',
        inputColor: '#ffffff',
        hoverColor: 'rgba(31, 107, 209, 0.08)',
        actionColor: '#eaf3ff',
        textColorBase: '#0f2f55',
        textColor1: '#0f2f55',
        textColor2: '#1d4d85',
        textColor3: '#4a6c91',
        placeholderColor: '#6f88aa',
        borderColor: '#92bbea',
        dividerColor: '#c6dcf6',
        scrollbarColor: 'rgba(41, 98, 158, 0.35)',
        scrollbarColorHover: 'rgba(24, 76, 126, 0.55)',
        closeIconColor: 'rgba(26, 69, 119, 0.7)',
        closeIconColorHover: '#185cb8',
        closeIconColorPressed: '#134c98',
        clearColor: 'rgba(31, 107, 209, 0.25)',
        clearColorHover: 'rgba(31, 107, 209, 0.35)',
        clearColorPressed: 'rgba(31, 107, 209, 0.45)'
      },
      Button: {
        textColorPrimary: '#ffffff',
        textColorHoverPrimary: '#ffffff',
        textColorPressedPrimary: '#ffffff',
        textColorFocusPrimary: '#ffffff',
        textColorDisabledPrimary: 'rgba(255, 255, 255, 0.6)',
        colorPrimary: '#1f6bd1',
        colorHoverPrimary: '#185cb8',
        colorPressedPrimary: '#134c98',
        colorFocusPrimary: '#1f6bd1',
        colorDisabledPrimary: '#a1c6f1',
        borderPrimary: '1px solid #1f6bd1',
        borderHoverPrimary: '1px solid #185cb8',
        borderPressedPrimary: '1px solid #134c98',
        borderFocusPrimary: '1px solid #1f6bd1',
        borderDisabledPrimary: '1px solid #a1c6f1',
        rippleColorPrimary: 'rgba(31, 107, 209, 0.25)',
        textColor: '#1d4d85',
        textColorHover: '#16406f',
        textColorPressed: '#0f2f55',
        color: '#eaf3ff',
        colorHover: '#deebff',
        colorPressed: '#cfe1ff',
        border: '1px solid #c0d8f6',
        borderHover: '1px solid #aaccf2',
        borderPressed: '1px solid #97bfec'
      },
      Input: {
        color: '#ffffff',
        colorDisabled: '#f0f5fb',
        colorFocus: '#ffffff',
        textColor: '#0f2f55',
        textColorDisabled: 'rgba(15, 47, 85, 0.45)',
        placeholderColor: '#6f88aa',
        placeholderColorDisabled: 'rgba(111, 136, 170, 0.6)',
        iconColor: '#6f88aa',
        iconColorHover: '#2c5e9b',
        iconColorPressed: '#214a7d',
        iconColorDisabled: 'rgba(111, 136, 170, 0.5)',
        clearColor: 'rgba(31, 107, 209, 0.25)',
        clearColorHover: 'rgba(31, 107, 209, 0.35)',
        clearColorPressed: 'rgba(31, 107, 209, 0.45)',
        border: '1px solid #b2cef2',
        borderDisabled: '1px solid rgba(178, 206, 242, 0.6)',
        borderHover: '1px solid #9ac0ec',
        borderFocus: '1px solid #78ace4',
        boxShadowFocus: '0 0 0 2px rgba(31, 107, 209, 0.2)',
        caretColor: '#1f6bd1',
        suffixTextColor: '#4a6c91',
        prefixTextColor: '#4a6c91'
      },
      Card: {
        color: '#f6faff',
        colorModal: '#f6faff',
        colorTarget: '#f6faff',
        textColor: '#0f2f55',
        titleTextColor: '#0c2443',
        borderColor: '#b2cef2',
        actionColor: '#e3efff',
        closeIconColor: '#6f88aa',
        closeIconColorHover: '#2c5e9b',
        closeIconColorPressed: '#214a7d',
        boxShadow: '0 16px 36px rgba(15, 47, 85, 0.12)'
      },
      Tabs: {
        tabColor: '#eaf3ff',
        tabColorActive: '#cfe1ff',
        tabBorderColor: '#b2cef2',
        tabTextColorBar: '#4a6c91',
        tabTextColorBarHover: '#1d4d85',
        tabTextColorBarActive: '#0f2f55',
        tabTextColorCard: '#4a6c91',
        tabTextColorCardActive: '#0f2f55',
        barColor: '#8fb9ec'
      },
      Radio: {
        buttonBorderColor: '#b2cef2',
        buttonBorderColorActive: '#8fb9ec',
        buttonColor: '#eaf3ff',
        buttonColorActive: '#d2e5ff',
        buttonTextColor: '#4a6c91',
        buttonTextColorActive: '#0f2f55'
      },
      Dropdown: {
        color: '#ffffff',
        optionTextColor: '#1d4d85',
        optionTextColorHover: '#0f2f55',
        optionTextColorActive: '#0f2f55',
        optionColorHover: '#e1efff',
        optionColorActive: '#cfe1ff',
        borderColor: '#b2cef2'
      }
    }
  },

  classic: {
    id: 'classic',
    name: '米杏模式',
    naiveTheme: lightTheme,
    themeOverrides: {
      common: {
        primaryColor: '#7b6a58',
        primaryColorHover: '#6a5a4a',
        primaryColorPressed: '#594a3d',
        primaryColorSuppl: '#d7ccbc',
        successColor: '#059669',
        successColorHover: '#047857',
        successColorPressed: '#065f46',
        successColorSuppl: '#dcfce7',
        errorColor: '#dc2626',
        errorColorHover: '#b91c1c',
        errorColorPressed: '#991b1b',
        errorColorSuppl: '#fee2e2',
        bodyColor: '#f5f2ec',
        cardColor: '#fefcf8',
        modalColor: '#f9f5ef',
        popoverColor: '#fefcf8',
        tableColor: '#f7f1e8',
        inputColor: '#f8f4ee',
        hoverColor: 'rgba(123, 106, 88, 0.08)',
        textColorBase: '#403830',
        textColor1: '#403830',
        textColor2: '#6a6156',
        textColor3: '#968d82',
        placeholderColor: '#b0a79c',
        borderColor: '#e3d7c7',
        dividerColor: '#ede3d6',
        scrollbarColor: 'rgba(141, 126, 110, 0.4)',
        scrollbarColorHover: 'rgba(123, 106, 88, 0.55)',
        closeIconColor: 'rgba(103, 92, 80, 0.7)',
        closeIconColorHover: '#675c50',
        closeIconColorPressed: '#51473d',
        clearColor: 'rgba(123, 106, 88, 0.2)',
        clearColorHover: 'rgba(123, 106, 88, 0.3)',
        clearColorPressed: 'rgba(123, 106, 88, 0.4)',
        boxShadow1: '0 6px 20px rgba(87, 69, 55, 0.08)',
        boxShadow2: '0 12px 32px rgba(87, 69, 55, 0.12)'
      },
      Button: {
        textColorPrimary: '#3f382f',
        textColorHoverPrimary: '#3f382f',
        textColorPressedPrimary: '#3f382f',
        textColorFocusPrimary: '#3f382f',
        textColorDisabledPrimary: 'rgba(63, 56, 47, 0.4)',
        colorPrimary: '#d7ccbc',
        colorHoverPrimary: '#cabfaa',
        colorPressedPrimary: '#beb29a',
        colorFocusPrimary: '#d7ccbc',
        colorDisabledPrimary: '#e5dbcf',
        borderPrimary: '1px solid #cabfaa',
        borderHoverPrimary: '1px solid #b9ac96',
        borderPressedPrimary: '1px solid #a59782',
        borderFocusPrimary: '1px solid #cabfaa',
        borderDisabledPrimary: '1px solid #e2d6c7',
        rippleColorPrimary: 'rgba(123, 106, 88, 0.35)',
        textColor: '#4c443c',
        textColorHover: '#3f382f',
        textColorPressed: '#3f382f',
        color: '#f6f1ea',
        colorHover: '#ede3d6',
        colorPressed: '#e1d6c7',
        border: '1px solid #e3d7c7',
        borderHover: '1px solid #d8ccba',
        borderPressed: '1px solid #cbbca5'
      },
      Input: {
        color: '#f8f4ee',
        colorDisabled: '#f3ede5',
        colorFocus: '#fefbf7',
        textColor: '#403830',
        textColorDisabled: 'rgba(64, 56, 48, 0.45)',
        placeholderColor: '#b0a79c',
        placeholderColorDisabled: 'rgba(176, 167, 156, 0.6)',
        iconColor: '#a29688',
        iconColorHover: '#877b6d',
        iconColorPressed: '#6e6256',
        iconColorDisabled: 'rgba(162, 150, 136, 0.5)',
        clearColor: 'rgba(123, 106, 88, 0.2)',
        clearColorHover: 'rgba(123, 106, 88, 0.32)',
        clearColorPressed: 'rgba(123, 106, 88, 0.45)',
        border: '1px solid #d8cdbd',
        borderDisabled: '1px solid rgba(216, 205, 189, 0.6)',
        borderHover: '1px solid #cbbfae',
        borderFocus: '1px solid #bfae99',
        boxShadowFocus: '0 0 0 2px rgba(123, 106, 88, 0.16)',
        caretColor: '#7b6a58',
        suffixTextColor: '#8a7c6c',
        prefixTextColor: '#8a7c6c'
      },
      Card: {
        color: '#fefcf8',
        colorModal: '#fefcf8',
        colorTarget: '#fefcf8',
        textColor: '#403830',
        titleTextColor: '#3a332b',
        borderColor: '#e3d7c7',
        actionColor: '#f3eadf',
        closeIconColor: '#8f8376',
        closeIconColorHover: '#6e6256',
        closeIconColorPressed: '#5a4f45',
        boxShadow: '0 12px 32px rgba(87, 69, 55, 0.12)'
      },
      Tabs: {
        tabColor: '#f1ece4',
        tabColorActive: '#e4d8c8',
        tabBorderColor: '#e3d7c7',
        tabTextColorBar: '#6a6156',
        tabTextColorBarHover: '#4d453c',
        tabTextColorBarActive: '#4d453c',
        tabTextColorCard: '#6a6156',
        tabTextColorCardActive: '#3f382f',
        barColor: '#d2c5b5'
      },
      Radio: {
        buttonBorderColor: '#e3d7c7',
        buttonBorderColorActive: '#cabfaa',
        buttonColor: '#f6f1ea',
        buttonColorActive: '#d7ccbc',
        buttonTextColor: '#6a6156',
        buttonTextColorActive: '#3f382f'
      },
      Dropdown: {
        color: '#fefcf8',
        optionTextColor: '#4c443c',
        optionTextColorHover: '#3f382f',
        optionTextColorActive: '#3f382f',
        optionColorHover: '#ede3d6',
        optionColorActive: '#e1d6c7',
        borderColor: '#e3d7c7'
      }
    }
  },

  green: {
    id: 'green',
    name: '绿色模式',
    naiveTheme: darkTheme,
    themeOverrides: {
      common: {
        primaryColor: '#1fb598',
        primaryColorHover: '#1aa184',
        primaryColorPressed: '#16846c',
        primaryColorSuppl: '#57e4c8',
        bodyColor: '#0f342b',
        cardColor: '#174737',
        modalColor: '#174737',
        popoverColor: '#174737',
        tableColor: '#1b4f3d',
        tableHeaderColor: '#1f5f49',
        inputColor: '#1d5240',
        codeColor: '#1f5f49',
        tabColor: '#1f5f49',
        actionColor: '#1f5f49',
        textColorBase: '#e9fbf4',
        textColor1: 'rgba(233, 251, 244, 0.96)',
        textColor2: 'rgba(233, 251, 244, 0.82)',
        textColor3: 'rgba(233, 251, 244, 0.6)',
        textColorDisabled: 'rgba(233, 251, 244, 0.4)',
        placeholderColor: 'rgba(197, 239, 224, 0.7)',
        placeholderColorDisabled: 'rgba(197, 239, 224, 0.45)',
        iconColor: 'rgba(207, 246, 232, 0.75)',
        iconColorHover: 'rgba(207, 246, 232, 0.88)',
        iconColorPressed: '#e9fbf4',
        iconColorDisabled: 'rgba(207, 246, 232, 0.45)',
        borderColor: 'rgba(47, 128, 109, 0.45)',
        dividerColor: 'rgba(47, 128, 109, 0.25)',
        scrollbarColor: 'rgba(38, 108, 92, 0.35)',
        scrollbarColorHover: 'rgba(38, 108, 92, 0.55)',
        closeIconColor: 'rgba(207, 246, 232, 0.7)',
        closeIconColorHover: 'rgba(207, 246, 232, 0.88)',
        closeIconColorPressed: '#e9fbf4',
        clearColor: 'rgba(233, 251, 244, 0.6)',
        clearColorHover: 'rgba(233, 251, 244, 0.75)',
        clearColorPressed: 'rgba(233, 251, 244, 0.9)',
        successColor: '#3dd68c',
        successColorHover: '#2fb973',
        successColorPressed: '#258f59',
        successColorSuppl: '#174f3b',
        errorColor: '#ff6b6b',
        errorColorHover: '#f05252',
        errorColorPressed: '#c73f3f',
        errorColorSuppl: '#4d2020'
      },
      Button: {
        textColorPrimary: '#0f342b',
        textColorHoverPrimary: '#0b271f',
        textColorPressedPrimary: '#092017',
        textColorFocusPrimary: '#0f342b',
        textColorDisabledPrimary: 'rgba(15, 52, 43, 0.82)',
        colorPrimary: '#57e4c8',
        colorHoverPrimary: '#3fd2b4',
        colorPressedPrimary: '#2eb39a',
        colorFocusPrimary: '#57e4c8',
        colorDisabledPrimary: '#459f8d',
        borderPrimary: '1px solid #3fd2b4',
        borderHoverPrimary: '1px solid #2eb39a',
        borderPressedPrimary: '1px solid #258f76',
        borderFocusPrimary: '1px solid #3fd2b4',
        borderDisabledPrimary: '1px solid rgba(63, 210, 180, 0.35)',
        rippleColorPrimary: 'rgba(63, 210, 180, 0.35)',
        textColor: 'rgba(233, 251, 244, 0.88)',
        textColorHover: '#e9fbf4',
        textColorPressed: '#c5efe0',
        color: '#194638',
        colorHover: '#1e5443',
        colorPressed: '#184638',
        border: '1px solid rgba(63, 210, 180, 0.28)',
        borderHover: '1px solid rgba(63, 210, 180, 0.4)',
        borderPressed: '1px solid rgba(63, 210, 180, 0.52)'
      },
      Input: {
        color: '#1d5240',
        colorDisabled: '#1a4a3a',
        colorFocus: '#205845',
        textColor: '#e9fbf4',
        textColorDisabled: 'rgba(233, 251, 244, 0.55)',
        placeholderColor: 'rgba(197, 239, 224, 0.7)',
        placeholderColorDisabled: 'rgba(197, 239, 224, 0.45)',
        iconColor: 'rgba(197, 239, 224, 0.75)',
        iconColorHover: '#c5efe0',
        iconColorPressed: '#e9fbf4',
        iconColorDisabled: 'rgba(197, 239, 224, 0.4)',
        clearColor: 'rgba(233, 251, 244, 0.6)',
        clearColorHover: 'rgba(233, 251, 244, 0.75)',
        clearColorPressed: 'rgba(233, 251, 244, 0.9)',
        border: '1px solid rgba(63, 210, 180, 0.32)',
        borderDisabled: '1px solid rgba(63, 210, 180, 0.18)',
        borderHover: '1px solid rgba(63, 210, 180, 0.45)',
        borderFocus: '1px solid #57e4c8',
        boxShadowFocus: '0 0 0 2px rgba(87, 228, 200, 0.16)',
        loadingColor: '#57e4c8',
        suffixTextColor: 'rgba(233, 251, 244, 0.8)',
        prefixTextColor: 'rgba(233, 251, 244, 0.8)'
      },
      Card: {
        color: '#174737',
        colorModal: '#174737',
        colorTarget: '#174737',
        textColor: '#e9fbf4',
        titleTextColor: '#def7ef',
        borderColor: 'rgba(63, 210, 180, 0.28)',
        actionColor: '#205845',
        closeIconColor: 'rgba(233, 251, 244, 0.7)',
        closeIconColorHover: '#c5efe0',
        closeIconColorPressed: '#e9fbf4',
        boxShadow: '0 18px 40px rgba(9, 32, 23, 0.45)'
      },
      Tabs: {
        tabColor: '#1b4f3d',
        tabColorActive: '#20614a',
        tabBorderColor: 'rgba(63, 210, 180, 0.32)',
        tabTextColorBar: 'rgba(233, 251, 244, 0.7)',
        tabTextColorBarHover: '#c5efe0',
        tabTextColorBarActive: '#e9fbf4',
        tabTextColorCard: 'rgba(233, 251, 244, 0.7)',
        tabTextColorCardActive: '#e9fbf4',
        barColor: 'rgba(63, 210, 180, 0.6)'
      },
      Radio: {
        buttonBorderColor: 'rgba(63, 210, 180, 0.32)',
        buttonBorderColorActive: 'rgba(87, 228, 200, 0.6)',
        buttonColor: '#1b4f3d',
        buttonColorActive: '#20614a',
        buttonTextColor: 'rgba(233, 251, 244, 0.7)',
        buttonTextColorActive: '#e9fbf4'
      },
      Dropdown: {
        color: '#174737',
        optionTextColor: '#e9fbf4',
        optionTextColorHover: '#c5efe0',
        optionTextColorActive: '#0f342b',
        optionColorHover: '#1f5f49',
        optionColorActive: '#236b52',
        borderColor: 'rgba(63, 210, 180, 0.32)'
      }
    }
  },

  purple: {
    id: 'purple',
    name: '暗紫模式',
    naiveTheme: darkTheme,
    themeOverrides: {
      common: {
        primaryColor: '#b47bff',
        primaryColorHover: '#a060f7',
        primaryColorPressed: '#8c4edf',
        primaryColorSuppl: '#d6c3ff',
        bodyColor: '#1f1633',
        cardColor: '#2a1f45',
        modalColor: '#2a1f45',
        popoverColor: '#2a1f45',
        tableColor: '#31255a',
        tableHeaderColor: '#3b2d6a',
        inputColor: '#342964',
        codeColor: '#3b2d6a',
        tabColor: '#3b2d6a',
        actionColor: '#3b2d6a',
        textColorBase: '#f5ecff',
        textColor1: 'rgba(245, 236, 255, 0.94)',
        textColor2: 'rgba(245, 236, 255, 0.78)',
        textColor3: 'rgba(245, 236, 255, 0.58)',
        textColorDisabled: 'rgba(245, 236, 255, 0.38)',
        placeholderColor: 'rgba(214, 193, 255, 0.7)',
        placeholderColorDisabled: 'rgba(214, 193, 255, 0.45)',
        iconColor: 'rgba(225, 210, 255, 0.7)',
        iconColorHover: 'rgba(225, 210, 255, 0.85)',
        iconColorPressed: '#f5ecff',
        iconColorDisabled: 'rgba(225, 210, 255, 0.45)',
        borderColor: 'rgba(147, 111, 214, 0.35)',
        dividerColor: 'rgba(147, 111, 214, 0.2)',
        scrollbarColor: 'rgba(127, 85, 194, 0.35)',
        scrollbarColorHover: 'rgba(127, 85, 194, 0.55)',
        closeIconColor: 'rgba(225, 210, 255, 0.7)',
        closeIconColorHover: '#e1d2ff',
        closeIconColorPressed: '#f5ecff',
        clearColor: 'rgba(225, 210, 255, 0.6)',
        clearColorHover: 'rgba(225, 210, 255, 0.75)',
        clearColorPressed: 'rgba(225, 210, 255, 0.9)',
        successColor: '#5be0a2',
        successColorHover: '#41c488',
        successColorPressed: '#329a6a',
        successColorSuppl: '#1c4b35',
        errorColor: '#ff7aa2',
        errorColorHover: '#f25c87',
        errorColorPressed: '#c1426a',
        errorColorSuppl: '#4b1f32'
      },
      Button: {
        textColorPrimary: '#1f1633',
        textColorHoverPrimary: '#1a122c',
        textColorPressedPrimary: '#140d22',
        textColorFocusPrimary: '#1f1633',
        textColorDisabledPrimary: 'rgba(31, 22, 51, 0.82)',
        colorPrimary: '#c9a5ff',
        colorHoverPrimary: '#b98bff',
        colorPressedPrimary: '#a069f3',
        colorFocusPrimary: '#c9a5ff',
        colorDisabledPrimary: '#7056b0',
        borderPrimary: '1px solid #b98bff',
        borderHoverPrimary: '1px solid #a069f3',
        borderPressedPrimary: '1px solid #8a56db',
        borderFocusPrimary: '1px solid #b98bff',
        borderDisabledPrimary: '1px solid rgba(185, 139, 255, 0.35)',
        rippleColorPrimary: 'rgba(185, 139, 255, 0.35)',
        textColor: 'rgba(245, 236, 255, 0.88)',
        textColorHover: '#f5ecff',
        textColorPressed: '#d6c3ff',
        color: '#2d204b',
        colorHover: '#36275a',
        colorPressed: '#402d6c',
        border: '1px solid rgba(147, 111, 214, 0.3)',
        borderHover: '1px solid rgba(147, 111, 214, 0.42)',
        borderPressed: '1px solid rgba(147, 111, 214, 0.55)'
      },
      Input: {
        color: '#342964',
        colorDisabled: '#2f245a',
        colorFocus: '#392c6c',
        textColor: '#f5ecff',
        textColorDisabled: 'rgba(245, 236, 255, 0.58)',
        placeholderColor: 'rgba(214, 193, 255, 0.7)',
        placeholderColorDisabled: 'rgba(214, 193, 255, 0.45)',
        iconColor: 'rgba(214, 193, 255, 0.75)',
        iconColorHover: '#d6c3ff',
        iconColorPressed: '#f5ecff',
        iconColorDisabled: 'rgba(214, 193, 255, 0.4)',
        clearColor: 'rgba(225, 210, 255, 0.6)',
        clearColorHover: 'rgba(225, 210, 255, 0.75)',
        clearColorPressed: 'rgba(225, 210, 255, 0.9)',
        border: '1px solid rgba(147, 111, 214, 0.35)',
        borderDisabled: '1px solid rgba(147, 111, 214, 0.2)',
        borderHover: '1px solid rgba(169, 129, 229, 0.45)',
        borderFocus: '1px solid #b47bff',
        boxShadowFocus: '0 0 0 2px rgba(180, 123, 255, 0.2)',
        loadingColor: '#b47bff',
        suffixTextColor: 'rgba(245, 236, 255, 0.78)',
        prefixTextColor: 'rgba(245, 236, 255, 0.78)'
      },
      Card: {
        color: '#2a1f45',
        colorModal: '#2a1f45',
        colorTarget: '#2a1f45',
        textColor: '#f5ecff',
        titleTextColor: '#fdf7ff',
        borderColor: 'rgba(147, 111, 214, 0.35)',
        actionColor: '#342964',
        closeIconColor: 'rgba(225, 210, 255, 0.7)',
        closeIconColorHover: '#d6c3ff',
        closeIconColorPressed: '#f5ecff',
        boxShadow: '0 18px 42px rgba(16, 8, 29, 0.45)'
      },
      Tabs: {
        tabColor: '#342964',
        tabColorActive: '#3f3277',
        tabBorderColor: 'rgba(147, 111, 214, 0.35)',
        tabTextColorBar: 'rgba(245, 236, 255, 0.75)',
        tabTextColorBarHover: '#e1d2ff',
        tabTextColorBarActive: '#f5ecff',
        tabTextColorCard: 'rgba(245, 236, 255, 0.75)',
        tabTextColorCardActive: '#f5ecff',
        barColor: 'rgba(180, 123, 255, 0.6)'
      },
      Radio: {
        buttonBorderColor: 'rgba(147, 111, 214, 0.35)',
        buttonBorderColorActive: 'rgba(180, 123, 255, 0.55)',
        buttonColor: '#342964',
        buttonColorActive: '#403277',
        buttonTextColor: 'rgba(245, 236, 255, 0.78)',
        buttonTextColorActive: '#fdf7ff'
      },
      Dropdown: {
        color: '#2a1f45',
        optionTextColor: '#f5ecff',
        optionTextColorHover: '#e1d2ff',
        optionTextColorActive: '#1f1633',
        optionColorHover: '#36275a',
        optionColorActive: '#42317a',
        borderColor: 'rgba(147, 111, 214, 0.35)'
      }
    }
  }
}

// 获取可用主题列表
export const availableThemes = Object.values(naiveThemeConfigs)

// 当前主题配置
export const currentThemeConfig = computed(() => 
  naiveThemeConfigs[currentThemeId.value] || naiveThemeConfigs.light
)

// 当前 Naive UI 主题
export const currentNaiveTheme = computed<GlobalTheme | null>(() => 
  currentThemeConfig.value.naiveTheme
)

// 当前主题覆盖配置
export const currentThemeOverrides = computed<GlobalThemeOverrides>(() => 
  currentThemeConfig.value.themeOverrides || {}
)

const resolveAppliedThemeId = (selectedThemeId: string): string => {
  if (selectedThemeId === 'auto') {
    try {
      const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches
      return prefersDark ? 'dark' : 'light'
    } catch {
      return 'light'
    }
  }
  return selectedThemeId
}

const applyThemeId = (selectedThemeId: string): boolean => {
  const applied = resolveAppliedThemeId(selectedThemeId)
  if (!naiveThemeConfigs[applied]) {
    console.warn(`Theme '${applied}' not found`)
    return false
  }
  currentThemeId.value = applied

  // Keep Tailwind's `dark:` variant in sync with the app theme.
  // Tailwind in this repo uses `darkMode: 'class'`, so we must toggle `.dark`.
  try {
    if (typeof document !== 'undefined' && document.documentElement) {
      const isDark = naiveThemeConfigs[applied]?.naiveTheme === darkTheme
      document.documentElement.classList.toggle('dark', Boolean(isDark))
    }
  } catch (error) {
    // Best-effort only; theme switching must not break if DOM is unavailable.
    console.warn('[Theme] Failed to sync Tailwind dark class:', error)
  }
  return true
}

type MediaQueryListCompat = MediaQueryList & {
  addListener?: (listener: (e: MediaQueryListEvent) => void) => void
  removeListener?: (listener: (e: MediaQueryListEvent) => void) => void
}

let __autoColorSchemeWatchInitialized = false
let __autoColorSchemeQuery: MediaQueryListCompat | null = null
let __autoColorSchemeListener: ((e: MediaQueryListEvent) => void) | null = null

const cleanupAutoColorSchemeWatch = (): void => {
  try {
    const query = __autoColorSchemeQuery
    const listener = __autoColorSchemeListener
    if (!query || !listener) return

    if (typeof query.removeEventListener === 'function') {
      query.removeEventListener('change', listener)
    } else if (typeof query.removeListener === 'function') {
      query.removeListener(listener)
    }
  } catch (error) {
    console.warn('[Theme] Failed to cleanup prefers-color-scheme watcher:', error)
  } finally {
    __autoColorSchemeQuery = null
    __autoColorSchemeListener = null
    __autoColorSchemeWatchInitialized = false
  }
}

const ensureAutoColorSchemeWatch = (settings: ReturnType<typeof useGlobalSettings>): void => {
  // Only relevant when the user-selected theme is 'auto'.
  if (__autoColorSchemeWatchInitialized) return
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return

  try {
    const query = window.matchMedia('(prefers-color-scheme: dark)') as MediaQueryListCompat
    const listener = (_e: MediaQueryListEvent) => {
      if (settings.state.selectedThemeId !== 'auto') return
      applyThemeId('auto')
    }

    if (typeof query.addEventListener === 'function') {
      query.addEventListener('change', listener)
    } else if (typeof query.addListener === 'function') {
      query.addListener(listener)
    }

    // Keep refs so we can clean up on HMR dispose.
    __autoColorSchemeQuery = query
    __autoColorSchemeListener = listener

    // Dev-only: avoid accumulating listeners across Vite HMR reloads.
    if (import.meta.hot) {
      import.meta.hot.dispose(() => {
        cleanupAutoColorSchemeWatch()
      })
    }

    __autoColorSchemeWatchInitialized = true
  } catch (error) {
    console.warn('[Theme] Failed to init prefers-color-scheme watcher:', error)
  }
}

// 主题切换（统一由 useGlobalSettings 持久化）
export const switchTheme = (themeId: string): boolean => {
  const settings = useGlobalSettings(pinia)
  settings.updateThemeId(themeId)

  const ok = applyThemeId(themeId)
  if (ok) {
    console.log(`Pure Naive UI theme switched to: ${themeId}`)
  }
  return ok
}

// 获取当前主题ID
export const getCurrentThemeId = (): string => currentThemeId.value

// 获取主题配置
export const getThemeConfig = (themeId: string): ThemeConfig | null => {
  return naiveThemeConfigs[themeId] || null
}

// 初始化主题系统
export const initializeNaiveTheme = (): void => {
  const settings = useGlobalSettings(pinia)

  // 一次性迁移：localStorage('naive-theme-id') → useGlobalSettings
  // 只在 global-settings/v1 尚未恢复且当前为默认 'auto' 时执行
  try {
    const legacy = localStorage.getItem('naive-theme-id')
    if (legacy && settings.state.selectedThemeId === 'auto' && !settings.hasRestored) {
      settings.updateThemeId(legacy)
    }
  } catch (error) {
    console.warn('Failed to load legacy theme preference:', error)
  }

  // When in 'auto' mode, keep theme synced with OS color scheme changes.
  ensureAutoColorSchemeWatch(settings)

  // 监听全局配置的主题选择，驱动实际应用主题
  // 使用模块级 guard，防止 initializeNaiveTheme 被多次调用时重复注册 watch
  if (!__themeWatchInitialized) {
    __themeWatchInitialized = true
    watch(
      () => settings.state.selectedThemeId,
      (selectedId) => {
        if (!selectedId) return
        applyThemeId(selectedId)
      },
      { immediate: true }
    )
  } else {
    // 已注册 watch：手动应用一次，确保初始化时 theme 与 state 对齐
    applyThemeId(settings.state.selectedThemeId)
  }
}

let __themeWatchInitialized = false

// 检查是否为深色主题
export const isDarkTheme = computed(() => {
  const config = currentThemeConfig.value
  return config.naiveTheme === darkTheme
})

// 为向后兼容性导出的别名
export const naiveTheme = currentNaiveTheme
export const themeOverrides = currentThemeOverrides
