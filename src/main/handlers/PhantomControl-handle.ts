import { ipcMain, BrowserWindow, app, screen, globalShortcut, clipboard } from 'electron'
import { keyboard, Key } from '@nut-tree-fork/nut-js'
import path from 'path'
import fs from 'fs/promises'

let phantomWindow: BrowserWindow | null = null

export default function registerPhantomKeyboard() {
  // ====================================================================
  // 1. THE SUMMONING (Spawns at your exact physical mouse location)
  // ====================================================================
  const summonPhantom = async () => {
    if (phantomWindow) return // Prevent multiple ghosts

    try {
      // Get exact mouse coordinates to spawn the UI right under your cursor
      const cursorPoint = screen.getCursorScreenPoint()

      const widgetDir = path.join(app.getPath('userData'), 'DynamicWidgets')
      await fs.mkdir(widgetDir, { recursive: true })
      const filePath = path.join(widgetDir, `phantom_ui_${Date.now()}.html`)

      const htmlCode = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body, html { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; font-family: 'Inter', sans-serif; background: transparent; }
            
            .phantom-bar {
              width: 100vw; height: 100vh; box-sizing: border-box;
              background: rgba(10, 10, 10, 0.85); backdrop-filter: blur(20px);
              border: 1px solid rgba(52, 211, 153, 0.4); border-radius: 12px;
              box-shadow: 0 10px 40px rgba(0,0,0,0.8), 0 0 20px rgba(52, 211, 153, 0.15);
              display: flex; align-items: center; padding: 0 16px; gap: 12px;
            }

            .ghost-icon {
              width: 18px; height: 18px; color: #34d399;
              animation: float 3s ease-in-out infinite;
            }
            @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-3px); } }

            input {
              flex: 1; background: transparent; border: none; outline: none;
              color: #e4e4e7; font-size: 14px; font-weight: 500; font-family: 'Consolas', monospace;
            }
            input::placeholder { color: #52525b; }

            .loader { display: none; width: 14px; height: 14px; border: 2px solid rgba(52,211,153,0.2); border-top-color: #34d399; border-radius: 50%; animation: spin 0.8s linear infinite; }
            @keyframes spin { 100% { transform: rotate(360deg); } }
          </style>
        </head>
        <body>
          <div class="phantom-bar">
            <svg class="ghost-icon" id="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 10h.01"/><path d="M15 10h.01"/><path d="M12 2a8 8 0 0 0-8 8v12l3-3 2.5 2.5L12 19l2.5 2.5L17 19l3 3V10a8 8 0 0 0-8-8z"/></svg>
            <div class="loader" id="loader"></div>
            <input type="text" id="prompt" placeholder="Command the ghost..." autocomplete="off" spellcheck="false" autofocus>
          </div>

          <script>
            const { ipcRenderer } = require('electron');
            const input = document.getElementById('prompt');
            const icon = document.getElementById('icon');
            const loader = document.getElementById('loader');

            // Auto-focus the input instantly
            window.onload = () => input.focus();

            // Handle submission or cancellation
            input.addEventListener('keydown', (e) => {
              if (e.key === 'Escape') {
                ipcRenderer.send('phantom-close');
              }
              if (e.key === 'Enter' && input.value.trim() !== '') {
                // UI transition to loading state
                input.disabled = true;
                input.style.color = '#34d399';
                icon.style.display = 'none';
                loader.style.display = 'block';
                
                // Send prompt to Node.js backend
                ipcRenderer.send('phantom-execute', input.value.trim());
              }
            });
          </script>
        </body>
        </html>
      `
      await fs.writeFile(filePath, htmlCode, 'utf-8')

      // Spawn a sleek 500x50 bar centered right above the mouse cursor
      phantomWindow = new BrowserWindow({
        x: Math.round(cursorPoint.x - 250),
        y: Math.round(cursorPoint.y - 60),
        width: 500,
        height: 50,
        transparent: true,
        frame: false,
        alwaysOnTop: true,
        skipTaskbar: true,
        resizable: false,
        type: 'toolbar',
        webPreferences: { nodeIntegration: true, contextIsolation: false }
      })

      phantomWindow.setAlwaysOnTop(true, 'screen-saver')
      phantomWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
      await phantomWindow.loadFile(filePath)

      phantomWindow.on('blur', () => {
        // If they click away, close the ghost to be unintrusive
        if (phantomWindow) {
          phantomWindow.close()
          phantomWindow = null
        }
      })

      phantomWindow.on('closed', () => {
        phantomWindow = null
        fs.unlink(filePath).catch(() => {})
      })
    } catch (error) {
      console.error('Phantom Forge Error:', error)
    }
  }

  // 🚨 TRIGGER: Ctrl + Alt + Space spawns the Ghost
  globalShortcut.register('CommandOrControl+Alt+Space', summonPhantom)

  // Allow UI to close itself on Escape
  ipcMain.on('phantom-close', () => {
    if (phantomWindow) phantomWindow.close()
  })

  // ====================================================================
  // 2. THE BRAIN & THE MUSCLE (Gemini API -> Nut.js Injection)
  // ====================================================================
  ipcMain.on('phantom-execute', async (event, promptText) => {
    try {
      const apiKey = (import.meta.env as any).VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY
      if (!apiKey) throw new Error('API key missing.')

      // 1. Fetch from Gemini 2.5 Flash
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  // Strict prompt to ensure it doesn't output conversational junk or markdown
                  {
                    text: `You are Phantom, a raw text generation engine. Output ONLY the exact raw text or code requested. Do NOT use markdown code blocks (like \`\`\`javascript). Do NOT add conversational filler like "Here is the code". Just output the exact raw string that should be typed into the user's application.\n\nUser Request: ${promptText}`
                  }
                ]
              }
            ]
          })
        }
      )

      const data = await response.json()
      const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text

      if (!aiResponse) throw new Error('AI failed to generate response.')

      // 2. Destroy the Phantom Window immediately.
      // This is CRITICAL. It forces the OS to return focus to the user's previous app (VS Code, Chrome, etc.)
      if (phantomWindow) phantomWindow.close()

      // Wait a fraction of a second for the OS window focus to fully shift back
      await new Promise((r) => setTimeout(r, 150))

      // 3. ULTRA-POWERFUL INJECTION: Clipboard Hijack & Paste via Nut.js
      // We save their current clipboard so we don't ruin their copy-paste history
      const originalClipboard = clipboard.readText()

      // Load AI response into clipboard
      clipboard.writeText(aiResponse)

      // Tell Nut.js to physically press Ctrl + V (or Cmd + V on Mac)
      const isMac = process.platform === 'darwin'
      const modifier = isMac ? Key.LeftSuper : Key.LeftControl

      keyboard.config.autoDelayMs = 10 // Extremely fast
      await keyboard.pressKey(modifier, Key.V)
      await keyboard.releaseKey(Key.V, modifier)

      // Wait a tiny bit for the OS to process the paste, then restore their clipboard
      setTimeout(() => {
        clipboard.writeText(originalClipboard)
      }, 500)

      console.log('👻 Phantom Injection Complete.')
    } catch (error) {
      console.error('Phantom Execution Failed:', error)
      if (phantomWindow) phantomWindow.close()
    }
  })
}
