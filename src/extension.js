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
const li = require('./listeners');
const { type } = require('./types');
const { keys, enums, g, vscode } = require('./globals');
const { lKey, weirdThrow, convertText, capStr, capValues, saveConversion } = require('./util');
/**********/

/**
 * Activates the extension and sets up the necessary configurations and commands.
 * @param {vscode.ExtensionContext} ctx The extension context provided by VS Code.
 */
async function activate(ctx) {
  try {
    g.ctx = ctx;
    await initCtx();
    await li.updatePasteContext();

    // reset for <= 0.3.1
    if (g.cfg.get(keys.settings.io.inputSource)) {
      g.cfg.update(keys.settings.io.inputSource, undefined, vscode.ConfigurationTarget.Global);
      resetAllSettings(true);
      let btn = await vscode.window.showInformationMessage(
        `Json to Go has reached a major release and your settings have been reset.
        Sorry for the inconvenience, you are encouraged to check out what changed.`,
        enums.Button.GoToSettings
      );
      if (btn === enums.Button.GoToSettings) openSettingsWindow();
    }

    g.li.onDidChangeConfiguration.enable(li.onDidChangeConfigurationListener, vscode.workspace.onDidChangeConfiguration);
    g.li.onDidChangeActiveTextEditor.enable(li.onDidChangeActiveTextEditorListener, vscode.window.onDidChangeActiveTextEditor);
    g.li.onDidChangeTextDocument.enable(li.onDidChangeTextDocumentListener, (li, thisArg, disposables) =>
      vscode.workspace.onDidChangeTextDocument(li, thisArg, disposables)
    );
    g.cfg.get(keys.settings.pasteIntegration.supportedLanguages).length > 0 ? g.li.onDidChangeTextDocument.enable() : g.li.onDidChangeTextDocument.dispose();

    ctx.subscriptions.push(
      vscode.commands.registerCommand(lKey(keys.cmd.convert), async () => {
        return await convert();
      })
    );
    ctx.subscriptions.push(
      vscode.commands.registerCommand(lKey(keys.cmd.convertFresh), async () => {
        return await convert(true);
      })
    );
    ctx.subscriptions.push(
      vscode.commands.registerCommand(lKey(keys.cmd.resetAllSettings), async () => {
        return await resetAllSettings();
      })
    );
    ctx.subscriptions.push(
      vscode.commands.registerCommand(lKey(keys.cmd.openSettings), async () => {
        return await openSettingsWindow();
      })
    );

    ctx.subscriptions.push(g);

    return Promise.resolve({ convert, type });
  } catch (err) {
    handleErr(err);
  }
}

/** @todo Potential cleanup needed. */
function deactivate() {}

/**
 * Converts JSON to Go. The main command of the extension.
 * @param {boolean} [fresh=false] Won't use saved settings or save any new ones if true.
 * @returns {Promise<void>} A promise that resolves when the conversion is complete.
 */
async function convert(fresh = false) {
  try {
    let txt = '';
    let input = g.cfg.get(keys.settings.io.input);
    if (input === enums.input.askMe || fresh) {
      input = await vscode.window.showQuickPick([capStr(enums.input.clipboard), capStr(enums.input.selection), capStr(enums.input.currentFile)], {
        placeHolder: 'Select input source (can be changed inside extension settings)',
      });
      if (!input) {
        vscode.window.showInformationMessage('Nothing chosen, aborting');
        return;
      }
      input = input.toLowerCase();
      if (!fresh) {
        if (g.ctx.globalState.get(lKey(keys.ctx.perm.askRememberInput))) {
          let rememberInput = await vscode.window.showQuickPick(capValues(enums.Button.Remember), {
            placeHolder: 'Remember input?',
          });
          switch (rememberInput) {
            case enums.Button.Remember.Yes:
              g.cfg.update(keys.settings.io.input, input, vscode.ConfigurationTarget.Global);
              break;
            case enums.Button.Remember.DontAsk:
              g.ctx.globalState.update(lKey(keys.ctx.perm.askRememberInput), false);
              break;
            case undefined:
            case enums.Button.Remember.No:
              break;
            default:
              weirdThrow(`Remember input: "${rememberInput}"`);
          }
        }
      }
    }

    switch (input) {
      case enums.input.selection:
        let editor = vscode.window.activeTextEditor;
        if (!editor) {
          vscode.window.showErrorMessage('No editor active for input');
          return;
        }
        txt = editor.document.getText(editor.selection);
        break;
      case enums.input.clipboard:
        txt = await vscode.env.clipboard.readText();
        break;
      case enums.input.currentFile:
        if (!vscode.window.activeTextEditor) {
          vscode.window.showErrorMessage('No editor active for input');
          return;
        }
        txt = vscode.window.activeTextEditor.document.getText();
        break;
      default:
        weirdThrow(`Input: "${input}"`);
    }

    if (!txt) {
      vscode.window.showErrorMessage(`Nothing found inside ${capStr(input)}`);
      return;
    }

    let struct = convertText(txt);
    if (struct.error) {
      vscode.window.showErrorMessage('Invalid JSON', enums.Button.ShowDetails).then((btn) => {
        if (btn === enums.Button.ShowDetails) {
          vscode.window.showInformationMessage(struct.error);
        }
      });
      return;
    }

    let output = g.cfg.get(keys.settings.io.output);
    if (output === enums.output.askMe || fresh) {
      output = await vscode.window.showQuickPick([capStr(enums.output.clipboard), capStr(enums.output.cursorPosition), capStr(enums.output.temporaryFile)], {
        placeHolder: 'Select output destination',
      });
      if (!output) {
        vscode.window.showInformationMessage('Nothing chosen, aborting');
        return;
      }
      output = output.toLowerCase();

      if (!fresh) {
        if (g.ctx.globalState.get(lKey(keys.ctx.perm.askRememberOutput))) {
          let rememberOutput = await vscode.window.showQuickPick(capValues(enums.Button.Remember), {
            placeHolder: 'Remember output?',
          });
          switch (rememberOutput) {
            case enums.Button.Remember.Yes:
              g.cfg.update(keys.settings.io.output, output, vscode.ConfigurationTarget.Global);
              break;
            case enums.Button.Remember.DontAsk:
              g.ctx.globalState.update(lKey(keys.ctx.perm.askRememberOutput), false);
              break;
            case undefined:
            case enums.Button.Remember.No:
              break;
            default:
              weirdThrow(`Remember output "${rememberOutput}"`);
          }
        }
      }
    }
    switch (output) {
      case enums.output.clipboard:
        await vscode.env.clipboard.writeText(struct.go);
        if (g.ctx.globalState.get(lKey(keys.ctx.perm.notifyClipboardOutput)))
          vscode.window.showInformationMessage('Go struct copied to clipboard', enums.Button.DontShowAgain).then((btn) => {
            if (btn === enums.Button.DontShowAgain) {
              g.ctx.globalState.update(lKey(keys.ctx.perm.notifyClipboardOutput), false);
              g.cfg.update(keys.ctx.perm.notifyClipboardOutput, false, vscode.ConfigurationTarget.Global);
            }
          });
        break;
      case enums.output.cursorPosition:
        let editor = vscode.window.activeTextEditor;
        if (!editor) {
          vscode.window.showErrorMessage('No editor active for output');
          return;
        }
        editor.edit((editBuilder) => {
          editBuilder.insert(editor.selection.active, struct.go);
        });
        break;
      case enums.output.temporaryFile:
        let doc = await vscode.workspace.openTextDocument({
          language: 'go',
          content: struct.go,
        });
        await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside, false);
        if (g.cfg.get(keys.settings.autoSelectTypeName)) {
          await vscode.commands.executeCommand('cursorMove', {
            to: 'right',
            by: 'character',
            value: 5,
          });
          await vscode.commands.executeCommand('cursorMove', {
            to: 'right',
            by: 'character',
            value: g.cfg.get(keys.settings.generatedTypeName).length,
            select: true,
          });
        }
    }

    if (g.cfg.get(keys.settings.saveConversions)) {
      await saveConversion(txt, struct.go);
    }
  } catch (err) {
    handleErr(err);
  }
}
/**
 * Initializes the context for the extension.
 * @param {boolean} [reset=false] - Indicates whether to reset the context values.
 * @returns {Promise<Object>} - A promise that resolves to the default context values.
 */
async function initCtx(reset = false) {
  let def = {
    perm: {
      [keys.ctx.perm.askRememberInput]: true,
      [keys.ctx.perm.askRememberOutput]: true,
      [keys.ctx.perm.notifyClipboardOutput]: true,
    },
    tmp: {
      [keys.ctx.tmp.pasteIntegrationLangs]: ['go'],
      [keys.ctx.tmp.promptForStructName]: true,
    },
  };

  if (reset) {
    await g.ctx.globalState.update(lKey(keys.ctx.editor.contextMenuVisible, ':'), undefined);
  }

  let defVals = { ...def.perm, ...def.tmp };
  for (let [k, v] of Object.entries(defVals)) {
    if (reset || k in def.tmp || (type(g.ctx.globalState.get(lKey(k, ':')), enums.T.undefined) && (await g.ctx.globalState.update(lKey(k), v)))) {
      await g.ctx.globalState.update(lKey(k), v);
    }
  }

  return Promise.resolve(defVals);
}

async function resetAllSettings(force = false) {
  let reset = async () => {
    let settings = [
      keys.settings.autoSelectTypeName,
      keys.settings.allOmitEmpty,
      keys.settings.inlineTypeDefinitions,
      keys.settings.generatedTypeName,
      keys.settings.saveConversions,
      keys.settings.io.input,
      keys.settings.io.output,
      keys.settings.pasteIntegration.promptForTypeName,
      keys.settings.pasteIntegration.supportedLanguages,
    ];
    for (let setting of settings) {
      await g.cfg.update(setting, undefined, vscode.ConfigurationTarget.Global);
    }

    await initCtx(true);
    return await li.updatePasteContext();
  };
  if (force) {
    reset();
    return Promise.resolve();
  }
  let btn = await vscode.window.showInformationMessage(
    enums.Button.AreYouSure,
    {
      modal: true,
      detail: 'Resets all JSON-to-Go data, except any saved conversions',
    },
    enums.Button.Confirm
  );
  switch (btn) {
    case enums.Button.Cancel:
    case undefined:
      break;
    case enums.Button.Confirm:
      await reset();
      await openSettingsWindow();
      break;
  }

  return Promise.resolve();
}

function openSettingsWindow() {
  vscode.commands.executeCommand('workbench.action.openSettings', `@ext:maracko.${keys.jsonToGo}`);
}

/**
 * Handles errors and displays an error message with details.
 * @param {Error} error - The error object.
 */
async function handleErr(error) {
  if (!error || !type(error, 'object') || !type(error.message, 'string')) {
    console.error(`Error: An unknown (error == '${JSON.stringify(error)}') occurred in JSON to Go`);
    return;
  }
  let errStr = `Error: | Name: "${error.name}" | Message: "${error.message}" | Stack: "${error.stack}"`;
  console.error(errStr);
  vscode.window.showErrorMessage(`An error occurred in JSON to Go: ${error.message}`, enums.Button.ShowDetails).then((btn) => {
    if (btn === enums.Button.ShowDetails) {
      vscode.window.showInformationMessage(errStr);
    }
  });
}

module.exports = { activate, deactivate, convert, type };
