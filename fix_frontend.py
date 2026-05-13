import os

# Clean, BOM-free content for the frontend
fix_files = {
    "frontend/package.json": """{
  "name": "frontend",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "lint": "eslint . --ext js,jsx --report-unused-disable-directives --max-warnings 0",
    "preview": "vite preview"
  },
  "dependencies": {
    "axios": "^1.6.7",
    "bootstrap": "^5.3.3",
    "react": "^18.2.0",
    "react-bootstrap": "^2.10.1",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.22.1"
  },
  "devDependencies": {
    "@types/react": "^18.2.55",
    "@types/react-dom": "^18.2.19",
    "@vitejs/plugin-react": "^4.2.1",
    "eslint": "^8.56.0",
    "eslint-plugin-react": "^7.33.2",
    "eslint-plugin-react-hooks": "^4.6.0",
    "eslint-plugin-react-refresh": "^0.4.5",
    "vite": "^5.1.0"
  }
}""",
    "frontend/index.html": """<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>SPU Exam Seating</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>""",
    "frontend/src/main.jsx": """import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import 'bootstrap/dist/css/bootstrap.min.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)"""
}

for path, content in fix_files.items():
    # Write with explicit utf-8 to avoid PowerShell encoding issues
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"Fixed encoding for: {path}")

print("\n✅ Frontend files are now clean. You can run 'npm run dev' again.")