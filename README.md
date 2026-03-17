
<div align="center">
# 🤖 AgentBoard

### AI Agents and Humans, Working Together in Real-Time

**🚀 [Live Demo](https://agentboard-5b9aqf4fu-versity.vercel.app)** | **📹 [Demo Video](#)** | **🏆 [PowerSync AI Hackathon 2026](#)**

AgentBoard Demo

*Watch AI agents autonomously process research, writing, and analysis tasks while you manage the workflow*

[PowerSync](https://powersync.com)
[Mastra](https://mastra.ai)
[Supabase](https://supabase.com)

</div>

---

## 💡 The Problem

Traditional task management forces humans to work alone. Project collaboration happens in Slack, emails, and meetings — but **what if AI could work *alongside* you on tasks in real-time?**

Current tools make you:

- ❌ Copy-paste between ChatGPT and your task board
- ❌ Manually assign tasks to team members  
- ❌ Wait for human responses to continue work
- ❌ Work offline? Forget about it.

---

## ✨ The Solution: AgentBoard

**A kanban board where humans and AI agents collaborate side-by-side**, with offline-first real-time sync.

Multi-tab Sync Demo
*Real-time sync across devices powered by PowerSync — works offline!*

### 🎯 Key Innovation

**Context-Aware AI Agents** that learn from your company documents:

Company Context Demo
*Upload your company docs → AI agents reference your actual metrics and strategy*

---

## 🚀 Features


<table>
<tr>
<td width="50%">

### 🤖 **3 Autonomous AI Agents**

Agent Activity Feed

- **Research Agent**: Gathers information
- **Writer Agent**: Creates content  
- **Analyst Agent**: Analyzes data

All powered by **Mastra framework** + Anthropic Claude

</td>
<td width="50%">

### ⚡ **Real-Time Sync**

PowerSync Offline

- **Offline-first** via PowerSync
- **Multi-tab sync** in real-time
- **Works without internet**
- SQLite local database

</td>
</tr>
<tr>
<td width="50%">

### 🏢 **Company Knowledge Base**

Knowledge Upload

- Upload PDFs and documents
- AI agents reference your context
- Company-aware responses

</td>
<td width="50%">

### 🎨 **Beautiful UI**

Kanban Board

- Drag-and-drop kanban
- Agent activity feed with shimmer effects
- Dark mode ready
- Built with shadcn/ui

</td>
</tr>
</table>

---

## 🏗️ Architecture

<div align="center">

![AgentBoard Architecture](diagrams_architecture.png)

</div>

*AgentBoard uses a three-tier architecture: Frontend (Vercel) → Backend (Supabase) → AI Agents (Railway)*

---

## 🏆 Hackathon Prize Alignment

### PowerSync Main Prize 🎯

**Why I'm a strong candidate:**

- ✅ PowerSync is **core to our architecture** (not bolted-on)
- ✅ Offline-first design with local SQLite
- ✅ Multi-tab real-time sync demonstrated
- ✅ Upload queue with conflict resolution
- ✅ Meaningful use case: human-AI collaboration needs sync!

### Mastra Framework Bonus

**Integration details:**

- ✅ All 3 agents use `@mastra/core` Agent class
- ✅ Not using AI SDK directly — pure Mastra
- ✅ Agents deployed as background services
- ✅ Company context integration via Mastra

**Code example:**

```typescript
import { Agent } from '@mastra/core/agent';

const researchAgent = new Agent({
  id: 'research-agent',
  name: 'Research Agent',
  instructions: 'You are a research assistant...',
  model: 'anthropic/claude-haiku-4-5-20251001',
});

const response = await researchAgent.generate(prompt);
```

### Supabase Prize

**Integration details:**

- ✅ PostgreSQL backend (5 tables)
- ✅ Anonymous authentication for PowerSync
- ✅ Storage bucket for company documents
- ✅ RLS policies configured
- ✅ Real-time subscriptions (with PowerSync)

---

## 🛠️ Tech Stack


| Layer          | Technology                         | Why We Chose It                                                                                                                                                         |
| -------------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Sync**       | [PowerSync](https://powersync.com) | Only solution offering offline-first + real-time sync with SQLite. Critical for our human-AI collaboration use case where agents update tasks while users work offline. |
| **AI**         | [Mastra](https://mastra.ai)        | Unified framework for building production AI agents. Cleaner abstractions than raw AI SDK. Built-in tool support.                                                       |
| **Backend**    | [Supabase](https://supabase.com)   | Managed PostgreSQL with authentication and storage. Perfect PowerSync companion. Anonymous auth works seamlessly.                                                       |
| **LLM**        | Anthropic Claude Haiku          | Fast, cost-effective reasoning for research, writing, and analysis tasks.                                                                                                      |
| **Frontend**   | React + Vite + TypeScript          | Fast dev experience, type safety, modern tooling.                                                                                                                       |
| **UI**         | shadcn/ui + Tailwind CSS           | Beautiful components, accessible, customizable.                                                                                                                         |
| **Deployment** | Vercel + Railway                   | Vercel for edge delivery, Railway for agent services.                                                                                                                   |


---

## 📸 Screenshots

### Main Kanban Board

Kanban Board
*Drag-and-drop task management with real-time agent activity*

### Agent Processing Task

Agent Working
*Watch an agent claim a task, process it with AI, and move it to Review*

### Multi-Tab Sync

Multi-Tab Demo
*Create task in one tab → appears instantly in another tab (offline-first!)*

### Company Knowledge Base

Knowledge Base
*Upload company documents → AI agents reference your strategy and metrics*

---

## 🎬 Demo Video

**📹 [Watch Full Demo (3 min)](https://youtube.com/your-demo-link)**

**Quick highlights:**

- 0:00 - Hook: Human-AI collaboration concept
- 0:30 - Create 3 tasks, watch 3 agents work simultaneously  
- 1:30 - Company context: AI references YOUR metrics
- 2:00 - Multi-tab sync (WOW moment!)
- 2:30 - Tech stack & close

---

## 🚀 Quick Start

### Prerequisites

```bash
Node.js 20+ | npm 10+
```

### Installation

1. **Clone the repo**

```bash
git clone https://github.com/OmerWaseem-Alzaidi/agentboard.git
cd agentboard
```

1. **Install dependencies**

```bash
npm install
```

1. **Set up environment variables**

Create a `.env` file in the project root with:

**Frontend (Vite):**
- `VITE_POWERSYNC_URL` — PowerSync instance URL
- `VITE_SUPABASE_URL` — Supabase project URL
- `VITE_SUPABASE_ANON_KEY` — Supabase anon key
- `VITE_ANTHROPIC_API_KEY` — Anthropic API key (for Chat with Agent)

**Agents** (required for `npm run agents:all`):
- `SUPABASE_URL` — Same as VITE_SUPABASE_URL
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role key (bypasses RLS)
- `ANTHROPIC_API_KEY` — Anthropic API key (for agents)

1. **Run frontend**

```bash
npm run dev
# Opens http://localhost:5173
```

1. **Run agents** (separate terminal)

```bash
npm run agents:all
# Starts 3 AI agents polling every 30 seconds (loads .env automatically)
```

### Creating Your First Task

1. Click **"+ Create Task"**
2. Select label: **Research**, **Writing**, or **Analysis**
3. Watch the corresponding AI agent claim and process it!
4. Task moves: To Do → In Progress → Review

---

## 📁 Project Structure

```
agentboard/
├── src/
│   ├── components/
│   │   └── ui/
│   │       ├── KanbanBoard.tsx      # Main board with PowerSync sync
│   │       ├── KanbanColumn.tsx      # Column component
│   │       ├── TaskCard.tsx         # Draggable task cards
│   │       ├── TaskDetailDialog.tsx # Task detail + Chat with Agent
│   │       ├── TaskChatDialog.tsx   # AI chat for task refinement
│   │       ├── CreateTaskDialog.tsx # Create new tasks
│   │       ├── KnowledgeBaseDialog.tsx # Upload company docs
│   │       └── ...                  # shadcn components
│   ├── lib/
│   │   ├── powersync.ts            # PowerSync DB setup
│   │   ├── schema.ts               # DB schema (5 tables)
│   │   ├── supabase.ts             # Supabase client
│   │   └── knowledge.ts            # Company context handling
│   └── App.tsx
├── agents/
│   ├── get-company-context.ts     # Shared context + cleaning
│   ├── research-agent.ts          # Mastra research agent
│   ├── writer-agent.ts            # Mastra writer agent
│   └── analyst-agent.ts           # Mastra analyst agent
└── package.json
```

---

## 🎯 What's Next

**If we win, we'll build:**

- **Voice-controlled task creation** (Mastra voice integration)
- **Custom agent types** (let users create their own agents)
- **Mobile app** (React Native + PowerSync)
- **Enterprise features** (teams, permissions, audit logs)
- **Agent marketplace** (share and discover agents)

---

## 🙏 Acknowledgments

**Huge thanks to our amazing sponsor technologies:**

### PowerSync

Thank you for creating the **only offline-first sync solution** that makes real-time collaboration possible. Your SQLite approach is genius — it's what enables our human-AI workflow to work seamlessly even offline.

### Mastra

Thank you for the **cleanest AI agent framework** we've found. Your abstractions made building production-ready agents a joy. The Agent class is exactly what the ecosystem needed.

### Supabase

Thank you for **managed PostgreSQL** that just works. Your anonymous auth + PowerSync integration was seamless. The storage bucket for company docs was perfect for our use case.

### Anthropic

Thank you for **Claude Haiku** — the speed and quality made our agents actually useful, not just a gimmick.

---

## 📧 Contact

**Built by:** [Omer Waseem](mailto:omaralzaidi2002@gmail.com)

**GitHub:** [OmerWaseem-Alzaidi](https://github.com/OmerWaseem-Alzaidi)

**Questions?** Open an issue or email me!

---

## 📄 License

MIT License - see [LICENSE](LICENSE) for details

---



**Built for PowerSync AI Hackathon 2026** 🏆

*Making AI agents and humans true teammates, not just tools*

[PowerSync](https://powersync.com)
[Mastra](https://mastra.ai)
[Supabase](https://supabase.com)

**[⬆ Back to Top](#-agentboard)**

```