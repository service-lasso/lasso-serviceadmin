import { render, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ServiceTerminalSessionState } from '@/features/logs/provider'

const mocks = vi.hoisted(() => ({
  attachServiceTerminal: vi.fn(),
  fetchServiceTerminalOutput: vi.fn(),
  sendServiceTerminalRawInput: vi.fn(),
  sendServiceTerminalResize: vi.fn(),
  terminalWrite: vi.fn(),
  terminalDispose: vi.fn(),
  inputSubscriptionDispose: vi.fn(),
  fit: vi.fn(),
  dataHandler: null as ((data: string) => void) | null,
  resizeCallback: null as (() => void) | null,
}))

const {
  attachServiceTerminal,
  fetchServiceTerminalOutput,
  sendServiceTerminalRawInput,
  sendServiceTerminalResize,
  terminalWrite,
  terminalDispose,
  inputSubscriptionDispose,
  fit,
} = mocks

vi.mock('@/features/logs/provider', () => ({
  attachServiceTerminal: (...args: unknown[]) => mocks.attachServiceTerminal(...args),
  fetchServiceTerminalOutput: (...args: unknown[]) => mocks.fetchServiceTerminalOutput(...args),
  sendServiceTerminalRawInput: (...args: unknown[]) => mocks.sendServiceTerminalRawInput(...args),
  sendServiceTerminalResize: (...args: unknown[]) => mocks.sendServiceTerminalResize(...args),
}))

vi.mock('@xterm/xterm', () => ({
  Terminal: class {
    open() {}
    loadAddon() {}
    write = mocks.terminalWrite
    dispose = mocks.terminalDispose
    rows = 30
    cols = 100
    onData(handler: (data: string) => void) {
      mocks.dataHandler = handler
      return { dispose: mocks.inputSubscriptionDispose }
    }
  },
}))

vi.mock('@xterm/addon-fit', () => ({ FitAddon: class { fit = mocks.fit } }))
vi.mock('@xterm/xterm/css/xterm.css', () => ({}))

import { ServiceTerminalEmulator } from './service-terminal-emulator'

class FakeResizeObserver {
  constructor(callback: () => void) {
    mocks.resizeCallback = callback
  }
  observe() {}
  disconnect() {}
}

function sessionState(
  overrides: Partial<ServiceTerminalSessionState> = {}
): ServiceTerminalSessionState {
  return {
    serviceId: 'echo-tui',
    available: true,
    rows: 30,
    cols: 100,
    sequence: 0,
    childPid: 4242,
    error: null,
    readOnly: false,
    reason: null,
    ...overrides,
  }
}

function renderEmulator(state = sessionState()) {
  return render(
    <ServiceTerminalEmulator
      service={{ id: 'echo-tui' } as never}
      initialState={state}
    />
  )
}

describe('ServiceTerminalEmulator', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.dataHandler = null
    mocks.resizeCallback = null
    globalThis.ResizeObserver =
      FakeResizeObserver as unknown as typeof ResizeObserver
    attachServiceTerminal.mockResolvedValue({
      serviceId: 'echo-tui',
      sessionToken: 'session-token',
      readOnly: false,
      rows: 30,
      cols: 100,
      expiresAt: Date.now() + 60000,
    })
    fetchServiceTerminalOutput.mockResolvedValue({
      ...sessionState(),
      sequence: 3,
      data: Buffer.from('hello-pty').toString('base64'),
      truncated: false,
    })
    sendServiceTerminalRawInput.mockResolvedValue({
      serviceId: 'echo-tui',
      accepted: true,
      byteLength: 1,
    })
    sendServiceTerminalResize.mockResolvedValue({
      serviceId: 'echo-tui',
      resized: true,
      rows: 30,
      cols: 100,
    })
  })

  it('attaches with the token, streams output and forwards keys and resize', async () => {
    const view = renderEmulator()

    await waitFor(() => {
      expect(attachServiceTerminal).toHaveBeenCalledWith({ id: 'echo-tui' })
      expect(terminalWrite).toHaveBeenCalled()
    })
    expect(fetchServiceTerminalOutput).toHaveBeenCalledWith(
      { id: 'echo-tui' },
      0,
      'session-token'
    )

    mocks.dataHandler?.('a')
    await waitFor(() => {
      expect(sendServiceTerminalRawInput).toHaveBeenCalledWith(
        { id: 'echo-tui' },
        Buffer.from('a').toString('base64'),
        'session-token'
      )
    })

    mocks.resizeCallback?.()
    await waitFor(() => {
      expect(sendServiceTerminalResize).toHaveBeenCalledWith(
        { id: 'echo-tui' },
        30,
        100,
        'session-token'
      )
    })

    view.unmount()
    expect(terminalDispose).toHaveBeenCalled()
    expect(inputSubscriptionDispose).toHaveBeenCalled()
  })

  it('does not forward input for a read-only session', async () => {
    renderEmulator(sessionState({ readOnly: true }))

    await waitFor(() => expect(terminalWrite).toHaveBeenCalled())
    mocks.dataHandler?.('x')
    expect(sendServiceTerminalRawInput).not.toHaveBeenCalled()
  })

  it('surfaces an attach failure without throwing', async () => {
    attachServiceTerminal.mockRejectedValueOnce(new Error('already attached'))
    const view = renderEmulator()

    await waitFor(() => {
      expect(view.getByText(/already attached/u)).toBeTruthy()
    })
    expect(terminalWrite).not.toHaveBeenCalled()
  })
})
