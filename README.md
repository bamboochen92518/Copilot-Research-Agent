# Research Paper Agent 📚🤖

An intelligent Discord bot that automatically fetches, summarizes, and organizes academic papers from arXiv and Google Scholar using GitHub Copilot SDK.

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
- **Paper Sources**: arXiv API, Google Scholar
- **Database**: SQLite (better-sqlite3) / PostgreSQL
- **Task Scheduling**: node-cron / node-schedule
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
            │   Paper Fetcher     │
            │  (arXiv + Scholar)  │
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
├── src/
│   ├── bot/
│   │   ├── index.ts            # Main bot logic
│   │   ├── commands.ts         # Command handlers
│   │   └── events.ts           # Event handlers (reactions, etc.)
│   ├── fetchers/
│   │   ├── arxivFetcher.ts     # arXiv API integration
│   │   └── scholarFetcher.ts   # Google Scholar scraper
│   ├── summarizer/
│   │   └── copilotSummarizer.ts # Copilot SDK integration
│   ├── database/
│   │   ├── models.ts           # Database models
│   │   └── operations.ts       # CRUD operations
│   ├── scheduler/
│   │   └── tasks.ts            # Scheduled tasks
│   └── utils/
│       ├── config.ts           # Configuration management
│       └── logger.ts           # Logging utilities
├── tests/
│   ├── fetchers.test.ts
│   ├── summarizer.test.ts
│   └── database.test.ts
├── config/
│   └── config.yaml             # Configuration file
├── data/
│   └── papers.db              # SQLite database (if used)
├── .env.example               # Environment variables template
├── .gitignore
├── package.json
├── tsconfig.json
├── docker-compose.yml         # Docker setup
├── Dockerfile
├── README.md
└── TODO.md
```

## Quick Start

### Prerequisites
- Node.js >= 18.x
- npm or yarn
- Discord Bot Token
- GitHub Token (for Copilot SDK)

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

4. Build the project
```bash
npm run build
```

5. Run the bot
```bash
npm start
```

## Development

Run in development mode with hot reload:
```bash
npm run dev
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

ISC
