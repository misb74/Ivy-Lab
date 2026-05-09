import fs from 'fs';
import path from 'path';

export function scaffoldPythonProject(projectDir: string, projectName: string): string[] {
  const files: Array<{ path: string; content: string }> = [
    {
      path: 'requirements.txt',
      content: `flask>=3.0.0
flask-cors>=4.0.0
`,
    },
    {
      path: 'app.py',
      content: `from flask import Flask, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

@app.route('/')
def index():
    return jsonify({"name": "${projectName}", "status": "running"})

@app.route('/api/health')
def health():
    return jsonify({"status": "ok"})

@app.route('/api/data')
def data():
    return jsonify({"message": "Hello from ${projectName}!", "data": []})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=3000, debug=True)
`,
    },
    {
      path: 'README.md',
      content: `# ${projectName}

## Setup
\`\`\`bash
pip3 install -r requirements.txt
python3 app.py
\`\`\`
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
