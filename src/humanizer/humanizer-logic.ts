import { randomInt } from "crypto";

/**
 * Humanizer Logic to inject delays and variation to conversations
 */
export class Humanizer {
  /**
   * Inject a random sleep to simulate human typing
   * @param min Min delay in ms
   * @param max Max delay in ms
   */
  static async wait(min: number = 2000, max: number = 6000): Promise<void> {
    const delay = randomInt(min, max);
    return new Promise((resolve) => setTimeout(resolve, delay));
  }

  /**
   * Randomizes phrasing for common responses
   * @param phrases Array of alternative phrases
   */
  static randomize(phrases: string[]): string {
    return phrases[randomInt(0, phrases.length)];
  }

  /**
   * Adds typing indicators simulated delay based on message length
   * @param message Message to send
   */
  static async typingDelay(message: string): Promise<void> {
    // Approx 250 characters per minute = ~4 characters per second
    const delayPerChar = 150; 
    const baseDelay = 1000;
    const totalDelay = Math.min(baseDelay + message.length * delayPerChar, 8000);
    return this.wait(totalDelay * 0.8, totalDelay * 1.2);
  }
}
