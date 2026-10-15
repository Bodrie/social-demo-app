# 0004 – Vite + React 19 + Tailwind/shadcn

Date: 2026-10-15 · Status: Accepted · Plan: §2.7, D3, D4

## Context
The CRA client did not build from a fresh clone, re-created its QueryClient on every render, keyed queries wrongly, and used MUI only for icons on top of 1.9k lines of SCSS with a mixin that doubled the CSS per theme.

## Decision
- Vite 8 + React 19 + TypeScript, React Router 7 (data mode), TanStack Query 5, react-hook-form + zod.
- Tailwind CSS 4 + shadcn/ui primitives + lucide-react icons; theming via CSS variables and `data-theme`.
- Auth state comes from `GET /auth/me`, not `localStorage`.
- Placeholder features (stories, tag people, share, social links, left-bar items) are removed (D9); delete post/comment, user search, followers/following lists and infinite scroll are added (D10).

## Consequences
- The visual language (palette, layout) is ported, not redesigned.
- MUI, emotion, moment, react-cookie and CRA tooling are gone.
