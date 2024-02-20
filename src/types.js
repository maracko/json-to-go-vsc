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
 * @typedef {Object} TypeInfo An object containing type information.
 * @property {() => boolean} valueOf A function that returns the result of the check.
 * @property {string[]} allTypes A function that returns an array of all types matched.
 * @property {string[]} checkTypes Input types to check against.
 */
/**
 * Checks the provided argument against all global type enums and primitives, evaluating to true if it matches all of the type strings provided as input argument
 * @param {any} obj The object to check.
 * @param {...string} check The types to compare against.
 * @returns {TypeInfo} Result of the check.
 */
function type(obj, ...check) {
  let tt = [];

  if (obj === null) tt.push('null');
  if (obj === false || obj === true) tt.push('boolean');
  tt.push(typeof obj);

  if (Array.isArray(obj)) {
    tt.push('array');
  }
  if (Object.prototype.toString.call(obj) === '[object Object]') {
    tt.push('object');
  }
  if (Object.prototype.toString.call(obj) === '[object Date]') {
    tt.push('date');
  }
  if (Object.prototype.toString.call(obj) === '[object Function]') {
    tt.push('function');
  }
  if (Object.prototype.toString.call(obj) === '[object RegExp]') {
    tt.push('regexp');
  }
  if (Object.prototype.toString.call(obj) === '[object Error]') {
    tt.push('error');
  }

  let r = {
    valueOf: () => {
      for (const t of tt) {
        if (check.includes(t)) {
          return true;
        }
      }
      return false;
    },
    get allTypes() {
      return uniqueSortedArray(tt);
    },
    set allTypes(_) {},
    get checkTypes() {
      return uniqueSortedArray(check);
    },
    set checkTypes(_) {},
  };

  return r;
}

function uniqueSortedArray(arr) {
  return [...new Set(arr)].sort();
}

/**
 * Recursively creates a copy of an object or array.
 * @template T
 * @param {T} obj The object to be copied.
 * @returns {T} The deep copy of the input, or at least I hope so.
 */
function deepCopy(obj) {
  if (!type(obj, 'object') || type(obj, 'null')) return obj;

  let copy = Array.isArray(obj) ? [] : {};
  for (let key in obj) {
    if (obj.hasOwnProperty(key)) {
      copy[key] = deepCopy(obj[key]);
    }
  }

  return copy;
}

module.exports = { type, deepCopy };
