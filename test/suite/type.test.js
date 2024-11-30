const { type, T } = require('../../src/type');

describe('type function', () => {
  test('should identify primitive types', () => {
    expect(type(123).all).toEqual([T.number]);
    expect(type('hello').all).toEqual([T.string]);
    expect(type(true).all).toEqual([T.boolean]);
    expect(type(undefined).all).toEqual([T.undefined]);
    expect(type(null).all).toEqual([T.null, T.object]);
  });

  test('should identify complex types', () => {
    expect(type(new Date()).all).toEqual([T.date, T.object]);
    expect(type(/regex/).all).toEqual([T.object, T.regexp]);
    expect(type(new Error()).all).toEqual([T.error, T.object]);
    expect(type(new Map()).all).toEqual([T.map, T.object]);
    expect(type(new Set()).all).toEqual([T.object, T.set]);
    expect(type(new WeakMap()).all).toEqual([T.object, T.weakmap]);
    expect(type(new WeakSet()).all).toEqual([T.object, T.weakset]);
    expect(type(new WeakRef({})).all).toEqual([T.object, T.weakref]);
    expect(type(Promise.resolve()).all).toEqual([T.object, T.promise]);
    expect(type(Symbol('sym')).all).toEqual([T.symbol]);
  });

  test('should handle empty objects and arrays', () => {
    expect(type({}).all).toEqual([T.object]);
    expect(type([]).all).toEqual([T.array, T.object]);
  });

  test('should handle instances of built-in types', () => {
    expect(type(new Boolean(true)).all).toEqual([T.boolean, T.object]);
    expect(type(new Number(123)).all).toEqual([T.number, T.object]);
    expect(type(new String('hello')).all).toEqual([T.object, T.string]);
  });

  test('should handle functions with different signatures', () => {
    expect(
      type(function (a, b, c, d) {
        return [a, b, c, d];
      }).all,
    ).toEqual([T.function, T.object]);
    expect(type((a, b) => a + b).all).toEqual([T.function, T.object]);
  });

  test('should handle objects with custom toString methods', () => {
    const obj = {
      toString() {
        return '[object Custom]';
      },
    };
    expect(type(obj).all).toEqual([T.object]);
  });

  test('should handle objects with null prototype', () => {
    const obj = Object.create(null);
    expect(type(obj).all).toEqual([T.object]);
  });

  test('should handle numbers edge cases', () => {
    expect(type(NaN).all).toEqual([T.number]);
    expect(type(Infinity).all).toEqual([T.number]);
  });

  test('should handle functions correctly', () => {
    expect(type(function () {}).all).toEqual([T.function, T.object]);
    expect(type(() => {}).all).toEqual([T.function, T.object]);
  });

  test('should identify custom types', () => {
    class CustomType {}
    expect(type(new CustomType()).all).toEqual([T.object]);
  });

  test('equalsType should compare types correctly', () => {
    expect(type(123).equalsType(456)).toBe(true);
    expect(type(123).equalsType('123')).toBe(false);
  });

  test('is should check if object is of all provided types', () => {
    expect(type([]).is(T.object, T.array)).toBe(true);
    expect(type([]).is(T.object, T.string)).toBe(false);
  });

  test('isNot should check if object is not of any of the provided types', () => {
    expect(type([]).isNot(T.string, T.number)).toBe(true);
    expect(type([]).isNot(T.object, T.array)).toBe(false);
  });

  test('match should match types correctly', () => {
    expect(type([]).match({ is: T.array, isNot: T.string })).toBe(true);
    expect(type([]).match({ is: T.array, isNot: T.object })).toBe(false);
  });

  test('toString should return string representation of types', () => {
    expect(type([]).toString()).toBe(`${T.array}, ${T.object}`);
    expect(type(123).toString()).toBe(T.number);
  });

  test('should identify async and generator functions correctly', () => {
    expect(type(async function () {}).all).toEqual([
      T.asyncFunction,
      T.function,
      T.object,
    ]);
    expect(type(async function* () {}).all).toEqual([
      T.asyncGeneratorFunction,
      T.function,
      T.object,
    ]);
    expect(type(function* () {}).all).toEqual([
      T.function,
      T.generatorFunction,
      T.object,
    ]);
    expect(type(BigInt(123)).all).toEqual([T.bigint]);
  });
});
