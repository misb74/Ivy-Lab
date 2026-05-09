import fs from 'fs';
import path from 'path';

export function scaffoldReactApp(projectDir: string, projectName: string): string[] {
  const files: Array<{ path: string; content: string }> = [
    {
      path: 'package.json',
      content: JSON.stringify({
        name: projectName,
        private: true,
        version: '0.0.0',
        type: 'module',
        scripts: {
          dev: 'vite',
          build: 'vite build',
          preview: 'vite preview',
        },
        dependencies: {
          react: '^18.2.0',
          'react-dom': '^18.2.0',
        },
        devDependencies: {
          '@vitejs/plugin-react': '^4.2.0',
          vite: '^5.0.0',
        },
      }, null, 2),
    },
    {
      path: 'vite.config.js',
      content: `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: { port: 3000, host: true },
})
`,
    },
    {
      path: 'index.html',
      content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${projectName}</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.jsx"></script>
</body>
</html>
`,
    },
    {
      path: 'src/main.jsx',
      content: `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
`,
    },
    {
      path: 'src/App.jsx',
      content: `import { useState } from 'react'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div style={{ fontFamily: 'system-ui', padding: '2rem', maxWidth: '600px', margin: '0 auto' }}>
      <h1>${projectName}</h1>
      <p>Scaffolded by Ivy</p>
      <button onClick={() => setCount(c => c + 1)} style={{ padding: '0.5rem 1rem', fontSize: '1rem' }}>
        Count: {count}
      </button>
    </div>
  )
}

export default App
`,
    },
    {
      path: 'src/index.css',
      content: `body {
  margin: 0;
  background: #f5f5f5;
  color: #333;
}
`,
    },
  ];

  const createdFiles: string[] = [];
  for (const file of files) {
    const fullPath = path.join(projectDir, file.path);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, file.content);
    createdFiles.push(file.path);
  }

  return createdFiles;
}
