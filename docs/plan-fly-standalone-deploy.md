# Plan: deploying /fly as its own site

Status: the code side is done (this commit); the deploy side needs your Vercel account, which I don't have
access to from here. This doc is the steps to do it yourself - 10 minutes, no new code.

## What's already built

1. **`NEXT_PUBLIC_FLY_STANDALONE=1`** (an environment variable, set per-deployment, not per-codebase) makes the
   site's `/` redirect to `/fly` instead of showing the portfolio homepage (`next.config.ts`'s `redirects()`).
   Unset (the normal portfolio deployment), this is a no-op - nothing changes there.
2. The same flag shows a small "Godliness Dongorere →" button, bottom-right, linking to
   `profile.portfolioUrl` (`src/data/profile.ts`, currently `https://godliness.vercel.app` - update it there if
   your real domain is ever different). It fades in/out with the same idle-timer the fullscreen button already
   uses, so it never sits in the way of flying.
3. Everything else - the flight sim, the hangar, the whole `/fly` route - is exactly the same code as the main
   site. There's no separate build; both deployments come from this one repository.

## What you do on Vercel (not code - this needs your account)

1. **vercel.com → Add New → Project**, import this same GitHub repo (`gee-highness/gmd`) a second time. Vercel
   lets a single repo back more than one project.
2. Give the new project a distinct name (e.g. `fly` or `kestrel`) - that becomes its `*.vercel.app` address, or
   attach a custom domain afterward (Project → Settings → Domains), such as `fly.yourdomain.com`.
3. **Project → Settings → Environment Variables**, add `NEXT_PUBLIC_FLY_STANDALONE` = `1` (Production,
   and Preview if you want preview deploys to behave the same way).
4. Copy over whatever other env vars the build needs from the main project (the Sanity ones, if set -
   `/fly` itself doesn't use Sanity, but the build currently still needs those variables to exist; see
   `.env.example`). You do not need a *different* Sanity project - reusing the same values is fine, since this
   deployment's contact form isn't the one anyone will use.
5. Deploy. Visiting the new project's URL should land straight on `/fly`, with the small link back to
   `https://godliness.vercel.app` bottom-right.

## Why two deployments, not one deployment with a different domain alias

Vercel's free tier lets a project answer to multiple domains, but they'd all show the SAME build output -
there's no way for one deployment to behave differently (show `/fly` as home) depending on which domain it was
reached through, without either middleware keyed on `request.headers.get('host')` (more code, more to maintain)
or, simpler, exactly what's built here: one environment variable, two Vercel projects pointed at the same repo.
If you'd rather have the single-deployment/host-based version later, say so and I'll build it - it's a real
option, just more moving parts than this needed for "deploy /fly alone with a link back."
