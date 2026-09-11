# Codex instructions for UltimoTurno

This is the active UltimoTurno workspace.

## Start here

Before answering status questions or editing code, read:

1. `docs/PROJECT_STATUS.md`
2. `docs/NEXT_STEPS.md`
3. `docs/new-platform/HANDOFF_NEXT_ACCOUNT.md` only if historical context is needed

## Correct project

Use this workspace:

```text
D:\UltimoTurno\Stock
```

Do not confuse it with:

```text
C:\Users\skype\Documents\Stock
```

That other folder is a separate stale/experimental Next/Sites workspace and is
not the operational UltimoTurno platform.

## Deployment reality

UltimoTurno online is deployed on Vercel and uses Supabase/Postgres.

Production app:

```text
https://ultimoturnoapp-api.vercel.app/
```

This project is not an OpenAI Sites project. Do not use `.openai/hosting.json`
or Sites tools to assess production status unless the user explicitly asks about
a different site.

## Operational focus

The current priority is stabilizing the Vercel/Supabase platform:

- full PriceCharting catalog search;
- language filters for English, Japanese, Chinese;
- Supabase-hosted images;
- add-stock workflow;
- ARS/USD price conversion and recommended prices;
- Vercel/Supabase DB pool errors.

Never paste full secrets into versioned files. Use environment variables.

