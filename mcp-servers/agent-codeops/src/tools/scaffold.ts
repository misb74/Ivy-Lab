import fs from 'fs';
import { getProjectDir } from '../sandbox/command-sandbox.js';
import { scaffoldReactApp } from '../templates/react-app.js';
import { scaffoldApiServer } from '../templates/api-server.js';
import { scaffoldStaticSite } from '../templates/static-site.js';
import { scaffoldPythonProject } from '../templates/python-script.js';

export type TemplateType = 'react-app' | 'api-server' | 'static-site' | 'python-script';

export interface ScaffoldParams {
  name: string;
  template: TemplateType;
}

const scaffolders: Record<TemplateType, (dir: string, name: string) => string[]> = {
  'react-app': scaffoldReactApp,
  'api-server': scaffoldApiServer,
  'static-site': scaffoldStaticSite,
  'python-script': scaffoldPythonProject,
};

export async function scaffoldProject(params: ScaffoldParams): Promise<{
  project_name: string;
  template: string;
  project_dir: string;
  files_created: string[];
  next_steps: string;
}> {
  const { name, template } = params;

  if (!scaffolders[template]) {
    throw new Error(`Unknown template "${template}". Available: ${Object.keys(scaffolders).join(', ')}`);
  }

  const projectDir = getProjectDir(name);

  if (fs.existsSync(projectDir)) {
    throw new Error(`Project directory already exists: ${projectDir}`);
  }

  fs.mkdirSync(projectDir, { recursive: true });
  const files = scaffolders[template](projectDir, name);

  const nextSteps = template === 'python-script'
    ? `cd ${projectDir} && pip3 install -r requirements.txt && python3 app.py`
    : `Use deploy_local to install dependencies and start the dev server.`;

  return {
    project_name: name,
    template,
    project_dir: projectDir,
    files_created: files,
    next_steps: nextSteps,
  };
}
