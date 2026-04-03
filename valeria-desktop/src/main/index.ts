// src/main/index.ts

import { app, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'

/**
 * Create the main application window.
 *
 * BrowserWindow is Electron's window class. Each window gets its own
 * renderer process (its own Chromium instance). Most apps have one
 * window, but you could create multiple.
 */
function createWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 500,
    height: 700,
    minWidth: 400,
    minHeight: 500,
    title: 'Valeria',
    // webPreferences controls the renderer's capabilities
    webPreferences: {
      // The preload script path — this runs before the page loads
      preload: join(__dirname, '../preload/index.js'),
      // sandbox: true means the renderer has NO Node.js access
      // (this is the default in modern Electron, but being explicit)
      sandbox: true
    }
  })

  // In development, load from the Vite dev server (hot reloading)
  // In production, load from the built HTML file
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return mainWindow
}

// ============================================================
// IPC HANDLERS
// ============================================================

/**
 * Echo handler — a simple round-trip test.
 *
 * ipcMain.handle() registers a handler for invoke-style IPC.
 * When the renderer calls window.electronAPI.echo("hello"),
 * this function runs in the main process and the return value
 * is sent back to the renderer as the resolved Promise.
 *
 * This is the "invoke/handle" pattern — like a function call
 * across processes. The renderer invokes, the main handles.
 */
ipcMain.handle('echo', async (_event, message: string) => {
  // In a real app, this is where you'd do heavy work:
  // transcribe audio, run the LLM, read files, etc.
  // For now, just echo the message back.
  return `Main process received: "${message}"`
})

/**
 * Streaming test handler — simulates how LLM tokens will flow.
 *
 * Unlike echo (which returns one value), this sends multiple
 * events over time using webContents.send(). The renderer
 * listens for these events and displays each one as it arrives.
 *
 * This is the "send/on" pattern — like a live stream.
 * The main process sends whenever it wants, the renderer listens.
 *
 * In milestone 7, this exact pattern will stream LLM tokens.
 */
ipcMain.handle('start-streaming-test', async (event) => {
  const sender = event.sender
  const tokens = [
    'Hello',
    ',',
    ' I',
    ' am',
    ' Valeria',
    '.',
    ' How',
    ' can',
    ' I',
    ' help',
    ' you',
    ' today',
    '?'
  ]

  for (const token of tokens) {
    // Send each token to the renderer with a small delay
    // to simulate real LLM generation speed
    await new Promise((resolve) => setTimeout(resolve, 100))
    sender.send('stream-token', token)
  }

  // Signal that streaming is complete
  sender.send('stream-complete')
  return { tokenCount: tokens.length }
})

// ============================================================
// APP LIFECYCLE
// ============================================================

/**
 * app.whenReady() resolves when Electron has finished initializing.
 * This is where you create windows and set up the app.
 */
app.whenReady().then(() => {
  // Set the app user model ID (for Linux/Windows notifications)
  electronApp.setAppUserModelId('com.valeria.assistant')

  // Watch for new windows and optimize them
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()

  // On macOS, re-create the window when the dock icon is clicked
  // and no windows are open (standard macOS behavior)
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

/**
 * Quit the app when all windows are closed.
 * Exception: on macOS, apps stay active until Cmd+Q.
 */
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
