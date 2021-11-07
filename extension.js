const vscode = require('vscode');
const tmp = require('tmp');
const fs = require('fs');
const jsonToGo = require('./json-to-go.js');



/**
 * Updates context for the right mouse context menu with values from settings.
 * Done like this because VS code didn't update context after a setting update for some reason
 **/
function setSupportedLanguagesContext() {
	let settings = vscode.workspace.getConfiguration('json-to-go')

	/** @type {Array} */
	let supportedLanguages = settings.get('contextMenu.supportedLanguages')
	vscode.commands.executeCommand('setContext', 'json-to-go:contextMenuLanguages', supportedLanguages)

	let allLanguages = supportedLanguages.includes('*')
	vscode.commands.executeCommand('setContext', 'json-to-go:contextMenuAlways', allLanguages)
}

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
	setSupportedLanguagesContext()


	//Initial setter for 'remember choice' context
	if (typeof context.globalState.get('json-to-go.askRememberChoice') === 'undefined') {
		context.globalState.update('json-to-go.askRememberChoice', true)
	}

	let convertFunc = vscode.commands.registerCommand('json-to-go.convert', () => { convert(context) })
	context.subscriptions.push(convertFunc)
}


function deactivate() {

}


/**
 * @param {vscode.ExtensionContext} context
 */
async function convert(context) {

	try {
		setSupportedLanguagesContext()

		let inputSource = vscode.workspace.getConfiguration('json-to-go').get('inputSource')
		let textToConvert = ''

		if (inputSource === 'ask me every time') {
			inputSource = await vscode.window.showQuickPick(['Clipboard', 'Selection'], { placeHolder: 'Select input source (can be changed inside extension settings)' })
			inputSource = inputSource.toLowerCase()

			let askRememberChoice = context.globalState.get('json-to-go.askRememberChoice')
			if (askRememberChoice) {
				let rememberChoice = await vscode.window.showQuickPick(['Yes', 'No', 'No and don\'t ask again'], { placeHolder: 'Remember choice?' });

				switch (rememberChoice) {
					case 'Yes':
						vscode.workspace.getConfiguration('json-to-go').update('inputSource', inputSource.toLowerCase(), vscode.ConfigurationTarget.Global);
						break;
					case 'No and don\'t ask again':
						context.globalState.update('json-to-go.askRememberChoice', false);
						break;
				}
			}

		}

		switch (inputSource) {
			case 'selection':
				let editor = vscode.window.activeTextEditor;
				if (!editor) {
					vscode.window.showErrorMessage('No editor active');
					return;
				}

				let selection = editor.selection;
				textToConvert = editor.document.getText(selection);
				break;
			case 'clipboard':
				textToConvert = await vscode.env.clipboard.readText()
				break;
		}

		if (!textToConvert) {
			vscode.window.showErrorMessage('No text to convert');
			return;
		}

		let inline = vscode.workspace.getConfiguration('json-to-go').get('inlineTypeDefinitions');
		let struct = jsonToGo(textToConvert, null, !inline);
		if (struct.error) {
			vscode.window.showErrorMessage('Invalid JSON')
			return
		}

		tmp.file({ prefix: 'GoStruct-', postfix: '.go', keep: false }, function (err, path) {
			if (err) {
				vscode.window.showErrorMessage(err)
			}
			fs.writeFileSync(path, struct.go);

			let openPath = vscode.Uri.file(path)
			vscode.workspace.openTextDocument(openPath).then(doc => {
				vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside, false)
					.then(() => {
						setTimeout(() => {
							vscode.commands.executeCommand('cursorMove', {
								to: 'right',
								by: 'character',
								value: 5
							})
						},
							50)

						setTimeout(() => {
							vscode.commands.executeCommand('cursorMove', {
								to: 'right',
								by: 'character',
								value: 13,
								select: true
							})
						},
							55)
					})
			})
		})

	} catch (err) {
		console.log("Error in json-to-go:", err)
	}
}


module.exports = {
	activate,
	deactivate,
	convert
}
