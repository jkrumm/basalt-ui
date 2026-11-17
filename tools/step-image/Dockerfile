# The unit step's image on the factory's step host (project.yaml `steps.unit.dockerfile`): the factory's own image
# (Ubuntu 24.04, git, make, bun) plus what the unit suite also runs: Node (the oxlint RuleTester suites and the
# plugin's JS runtime run under `node`) and Google Chrome (the shot harness's real-Chrome tests launch the
# `chrome` channel, which playwright-core resolves to /opt/google/chrome/chrome). The step host builds this once per
# content, from stdin: there is no build context, so nothing here is COPYed.
FROM ubuntu:24.04
# The factory passes BUN: the version of package.json's `packageManager`.
ARG BUN
# Keep equal to .nvmrc; tests/step-image.test.ts fails when they differ.
ARG NODE=24.11.1

RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl git make unzip xz-utils \
 && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL -o /tmp/bun.zip "https://github.com/oven-sh/bun/releases/download/bun-v$BUN/bun-linux-x64.zip" \
 && unzip -q /tmp/bun.zip -d /tmp && mv /tmp/bun-linux-x64/bun /usr/local/bin/bun && ln -s bun /usr/local/bin/bunx \
 && rm -rf /tmp/bun.zip /tmp/bun-linux-x64

RUN curl -fsSL "https://nodejs.org/dist/v$NODE/node-v$NODE-linux-x64.tar.xz" | tar -xJ -C /usr/local --strip-components=1 \
 && rm -f /usr/local/CHANGELOG.md /usr/local/LICENSE /usr/local/README.md

# The .deb pulls Chrome's own library dependencies; the image is frozen at the Chrome of its build day.
RUN curl -fsSL -o /tmp/chrome.deb https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb \
 && apt-get update && apt-get install -y --no-install-recommends /tmp/chrome.deb \
 && rm -rf /tmp/chrome.deb /var/lib/apt/lists/*
