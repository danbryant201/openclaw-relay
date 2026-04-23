const fs = require('fs');
const path = require('path');

class MemoryAgent {
  constructor(bridge, workspacePath) {
    this.bridge = bridge;
    this.workspacePath = workspacePath || path.join(process.cwd());
  }

  // List all markdown files in the workspace (distilled view)
  async getStructure() {
    const scan = (dir, depth = 0) => {
      if (depth > 2) return []; // Stay shallow
      const items = fs.readdirSync(dir, { withFileTypes: true });
      let results = [];

      for (const item of items) {
        if (item.name === 'node_modules' || item.name === '.git' || item.name === '.next') continue;
        
        const fullPath = path.join(dir, item.name);
        const relativePath = path.relative(this.workspacePath, fullPath);

        if (item.isDirectory()) {
          results.push({
            name: item.name,
            path: relativePath,
            type: 'directory',
            children: scan(fullPath, depth + 1)
          });
        } else if (item.name.endsWith('.md')) {
          results.push({
            name: item.name,
            path: relativePath,
            type: 'file'
          });
        }
      }
      return results;
    };

    return scan(this.workspacePath);
  }

  async readFile(relativePath) {
    const fullPath = path.join(this.workspacePath, relativePath);
    // Safety check: ensure path is inside workspace
    if (!fullPath.startsWith(this.workspacePath)) {
      throw new Error('Access denied: path outside workspace');
    }
    return fs.readFileSync(fullPath, 'utf8');
  }

  async writeFile(relativePath, content) {
    const fullPath = path.join(this.workspacePath, relativePath);
    if (!fullPath.startsWith(this.workspacePath)) {
      throw new Error('Access denied: path outside workspace');
    }
    fs.writeFileSync(fullPath, content, 'utf8');
  }

  // Handle incoming memory requests from the Relay/Dashboard
  async handleRequest(request) {
    const { action, path: filePath, content } = request;

    switch (action) {
      case 'get_structure':
        return { type: 'memory_structure', data: await this.getStructure() };
      case 'read_file':
        return { type: 'memory_content', path: filePath, content: await this.readFile(filePath) };
      case 'write_file':
        await this.writeFile(filePath, content);
        return { type: 'memory_write_success', path: filePath };
      default:
        throw new Error(`Unknown memory action: ${action}`);
    }
  }
}

module.exports = MemoryAgent;
