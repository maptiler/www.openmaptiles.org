source "https://rubygems.org"

gem "jekyll", "~> 4.4"

# GitHub-flavored markdown, matching what Astro's remark-gfm provided
gem "kramdown-parser-gfm", "~> 1.1"

group :jekyll_plugins do
  gem "jekyll-sitemap", "~> 1.4"
  # 3 docs still carry legacy redirect_from front matter that the Astro site
  # silently dropped — those URLs 404 in production today.
  gem "jekyll-redirect-from", "~> 0.16"
end

# jekyll serve needs this on Ruby 3.x
gem "webrick", "~> 1.9"
