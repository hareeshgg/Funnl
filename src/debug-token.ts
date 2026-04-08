import { prisma } from "./db/prisma";
import { decrypt } from "./utils/encryption";
import logger from "./logger/logger";
import dotenv from "dotenv";

dotenv.config();

async function debugToken() {
  try {
    const config = await prisma.aiFunnlConfig.findUnique({
      where: { org_id: "1" }
    });

    if (!config) {
      console.log("❌ No config found for org_id: 1");
      return;
    }

    console.log("✅ Found config for org_id: 1");
    console.log("-----------------------------------");
    console.log("Instagram User ID:", config.instagram_user_id);
    console.log("Threads User ID:  ", config.threads_user_id);
    
    if (config.instagram_access_token) {
      const token = decrypt(config.instagram_access_token);
      console.log("Decrypted IG Token (Page Access Token):", token);
      
      // Verify if it looks like a Page Token (usually starts with EAA...)
      if (token?.startsWith("EAA")) {
        console.log("🔍 Token Type: Appears to be a valid Meta Page/User Token");
      }
    } else {
      console.log("⚠️ No Instagram Access Token stored.");
    }

  } catch (err: any) {
    console.error("Error during debug:", err.message);
  } finally {
    await prisma.$disconnect();
  }
}

debugToken();
