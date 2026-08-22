import * as path from 'path';
import * as os from 'os';
import { ValidationError } from './errors.js';

export interface PathConfig {
  projectRoot: string;
  allowedExportDirs?: string[];
}

export function getDefaultAllowedDirs(projectRoot: string): string[] {
  const resolvedRoot = path.resolve(projectRoot);
  const homeBackups = path.join(os.homedir(), '.behavior-runtime-mcp', 'backups');
  return [resolvedRoot, homeBackups];
}

export function loadPathConfig(projectRoot: string): PathConfig {
  return {
    projectRoot: path.resolve(projectRoot),
    allowedExportDirs: getDefaultAllowedDirs(projectRoot),
  };
}

export function validatePath(filePath: string, config: PathConfig): string {
  if (!filePath || typeof filePath !== 'string') {
    throw new ValidationError('File path must be a non-empty string.');
  }

  let resolved: string;
  if (path.isAbsolute(filePath)) {
    resolved = path.resolve(filePath);
  } else {
    resolved = path.resolve(config.projectRoot, filePath);
  }

  const allowed = (config.allowedExportDirs || [config.projectRoot]).map((d) => path.resolve(d));
  const isAllowed = allowed.some((dir) => {
    return resolved === dir || resolved.startsWith(dir + path.sep);
  });

  if (!isAllowed) {
    throw new ValidationError(
      `Access denied: path "${filePath}" resolves outside allowed directories.`
    );
  }

  return resolved;
}
