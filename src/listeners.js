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
const { lKey, convertText, saveConversion, isComplexJSON, isFunc } = require('./util');
const { keys, g, vscode, enums } = require('./globals');
const type = require('./type');
/**********/

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
 * Listens for text changes in the active editor and converts the text to Go struct if the text matches the clipboard text, is valid JSON and the language is configured inside settings.
 * @param {vscode.TextDocumentChangeEvent} ev The event object.
 */
async function onDidChangeTextDocumentListener(ev) {
  let langs = g.ctx.globalState.get(lKey(keys.ctx.temp.pasteIntegrationLangs));
  if (!langs.includes('*') && !langs.includes(ev.document.languageId)) {
    return Promise.resolve();
  }
  let clipTxt = await vscode.env.clipboard.readText();
  if (!clipTxt || clipTxt.length < 2) return Promise.resolve();
  switch (ev.document.eol) {
    case vscode.EndOfLine.CRLF:
      clipTxt = clipTxt.replace(/\n/g, '\r\n').trim();
      break;
    case vscode.EndOfLine.LF:
      clipTxt = clipTxt.replace(/\r\n/g, '\n').trim();
      break;
  }

  for (let change of ev.contentChanges) {
    let changeTxt = change.text.trim();
    if (changeTxt.length < 2 || !isComplexJSON(changeTxt) || changeTxt !== clipTxt) continue;
    let structName = g.cfg.get(keys.settings.generatedTypeName);
    let struct = convertText(clipTxt, structName);
    if (!type(struct.error, enums.T.undefined)) continue;
    if (g.ctx.globalState.get(lKey(keys.ctx.temp.promptForStructName))) {
      structName = await vscode.window.showInputBox({
        prompt: 'Generated Go type name',
        value: structName,
      });
      struct = convertText(clipTxt, structName);
    }
    let edit = new vscode.WorkspaceEdit();
    let lines = changeTxt.split('\n');
    let replaceRange = new vscode.Range(
      change.range.start,
      new vscode.Position(
        change.range.start.line + (lines.length > 1 ? lines.length - 1 : 0),
        change.range.end.character + (lines.length > 0 ? lines[lines.length - 1].length : 0)
      )
    );
    edit.replace(ev.document.uri, replaceRange, struct.go);
    await vscode.workspace.applyEdit(edit);
    if (g.cfg.get(keys.settings.saveConversions)) await saveConversion(changeTxt, struct.go, { addPackage: true });
  }

  return await Promise.resolve();
}

/**
 * Listens for changes in the settings and updates the context values and listeners accordingly.
 * @param {vscode.ConfigurationChangeEvent} ev The event object.
 */
async function onDidChangeConfigurationListener(ev) {
  if (ev.affectsConfiguration(lKey(keys.settings.pasteIntegration.self))) {
    let { langs } = await updatePasteContext();
    langs.length > 0 ? await g.li.onDidChangeTextDocument.enable() : await g.li.onDidChangeTextDocument.dispose();
  }

  return Promise.resolve();
}

async function onDidChangeActiveTextEditorListener() {
  return Promise.resolve();
}

/**
 * @typedef {Object} PasteContext
 * @property {string[]} langs An array of supported paste integration languages.
 * @property {boolean} promptForTypeName A boolean indicating whether to prompt for type name during conversion
 */

/**
 * Updates the paste integration global context with setting values
 * @returns {Promise<PasteContext>} The current configuration values.
 */
async function updatePasteContext() {
  let ctx = {
    langs: [],
    promptForTypeName: false,
  };
  ctx.langs = g.cfg.get(keys.settings.pasteIntegration.supportedLanguages);
  ctx.promptForTypeName = g.cfg.get(keys.settings.pasteIntegration.promptForTypeName);
  await g.ctx.globalState.update(lKey(keys.ctx.temp.pasteIntegrationLangs), ctx.langs);
  await g.ctx.globalState.update(lKey(keys.ctx.temp.promptForStructName), ctx.promptForTypeName);
  return Promise.resolve(ctx);
}

module.exports = {
  onDidChangeActiveTextEditorListener,
  onDidChangeConfigurationListener,
  onDidChangeTextDocumentListener,
  updatePasteContext,
  ListenerController,
};
