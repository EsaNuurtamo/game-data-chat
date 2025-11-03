# Supercell Technical Assessment: Game Analytics MCP Server

> **Note:** The code, implementation approaches, and technical solutions you provide as part of this assessment belong to you. Supercell will only use your submission to evaluate your technical skills and determine if you would be a good fit for a position at Supercell.

## Why This Challenge?

- **Tool agnostic:** Python rules AI/ML, but the best engineers pick the right tool. Cloudflare has first-class support for remote MCP servers, and TypeScript/JavaScript shines here.
- **Production first:** By the end, you’ll have a **fully deployed** agent solution with a remote MCP server.
- **Embrace constraints:** Serverless limits on Cloudflare create real-world tradeoffs; show how you turn constraints into design wins.
- **Real systems:** MCP is fast becoming the standard for LLM-to-tool communication. You’ll work with real APIs and production-like constraints.

## The Task

Build an MCP server with tools for fetching and analyzing video-game data from the **RAWG API**. Create a UI where an LLM agent can use your tools to answer analytical questions about games.

- **Time:** 4–8 hours
- **Deploy:** Cloudflare (free tier)

## Requirements

### 1) MCP Tools

#### `fetch_game_data`

- Fetches game data from the RAWG API
- Supports filters: genre, platform, time period
- Returns raw data for downstream calculations

#### `execute_calculation`

- Performs numerical computations on fetched data
- Returns calculated results (e.g., averages, counts, comparisons)

The LLM should orchestrate these tools to answer questions.

### 2) Built-in Evaluation Display

Your app **must** demonstrate correctness. Include a UI section (even a simple static block) that shows how you validated calculations.

#### Example Queries Your System Should Handle

1. **Average Metacritic for PC games in Q1 2024**
   - Fetch PC games released Jan–Mar 2024
   - Compute the average Metacritic score

2. **Genre with most highly rated games in 2023**
   - Group games by genre for 2023
   - Compute average ratings per genre
   - Return the top genre

3. **PlayStation vs Xbox exclusives comparison**
   - Fetch exclusives by platform
   - Compare average ratings
   - Return a clear comparison

## Deliverable

Provide **one URL** to your deployed app that:

- Has a UI to interact with your MCP server (chat, form, etc.)
- Displays evaluation metrics
- Actually works

Provide **one link** to your GitHub repository containing:

- Source code
- A README that explains:
  - Your approach and architecture
  - Constraints/limitations you hit and how you handled them
  - Rough time breakdown
  - Any extra details useful for discussion

**Example:**

- App: `https://your-app.cloudflare.com`
- Code: `https://github.com/yourusername/your-app`

## Setup

1. Get a RAWG API key: [https://rawg.io/apidocs](https://rawg.io/apidocs)
2. Deploy on Cloudflare.

## Evaluation

We will:

1. Use your UI to run various queries
2. Check your self-reported accuracy
3. Verify calculations are correct

We’ll review your code for:

- Clean architecture
- Sound calculation approach
- Overall code quality

**Bonus points for:**

- Clever calculation design
- Client-to-server authentication
- Excellent UX

## What We’re Looking For

Show that you’re a **builder**. A deployed system that handles 80% of cases beats undeployed perfection. Document constraints and choices in your README—we’ll dig into them in the discussion.
