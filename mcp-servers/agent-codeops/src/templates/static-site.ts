import fs from 'fs';
import path from 'path';

export function scaffoldStaticSite(projectDir: string, projectName: string): string[] {
  const files: Array<{ path: string; content: string }> = [
    {
      path: 'index.html',
      content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${projectName}</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div class="container">
    <h1>${projectName}</h1>
    <p>Scaffolded by Ivy</p>
  </div>
  <script src="script.js"></script>
</body>
</html>
`,
    },
    {
      path: 'style.css',
      content: `* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: system-ui, sans-serif; background: #f5f5f5; color: #333; }
.container { max-width: 800px; margin: 0 auto; padding: 2rem; }
h1 { margin-bottom: 1rem; }
`,
    },
    {
      path: 'script.js',
      content: `console.log('${projectName} loaded');
`,
    },
    {
      path: 'package.json',
      content: JSON.stringify({
        name: projectName,
        version: '1.0.0',
        scripts: {
          dev: 'npx serve -p 3000',
        },
      }, null, 2),
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
