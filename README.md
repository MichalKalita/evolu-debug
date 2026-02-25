# Evolu Debug

Debug overlay for [Evolu](https://www.evolu.dev/) apps.

`evolu-debug` mounts a floating inspector UI into a Shadow DOM root, so host page styles do not break the debug panel.

## Install

```bash
npm install evolu-debug
```

## Usage

Call `evoluDebug(evolu, schema)` after you create your Evolu instance.

```ts
import { createEvolu, id, NonEmptyString, type EvoluSchema } from '@evolu/common'
import { evoluWebDeps } from '@evolu/web'
import evoluDebug from 'evolu-debug'

const TodoId = id('Todo')

const DatabaseSchema = {
  todo: {
    id: TodoId,
    title: NonEmptyString,
  },
} satisfies EvoluSchema

const evolu = createEvolu(evoluWebDeps)(DatabaseSchema, {
  name: 'my-app',
})

evoluDebug(evolu, DatabaseSchema)
```

After initialization, a floating button appears in the bottom-right corner:

- `Open Evolu Debug` to open the overlay
- Browse tables and rows
- Inspect schema details
- Insert/edit rows for application tables

## Recommended Setup

Use it only in development:

```ts
if (import.meta.env.DEV) {
  const { default: evoluDebug } = await import('evolu-debug')
  evoluDebug(evolu, DatabaseSchema)
}
```

## API

```ts
evoluDebug<Schema extends EvoluSchema>(evolu: Evolu<Schema>, schema: Schema): void
```

## License

MIT
