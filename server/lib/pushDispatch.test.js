import { test } from "node:test";
import assert from "node:assert/strict";

import { selectDeliverableTokens } from "./pushDispatch.js";

test("selectDeliverableTokens keeps only active, unique tokens", () => {
  const rows = [
    { token: "a", active: true },
    { token: "b", active: false },
    { token: "a", active: true }, // duplicate
    { token: "c", active: true },
    { token: "", active: true }, // empty
    null,
  ];
  assert.deepEqual(selectDeliverableTokens(rows).sort(), ["a", "c"]);
});

test("selectDeliverableTokens handles empty / missing input", () => {
  assert.deepEqual(selectDeliverableTokens([]), []);
  assert.deepEqual(selectDeliverableTokens(undefined), []);
});
