import { useEffect, useRef, useState } from 'react'
import { FitAddon } from '@xterm/addon-fit'
import { Terminal } from '@xterm/xterm'
import '@xterm/xterm/css/xterm.css'
import type { DashboardService } from '@/lib/service-lasso-dashboard/types'
import {
  attachServiceTerminal,
  fetchServiceTerminalOutput,
  sendServiceTerminalRawInput,
  sendServiceTerminalResize,
  type ServiceTerminalSessionState,
} from '@/features/logs/provider'

const terminalPollMs = 200

function base64ToBytes(value: string) {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary)
}

type ServiceTerminalEmulatorProps = {
  service: DashboardService
  initialState: ServiceTerminalSessionState
}

export function ServiceTerminalEmulator({
  service,
  initialState,
}: ServiceTerminalEmulatorProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [attached, setAttached] = useState(false)

  useEffect(() => {
    const host = hostRef.current
    if (!host) {
      return
    }
    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      scrollback: 2000,
      rows: initialState.rows,
      cols: initialState.cols,
    })
    const fit = new FitAddon()
    terminal.loadAddon(fit)
    terminal.open(host)

    let disposed = false
    let sessionToken = ''
    let sequence = initialState.sequence
    let timer: number | undefined

    const showError = (message: string) => {
      if (!disposed) {
        setError(message)
      }
    }

    const poll = async () => {
      if (disposed) {
        return
      }
      try {
        const output = await fetchServiceTerminalOutput(
          service,
          sequence,
          sessionToken
        )
        if (disposed) {
          return
        }
        if (!output.available) {
          showError(output.reason ?? 'Terminal session is unavailable.')
          return
        }
        if (output.data) {
          terminal.write(base64ToBytes(output.data))
        }
        sequence = output.sequence
        setError(null)
      } catch (nextError) {
        showError(
          nextError instanceof Error
            ? nextError.message
            : 'Terminal stream failed.'
        )
      }
      if (!disposed) {
        timer = window.setTimeout(() => void poll(), terminalPollMs)
      }
    }

    void (async () => {
      try {
        const session = await attachServiceTerminal(service)
        if (disposed) {
          return
        }
        sessionToken = session.sessionToken
        setAttached(true)
        try {
          fit.fit()
        } catch {
          // The container may not be laid out yet; the observer refits.
        }
        void poll()
      } catch (nextError) {
        showError(
          nextError instanceof Error
            ? nextError.message
            : 'Terminal attach failed.'
        )
      }
    })()

    const inputSubscription = terminal.onData((data: string) => {
      if (!sessionToken || initialState.readOnly) {
        return
      }
      void sendServiceTerminalRawInput(
        service,
        bytesToBase64(new TextEncoder().encode(data)),
        sessionToken
      ).catch((nextError: unknown) => {
        showError(
          nextError instanceof Error
            ? nextError.message
            : 'Terminal input failed.'
        )
      })
    })

    const resize = () => {
      try {
        fit.fit()
      } catch {
        return
      }
      if (sessionToken) {
        void sendServiceTerminalResize(
          service,
          terminal.rows,
          terminal.cols,
          sessionToken
        ).catch(() => undefined)
      }
    }
    const observer = new ResizeObserver(resize)
    observer.observe(host)
    window.addEventListener('resize', resize)

    return () => {
      disposed = true
      if (timer) {
        window.clearTimeout(timer)
      }
      observer.disconnect()
      window.removeEventListener('resize', resize)
      inputSubscription.dispose()
      terminal.dispose()
    }
  }, [
    service,
    initialState.rows,
    initialState.cols,
    initialState.readOnly,
    initialState.sequence,
  ])

  return (
    <div data-testid='service-terminal-emulator' className='space-y-2'>
      <div
        ref={hostRef}
        className='h-[420px] w-full overflow-hidden rounded-md border bg-black p-2'
      />
      <div className='text-xs text-muted-foreground'>
        {error
          ? `Terminal: ${error}`
          : attached
            ? initialState.readOnly
              ? 'Attached read-only.'
              : 'Attached. Use the terminal normally; detach by leaving this tab.'
            : 'Attaching to the managed terminal...'}
      </div>
    </div>
  )
}
