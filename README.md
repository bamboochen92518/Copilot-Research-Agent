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
- **Runtime**: Node.js >= 20
- **Bot Framework**: discord.js
- **AI/ML**: GitHub Copilot SDK
- **Paper Source**: OpenAlex API
- **Database**: SQLite (better-sqlite3)
- **Task Scheduling**: node-cron
- **Logging**: Winston

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
- Node.js >= 20.x
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

#### 6. Get Your Server (Guild) ID for Instant Command Registration

Slash commands registered **globally** can take up to 1 hour to appear. Registering to a specific server is **instant** and recommended during development.

1. In Discord, go to **User Settings** → **Advanced** → enable **Developer Mode**
2. Right-click your server icon in the left sidebar
3. Click **"Copy Server ID"** — this is your Guild ID
4. Add it to your `.env` file:

```dotenv
DISCORD_GUILD_ID=your_guild_id_here
```

With this set, `npm run commands:register` updates slash commands instantly.

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

```bash
git clone https://github.com/bamboochen92518/Copilot-Research-Agent.git
cd Copilot-Research-Agent
npm install
cp .env.example .env        # then fill in your tokens
npm run commands:register   # register slash commands (run once, or when commands change)
```

> 💡 Set `DISCORD_GUILD_ID` in `.env` to register slash commands instantly to a specific server. Without it, global registration can take up to 1 hour.

**Development** (hot-reload, no build step):
```bash
npm run dev
```

**Production** (compile first, then run):
```bash
npm run build
npm start
```

**Tests**:
```bash
npm test
npm run test:coverage
```

---

## Usage Examples

### `/fetch` — Fetch papers on demand

```
/fetch
```
Fetches 5 papers from the default topic (AI).

```
/fetch count:3 domain:quantum computing
```
Fetches 3 papers about quantum computing.

```
/fetch count:5 domain:machine learning start_year:2022 min_citations:100
```
Fetches 5 machine-learning papers published from 2022 onward with at least 100 citations.

### `/list` — Show recent recommendations

```
/list
```
Displays the most recently recommended papers for the current channel.

### `/favorites` — View saved papers

```
/favorites
```
Shows all papers you have saved by reacting with ⭐ in this channel.

### `/schedule` — Manage automatic posting

```
/schedule enable channel:#research-papers
```
Enables daily posting at 09:00 server time to `#research-papers`.

```
/schedule enable channel:#research-papers cron:0 18 * * 1-5 domains:AI, NLP count:3
```
Posts 3 AI/NLP papers at 18:00 every weekday.

```
/schedule status
```
Shows the current schedule configuration and whether it is active.

```
/schedule disable
```
Stops automatic posting for this server.

### `/help` — List all commands

```
/help
```

### Starring papers (⭐ Favorites)

After the bot posts a paper embed, react with ⭐ to save it to your favorites.  
React again (remove the star) to unsave it.

---

## User Guide

### How the bot works

1. **On demand**: Use `/fetch` whenever you want fresh papers. The bot calls the [OpenAlex API](https://openalex.org), picks papers you haven't seen before in this channel, downloads PDF text where available, and asks GitHub Copilot to generate a structured summary.

2. **Automatically**: Use `/schedule enable` to post papers on a recurring schedule. Each guild stores its own schedule in the local SQLite database.

3. **Saving papers**: React with ⭐ to any paper embed. The bot records the paper in your personal favorites list. Use `/favorites` to review them later.

### Tips

- **Broad searches return more variety.** Try `domain:biology`, `domain:climate`, or just `/fetch` to browse random AI papers.
- **Use `start_year` + `min_citations` for high-quality results.** Example: `start_year:2020 min_citations:50`.
- **The bot skips duplicates.** Papers already recommended in a channel won't appear again.
- **Scheduler runs on server time.** The cron expression uses the timezone of the host machine running the bot. Adjust the cron string accordingly if you want a specific local time.
- **Multiple guilds are supported.** Each Discord server has its own schedule and recommendation history.

### Environment variable reference

| Variable | Required | Description |
|---|---|---|
| `DISCORD_BOT_TOKEN` | ✅ | Bot token from the Discord Developer Portal |
| `DISCORD_CLIENT_ID` | ✅ | Application / Client ID from the portal |
| `DISCORD_GUILD_ID` | Optional | Guild ID for instant command registration during dev |
| `GITHUB_TOKEN` | ✅ | Fine-grained GitHub PAT with Copilot access |
| `DATABASE_PATH` | Optional | Path to the SQLite file (default: `./data/papers.db`) |
| `FAVORITE_EMOJI` | Optional | Emoji used to star papers (default: `⭐`) |
| `COPILOT_MODEL` | Optional | Copilot model name (default: `gpt-4o`) |
| `LOG_LEVEL` | Optional | Winston log level: `error`, `warn`, `info`, `debug` (default: `info`) |

---

## Deployment (VPS with PM2)

To run the bot persistently on a Linux server (e.g. Ubuntu 22.04):

**1. Install Node.js 20 on the server:**
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

**2. Clone, install, and build** (same as [Installation](#installation) above):
```bash
git clone https://github.com/bamboochen92518/Copilot-Research-Agent.git
cd Copilot-Research-Agent
npm install
cp .env.example .env && nano .env
npm run commands:register
npm run build
```

**3. Run with PM2:**
```bash
sudo npm install -g pm2
pm2 start dist/bot.js --name copilot-research-agent
pm2 save && pm2 startup   # persist across reboots
```

Useful PM2 commands:
```bash
pm2 status
pm2 logs copilot-research-agent
pm2 restart copilot-research-agent
```

**Updating:**
```bash
git pull && npm install && npm run build && pm2 restart copilot-research-agent
```

---

## License

ISC
