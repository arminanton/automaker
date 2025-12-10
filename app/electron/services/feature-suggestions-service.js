const { query, AbortError } = require("@anthropic-ai/claude-agent-sdk");
const promptBuilder = require("./prompt-builder");

/**
 * Feature Suggestions Service - Analyzes project and generates feature suggestions
 */
class FeatureSuggestionsService {
  constructor() {
    this.runningAnalysis = null;
  }

  /**
   * Generate feature suggestions by analyzing the project
   */
  async generateSuggestions(projectPath, sendToRenderer, execution) {
    console.log(
      `[FeatureSuggestions] Generating suggestions for: ${projectPath}`
    );

    try {
      const abortController = new AbortController();
      execution.abortController = abortController;

      const options = {
        model: "claude-sonnet-4-20250514",
        systemPrompt: this.getSystemPrompt(),
        maxTurns: 50,
        cwd: projectPath,
        allowedTools: ["Read", "Glob", "Grep", "Bash"],
        permissionMode: "acceptEdits",
        sandbox: {
          enabled: true,
          autoAllowBashIfSandboxed: true,
        },
        abortController: abortController,
      };

      const prompt = this.buildAnalysisPrompt();

      sendToRenderer({
        type: "suggestions_progress",
        content: "Starting project analysis...\n",
      });

      const currentQuery = query({ prompt, options });
      execution.query = currentQuery;

      let fullResponse = "";
      for await (const msg of currentQuery) {
        if (!execution.isActive()) break;

        if (msg.type === "assistant" && msg.message?.content) {
          for (const block of msg.message.content) {
            if (block.type === "text") {
              fullResponse += block.text;
              sendToRenderer({
                type: "suggestions_progress",
                content: block.text,
              });
            } else if (block.type === "tool_use") {
              sendToRenderer({
                type: "suggestions_tool",
                tool: block.name,
                input: block.input,
              });
            }
          }
        }
      }

      execution.query = null;
      execution.abortController = null;

      // Parse the suggestions from the response
      const suggestions = this.parseSuggestions(fullResponse);

      sendToRenderer({
        type: "suggestions_complete",
        suggestions: suggestions,
      });

      return {
        success: true,
        suggestions: suggestions,
      };
    } catch (error) {
      if (error instanceof AbortError || error?.name === "AbortError") {
        console.log("[FeatureSuggestions] Analysis aborted");
        if (execution) {
          execution.abortController = null;
          execution.query = null;
        }
        return {
          success: false,
          message: "Analysis aborted",
          suggestions: [],
        };
      }

      console.error(
        "[FeatureSuggestions] Error generating suggestions:",
        error
      );
      if (execution) {
        execution.abortController = null;
        execution.query = null;
      }
      throw error;
    }
  }

  /**
   * Parse suggestions from the LLM response
   * Looks for JSON array in the response
   */
  parseSuggestions(response) {
    try {
      // Try to find JSON array in the response
      // Look for ```json ... ``` blocks first
      const jsonBlockMatch = response.match(/```json\s*([\s\S]*?)```/);
      if (jsonBlockMatch) {
        const parsed = JSON.parse(jsonBlockMatch[1].trim());
        if (Array.isArray(parsed)) {
          return this.validateSuggestions(parsed);
        }
      }

      // Try to find a raw JSON array
      const jsonArrayMatch = response.match(/\[\s*\{[\s\S]*\}\s*\]/);
      if (jsonArrayMatch) {
        const parsed = JSON.parse(jsonArrayMatch[0]);
        if (Array.isArray(parsed)) {
          return this.validateSuggestions(parsed);
        }
      }

      console.warn(
        "[FeatureSuggestions] Could not parse suggestions from response"
      );
      return [];
    } catch (error) {
      console.error("[FeatureSuggestions] Error parsing suggestions:", error);
      return [];
    }
  }

  /**
   * Validate and normalize suggestions
   */
  validateSuggestions(suggestions) {
    return suggestions
      .filter((s) => s && typeof s === "object")
      .map((s, index) => ({
        id: `suggestion-${Date.now()}-${index}`,
        category: s.category || "Uncategorized",
        description: s.description || s.title || "No description",
        steps: Array.isArray(s.steps) ? s.steps : [],
        priority: typeof s.priority === "number" ? s.priority : index + 1,
        reasoning: s.reasoning || "",
      }))
      .sort((a, b) => a.priority - b.priority);
  }

  /**
   * Get the system prompt for feature suggestion analysis
   */
  getSystemPrompt() {
    return `You are an expert software architect and product manager. Your job is to analyze a codebase and suggest missing features that would improve the application.

You should:
1. Thoroughly analyze the project structure, code, and any existing documentation
2. Identify what the application does and what features it currently has (look at the .automaker/app_spec.txt file as well if it exists)
3. Generate a comprehensive list of missing features that would be valuable to users
4. Prioritize features by impact and complexity
5. Provide clear, actionable descriptions and implementation steps

When analyzing, look at:
- README files and documentation
- Package.json, cargo.toml, or similar config files for tech stack
- Source code structure and organization
- Existing features and their implementation patterns
- Common patterns in similar applications
- User experience improvements
- Developer experience improvements
- Performance optimizations
- Security enhancements

You have access to file reading and search tools. Use them to understand the codebase.`;
  }

  /**
   * Build the prompt for analyzing the project
   */
  buildAnalysisPrompt() {
    return `Analyze this project and generate a list of suggested features that are missing or would improve the application.

**Your Task:**

1. First, explore the project structure:
   - Read README.md, package.json, or similar config files
   - Scan the source code directory structure
   - Identify the tech stack and frameworks used
   - Look at existing features and how they're implemented

2. Identify what the application does:
   - What is the main purpose?
   - What features are already implemented?
   - What patterns and conventions are used?

3. Generate feature suggestions:
   - Think about what's missing compared to similar applications
   - Consider user experience improvements
   - Consider developer experience improvements
   - Think about performance, security, and reliability
   - Consider testing and documentation improvements

4. **CRITICAL: Output your suggestions as a JSON array** at the end of your response, formatted like this:

\`\`\`json
[
  {
    "category": "User Experience",
    "description": "Add dark mode support with system preference detection",
    "steps": [
      "Create a ThemeProvider context to manage theme state",
      "Add a toggle component in the settings or header",
      "Implement CSS variables for theme colors",
      "Add localStorage persistence for user preference"
    ],
    "priority": 1,
    "reasoning": "Dark mode is a standard feature that improves accessibility and user comfort"
  },
  {
    "category": "Performance",
    "description": "Implement lazy loading for heavy components",
    "steps": [
      "Identify components that are heavy or rarely used",
      "Use React.lazy() and Suspense for code splitting",
      "Add loading states for lazy-loaded components"
    ],
    "priority": 2,
    "reasoning": "Improves initial load time and reduces bundle size"
  }
]
\`\`\`

**Important Guidelines:**
- Generate at least 10-20 feature suggestions
- Order them by priority (1 = highest priority)
- Each feature should have clear, actionable steps
- Categories should be meaningful (e.g., "User Experience", "Performance", "Security", "Testing", "Documentation", "Developer Experience", "Accessibility", etc.)
- Be specific about what files might need to be created or modified
- Consider the existing tech stack and patterns when suggesting implementation steps

Begin by exploring the project structure.`;
  }

  /**
   * Stop the current analysis
   */
  stop() {
    if (this.runningAnalysis && this.runningAnalysis.abortController) {
      this.runningAnalysis.abortController.abort();
    }
    this.runningAnalysis = null;
  }
}

module.exports = new FeatureSuggestionsService();
