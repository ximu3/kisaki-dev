export interface LibraryImageWindowApi {
  'library.images.inMarkdown'(content: string): readonly string[]
  'library.images.open'(id: string): { hold: string; url: string }
}

export type WindowInput<T> = T extends unknown ? Omit<T, 'prepared'> : never
