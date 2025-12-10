/**
 * Project initialization utilities
 *
 * Handles the setup of the .automaker directory structure when opening
 * new or existing projects.
 */

import { getElectronAPI } from "./electron";

export interface ProjectInitResult {
  success: boolean;
  isNewProject: boolean;
  error?: string;
  createdFiles?: string[];
  existingFiles?: string[];
}

/**
 * Default feature_list.json template for new projects
 */
const DEFAULT_FEATURE_LIST = JSON.stringify([], null, 2);

/**
 * Required files and directories in the .automaker directory
 * Note: app_spec.txt is NOT created automatically - user must set it up via the spec editor
 */
const REQUIRED_STRUCTURE = {
  directories: [
    ".automaker",
    ".automaker/context",
    ".automaker/agents-context",
    ".automaker/images",
  ],
  files: {
    ".automaker/feature_list.json": DEFAULT_FEATURE_LIST,
  },
};

/**
 * Initializes the .automaker directory structure for a project
 *
 * @param projectPath - The root path of the project
 * @returns Result indicating what was created or if the project was already initialized
 */
export async function initializeProject(
  projectPath: string
): Promise<ProjectInitResult> {
  const api = getElectronAPI();
  const createdFiles: string[] = [];
  const existingFiles: string[] = [];

  try {
    // Create all required directories
    for (const dir of REQUIRED_STRUCTURE.directories) {
      const fullPath = `${projectPath}/${dir}`;
      await api.mkdir(fullPath);
    }

    // Check and create required files
    for (const [relativePath, defaultContent] of Object.entries(
      REQUIRED_STRUCTURE.files
    )) {
      const fullPath = `${projectPath}/${relativePath}`;
      const exists = await api.exists(fullPath);

      if (!exists) {
        await api.writeFile(fullPath, defaultContent);
        createdFiles.push(relativePath);
      } else {
        existingFiles.push(relativePath);
      }
    }

    // Determine if this is a new project (all files were created)
    const isNewProject =
      createdFiles.length === Object.keys(REQUIRED_STRUCTURE.files).length;

    return {
      success: true,
      isNewProject,
      createdFiles,
      existingFiles,
    };
  } catch (error) {
    console.error("[project-init] Failed to initialize project:", error);
    return {
      success: false,
      isNewProject: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

/**
 * Checks if a project has the required .automaker structure
 *
 * @param projectPath - The root path of the project
 * @returns true if all required files/directories exist
 */
export async function isProjectInitialized(
  projectPath: string
): Promise<boolean> {
  const api = getElectronAPI();

  try {
    // Check all required files exist
    for (const relativePath of Object.keys(REQUIRED_STRUCTURE.files)) {
      const fullPath = `${projectPath}/${relativePath}`;
      const exists = await api.exists(fullPath);
      if (!exists) {
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error(
      "[project-init] Error checking project initialization:",
      error
    );
    return false;
  }
}

/**
 * Gets a summary of what needs to be initialized for a project
 *
 * @param projectPath - The root path of the project
 * @returns List of missing files/directories
 */
export async function getProjectInitStatus(projectPath: string): Promise<{
  initialized: boolean;
  missingFiles: string[];
  existingFiles: string[];
}> {
  const api = getElectronAPI();
  const missingFiles: string[] = [];
  const existingFiles: string[] = [];

  try {
    for (const relativePath of Object.keys(REQUIRED_STRUCTURE.files)) {
      const fullPath = `${projectPath}/${relativePath}`;
      const exists = await api.exists(fullPath);
      if (exists) {
        existingFiles.push(relativePath);
      } else {
        missingFiles.push(relativePath);
      }
    }

    return {
      initialized: missingFiles.length === 0,
      missingFiles,
      existingFiles,
    };
  } catch (error) {
    console.error("[project-init] Error getting project status:", error);
    return {
      initialized: false,
      missingFiles: Object.keys(REQUIRED_STRUCTURE.files),
      existingFiles: [],
    };
  }
}

/**
 * Checks if the app_spec.txt file exists for a project
 *
 * @param projectPath - The root path of the project
 * @returns true if app_spec.txt exists
 */
export async function hasAppSpec(projectPath: string): Promise<boolean> {
  const api = getElectronAPI();
  try {
    const fullPath = `${projectPath}/.automaker/app_spec.txt`;
    return await api.exists(fullPath);
  } catch (error) {
    console.error("[project-init] Error checking app_spec.txt:", error);
    return false;
  }
}

/**
 * Checks if the .automaker directory exists for a project
 *
 * @param projectPath - The root path of the project
 * @returns true if .automaker directory exists
 */
export async function hasAutomakerDir(projectPath: string): Promise<boolean> {
  const api = getElectronAPI();
  try {
    const fullPath = `${projectPath}/.automaker`;
    return await api.exists(fullPath);
  } catch (error) {
    console.error("[project-init] Error checking .automaker dir:", error);
    return false;
  }
}
