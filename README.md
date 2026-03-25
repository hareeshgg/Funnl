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
