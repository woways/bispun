import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveListView } from "./listViewState.js";

test("loading wins over everything", () => {
  assert.equal(resolveListView({ loading: true, loadError: "x", itemCount: 0 }), "loading");
  assert.equal(resolveListView({ loading: true, loadError: "", itemCount: 5 }), "loading");
});

// THE regression: a failed load must NOT render as an empty "0 records" view.
test("load error -> 'error' even when itemCount is 0 (never 'empty')", () => {
  assert.equal(resolveListView({ loading: false, loadError: "Unable to load", itemCount: 0 }), "error");
});

test("load error takes precedence over stale items", () => {
  assert.equal(resolveListView({ loading: false, loadError: "Unable to load", itemCount: 3 }), "error");
});

test("loaded successfully with no items -> 'empty'", () => {
  assert.equal(resolveListView({ loading: false, loadError: "", itemCount: 0 }), "empty");
});

test("loaded successfully with items -> 'list'", () => {
  assert.equal(resolveListView({ loading: false, loadError: "", itemCount: 2 }), "list");
});
