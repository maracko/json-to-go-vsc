/**
 * JSON to Go extension for VS Code.
 *
 * Date: February 2024
 * Author: Mario Petričko
 * GitHub: http://github.com/maracko/json-to-go-vsc
 *
 * Apache License
 * Version 2.0, January 2004
 * http://www.apache.org/licenses/
 *
 * Depends on JSON-to-Go by mholt: https://github.com/mholt/json-to-go. Its source is included in this repo.
 */

/**********/
const vscode = require('vscode');
const { type, deepCopy } = require('./types');
/**********/

const enums = {
  input: {
    askMe: 'ask me every time',
    clipboard: 'clipboard',
    currentFile: 'current file',
    selection: 'selection',
  },
  output: {
    askMe: 'ask me every time',
    clipboard: 'clipboard',
    cursorPosition: 'cursor position',
    temporaryFile: 'temporary file',
  },
  Button: {
    AreYouSure: 'Are you sure?',
    Cancel: 'Cancel',
    Confirm: 'Confirm',
    DontShowAgain: "Don't show again",
    ShowDetails: 'Show details',
    GoToSettings: 'Go to settings',
    Remember: {
      Yes: 'Yes',
      No: 'No',
      DontAsk: "No and don't ask again",
    },
  },
  T: {
    array: 'array',
    bigint: 'bigint',
    boolean: 'boolean',
    date: 'date',
    error: 'error',
    function: 'function',
    null: 'null',
    number: 'number',
    object: 'object',
    regexp: 'regexp',
    symbol: 'symbol',
    string: 'string',
    undefined: 'undefined',
  },
};

const keys = {
  jsonToGo: 'json-to-go',
  ctx: {
    perm: {
      askRememberInput: 'askRememberInput',
      askRememberOutput: 'askRememberOutput',
      notifyClipboardOutput: 'notifyClipboardOutput',
    },
    tmp: {
      pasteIntegrationLangs: 'pasteIntegrationLangs',
      promptForStructName: 'promptForStructName',
    },
    /**
     * @deprecated context menu deprecated
     */
    editor: {
      contextMenuVisible: 'contextMenuVisible',
    },
  },
  cmd: {
    convert: 'convert',
    convertFresh: 'convertFresh',
    openSettings: 'openSettings',
    resetAllSettings: 'resetAllSettings',
  },
  li: {
    self: 'li',
    onDidChangeTextDocument: 'onDidChangeTextDocument',
    onDidChangeConfiguration: 'onDidChangeConfiguration',
  },
  settings: {
    autoSelectTypeName: 'autoSelectTypeName',
    allOmitEmpty: 'allOmitEmpty',
    inlineTypeDefinitions: 'inlineTypeDefinitions',
    generatedTypeName: 'generatedTypeName',
    saveConversions: 'saveConversions',
    io: {
      /**
       * @deprecated replaced by input
       */
      inputSource: 'inputSource',
      input: 'io.input',
      output: 'io.output',
    },
    pasteIntegration: {
      self: 'pasteIntegration',
      promptForTypeName: 'pasteIntegration.promptForTypeName',
      supportedLanguages: 'pasteIntegration.supportedLanguages',
    },
  },
};

/**
 * The big G. Actually, it's a small one, but he always dreamed biG.
 * @type {GlobalDisposable}
 */
const g = newGlobals();

/**
 * Interface for operating listeners.
 * @typedef {Object} ListenerController
 * @property {() => boolean} enable Enables the listener.
 * @property {() => boolean} dispose Disposes the listener.
 * @property { () => (event?) } listener The underlying listener function.
 * @property {() => (event?)} source The source of the events.
 * @property {() => string} name The name of the listener.
 */
/**
 * ListenerController factory function.
 * @returns {ListenerController} A new ListenerController object.
 */
function ListenerController() {
  let disp, list, evSrc;
  this.enable = (li, ev) => {
    if ((!isFunc(li) || !isFunc(ev)) && (!isFunc(list) || !isFunc(evSrc))) {
      throw new Error(`must provide a listener and an event source, have args:[${type(li).allTypes} and ${type(ev).allTypes}]
        `);
    }

    let validConf = false;
    if (isFunc(li) && isFunc(ev)) {
      list = li;
      evSrc = ev;
      validConf = true;
    }
    if (!validConf && (!isFunc(list) || !isFunc(evSrc))) {
      throw new Error(`Invalid conf: ${JSON.stringify(this)}`);
    }

    if (disp && isFunc(disp.dispose)) {
      disp.dispose();
    }
    disp = evSrc(list, this, g.ctx.subscriptions);
    console.log(`ListenerController: ${this.name()} enabled`);
    return true;
  };
  this.listener = () => list;
  this.name = () => list.name;
  this.source = () => evSrc;
  this.dispose = () => {
    let op = false;
    if (disp && isFunc(disp.dispose)) {
      disp.dispose();
      disp = undefined;
      op = true;
      console.log(`ListenerController: ${this.name()} disposed`);
    }
    return op;
  };

  return this;
}

/**
 * @typedef {Object} Listeners Object containing all active ListenerController instances and in turn all active listeners.
 * @property {ListenerController} [onDidChangeTextDocument] A ListenerController instance.
 * @property {ListenerController} [onDidChangeActiveTextEditor] A ListenerController instance.
 * @property {ListenerController} [onDidChangeConfiguration] A ListenerController instance.
 */

/**
 * @typedef {Object} GlobalDisposable The global object containing all run-time data.
 * @property {vscode.WorkspaceConfiguration} cfg The workspace configuration object.
 * @property {vscode.ExtensionContext} [ctx] The extension context provided by VS Code.
 * @property {vscode.Disposable[]} disposables All global disposables are added here
 * @property {Listeners} li An object with ListenerController instances.
 * @property {function(): number} dispose A method that clears all keys except the dispose function and increments its internal timesDisposed counter.
 * @property {function(): number} timesDisposed A method that returns the number of times the object has been disposed.
 */

/**
 * Creates a new GlobalDisposable object. The object is a proxy that prevents reassigning or deleting its properties, unless dispose is called.
 * @param {Object} [input={}] The initial properties of the GlobalDisposable.
 * @returns {GlobalDisposable} A new GlobalDisposable object.
 */
function newGlobals(input = {}) {
  if (!isObj(input)) input = {};
  let nDisp = 0;
  const timesDisposed = () => nDisp;
  let daRealG = {
    ...deepCopy(input),
    disposables: [],
    li: newLi(),
    timesDisposed: timesDisposed,
    dispose: function () {
      deepDispose(this, ['dispose', 'timesDisposed']);
      this.disposables = [];
      this.li = newLi();
      nDisp++;
      return nDisp;
    },
  };

  return new Proxy(daRealG, {
    set: function (target, key, value) {
      if (key in target) {
        console.error(`json-to-go: GlobalDisposable: cannot set '${String(key)}', it is already set to: '${JSON.stringify(target[key])}'`);
        return false;
      }
      target[key] = value;
      return true;
    },
    get: function name(target, prop) {
      if (prop === 'cfg') {
        return vscode.workspace.getConfiguration(keys.jsonToGo);
      }
      return target[prop];
    },
  });
}

function isFunc(x) {
  return type(x, enums.T.function).valueOf();
}

/** excludes null */
function isObj(x) {
  const t = type(x, enums.T.object);
  return t.valueOf() && !t.allTypes.includes(enums.T.null);
}

function newLi() {
  return {
    onDidChangeTextDocument: new ListenerController(),
    onDidChangeActiveTextEditor: new ListenerController(),
    onDidChangeConfiguration: new ListenerController(),
  };
}

function deepDispose(obj, topWhitelist = [], depth = 0) {
  if (!isObj(obj)) return;

  if (Array.isArray(obj)) {
    for (let val of obj) {
      if (val && isFunc(val.dispose)) val.dispose();
      else if (isObj(val)) deepDispose(val, depth + 1);
    }
    return;
  }

  for (let [key, val] in Object.values(obj)) {
    if (topWhitelist.includes(key) && depth == 0) continue;
    if (key == 'dispose' && isFunc(val)) {
      val();
      continue;
    } else if (isObj(val) && isFunc(val.dispose)) {
      val.dispose();
      continue;
    }
    if (isObj(val)) deepDispose(val, depth + 1);
  }
}

module.exports = {
  enums,
  keys,
  vscode,
  g,
};
