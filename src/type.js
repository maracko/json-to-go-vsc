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

/**
 * @typedef {Object} TypeInfo An object containing type information
 * @property {string[]} all An array of all types matched
 * @property {(other: any)=> boolean} equalsType Check if another object has exactly the same types
 * @property {(...types: string[])=> boolean} is Return true if object is of all provided types
 * @property {(...types: string[])=> boolean} isNot Return true if object is not of any of the provided types
 * @property {(what: { is?: string | string[], isNot?: string | string[] })=> boolean} match Return true if object matches all `is` types and none of the `isNot` types
 * @property {()=> string} toString String representation of all types matched
 */


/**
 * Type constants
 * @enum {string}
 */
const T = {
  array: 'array',
  bigint: 'bigint',
  boolean: 'boolean',
  date: 'date',
  error: 'error',
  function: 'function',
  null: 'null',
  number: 'number',
  object: 'object',
  regexp: 'regexp',
  symbol: 'symbol',
  string: 'string',
  undefined: 'undefined',
};

/**
 * Get type information of the provided argument
 * @param {any} obj The object to check.
 * @returns {TypeInfo} Result of the check.
 */
function type(obj) {
  let all = [];

  if (obj === null) all.push(T.null);
  if (obj === false || obj === true) all.push(T.boolean);

  all.push(typeof obj);

  if (Array.isArray(obj)) {
    all.push(T.array);
  }
  if (Object.prototype.toString.call(obj) === '[object Object]') {
    all.push(T.object);
  }
  if (Object.prototype.toString.call(obj) === '[object Date]') {
    all.push(T.date);
  }
  if (Object.prototype.toString.call(obj) === '[object Function]') {
    all.push(T.function);
  }
  if (Object.prototype.toString.call(obj) === '[object RegExp]') {
    all.push(T.regexp);
  }
  if (Object.prototype.toString.call(obj) === '[object Error]') {
    all.push(T.error);
  }

  all = [...new Set(all)].sort();

  return {
    get all() {
      return all;
    },

    equalsType(other) {
      return all.toString() === type(other).all.toString();
    },

    is(...types) {
      types = liftArray(types);

      return types.every(t => all.includes(t));
    },

    isNot(...types) {
      types = liftArray(types);

      return !types.some(t => all.includes(t));
    },

    match({ is, isNot }) {
      is = is || [];
      isNot = isNot || [];

      if (typeof is === T.string) is = [is];
      if (typeof isNot === T.string) isNot = [isNot];

      const matchAllIs = is.every(t => all.includes(t));
      const matchAnyIsNot = isNot.some(t => all.includes(t));

      return matchAllIs && !matchAnyIsNot;
    },

    toString() {
      return this.all.join(', ');
    }
  };
}

/**
 * Lift up array from variadic arguments if it is the only argument
 * @param {any[]} varArg
 * @returns {any[]} The lifted or original array
 */
function liftArray(varArg) {
  if (varArg.length === 1 && Array.isArray(varArg[0])) return varArg[0];
  else return varArg;
}

module.exports = { type ,T };