interface Window {
  runtime_config?: {
    OPENAI_API_KEY?: string;
    GEMINI_API_KEY?: string;
    DEEPSEEK_API_KEY?: string;
    SILICONFLOW_API_KEY?: string;
    ZHIPU_API_KEY?: string;
    CUSTOM_API_KEY?: string;
    CUSTOM_API_BASE_URL?: string;
    CUSTOM_API_MODEL?: string;
    [key: string]: string | undefined;
  };
} 