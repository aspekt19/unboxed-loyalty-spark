import { assertEquals } from "jsr:@std/assert@1";
import { budgetAllows } from "./gas-budget.ts";

Deno.test("budget allows spend within the cap", () => {
  assertEquals(budgetAllows(49.99, 0.01, 50), true);
  assertEquals(budgetAllows(0, 0.01, 50), true);
});

Deno.test("budget exhausted refuses", () => {
  assertEquals(budgetAllows(49.995, 0.01, 50), false);
  assertEquals(budgetAllows(50, 0.01, 50), false);
});

Deno.test("zero budget refuses everything", () => {
  assertEquals(budgetAllows(0, 0.01, 0), false);
});
