const path = require("path");
const fs = require("fs/promises");

/**
 * Context Manager - Handles reading, writing, and deleting context files for features
 */
class ContextManager {
  /**
   * Write output to feature context file
   */
  async writeToContextFile(projectPath, featureId, content) {
    if (!projectPath) return;

    try {
      const contextDir = path.join(projectPath, ".automaker", "agents-context");

      // Ensure directory exists
      try {
        await fs.access(contextDir);
      } catch {
        await fs.mkdir(contextDir, { recursive: true });
      }

      const filePath = path.join(contextDir, `${featureId}.md`);

      // Append to existing file or create new one
      try {
        const existing = await fs.readFile(filePath, "utf-8");
        await fs.writeFile(filePath, existing + content, "utf-8");
      } catch {
        await fs.writeFile(filePath, content, "utf-8");
      }
    } catch (error) {
      console.error("[ContextManager] Failed to write to context file:", error);
    }
  }

  /**
   * Read context file for a feature
   */
  async readContextFile(projectPath, featureId) {
    try {
      const contextPath = path.join(
        projectPath,
        ".automaker",
        "agents-context",
        `${featureId}.md`
      );
      const content = await fs.readFile(contextPath, "utf-8");
      return content;
    } catch (error) {
      console.log(`[ContextManager] No context file found for ${featureId}`);
      return null;
    }
  }

  /**
   * Delete agent context file for a feature
   */
  async deleteContextFile(projectPath, featureId) {
    if (!projectPath) return;

    try {
      const contextPath = path.join(
        projectPath,
        ".automaker",
        "agents-context",
        `${featureId}.md`
      );
      await fs.unlink(contextPath);
      console.log(
        `[ContextManager] Deleted agent context for feature ${featureId}`
      );
    } catch (error) {
      // File might not exist, which is fine
      if (error.code !== "ENOENT") {
        console.error("[ContextManager] Failed to delete context file:", error);
      }
    }
  }

  /**
   * Read the memory.md file containing lessons learned and common issues
   * Returns formatted string to inject into prompts
   */
  async getMemoryContent(projectPath) {
    if (!projectPath) return "";

    try {
      const memoryPath = path.join(projectPath, ".automaker", "memory.md");

      // Check if file exists
      try {
        await fs.access(memoryPath);
      } catch {
        // File doesn't exist, return empty string
        return "";
      }

      const content = await fs.readFile(memoryPath, "utf-8");

      if (!content.trim()) {
        return "";
      }

      return `
**🧠 Agent Memory - Previous Lessons Learned:**

The following memory file contains lessons learned from previous agent runs, including common issues and their solutions. Review this carefully to avoid repeating past mistakes.

<agent-memory>
${content}
</agent-memory>

**IMPORTANT:** If you encounter a new issue that took significant debugging effort to resolve, add it to the memory file at \`.automaker/memory.md\` in a concise format:
- Issue title
- Problem description (1-2 sentences)
- Solution/fix (with code example if helpful)

This helps future agent runs avoid the same pitfalls.
`;
    } catch (error) {
      console.error("[ContextManager] Failed to read memory file:", error);
      return "";
    }
  }

  /**
   * List context files from .automaker/context/ directory and get previews
   * Returns a formatted string with file names and first 50 lines of each file
   */
  async getContextFilesPreview(projectPath) {
    if (!projectPath) return "";

    try {
      const contextDir = path.join(projectPath, ".automaker", "context");

      // Check if directory exists
      try {
        await fs.access(contextDir);
      } catch {
        // Directory doesn't exist, return empty string
        return "";
      }

      // Read directory contents
      const entries = await fs.readdir(contextDir, { withFileTypes: true });
      const files = entries
        .filter((entry) => entry.isFile())
        .map((entry) => entry.name)
        .sort();

      if (files.length === 0) {
        return "";
      }

      // Build preview string
      const previews = [];
      previews.push(`\n**📁 Context Files Available:**\n`);
      previews.push(
        `The following context files are available in \`.automaker/context/\` directory.`
      );
      previews.push(
        `These files contain additional context that may be relevant to your work.`
      );
      previews.push(
        `You can read them in full using the Read tool if needed.\n`
      );

      for (const fileName of files) {
        try {
          const filePath = path.join(contextDir, fileName);
          const content = await fs.readFile(filePath, "utf-8");
          const lines = content.split("\n");
          const previewLines = lines.slice(0, 50);
          const preview = previewLines.join("\n");
          const hasMore = lines.length > 50;

          previews.push(`\n**File: ${fileName}**`);
          if (hasMore) {
            previews.push(
              `(Showing first 50 of ${lines.length} lines - use Read tool to see full content)`
            );
          }
          previews.push(`\`\`\``);
          previews.push(preview);
          previews.push(`\`\`\`\n`);
        } catch (error) {
          console.error(
            `[ContextManager] Failed to read context file ${fileName}:`,
            error
          );
          previews.push(`\n**File: ${fileName}** (Error reading file)\n`);
        }
      }

      return previews.join("\n");
    } catch (error) {
      console.error("[ContextManager] Failed to list context files:", error);
      return "";
    }
  }
}

module.exports = new ContextManager();
