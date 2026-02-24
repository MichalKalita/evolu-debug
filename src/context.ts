import type { EvoluSchema } from '@evolu/common'
import type { InjectionKey } from 'vue'

export const EvoluDebugSchemaContext = Symbol(
  'EvoluDebugSchemaContext',
) as InjectionKey<EvoluSchema>
