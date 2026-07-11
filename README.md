# Prompt Playground

Compare streamed responses from OpenAI, Anthropic, xAI, and Google models through OpenRouter.

## Requirements

- Node.js 20 or newer
- An [OpenRouter API key](https://openrouter.ai/settings/keys)

## Setup

1. Run `npm install`.
2. Create a file named `.secrets` in the project root.
3. Add your OpenRouter API key to `.secrets` using this exact variable name:

   ```dotenv
   OPENROUTER_API_KEY=your_openrouter_api_key
   ```

   You can also copy the included example first:

   ```bash
   cp .secrets.example .secrets
   ```

4. Run `npm run dev`.
5. Open [http://localhost:3000](http://localhost:3000).

## Keeping your key private

The `.secrets` file is ignored by Git and must never be committed or shared. Only `.secrets.example`, which contains a placeholder rather than a real key, belongs in source control.

The application reads `OPENROUTER_API_KEY` only in server routes; it is never sent to or stored by browser code. Prompt and model configuration are stored locally in the browser, while results are not persisted.
