// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');
const tmp = require('tmp')
const fs = require('fs')
const jsonToGo = require('./json-to-go.js')


/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
	let settings = vscode.workspace.getConfiguration('json-to-go')

	vscode.commands.executeCommand('setContext', 'json-to-go:supportedLanguages', settings.get('contextMenu.supportedLanguages'))

	let convertFunc = vscode.commands.registerCommand('json-to-go.convert', convert)
	context.subscriptions.push(convertFunc)
	console.log('JSON to Go Started')
}


function deactivate() {

}

async function convert() {

	try {
		console.log('Converting JSON to Go');

		let editor = vscode.window.activeTextEditor
		if (!editor) {
			vscode.window.showErrorMessage('No editor active')
			return
		}

		let selection = editor.selection
		let selectedText = editor.document.getText(selection)
		if (!selectedText) {
			vscode.window.showErrorMessage('No text selected')
			return
		}

		let inline = vscode.workspace.getConfiguration('json-to-go').get('inlineTypeDefinitions')
		let struct = jsonToGo(selectedText, null, !inline)
		if (struct.error) {
			vscode.window.showErrorMessage('Invalid JSON')
			return
		}

		tmp.file({ prefix: 'GoStruct-', postfix: '.go', keep: false }, function (err, path) {
			if (err) {
				vscode.window.showErrorMessage(err)
			}
			console.log('Temporary file: ', path);
			fs.writeFileSync(path, struct.go);

			let openPath = vscode.Uri.file(path)
			vscode.workspace.openTextDocument(openPath).then(doc => {
				vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside, false)
			})
		})


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
			50)

	} catch (err) {
		console.log(err)
	}
}


module.exports = {
	activate,
	deactivate,
	convert
}
