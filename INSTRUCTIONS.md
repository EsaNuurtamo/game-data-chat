Supercell Technical Assessment: Game Analytics MCP Server

Supercell_LLM_Engineer_Assignme…

Note: The code, implementation approaches, and technical solutions that you provide as part of this assessment belong to you. Supercell will only use your submission to evaluate your technical skills and determine if you would be a good fit for a position at Supercell.

Supercell_LLM_Engineer_Assignme…

Why This Challenge?

Supercell_LLM_Engineer_Assignme…

Tool Agnostic: While Python dominates AI/ML, great engineers use the right tool for the job. Cloudflare has first-class support for remote MCP servers and TypeScript/JavaScript excels here.

Production First: By the end of this task, you’ll have a fully deployed agent solution with a remote MCP server.

Embrace Constraints: Cloudflare’s serverless architecture creates interesting challenges; we want to see how you turn constraints into creative solutions.

Real Systems: This isn’t a toy problem. MCP is becoming the standard for LLM-to-tool communication, and what you build here could be the foundation for production AI systems. You’ll work with real APIs and real constraints—just like production.

Supercell_LLM_Engineer_Assignme…

The Task

Supercell_LLM_Engineer_Assignme…

Build an MCP server with tools for fetching and analyzing video-game data from the RAWG API. Create a UI where an LLM agent can use your tools to answer analytical questions about games.

Time: 4–8 hours

Deploy: Cloudflare (free tier)

Supercell_LLM_Engineer_Assignme…

Requirements

1. MCP Tools

Supercell_LLM_Engineer_Assignme…

fetch_game_data

Gets game data from the RAWG API

Filters by genre, platform, time period

Returns raw data for processing

execute_calculation

Handles numerical computations

Returns calculated results

The LLM should be able to orchestrate these tools to answer questions.

Supercell_LLM_Engineer_Assignme…

2. Built-in Evaluation Display

Supercell_LLM_Engineer_Assignme…

Your app must demonstrate correctness. Build something into your UI (a simple static display is fine) that proves your calculations are accurate.

Example Queries Your System Should Handle

“What’s the average Metacritic score for PC games released in Q1 2024?”

Fetch PC games from Jan–Mar 2024

Calculate average Metacritic score

“Which genre had the most highly-rated games in 2023?”

Fetch games by genre for 2023

Calculate average ratings per genre

Compare and return the winner

“How do PlayStation exclusive ratings compare to Xbox exclusives?”

Fetch games for each platform

Calculate and compare average ratings

Return the comparison

Supercell_LLM_Engineer_Assignme…

Deliverable

Supercell_LLM_Engineer_Assignme…

Provide one URL to your deployed app that:

Has a UI to interact with your MCP server (chat interface, form, etc.)

Displays evaluation metrics

Actually works

Provide one link to your GitHub repository containing:

Your source code

A README that explains:

How you approached the problem

Challenges/limitations you encountered

Roughly how you spent your time

Anything else relevant for the discussion

Example:

App: https://your-app.cloudflare.com

Code: https://github.com/yourusername/your-app

Supercell_LLM_Engineer_Assignme…

Setup

Supercell_LLM_Engineer_Assignme…

Get a RAWG API key: https://rawg.io/apidocs

Deploy on Cloudflare

Evaluation

Supercell_LLM_Engineer_Assignme…

We’ll visit your URL and:

Test your tools with different queries

Check your self-reported accuracy

Verify calculations are correct

We’ll review your code for:

Clean architecture and implementation

How you solved the calculation challenge

Overall code quality

Bonus points for:

Creative solutions to the calculation tool

Client-to-server authentication

Exceptional user experience

What We’re Looking For

Supercell_LLM_Engineer_Assignme…

Show us you’re a builder. We care more about working systems than perfect code. A deployed solution that handles 80% of queries well beats undeployed code that would theoretically handle 100%.

You’ll likely encounter constraints and limitations—document these in your README, as we’ll discuss your approach in detail.

Good luck!
