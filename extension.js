const vscode = require('vscode');
const tmp = require('tmp');
const fs = require('fs');
const jsonToGo = require('./json-to-go.js');

const enums = {
  input: {
    clipboard: 'clipboard',
    selection: 'selection',
    askMe: 'ask me every time',
  },
  output: {
    clipboard: 'clipboard',
    temporaryFile: 'temporary file',
    cursorPosition: 'cursor position',
    askMe: 'ask me every time',
  },
  Remember: {
    Yes: 'Yes',
    No: 'No',
    DontAsk: "No and don't ask again",
  },
  Button: {
    ShowDetails: 'Show details',
    DontShowAgain: "Don't show again",
  },
};

const keys = {
  context: {
    askRememberInput: 'askRememberInput',
    askRememberOutput: 'askRememberOutput',
    contextMenuVisible: 'contextMenuVisible',
    notifyClipboardOutput: 'notifyClipboardOutput',
    pasteIntegrationAlways: 'pasteIntegrationAlways',
  },
  settings: {
    contextMenu: {
      supportedLanguages: 'contextMenu.supportedLanguages',
    },
    io: {
      /* !! Key deprecated: replaced by input */
      inputSource: 'inputSource',
      input: 'io.input',
      output: 'io.output',
    },
    pasteIntegration: {
      enabled: 'pasteIntegration.enabled',
      supportedLanguages: 'pasteIntegration.supportedLanguages',
    },
    autoSelectTypeName: 'autoSelectTypeName',
    allOmitEmpty: 'allOmitEmpty',
    inlineTypeDefinitions: 'inlineTypeDefinitions',
    generatedTypeName: 'generatedTypeName',
  },
  commands: {
    convert: 'convert',
  },
  jsonToGo: 'json-to-go',
};

const cfg = getConfig();

/**
 * Activates the extension and sets up the necessary configurations and commands.
 *
 * @param {vscode.ExtensionContext} context - The extension context.
 * @returns {Object} - An object with the 'convert' function.
 */
async function activate(context) {
  updatePasteIntegrationContext() && updateMenuVisibilityContext();
  // editor change listener
  context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(updateMenuVisibilityContext));

  // migrate settings
  cfg.get(keys.settings.io.inputSource) &&
    cfg.update(keys.settings.io.input, cfg.get(keys.settings.io.inputSource), vscode.ConfigurationTarget.Global) &&
    cfg.update(keys.settings.io.inputSource, undefined, vscode.ConfigurationTarget.Global);

  setDefault(context, keys.context.askRememberInput, true);
  setDefault(context, keys.context.askRememberOutput, true);
  setDefault(context, keys.context.notifyClipboardOutput, true);

  // paste settings listener
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(async (event) => {
      switch (true) {
        case event.affectsConfiguration(keys.settings.pasteIntegration.supportedLanguages):
          await updatePasteIntegrationContext();
          break;
      }
    })
  );

  // main command "convert"
  context.subscriptions.push(
    vscode.commands.registerCommand(lKey(keys.commands.convert), () => {
      convert(context);
    })
  );

  // paste integration listener
  cfg.get(keys.settings.pasteIntegration.enabled) && context.subscriptions.push(registerInterceptPasteListener(context));

  return { convertText };
}

/* TODO: Potential cleanup needed */
function deactivate() {}

/**
 * Converts JSON to Go struct. The main function of the extension.
 * @param {vscode.ExtensionContext} context - The extension context.
 * @returns {Promise<void>} - A promise that resolves when the conversion is complete.
 */
async function convert(context) {
  try {
    let textToConvert = '';
    let input = cfg.get(keys.settings.io.input);
    if (input === enums.input.askMe) {
      input = await vscode.window.showQuickPick([capitalize(enums.input.clipboard), capitalize(enums.input.selection)], {
        placeHolder: 'Select input source (can be changed inside extension settings)',
      });
      if (!input) {
        vscode.window.showInformationMessage('Nothing chosen, aborting');
        return;
      }
      input = input.toLowerCase();
    }
    if (context.globalState.get(lKey(keys.context.askRememberInput))) {
      let rememberInput = await vscode.window.showQuickPick(...capitalizedValues(enums.Remember), {
        placeHolder: 'Remember input?',
      });

      switch (rememberInput) {
        case enums.Remember.Yes:
          cfg.update(keys.settings.io.input, input, vscode.ConfigurationTarget.Global);
          break;
        case enums.Remember.DontAsk:
          context.globalState.update(lKey(keys.context.askRememberInput), false);
          break;
        case enums.Remember.No:
        case undefined:
          break;
        default:
          weirdThrow(`Remember input "${rememberInput}"`);
      }
    }

    switch (input) {
      case enums.input.selection:
        let editor = vscode.window.activeTextEditor;
        if (!editor) {
          vscode.window.showErrorMessage('No editor active for input');
          return;
        }
        let selection = editor.selection;
        textToConvert = editor.document.getText(selection);
        break;
      case enums.input.clipboard:
        textToConvert = await vscode.env.clipboard.readText();
        break;
      default:
        weirdThrow(`Input "${input}"`);
    }

    if (!textToConvert) {
      vscode.window.showErrorMessage('No text to convert', ...[enums.Button.ShowDetails]).then((btn) => {
        if (btn === enums.Button.ShowDetails) {
          vscode.window.showInformationMessage(input == enums.input.clipboard ? 'Nothing in clipboard' : 'No text is selected in the editor');
        }
      });
      return;
    }

    let struct = convertText(textToConvert);
    if (struct.error) {
      vscode.window.showErrorMessage('Invalid JSON', ...[enums.Button.ShowDetails]).then((btn) => {
        if (btn === enums.Button.ShowDetails) {
          vscode.window.showInformationMessage(struct.error);
        }
      });
      return;
    }

    let output = cfg.get(keys.settings.io.output);
    if (output === enums.output.askMe) {
      output = await vscode.window.showQuickPick(
        ...[capitalize(enums.output.clipboard), capitalize(enums.output.cursorPosition), capitalize(enums.output.temporaryFile)],
        {
          placeHolder: 'Select output destination',
        }
      );
      if (!output) {
        vscode.window.showInformationMessage('Nothing chosen, aborting');
        return;
      }
      output = output.toLowerCase();

      if (context.globalState.get(lKey(keys.context.askRememberOutput))) {
        let rememberOutput = await vscode.window.showQuickPick(...capitalizedValues(enums.Remember), {
          placeHolder: 'Remember output?',
        });

        switch (rememberOutput) {
          case enums.Remember.Yes:
            cfg.update(keys.settings.io.output, output, vscode.ConfigurationTarget.Global);
            break;
          case enums.Remember.DontAsk:
            context.globalState.update(lKey(keys.context.askRememberOutput), false);
            break;
          case enums.Remember.No:
            break;
          default:
            weirdThrow(`Remember output "${rememberOutput}"`);
        }
      }
    }

    switch (output) {
      case enums.output.clipboard:
        await vscode.env.clipboard.writeText(struct.go);
        if (context.globalState.get(lKey(keys.context.notifyClipboardOutput)))
          vscode.window.showInformationMessage('Go struct copied to clipboard', ...[enums.Button.DontShowAgain]).then((btn) => {
            if (btn === enums.Button.DontShowAgain) {
              vscode.commands.executeCommand('setContext', lKey(keys.context.notifyClipboardOutput, ':'), false);
              cfg.update(keys.context.notifyClipboardOutput, false, vscode.ConfigurationTarget.Global);
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
        tmp.file({ prefix: 'GoStruct-', postfix: '.go', keep: false }, async function (err, path, fd) {
          if (err) {
            vscode.window.showErrorMessage('Temp file error', ...[enums.Button.ShowDetails]).then((btn) => {
              if (btn === enums.Button.ShowDetails) {
                vscode.window.showInformationMessage(`Error: "${err.name}: ${err.message}"
                Path: "${path}
                File descriptor: "${fd}"`);
              }
            });
            return;
          }

          fs.writeFileSync(path, struct.go);

          let openPath = vscode.Uri.file(path);
          let doc = await vscode.workspace.openTextDocument(openPath);
          await vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside, false);
          if (cfg.get(keys.settings.autoSelectTypeName)) {
            await vscode.commands.executeCommand('cursorMove', {
              to: 'right',
              by: 'character',
              value: 5,
            });
            await vscode.commands.executeCommand('cursorMove', {
              to: 'right',
              by: 'character',
              value: cfg.get(keys.settings.generatedTypeName).length,
              select: true,
            });
          }
        });
        break;
      default:
        weirdThrow(`Output "${output}"`);
    }
  } catch (err) {
    vscode.window.showErrorMessage(`Error in ${keys.jsonToGo}-vsc`, ...[enums.Button.ShowDetails]).then((btn) => {
      if (btn === enums.Button.ShowDetails) {
        vscode.window.showInformationMessage(`Error: | Name: "${err.name}" | Message: "${err.message}" | Stack: "${err.stack}"`);
      }
    });
  }
}

/**
 * Registers an event listener for intercepting paste events and inserting golang struct string if it is valid JSON and editor language is supported.
 *
 * @param {vscode.ExtensionContext} context - The extension context.
 * @returns {vscode.Disposable} The disposable object that can be used to unregister the event listener.
 */
async function registerInterceptPasteListener(context) {
  return vscode.workspace.onDidChangeTextDocument(async (event) => {
    let clipboardText = await vscode.env.clipboard.readText();
    if (
      !clipboardText ||
      !(
        context.globalState.get(keys.context.pasteIntegrationAlways) ||
        cfg.get(keys.settings.pasteIntegration.supportedLanguages).includes(event.document.languageId)
      )
    )
      return;

    let struct = convertText(clipboardText);
    if (struct.error) return;

    for (let change of event.contentChanges) {
      if (change.text === clipboardText && change.text.length > 1) {
        let edit = new vscode.WorkspaceEdit();
        edit.replace(event.document.uri, change.range, struct);
        await vscode.workspace.applyEdit(edit);
      }
    }
  });
}

/**
 * Generates a full key by concatenating the given key with main extension key
 * @param {string} key - The key to be concatenated.
 * @param {string} [sep='.'] - The separator to be used. Default is '.'.
 * @returns {string} The generated long key.
 */
function lKey(key, sep = '.') {
  return keys.jsonToGo + sep + key;
}

/**
 * Retrieves the configuration object for the JSON to Go extension.
 * @returns {vscode.WorkspaceConfiguration} The configuration object.
 */
function getConfig() {
  return vscode.workspace.getConfiguration(keys.jsonToGo);
}

/**
 * Sets a default value for a given key in the global state of the context.
 * If the key does not exist in the global state, it will be set to the provided value.
 *
 * @param {vscode.ExtensionContext} context - The extension context.
 * @param {string} key - The key to set the default value for.
 * @param {any} value - The default value to set.
 */
function setDefault(context, key, value) {
  if (typeof context.globalState.get(lKey(key)) === 'undefined') {
    context.globalState.update(lKey(key), value);
  }
}

/**
 * Capitalizes the first letter of a string.
 *
 * @param {string} string - The input string.
 * @returns {string} The capitalized string.
 */
function capitalize(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

/**
 * Capitalizes the values of an object.
 * @param {Object} obj - The object whose values will be capitalized.
 * @returns {Array} - An array containing the capitalized values.
 */
function capitalizedValues(obj) {
  return Object.values(obj).map((val) => capitalize(val));
}

/**
 * Converts the given JSON text to Go struct using the current settings.
 * @param {string} text - The JSON text to convert.
 * @returns {{ error?: string, go: string }} - The Go struct representation of the JSON.
 */
function convertText(text) {
  let type = cfg.get(keys.settings.generatedTypeName);
  let inline = cfg.get(keys.settings.inlineTypeDefinitions);
  let allOmit = cfg.get(keys.settings.allOmitEmpty);
  return jsonToGo(text, type, inline, false, allOmit);
}

/**
 * Updates the mouse context menu command visibility context based on the active editor's language.
 * @returns {Promise<void>} A promise that resolves when the context is updated.
 */
async function updateMenuVisibilityContext() {
  let activeEditor = vscode.window.activeTextEditor;
  if (activeEditor) {
    let supported = cfg.get(keys.settings.contextMenu.supportedLanguages);
    if (supported.includes('*') || supported.includes(activeEditor.document.languageId)) {
      return await vscode.commands.executeCommand('setContext', lKey(keys.context.contextMenuVisible, ':'), true);
    }
  }
  return await vscode.commands.executeCommand('setContext', lKey(keys.context.contextMenuVisible, ':'), false);
}

/**
 * Updates the paste integration context with fresh values.
 * @returns {Promise<void>} A promise that resolves when the context is updated.
 */
async function updatePasteIntegrationContext() {
  return await vscode.commands.executeCommand(
    'setContext',
    lKey(keys.context.pasteIntegrationAlways, ':'),
    cfg.get(keys.settings.pasteIntegration.supportedLanguages).includes('*')
  );
}

/**
 * Throws weird stuff around.
 * @param {any} weird - Whatever it may be that is weird.
 * @throws {Error} - Always throws, always weird.
 */
function weirdThrow(weird) {
  if (weird) throw new Error(`${weird} is weird`);
  else throw new Error('Something is weird');
}

module.exports = {
  activate,
  deactivate,
  convert,
};
