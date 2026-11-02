import { test } from "node:test";
import assert from "node:assert/strict";
import {
  pushBackInterceptor,
  runTopBackInterceptor,
  hasBackInterceptor,
  _resetBackInterceptors,
} from "./backStack.js";

test("no interceptor -> runTop returns false (back falls through to route/exit)", () => {
  _resetBackInterceptors();
  assert.equal(hasBackInterceptor(), false);
  assert.equal(runTopBackInterceptor(), false);
});

test("runs the top interceptor and reports it handled the back action", () => {
  _resetBackInterceptors();
  let closed = false;
  pushBackInterceptor(() => {
    closed = true;
  });
  assert.equal(hasBackInterceptor(), true);
  assert.equal(runTopBackInterceptor(), true);
  assert.equal(closed, true);
});

test("LIFO: a sheet opened over the drawer closes the sheet first", () => {
  _resetBackInterceptors();
  const order = [];
  pushBackInterceptor(() => order.push("drawer"));
  pushBackInterceptor(() => order.push("sheet"));
  runTopBackInterceptor();
  assert.deepEqual(order, ["sheet"]);
});

test("unregister removes exactly that interceptor, even out of order", () => {
  _resetBackInterceptors();
  const order = [];
  const unregDrawer = pushBackInterceptor(() => order.push("drawer"));
  // Real overlays unregister themselves on close (effect cleanup), so model that.
  let unregSheet;
  unregSheet = pushBackInterceptor(() => {
    order.push("sheet");
    unregSheet();
  });
  unregDrawer(); // drawer closed by its own control, not by back
  runTopBackInterceptor(); // runs the sheet, which unregisters itself
  assert.deepEqual(order, ["sheet"]);
  assert.equal(hasBackInterceptor(), false);
});

test("runTop calls but does not itself pop; the callback owns removal", () => {
  _resetBackInterceptors();
  let calls = 0;
  pushBackInterceptor(() => {
    calls += 1;
  });
  runTopBackInterceptor();
  // Callback did not unregister, so it is still on the stack (matches real usage
  // where the close callback drives a state change that later unregisters it).
  assert.equal(hasBackInterceptor(), true);
  assert.equal(calls, 1);
});

test("unregister is idempotent and safe to call twice", () => {
  _resetBackInterceptors();
  const unreg = pushBackInterceptor(() => {});
  unreg();
  unreg();
  assert.equal(hasBackInterceptor(), false);
});

test("non-function input is ignored and returns a no-op unregister", () => {
  _resetBackInterceptors();
  const unreg = pushBackInterceptor(null);
  assert.equal(typeof unreg, "function");
  assert.equal(hasBackInterceptor(), false);
  assert.doesNotThrow(() => unreg());
});
