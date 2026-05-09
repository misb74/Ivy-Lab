import fs from 'fs';
import path from 'path';

export function scaffoldApiServer(projectDir: string, projectName: string): string[] {
  const files: Array<{ path: string; content: string }> = [
    {
      path: 'package.json',
      content: JSON.stringify({
        name: projectName,
        version: '1.0.0',
        type: 'module',
        scripts: {
          start: 'node src/index.js',
          dev: 'node --watch src/index.js',
        },
        dependencies: {
          express: '^4.18.0',
          cors: '^2.8.5',
        },
      }, null, 2),
    },
    {
      path: 'src/index.js',
      content: `import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ name: '${projectName}', status: 'running', timestamp: new Date().toISOString() });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/data', (req, res) => {
  res.json({ message: 'Hello from ${projectName}!', data: [] });
});

app.listen(PORT, () => {
  console.log(\`${projectName} API server running on http://localhost:\${PORT}\`);
});
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
