# Pixel Perfect Replica (91)

Implement exactly the screenshot and nothing else

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/71cffdd4-6561-4a84-b283-11ea2b3c70e3).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Docker

From this folder, or from the `hishab-platform` root:

```sh
npm run docker:up
```

App listens on http://localhost:3010 (host 3000 is left free; set `APP_PORT` to change it). Ledger data stays in the browser (IndexedDB), not in the container.

```sh
npm run docker:down
npm run docker:logs
```
