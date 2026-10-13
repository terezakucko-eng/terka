/**
 * The JSX runtime of the whole web (tsconfig `jsxImportSource`): React's own,
 * with Czech typography applied to the text of every element – so no line
 * ends with „v“ or „na“, wherever the text comes from.
 */
import * as R from "react/jsx-runtime";
import { typesetProps } from "../typography";

export { Fragment } from "react/jsx-runtime";
export type { JSX } from "react/jsx-runtime";

export const jsx: typeof R.jsx = (type, props, key) => R.jsx(type, typesetProps(type, props), key);
export const jsxs: typeof R.jsxs = (type, props, key) => R.jsxs(type, typesetProps(type, props), key);
