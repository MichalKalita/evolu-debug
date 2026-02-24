import type { Evolu, EvoluSchema } from '@evolu/common'
import type { InjectionKey } from 'vue'

export const EvoluDebugEvoluContext = Symbol(
  'EvoluDebugEvoluContext',
) as InjectionKey<Evolu>

export const EvoluDebugSchemaContext = Symbol(
  'EvoluDebugSchemaContext',
) as InjectionKey<EvoluSchema>
