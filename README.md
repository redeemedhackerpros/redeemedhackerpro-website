# Redeemed Hacker Pro — short-form publishing starter

This starter creates short evergreen cybersecurity awareness posts from a curated topic file, checks for duplicates, and publishes only posts that pass local checks. It is template-based and does not require a paid AI API.

## Safe defaults
- Maximum 20 posts per UTC day.
- Maximum 5 posts per scheduled run.
- Duplicate-title and normalized-content-hash checks.
- Only topics listed in `content/topics/topics.json` are used.
- No live-news claims, invented statistics, or promises of guaranteed protection.
- Generated pages go to `posts/YYYY/MM/slug.html`; `posts/index.html` lists them.

## Install into your existing repository
1. Download and unzip this kit.
2. Copy `.github/`, `scripts/`, and `content/` into the ROOT of your existing `redeemedhackerpro-website` repository. Merge folders if they already exist.
3. Back up any existing `posts/` folder before merging generated content.
4. Commit the files to `main`.
5. In GitHub, open **Settings → Actions → General** and check that workflows are allowed. The workflow requests `contents: write`; organization policies may override this.
6. Open **Actions → Redeemed Hacker Pro - Short Posts** and click **Run workflow**.
7. Check the logs; passing posts are committed automatically.
8. Once hosting is configured, visit `/posts/`.

## Schedule
The workflow runs at 00:17, 08:17, and 16:17 UTC. Each run attempts at most five posts; the hard cap is twenty per UTC day. GitHub scheduled runs may be delayed.

## Limits and AI
This starter uses curated topics and templates, not a generative AI API. It does not generate current news or videos. A consumer AI subscription does not automatically include free API usage. If adding AI later, use provider credentials only as GitHub Actions secrets and impose strict cost limits.

## Hosting policy warning
GitHub's published policy says Pages is not intended or allowed as free hosting for websites primarily directed at running an online business or commercial service. Confirm your intended use with GitHub or use a host whose terms fit your business before production use. Netlify's free tier currently lists 300 monthly usage credits and sites can pause when credits run out. Cloudflare Pages documents free static-asset requests, while functions use Workers quotas. Check current terms and limits before migrating; no free plan guarantees unlimited commercial publishing.
