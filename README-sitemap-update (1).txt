Redeemed Hacker Pro sitemap update package

Files:
- generate_posts_updated.py: replacement contents for scripts/generate_posts.py
- short-posts-workflow-updated.yml: replacement workflow contents

What changed:
- The publishing script regenerates the root sitemap.xml using the homepage, privacy page,
  terms page, posts index, and every non-index HTML file under posts/.
- The workflow stages sitemap.xml along with posts and the published manifest.

How to apply using GitHub's web interface:
1. Open the repository redeemedhackerpros/redeemedhackerpro-website.
2. Open scripts/generate_posts.py, click Edit (pencil), replace all contents with
   generate_posts_updated.py, then commit the change to main.
3. Open the existing workflow file under .github/workflows that contains the workflow
   named "Redeemed Hacker Pro - Short Posts". Edit that existing file and replace its
   contents with short-posts-workflow-updated.yml, then commit to main.
   Do not create a second scheduled workflow unless you intentionally want two.
4. Run the workflow once with limit 1 from the Actions tab. Check the run log.
5. Confirm https://redeemedhackerpro.com/sitemap.xml now lists the article URLs.

Important:
- Do not upload this ZIP as a ZIP and expect GitHub to unpack it into the repository.
  Use the files inside to replace the existing files in GitHub.
- The sitemap will include all non-index .html files under posts/. If similarly named files
  are duplicate/obsolete articles, review their canonical tags and content separately later.
- No DNS, domain, or hosting settings are changed by these files.
