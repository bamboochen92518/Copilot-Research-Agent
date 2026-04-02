# Research Paper Agent 📚🤖

An intelligent Discord bot that automatically fetches, summarizes, and organizes academic papers from OpenAlex using GitHub Copilot SDK.

## Features

### 🔄 Automatic Mode
- Scheduled daily paper collection and summarization
- Automatic delivery to designated Discord channel
- Configurable time and frequency

### 💬 Manual Mode
- Request papers on-demand via Discord commands
- Specify number of papers and research domains
- Interactive conversation-based interface

### 🤖 AI-Powered Summarization
- Leverage GitHub Copilot SDK for intelligent paper summaries
- Extract key findings, methodologies, and conclusions
- Generate concise, readable summaries

### 📊 Database Management
- Track recommended papers to avoid duplicates
- Store user favorites via Discord reaction (emoji)
- Query paper history and recommendations

### ⭐ Favorite System
- React with emoji to save papers
- Personal collection management
- Easy access to saved papers

## Tech Stack

- **Language**: TypeScript
- **Runtime**: Node.js
- **Bot Framework**: discord.js
- **AI/ML**: GitHub Copilot SDK
- **Paper Source**: OpenAlex API
- **Database**: SQLite (better-sqlite3)
- **Task Scheduling**: node-cron
- **Logging**: Winston
- **Environment**: Docker (optional)

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                       Discord Bot                           │
│  ┌──────────────────┐         ┌──────────────────┐          │
│  │  Manual Commands │         │  Auto Scheduler  │          │
│  └────────┬─────────┘         └────────┬─────────┘          │
│           │                            │                    │
└───────────┼────────────────────────────┼────────────────────┘
            │                            │
            └──────────┬─────────────────┘
                       │
            ┌──────────▼──────────┐
            │  OpenAlex Fetcher   │
            │  (Research Papers)  │
            └──────────┬──────────┘
                       │
            ┌──────────▼──────────┐
            │  Copilot Summarizer │
            │   (GitHub SDK)      │
            └──────────┬──────────┘
                       │
            ┌──────────▼──────────┐
            │     Database        │
            │  (Papers + Favs)    │
            └─────────────────────┘
```

## Project Structure

```
copilot-research-agent/
├── src/                        # Source code only
│   ├── bot.ts                  # Main bot entry point
│   ├── commands/               # Discord command handlers
│   ├── services/               # Business logic services
│   │   └── openAlexFetcher.ts  # OpenAlex API integration
│   ├── models/                 # Data models and types
│   │   └── types.ts            # TypeScript interfaces
│   ├── database/               # Database layer
│   │   ├── models.ts           # Database models
│   │   └── operations.ts       # CRUD operations
│   ├── config/                 # Configuration
│   │   └── config.ts           # App configuration
│   └── utils/                  # Utility functions
│       └── logger.ts           # Winston logger
├── tests/                      # Unit tests (Jest)
│   └── services/
│       └── openAlexFetcher.test.ts
├── data/                       # Runtime data (gitignored)
│   └── papers.db               # SQLite database
├── logs/                       # Log files (gitignored)
├── dist/                       # Compiled JS (gitignored)
├── .env                        # Environment variables (gitignored)
├── .env.example                # Environment template
├── .gitignore
├── package.json
├── tsconfig.json
├── jest.config.js
├── README.md
└── TODO.md
```

## Quick Start

### Prerequisites
- Node.js >= 18.x
- npm or yarn
- Discord Bot Token
- GitHub Copilot subscription (Individual, Business, or Enterprise)
- GitHub Fine-Grained Personal Access Token (for Copilot SDK)

### Discord Bot Setup

Before installing the application, you need to create and configure a Discord bot:

#### 1. Create a Discord Application

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click **"New Application"**
3. Enter a name for your bot (e.g., "Research Paper Agent")
4. Click **"Create"**

#### 2. Create a Bot User

1. In your application page, click **"Bot"** in the left sidebar
2. Click **"Add Bot"** and confirm
3. Under the bot's username, click **"Reset Token"** to generate a new token
4. **Copy the token immediately** (you won't be able to see it again!)
5. Save this token - you'll need it for the `.env` file

⚠️ **Important**: Never share your bot token publicly or commit it to Git!

#### 3. Enable Privileged Gateway Intents

In the Bot settings page, scroll down to **"Privileged Gateway Intents"** and enable:

- ✅ **MESSAGE CONTENT INTENT** (Required - allows bot to read message content)
- ✅ **SERVER MEMBERS INTENT** (Optional - for member-related features)
- ⚠️ Click **"Save Changes"** at the bottom

#### 4. Get Your Application/Client ID

1. Click **"General Information"** in the left sidebar
2. Find and copy your **"Application ID"** (also called Client ID)
3. Save this ID - you'll need it for the `.env` file

#### 5. Invite Bot to Your Server

1. Click **"OAuth2"** > **"URL Generator"** in the left sidebar
2. Under **"SCOPES"**, select:
   - ✅ `bot`
   - ✅ `applications.commands`
3. Under **"BOT PERMISSIONS"**, select:
   - ✅ Read Messages/View Channels
   - ✅ Send Messages
   - ✅ Send Messages in Threads
   - ✅ Embed Links
   - ✅ Attach Files
   - ✅ Read Message History
   - ✅ Add Reactions
   - ✅ Use Slash Commands
4. Copy the generated URL at the bottom
5. Open the URL in your browser and select a server to invite the bot

### GitHub Token Setup (for Copilot SDK)

The Copilot SDK uses a **fine-grained personal access token** to authenticate with your GitHub Copilot subscription. Classic tokens (`ghp_...`) are **not supported** — you must use a fine-grained PAT (`github_pat_...`).

#### 1. Create a Fine-Grained Personal Access Token

1. Go to [github.com](https://github.com) and click your avatar → **Settings**
2. Scroll to the bottom of the left sidebar and click **Developer settings**
3. Click **Personal access tokens** → **Fine-grained tokens**
4. Click **Generate new token**
5. Fill in the details:
   - **Token name**: e.g. `copilot-research-agent`
   - **Expiration**: choose a suitable duration
   - **Resource owner**: your personal account (or your organization for Enterprise)
6. No extra repository permissions are needed — the SDK only uses your Copilot subscription
7. Click **Generate token** and **copy it immediately**

> ⚠️ You only see the token once. Store it somewhere safe before closing the page.

#### 2. Verify Your Copilot Seat

- **Personal / Business plan**: confirm Copilot is active at [github.com/settings/copilot](https://github.com/settings/copilot)
- **Enterprise plan**: ask your org admin to confirm you have a Copilot seat assigned at `github.com/organizations/YOUR-ORG/settings/copilot`

#### 3. Add the Token to `.env`

```dotenv
GITHUB_TOKEN=github_pat_your_token_here
```

The SDK automatically reads this variable — no other configuration is needed.

### Installation

1. Clone the repository
```bash
git clone https://github.com/bamboochen92518/Copilot-Research-Agent.git
cd Copilot-Research-Agent
```

2. Install dependencies
```bash
npm install
```

3. Set up environment variables
```bash
cp .env.example .env
# Edit .env with your tokens
```

4. Register slash commands with Discord (run once, or when commands change)
```bash
npm run commands:register
```

> 💡 Set `DISCORD_GUILD_ID` in `.env` to register instantly to a specific server. Without it, commands are registered globally and may take up to 1 hour to appear.

5. Build the project
```bash
npm run build
```

6. Run the bot
```bash
npm start
```

## Development

1. Register slash commands (run once, or whenever you add/change commands):
```bash
npm run commands:register
```

2. Start the bot in development mode:
```bash
npm run dev
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

ISC
