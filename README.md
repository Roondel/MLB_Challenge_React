# 30 Ballpark Challenge

A personal project to track visits to all 30 MLB ballparks across the United States. The goal: attend a game at every Major League Baseball stadium.

## What it does

**Dashboard** — Shows overall progress toward the 30-park goal with a progress ring, stats, and a chart of recent visits.

**Interactive Map** — A zoomable map of all 30 parks. Visited parks are highlighted; tap any marker to see park details.

**Park Detail & Check-In** — Log a visit with the date, a star rating, personal notes, the opponent and score, and a photo. All visits are saved to your account.

**Photo Gallery** — A visual record of every park you've visited, browsable and filterable.

**Trip Planner** — Pick a set of parks and a date range. The planner builds a schedule-aware route using real MLB game times, accounts for driving distances, and flags parks that can't realistically be reached within the window.

**Offline Support** — The app works without an internet connection using locally cached data, and syncs automatically when connectivity is restored.

## How it was built

The app is a React single-page application backed by AWS serverless infrastructure: Lambda functions, DynamoDB, S3, and CloudFront. Authentication uses Amazon Cognito. Infrastructure is defined as code using AWS CloudFormation.

## AI-Assisted Development

This project was built using [Claude Code](https://claude.ai/code) (Anthropic's CLI for Claude) with the following MCP servers and plugins active throughout development:

| Tool | Purpose |
|------|---------|
| AWS Serverless MCP (awslabs) | Lambda guidance, serverless templates, SAM tooling |
| AWS IaC MCP | CloudFormation template validation, compliance checks, CDK/CF documentation |
| Playwright (VSCode extension via MCP) | Browser automation for end-to-end test authoring |
| Google Maps Platform Code Assist MCP | Maps API integration guidance and best practices |
| Maps Grounding Lite | Real-world geographic context for route planning features |
| Superpowers plugin | Structured development workflows: brainstorming, TDD, plan execution |
