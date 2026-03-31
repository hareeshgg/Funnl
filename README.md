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


## 📸 Instagram API Integration

Follow these steps to properly set up and integrate the Instagram Messaging API with your backend:

---

### 1. Prerequisites (Environment Variables)

Ensure your **`.env`** file contains the following variables:

```env
META_APP_ID=your_app_id
META_APP_SECRET=your_app_secret
INSTAGRAM_PAGE_ACCESS_TOKEN=your_extended_page_token
INSTAGRAM_BUSINESS_ACCOUNT_ID=your_ig_business_id
FACEBOOK_PAGE_ID=your_facebook_page_id
WEBHOOK_VERIFY_TOKEN=your_custom_verify_token
```

- **META_APP_ID**: The unique ID of your Meta App.
- **META_APP_SECRET**: The secret key for your Meta App.
- **INSTAGRAM_PAGE_ACCESS_TOKEN**: A long-lived token representing the linked Facebook Page.
- **INSTAGRAM_BUSINESS_ACCOUNT_ID**: The ID of the Instagram Business Account.
- **FACEBOOK_PAGE_ID**: The ID of the Facebook Page linked to the Instagram account.
- **WEBHOOK_VERIFY_TOKEN**: A custom string you define to verify webhook requests.

---

### 2. Create Meta App
1. Go to the **Meta Developers Dashboard**.
2. Click **Create App**.
3. Select **Other** -> **Business** as the app type.
4. Choose **Instagram Graph API** (and optionally Messenger) as the product.
5. Complete the app creation without connecting any business initially.

---

### 3. Add Instagram Use Case
1. Navigate to **Use Cases** in the left sidebar.
2. Select **Instagram API** from the list.
3. Click **Add** to include it in your app.

---

### 4. Configure Permissions & Features
Navigate to **App Settings** -> **Permissions and Features**. Enable the following:

**Mandatory:**
- `instagram_basic`
- `instagram_manage_comments`
- `instagram_manage_messages`
- `instagram_business_basic`

**Optional (Recommended):**
- `business_management`
- `pages_show_list`
- `pages_read_engagement`
- `instagram_content_publish`
- `human_agent`
- `user_profile`

---

### 5. API Setup with Instagram Login
1. Go to **Instagram** section in the sidebar -> **API Setup**.
2. Click **Add Permissions** or **Configure**.
3. Ensure the mandatory permissions listed above are successfully added.

---

### 6. Configure Webhooks
1. Go to the **Webhooks** section.
2. Select **Instagram** from the dropdown and click **Configure**.
3. **Callback URL**: `https://your-domain.com/webhooks/instagram`
4. **Verify Token**: Must match `WEBHOOK_VERIFY_TOKEN` in your `.env`.
5. Click **Verify and Save**.
6. **Subscribe** to `messages` and `comments` fields.

---

### 7. Generate Page Access Token (Graph API Explorer)
1. Open the [Graph API Explorer](https://developers.facebook.com/tools/explorer/).
2. Select your **Meta App**.
3. In **User or Page**, select **Get Page Access Token**.
4. Grant the required permissions (`pages_show_list`, `instagram_basic`, `instagram_manage_messages`, etc.).
5. Copy the generated **Access Token**.
6. run the query: `me/accounts?fields=access_token,name,id` to find the specific Page token.

---

### 8. Extend Page Access Token
1. Open the [Access Token Debugger](https://developers.facebook.com/tools/debug/accesstoken/).
2. Paste the token and click **Debug**.
3. Scroll down and click **Extend Access Token**.
4. Copy the new **long-lived** token (valid for ~60 days).

---

### 9. Configure Backend
Update your **`.env`** with the gathered credentials:
```env
INSTAGRAM_PAGE_ACCESS_TOKEN=your_extended_token
META_APP_ID=your_app_id
META_APP_SECRET=your_app_secret
INSTAGRAM_BUSINESS_ACCOUNT_ID=your_ig_business_id
FACEBOOK_PAGE_ID=your_page_id
WEBHOOK_VERIFY_TOKEN=your_verify_token
```

---

### 10. Get App Credentials
1. Go to **App Settings** -> **Basic**.
2. Copy the **App ID** and **App Secret**.

---

### 11. Privacy Policy & App Publishing
1. Create a public **Privacy Policy** URL (Google Docs works for development).
2. Add the URL in **App Settings** -> **Basic**.
3. Ensure a category and icon are selected.
4. Toggle the app to **Live Mode** in the top bar.

---

⚠️ **Notes**
- Page access tokens expire unless extended to "Never Expire" or refreshed periodically.
- Ensure your endpoint is publicly reachable (use **ngrok** for local development).
- Permissions requested in Step 7 must match the usage in the code.

---

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
