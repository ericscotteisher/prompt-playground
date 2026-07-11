# Prompt Playground

Compare streamed responses from OpenAI, Anthropic, xAI, and Google models through OpenRouter.

## Setup

1. Run `npm install`.
2. Copy `.secrets.example` to `.secrets` and replace the placeholder with your OpenRouter key.
3. Run `npm run dev` and open http://localhost:3000.

The API key is read only by server routes. Prompt and model configuration are stored locally in the browser; results are not persisted.
