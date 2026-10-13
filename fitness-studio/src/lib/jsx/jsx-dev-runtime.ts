/** Development twin of ./jsx-runtime. */
import * as R from "react/jsx-dev-runtime";
import { typesetProps } from "../typography";

export { Fragment } from "react/jsx-dev-runtime";
export type { JSX } from "react/jsx-dev-runtime";

export const jsxDEV: typeof R.jsxDEV = (type, props, key, isStatic, source, self) =>
  R.jsxDEV(type, typesetProps(type, props), key, isStatic, source, self);
