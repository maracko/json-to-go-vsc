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
    notifyClipboardOutput: 'notifyClipboardOutput',
    contextMenuLanguages: 'contextMenuLanguages',
    contextMenuAlways: 'contextMenuAlways',
  },
  settings: {
    contextMenu: {
      supportedLanguages: 'contextMenu.supportedLanguages',
    },
    input: 'input',
    /* ! Deprecated: replaced by input */
    inputSource: 'inputSource',
    output: 'output',
    inlineTypeDefinitions: 'inlineTypeDefinitions',
  },
  commands: {
    convert: 'convert',
  },
  jsonToGo: 'json-to-go',
};

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  let settings = getConfig();
  let supportedLanguages = settings.get(keys.settings.contextMenu.supportedLanguages);
  vscode.commands.executeCommand('setContext', longKey(keys.context.contextMenuLanguages, ':'), supportedLanguages);
  vscode.commands.executeCommand('setContext', longKey(keys.context.contextMenuAlways, ':'), supportedLanguages.includes('*'));

  // migrate inputSource to input
  let inputSource = settings.get(keys.settings.inputSource);
  if (inputSource) {
    settings.update(keys.settings.input, inputSource, vscode.ConfigurationTarget.Global);
    settings.update(keys.settings.inputSource, undefined, vscode.ConfigurationTarget.Global);
  }
  setDefault(context, keys.context.askRememberInput, true);
  setDefault(context, keys.context.askRememberOutput, true);
  setDefault(context, keys.context.notifyClipboardOutput, true);

  // register listener for context menu setting changes
  vscode.workspace.onDidChangeConfiguration((event) => {
    if (event.affectsConfiguration(keys.settings.contextMenu.supportedLanguages)) {
      (async () => {
        let supportedLanguages = settings.get(keys.settings.contextMenu.supportedLanguages);
        console.log(`longKeys: ${longKey(keys.context.contextMenuLanguages, ':')} | ${longKey(keys.context.contextMenuAlways, ':')}`);
        await vscode.commands.executeCommand('setContext', longKey(keys.context.contextMenuLanguages, ':'), supportedLanguages);
        await vscode.commands.executeCommand('setContext', longKey(keys.context.contextMenuAlways, ':'), supportedLanguages.includes('*'));
      })();
    }
  });

  let convertFunc = vscode.commands.registerCommand(longKey(keys.commands.convert), () => {
    convert(context);
  });
  context.subscriptions.push(convertFunc);
}

/*
 * TODO: Potential cleanup needed */
function deactivate() {}

/**
 * @param {vscode.ExtensionContext} context
 */
async function convert(context) {
  try {
    let settings = getConfig();
    let textToConvert = '';
    let input = settings.get(keys.settings.input);
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
    let askRememberInput = context.globalState.get(longKey(keys.context.askRememberInput));
    if (askRememberInput) {
      let rememberInput = await vscode.window.showQuickPick(...capitalizedValues(enums.Remember), {
        placeHolder: 'Remember input?',
      });

      switch (rememberInput) {
        case enums.Remember.Yes:
          settings.update(keys.settings.input, input, vscode.ConfigurationTarget.Global);
          break;
        case enums.Remember.DontAsk:
          context.globalState.update(longKey(keys.context.askRememberInput), false);
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

    let inline = settings.get(keys.settings.inlineTypeDefinitions);
    let struct = jsonToGo(textToConvert, null, !inline);
    if (struct.error) {
      vscode.window.showErrorMessage('Invalid JSON', ...[enums.Button.ShowDetails]).then((btn) => {
        if (btn === enums.Button.ShowDetails) {
          vscode.window.showInformationMessage(struct.error);
        }
      });
      return;
    }

    let output = settings.get(keys.settings.output);
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

      let askRememberOutput = context.globalState.get(longKey(keys.context.askRememberOutput));
      if (askRememberOutput) {
        let rememberOutput = await vscode.window.showQuickPick(...capitalizedValues(enums.Remember), {
          placeHolder: 'Remember output?',
        });

        switch (rememberOutput) {
          case enums.Remember.Yes:
            settings.update(keys.settings.output, output, vscode.ConfigurationTarget.Global);
            break;
          case enums.Remember.DontAsk:
            context.globalState.update(longKey(keys.context.askRememberOutput), false);
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
        if (settings.get(keys.context.notifyClipboardOutput))
          vscode.window.showInformationMessage('Go struct copied to clipboard', ...[enums.Button.DontShowAgain]).then((selection) => {
            if (selection === enums.Button.DontShowAgain) {
              settings.update(keys.context.notifyClipboardOutput, false, vscode.ConfigurationTarget.Global);
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

          await vscode.commands.executeCommand('cursorMove', {
            to: 'right',
            by: 'character',
            value: 5,
          });

          await vscode.commands.executeCommand('cursorMove', {
            to: 'right',
            by: 'character',
            value: 13,
            select: true,
          });
        });
        break;
      default:
        weirdThrow(`Output "${output}"`);
    }
  } catch (err) {
    vscode.window.showErrorMessage(`Error in ${keys.jsonToGo}-vsc`, ...[enums.Button.ShowDetails]).then((btn) => {
      if (btn === enums.Button.ShowDetails) {
        vscode.window.showInformationMessage(`Error Name: "${err.name}" | Error Message: "${err.message}" | Stack Trace: "${err.stack}"`);
      }
    });
  }
}

/* concat key with main key */
function longKey(key, sep = '.') {
  return keys.jsonToGo + sep + key;
}

/* get configuration */
function getConfig() {
  return vscode.workspace.getConfiguration(keys.jsonToGo);
}

/* set default value for key if not already set */
function setDefault(context, key, value) {
  if (typeof context.globalState.get(longKey(key)) === 'undefined') {
    context.globalState.update(longKey(key), value);
  }
}

/* capitalize first letter of string */
function capitalize(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

/* capitalize all values of an object and return as array */
function capitalizedValues(obj) {
  return Object.values(obj).map((val) => capitalize(val));
}

/* man this is weird */
function weirdThrow(weird) {
  if (weird) throw new Error(`${weird} is weird`);
  else throw new Error('Something is weird');
}

module.exports = {
  activate,
  deactivate,
  convert,
};
