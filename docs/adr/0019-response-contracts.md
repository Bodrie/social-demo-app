# 0019 – Every JSON response is parsed with its shared schema

Date: 2026-10-22 · Status: Accepted · Plan: `IMPLEMENTATION_PLAN.md` E4 (backlog: `@ZodResponse` on every handler)

## Context
Requests were validated with the shared zod schemas from the start. Responses were not: handlers
returned what the services mapped, and only the web checked the result, by parsing it with the
same schemas in `lib/api/client.ts`. A mapper that selected one column too many would have sent
it. A shape that broke the contract only showed up as a client-side parse error in a browser,
with nothing in the API's logs. The OpenAPI document described inputs only. The unused
`ZodSerializerInterceptor` had been removed in the 2026-10-19 review (C5) until this was done
properly.

## Decision
- Every handler that answers JSON carries `@ZodResponse({ status, type })` (nestjs-zod),
  replacing its `@HttpCode`. The types are `createZodDto` classes over the shared schemas,
  collected in `apps/api/src/common/responses.dto.ts` because several modules answer the same
  shape. TypeScript checks each handler's return type against the schema.
- The global `ZodSerializerInterceptor` parses every answer with that schema. Unknown keys are
  dropped. An answer that does not match is a `ZodSerializationException`: the filter turns it
  into the generic masked 500 and logs the method, URL and failing paths, without the values.
  It used to be indistinguishable from a request validation error (both expose
  `getZodError()`), which would have answered 400 with the response's field names. The filter
  now tells them apart by class.
- The OpenAPI document is 3.1: zod writes nullable fields as `type: [..., "null"]`, which 3.0
  does not have. Each response refers to a `…Dto_Output` component.
- Handlers without a body (`204`) keep `@HttpCode(204)`. `GET /health` (terminus documents it)
  and the stream of an uploaded file have no response schema.

## Consequences
- A contract mismatch fails on the server, visibly and in the logs, in every integration test
  that touches the route, instead of in a browser.
- Each response is parsed once more on the server: a page of 20 posts is a few hundred small
  objects, negligible next to the query.
- A new route needs a response DTO, or a new entry in `responses.dto.ts` for a new shape.
