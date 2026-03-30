# TODO List 📝

## Phase 1: Project Setup ✅
- [ ] Initialize Git repository
- [ ] Create project structure (folders and files)
- [ ] Initialize npm project (package.json)
- [ ] Set up TypeScript (tsconfig.json)
- [ ] Install dependencies (discord.js, dotenv, etc.)
- [ ] Create .env.example template
- [ ] Set up .gitignore
- [ ] Configure logging system (winston)

**Estimated Time**: 1-2 hours

---

## Phase 2: Database Layer 🗄️
- [ ] Design database schema
  - [ ] Papers table (id, title, authors, abstract, url, arxiv_id, fetch_date, domain)
  - [ ] Recommendations table (paper_id, channel_id, recommended_date)
  - [ ] Favorites table (user_id, paper_id, favorited_date)
- [ ] Implement database models using better-sqlite3 or TypeORM
- [ ] Create CRUD operations
  - [ ] Add paper
  - [ ] Check if paper already recommended
  - [ ] Get papers by domain
  - [ ] Add/remove favorites
  - [ ] Get user favorites
- [ ] Write database migration scripts
- [ ] Add database unit tests

**Estimated Time**: 3-4 hours

---

## Phase 3: Paper Fetchers 📄
### 3.1 arXiv Fetcher
- [ ] Research arXiv API documentation
- [ ] Implement arXiv API client using axios
- [ ] Create search function by domain/keywords
- [ ] Parse arXiv XML response (title, authors, abstract, PDF link)
- [ ] Handle API rate limits and errors
- [ ] Add unit tests for arXiv fetcher

### 3.2 Google Scholar Fetcher
- [ ] Research Google Scholar scraping methods (puppeteer/cheerio)
- [ ] Implement Scholar scraper
- [ ] Parse Scholar results
- [ ] Handle rate limiting and CAPTCHA issues
- [ ] Add fallback mechanisms
- [ ] Add unit tests for Scholar fetcher

**Estimated Time**: 4-6 hours

---

## Phase 4: GitHub Copilot Summarizer 🤖
- [ ] Research GitHub Copilot SDK documentation (https://docs.github.com/en/copilot/how-tos/copilot-sdk/sdk-getting-started)
- [ ] Install @copilot-extensions/preview-sdk
- [ ] Set up Copilot API credentials
- [ ] Design summarization prompt template
  - [ ] Extract key findings
  - [ ] Summarize methodology
  - [ ] Highlight conclusions
  - [ ] Format for Discord (markdown)
- [ ] Implement summarization function
- [ ] Add error handling and retries
- [ ] Optimize token usage
- [ ] Add unit tests

**Estimated Time**: 3-4 hours

---

## Phase 5: Discord Bot - Basic Setup 🤖
- [ ] Create Discord application on Discord Developer Portal
- [ ] Get bot token
- [ ] Set up discord.js bot
- [ ] Implement bot connection and basic event handlers
- [ ] Design command structure
- [ ] Set up command error handling
- [ ] Test basic bot functionality (ping, echo)

**Estimated Time**: 2-3 hours

---

## Phase 6: Discord Bot - Manual Mode 💬
- [ ] Implement slash commands using Discord.js CommandBuilder
- [ ] Implement `/fetch` command
  - [ ] Parse parameters (count, domain/keywords)
  - [ ] Validate input
  - [ ] Fetch papers based on request
- [ ] Implement paper display format (Discord embeds)
- [ ] Add loading/progress indicators
- [ ] Implement `/list` command to show recent recommendations
- [ ] Implement `/favorites` command to show user's saved papers
- [ ] Add error messages and user feedback
- [ ] Test all manual commands

**Commands to implement**:
```
/fetch <count> <domain> - Fetch N papers from specified domain
/list - Show recently recommended papers
/favorites - Show your saved papers
/help - Show available commands
```

**Estimated Time**: 4-5 hours

---

## Phase 7: Discord Bot - Reaction System ⭐
- [ ] Implement reaction event handler
- [ ] Define favorite emoji (e.g., ⭐ or 📌)
- [ ] Save paper to favorites on reaction
- [ ] Remove from favorites when reaction removed
- [ ] Add confirmation feedback
- [ ] Handle edge cases (already favorited, paper not found)
- [ ] Test reaction system

**Estimated Time**: 2-3 hours

---

## Phase 8: Automatic Scheduler ⏰
- [ ] Install node-cron or node-schedule
- [ ] Implement scheduler setup
- [ ] Create scheduled task function
  - [ ] Fetch papers from configured domains
  - [ ] Summarize papers
  - [ ] Post to configured channel
- [ ] Implement configuration for:
  - [ ] Schedule time (cron expression or interval)
  - [ ] Target channel ID
  - [ ] Domains to monitor
  - [ ] Number of papers per batch
- [ ] Add enable/disable scheduler commands
- [ ] Test scheduled tasks

**Commands to add**:
```
/schedule enable - Enable automatic daily posts
/schedule disable - Disable automatic posts
/schedule status - Check scheduler status
/schedule config - Show/update scheduler configuration
```

**Estimated Time**: 3-4 hours

---

## Phase 9: Configuration System ⚙️
- [ ] Create config.yaml structure
- [ ] Implement configuration loader (js-yaml)
- [ ] Support for:
  - [ ] Discord settings (token, channel IDs, emoji)
  - [ ] Scheduler settings (time, frequency, domains)
  - [ ] Fetcher settings (API keys, rate limits)
  - [ ] Summarizer settings (prompt templates, token limits)
  - [ ] Database settings
- [ ] Add configuration validation (zod or joi)
- [ ] Create environment variable override system
- [ ] Document all configuration options

**Estimated Time**: 2-3 hours

---

## Phase 10: Integration & Testing 🧪
- [ ] Integrate all modules together
- [ ] End-to-end testing (jest or vitest)
  - [ ] Test manual fetch flow
  - [ ] Test automatic scheduler
  - [ ] Test favorite system
  - [ ] Test database operations
- [ ] Load testing (handle multiple requests)
- [ ] Error recovery testing
- [ ] Write integration tests
- [ ] Fix bugs and edge cases

**Estimated Time**: 4-6 hours

---

## Phase 11: Deployment & Documentation 🚀
- [ ] Create Dockerfile
- [ ] Create docker-compose.yml
- [ ] Set up environment variables
- [ ] Write deployment instructions
- [ ] Add usage examples to README
- [ ] Create user guide
- [ ] Add contribution guidelines
- [ ] Set up CI/CD with GitHub Actions (optional)
- [ ] Deploy to server/cloud (VPS, Railway, Render, etc.)

**Estimated Time**: 3-4 hours

---

## Phase 12: Enhancements (Future) 🌟
- [ ] Web dashboard for managing favorites (Next.js/React)
- [ ] Support for more paper sources (IEEE, ACM, PubMed)
- [ ] Advanced filtering (date range, citation count)
- [ ] Paper recommendations based on user preferences
- [ ] Multi-language support (i18next)
- [ ] Export favorites to BibTeX/Zotero
- [ ] Paper discussion threads
- [ ] Email notifications (nodemailer)
- [ ] Slack/Teams integration

---

## Development Priority

### MVP (Minimum Viable Product)
Focus on these phases first for a working prototype:
1. ✅ Phase 1: Project Setup
2. ✅ Phase 2: Database Layer
3. ✅ Phase 3.1: arXiv Fetcher (skip Scholar for MVP)
4. ✅ Phase 4: Copilot Summarizer
5. ✅ Phase 5: Discord Bot - Basic Setup
6. ✅ Phase 6: Discord Bot - Manual Mode
7. ✅ Phase 7: Reaction System

**MVP Estimated Time**: 20-28 hours

### Full Version
Add remaining features:
8. Phase 8: Automatic Scheduler
9. Phase 9: Configuration System
10. Phase 10: Integration & Testing
11. Phase 11: Deployment

**Full Version Estimated Time**: 35-50 hours total

---

## Notes & Considerations

### Technical Challenges
1. **Google Scholar**: May require proxies or puppeteer due to rate limiting
2. **Copilot SDK**: TypeScript only - must use @copilot-extensions/preview-sdk
3. **Discord Rate Limits**: Be careful with message/embed limits
4. **Error Handling**: Papers might fail to download or summarize

### Recommendations
- Start with arXiv only (simpler API, no scraping needed)
- Use better-sqlite3 for MVP (easier setup than PostgreSQL)
- Use node-cron (simpler than complex schedulers)
- Use Discord.js slash commands for better UX
- Add comprehensive logging with winston from the start
- Keep summarization prompts configurable

### Dependencies to Add
```json
{
  "dependencies": {
    "discord.js": "^14.x",
    "@copilot-extensions/preview-sdk": "latest",
    "axios": "^1.x",
    "dotenv": "^16.x",
    "better-sqlite3": "^9.x",
    "node-cron": "^3.x",
    "winston": "^3.x",
    "js-yaml": "^4.x"
  },
  "devDependencies": {
    "typescript": "^5.x",
    "@types/node": "^20.x",
    "ts-node": "^10.x",
    "nodemon": "^3.x",
    "jest": "^29.x",
    "@types/jest": "^29.x"
  }
}
```

### Environment Variables Needed
```
DISCORD_BOT_TOKEN=your_token_here
DISCORD_CLIENT_ID=your_client_id_here
DISCORD_CHANNEL_ID=your_channel_id
GITHUB_TOKEN=your_github_token_here
DATABASE_PATH=./data/papers.db
FAVORITE_EMOJI=⭐
COPILOT_MODEL=gpt-4
LOG_LEVEL=info
```
