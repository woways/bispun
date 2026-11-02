import { test } from "node:test";
import assert from "node:assert/strict";
import {
  setModuleBackHandler,
  runModuleBack,
  _resetModuleBackHandler,
} from "./moduleBack.js";

test("no handler -> runModuleBack returns false (back falls through to exit)", () => {
  _resetModuleBackHandler();
  assert.equal(runModuleBack(), false);
});

test("handler returning true -> handled (runModuleBack true)", () => {
  _resetModuleBackHandler();
  let calls = 0;
  setModuleBackHandler(() => {
    calls += 1;
    return true;
  });
  assert.equal(runModuleBack(), true);
  assert.equal(calls, 1);
});

test("handler returning false -> NOT handled, so the root screen can exit", () => {
  _resetModuleBackHandler();
  setModuleBackHandler(() => false);
  assert.equal(runModuleBack(), false);
});

test("non-true return (undefined) is treated as not handled", () => {
  _resetModuleBackHandler();
  setModuleBackHandler(() => undefined);
  assert.equal(runModuleBack(), false);
});

test("single-slot: last writer wins", () => {
  _resetModuleBackHandler();
  setModuleBackHandler(() => "stale");
  setModuleBackHandler(() => true);
  assert.equal(runModuleBack(), true);
});

test("StrictMode-safe: unregister only clears its own handler", () => {
  _resetModuleBackHandler();
  const unregFirst = setModuleBackHandler(() => true);
  setModuleBackHandler(() => true); // second owner replaces the slot
  unregFirst(); // must be a no-op: the slot no longer holds the first handler
  assert.equal(runModuleBack(), true);
});

test("non-function input -> no handler, unregister is safe", () => {
  _resetModuleBackHandler();
  const unreg = setModuleBackHandler(null);
  assert.equal(runModuleBack(), false);
  assert.doesNotThrow(() => unreg());
});
