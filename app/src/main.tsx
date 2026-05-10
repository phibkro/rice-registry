/* @refresh reload */
import { render } from "solid-js/web";

import "@rice-registry/shared/styles/shell.css";
import "@rice-registry/shared/styles/fake-desktop.css";
import "./styles.css";

import { App } from "./App.tsx";

const root = document.getElementById("root");
if (!root) throw new Error("missing #root in index.html");
render(() => <App />, root);
