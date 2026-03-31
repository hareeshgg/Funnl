# AI Social Agent (Instagram + Threads) — POC

Build a **Proof of Concept AI Agent** that operates on **Instagram (DMs)** and **Threads (posting + replies)** to autonomously handle sales and marketing interactions.

## 🚀 Getting Started

### Prerequisites
- Node.js (v18+)
- PostgreSQL Database
- OpenAI API Key

### Installation
1. Install dependencies:
   ```bash
   npm install
   ```
2. Set up environment variables in `.env`:
   ```env
   DATABASE_URL="postgresql://user:password@localhost:5432/db_name"
   OPENAI_API_KEY="sk-..."
   SALES_COMMAND_API_KEY="sc-..."
   VERIFY_TOKEN="your_webhook_token"
   ```
3. Generate Prisma Client:
   ```bash
   npx prisma generate
   ```
4. Run migrations:
   ```bash
   npx prisma migrate dev --name init
   ```
5. Start the server:
   ```bash
   npm run dev
   ```

## 🤖 Core Architecture
- **`src/listener/`**: Webhook listeners for IG DMs, Comments, and Threads.
- **`src/engine/`**: Hybrid Intelligence (Deterministic Rules + LLM Fallback).
- **`src/conversation/`**: Persistent tracking and state management via Prisma.
- **`src/leads/`**: LLM-based extraction of Email, Phone, and Intent.
- **`src/integration/`**: Syncing qualified leads to Sales Command CRM.
- **`src/humanizer/`**: Typing simulation and phrasing randomization.
- **`src/logger/`**: Structured Winston logging for conversation debugging and error tracking.
- **`src/engine/processor.ts`**: Dedicated worker-ready processor logic that can easily be plugged into BullMQ/Redis for scaling beyond POC.

## 🧪 Testing the POC
To test the concurrency and flow without real Instagram webhooks, use the built-in test endpoint:
```bash
GET http://localhost:3000/test/concurrency
```
This will simulate 50 concurrent sessions and verify the processing pipeline.

## 📊 Success Criteria Status
- [x] Instagram DM auto-responder.
- [x] Comment-to-DM automated funnel.
- [x] Structured lead data capture (Prisma).
- [x] Sales Command API sync logic.
- [x] 50 Concurrent sessions test script.
- [x] Humanizer module.

## 🧵 Threads API Integration Steps

Follow these steps to properly set up and integrate the Threads API with your backend:

---

### 1. Enable Threads API Access
- Go to your **Meta App Dashboard**.
- Navigate to **Use Cases**.
- From the dropdown, select **"Access the Threads API"**.
- Add the use case to your app.

---

### 2. Configure Permissions & Features
- Go to **Permissions and Features**.
- Select and enable all required permissions needed for your use case (e.g., `threads_basic`, `threads_content_publish`, `threads_manage_replies`, `threads_manage_comments`).

---

### 3. Get App Credentials (For Later Use)
- Navigate to **Settings**.
- Locate:
  - **Threads App ID**
  - **Threads App Secret**
- These are used for OAuth flows and token exchanges.

---

### 4. Generate Access Token
- Scroll down to **User Token Generator**.
- Add your tester account.
- Generate an **Access Token**.

---

### 5. Configure Backend Environment
- Open your backend project.
- Locate the **`.env`** file.
- Add the generated token:
  ```env
  THREADS_ACCESS_TOKEN=your_generated_access_token
  THREADS_BOT_USERNAME=your_bot_username
  ```

---

### 6. Enable Webhooks
- Go back to your Threads use case.
- Switch the app to **Live Mode** (or ensure it's in a state that allows webhooks).
- Select **Webhooks**.
- A new section/tab will appear.

---

### 7. Configure Webhook Subscription
- Go to **Webhooks** → **Moderation**.
- Click **Add Subscription**.
- In the modal:
  - **Callback URL**: `https://your-domain.com/webhooks/threads/comments`
  - **Verify Token**: `your_webhook_verify_token` (Must match `WEBHOOK_VERIFY_TOKEN` in your `.env`)
- Click **Verify and Save**.

---

### 8. Select Subscription Fields
- After saving, enable the following fields in the subscription:
  - **`delete`**
  - **`replies`**
- Choose the latest API version (e.g., **`v25.0`**).

---

### 9. Run and Test Your Setup
- Start your backend server: `npm run dev`.
- From a secondary/test account on Threads, reply to a post from your main account.
- ✅ If everything is configured correctly, your backend will extract the payload and trigger the automated reply flow.

---

⚠️ **Notes**
- Ensure your backend endpoint is publicly accessible (use **ngrok** or **Cloudflare Tunnel** for local testing).
- The **Verify Token** must exactly match between Meta and your `.env` file.
- Access tokens generated via the generator are short-lived; implement long-lived token exchange for production.
