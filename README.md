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

- **Language**: Python
- **Bot Framework**: discord.py
- **AI/ML**: GitHub Copilot SDK
- **Paper Sources**: arXiv API, Google Scholar
- **Database**: SQLite / PostgreSQL
- **Task Scheduling**: APScheduler / Celery
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
│   │   ├── __init__.py
│   │   ├── discord_bot.py      # Main bot logic
│   │   ├── commands.py         # Command handlers
│   │   └── events.py           # Event handlers (reactions, etc.)
│   ├── fetchers/
│   │   ├── __init__.py
│   │   ├── arxiv_fetcher.py    # arXiv API integration
│   │   └── scholar_fetcher.py  # Google Scholar scraper
│   ├── summarizer/
│   │   ├── __init__.py
│   │   └── copilot_summarizer.py  # Copilot SDK integration
│   ├── database/
│   │   ├── __init__.py
│   │   ├── models.py           # Database models
│   │   └── operations.py       # CRUD operations
│   ├── scheduler/
│   │   ├── __init__.py
│   │   └── tasks.py            # Scheduled tasks
│   └── utils/
│       ├── __init__.py
│       ├── config.py           # Configuration management
│       └── logger.py           # Logging utilities
├── tests/
│   ├── test_fetchers.py
│   ├── test_summarizer.py
│   └── test_database.py
├── config/
│   └── config.yaml             # Configuration file
├── data/
│   └── papers.db              # SQLite database (if used)
├── .env.example               # Environment variables template
├── .gitignore
├── requirements.txt
├── docker-compose.yml         # Docker setup
├── Dockerfile
├── README.md
└── TODO.md
