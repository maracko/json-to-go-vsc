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
	console.log("JSON to Go Started")
	//Add supported file extensions to context
	vscode.commands.executeCommand('setContext', 'json-to-go:activationTypes', [
		'javascript',
		'js',
		'typescript',
		'ts',
		'json',
		'jsonc',
		'html',
		'go',
		'gohtml'
	])

	let convertFunc = vscode.commands.registerCommand('json-to-go.convert', convert)
	context.subscriptions.push(convertFunc)

}


function deactivate() {

}

function convert() {
	console.log('Converting JSON to Go');
	let editor = vscode.window.activeTextEditor
	if (!editor) {
		vscode.window.showErrorMessage("No editor active")
		return
	}
	let selection = editor.selection
	let text = editor.document.getText(selection)
	if (!text) {
		vscode.window.showErrorMessage("No text selected")
		return
	}
	let struct = jsonToGo(text)
	if (struct.error) {
		vscode.window.showErrorMessage("Invalid JSON")
		return
	}

	tmp.file({ prefix: 'GoStruct-', postfix: '.go', keep: false }, function (err, path) {
		if (err) {
			throw err
		}
		console.log("Temporary file: ", path);
		fs.writeFileSync(path, struct.go)

		let openPath = vscode.Uri.file(path);

		vscode.workspace.openTextDocument(openPath).then(doc => {
			vscode.window.showTextDocument(doc, vscode.ViewColumn.Beside, false);
		})
	})


}

module.exports = {
	activate,
	deactivate,
	convert
}
