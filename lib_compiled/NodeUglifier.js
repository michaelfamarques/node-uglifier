// Generated by CoffeeScript 1.10.0
(function() {
  var Errors, Graph, NodeUglifier, UGLIFY_SOURCE_MAP_TOKEN, UglifyJS, _, cryptoUtils, fs, fsExtra, packageUtils, path, saltLength, sugar, util,
    bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };

  Errors = require("./libs/Errors");

  Graph = require("./libs/js-graph-mod/src/js-graph");

  fsExtra = require('fs-extra');

  fs = require('fs');

  _ = require('underscore');

  sugar = require('sugar');

  path = require('path');

  packageUtils = require('./libs/packageUtils');

  cryptoUtils = require('./libs/cryptoUtils');

  UglifyJS = require('uglify-js-harmony');

  util = require("util");

  saltLength = 20;

  UGLIFY_SOURCE_MAP_TOKEN = "UGLIFY_SOURCE_MAP_TOKEN";


  /* mergeFileFilterWithExport */

  NodeUglifier = (function() {
    function NodeUglifier(mainFile, options) {
      var j, results;
      if (options == null) {
        options = {};
      }
      this.getRequireSubstitutionForFilteredWithExport = bind(this.getRequireSubstitutionForFilteredWithExport, this);
      this.getNewRelativePathForFiltered = bind(this.getNewRelativePathForFiltered, this);
      this.getNewRelativePathForFilteredWithExport = bind(this.getNewRelativePathForFilteredWithExport, this);
      this.options = {
        mergeFileFilterWithExport: [],
        mergeFileFilter: [],
        newFilteredFileDir: "./lib_external",
        containerName: "cachedModules",
        rngSeed: null,
        licenseFile: null,
        fileExtensions: ["js", "coffee", "json"],
        suppressFilteredDependentError: false
      };
      _.extend(this.options, options);
      this.mainFileAbs = path.resolve(mainFile) || path.resolve(process.cwd(), mainFile);
      if (!fs.existsSync(this.mainFileAbs)) {
        throw new Error("main file not found " + this.mainFileAbs);
      } else {
        console.log("processing main file: " + this.mainFileAbs);
      }
      this.salt = cryptoUtils.generateSalt(saltLength);
      this.hashAlgorithm = "sha1";
      this.wrappedSourceContainerName = this.options.containerName;
      this.serialMappings = cryptoUtils.shuffleArray((function() {
        results = [];
        for (j = 0; j <= 10000; j++){ results.push(j); }
        return results;
      }).apply(this), this.options.rngSeed);
      this._sourceCodes = {};
      this.statistics = {};
      this.filteredOutFiles = packageUtils.getMatchingFiles(this.mainFileAbs, this.options.mergeFileFilter);
      this.lastResult = null;
    }

    NodeUglifier.prototype.getSourceContainer = function(serial) {
      return this.wrappedSourceContainerName + "[" + this.serialMappings[serial] + "]";
    };

    NodeUglifier.prototype.getRequireSubstitutionForMerge = function(serial) {
      return this.getSourceContainer(serial) + ".exports";
    };

    NodeUglifier.prototype.getNewRelativePathForFilteredWithExport = function(pathAbs) {
      return path.join(this.options.newFilteredFileDir, path.basename(pathAbs));
    };

    NodeUglifier.prototype.getNewRelativePathForFiltered = function(pathAbs) {
      var relPath;
      relPath = path.relative(path.dirname(this.mainFileAbs), path.dirname(pathAbs));
      return path.join(relPath, path.basename(pathAbs));
    };

    NodeUglifier.prototype.getRequireSubstitutionForFilteredWithExport = function(pathAbs, relPathFn) {
      var relFile, relFileNoExt;
      relFile = relPathFn(pathAbs);
      relFileNoExt = relFile.replace(path.extname(relFile), "");
      return "require('./" + relFileNoExt.replace("\\", "/") + "')";
    };

    NodeUglifier.prototype.addWrapper = function(source, serial) {
      var firstLine, lastLine, modulesArrayStr, secondLine;
      modulesArrayStr = this.getSourceContainer(serial);
      firstLine = modulesArrayStr + "={exports:{}};" + "\n";
      secondLine = "(function(module,exports) {";
      lastLine = "}).call(this," + modulesArrayStr + "," + modulesArrayStr + ".exports);";
      return "\n" + firstLine + secondLine + source + lastLine;
    };

    NodeUglifier.prototype.merge = function() {
      var _this, depGraph, edgeToRemove, error, filteredOutFilesWithExport, firstLine, iter, me, r, recursiveSourceGrabber, wasCycle;
      _this = this;
      firstLine = "var " + this.wrappedSourceContainerName + "=[];";
      r = {
        source: firstLine,
        filteredOutFilesObj: {},
        sourceMapModules: {},
        pathOrder: [],
        cycles: []
      };
      depGraph = new Graph();
      filteredOutFilesWithExport = packageUtils.getMatchingFiles(this.mainFileAbs, this.options.mergeFileFilterWithExport);
      recursiveSourceGrabber = function(filePath) {
        var ast, basename, error, error1, error2, filteredOutFilesObj, isSourceObjDepFiltered, isSourceObjDepFilteredWithExport, isSourceObjFiltered, isSourceObjFilteredWithExport, j, len, me, msg, otherSerial, pathSaltedHash, relPathFnc, replacement, requireStatement, requireStatements, source, sourceObj, sourceObjDep;
        try {
          depGraph.addNewVertex(filepath, filepath);
        } catch (error) {
          me = error;
        }
        source = packageUtils.readFile(filePath).toString();
        if (_.isEqual(path.extname(filePath), ".json")) {
          source = "module.exports=(" + source + ");";
        }
        pathSaltedHash = cryptoUtils.getSaltedHash(filePath, _this.hashAlgorithm, _this.salt);
        if (_this._sourceCodes[pathSaltedHash] == null) {
          _this._sourceCodes[pathSaltedHash] = {
            source: source,
            serial: _.keys(_this._sourceCodes).length,
            sourceMod: source
          };
          console.log(filePath + " added to sources ");
        }
        sourceObj = _this._sourceCodes[pathSaltedHash];
        isSourceObjFilteredWithExport = filteredOutFilesWithExport.filter(function(fFile) {
          return path.normalize(fFile) === path.normalize(filePath);
        }).length > 0;
        isSourceObjFiltered = _this.filteredOutFiles.filter(function(fFile) {
          return path.normalize(fFile) === path.normalize(filePath);
        }).length > 0;
        ast = packageUtils.getAst(source);
        requireStatements = packageUtils.getRequireStatements(ast, filePath, _this.fileExtensions);
        requireStatements.forEach(function(o, i) {
          return requireStatements[i] = _.extend(o, {
            pathSaltedHash: cryptoUtils.getSaltedHash(o.path, _this.hashAlgorithm, _this.salt)
          });
        });
        for (j = 0, len = requireStatements.length; j < len; j++) {
          requireStatement = requireStatements[j];
          try {
            depGraph.addNewVertex(requireStatement.path, null);
          } catch (error1) {
            me = error1;
          }
          try {
            depGraph.addNewEdge(filePath, requireStatement.path);
          } catch (error2) {
            me = error2;
          }
          sourceObjDep = _this._sourceCodes[requireStatement.pathSaltedHash];
          if (isSourceObjFilteredWithExport && packageUtils.getIfNonNativeNotFilteredNonNpm(requireStatement.path, filteredOutFilesWithExport, _this.options.fileExtensions)) {
            msg = "filtered files can not have dependency on merged files, file: " + filePath + " dependency: " + requireStatement.path;
            if (_this.options.suppressFilteredDependentError) {
              console.warn(msg);
            } else {
              throw new Error(msg);
            }
          }
          if (sourceObjDep == null) {
            recursiveSourceGrabber(requireStatement.path);
          }
          sourceObjDep = _this._sourceCodes[requireStatement.pathSaltedHash];
          if (sourceObjDep == null) {
            throw new Error(" internal should not happen 1");
          }
          otherSerial = sourceObjDep.serial;
          isSourceObjDepFilteredWithExport = filteredOutFilesWithExport.filter(function(fFile) {
            return path.normalize(fFile) === path.normalize(requireStatement.path);
          }).length > 0;
          isSourceObjDepFiltered = _this.filteredOutFiles.filter(function(fFile) {
            return path.normalize(fFile) === path.normalize(requireStatement.path);
          }).length > 0;
          if (isSourceObjDepFilteredWithExport) {
            replacement = _this.getRequireSubstitutionForFilteredWithExport(requireStatement.path, _this.getNewRelativePathForFilteredWithExport);
          } else if (isSourceObjDepFiltered) {
            replacement = _this.getRequireSubstitutionForFilteredWithExport(requireStatement.path, _this.getNewRelativePathForFiltered);
          } else {
            replacement = _this.getRequireSubstitutionForMerge(otherSerial);
            r.sourceMapModules[_this.getSourceContainer(otherSerial)] = path.relative(path.dirname(_this.mainFileAbs), requireStatement.path);
          }
          sourceObj.sourceMod = packageUtils.replaceRequireStatement(sourceObj.sourceMod, requireStatement.text, replacement);
        }
        if (isSourceObjFilteredWithExport || isSourceObjFiltered) {
          if (isSourceObjFiltered) {
            relPathFnc = _this.getNewRelativePathForFiltered;
            basename = relPathFnc(filePath);
          } else if (isSourceObjFilteredWithExport) {
            relPathFnc = _this.getNewRelativePathForFilteredWithExport;
            basename = path.basename(filePath);
          }
          if (r.filteredOutFilesObj[basename]) {
            filteredOutFilesObj = r.filteredOutFilesObj[basename];
            if (filteredOutFilesObj.serial !== sourceObj.serial) {
              throw new Error(" external files with same filename not supported yet");
            }
          } else {
            r.filteredOutFilesObj[basename] = {
              pathRel: relPathFnc(filePath)
            };
            return _.extend(r.filteredOutFilesObj[basename], sourceObj);
          }
        } else {
          if (sourceObj.serial > 0) {
            sourceObj.sourceModWrapped = _this.addWrapper(sourceObj.sourceMod, sourceObj.serial);
          } else {
            sourceObj.sourceModWrapped = sourceObj.sourceMod;
          }
          r.pathOrder.push(filePath);
          return r.source = r.source + sourceObj.sourceModWrapped;
        }
      };
      recursiveSourceGrabber(this.mainFileAbs);
      this.lastResult = r;
      wasCycle = true;
      iter = 0;
      while (wasCycle && iter < 1000) {
        iter++;
        wasCycle = false;
        try {
          depGraph.topologically(function(vertex, vertexVal) {});
        } catch (error) {
          me = error;
          wasCycle = true;
          if (me.cycle) {
            r.cycles.push(me.cycle);
            edgeToRemove = [me.cycle.last(2).last(), me.cycle.last(2).first()].reverse();
            depGraph.removeEdge.apply(depGraph, edgeToRemove);
          }
        }
      }
      if (!_.isEmpty(r.cycles)) {
        throw new Errors.CyclicDependencies(r.cycles);
      }
      return this;
    };

    NodeUglifier.prototype.exportDependencies = function(exportDir, srcDirMap) {
      var baseDir, baseName, baseNameNoExtension, baseNameOther, exportDirAbs, extension, from, fromToMap, j, k, len, len1, mirrorExt, newFile, newFileOther, otherBaseDir, otherFile, p, projectDir, ref, results, sourceFileDidNotExist, sourceFileDidNotExistArr, to, toFromMap;
      if (srcDirMap == null) {
        srcDirMap = null;
      }
      sourceFileDidNotExistArr = [];
      if (!this.lastResult) {
        this.merge();
      }
      if (!this.lastResult.pathOrder) {
        throw new Error("there was no dependencies to export");
        return;
      }
      exportDirAbs = path.resolve(exportDir) || path.resolve(process.cwd(), exportDir);
      projectDir = process.cwd();
      ref = this.lastResult.pathOrder;
      for (j = 0, len = ref.length; j < len; j++) {
        p = ref[j];
        if (p.indexOf(projectDir) !== 0) {
          throw new Error(p + " dependency not found each dependency should be in the project Dir: " + projectDir);
        }
        baseDir = path.dirname(p.slice(projectDir.length + 1));
        baseName = path.basename(p);
        extension = path.extname(p);
        baseNameNoExtension = baseName.slice(0, +(baseName.length - extension.length - 1) + 1 || 9e9);
        newFile = path.resolve(path.join(exportDirAbs, baseDir, baseName));
        fsExtra.ensureDirSync(path.dirname(newFile));
        fs.createReadStream(p).pipe(fs.createWriteStream(newFile));
        if (srcDirMap) {
          for (mirrorExt in srcDirMap) {
            fromToMap = srcDirMap[mirrorExt];
            toFromMap = _.invert(fromToMap);
            for (to in toFromMap) {
              from = toFromMap[to];
              otherBaseDir = baseDir.replace(to, from);
              if (otherBaseDir === baseDir) {
                continue;
              }
              otherFile = path.join(path.resolve(process.cwd(), otherBaseDir), baseNameNoExtension + "." + mirrorExt);
              baseNameOther = path.basename(otherFile);
              if (fsExtra.existsSync(otherFile)) {
                newFileOther = path.resolve(path.join(exportDirAbs, otherBaseDir, baseNameOther));
                fsExtra.ensureDirSync(path.dirname(newFileOther));
                fs.createReadStream(otherFile).pipe(fs.createWriteStream(newFileOther));
              } else {
                sourceFileDidNotExistArr.push(otherFile);
              }
              console.log(otherFile);
            }
          }
        }
      }
      results = [];
      for (k = 0, len1 = sourceFileDidNotExistArr.length; k < len1; k++) {
        sourceFileDidNotExist = sourceFileDidNotExistArr[k];
        results.push(console.log("WARNING source file did not exist: " + sourceFileDidNotExist));
      }
      return results;
    };

    NodeUglifier.prototype.toString = function() {
      return this.lastResult.source.toString();
    };

    NodeUglifier.prototype.exportToFile = function(file) {
      var _this, outDirRoot, outFileAbs;
      _this = this;
      outFileAbs = path.resolve(file);
      fsExtra.ensureDirSync(path.dirname(outFileAbs));
      fs.writeFileSync(outFileAbs, this.toString());
      outDirRoot = path.dirname(outFileAbs);
      _.keys(_this.lastResult.filteredOutFilesObj).forEach(function(fileName) {
        var copyObj, newFile;
        copyObj = _this.lastResult.filteredOutFilesObj[fileName];
        newFile = path.resolve(outDirRoot, copyObj.pathRel);
        fsExtra.ensureDirSync(path.dirname(newFile));
        return fs.writeFileSync(newFile, copyObj.sourceMod);
      });
      return _this.filteredOutFiles.forEach(function(fileName) {
        var newFile, pathRel;
        pathRel = _this.getNewRelativePathForFiltered(fileName);
        newFile = path.resolve(outDirRoot, pathRel);
        fsExtra.ensureDirSync(path.dirname(newFile));
        return fs.createReadStream(fileName).pipe(fs.createWriteStream(newFile));
      });
    };

    NodeUglifier.prototype.exportSourceMaps = function(file) {
      var _this, dir, outFileAbs, sourceMapModulesOutFileName, sourceMapOutFileName;
      _this = this;
      outFileAbs = path.resolve(file);
      sourceMapOutFileName = path.basename(outFileAbs) + ".map";
      sourceMapModulesOutFileName = path.basename(outFileAbs) + ".modules-map";
      dir = path.dirname(outFileAbs);
      fsExtra.ensureDirSync(dir);
      if (this.lastResult.sourceMapUglify != null) {
        fs.writeFileSync(path.join(dir, sourceMapOutFileName), this.lastResult.sourceMapUglify.replace(UGLIFY_SOURCE_MAP_TOKEN, sourceMapOutFileName));
      }
      return fs.writeFileSync(path.join(dir, sourceMapModulesOutFileName), JSON.stringify(_this.lastResult.sourceMapModules));
    };

    NodeUglifier.prototype.uglify = function(optionsIn) {
      var a, ast, options, res, source;
      if (optionsIn == null) {
        optionsIn = {};
      }
      if (!this.lastResult) {
        this.merge();
      }
      options = {
        mangle: true,
        compress: {
          drop_console: false,
          hoist_funs: true,
          loops: true,
          evaluate: true,
          conditionals: true
        },
        output: {
          comments: false
        },
        strProtectionLvl: 0
      };
      _.extend(options, optionsIn);
      if (!this.lastResult.source) {
        return;
      }
      source = this.toString();
      a = 1 + 1;
      res = UglifyJS.minify(source, _.extend({
        fromString: true,
        outSourceMap: UGLIFY_SOURCE_MAP_TOKEN
      }, options));
      this.lastResult.source = res.code;
      this.lastResult.sourceMapUglify = res.map;
      switch (options.strProtectionLvl) {
        case 1:
          ast = packageUtils.getAst(this.lastResult.source);
          this.lastResult.source = packageUtils.getSourceHexified(ast);
      }
      return this;
    };

    return NodeUglifier;

  })();

  module.exports = NodeUglifier;

}).call(this);

//# sourceMappingURL=NodeUglifier.js.map
