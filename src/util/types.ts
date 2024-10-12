export type AddParameters<
  TFunction extends (...args: any) => any,
  TParameters extends [...args: any]
> = (
  ...args: [...Parameters<TFunction>, ...TParameters]
) => ReturnType<TFunction>;

export type ValueOf<T> = T[keyof T];

export type AnyFn = (...args: any) => any;

export type ReadOnly<T> = T extends Function
  ? T
  : T extends object
  ? { readonly [K in keyof T]: ReadOnly<T[K]> }
  : T;
