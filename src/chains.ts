import { type ApplyConstellationPayload } from '@zodiac-os/api-types'

export type ChainShortNames =
  ApplyConstellationPayload['specification'][number]['chain']
