# Building and Testing the Poopify Extension

This guide provides instructions on how to build the Poopify Chrome extension and its backend, load it into your browser, and perform a basic smoke test to ensure it's working correctly.

## Prerequisites

- [Node.js](https://nodejs.org/) (v16 or later)
- [Python](https://www.python.org/) (v3.9 or later)
- [Google Chrome](https://www.google.com/chrome/)

## 1. Backend Setup

The backend is a Python-based FastAPI server that handles the text-to-speech processing.

1.  **Navigate to the backend directory:**
    ```bash
    cd tts-reader/backend
    ```

2.  **Create a virtual environment:**
    This isolates the project's dependencies from your system's Python environment.
    ```bash
    python3 -m venv .venv
    ```

3.  **Activate the virtual environment:**
    - On macOS/Linux:
      ```bash
      source .venv/bin/activate
      ```
    - On Windows:
      ```bash
      .venv\Scripts\activate
      ```

4.  **Install dependencies:**
    ```bash
    pip install -r requirements.txt
    ```

5.  **Run the server:**
    ```bash
    uvicorn app:app --host 127.0.0.1 --port 8000
    ```
    Keep this terminal window open. You should see output indicating the server is running.

## 2. Extension Setup

The extension is built using TypeScript and `esbuild`.

1.  **Navigate to the project root directory:**
    ```bash
    cd /path/to/your/Poopify/project
    ```

2.  **Install Node.js dependencies:**
    ```bash
    npm install
    ```

3.  **Build the extension:**
    This command compiles the TypeScript files (`.ts`) into JavaScript files (`.js`) that the browser can execute.
    ```bash
    npm run build
    ```

## 3. Loading the Extension in Chrome

1.  Open Google Chrome and navigate to `chrome://extensions`.
2.  Enable **"Developer mode"** using the toggle switch in the top-right corner.
3.  Click the **"Load unpacked"** button that appears.
4.  In the file selection dialog, navigate to and select the `clients/extension` directory within your project.
5.  The Poopify TTS extension should now appear in your list of extensions.

## 4. Performing a Smoke Test

This test verifies that the core text-to-speech functionality is working.

1.  **Ensure the backend server is running** in its terminal window.
2.  **Navigate to any webpage** with a good amount of text (e.g., a Wikipedia article).
3.  **Select a few sentences** of text with your mouse.
4.  **Right-click** on the selected text.
5.  From the context menu, select **"Read selection with Poopify"**.

### Expected Result:

- An overlay with "Pause" and "Stop" buttons should appear at the bottom-right of the webpage.
- You should hear the selected text being read aloud.

### Troubleshooting:

If the overlay does not appear or you don't hear any audio:

1.  **Check the Backend Console:** Look for any errors in the terminal where you're running the `uvicorn` server.
2.  **Check the Extension's Service Worker Console:**
    - Go back to `chrome://extensions`.
    - Find the Poopify TTS extension card.
    - Click the `service_worker` link. This will open a DevTools window for the background script.
    - Check the "Console" tab for any errors.
3.  **Check the Webpage's Console:**
    - On the webpage where you are trying to use the extension, open the DevTools (right-click anywhere on the page and select "Inspect").
    - Go to the "Console" tab and look for any errors.

These steps will help you build, install, and test the extension to ensure the overlay and TTS functionality are working as expected.
