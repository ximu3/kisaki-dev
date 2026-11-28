import type { AnimeFileMetadata } from '@kisaki3/desktop-contracts/library'
export interface VideoInformation {
  metadata: AnimeFileMetadata
  tracks: readonly {
    type: 'video' | 'audio' | 'sub'
    index: number
    codec: string | null
    language: string | null
    title: string | null
  }[]
  chapters: readonly { time: number; title: string | null }[]
}
