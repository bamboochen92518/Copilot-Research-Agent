# TODO List 📝

## Phase 1: Project Setup ✅
- [x] Initialize Git repository
- [x] Create project structure (folders and files)
- [x] Initialize npm project (package.json)
- [x] Set up TypeScript (tsconfig.json)
- [x] Install dependencies (discord.js, dotenv, etc.)
- [x] Create .env.example template
- [x] Set up .gitignore
- [x] Configure logging system (winston)

**Status**: ✅ COMPLETED

**Estimated Time**: 1-2 hours

---

## Phase 2: Database Layer 🗄️ ✅
- [x] Design database schema
  - [x] Papers table (id, title, authors, abstract, url, doi, openalex_id, pdf_url, cited_by_count, publication_year, fetch_date, topics)
  - [x] Recommendations table (paper_id, channel_id, recommended_date)
  - [x] Favorites table (user_id, paper_id, favorited_date)
- [x] Implement database models using better-sqlite3
- [x] Create CRUD operations
  - [x] Add paper
  - [x] Check if paper already recommended
  - [x] Get papers by topics
  - [x] Get papers by citation count
  - [x] Add/remove favorites
  - [x] Get user favorites
- [x] Write database migration scripts
- [x] Add database unit tests

**Status**: ✅ COMPLETED

---

## Phase 3: Paper Fetcher 📄 (OpenAlex) ✅

**Why OpenAlex?**
- ✅ Native citation data built-in
- ✅ Built-in date range filtering
- ✅ Modern REST API with JSON responses
- ✅ Comprehensive coverage (250M+ works across all fields)
- ✅ Advanced filtering options (citations, venues, topics)
- ✅ Free and open (100k requests/day, no API key needed)

**Tasks**:
- [x] Research OpenAlex API documentation (https://docs.openalex.org)
- [x] Implement OpenAlex API client using axios
- [x] Create search function with filters:
  - [x] Search by keywords/concepts
  - [x] Filter by publication year range
  - [x] Filter by minimum citation count
  - [x] Filter by topics/fields
  - [x] Filter by venue (journal/conference)
- [x] Parse JSON response (title, authors, abstract, DOI, PDF link, citations)
- [x] Handle API rate limits (polite pool: 100k/day, ~1 req/sec)
- [x] Implement cursor-based pagination
- [x] Add unit tests for OpenAlex fetcher
- [x] Create demo scripts

**API Example**:
```
GET https://api.openalex.org/works?filter=publication_year:2023-2024,cited_by_count:>50,concepts.id:C41008148
```

**Status**: ✅ COMPLETED

**Estimated Time**: 3-4 hours

---

## Phase 4: GitHub Copilot Summarizer 🤖 ✅
- [x] Research GitHub Copilot SDK documentation (https://docs.github.com/en/copilot/how-tos/copilot-sdk/sdk-getting-started)
- [x] Install @github/copilot-sdk
- [x] Set up Copilot API credentials (GITHUB_TOKEN env var — auto-read by SDK)
- [x] Design summarization prompt template
  - [x] Extract key findings
  - [x] Summarize methodology
  - [x] Highlight conclusions
  - [x] Format for Discord (markdown)
- [x] Implement summarization function
- [x] Add error handling and retries
- [x] Optimize token usage
- [x] Add unit tests

**Status**: ✅ COMPLETED

---

## Phase 5: Discord Bot - Basic Setup 🤖 ✅
- [x] Create Discord application on Discord Developer Portal
- [x] Get bot token
- [x] Set up discord.js bot
- [x] Implement bot connection and basic event handlers
- [x] Design command structure
- [x] Set up command error handling
- [x] Test basic bot functionality (ping, help)

**Status**: ✅ COMPLETED

---

## Phase 6: Discord Bot - Manual Mode 💬 ✅
- [x] Implement slash commands using Discord.js CommandBuilder
- [x] Implement `/fetch` command
  - [x] Parse parameters (count, domain/keywords)
  - [x] Validate input
  - [x] Fetch papers based on request
- [x] Implement paper display format (Discord embeds)
- [x] Add loading/progress indicators
- [x] Implement `/list` command to show recent recommendations
- [x] Implement `/favorites` command to show user's saved papers
- [x] Add error messages and user feedback
- [x] Test all manual commands

**Commands implemented**:
```
/fetch <count> <domain> - Fetch N papers from specified domain
/list - Show recently recommended papers
/favorites - Show your saved papers
/help - Show available commands
```

**Status**: ✅ COMPLETED

---

## Phase 7: Discord Bot - Reaction System ⭐ ✅
- [x] Implement reaction event handler
- [x] Define favorite emoji (⭐)
- [x] Save paper to favorites on reaction
- [x] Remove from favorites when reaction removed
- [x] Add message_papers table to track message → paper mapping
- [x] Record message ID when posting paper embeds in /fetch

**Status**: ✅ COMPLETED

---

## Phase 8: Automatic Scheduler ⏰ ✅
- [x] Install node-cron or node-schedule
- [x] Implement scheduler setup
- [x] Create scheduled task function
  - [x] Fetch papers from configured domains
  - [x] Summarize papers
  - [x] Post to configured channel
- [x] Implement configuration for:
  - [x] Schedule time (cron expression or interval)
  - [x] Target channel ID
  - [x] Domains to monitor
  - [x] Number of papers per batch
- [x] Add enable/disable scheduler commands
- [x] Test scheduled tasks

**Commands added**:
```
/schedule enable  - Enable automatic daily posts (configure channel, cron, domains, count)
/schedule disable - Disable automatic posts
/schedule status  - Check scheduler status and configuration
```

**Status**: ✅ COMPLETED

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
2. Phase 2: Database Layer
3. Phase 3: OpenAlex Fetcher
4. Phase 4: Copilot Summarizer
5. Phase 5: Discord Bot - Basic Setup
6. Phase 6: Discord Bot - Manual Mode
7. Phase 7: Reaction System

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
1. **OpenAlex Rate Limits**: Stay within polite pool (100k/day, ~1 req/sec)
2. **Copilot SDK**: TypeScript only - must use @copilot-extensions/preview-sdk
3. **Discord Rate Limits**: Be careful with message/embed limits
4. **Error Handling**: Papers might fail to download or summarize
5. **Pagination**: OpenAlex uses cursor-based pagination for large result sets

### Recommendations
- Use OpenAlex for comprehensive paper coverage with built-in citations
- Use better-sqlite3 for MVP (easier setup than PostgreSQL)
- Use node-cron (simpler than complex schedulers)
- Use Discord.js slash commands for better UX
- Add comprehensive logging with winston from the start
- Keep summarization prompts configurable
- Provide email to OpenAlex for polite pool access

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
