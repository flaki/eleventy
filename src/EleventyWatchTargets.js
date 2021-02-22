const dependencyTree = require("dependency-tree");
const TemplatePath = require("./TemplatePath");
const deleteRequireCache = require("./Util/DeleteRequireCache");

class EleventyWatchTargets {
  constructor() {
    this.targets = new Set();
    this.dependencies = new Set();
    this.newTargets = new Set();
    this._watchJavaScriptDependencies = true;
  }

  set watchJavaScriptDependencies(watch) {
    this._watchJavaScriptDependencies = !!watch;
  }

  get watchJavaScriptDependencies() {
    return this._watchJavaScriptDependencies;
  }

  isJavaScriptDependency(path) {
    return this.dependencies.has(path);
  }

  _normalizeTargets(targets) {
    if (!targets) {
      return [];
    } else if (Array.isArray(targets)) {
      return targets;
    }

    return [targets];
  }

  reset() {
    this.newTargets = new Set();
  }

  isWatched(target) {
    return this.targets.has(target);
  }

  addRaw(targets, isDependency) {
    for (let target of targets) {
      let path = TemplatePath.addLeadingDotSlash(target);
      if (!this.isWatched(path)) {
        this.newTargets.add(path);
      }

      this.targets.add(path);

      if (isDependency) {
        this.dependencies.add(path);
      }
    }
  }

  // add only a target
  add(targets) {
    targets = this._normalizeTargets(targets);
    this.addRaw(targets);
  }

  addAndMakeGlob(targets) {
    targets = this._normalizeTargets(targets).map(entry =>
      TemplatePath.convertToRecursiveGlobSync(entry)
    );
    this.addRaw(targets);
  }

  // add only a target’s dependencies
  async addDependencies(targets, filterCallback) {
    if (!this.watchJavaScriptDependencies) {
      return;
    }

    targets = this._normalizeTargets(targets);
    let deps = await this.getJavaScriptDependenciesFromList(targets);
    if (filterCallback) {
      deps = deps.filter(filterCallback);
    }

    this.addRaw(deps, true);
  }

  setWriter(templateWriter) {
    this.writer = templateWriter;
  }

  async getJavaScriptDependenciesFromList(files = []) {
    let depSet = new Set();
    
    const depfiles = files
      .filter(file => file.endsWith(".js") || file.endsWith(".cjs"));
      // TODO does this need to work with aliasing? what other JS extensions will have deps?

    for (const file of depfiles) {
      const tree = dependencyTree({
        filename: file,
        directory: TemplatePath.absolutePath('.'),
        filter: path => path.indexOf('node_modules') === -1,
        isListForm: true,
      });

      // remove the last item (self)
      const esTree = tree.slice(0,tree.length-1);

      esTree.map(dependency => {
        return TemplatePath.addLeadingDotSlash(
          TemplatePath.relativePath(dependency)
        );
      })
      .forEach(dependency => {
        depSet.add(dependency);
      });
    }
    return Array.from(depSet);
  }

  clearDependencyRequireCache() {
    for (let path of this.dependencies) {
      deleteRequireCache(TemplatePath.absolutePath(path));
    }
  }

  getNewTargetsSinceLastReset() {
    return Array.from(this.newTargets);
  }

  getTargets() {
    return Array.from(this.targets);
  }
}

module.exports = EleventyWatchTargets;
