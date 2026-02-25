import {
  NonEmptyString,
  SimpleName,
  createEvolu,
  id,
  nullOr,
  type EvoluSchema,
  union,
} from '@evolu/common'
import { evoluWebDeps } from '@evolu/web'
import evoluDebug from '../../src/main'

const ExampleRowId = id('ExampleRow')

const exampleSchema = {
  exampleRow: {
    id: ExampleRowId,
    title: NonEmptyString,
    status: union('todo', 'done'),
    note: nullOr(NonEmptyString),
  },
} satisfies EvoluSchema

const evolu = createEvolu(evoluWebDeps)(exampleSchema, {
  name: SimpleName.orThrow(`evshadow${String(Date.now()).slice(-8)}`),
})

void evolu.insert('exampleRow', {
  title: 'Shadow style check',
  status: 'todo',
  note: 'If this looks compact, styles are isolated.',
})

void evolu.insert('exampleRow', {
  title: 'Second row',
  status: 'done',
  note: null,
})

evoluDebug(evolu, exampleSchema)
