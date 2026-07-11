# Prompt Playground

Compare streamed responses from OpenAI, Anthropic, xAI, and Google models through OpenRouter.

## Requirements

- Node.js 20 or newer
- An [OpenRouter API key](https://openrouter.ai/settings/keys)

## Setup

1. Run `npm install`.
2. Run `npm run dev`.
3. Open [http://localhost:3000](http://localhost:3000).
4. Click **Key** in the upper-right corner and enter your OpenRouter API key.

## Keeping your key private

Your key is stored only in your browser's local storage and is sent with requests to the app's server route, which forwards it to OpenRouter. It is not embedded in the project, committed to Git, or stored in a server-side file.

On a public deployment, use a deployment you trust: the key passes through that deployment's server when you run a prompt. Prompt and model configuration are also stored locally in the browser, while results are not persisted.
