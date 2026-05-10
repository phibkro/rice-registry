export type Slots = {
  provides?: string[];
  consumes?: string[];
  conflicts?: string[];
};

export type CssVars = {
  theme?: Record<string, string>;
  light?: Record<string, string>;
  dark?: Record<string, string>;
};

export type IndexItem = {
  name: string;
  type: string;
  title?: string;
  description?: string;
  author?: string;
  categories?: string[];
  targets?: string[];
  slots?: Slots;
  url?: string;
};

export type RegistryIndex = {
  name: string;
  homepage?: string;
  description?: string;
  items: IndexItem[];
};

export type RegistryFile = {
  path: string;
  type: string;
  target?: string;
  content?: string;
};

export type RegistryItem = IndexItem & {
  registryDependencies?: string[];
  nixpkgsDependencies?: string[];
  cssVars?: CssVars;
  files?: RegistryFile[];
  compatibility?: Record<string, string>;
  version?: string;
  license?: string;
  meta?: Record<string, unknown>;
};

export type Mode = "light" | "dark";
