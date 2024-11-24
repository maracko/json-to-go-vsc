const type = require('../../src/type');

const typeTestCases = [
  { value: null, typeName: 'null', allExpected: ['null', 'object'] },
  { value: [], typeName: 'array', allExpected: ['array', 'object'] },
  { value: [1, 2, 3], typeName: 'array', allExpected: ['array', 'object'] },
  { value: {}, typeName: 'object', allExpected: ['object'] },
  { value: { a: 1, b: 2 }, typeName: 'object', allExpected: ['object'] },
  { value: new Date(), typeName: 'date', allExpected: ['date', 'object'] },
  { value: function () {}, typeName: 'function', allExpected: ['function'] },
  { value: function namedFunction() {}, type: 'function', allExpected: ['function'] },
  { value: () => {}, typeName: 'function', allExpected: ['function'] },
  { value: /regex/, typeName: 'regexp', allExpected: ['regexp', 'object'] },
  { value: /regex/gi, typeName: 'regexp', allExpected: ['regexp', 'object'] },
  { value: new Error(), typeName: 'error', allExpected: ['error', 'object'] },
  { value: new TypeError(), typeName: 'error', allExpected: ['error', 'object'] },
  { value: 'string', typeName: 'string', allExpected: ['string'] },
  { value: '', typeName: 'string', allExpected: ['string'] },
  { value: ' ', typeName: 'string', allExpected: ['string'] },
  { value: 'special characters: !@#$%^&*()', type: 'string', allExpected: ['string'] },
  { value: 123, typeName: 'number', allExpected: ['number'] },
  { value: 0, typeName: 'number', allExpected: ['number'] },
  { value: -123, typeName: 'number', allExpected: ['number'] },
  { value: 123.456, typeName: 'number', allExpected: ['number'] },
  { value: -123.456, typeName: 'number', allExpected: ['number'] },
  { value: NaN, typeName: 'number', allExpected: ['number'] },
  { value: Infinity, typeName: 'number', allExpected: ['number'] },
  { value: true, typeName: 'boolean', allExpected: ['boolean'] },
  { value: false, typeName: 'boolean', allExpected: ['boolean'] },
  { value: undefined, typeName: 'undefined', allExpected: ['undefined'] },
];


typeTestCases.forEach((tc) => {
  const t = type(tc.value);
  test(`typeName: ${tc.typeName}, value: ${tc.value}, expected: ${tc.expectedTypes}`, () => {
    if (!t.is(tc.allExpected )) throw new Error(`match should be true`);
    if (!arrayEquals(t.all, tc.expectedTypes)) throw new Error(`all(${t.all}) should equal expectedTypes(${tc.expectedTypes})`);
  });
});


function arrayEquals(arr, arr2) {
  return arr.sort().toString() === arr2.sort().toString();
}

