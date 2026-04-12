import { useEffect } from 'react'

type PageMetadataOptions = {
  title: string
  description?: string
}

function upsertDescriptionMeta(description: string) {
  let meta = document.querySelector('meta[name="description"]')

  if (!meta) {
    meta = document.createElement('meta')
    meta.setAttribute('name', 'description')
    document.head.appendChild(meta)
  }

  meta.setAttribute('content', description)
}

export function usePageMetadata({ title, description }: PageMetadataOptions) {
  useEffect(() => {
    document.title = title

    if (description) {
      upsertDescriptionMeta(description)
    }
  }, [description, title])
}
