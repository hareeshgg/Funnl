import { BaseProvider } from "./BaseProvider";
import { GeminiProvider } from "./GeminiProvider";
import { OpenAIProvider } from "./OpenAIProvider";
import { DeepSeekProvider } from "./DeepSeekProvider";
import { GrokProvider } from "./GrokProvider";
import { QwenProvider } from "./QwenProvider";

export class ProviderFactory {
  /**
   * Instantiates the correct AI provider based on configuration.
   */
  static getProvider(config: any): BaseProvider {
    const providerName = (config.selected_provider || "gemini").toLowerCase();

    switch (providerName) {
      case "gemini":
        return new GeminiProvider(
          config.gemini_api_key,
          config.gemini_model || "gemini-2.0-flash-lite"
        );
      case "openai":
        return new OpenAIProvider(
          config.openai_api_key,
          config.openai_model || "gpt-4o"
        );
      case "deepseek":
        return new DeepSeekProvider(
          config.deepseek_api_key,
          "deepseek-chat"
        );
      case "grok":
        return new GrokProvider(
          config.grok_api_key,
          "grok-2"
        );
      case "qwen":
        return new QwenProvider(
          config.qwen_api_key,
          "qwen-plus"
        );
      default:
        throw new Error(`Unsupported AI provider: ${providerName}`);
    }
  }
}
