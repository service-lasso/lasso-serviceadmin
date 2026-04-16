export async function copyText(value: string): Promise<boolean> {
  if (!value) return false

  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(value)
      return true
    }
  } catch {
    // Fallback below for insecure contexts or permission failures.
  }

  try {
    const textArea = document.createElement('textarea')
    textArea.value = value
    textArea.setAttribute('readonly', '')
    textArea.style.position = 'fixed'
    textArea.style.top = '-9999px'
    textArea.style.left = '-9999px'
    document.body.appendChild(textArea)
    textArea.focus()
    textArea.select()

    const copied = document.execCommand('copy')
    document.body.removeChild(textArea)
    return copied
  } catch {
    return false
  }
}
