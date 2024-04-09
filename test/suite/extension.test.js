const { type } = require('../../src/type');

const typeTestCases = [
  { value: null, typeName: 'null', expectedTypes: ['null', 'object'] },
  { value: [], typeName: 'array', expectedTypes: ['array', 'object'] },
  { value: [1, 2, 3], typeName: 'array', expectedTypes: ['array', 'object'] },
  { value: {}, typeName: 'object', expectedTypes: ['object'] },
  { value: { a: 1, b: 2 }, typeName: 'object', expectedTypes: ['object'] },
  { value: new Date(), typeName: 'date', expectedTypes: ['date', 'object'] },
  { value: function () {}, typeName: 'function', expectedTypes: ['function'] },
  { value: function namedFunction() {}, type: 'function', expectedTypes: ['function'] },
  { value: () => {}, typeName: 'function', expectedTypes: ['function'] },
  { value: /regex/, typeName: 'regexp', expectedTypes: ['regexp', 'object'] },
  { value: /regex/gi, typeName: 'regexp', expectedTypes: ['regexp', 'object'] },
  { value: new Error(), typeName: 'error', expectedTypes: ['error', 'object'] },
  { value: new TypeError(), typeName: 'error', expectedTypes: ['error', 'object'] },
  { value: 'string', typeName: 'string', expectedTypes: ['string'] },
  { value: '', typeName: 'string', expectedTypes: ['string'] },
  { value: ' ', typeName: 'string', expectedTypes: ['string'] },
  { value: 'special characters: !@#$%^&*()', type: 'string', expectedTypes: ['string'] },
  { value: 123, typeName: 'number', expectedTypes: ['number'] },
  { value: 0, typeName: 'number', expectedTypes: ['number'] },
  { value: -123, typeName: 'number', expectedTypes: ['number'] },
  { value: 123.456, typeName: 'number', expectedTypes: ['number'] },
  { value: -123.456, typeName: 'number', expectedTypes: ['number'] },
  { value: NaN, typeName: 'number', expectedTypes: ['number'] },
  { value: Infinity, typeName: 'number', expectedTypes: ['number'] },
  { value: true, typeName: 'boolean', expectedTypes: ['boolean'] },
  { value: false, typeName: 'boolean', expectedTypes: ['boolean'] },
  { value: undefined, typeName: 'undefined', expectedTypes: ['undefined'] },
];

typeTestCases.forEach((tc) => {
  const result = type(tc.value, ...tc.expectedTypes.sort());
  test(`typeName:"${jp(tc.typeName)}"|valueOf:"${jp(result.valueOf())}"|allTypes":"${jp(result.allTypes)}"|checkTypes:"${jp(
    result.checkTypes
  )}|expectedTypes:${jp(tc.expectedTypes)}"`, () => {
    if (result.valueOf() !== true) throw new Error(`valueOf should be true`);
    if (!arrStrEqual(result.checkTypes, tc.expectedTypes)) throw new Error(`checkTypes should equal expectedTypes`);
    if (!arrStrEqual(result.allTypes, tc.expectedTypes)) throw new Error(`allTypes should equal expectedTypes`);
  });
});

function arrStrEqual(arr, arr2) {
  return arr.toString() === arr2.toString();
}

function jp(obj) {
  return JSON.stringify(obj, null, 2);
}
