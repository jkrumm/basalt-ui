You are building the internal dashboard for a small specialty-coffee roastery. The app in this directory
is a fresh Vite + React app with basalt-ui already installed and initialised. The data is in `data/`:

- `orders.json`: online orders, bags and revenue per day for the last 60 days
- `target.json`: October revenue to date, day by day, against the month's target
- `channels.json`: October revenue by sales channel
- `products.json`: bags sold in October per product
- `log.json`: the operations log for October

Build one page at `/overview` that tells the owner, at a glance, how the business is doing this month.
It has to answer five questions:

1. Are online orders trending up or down?
2. Will we hit this month's revenue target?
3. Where does our revenue come from?
4. Which coffees sell best?
5. What happened in operations lately, and does anything need attention?

Make it look professional, in light and dark, on a desktop and on a phone. Import the JSON directly; there is
no API. Before you finish, `bun run build`, `bun run lint:basalt` and `bunx basalt-ui doctor` must pass. Take at
most three rounds of screenshots of your own work.
